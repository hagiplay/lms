import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms_e2e";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL: `http://localhost:${PORT}`, locale: "he-IL", timezoneId: "Asia/Jerusalem", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } }],
  webServer: {
    command: process.env.E2E_DEV ? `next dev -p ${PORT}` : `next build && next start -p ${PORT}`,
    port: PORT,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { DATABASE_URL, ALLOW_DEV_LOGIN: "1", PAYMENT_WEBHOOK_SECRET: "e2e-secret", AUTH_SECRET: "e2e-auth-secret" },
  },
});
