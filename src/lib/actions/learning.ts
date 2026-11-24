"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionUser } from "@/lib/auth/session";
import * as L from "@/lib/data/learning";
import * as D from "@/lib/data/discussion";
import { getProgramContext } from "@/lib/data/programs";
import { issueCertificate } from "@/lib/data/certificates";
import { putFile, readUpload } from "@/lib/storage";

type Result = { error?: string } | undefined;
const uuid = z.string().uuid();

async function run(fn: () => Promise<unknown>, paths: string[] = []): Promise<Result> {
  try {
    await fn();
    for (const p of paths) revalidatePath(p, "page");
    return undefined;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "משהו השתבש" };
  }
}

const learnPath = "/learn/[slug]/[itemId]";

export async function setStatusAction(itemId: string, status: "done" | "skipped" | "reset") {
  const u = await actionUser();
  if (!uuid.safeParse(itemId).success || !["done", "skipped", "reset"].includes(status)) return { error: "בקשה לא תקינה" };
  return run(() => L.setItemStatus(u, itemId, status), [learnPath, "/programs/[slug]", "/"]);
}

export async function toggleFavoriteAction(itemId: string) {
  const u = await actionUser();
  return run(() => L.toggleFavorite(u, uuid.parse(itemId)), [learnPath]);
}

export async function addNoteAction(itemId: string, body: string, positionSec: number | null) {
  const u = await actionUser();
  return run(() => L.addNote(u, uuid.parse(itemId), String(body), positionSec == null ? null : Number(positionSec)), [learnPath, "/notes"]);
}

export async function updateNoteAction(noteId: string, body: string) {
  const u = await actionUser();
  return run(() => L.updateNote(u, uuid.parse(noteId), String(body)), [learnPath, "/notes"]);
}

export async function deleteNoteAction(noteId: string) {
  const u = await actionUser();
  return run(() => L.deleteNote(u, uuid.parse(noteId)), [learnPath, "/notes"]);
}

const answersSchema = z.record(z.string().uuid(), z.array(z.number().int().min(0).max(50)).max(50));

export async function submitQuizAction(itemId: string, answers: Record<string, number[]>) {
  const u = await actionUser();
  try {
    const result = await L.submitQuiz(u, uuid.parse(itemId), answersSchema.parse(answers));
    revalidatePath(learnPath, "page");
    return { result };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השליחה נכשלה" };
  }
}

export async function toggleStepAction(itemId: string, stepId: string, checked: boolean) {
  const u = await actionUser();
  return run(() => L.toggleStep(u, uuid.parse(itemId), uuid.parse(stepId), Boolean(checked)), [learnPath]);
}

export async function submitAssignmentAction(_: Result, form: FormData): Promise<Result> {
  const u = await actionUser();
  return run(async () => {
    const itemId = uuid.parse(form.get("itemId"));
    const link = String(form.get("linkUrl") ?? "").trim();
    if (link && !/^https?:\/\//i.test(link)) throw new Error("הקישור חייב להתחיל ב-http או https");
    const file = form.get("file");
    let filePath: string | null = null;
    let fileName: string | null = null;
    if (file instanceof File && file.size > 0) {
      const { bytes, mime, ext } = await readUpload(file, ["pdf"]);
      filePath = await putFile(`submissions/${u.id}/${randomUUID()}.${ext}`, bytes, mime);
      fileName = file.name.slice(0, 200);
    }
    const notes = String(form.get("notes") ?? "").trim().slice(0, 500);
    if (!link && !filePath && !form.get("keepFile")) throw new Error("צרפו קישור או קובץ PDF");
    await L.submitAssignment(u, itemId, { linkUrl: link || null, filePath, fileName, notes });
  }, [learnPath]);
}

export async function createThreadAction(itemId: string, kind: "question" | "share", body: string, videoSec: number | null) {
  const u = await actionUser();
  return run(() => D.createThread(u, uuid.parse(itemId), kind === "share" ? "share" : "question", String(body), videoSec), [learnPath]);
}

export async function replyAction(threadId: string, body: string) {
  const u = await actionUser();
  return run(() => D.reply(u, uuid.parse(threadId), String(body)), [learnPath]);
}

export async function acceptAnswerAction(threadId: string, messageId: string | null) {
  const u = await actionUser();
  return run(() => D.acceptAnswer(u, uuid.parse(threadId), messageId ? uuid.parse(messageId) : null), [learnPath]);
}

export async function deleteThreadAction(threadId: string) {
  const u = await actionUser();
  return run(() => D.deleteThread(u, uuid.parse(threadId)), [learnPath]);
}

export async function deleteMessageAction(messageId: string) {
  const u = await actionUser();
  return run(() => D.deleteMessage(u, uuid.parse(messageId)), [learnPath]);
}

export async function issueCertificateAction(slug: string) {
  const u = await actionUser();
  return run(async () => {
    const ctx = await getProgramContext(u, String(slug));
    if (!ctx) throw new Error("אין גישה");
    await issueCertificate(u, ctx);
  }, ["/programs/[slug]/progress"]);
}
