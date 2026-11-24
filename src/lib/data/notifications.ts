import "server-only";
import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { sendEmail } from "@/lib/email";

export async function notify(
  userId: string,
  type: string,
  title: string,
  opts: { href?: string; body?: string; email?: boolean } = {},
) {
  await db.insert(s.notifications).values({ userId, type, title, body: opts.body ?? "", href: opts.href ?? null });
  if (opts.email) {
    const [u] = await db.select({ email: s.users.email, deletedAt: s.users.deletedAt }).from(s.users).where(eq(s.users.id, userId));
    if (u && !u.deletedAt) await sendEmail(u.email, title, opts.body || title, opts.href);
  }
}

export async function notifyStaff(type: string, title: string, href: string) {
  const staff = await db
    .select({ id: s.users.id })
    .from(s.users)
    .where(and(inArray(s.users.role, ["mentor", "admin", "owner"]), isNull(s.users.deletedAt)));
  if (staff.length) await db.insert(s.notifications).values(staff.map((u) => ({ userId: u.id, type, title, href })));
}

export async function listNotifications(userId: string, limit = 30) {
  return db.select().from(s.notifications).where(eq(s.notifications.userId, userId)).orderBy(desc(s.notifications.createdAt)).limit(limit);
}

export async function unreadCount(userId: string) {
  const [r] = await db.select({ n: count() }).from(s.notifications).where(and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)));
  return r?.n ?? 0;
}

export async function markAllRead(userId: string) {
  await db.update(s.notifications).set({ readAt: new Date() }).where(and(eq(s.notifications.userId, userId), isNull(s.notifications.readAt)));
}

export async function deleteNotification(userId: string, id: string) {
  await db.delete(s.notifications).where(and(eq(s.notifications.userId, userId), eq(s.notifications.id, id)));
}

export async function clearNotifications(userId: string) {
  await db.delete(s.notifications).where(eq(s.notifications.userId, userId));
}
