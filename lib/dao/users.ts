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
  date?: string | null
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

export type AuthResult =
  | { ok: true; user: UserRow }
  | { ok: false; reason: "not_found" | "wrong_password" | "inactive" };

export async function authenticate(
  email: string,
  password: string
): Promise<AuthResult> {
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "not_found" };
  if (!user.is_active) return { ok: false, reason: "inactive" };
  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) return { ok: false, reason: "wrong_password" };
  return { ok: true, user };
}
