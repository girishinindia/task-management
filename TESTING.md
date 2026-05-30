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
- Task dates with an optional **time of day** (start/due)
- Date-based views (Today, Calendar with per-day task hints, date filters)
- Task views: list table **and** Kanban board (toggle on All tasks) **with drag-and-drop**
- Sort options + locally-saved views; Active / Archived / All filter
- Bulk actions (multi-select → status / priority / archive)
- Comments (with an optional image/PDF/Word attachment) and subtask checklists on a task
- Due-today / overdue reminders in notifications (warning colors)
- Recurring tasks (daily / weekly / monthly, regenerated on completion)
- Projects with per-project teams and admins; edit/rename a project; Project / Assignee / Important filters
- Analytics & reports (status / priority / per-project)
- Admin-mediated password reset (Forgot password → admin sets a temp password)
- Roles and permissions (super admin / admin / user)
- Audit log (admin-wide report + per-user "My activity")

### Permission model (three tiers)

**Super admin** (`users.is_super_admin = true`) > **Admin** (`role = 'admin'`) > **User** (`role = 'user'`). Rules are enforced in the API (direct calls 403), not just hidden in the UI.

| Capability | Super admin | Admin | User |
|---|:---:|:---:|:---:|
| Create project | ✅ | ❌ (can *request*) | ❌ |
| Create task (in a project) | ✅ any | ✅ their projects | ❌ |
| Edit task / dates / priority | ✅ | ✅ their projects | ❌ (read-only) |
| Assign / transfer (to project members) | ✅ | ✅ their projects | ❌ |
| Status → In progress / Done | ✅ | ✅ | ✅ *(only tasks assigned to them)* |
| Status → Blocked / Cancelled / reopen | ✅ | ✅ | ❌ |
| Add attachments / submit status report | ✅ | ✅ | ✅ |
| Deactivate (archive) a task | ✅ | ✅ their projects | ❌ |
| Hard-delete a task (permanent) | ✅ | ❌ | ❌ |
| Deactivate a user / set a temp password (Admin → Users) | ✅ | ✅ | ❌ |
| Comment / edit checklist on a visible task | ✅ | ✅ | ✅ |
| Bulk status (In progress/Done) | ✅ | ✅ | ✅ (their tasks) |
| Bulk priority / archive | ✅ | ✅ their projects | ❌ |
| See tasks | all | all in their projects | **only tasks assigned to (or created by) them** |
| Change a task's status | ✅ | ✅ (their projects) | ✅ **only if they're an assignee** (In progress / Done) |

> Note: task visibility is **assignment-aware**. **Super admins** see every task; a **project admin** (or a workspace admin who is a member) sees **all** tasks in that project; a **plain member** sees **only the tasks they're assigned to or created** — not every task in the project. Status changes follow the same idea: only an **assignee** (or a project admin / super admin) can change a task's status; a member can't touch a task that isn't theirs. All of this is enforced in the API, not just hidden in the UI.
>
> **"Admin" of a project ≠ workspace role.** Management of a project's tasks (create / edit / assign / transfer / status-beyond-member / archive) is granted to anyone who is a **project admin** — i.e. `project_members.role = 'admin'` for that project — *regardless of their workspace `users.role`*. So a person whose workspace role is **User** but who was added to a project as its **Admin** can fully manage that project's tasks (and sees the **New task** button). Workspace **admins** additionally manage any project they belong to; **super admins** manage everything. A plain project **member** stays read-only + status reports.

---

## 2. Before you start (prerequisites)

Confirm all of these once before testing:

1. **Dev server is running** for *this* project (the `task-management` folder). In the terminal you should see `Local: http://localhost:PORT`. Use that exact port below — it may be `3000`, or `3001` if another app already holds `3000`.
2. **Database migrations applied** in Supabase (SQL editor): `0001` → `0002` → `0003` → `0004` → `0006` → `0007` → `0008` → `0009` → `0010` → `0011`. Without these the `task.*` tables don't exist and every page will error. (`0007` = audit log; `0008` = Projects + default **"General"** project; `0009` = `users.is_super_admin` (promotes the earliest admin to **super admin** — adjust with `update task.users set is_super_admin=true where email='you@example.com';`) + `tasks.is_active` archive flag; `0010` = task **comments**, **subtasks** (checklist), `tasks.recur_rule` (recurring), and the **password-reset requests** queue; `0011` = `tasks.start_time`/`due_time` (time-of-day) and `task_comments.attachment_*` (image/PDF/Word file on a comment). Without `0008`–`0011` the tasks pages error on the missing columns.)
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

Create all of these as **Admin** (Window A). Each task now belongs to a **Project** — pick **General** (the default project everyone joined in migration `0008`) for these seed tasks. Only a project's admins (or a workspace admin) can create tasks in it; a regular member who opens **New task** sees a "no project to add tasks to" message. Per-project teams and admins are exercised in Flow 15.

1. In **Window A**, sidebar → **All tasks** → **New task** (or use **New task** on the dashboard).
2. Create **Task 1**: Title `Design new landing page hero`, a short description, **Priority** = High, **Start date** = today, **Due date** = today + 2 days. Under **Assignees**, pick **Priya**. Click **Create task**. ✅ Redirected to the task detail page; status shows **Pending**; Priya listed under assignees.
3. Create **Tasks 2–7** the same way using the Section 4 table. For **Task 5**, pick **both Sneha and Priya** as assignees. For **Task 6** and **Task 7**, leave start/due empty except Task 7's due = **yesterday**.
   - **Times (optional).** Each date field has a matching **time** box. On **Task 2**, set a **due time** (e.g. 17:00). ✅ The detail page shows "Due … · 5:00 PM" and the list/board show the time under the date. A time can't be set without its date (✅ inline error). Editing the task preloads the saved time. (Overdue/reminders are still evaluated by day.)
   - **Checklist while creating (optional).** In the **Checklist (optional)** box on the create form, type an item and press **Enter** (or **Add**) — add a few (e.g. "Draft copy", "Review", "Publish"), remove one with **×**. ✅ On **Create task**, you land on the detail page with those items already in the **Checklist** section (in order, all unticked). Creating with no items behaves exactly as before.
4. ✅ Note: new tasks always start as **Pending** — there's no status field on the create form by design. (Status is changed later via the status menu so every change is audited.)

### Flow 4 — Multi-user visibility & assignment

1. **Window A (Admin)** → **All tasks**. ✅ All 7 tasks are visible (admins see everything).
2. **Window B (Priya)** → **All tasks**. ✅ Priya sees only tasks assigned to her — **Task 1** and **Task 5**. She does **not** see Rahul's tasks (2, 6, 7). (Regular users can't create tasks, so they only ever see their own assignments.)
3. **Window C (Rahul)** → **All tasks**. ✅ Rahul sees **Tasks 2, 6, 7** (and 5 only if assigned — he isn't, so not 5).
4. As Priya, use the **scope** filter (Created / Assigned / All) on the tasks page. ✅ Filtering by "Assigned to me" shows Task 1 and Task 5.

### Flow 5 — Status workflow + activity timeline + live notification

1. **Window C (Rahul)** → open **Task 2 (Implement auth rate limiting)** → use the **status menu** on the detail page: set **In progress**, optionally add a note. ✅ Status badge updates to "In progress"; an entry appears in the **activity timeline** ("Rahul changed status … ").
2. Move it again to **Done**. ✅ Timeline shows both transitions in order with timestamps.
3. Watch the **bell** in another window: since Rahul owns/created interactions on his own task, notifications are generated for relevant recipients (e.g., task owner/assignees other than the actor). ✅ The notifications bell shows an unread dot where applicable.
4. **Edit task fields, including priority (admin only).** Open **Task 1** as Admin → the detail page shows an **Edit** form (regular users get a read-only view instead). Change **Priority** to Medium and save. ✅ Toast "Task updated"; the priority badge updates. Note the deliberate asymmetry: **status** has a quick inline dropdown for assignees, but **priority / title / dates / description** are changed only here in the Edit form — and only admins can. There is no separate "change priority" control for regular users by design.

### Flow 6 — Task transfer (reassign) with audit trail

1. **Window A (Admin)** → open **Task 4 (QA the checkout flow)** → **Transfer**. Move from **Karan** to **Priya**, reason = `Karan is on leave`. Confirm. ✅ Assignee changes to Priya; a **transfer timeline** entry records from → to, the reason, who did it, and when.
2. **Window B (Priya)** → **All tasks** / **bell**. ✅ Task 4 now appears for Priya, and she receives a **task transferred / assigned** notification.
3. ✅ Karan no longer sees Task 4 in his list (verify by signing in as Karan in a spare Incognito window if desired).
4. **Regular users can't transfer.** In **Window B (Priya)**, open a task she's assigned to. ✅ There is **no Transfer button** — transferring is admin-only.
5. **Can't transfer to yourself.** As the admin doing the transfer, open the **Transfer to** dropdown. ✅ Your own name is **not listed** (you can't hand a task back to yourself). A direct API call with `to_user_id` = your own id returns **400** ("You can't transfer a task to yourself").

### Flow 7 — Attachments (file + URL)

1. **Window B (Priya)** → open **Task 1** → **Attachments** section → **upload a file** (e.g. a small PNG or PDF, under 50 MB). ✅ The file uploads and shows with a working link served from the Bunny CDN (`cdn.growupmore.com`). Files are public links (token authentication is off).
2. Add a **URL link** attachment: paste `https://www.figma.com` with label `Design file`. ✅ The link appears with its label and opens in a new tab.
3. **Allowed types incl. ZIP.** Upload a **.zip** file. ✅ It's accepted — acceptance is by MIME *or* file extension, so ZIPs work even when the browser reports an odd type like `application/x-zip-compressed` or `application/octet-stream`. Images, video, PDF, Office docs, and plain text work the same way.
4. Try a genuinely disallowed type (e.g. a `.exe`), an oversized file (>50 MB), and an invalid URL (`not-a-url`). ✅ Each is rejected with a clear message.
5. Remove an attachment **you uploaded**. ✅ It disappears. (A regular user only sees the delete icon on attachments they added; admins can remove any.)

### Flow 8 — Notifications (bell, list, live SSE)

1. Keep **Window B (Priya)** on any dashboard page. In **Window A (Admin)**, assign Priya to **Task 3** (open Task 3 → Assignees → add Priya). ✅ Within a moment, Priya's **bell count increments live** (no manual refresh — it streams).
2. **Window B** → click the **bell** → open **Notifications**. ✅ Items are grouped by day; unread ones are highlighted with a dot.
3. Click a notification. ✅ It navigates to the related task and marks that item read.
4. Click **Mark all read**. ✅ Unread count drops to 0; the **All / Unread** tabs filter correctly.
5. **Search + smart filters.** On the Notifications page: type in the **search box** (matches title/body) ✅ the list narrows live. Click a **category chip** (Tasks / Reminders / Comments / Files / Admin) ✅ only that group shows, and each chip shows its **count**. Use the **type** dropdown for a precise type (e.g. "Overdue"); ✅ it overrides the category. Filters + search **combine with the All/Unread tab** and survive switching tabs; **Clear** resets them.

### Flow 9 — Date-based views

1. **Today view** (sidebar → **Today**): as Rahul, ✅ **Task 2** (due today) appears; tasks are grouped by status; **Task 6** (no date) shows under a "No date" section.
2. **Overdue**: as Rahul, ✅ **Task 7** (due yesterday) shows an **overdue** badge (red).
3. **Calendar** (sidebar → **Calendar**): ✅ tasks land on their due dates. Days that have tasks show a blue **"N tasks"** label, and hovering any day shows a tooltip (e.g. "2 tasks on this day — click to view"). Clicking a day opens that day's tasks.
4. **Filters / chips** on **All tasks**: test **Today**, **Tomorrow**, **This week**, **Overdue**, and **No date**. ✅ Each chip narrows the list correctly (e.g. "Tomorrow" → Task 4; "No date" → Task 6; "Overdue" → Task 7).
5. **Search**: type part of a title (e.g. `webinar`). ✅ Results filter to Task 5.
6. **List / Board views.** On **All tasks**, use the **List | Board** toggle (top-right). ✅ **Board** shows a Kanban layout with columns per status — Pending, In progress, Blocked, Done, Cancelled — and each card shows priority, due date, and assignees. Move a card forward using its status dropdown (same transition rules + permissions as elsewhere). Apply a filter, then switch List ↔ Board: ✅ the filter is preserved across the toggle.

### Flow 10 — Admin: per-date activation, edit, deactivate

1. **Per-date activation** — **Window A** → **Admin** → row for **Karan** → open the **date activation** dialog. Add an override: **Date** = tomorrow, **Status** = `Inactive`, **Note** = `Annual leave`. Save. ✅ The override is listed; default is "active" for all other dates.
2. Now try to assign Karan to a task **due tomorrow** (create a quick task or edit Task 4's due date to tomorrow and open the assignee picker). ✅ Karan is blocked/flagged as unavailable for that date ("inactive dates block new assignments on that day").
3. **Edit user** — change Sneha's full name or role via the edit dialog. ✅ The change saves and shows in the table.
4. **Deactivate account (force logout)** — set **Karan**'s account to **inactive** (edit user → is_active off). ✅ Karan's existing session is revoked: in Karan's window, his next action bounces him to login, and he can no longer sign in until reactivated. Reactivate him afterward.

### Flow 11 — Permissions & authorization

Run these as **Priya** (Window B), a regular user — this is the core test of the admin-only rule.

1. **No create.** ✅ There's no **New task** button on the dashboard, Today, or All tasks pages. Manually visit `/dashboard/tasks/new` in the address bar → ✅ you're redirected to `/dashboard`.
2. **Read-only task.** Open **Task 1** (assigned to Priya). ✅ It renders as a **read-only view**: no Edit form, no **Delete**, no **Transfer**, and the Assignees section has **no Manage button**. ✅ The **status menu** and **Attachments** (Upload / Add URL) *are* available.
3. **Submit a status report.** Change Task 1's status (e.g. → In progress) and add a note. ✅ It saves and shows in the activity timeline — this is the one change a regular user can make to a task.
4. **Admin pages blocked.** Visit `/admin/users` in the address bar. ✅ You're redirected — regular users can't reach admin pages.
5. **Can't see others' tasks.** Try opening a task you're not assigned to (copy a Rahul-only task id from Window C into `/dashboard/tasks/<id>`). ✅ Not found — you only see your own assignments.
6. **The API is the real boundary (optional, thorough).** In Priya's browser DevTools console, call a mutation directly:
   ```js
   fetch("/api/tasks", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then(r => r.status)
   ```
   ✅ Returns **403**. The same holds for `PATCH`/`DELETE /api/tasks/[id]`, `/transfer`, and `/assignments` — the buttons are hidden *and* the server rejects non-admins, so it can't be bypassed.
7. ✅ A deactivated user (Karan, from Flow 10) cannot log in.

### Flow 12 — Auth edge cases & session

1. **Logout** (Window B, header → logout). ✅ Returns to landing/login; protected pages now redirect to login.
2. **Session persistence**: log back in, then refresh the dashboard. ✅ You stay signed in (session held in Redis).
3. **Validation**: on login, submit an empty form. ✅ Field errors appear. On signup (if enabled), test mismatched passwords and a password without a number. ✅ Each shows the right message.
4. **(Optional) public signup**: set `ALLOW_PUBLIC_SIGNUP=true`, restart, click **Get started**, register `test.signup@example.com` / `Test@1234`. ✅ Account is created and you're signed in. Set the flag back to `false` when done.

### Flow 13 — UI polish spot-checks

1. **Dark mode**: toggle the theme switch in the header, then walk through **Calendar**, **Notifications**, **All tasks**, a **task detail**, and (after signing out) the **landing page**. ✅ Everything stays readable in dark mode — in particular the Calendar's **Today** button and month-nav arrows, the **unread** notification rows, and the attachment **drop-zone** must show their text/icons (no white-on-white boxes). Toggle back to light and confirm both themes look right.
2. **Empty states**: as a brand-new user with no tasks, the dashboard and Today view show friendly empty messages.
3. **Responsive**: narrow the window. ✅ Sidebar collapses to icons; layout stays usable.

### Flow 14 — Audit log

Every auth event and task/admin operation is recorded in an append-only log (requires migration `0007`).

1. **Admin report.** In **Window A (Admin)**, sidebar → **Audit log** (`/admin/audit`). ✅ A chronological table: each row shows a timestamp, an action badge (e.g. `auth.login`, `task.created`, `task.status_changed`, `attachment.added`), the actor's email, a details summary, and the IP. Earlier flows should already have populated it.
2. **Coverage.** Confirm entries exist for what you did earlier: logins (Flow 0/2), task creation (Flow 3), status changes (Flow 5), the transfer (Flow 6), attachment add/remove (Flow 7), and admin user creation + deactivation (Flow 1/10). ✅ Each shows the correct actor and summary.
3. **Failed logins are captured.** Sign out, attempt a login with a wrong password, then sign back in. In the audit log, set **Action → Login failed**. ✅ An `auth.login_failed` row appears with the attempted email and IP, and a blank actor (they never authenticated).
4. **Filters + pagination.** Use the **Action** dropdown (e.g. `Status changed`) and the **Search** box (an email or part of a summary). ✅ The list narrows; **Older / Newer** paginate.
5. **Per-user activity.** In **Window B (Priya)**, sidebar → **My activity** (`/dashboard/activity`). ✅ Priya sees only *her own* actions (logins, status reports, attachments) — never anyone else's, and there's no actor column.
6. **Logging never blocks work.** ✅ All operations above still succeeded normally — audit writes are best-effort and never break the request.

### Flow 15 — Projects, teams & filters

Projects group tasks and have their own team + admins (requires migration `0008`).

1. **Create a project.** As **Admin** (Window A), sidebar → **Projects** → **New project**. Name it `Website Revamp`, save. ✅ It appears as a card showing you as **admin**, 1 member, 0 tasks.
2. **Build the team.** Open the project → **Team**. Add **Priya** as **Admin** (a project admin) and **Rahul** as **Member**. ✅ Both appear; you can change a role or remove a member here.
   - **Admin tier is protected.** Only the **project creator** or a **super admin** can grant/revoke **Admin** or remove an existing admin; a plain project **admin** can add/remove/manage **members only**. ✅ Signed in as a non-creator project **admin** (e.g. Bhumika), other **admin** rows show their role as a read-only badge with **no trash icon**, and the "add" role selector offers **Member** only. Members still have a role dropdown + remove. The **creator** row can only be changed/removed by a **super admin**. A direct API call to demote/remove an admin as a non-creator admin returns **403**.
3. **Project admin creates tasks.** In **Window B (Priya)** — a regular workspace user but an *admin of Website Revamp* — a **New task** button now appears. Create a task and, in the **Project** selector, pick **Website Revamp**. ✅ The assignee picker lists only **Website Revamp** members (Priya, Rahul) — non-members never appear. ✅ The **same project-scoped list** is used by **Manage assignees** on the task detail page and by the **Transfer → "Transfer to"** dropdown. (The server also rejects assigning/transferring a non-member with a 400, so it can't be bypassed.)
4. **Assignment = visibility (for members).** When creating the task, assign **Rahul**. ✅ Rahul (Window C) now sees it under **All tasks**. If you leave him unassigned, he does **not** see it (a plain member sees only tasks assigned to / created by them). A **project admin** and **super admin** see every task in the project regardless. A non-member (e.g. Sneha) never sees it, and opening its URL directly is "not found".
5. **Project-scoped management + status.** As **Rahul** (member, assigned): the task is **read-only** except he can set status to **In progress / Done** (he's the assignee). A member who is **not** assigned can't see or touch the task — a direct status API call returns **403**. As **Priya** (project admin) she can edit/delete/transfer/assign and set any status within Website Revamp — but not in projects she doesn't administer.
6. **Filters.** On **All tasks**: the **Project** dropdown narrows to one project, the **assignee** dropdown to one person, and the **★ Important** chip shows only High-priority tasks. ✅ They combine and persist across the List/Board toggle.
7. **Audit.** ✅ `project.created` and `project.member_added` rows show up in the admin **Audit log**.

### Flow 16 — Role tiers, status limits & deactivate vs delete

Three tiers: **super admin** (earliest admin, promoted by `0009`), **admin** (`role='admin'`), **user** (`role='user'`). Check `users.is_super_admin` in Supabase to confirm who's super.

1. **Status limits for users.** As **Rahul** (a member) on a task assigned to him, open the status dropdown. ✅ Only **In progress** and **Done** are offered — never Blocked/Cancelled/reopen. A direct API call setting `cancelled` → **403** ("Members can only set a task to In progress or Done").
2. **Admins/super do the rest.** As **Priya** (admin) or a super admin, the dropdown offers every legal transition incl. **Blocked** / **Cancelled**.
3. **Create project = super only.** As Priya (admin, not super), the **Projects** page shows **Request a project** (not New project). Submit one → ✅ every super admin gets a colored `project_requested` notification. A super admin sees **New project**.
4. **Deactivate vs hard delete.** On a task detail: an **admin** sees **Deactivate** — the task gets an **Archived** badge and drops out of task lists/board, and **Reactivate** restores it. Only a **super admin** sees **Delete** (permanent). ✅ A non-super admin calling hard-delete directly gets **403**.
5. **Notifications coverage + color.** ✅ Assign, transfer, status change, **task edit**, and **attachment** all notify the other assignees (not the actor), each with a color-coded icon: sky (assigned), violet (transferred), green (status), amber (edited), cyan (attachment), fuchsia (project request), indigo (comment), amber (due today), red (overdue), orange (password reset).

### Flow 17 — Comments & subtask checklist

On any task detail page (open as anyone who can see the task):

1. **Comments.** Scroll to **Comments**, type a message, **Comment** (or ⌘/Ctrl+Enter). ✅ It appears immediately with your name + "just now". Anyone who can see the task can post.
2. **Comment notifications.** As **Rahul** comment on a task assigned to **Priya**. ✅ Priya gets an **indigo** `comment_added` notification linking to the task; the author is not notified.
3. **Comment with an attachment.** Click **Attach**, pick an **image, PDF, or Word** file (≤10 MB). ✅ A chip shows the filename; post the comment. The comment renders the image as a thumbnail (click to open) or shows a file link for PDF/Word. ✅ A wrong type (e.g. `.zip`, `.exe`) or an oversized file is rejected with a clear message. A comment can be **attachment-only** (no text).
4. **Delete a comment.** ✅ You can delete **your own** comment (trash icon); a **super admin** can delete any; others see no delete icon.
5. **Checklist (subtasks).** In the **Checklist** section add items ("Draft copy", "Get sign-off"). ✅ Each appears; ticking one strikes it through and the **progress bar / x-of-y / %** updates. Items persist on refresh. Anyone who can see the task can add/tick/delete items.

### Flow 18 — Recurring tasks + due/overdue reminders

1. **Make a task recurring.** As Admin, edit a task (or create one) → **Repeat** = **Weekly**, set a **Due date** = today. Save. ✅ The detail page shows a **"Repeats weekly"** badge.
2. **Regenerate on completion.** Move that task to **Done**. ✅ A brand-new **Pending** copy is created with the due date shifted **+7 days**, same title/priority/assignees; the audit log shows `task.recurrence_regenerated`. (Daily = +1 day, Monthly = +1 month with end-of-month clamping.)
3. **Due-today reminder.** Ensure a task assigned to you is **due today** and open the **bell** (or Notifications page). ✅ An **amber** "Due today: …" reminder appears. **Overdue** (due in the past, still open) ✅ shows a **red** "Overdue: …" reminder. Reminders are generated at most **once per task per day** — reloading doesn't duplicate them. (No cron: they're created when you open notifications.)

### Flow 19 — Bulk actions, drag-and-drop, sort, saved views, archived

1. **Multi-select (List).** On **All tasks** (List view) tick a few row checkboxes (or the header "select all"). ✅ A bulk bar shows "N selected" with **Set status…**, **Set priority…**, and **Archive**. Pick one → ✅ toast "Updated N tasks · M skipped" (tasks you can't manage are skipped); the list refreshes.
2. **Drag-and-drop (Board).** Switch to **Board**. Drag a card into another status column. ✅ It moves and the status persists (same transition + permission rules — a member dropping into Blocked/Cancelled is refused with a toast and the card snaps back).
3. **Sort.** Use the **sort** dropdown (Due ↑/↓, Newest/Oldest, Priority, Title A–Z). ✅ The order changes accordingly and persists in the URL.
4. **Saved views.** Set some filters, then under **Views** click **Save current**, name it. ✅ A chip appears; clicking it re-applies those filters later; the **×** removes it. (Saved per-browser.)
5. **Archived filter.** Archive a task (Flow 16), then set the **Active / Archived / All** filter to **Archived**. ✅ Archived tasks appear (with an **Archived** badge); **All** shows both; **Active** (default) hides them.

### Flow 20 — Password reset (admin-mediated)

1. **Request a reset.** Sign out. On the login page click **Forgot password?** → enter a user's email (e.g. `priya@example.com`) → **Request reset**. ✅ You get a neutral confirmation (it never reveals whether the email exists).
2. **Admin is notified.** As an Admin/super admin, open the **bell**. ✅ An **orange** `password_reset_requested` notification links to **Admin → Users**, where Priya's row shows a **"Reset requested"** badge.
3. **Set a temp password.** Open Priya's **Edit** dialog → **Set temporary password** → enter `NewPriya@123` → **Set**. ✅ Toast confirms; the request badge clears; Priya's sessions are revoked. ✅ Priya can now sign in with the new password (and the old one no longer works).
4. **Validation.** A password under 8 chars / without a number is rejected.

### Flow 21 — Analytics & reports

1. Sidebar → **Analytics**. ✅ Summary cards (Total, Open, Overdue, Completion rate), a **By status** and **By priority** bar breakdown, and a **By project** progress list — all scoped to the tasks you can see (super admin = all; others = their projects). With no visible tasks you get a friendly empty state.

---

## 6. Test results checklist

Tick each as you verify it. Add a note for anything that fails.

- [ ] Admin can log in; wrong password rejected
- [ ] Admin can create users; validation + duplicate-email handled
- [ ] Users can log in; regular users have no Admin link
- [ ] Tasks can be created with all fields; new tasks start Pending
- [ ] Super admin sees all tasks; a project/workspace admin sees all tasks in their projects; a **plain member sees only tasks assigned to (or created by) them** — not every project task
- [ ] Scope filter (Created/Assigned/All) works
- [ ] Status changes work and are recorded in the activity timeline
- [ ] Task edit (priority/dates/description) saves (admin)
- [ ] Transfer reassigns the task and logs the audit trail + reason (admin only)
- [ ] File upload works (public CDN link); URL attachment works; invalid input rejected; removal works
- [ ] Notifications fire on assign / transfer / status change
- [ ] Bell updates live (SSE) without refresh; mark-as-read + mark-all-read work
- [ ] Notifications page: search (title/body), category chips with counts, and precise type filter all work and combine with the All/Unread tab
- [ ] Today view groups tasks; no-date bucket shown
- [ ] Overdue badge appears for past-due open tasks
- [ ] Calendar places tasks on due dates; days with tasks show a count hint + tooltip; day view opens
- [ ] Date chips (Today/Tomorrow/Week/Overdue/No date) filter correctly
- [ ] Search filters by title
- [ ] List ↔ Board (Kanban) toggle works on All tasks; board groups by status, cards show priority/due/assignees, and filters persist across the toggle
- [ ] Project cards show a task breakdown: completion bar (done/total %), per-status pill counts (Pending/In progress/Blocked/Done/Cancelled, non-zero only), and an Overdue pill — counts cover active (non-archived) tasks
- [ ] Hovering a card's "N members" shows the team list with each person's role (Admin / Member), admins listed first
- [ ] Project cards show a chip for every status — Pending, In progress, Blocked, Done, Cancelled (zeros shown dimmed) — and hovering a non-zero chip lists that status's tasks; an Overdue chip shows when applicable
- [ ] Workspace admin can create a project and manage its team (add/remove members, set project admins)
- [ ] Project admins create/edit/transfer/assign within their project; members are read-only + status reports
- [ ] Admin tier protected: a non-creator project admin can manage **members** but cannot add/remove/demote **admins** (UI hides controls + API 403); only the project **creator** or a **super admin** can — and the creator can only be removed by a super admin
- [ ] A **workspace "User"** who is a **project admin** can assign/transfer/edit that project's tasks and sees **New task** (regression check for project-vs-workspace role)
- [ ] Task visibility is assignment-aware — a plain member sees only tasks assigned to/created by them; project/workspace admins see all in their projects; super admins see all
- [ ] Status change is assignee-gated — only the task's assignee(s) or a project admin/super admin can change status; a non-assignee member is blocked (UI hidden + API 403)
- [ ] New task requires a Project; the assignee picker is limited to that project's members — and so are **Manage assignees** (detail page) and **Transfer to** (non-members never shown; server 400s if attempted)
- [ ] Project, Assignee, and ★ Important (high-priority) filters work on All tasks
- [ ] Users (members) can only set status to In progress / Done; Blocked/Cancelled/reopen are admin-only (UI + API 403)
- [ ] Only super admins create projects; admins get "Request a project" and super admins are notified
- [ ] Admins can Deactivate (archive) a task; only super admins can hard-delete (API 403 otherwise); archived tasks leave the lists and can be reactivated
- [ ] Notifications fire for assign, transfer, status, task edit, and attachment — color-coded by type
- [ ] Task dates accept an optional time; it shows on detail/list/board, preloads on edit, and a time without its date is rejected
- [ ] Comments: post / see / delete-own (super admin deletes any); assignees+creator get an indigo notification
- [ ] Comment attachment: image/PDF/Word only (≤10 MB) — image shows a thumbnail, others a file link; wrong type rejected; attachment-only comment allowed
- [ ] Transfer "to" dropdown excludes the current user; self-transfer via API returns 400
- [ ] Checklist (subtasks): add / tick / delete; progress bar + x-of-y update and persist
- [ ] New task form: optional **Checklist** items added at creation appear (in order) on the new task's detail page
- [ ] Creating a task is **single-submit**: rapid double-clicks / Enter+click create exactly **one** task (button disabled through navigation)
- [ ] Bulk bar has **Restore** (unarchive): select archived tasks (Archived/All filter) → Restore brings them back to Active; detail page also has **Reactivate**
- [ ] Recurring task shows a "Repeats …" badge and spawns the next occurrence (dates shifted) when marked Done
- [ ] Due-today (amber) and overdue (red) reminders appear in notifications, once per task per day
- [ ] Bulk actions: multi-select → set status / set priority / archive; "skipped" count for non-managed tasks
- [ ] Board drag-and-drop moves a task's status (member restriction enforced with revert + toast)
- [ ] Sort dropdown reorders; saved views save/apply/remove (per-browser); Active/Archived/All filter works
- [ ] Edit/rename a project (project admin or super admin); change shows in audit log
- [ ] Forgot password → request logged, admins notified, "Reset requested" badge; admin sets temp password (sessions revoked, new password works)
- [ ] Analytics page shows summary cards + by-status / by-priority / by-project, scoped to visible tasks
- [ ] Per-date activation blocks assignment on inactive dates
- [ ] Edit user works; deactivating an account force-logs-out and blocks login
- [ ] Only admins can create/edit/delete/transfer/assign — buttons hidden AND API returns 403 for regular users
- [ ] Regular user gets a read-only task (no Edit/Delete/Transfer/Manage assignees)
- [ ] Regular user CAN submit a status report and add/remove their own attachments
- [ ] `/dashboard/tasks/new` redirects regular users to the dashboard
- [ ] Regular user cannot reach /admin or other users' tasks
- [ ] Logout works; session persists across refresh
- [ ] Dark mode, empty states, and responsive layout look correct
- [ ] Audit log (admin) records auth events + every task/attachment/admin operation with actor, summary, and IP
- [ ] Failed login attempts appear as `auth.login_failed` (blank actor, attempted email + IP)
- [ ] Audit log action filter, search, and pagination work
- [ ] "My activity" shows each user only their own actions (no actor column)
- [ ] Priority is editable only by admins via the Edit form; regular users see it read-only (status stays separately changeable)
- [ ] Dark mode: all text/buttons readable — Calendar Today/nav buttons, unread notification rows, attachment drop-zone, landing page — no white-on-white

---

## 7. Resetting between runs

- **Re-test a user from scratch:** deactivate or delete the test tasks and notifications via the UI, or create a fresh user.
- **Clear a stuck session:** log out, or have the admin toggle the user inactive then active (this revokes sessions).
- **Full data reset:** because everything here is seed data, the cleanest reset is to re-run the migrations on a fresh Supabase project (or truncate the `task.*` tables in the SQL editor) and recreate the admin with `make-admin`.

---

## 8. Appendix A — Automated tests

**Unit tests** cover the pure logic (recurrence date-math, date validation, status-transition rules, reporting math):

```
npm test                # node --test via tsx, runs tests/unit/*.test.ts
```

✅ All cases pass. These are fast, need no database, and are the first thing to run after changing `lib/recurrence.ts`, `lib/date.ts`, `lib/schemas/status.ts`, or `lib/analytics-util.ts`.

**End-to-end** Playwright scaffold:

```
npm run test:e2e        # headless
npm run test:e2e:ui     # interactive runner
```

The e2e suite currently covers a basic smoke path (`tests/e2e/smoke.spec.ts`). Treat it as a foundation — the manual flows above remain the source of truth for full coverage until the suite is expanded.

Also useful: `npm run type-check` (tsc, should report **0 errors**).

---

## 9. Appendix B — Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Invalid environment variables" on `make-admin` | Script reads `.env`, not `.env.local` | Prefix with `DOTENV_CONFIG_PATH=.env.local`, or `cp .env.local .env` |
| `relation "task.users" does not exist` | Migrations not applied | Run `0001`–`0004`, then `0006`–`0010` in the Supabase SQL editor |
| `column … recur_rule / is_active does not exist`, or comments/checklist error | Missing later migration | Apply `0009` and `0010` |
| Login fails / hangs | Redis REST not set | Fill `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`, restart |
| "esbuild" Not Opened (macOS) | Gatekeeper quarantine | `xattr -r -d com.apple.quarantine node_modules`, then retry (don't click "Move to Bin") |
| App opens a different site on :3000 | Another dev server holds the port | Use the port printed in this project's terminal (often :3001) |
| Attachment link 404s | Bunny zone/CDN mismatch | Verify the four `BUNNY_*` vars; links are public (token auth is off) |

---

*Tip: run the flows in two or three side-by-side browser windows so you can see assignments, transfers, and live notifications cross between users in real time — that's the fastest way to validate the multi-user behavior.*
