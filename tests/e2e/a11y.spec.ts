import { test } from "@playwright/test";
import { expectNoSeriousA11yViolations, itemId, login, reseed } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(reseed);

for (const scheme of ["light", "dark"] as const) {
  test(`member pages have no serious a11y violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await login(page, /נועה/);
    const pages = [
      "/",
      "/programs/ai-automations",
      "/programs/ai-automations/progress",
      `/learn/ai-automations/${await itemId("1.1")}`,
      `/learn/ai-automations/${await itemId("1.1")}?tab=discussion`,
      `/learn/ai-automations/${await itemId("1.3")}`,
      `/learn/ai-automations/${await itemId("1.6")}`,
      "/notes",
      "/events",
      "/settings",
    ];
    for (const p of pages) {
      await page.goto(p);
      await expectNoSeriousA11yViolations(page);
    }
  });
}

test("admin pages have no serious a11y violations", async ({ page }) => {
  await login(page, /מאיה/);
  for (const p of ["/admin", "/admin/programs", "/admin/events", "/admin/reviews", "/admin/reports", "/admin/members", `/admin/items/${await itemId("1.3")}`]) {
    await page.goto(p);
    await expectNoSeriousA11yViolations(page);
  }
});

test("login page", async ({ page }) => {
  await page.goto("/login");
  await expectNoSeriousA11yViolations(page);
});
