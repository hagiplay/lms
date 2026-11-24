"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth/session";
import { clearNotifications, deleteNotification, markAllRead } from "@/lib/data/notifications";
import { createBugReport, setTheme } from "@/lib/data/profile";

export async function markNotificationsRead() {
  const u = await actionUser();
  await markAllRead(u.id);
  revalidatePath("/", "layout");
}

export async function removeNotification(id: string) {
  const u = await actionUser();
  await deleteNotification(u.id, id);
  revalidatePath("/", "layout");
}

export async function clearAllNotifications() {
  const u = await actionUser();
  await clearNotifications(u.id);
  revalidatePath("/", "layout");
}

export async function changeTheme(theme: "system" | "light" | "dark") {
  const u = await actionUser();
  if (!["system", "light", "dark"].includes(theme)) return;
  await setTheme(u.id, theme);
  const jar = await cookies();
  if (theme === "system") jar.delete("theme");
  else jar.set("theme", theme, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}

export async function setSidebarCollapsed(collapsed: boolean) {
  (await cookies()).set("sidebar", collapsed ? "collapsed" : "open", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

export type FormResult = { ok?: boolean; error?: string };

export async function submitBugReport(_: FormResult, form: FormData): Promise<FormResult> {
  try {
    const u = await actionUser();
    const shot = form.get("screenshot");
    await createBugReport(u.id, {
      kind: form.get("kind") === "improvement" ? "improvement" : "bug",
      subject: String(form.get("subject") ?? ""),
      body: String(form.get("body") ?? ""),
      pageUrl: String(form.get("pageUrl") ?? "") || null,
      screenshot: shot instanceof File && shot.size > 0 ? shot : null,
    });
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השליחה נכשלה" };
  }
}
