import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { supabaseAdmin } from "@/lib/auth/supabase";
import { putFile, readUpload } from "@/lib/storage";
import { notifyStaff } from "./notifications";

export async function updateProfile(userId: string, input: { firstName: string; lastName: string; headline: string }) {
  await db
    .update(s.users)
    .set({ firstName: input.firstName.trim().slice(0, 60), lastName: input.lastName.trim().slice(0, 60), headline: input.headline.trim().slice(0, 140) })
    .where(eq(s.users.id, userId));
}

export async function setTheme(userId: string, theme: "system" | "light" | "dark") {
  await db.update(s.users).set({ theme }).where(eq(s.users.id, userId));
}

export async function setAvatar(userId: string, file: File) {
  if (file.size > 2 * 1024 * 1024) throw new Error("התמונה גדולה מ-2MB");
  const { bytes, mime, ext } = await readUpload(file, ["image"]);
  const path = await putFile(`avatars/${userId}/${randomUUID()}.${ext}`, bytes, mime);
  await db.update(s.users).set({ avatarUrl: `/api/files/${path}` }).where(eq(s.users.id, userId));
}

/**
 * Account deletion (Privacy Protection Law amendment 13): personal data is wiped and
 * the row is tombstoned so foreign keys (e.g. discussion history) stay consistent.
 * Notes, progress, favorites and notifications are deleted outright.
 */
export async function deleteAccount(user: { id: string; authId: string | null }) {
  await db.transaction(async (tx) => {
    await tx.delete(s.notes).where(eq(s.notes.userId, user.id));
    await tx.delete(s.favorites).where(eq(s.favorites.userId, user.id));
    await tx.delete(s.notifications).where(eq(s.notifications.userId, user.id));
    await tx.delete(s.progress).where(eq(s.progress.userId, user.id));
    await tx.delete(s.stepChecks).where(eq(s.stepChecks.userId, user.id));
    await tx.delete(s.submissions).where(eq(s.submissions.userId, user.id));
    await tx
      .update(s.users)
      .set({ email: `deleted+${user.id}@invalid`, firstName: "משתמש/ת", lastName: "שנמחק/ה", headline: "", avatarUrl: null, authId: null, deletedAt: new Date() })
      .where(eq(s.users.id, user.id));
  });
  if (user.authId) await supabaseAdmin()?.auth.admin.deleteUser(user.authId);
}

export async function createBugReport(
  userId: string,
  input: { kind: "bug" | "improvement"; subject: string; body: string; pageUrl: string | null; screenshot: File | null },
) {
  const subject = input.subject.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 5000);
  if (!subject || !body) throw new Error("נא למלא נושא ותיאור");
  let screenshotPath: string | null = null;
  if (input.screenshot && input.screenshot.size > 0) {
    const { bytes, mime, ext } = await readUpload(input.screenshot, ["image"]);
    screenshotPath = await putFile(`bug-reports/${userId}/${randomUUID()}.${ext}`, bytes, mime);
  }
  await db.insert(s.bugReports).values({ userId, kind: input.kind, subject, body, pageUrl: input.pageUrl?.slice(0, 500) ?? null, screenshotPath });
  await notifyStaff("bug.new", `${input.kind === "bug" ? "דיווח תקלה" : "בקשת שיפור"}: ${subject}`, "/admin/reports");
}
