/**
 * Create or promote a user to admin.
 *
 *   npx tsx scripts/make-admin.ts <email> <password> "<full name>"
 *
 * If a user with that email already exists, they're promoted to admin and
 * (optionally) their password is reset. Otherwise a new admin user is created.
 *
 * Requires DATABASE_URL to be set (it reads .env.local automatically when
 * invoked via `npm run make-admin`).
 *
 * Phase 12: dotenv is loaded via the side-effect import below — it MUST
 * come before any import that touches `process.env` (lib/env, lib/db,
 * lib/password). ES module hoisting means top-level imports execute in source
 * order, so this works as long as nothing reordered.
 */
import "dotenv/config";

import { sql } from "../lib/db";
import { hashPassword } from "../lib/password";

// Honor a non-default env file via DOTENV_CONFIG_PATH if provided.
if (process.env.DOTENV_CONFIG_PATH) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: process.env.DOTENV_CONFIG_PATH });
}

async function main() {
  const [, , email, password, fullName] = process.argv;
  if (!email || !password || !fullName) {
    console.error(
      'Usage: npx tsx scripts/make-admin.ts <email> <password> "<full name>"'
    );
    process.exit(1);
  }

  const hash = await hashPassword(password);
  const lower = email.toLowerCase();

  const rows = await sql<
    Array<{ id: string; email: string; full_name: string; role: string }>
  >`
    insert into task.users (email, password_hash, full_name, role, is_active)
    values (${lower}, ${hash}, ${fullName}, 'admin', true)
    on conflict (email) do update
      set password_hash = excluded.password_hash,
          full_name     = excluded.full_name,
          role          = 'admin',
          is_active     = true
    returning id, email, full_name, role
  `;

  console.log("✔ Admin ready:", rows[0]);
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
