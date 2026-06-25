/**
 * Postgres client (postgres.js).
 *
 * All app objects live under the `task` schema. We set `search_path` on every
 * new connection so unqualified table names resolve there first (every query is
 * also schema-qualified, so this is belt-and-suspenders).
 *
 * Serverless + connection-limit notes (this DB is shared and capped at 60):
 *   - Prefer Supabase's **Transaction pooler** (port 6543) in DATABASE_URL. It
 *     multiplexes many serverless functions onto a few shared connections so
 *     idle connections can't pile up against the limit.
 *   - `prepare: false` is REQUIRED for the transaction pooler and also avoids
 *     "prepared statement already exists" on the session pooler.
 *   - Keep `max` tiny: each warm serverless instance keeps its own pool, so
 *     max × instances is what exhausts the database.
 */
import postgres from "postgres";
import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

function createClient() {
  return postgres(env.DATABASE_URL, {
    ssl: "require",
    // Small per-instance pool + short idle timeout: keeps the app's connection
    // footprint minimal on a shared, connection-limited database.
    max: 2,
    idle_timeout: 10,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
    connection: {
      search_path: `${env.DB_SCHEMA}, public`,
      application_name: "task-portal",
    },
  });
}

export const sql = global.__sql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__sql = sql;
}

/**
 * Convenience helper for queries that should run in a transaction.
 *   await tx(async (t) => { await t`...`; await t`...`; });
 */
export async function tx<T>(fn: (t: typeof sql) => Promise<T>): Promise<T> {
  return sql.begin(async (t) => fn(t as unknown as typeof sql)) as Promise<T>;
}
