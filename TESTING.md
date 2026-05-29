# Task Portal — Manual Testing Guide (Multi-User)

A complete, step-by-step plan for testing every feature of Task Portal end to end, with a small realistic team and sample data you create through the UI. No database scripts — everything here is done as a real user would do it.

Work top to bottom the first time: each flow builds on data created in the previous one.

---

## 1. What you're testing

Task Portal is a date-driven, multi-user task manager. The areas covered below:

- Authentication (login, logout, session, invite-only signup)
- Admin user management (create, edit, deactivate, per-date activation)
- Task CRUD (create, read, update, delete)
- Multi-user assignment and per-user visibility
- Status workflow with an activity timeline
- Task transfer with an audit trail
- Attachments (file uploads + URL links)
- Notifications (bell, list, live updates)
- Date-based views (Today, Calendar, date filters)
- Roles and permissions (admin vs user)

---

## 2. Before you start (prerequisites)

Confirm all of these once before testing:

1. **Dev server is running** for *this* project (the `task-management` folder). In the terminal you should see `Local: http://localhost:PORT`. Use that exact port below — it may be `3000`, or `3001` if another app already holds `3000`.
2. **Database migrations applied** in Supabase (SQL editor): `0001` → `0002` → `0003` → `0004` → `0006`. Without these the `task.*` tables don't exist and every page will error.
3. **Redis REST is configured** in `.env.local` (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`). Login creates a session in Redis, so sign-in fails without it.
4. **At least one admin exists.** Create one from the terminal:
   ```
   DOTENV_CONFIG_PATH=.env.local npm run make-admin -- admin@example.com 'Admin@123' "Aarav Sharma"
   ```
5. **Two or more browser sessions ready** (see next section).

> If you change anything in `.env.local`, restart the dev server so the new values load.

---

## 3. Multi-user testing setup (important)

Sessions are cookie-based, so one browser window = one logged-in user. To act as several users at once, use **separate, isolated sessions**:

- **Window A** — your normal browser window → the **Admin**.
- **Window B** — an **Incognito/Private** window → a regular user (e.g. Priya).
- **Window C** — a second Incognito window *or a different browser* (Chrome vs Firefox) → another user (e.g. Rahul).

Keep these open side by side. This lets you, for example, change a task as Rahul in Window C and watch the notification appear for Priya in Window B in real time.

---

## 4. The sample team and seed data

You'll create these accounts and tasks through the UI in the flows below. Passwords meet the rule "8+ characters incl. a number."

### Users

| Role  | Full name      | Email                | Password    | Purpose in tests                |
|-------|----------------|----------------------|-------------|---------------------------------|
| Admin | Aarav Sharma   | admin@example.com    | `Admin@123` | Manages users, sees everything  |
| User  | Priya Nair     | priya@example.com    | `Priya@123` | Designer — assignee & transfers |
| User  | Rahul Verma    | rahul@example.com    | `Rahul@123` | Developer — heavy task load     |
| User  | Sneha Iyer     | sneha@example.com    | `Sneha@123` | Content — multi-assignment      |
| User  | Karan Mehta    | karan@example.com    | `Karan@123` | QA — used for deactivation tests |

### Tasks

Dates are relative to the day you test. "Today/Tomorrow/+N" means pick that calendar date in the date picker.

| # | Title                                | Assignee(s)     | Priority | Start | Due        | Why it's here                         |
|---|--------------------------------------|-----------------|----------|-------|------------|---------------------------------------|
| 1 | Design new landing page hero         | Priya           | High     | Today | +2 days    | Standard task, single assignee        |
| 2 | Implement auth rate limiting         | Rahul           | High     | Today | **Today**  | Due-today view                        |
| 3 | Write Q2 blog content calendar       | Sneha           | Medium   | —     | +7 days    | "This week" / calendar                |
| 4 | QA the checkout flow                 | Karan           | High     | Today | **+1 day** | Tomorrow + later deactivation test    |
| 5 | Record onboarding webinar            | Sneha **and** Priya | Medium | Today | +5 days  | Multi-user assignment                 |
| 6 | Fix mobile nav overflow              | Rahul           | Low      | —     | —          | No-date bucket                        |
| 7 | Migrate legacy user data             | Rahul           | High     | —     | **Yesterday** | Overdue badge                      |

---

## 5. Step-by-step test flows

Each step lists the **action** and the **expected result** (✅). Tick the checklist in Section 6 as you go.

### Flow 0 — Admin first login

1. In **Window A**, open `http://localhost:PORT`. ✅ Landing page loads with the new look (Inter font, light-blue theme, hero + feature cards).
2. Click **Sign in** → enter `admin@example.com` / `Admin@123` → submit. ✅ Redirected to `/dashboard`; header shows the admin email + "admin"; sidebar shows **Admin** at the bottom.
3. Try a wrong password once. ✅ Inline error ("Something went wrong / invalid credentials"); you stay on the login page.

### Flow 1 — Admin creates the team

1. In **Window A**, go to **Admin** (sidebar) → you're on `/admin/users`. ✅ The users table lists at least Aarav.
2. Click **Add user**. Fill **Full name** = `Priya Nair`, **Email** = `priya@example.com`, **Temp password** = `Priya@123`, **Role** = `User`. Click **Create user**. ✅ Toast "User created"; Priya appears in the table.
3. Repeat for **Rahul Verma**, **Sneha Iyer**, and **Karan Mehta** using the table in Section 4.
4. Validation check: try adding a user with password `abc` (too short). ✅ Inline error "Password must be at least 8 characters". Try a duplicate email (`priya@example.com`). ✅ Error "An account with this email already exists."

> **Note on signup:** the workspace is invite-only by default (`ALLOW_PUBLIC_SIGNUP=false`), so users can't self-register — the admin creates them here. To test the public signup screen instead, set `ALLOW_PUBLIC_SIGNUP=true` in `.env.local`, restart, and use **Get started** on the landing page (see Flow 12).

### Flow 2 — Users log in

1. In **Window B** (Incognito), open the app → **Sign in** as `priya@example.com` / `Priya@123`. ✅ Lands on Priya's dashboard; sidebar has **no** Admin link (she's a regular user).
2. In **Window C** (second Incognito/other browser), sign in as `rahul@example.com` / `Rahul@123`. ✅ Rahul's dashboard.
3. Leave both signed in for later flows.

### Flow 3 — Create the seed tasks

You can create tasks as the Admin (Window A) or as each user. To keep it simple, create them all as **Admin**.

1. In **Window A**, sidebar → **All tasks** → **New task** (or use **New task** on the dashboard).
2. Create **Task 1**: Title `Design new landing page hero`, a short description, **Priority** = High, **Start date** = today, **Due date** = today + 2 days. Under **Assignees**, pick **Priya**. Click **Create task**. ✅ Redirected to the task detail page; status shows **Pending**; Priya listed under assignees.
3. Create **Tasks 2–7** the same way using the Section 4 table. For **Task 5**, pick **both Sneha and Priya** as assignees. For **Task 6** and **Task 7**, leave start/due empty except Task 7's due = **yesterday**.
4. ✅ Note: new tasks always start as **Pending** — there's no status field on the create form by design. (Status is changed later via the status menu so every change is audited.)

### Flow 4 — Multi-user visibility & assignment

1. **Window A (Admin)** → **All tasks**. ✅ All 7 tasks are visible (admins see everything).
2. **Window B (Priya)** → **All tasks**. ✅ Priya sees only tasks she created or is assigned to — **Task 1** and **Task 5**. She does **not** see Rahul's tasks (2, 6, 7).
3. **Window C (Rahul)** → **All tasks**. ✅ Rahul sees **Tasks 2, 6, 7** (and 5 only if assigned — he isn't, so not 5).
4. As Priya, use the **scope** filter (Created / Assigned / All) on the tasks page. ✅ Filtering by "Assigned to me" shows Task 1 and Task 5.

### Flow 5 — Status workflow + activity timeline + live notification

1. **Window C (Rahul)** → open **Task 2 (Implement auth rate limiting)** → use the **status menu** on the detail page: set **In progress**, optionally add a note. ✅ Status badge updates to "In progress"; an entry appears in the **activity timeline** ("Rahul changed status … ").
2. Move it again to **Done**. ✅ Timeline shows both transitions in order with timestamps.
3. Watch the **bell** in another window: since Rahul owns/created interactions on his own task, notifications are generated for relevant recipients (e.g., task owner/assignees other than the actor). ✅ The notifications bell shows an unread dot where applicable.
4. Edit a task's details: open **Task 1** as Admin → **Edit** → change priority to Medium, save. ✅ Toast "Task updated"; detail reflects the change.

### Flow 6 — Task transfer (reassign) with audit trail

1. **Window A (Admin)** → open **Task 4 (QA the checkout flow)** → **Transfer**. Move from **Karan** to **Priya**, reason = `Karan is on leave`. Confirm. ✅ Assignee changes to Priya; a **transfer timeline** entry records from → to, the reason, who did it, and when.
2. **Window B (Priya)** → **All tasks** / **bell**. ✅ Task 4 now appears for Priya, and she receives a **task transferred / assigned** notification.
3. ✅ Karan no longer sees Task 4 in his list (verify by signing in as Karan in a spare Incognito window if desired).

### Flow 7 — Attachments (file + URL)

1. **Window B (Priya)** → open **Task 1** → **Attachments** section → **upload a file** (e.g. a small PNG or PDF, under 50 MB). ✅ The file uploads and shows with a working link served from the Bunny CDN (`cdn.growupmore.com`). Files are public links (token authentication is off).
2. Add a **URL link** attachment: paste `https://www.figma.com` with label `Design file`. ✅ The link appears with its label and opens in a new tab.
3. Try an invalid URL (`not-a-url`) and an oversized/blocked file type. ✅ Each is rejected with a clear message.
4. Remove an attachment. ✅ It disappears from the list.

### Flow 8 — Notifications (bell, list, live SSE)

1. Keep **Window B (Priya)** on any dashboard page. In **Window A (Admin)**, assign Priya to **Task 3** (open Task 3 → Assignees → add Priya). ✅ Within a moment, Priya's **bell count increments live** (no manual refresh — it streams).
2. **Window B** → click the **bell** → open **Notifications**. ✅ Items are grouped by day; unread ones are highlighted with a dot.
3. Click a notification. ✅ It navigates to the related task and marks that item read.
4. Click **Mark all read**. ✅ Unread count drops to 0; the **All / Unread** tabs filter correctly.

### Flow 9 — Date-based views

1. **Today view** (sidebar → **Today**): as Rahul, ✅ **Task 2** (due today) appears; tasks are grouped by status; **Task 6** (no date) shows under a "No date" section.
2. **Overdue**: as Rahul, ✅ **Task 7** (due yesterday) shows an **overdue** badge (red).
3. **Calendar** (sidebar → **Calendar**): ✅ tasks land on their due dates; clicking a day opens that day's tasks.
4. **Filters / chips** on **All tasks**: test **Today**, **Tomorrow**, **This week**, **Overdue**, and **No date**. ✅ Each chip narrows the list correctly (e.g. "Tomorrow" → Task 4; "No date" → Task 6; "Overdue" → Task 7).
5. **Search**: type part of a title (e.g. `webinar`). ✅ Results filter to Task 5.

### Flow 10 — Admin: per-date activation, edit, deactivate

1. **Per-date activation** — **Window A** → **Admin** → row for **Karan** → open the **date activation** dialog. Add an override: **Date** = tomorrow, **Status** = `Inactive`, **Note** = `Annual leave`. Save. ✅ The override is listed; default is "active" for all other dates.
2. Now try to assign Karan to a task **due tomorrow** (create a quick task or edit Task 4's due date to tomorrow and open the assignee picker). ✅ Karan is blocked/flagged as unavailable for that date ("inactive dates block new assignments on that day").
3. **Edit user** — change Sneha's full name or role via the edit dialog. ✅ The change saves and shows in the table.
4. **Deactivate account (force logout)** — set **Karan**'s account to **inactive** (edit user → is_active off). ✅ Karan's existing session is revoked: in Karan's window, his next action bounces him to login, and he can no longer sign in until reactivated. Reactivate him afterward.

### Flow 11 — Permissions & authorization

1. As **Priya** (Window B), manually visit `/admin/users` in the address bar. ✅ You're blocked/redirected — regular users can't reach admin pages.
2. As **Priya**, try to open a task you're not on by guessing a URL like `/dashboard/tasks/<some-other-id>` (copy an id Rahul-only task from Window C). ✅ Access is denied / not found — you only see tasks you created or are assigned to.
3. ✅ A deactivated user (Karan, from Flow 10) cannot log in.

### Flow 12 — Auth edge cases & session

1. **Logout** (Window B, header → logout). ✅ Returns to landing/login; protected pages now redirect to login.
2. **Session persistence**: log back in, then refresh the dashboard. ✅ You stay signed in (session held in Redis).
3. **Validation**: on login, submit an empty form. ✅ Field errors appear. On signup (if enabled), test mismatched passwords and a password without a number. ✅ Each shows the right message.
4. **(Optional) public signup**: set `ALLOW_PUBLIC_SIGNUP=true`, restart, click **Get started**, register `test.signup@example.com` / `Test@1234`. ✅ Account is created and you're signed in. Set the flag back to `false` when done.

### Flow 13 — UI polish spot-checks

1. **Dark mode**: toggle the theme switch in the header. ✅ The whole app switches to the dark sky theme cleanly; text stays readable.
2. **Empty states**: as a brand-new user with no tasks, the dashboard and Today view show friendly empty messages.
3. **Responsive**: narrow the window. ✅ Sidebar collapses to icons; layout stays usable.

---

## 6. Test results checklist

Tick each as you verify it. Add a note for anything that fails.

- [ ] Admin can log in; wrong password rejected
- [ ] Admin can create users; validation + duplicate-email handled
- [ ] Users can log in; regular users have no Admin link
- [ ] Tasks can be created with all fields; new tasks start Pending
- [ ] Admin sees all tasks; each user sees only created/assigned
- [ ] Scope filter (Created/Assigned/All) works
- [ ] Status changes work and are recorded in the activity timeline
- [ ] Task edit (priority/dates/description) saves
- [ ] Transfer reassigns the task and logs the audit trail + reason
- [ ] File upload works (public CDN link); URL attachment works; invalid input rejected; removal works
- [ ] Notifications fire on assign / transfer / status change
- [ ] Bell updates live (SSE) without refresh; mark-as-read + mark-all-read work
- [ ] Today view groups tasks; no-date bucket shown
- [ ] Overdue badge appears for past-due open tasks
- [ ] Calendar places tasks on due dates; day view opens
- [ ] Date chips (Today/Tomorrow/Week/Overdue/No date) filter correctly
- [ ] Search filters by title
- [ ] Per-date activation blocks assignment on inactive dates
- [ ] Edit user works; deactivating an account force-logs-out and blocks login
- [ ] Regular user cannot reach /admin or other users' tasks
- [ ] Logout works; session persists across refresh
- [ ] Dark mode, empty states, and responsive layout look correct

---

## 7. Resetting between runs

- **Re-test a user from scratch:** deactivate or delete the test tasks and notifications via the UI, or create a fresh user.
- **Clear a stuck session:** log out, or have the admin toggle the user inactive then active (this revokes sessions).
- **Full data reset:** because everything here is seed data, the cleanest reset is to re-run the migrations on a fresh Supabase project (or truncate the `task.*` tables in the SQL editor) and recreate the admin with `make-admin`.

---

## 8. Appendix A — Automated smoke test

A Playwright scaffold ships with the project:

```
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive runner
```

It currently covers a basic smoke path (`tests/e2e/smoke.spec.ts`). Treat it as a foundation — the manual flows above are the source of truth for full coverage until the suite is expanded.

---

## 9. Appendix B — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Invalid environment variables" on `make-admin` | Script reads `.env`, not `.env.local` | Prefix with `DOTENV_CONFIG_PATH=.env.local`, or `cp .env.local .env` |
| `relation "task.users" does not exist` | Migrations not applied | Run `0001`–`0004` then `0006` in Supabase SQL editor |
| Login fails / hangs | Redis REST not set | Fill `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, restart |
| "esbuild" Not Opened (macOS) | Gatekeeper quarantine | `xattr -r -d com.apple.quarantine node_modules`, then retry (don't click "Move to Bin") |
| App opens a different site on :3000 | Another dev server holds the port | Use the port printed in this project's terminal (often :3001) |
| Attachment link 404s | Bunny zone/CDN mismatch | Verify the four `BUNNY_*` vars; links are public (token auth is off) |

---

*Tip: run the flows in two or three side-by-side browser windows so you can see assignments, transfers, and live notifications cross between users in real time — that's the fastest way to validate the multi-user behavior.*
