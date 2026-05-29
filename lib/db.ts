/**
 * Postgres client (postgres.js).
 *
 * All app objects live under the `task` schema. We set `search_path` on every
 * new connection so unqualified table names resolve there first.
 *
 * The Supabase session pooler is used (port 5432), so prepare = false to avoid
 * "prepared statement already exists" issues when connections get reused.
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
    max: 10,
    idle_timeout: 20,
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
