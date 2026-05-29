/**
 * Projects data access — projects, per-project membership, and the role checks
 * that drive project-scoped visibility and permissions.
 *
 * Workspace admins (users.role = 'admin') are super-admins: they see and manage
 * every project. Otherwise access is by project membership; project_members.role
 * = 'admin' may manage that project's tasks + team.
 */
import { sql } from "@/lib/db";
import type { UserRole } from "@/lib/jwt";

export type ProjectRole = "admin" | "member";

export interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProjectWithMeta extends ProjectRow {
  member_count: number;
  task_count: number;
  my_role: ProjectRole | null;
}

export interface ProjectMemberRow {
  project_id: string;
  user_id: string;
  full_name: string;
  email: string;
  role: ProjectRole;
  added_at: Date;
}

/** Projects the user can see: all (workspace admin) or those they belong to. */
export async function listProjectsForUser(
  userId: string,
  _role: UserRole
): Promise<ProjectWithMeta[]> {
  const isAdmin = await isSuperAdmin(userId);
  return sql<ProjectWithMeta[]>`
    select p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at,
           (select count(*)::int from task.project_members m where m.project_id = p.id) as member_count,
           (select count(*)::int from task.tasks t where t.project_id = p.id) as task_count,
           (select m2.role from task.project_members m2
             where m2.project_id = p.id and m2.user_id = ${userId}::uuid) as my_role
      from task.projects p
     where ${isAdmin}::bool
        or exists (select 1 from task.project_members m
                    where m.project_id = p.id and m.user_id = ${userId}::uuid)
     order by p.name asc
  `;
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const rows = await sql<ProjectRow[]>`
    select id, name, description, created_by, created_at, updated_at
      from task.projects where id = ${id}::uuid limit 1
  `;
  return rows[0] ?? null;
}

/** The user's role in a project, or null if not a member. */
export async function getProjectRole(
  userId: string,
  projectId: string
): Promise<ProjectRole | null> {
  const rows = await sql<{ role: ProjectRole }[]>`
    select role from task.project_members
     where project_id = ${projectId}::uuid and user_id = ${userId}::uuid
     limit 1
  `;
  return rows[0]?.role ?? null;
}

/** Top tier: sees all projects, creates projects, hard-deletes. */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const rows = await sql<{ is_super_admin: boolean }[]>`
    select is_super_admin from task.users where id = ${userId}::uuid limit 1
  `;
  return rows[0]?.is_super_admin ?? false;
}

/** Active super-admin user ids — recipients for project requests. */
export async function listSuperAdminIds(): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    select id from task.users where is_super_admin = true and is_active = true
  `;
  return rows.map((r) => r.id);
}

/** Manage = create/edit/delete/transfer/assign within a project.
 *  Super admin (any project) OR an admin-tier user who belongs to the project. */
export async function canManageProject(
  userId: string,
  role: UserRole,
  projectId: string
): Promise<boolean> {
  const rows = await sql<{ is_super: boolean; is_member: boolean }[]>`
    select
      coalesce((select is_super_admin from task.users where id = ${userId}::uuid), false) as is_super,
      exists (select 1 from task.project_members pm
               where pm.project_id = ${projectId}::uuid
                 and pm.user_id = ${userId}::uuid) as is_member
  `;
  const r = rows[0];
  return !!r?.is_super || (role === "admin" && !!r?.is_member);
}

/** Access = see the project's tasks. Super admin OR any member. */
export async function canAccessProject(
  userId: string,
  _role: UserRole,
  projectId: string
): Promise<boolean> {
  if (await isSuperAdmin(userId)) return true;
  return (await getProjectRole(userId, projectId)) !== null;
}

export async function listProjectMembers(
  projectId: string
): Promise<ProjectMemberRow[]> {
  return sql<ProjectMemberRow[]>`
    select m.project_id, m.user_id, u.full_name, u.email::text as email,
           m.role, m.added_at
      from task.project_members m
      join task.users u on u.id = m.user_id
     where m.project_id = ${projectId}::uuid
     order by (m.role = 'admin') desc, u.full_name asc
  `;
}

/** Projects the user can create tasks in (project admin) — admin sees all. */
export async function listManageableProjects(
  userId: string,
  role: UserRole
): Promise<ProjectRow[]> {
  const sup = await isSuperAdmin(userId);
  // Members (role 'user') manage nothing. Admin-tier users manage projects
  // they belong to; super admins manage all.
  if (!sup && role !== "admin") return [];
  return sql<ProjectRow[]>`
    select p.id, p.name, p.description, p.created_by, p.created_at, p.updated_at
      from task.projects p
     where ${sup}::bool
        or exists (select 1 from task.project_members m
                    where m.project_id = p.id and m.user_id = ${userId}::uuid)
     order by p.name asc
  `;
}

// ── Mutations ───────────────────────────────────────────────────────────────

export async function createProject(input: {
  name: string;
  description?: string | null;
  created_by: string;
}): Promise<ProjectRow> {
  const rows = await sql<ProjectRow[]>`
    insert into task.projects (name, description, created_by)
    values (${input.name}, ${input.description ?? null}, ${input.created_by}::uuid)
    returning id, name, description, created_by, created_at, updated_at
  `;
  const project = rows[0]!;
  // The creator becomes a project admin.
  await sql`
    insert into task.project_members (project_id, user_id, role, added_by)
    values (${project.id}::uuid, ${input.created_by}::uuid, 'admin', ${input.created_by}::uuid)
    on conflict (project_id, user_id) do update set role = 'admin'
  `;
  return project;
}

export async function addMember(opts: {
  project_id: string;
  user_id: string;
  role: ProjectRole;
  added_by: string;
}): Promise<void> {
  await sql`
    insert into task.project_members (project_id, user_id, role, added_by)
    values (${opts.project_id}::uuid, ${opts.user_id}::uuid, ${opts.role}, ${opts.added_by}::uuid)
    on conflict (project_id, user_id) do update set role = excluded.role
  `;
}

export async function removeMember(
  projectId: string,
  userId: string
): Promise<boolean> {
  const rows = await sql<{ user_id: string }[]>`
    delete from task.project_members
     where project_id = ${projectId}::uuid and user_id = ${userId}::uuid
    returning user_id
  `;
  return rows.length > 0;
}

/** Are these user_ids all members of the project? Returns the ones that are NOT. */
export async function findNonMembers(
  projectId: string,
  userIds: string[]
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await sql<{ id: string }[]>`
    select uid as id
      from unnest(${userIds}::uuid[]) as uid
     where not exists (
       select 1 from task.project_members m
        where m.project_id = ${projectId}::uuid and m.user_id = uid
     )
  `;
  return rows.map((r) => r.id);
}
