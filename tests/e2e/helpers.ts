import { expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import postgres from "postgres";

export const DB_URL = process.env.E2E_DATABASE_URL ?? "postgres://postgres@127.0.0.1:54329/lms_e2e";

export async function login(page: Page, name: RegExp | string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("button", { name }).click();
  await page.waitForURL("/");
}

export async function itemId(titlePrefix: string): Promise<string> {
  const sql = postgres(DB_URL, { max: 1 });
  const [r] = await sql`select id from items where title like ${titlePrefix + "%"} limit 1`;
  await sql.end();
  return r!.id as string;
}

export async function expectNoSeriousA11yViolations(page: Page) {
  // Next 15 streams <title> after the shell; wait for it so axe sees the final document.
  await expect(page).toHaveTitle(/\S/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
}
