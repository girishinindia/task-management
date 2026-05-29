/**
 * End-to-end smoke covering the spec's seven-step flow:
 *
 *   1. Sign up + log in (with reCAPTCHA disabled in test env).
 *   2. Create a task.
 *   3. Assign to a second user.
 *   4. Transfer to a third user.
 *   5. Upload an image attachment.
 *   6. Change status to done.
 *   7. Verify activity timeline shows the events.
 *
 * Most assertions are placeholders — fill them in once you have a known
 * admin account in the target environment (see scripts/make-admin.ts).
 *
 * NOTE on test env:
 *   - Set ALLOW_PUBLIC_SIGNUP=true so step 1 can create a user (Phase 12
 *     locks signup down by default).
 *   - Set NEXT_PUBLIC_RECAPTCHA_ENABLED=false and RECAPTCHA_ENABLED=false.
 *   - Use a separate Supabase project for tests — this suite mutates data.
 */
import { test, expect } from "@playwright/test";

const TEST_PREFIX = `e2e-${Date.now()}`;

test.describe.serial("Task Portal smoke", () => {
  test("1. sign up the primary user", async ({ page }) => {
    await page.goto("/signup");
    await page.fill('input[name="full_name"]', `${TEST_PREFIX} Primary`);
    await page.fill('input[name="email"]', `${TEST_PREFIX}-primary@example.com`);
    await page.fill('input[name="password"]', "Sup3rSecret!");
    await page.fill('input[name="confirm_password"]', "Sup3rSecret!");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("2. create a task", async ({ page }) => {
    await page.goto("/dashboard/tasks/new");
    await page.fill('input[id="title"]', `${TEST_PREFIX} task`);
    await page.fill('textarea[id="description"]', "smoke-test task body");
    await page.fill('input[id="due_date"]', "2030-01-15");
    await page.click('button[type="submit"]:has-text("Create task")');
    await expect(page).toHaveURL(/\/dashboard\/tasks\//);
    await expect(page.locator("h1")).toContainText(`${TEST_PREFIX} task`);
  });

  test.skip("3. assign to a second user", async () => {
    // TODO: create a second e2e user via /api/admin/users, then exercise
    // the assignee picker on the detail page.
  });

  test.skip("4. transfer to a third user", async () => {
    // TODO: requires a third user. Trigger the Transfer dialog, confirm a
    // task_transfers row appears in the timeline.
  });

  test.skip("5. upload an image attachment", async () => {
    // TODO: set up a fixtures/image.png and use setInputFiles on the hidden
    // <input type="file"> inside AttachmentsSection.
  });

  test("6. change status to done", async ({ page }) => {
    // Assumes step 2 left us on a task detail page. If running this test in
    // isolation, navigate first.
    await page.click("text=Pending");
    await page.click("role=menuitem[name=/In progress/i]");
    await page.click("text=Confirm");
    await expect(page.locator("text=In progress")).toBeVisible();

    await page.click("text=In progress");
    await page.click("role=menuitem[name=/Done/i]");
    await page.click("text=Confirm");
    await expect(page.locator("text=Done")).toBeVisible();
  });

  test("7. activity timeline shows the events", async ({ page }) => {
    await expect(page.locator("text=Activity")).toBeVisible();
    await expect(page.locator("text=changed status")).toBeVisible();
  });
});
