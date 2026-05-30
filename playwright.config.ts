import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — runs the WhatsApp share E2E suite against the local
 * Vite dev server in two browser projects:
 *
 *   • desktop-chromium — desktop Chrome / Edge behavior
 *   • mobile-safari    — iPhone 13 emulation on WebKit (real Safari engine)
 *
 * Run:
 *   bunx playwright install            # one-time, downloads browsers
 *   bunx playwright test               # both projects
 *   bunx playwright test --project=mobile-safari
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:8080",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev",
    url: "http://localhost:8080/__test/whatsapp",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"] }, // WebKit engine — real Safari UA
    },
  ],
});