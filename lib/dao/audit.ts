/**
 * Audit log DAO.
 *
 * `recordAudit` is fire-and-forget from the caller's perspective: it swallows
 * its own errors so a logging failure can never break the operation it's
 * meant to record. `listAuditLog` powers the admin report and the per-user
 * "My activity" view.
 */
import { sql } from "@/lib/db";

export interface AuditEntryInput {
  /** The acting user's id, or null (anonymous failed login / system). */
  actorId?: string | null;
  /** Denormalized email so the entry survives user deletion. */
  actorEmail?: string | null;
  /** Dotted verb, e.g. "auth.login", "task.created", "attachment.removed". */
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  /** Human-readable one-liner. */
  summary: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}

export async function recordAudit(e: AuditEntryInput): Promise<void> {
  try {
    await sql`
      insert into task.audit_log
        (actor_id, actor_email, action, entity_type, entity_id, summary, metadata, ip)
      values (
        ${e.actorId ?? null}::uuid,
        ${e.actorEmail ?? null},
        ${e.action},
        ${e.entityType ?? null},
        ${e.entityId ?? null},
        ${e.summary},
        ${JSON.stringify(e.metadata ?? {})}::jsonb,
        ${e.ip ?? null}
      )
    `;
  } catch (err) {
    // Audit logging must never break the operation it records.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record", e.action, err);
  }
}

export interface AuditRow {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: Date;
}

export interface ListAuditOptions {
  /** Restrict to a single actor (used by the per-user "My activity" view). */
  actorId?: string | null;
  /** Exact action match, e.g. "task.created". */
  action?: string | null;
  /** Case-insensitive match on summary or actor email. */
  search?: string | null;
  limit?: number;
  offset?: number;
}

export async function listAuditLog(
  opts: ListAuditOptions = {}
): Promise<{ rows: AuditRow[]; total: number }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const where = sql`
    where ${opts.actorId ? sql`actor_id = ${opts.actorId}::uuid` : sql`true`}
      and ${opts.action ? sql`action = ${opts.action}` : sql`true`}
      and ${
        opts.search
          ? sql`(summary ilike ${"%" + opts.search + "%"} or actor_email ilike ${"%" + opts.search + "%"})`
          : sql`true`
      }
  `;

  const rows = await sql<AuditRow[]>`
    select id, actor_id, actor_email, action, entity_type, entity_id,
           summary, metadata, ip, created_at
      from task.audit_log
      ${where}
     order by created_at desc, id desc
     limit ${limit} offset ${offset}
  `;

  const [{ count }] = await sql<{ count: number }[]>`
    select count(*)::int as count from task.audit_log ${where}
  `;

  return { rows, total: count };
}
