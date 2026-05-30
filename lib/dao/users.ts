/**
 * Users data access — every read/write of task.users goes through here.
 *
 * Keeping queries in one file makes it easy to audit (and easy to swap to
 * an ORM later if the project grows beyond what raw SQL is comfortable for).
 */
import { sql } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import type { UserRole } from "@/lib/jwt";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PublicUser = Omit<UserRow, "password_hash">;

export function toPublic(u: UserRow): PublicUser {
  const { password_hash: _ph, ...rest } = u;
  return rest;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    select * from task.users where email = ${email.toLowerCase()} limit 1
  `;
  return rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    select * from task.users where id = ${id} limit 1
  `;
  return rows[0] ?? null;
}

export async function createUser(input: {
  email: string;
  password: string;
  full_name: string;
  role?: UserRole;
}): Promise<UserRow> {
  const hash = await hashPassword(input.password);
  const rows = await sql<UserRow[]>`
    insert into task.users (email, password_hash, full_name, role)
    values (
      ${input.email.toLowerCase()},
      ${hash},
      ${input.full_name},
      ${input.role ?? "user"}
    )
    returning *
  `;
  return rows[0];
}

export async function updateLastLogin(id: string): Promise<void> {
  await sql`update task.users set last_login_at = now() where id = ${id}`;
}

// ── Admin list / filter ────────────────────────────────────────────────────

export interface ListUsersOptions {
  search?: string;            // matches against full_name OR email
  role?: UserRole | "all";
  status?: "all" | "active" | "inactive";
  limit?: number;
  offset?: number;
}

export interface ListUsersResult {
  rows: PublicUser[];
  total: number;
}

export async function listUsers(
  opts: ListUsersOptions = {}
): Promise<ListUsersResult> {
  const search = opts.search?.trim() ?? "";
  const role = opts.role && opts.role !== "all" ? opts.role : null;
  const statusFilter =
    opts.status === "active"
      ? true
      : opts.status === "inactive"
        ? false
        : null;
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);
  const like = search ? `%${search.toLowerCase()}%` : null;

  const rows = await sql<UserRow[]>`
    select *
    from task.users
    where (${like}::text is null
       or lower(full_name) like ${like}::text
       or lower(email::text) like ${like}::text)
      and (${role}::task.user_role is null or role = ${role}::task.user_role)
      and (${statusFilter}::bool is null or is_active = ${statusFilter}::bool)
    order by created_at desc
    limit ${limit} offset ${offset}
  `;

  const [{ count }] = await sql<{ count: string }[]>`
    select count(*)::text as count
    from task.users
    where (${like}::text is null
       or lower(full_name) like ${like}::text
       or lower(email::text) like ${like}::text)
      and (${role}::task.user_role is null or role = ${role}::task.user_role)
      and (${statusFilter}::bool is null or is_active = ${statusFilter}::bool)
  `;

  return { rows: rows.map(toPublic), total: Number(count) };
}

// ── For the assignee picker ─────────────────────────────────────────────────

export interface AssignableUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  inactive_on_date: boolean;
}

/** Active users for the assignee picker. If `date` is provided, each row also
 *  carries `inactive_on_date = true` if that user has an explicit
 *  user_date_status with is_active=false on that date. */
export async function listActiveAssignableUsers(
  date?: string | null,
  projectId?: string | null
): Promise<AssignableUser[]> {
  return sql<AssignableUser[]>`
    select
      u.id,
      u.full_name,
      u.email::text as email,
      u.role,
      coalesce(uds.is_active = false, false) as inactive_on_date
    from task.users u
    left join task.user_date_status uds
      on uds.user_id = u.id
     and uds.date = ${date ?? null}::date
    where u.is_active = true
      and (${projectId ?? null}::uuid is null
           or exists (select 1 from task.project_members pm
                       where pm.user_id = u.id
                         and pm.project_id = ${projectId ?? null}::uuid))
    order by u.full_name asc
  `;
}

// ── Admin mutations ────────────────────────────────────────────────────────

export async function updateUser(
  id: string,
  fields: { role?: UserRole; is_active?: boolean; full_name?: string }
): Promise<UserRow | null> {
  const rows = await sql<UserRow[]>`
    update task.users
       set role        = coalesce(${fields.role ?? null}::task.user_role, role),
           is_active   = coalesce(${fields.is_active ?? null}::bool, is_active),
           full_name   = coalesce(${fields.full_name ?? null}::text, full_name)
     where id = ${id}
    returning *
  `;
  return rows[0] ?? null;
}

/** Set a new password (e.g. an admin-issued temporary password). */
export async function setUserPassword(
  id: string,
  newPassword: string
): Promise<boolean> {
  const hash = await hashPassword(newPassword);
  const rows = await sql<{ id: string }[]>`
    update task.users set password_hash = ${hash} where id = ${id} returning id
  `;
  return rows.length > 0;
}

/** Active admin-tier user ids (workspace admins + super admins) — recipients
 *  for admin-facing notifications like password reset requests. */
export async function listAdminRecipientIds(): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from task.users
     where is_active = true
       and (role = 'admin' or is_super_admin = true)
  `;
  return rows.map((r) => r.id);
}

export type AuthResult =
  | { ok: true; user: UserRow }
  | { ok: false; reason: "not_found" | "wrong_password" | "inactive" };

export async function authenticate(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "not_found" };
  // Verify the password BEFORE checking active status. That way "inactive" is
  // only ever returned to someone who proved they own the account (correct
  // password), so we can safely show a clear "deactivated" message without
  // letting an attacker enumerate which emails are real but disabled.
  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) return { ok: false, reason: "wrong_password" };
  if (!user.is_active) return { ok: false, reason: "inactive" };
  return { ok: true, user };
}
