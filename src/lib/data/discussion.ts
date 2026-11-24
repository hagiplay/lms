import "server-only";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { authorizeItem } from "./programs";
import { notify } from "./notifications";
import { canAcceptAnswer, canDeletePost } from "@/lib/domain/authz";
import { fullName } from "@/lib/domain/format";
import type { Role } from "@/lib/domain/types";

type U = { id: string; role: Role };
const MAX = 4000;

const author = {
  id: s.users.id,
  firstName: s.users.firstName,
  lastName: s.users.lastName,
  avatarUrl: s.users.avatarUrl,
  role: s.users.role,
  headline: s.users.headline,
};

async function access(user: U, itemId: string) {
  const a = await authorizeItem(user, itemId);
  if (!a) throw new Error("אין גישה לפריט הזה");
  return a;
}

export async function listThreads(user: U, itemId: string, sort: "new" | "top" = "new") {
  await access(user, itemId);
  const threads = await db
    .select({ thread: s.threads, author })
    .from(s.threads)
    .innerJoin(s.users, eq(s.users.id, s.threads.authorId))
    .where(and(eq(s.threads.itemId, itemId), isNull(s.threads.deletedAt)))
    .orderBy(desc(s.threads.createdAt));
  const ids = threads.map((t) => t.thread.id);
  const msgs = ids.length
    ? await db
        .select({ message: s.messages, author })
        .from(s.messages)
        .innerJoin(s.users, eq(s.users.id, s.messages.authorId))
        .where(and(inArray(s.messages.threadId, ids), isNull(s.messages.deletedAt)))
        .orderBy(asc(s.messages.createdAt))
    : [];
  const out = threads.map((t) => ({ ...t, replies: msgs.filter((m) => m.message.threadId === t.thread.id) }));
  if (sort === "top") out.sort((a, b) => b.replies.length - a.replies.length);
  return out;
}

export async function createThread(user: U, itemId: string, kind: "question" | "share", body: string, videoSec: number | null) {
  await access(user, itemId);
  const text = body.trim().slice(0, MAX);
  if (!text) throw new Error("ההודעה ריקה");
  await db.insert(s.threads).values({ itemId, authorId: user.id, kind, body: text, videoSec: videoSec == null ? null : Math.max(0, Math.floor(videoSec)) });
}

async function threadWithItem(threadId: string) {
  const [t] = await db.select().from(s.threads).where(and(eq(s.threads.id, threadId), isNull(s.threads.deletedAt)));
  if (!t) throw new Error("הדיון לא נמצא");
  return t;
}

export async function reply(user: U & { firstName: string; lastName: string }, threadId: string, body: string) {
  const t = await threadWithItem(threadId);
  const { ctx } = await access(user, t.itemId);
  const text = body.trim().slice(0, MAX);
  if (!text) throw new Error("התגובה ריקה");
  await db.insert(s.messages).values({ threadId, authorId: user.id, body: text });
  if (t.authorId !== user.id) {
    await notify(t.authorId, t.kind === "question" ? "thread.answered" : "thread.reply", `${fullName(user)} הגיב/ה ל${t.kind === "question" ? "שאלה" : "שיתוף"} שלך`, {
      href: `/learn/${ctx.program.slug}/${t.itemId}?tab=discussion#t-${t.id}`,
      email: t.kind === "question",
      body: text.slice(0, 280),
    });
  }
}

export async function acceptAnswer(user: U, threadId: string, messageId: string | null) {
  const t = await threadWithItem(threadId);
  const { ctx } = await access(user, t.itemId);
  if (t.kind !== "question" || !canAcceptAnswer(user.role, user.id, t.authorId)) throw new Error("אין הרשאה");
  if (messageId) {
    const [m] = await db.select().from(s.messages).where(and(eq(s.messages.id, messageId), eq(s.messages.threadId, threadId)));
    if (!m) throw new Error("התגובה לא נמצאה");
    await db.update(s.threads).set({ acceptedMessageId: messageId }).where(eq(s.threads.id, threadId));
    if (m.authorId !== user.id) {
      await notify(m.authorId, "answer.accepted", "התשובה שלך סומנה כתשובה נבחרת ✓", { href: `/learn/${ctx.program.slug}/${t.itemId}?tab=discussion#t-${t.id}` });
    }
  } else {
    await db.update(s.threads).set({ acceptedMessageId: null }).where(eq(s.threads.id, threadId));
  }
}

export async function deleteThread(user: U, threadId: string) {
  const t = await threadWithItem(threadId);
  if (!canDeletePost(user.role, user.id, t.authorId)) throw new Error("אין הרשאה");
  await db.update(s.threads).set({ deletedAt: new Date() }).where(eq(s.threads.id, threadId));
}

export async function deleteMessage(user: U, messageId: string) {
  const [m] = await db.select().from(s.messages).where(eq(s.messages.id, messageId));
  if (!m || !canDeletePost(user.role, user.id, m.authorId)) throw new Error("אין הרשאה");
  await db.update(s.messages).set({ deletedAt: new Date() }).where(eq(s.messages.id, messageId));
  await db.update(s.threads).set({ acceptedMessageId: null }).where(and(eq(s.threads.id, m.threadId), eq(s.threads.acceptedMessageId, messageId)));
}
