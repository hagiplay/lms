import { expect, test } from "@playwright/test";
import { createHmac } from "node:crypto";
import { expectNoSeriousA11yViolations, itemId, login, reseed } from "./helpers";

test.describe.configure({ mode: "serial" });
test.beforeAll(reseed);

test("dashboard → continue → mark lesson complete", async ({ page }) => {
  await login(page, /נועה/);
  const hero = page.locator("section[aria-labelledby=hero-title]");
  await expect(hero.getByRole("heading", { level: 1 })).toContainText("Webhook");
  await expectNoSeriousA11yViolations(page);
  await hero.getByRole("link", { name: /המשך לצפות/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1.5");
  await page.getByRole("button", { name: "סמנו כהושלם" }).click();
  await expect(page.getByRole("button", { name: "הושלם" })).toHaveAttribute("aria-pressed", "true");
  await expectNoSeriousA11yViolations(page);
});

test("timeline + transcript tabs, notes with timestamp", async ({ page }) => {
  await login(page, /נועה/);
  await page.goto(`/learn/ai-automations/${await itemId("1.4")}`);
  await page.getByRole("tab", { name: /ציר זמן/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("טריגר לפי זמן");
  await page.getByRole("tab", { name: /תמלול/ }).click();
  await page.getByPlaceholder("חיפוש בתמלול").fill("בית קפה");
  await expect(page.locator("mark").first()).toHaveText("בית קפה");
  await page.getByRole("tab", { name: /הערות/ }).click();
  await page.getByLabel("הערה חדשה").fill("הערת בדיקה אוטומטית");
  await page.getByRole("button", { name: "שמירת הערה" }).click();
  await expect(page.getByText("הערת בדיקה אוטומטית")).toBeVisible();
  await page.goto("/notes");
  await expect(page.getByText("הערת בדיקה אוטומטית")).toBeVisible();
});

test("quiz: wrong answers show explanations, retry passes", async ({ page }) => {
  await login(page, /נועה/);
  await page.goto(`/learn/ai-automations/${await itemId("2.2")}`);
  await page.getByRole("button", { name: "התחלת המבדק" }).click();
  await page.getByRole("radio", { name: "לאשר תשלומים" }).check();
  await page.getByRole("button", { name: "שליחת תשובות" }).click();
  await expect(page.getByRole("status")).toContainText("עוד לא");
  await expect(page.getByText("סיכום וסיווג הם משימות שקל לבדוק")).toBeVisible();
  await page.getByRole("button", { name: "ניסיון נוסף" }).click();
  await page.getByRole("radio", { name: "לסכם ולסווג" }).check();
  await page.getByRole("button", { name: "שליחת תשובות" }).click();
  await expect(page.getByRole("status")).toContainText("עברתם");
});

test("assignment checklist completes the item", async ({ page }) => {
  await login(page, /נועה/);
  await page.goto(`/learn/ai-automations/${await itemId("1.6")}`);
  const boxes = page.getByRole("checkbox");
  const n = await boxes.count();
  for (let i = 0; i < n; i++) if (!(await boxes.nth(i).isChecked())) await boxes.nth(i).check();
  await expect(page.getByText("המשימה הושלמה")).toBeVisible();
  await page.reload();
  await expect(page.getByText(`${n} מתוך ${n} סומנו`)).toBeVisible();
});

test("discussion: question → mentor answer → accepted, author notified", async ({ page }) => {
  const lesson = await itemId("1.1");
  await login(page, /נועה/);
  await page.goto(`/learn/ai-automations/${lesson}?tab=discussion`);
  await page.getByLabel("ההודעה שלכם").fill("שאלת בדיקה: מה ההבדל בין טריגר לפעולה?");
  await page.getByRole("button", { name: "פרסום" }).click();
  await expect(page.getByText("שאלת בדיקה")).toBeVisible();

  await login(page, /דני/);
  await page.goto(`/learn/ai-automations/${lesson}?tab=discussion`);
  const thread = page.locator("li[id^=t-]", { hasText: "שאלת בדיקה" });
  await thread.getByLabel("תגובה").fill("טריגר מתחיל, פעולה מבצעת.");
  await thread.getByRole("button", { name: "שליחה" }).click();
  await thread.getByRole("button", { name: "סימון כתשובה נבחרת" }).click();
  await expect(thread.getByText("נענתה")).toBeVisible();

  await login(page, /נועה/);
  await page.getByRole("button", { name: /התראות, \d+ חדשות/ }).click();
  await expect(page.getByText(/הגיב\/ה לשאלה שלך/)).toBeVisible();
});

test("locked content is not reachable by URL", async ({ page }) => {
  await login(page, /עומר/);
  const res = await page.goto(`/learn/ai-automations/${await itemId("2.1")}`);
  expect(res?.status()).toBe(404);
  await page.goto("/programs/ai-automations");
  await expect(page.getByText(/נפתח אחרי השלמת 50%/)).toBeVisible();
});

test("⌘K search finds transcript text", async ({ page }) => {
  await login(page, /נועה/);
  // The shortcut listener attaches on hydration; retry until the palette opens.
  await expect(async () => {
    if (!(await page.getByRole("combobox").isVisible())) await page.keyboard.press("Control+k");
    await expect(page.getByRole("combobox")).toBeVisible({ timeout: 1000 });
  }).toPass();
  await page.getByRole("combobox").fill("בית קפה");
  await page.getByRole("tab", { name: /בתמלול/ }).click();
  await expect(page.getByRole("option").first()).toContainText("בית קפה");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/tab=transcript/);
});

test("admin creates an event that members see; theme toggle", async ({ page }) => {
  await login(page, /מאיה/);
  await page.goto("/admin/events");
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "הוספה" }) });
  await form.getByLabel("כותרת").fill("מפגש בדיקה E2E");
  await form.getByLabel("מועד (שעון ישראל)").fill("2030-01-15T19:00");
  await form.getByRole("button", { name: "הוספה" }).click();
  await expect(page.getByText("מפגש בדיקה E2E")).toBeVisible();

  await login(page, /נועה/);
  await page.goto("/events");
  await expect(page.getByText("מפגש בדיקה E2E")).toBeVisible();
  await expect(page.getByText(/ינו׳ 19:00|בינו׳ 19:00|15 בינו/)).toBeVisible();
  await page.getByRole("button", { name: "תפריט משתמש" }).click();
  await page.getByRole("button", { name: "כהה" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expectNoSeriousA11yViolations(page);
});

test("admin validation errors are shown, not swallowed", async ({ page }) => {
  await login(page, /מאיה/);
  await page.goto("/admin/programs");
  await page.getByLabel("שם").fill("בדיקה");
  await page.getByLabel("slug (באנגלית)").evaluate((el: HTMLInputElement) => el.removeAttribute("pattern"));
  await page.getByLabel("slug (באנגלית)").fill("לא תקין");
  await page.getByRole("button", { name: "יצירה" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "slug" })).toContainText("אותיות באנגלית");
});

test("payment webhook: bad signature rejected, valid one enrolls", async ({ request, page }) => {
  const body = JSON.stringify({ id: "e2e-pay-1", type: "payment.succeeded", email: "buyer.e2e@example.com", firstName: "קונה", lastName: "בדיקה", programSlug: "ai-automations" });
  expect((await request.post("/api/webhooks/payments", { data: body, headers: { "content-type": "application/json", "x-signature": "sha256=" + "0".repeat(64) } })).status()).toBe(401);
  const sig = createHmac("sha256", "e2e-secret").update(body).digest("hex");
  const ok = await request.post("/api/webhooks/payments?provider=e2e", { data: body, headers: { "content-type": "application/json", "x-signature": `sha256=${sig}` } });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).status).toBe("ok");
  await login(page, /קונה/);
  await expect(page.getByText("אוטומציות AI מאפס").first()).toBeVisible();
});

test("public certificate page 404s on unknown code; files API needs auth", async ({ page, request }) => {
  expect((await page.goto("/certificates/ABCDE-FGHJK"))?.status()).toBe(404);
  expect((await request.get("/api/files/submissions/x/y.pdf")).status()).toBe(401);
});
