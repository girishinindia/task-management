# Task Portal — What's New (Team Update)

A short, grouped summary of recent changes and what to test. Full step-by-step
flows live in `TESTING.md`.

---

## User hierarchy (3 levels)

- **Super admin** — sees everything; the *only* one who can **create projects** and **permanently delete** tasks.
- **Admin** — manages the projects they belong to: team, tasks, assignments, transfers; can **archive (deactivate)** tasks; can **request** a new project from a super admin.
- **User (member)** — works inside their projects: views their tasks, submits status (**In progress / Done**), adds attachments. Cannot create / edit / assign / delete.

---

## What changed (group-wise)

**1. Projects & teams (new)**
- Every task now belongs to a **Project**; projects have their own **team** and **admins**.
- Super admin creates projects and adds members (as admin or member).
- Admins can **request a project** — super admins get notified.
- New **Projects** page in the sidebar.

**2. Task views & filters**
- **List ↔ Board (Kanban)** toggle on All tasks.
- **Calendar** now shows a "N tasks" hint + tooltip on each day.
- New filters: **Project**, **Assignee**, and **★ Important** (high priority).

**3. Permissions & status rules**
- Create / edit / delete / transfer / assign = **admins** (of that project) or super admin.
- **Users** can only set status to **In progress** or **Done** (not Blocked/Cancelled/reopen).
- **Deactivate (archive)** a task = admins; **hard delete** = super admin only.

**4. Notifications**
- Now fire for **assign, transfer, status change, task edit, and attachment**.
- **Color-coded icons** per type for quick scanning.

**5. Audit log & activity**
- Super-admin **Audit log**: every action (logins, task/project changes, attachments) with who / when / IP.
- Each user has a **"My activity"** page of their own actions.

**6. Polish & fixes**
- New look (Inter font + soft light-blue theme, light/dark mode).
- Show/hide **password eye** on login & signup.
- Dark-mode contrast fixes (calendar, notifications).
- **ZIP** and other file uploads accepted reliably.
- Date validation (no more broken year inputs).

---

## What to test (quick checklist)

- [ ] Log in as each level: a **super admin**, an **admin**, a **user**.
- [ ] **Super admin:** create a project; add an admin + members; hard-delete a task.
- [ ] **Admin:** create/edit tasks in their project; assign to project members; transfer; **archive** a task; **request** a project.
- [ ] **User:** sees only their project's tasks; status menu shows **only In progress / Done**; add an attachment; **cannot** edit/assign/delete.
- [ ] **Filters & views:** Project, Assignee, **★ Important**; switch List ↔ Board; Calendar day counts.
- [ ] **Notifications:** colored alerts appear for assign / transfer / status / edit / attachment.
- [ ] **Visibility:** Delete shows only for super admin; Deactivate shows for admins; archived tasks leave the lists.
- [ ] **Tracking:** Audit log (admins) and "My activity" (everyone) show the actions above.

> Setup: whoever runs the app must apply the Supabase migrations **through `0009`** first.
