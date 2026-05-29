import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the Task Portal smoke suite.
 *
 * Before first run:
 *   npm install --save-dev @playwright/test
 *   npx playwright install
 *
 * Then either:
 *   npm run test:e2e        # headless
 *   npm run test:e2e:ui     # interactive UI mode
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: false, // shared DB — keep tests serial
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_NO_SERVER
    ? undefined
    : {
        command: "npm run dev",
        port: 3000,
        timeout: 60_000,
        reuseExistingServer: !process.env.CI,
      },
});
