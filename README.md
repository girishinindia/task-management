# Task Portal

Date-driven, multi-user task management built on **Next.js 14 (App Router)** with a **Supabase Postgres** backend (custom `task` schema, no Supabase Auth or RLS), **custom JWT + Upstash Redis** session auth, and **Bunny Storage + CDN** for attachments.

This README reflects what's actually shipped. The file at `../task-manager-development-phases.md` was the original plan and describes a different (Supabase Auth + RLS) approach — the implementation deliberately diverged for tighter control and less Supabase lock-in.

---

## Status (Phases 1 – 12)

| Phase | What ships | Where |
|------:|------------|-------|
| 1 | Project skeleton, shadcn theme, landing page | `app/page.tsx`, `app/globals.css` |
| 2 | `task.*` schema, enums, tables, indexes, triggers, RPCs | `supabase/migrations/0001` – `0004` |
| 3 | Custom JWT + Redis auth, login/signup/logout/refresh | `lib/auth.ts`, `lib/jwt.ts`, `lib/redis.ts`, `app/api/auth/*` |
| 4 | Admin user management + per-date activation overrides | `app/admin/users/*`, `app/api/admin/users/*` |
| 5 | Task CRUD | `app/api/tasks/*`, `app/dashboard/tasks/*` |
| 6 | Multi-user assignment | `app/api/tasks/[id]/assignments/*`, `components/users/assignee-picker.tsx` |
| 7 | Today view, Calendar grid, date chips, sidebar nav | `supabase/migrations/0006`, `app/dashboard/{today,calendar}/*` |
| 8 | Status workflow + activity timeline + PATCH bypass closed | `app/api/tasks/[id]/status/route.ts`, `app/dashboard/tasks/[id]/{status-menu,activity-timeline}.tsx` |
| 9 | Task transfers + transfer timeline | `app/api/tasks/[id]/transfer/route.ts`, `app/dashboard/tasks/[id]/{transfer-dialog,transfer-timeline}.tsx` |
| 10 | Attachments (Bunny files + URL links) | `app/api/tasks/[id]/attachments/**`, `app/dashboard/tasks/[id]/attachments-section.tsx` |
| 11 | Notifications bell + page + dashboard activity feed | `components/notifications-bell.tsx`, `app/dashboard/notifications/*`, `app/dashboard/activity-feed.tsx` |
| 12 | Auth bug fixes, rate limiting, error envelope, Playwright scaffold, this README | `lib/{ratelimit,with-route}.ts`, `tests/e2e/*`, `playwright.config.ts` |

---

## Architecture at a glance

```
                 ┌────────────────────────────────────────────┐
                 │              Next.js 14 App                │
                 │                                            │
   browser ───▶  │  ┌─ middleware.ts ── JWT signature check ─┐│
                 │  └─ requireUser() ── + Redis session check││
                 │                                            │
                 │  app/dashboard/*        app/admin/*        │
                 │       │                      │             │
                 │       ▼                      ▼             │
                 │  Server Components ───► DAO layer (lib/dao)│
                 │                              │             │
                 │  Route handlers (app/api/*)  │             │
                 │       │                      │             │
                 │       ▼                      ▼             │
                 └───────┼──────────────────────┼─────────────┘
                         │                      │
              ┌──────────┴────────┐   ┌─────────┴────────┐
              │  Upstash Redis    │   │ Supabase Postgres│
              │  sessions+refresh │   │  schema "task"   │
              │  rate limits + OTP│   │  no RLS — app    │
              └───────────────────┘   │  enforces authz  │
                                      └────────┬─────────┘
                                               │
                                      ┌────────┴─────────┐
                                      │   Bunny Storage  │
                                      │   + Bunny CDN    │
                                      │  attachments     │
                                      └──────────────────┘
```

**Key invariants**

- Every query touches Postgres via `lib/db.ts` (`postgres.js`, `search_path = task, public`, pool=10, `prepare=false` for the Supabase session pooler).
- Every protected page calls `requireUser()`, which verifies the access JWT **and** checks the Redis session, so revoked sessions kill the cookie immediately.
- App code — not RLS — enforces task visibility (`creator | assignee | admin`) and mutation rights.
- Sensitive RPCs live under `task.*`: `change_task_status`, `transfer_task`, `task_day_counts`. UI never edits `tasks.status` directly.

---

## Schema overview (under `task.*`)

```
users               ────  citext email, bcrypt password_hash, role, is_active
user_date_status    ────  per-(user, date) activation overrides
tasks               ────  title, description, status, priority, start_date, due_date, created_by
task_assignments    ────  m-to-m join (task_id, user_id)
task_attachments    ────  polymorphic kind=file|url with CHECK constraint
task_status_history ────  audit trail of every status change
task_transfers      ────  audit trail of every reassignment
notifications       ────  in-app fan-out target (assigned, transferred, status_changed)
```

Functions:

- `change_task_status(task_id, to_status, actor, note?)` — enforces the legal transition matrix.
- `transfer_task(task_id, from_user, to_user, actor, reason?)` — atomic remove/add/audit + active-on-due-date guard.
- `task_day_counts(actor, role, from, to)` — per-day count of visible tasks for the calendar grid.

Triggers (all in `task.*`):

- `trg_notify_on_assignment` — assignee gets a notification on `task_assignments` INSERT (skipped if self).
- `trg_notify_on_transfer` — receiver gets a notification on `task_transfers` INSERT.
- `trg_notify_on_status_change` — all current assignees except the actor get a notification on `task_status_history` INSERT.
- `trg_users_updated_at`, `trg_tasks_updated_at` — `updated_at` maintenance.

---

## Environment

Copy `.env.local.example` → `.env.local` and fill in the values.

```
# Supabase
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # not used by app code; kept for ops
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-X-REGION.pooler.supabase.com:5432/postgres?sslmode=require
DB_SCHEMA=task

# JWT
JWT_ACCESS_SECRET=<32+ random bytes>
JWT_REFRESH_SECRET=<32+ random bytes>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Upstash Redis (REST URL + token from the database's REST API tab)
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
REDIS_SESSION_TTL=1800
REDIS_OTP_TTL=600

# Bunny
BUNNY_STORAGE_ZONE=...
BUNNY_STORAGE_KEY=...
BUNNY_STORAGE_URL=https://<region>.storage.bunnycdn.com/<zone>
BUNNY_CDN_URL=https://<your-cdn-pullzone>

# reCAPTCHA Enterprise (optional — disable for local dev)
RECAPTCHA_ENABLED=false
NEXT_PUBLIC_RECAPTCHA_ENABLED=false
RECAPTCHA_API_KEY=...
RECAPTCHA_PROJECT_ID=...
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=...
RECAPTCHA_MIN_SCORE=0.5

# Phase 12 hardening
ALLOW_PUBLIC_SIGNUP=false            # default off — admin-invite-only

# App
NEXT_PUBLIC_APP_NAME=Task Portal
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate JWT secrets with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

---

## Local development

```bash
npm install
# 1. Apply DB migrations (or use the Supabase SQL editor / supabase CLI):
#    open Supabase SQL editor → run 0001…0004 → 0006 in order.
#    0005_seed_admin.sql ships with a placeholder hash; use make-admin instead.
npm run make-admin -- you@example.com 'YourStrongPass1' "Your Name"
npm run dev
```

Open <http://localhost:3000>, sign in as the admin you just created.

---

## Production deployment (Vercel + Supabase)

1. **Supabase** — create a project, run migrations 0001 → 0004 → 0006 in the SQL editor (or with the supabase CLI). Enable point-in-time backups in the dashboard (Database → Backups). Take note of the session-pooler `DATABASE_URL` (port 5432 + `sslmode=require`).
2. **Upstash Redis** — create a database in a region near your Vercel deployment. Copy the **REST URL** and **REST token** into `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`. Don't use the raw `rediss://` URL — `@upstash/redis` uses the REST API.
3. **Bunny** — create a Storage zone (note the region URL), pull-zone CDN on top of it, copy the access key. Set the four `BUNNY_*` envs.
4. **Vercel** — link the repo, paste all envs under both Preview and Production. Build command stays `next build`. Deploy.
5. **First admin** — run `npm run make-admin` against the production `DATABASE_URL` from your laptop (don't commit the env). The script is idempotent and re-promotes an existing email to admin without changing other fields except the password.
6. **Smoke test** — log in, create a task, assign someone, change status. Notifications should populate.

---

## Runbook

### Create or promote an admin

```bash
npm run make-admin -- alice@example.com 'NewPass1!' "Alice Doe"
```

If the email exists the user is promoted to admin and their password is reset to the second argument. Otherwise a new admin user is created.

### Rotate JWT secrets

1. Update `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` in Vercel (48+ random bytes each, base64url).
2. Trigger a redeploy. All existing tokens become invalid at the next verification, so every user must log in again.
3. Optionally flush the Redis session/refresh keyspace too if you want zero overlap with old tokens.

### Restore from Supabase backup

Supabase → Database → Backups → pick a snapshot → "Restore". Migrations are idempotent, so any drift between backup and code can be re-applied with the migration files.

### Clean up orphan Bunny objects

The file-upload route uploads to Bunny **before** inserting the DB row, so a failed DB write leaves a path in Bunny pointing at nothing. The error response includes `orphan_path` so you can re-issue a delete. Periodically, list everything under `tasks/<task_id>/` for tasks that no longer exist and `deleteFromBunny()` it.

### Force-logout a user

Admin → Users → toggle `is_active` off (the PATCH handler calls `revokeAllSessions` and `revokeAllRefreshTokens`), or run:

```sql
update task.users set is_active = false where email = 'someone@example.com';
```

Their next request fails the Redis check and the cookies clear.

---

## Security model

- **Tokens.** Access JWT 15 minutes, refresh JWT 7 days. Both signed HS256 with separate secrets. Both `jti`-tracked in Redis.
- **Cookies.** `httpOnly`, `SameSite=Lax`, `Secure` in production.
- **Redis session check.** Every protected page re-validates the access jti against Redis before rendering — so admin deactivation, "log out everywhere", and explicit revocations kick in within one request.
- **Logout.** Phase 12 closes the old bug: the refresh jti is now revoked too, not just the cookies cleared.
- **Family-reuse detection.** Phase 12: if `/api/auth/refresh` sees a valid JWT whose jti is missing from Redis, every session and refresh token for that user is revoked. Honest user re-logs once; attacker is locked out across every device they hold.
- **Brute-force suppression.** Per-IP and per-email rate limits on login; per-IP on signup and refresh. Fixed window on Upstash Redis, no new dependency.
- **Self-service signup is off by default** (`ALLOW_PUBLIC_SIGNUP=false`). Admins create users via the admin UI.
- **App-code authz.** Authorization is enforced inside route handlers and DAOs, not via Postgres RLS. The trade-off is intentional: simpler audit surface, no service-role key in app paths, easier swap to another Postgres host. The cost is that every new route MUST call `requireUser()`/`requireAdmin()` and do its own permission check.
- **CSRF.** SameSite=Lax + same-origin JSON is sufficient for v1. If you ever ship a same-origin form-encoded mutator, add a token.

---

## Testing

End-to-end smoke is scaffolded but not wired to CI yet.

```bash
npm install --save-dev @playwright/test
npx playwright install
npm run test:e2e
```

The test env must have `ALLOW_PUBLIC_SIGNUP=true`, `RECAPTCHA_ENABLED=false`, and `NEXT_PUBLIC_RECAPTCHA_ENABLED=false`. Run against an **isolated** Supabase project — the suite mutates data. Some steps are intentionally `test.skip()` until you have a second/third user fixture in place.

---

## What's deliberately not built

- **Supabase Realtime for notifications.** We're not on Supabase Auth, so the realtime channel would need a parallel auth path. The bell polls every 30s instead — swap to SSE later if sub-second latency matters.
- **Signed URLs for Bunny attachments.** Phase 10 ships public CDN URLs. Move to token-auth on the pull zone if you put sensitive content there.
- **Dark mode + keyboard shortcuts.** Both are explicit "optional" in the Phase 11 spec and not yet implemented.
- **RLS audit script.** N/A — authorization is in app code, not Postgres RLS.
- **Service-role key audit.** N/A — the service-role key never enters app code paths.

---

## Folder layout (end state)

```
app/
  (auth)/{login,signup}/...
  admin/users/...
  api/
    auth/{login,logout,signup,refresh}/route.ts
    admin/users/[id]/{date-status,}/route.ts
    tasks/{,[id]/,[id]/{status,transfer,assignments,attachments}}/...
    notifications/{,[id]/read,mark-all-read}/route.ts
    users/route.ts
  dashboard/
    {,today,calendar,notifications}/page.tsx
    tasks/{,new,[id]}/page.tsx + supporting client components
components/
  ui/                shadcn primitives (button, dialog, sheet, popover, etc.)
  users/             AssigneePicker, UserAvatar, AvatarStack
  notifications-bell.tsx
  dashboard-sidebar.tsx
  site-header.tsx
lib/
  auth.ts            cookie + revocation helpers
  jwt.ts             jose-based sign/verify
  redis.ts           Upstash client + session/refresh/OTP/rate buckets
  ratelimit.ts       fixed-window limiter
  with-route.ts      optional error-envelope wrapper
  api-response.ts    { ok } / { error: { code, message, details? } }
  env.ts             zod-validated env
  db.ts              postgres.js client (schema=task)
  date.ts            tz-safe YYYY-MM-DD helpers
  password.ts        bcrypt wrappers
  bunny.ts           Bunny Storage + MIME allowlist
  captcha.ts         reCAPTCHA Enterprise verify
  dao/               every Postgres touchpoint (users, tasks, assignments,
                     user-date-status, attachments, notifications, activity)
  schemas/           zod schemas shared client+server
middleware.ts        JWT edge check on /dashboard and /admin
supabase/migrations/ 0001…0006, idempotent
scripts/make-admin.ts
tests/e2e/smoke.spec.ts
playwright.config.ts
```
