import "server-only";
import { and, asc, count, desc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { authorizeItem } from "./programs";
import { notify, notifyStaff } from "./notifications";
import { attemptsLeft, gradeQuiz } from "@/lib/domain/quiz";
import { canReviewSubmissions } from "@/lib/domain/authz";
import type { Role } from "@/lib/domain/types";

type U = { id: string; role: Role };

export class AccessError extends Error {
  constructor(message = "אין גישה לפריט הזה") {
    super(message);
  }
}

async function mustAuthorize(user: U, itemId: string) {
  const a = await authorizeItem(user, itemId);
  if (!a) throw new AccessError();
  return a;
}

/* ---------- Progress & points ---------- */

async function awardPoints(userId: string, programId: string, itemId: string, points: number) {
  if (points <= 0) return;
  await db.insert(s.pointsLedger).values({ userId, programId, sourceType: "item", sourceId: itemId, points }).onConflictDoNothing();
}

export async function setItemStatus(user: U, itemId: string, status: "done" | "skipped" | "reset") {
  const { ctx, item } = await mustAuthorize(user, itemId);
  await applyStatus(user.id, ctx.program.id, item, status);
}

async function applyStatus(userId: string, programId: string, item: typeof s.items.$inferSelect, status: "done" | "skipped" | "reset") {
  const now = new Date();
  if (status === "reset") {
    await db.update(s.progress).set({ status: "in_progress", completedAt: null, lastSeenAt: now }).where(and(eq(s.progress.userId, userId), eq(s.progress.itemId, item.id)));
    return;
  }
  await db
    .insert(s.progress)
    .values({ userId, itemId: item.id, status, completedAt: status === "done" ? now : null, lastSeenAt: now, watchedPct: status === "done" && item.type === "video" ? 100 : 0 })
    .onConflictDoUpdate({
      target: [s.progress.userId, s.progress.itemId],
      set: { status, completedAt: status === "done" ? now : null, lastSeenAt: now },
    });
  if (status === "done") await awardPoints(userId, programId, item.id, item.points);
}

/** Video position beacon. Never downgrades a finished item. */
export async function recordPosition(user: U, itemId: string, positionSec: number, durationSec: number) {
  await mustAuthorize(user, itemId);
  const pos = Math.max(0, Math.min(Math.floor(positionSec), 24 * 3600));
  const pct = durationSec > 0 ? Math.max(0, Math.min(100, Math.round((pos / durationSec) * 100))) : 0;
  const now = new Date();
  await db
    .insert(s.progress)
    .values({ userId: user.id, itemId, positionSec: pos, watchedPct: pct, lastSeenAt: now })
    .onConflictDoUpdate({ target: [s.progress.userId, s.progress.itemId], set: { positionSec: pos, watchedPct: pct, lastSeenAt: now } });
}

export async function touchItem(user: U, itemId: string) {
  const now = new Date();
  await db
    .insert(s.progress)
    .values({ userId: user.id, itemId, lastSeenAt: now })
    .onConflictDoUpdate({ target: [s.progress.userId, s.progress.itemId], set: { lastSeenAt: now } });
}

/* ---------- Item details ---------- */

export async function getItemDetails(user: U, itemId: string) {
  const a = await authorizeItem(user, itemId);
  if (!a) return null;
  const [lesson] = await db.select().from(s.lessonContents).where(eq(s.lessonContents.itemId, itemId));
  const [quiz] = await db.select().from(s.quizzes).where(eq(s.quizzes.itemId, itemId));
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.itemId, itemId));

  const questions = quiz
    ? (await db.select().from(s.questions).where(eq(s.questions.quizItemId, itemId)).orderBy(asc(s.questions.position))).map(
        // Never send correct answers/explanations to the client before an attempt.
        ({ id, kind, prompt, options, points }) => ({ id, kind, prompt, options, points }),
      )
    : [];
  const attempts = quiz
    ? await db.select().from(s.quizAttempts).where(and(eq(s.quizAttempts.userId, user.id), eq(s.quizAttempts.quizItemId, itemId))).orderBy(desc(s.quizAttempts.createdAt))
    : [];

  const steps = assignment ? await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, itemId)).orderBy(asc(s.assignmentSteps.position)) : [];
  const checks = steps.length
    ? await db.select().from(s.stepChecks).where(and(eq(s.stepChecks.userId, user.id), inArray(s.stepChecks.stepId, steps.map((x) => x.id))))
    : [];
  const [submission] = assignment
    ? await db.select().from(s.submissions).where(and(eq(s.submissions.userId, user.id), eq(s.submissions.assignmentItemId, itemId)))
    : [];

  const notes = await db.select().from(s.notes).where(and(eq(s.notes.userId, user.id), eq(s.notes.itemId, itemId))).orderBy(asc(s.notes.positionSec), asc(s.notes.createdAt));
  const [fav] = await db.select().from(s.favorites).where(and(eq(s.favorites.userId, user.id), eq(s.favorites.entityType, "item"), eq(s.favorites.entityId, itemId)));
  const [{ n: threadCount } = { n: 0 }] = await db.select({ n: count() }).from(s.threads).where(and(eq(s.threads.itemId, itemId), isNull(s.threads.deletedAt)));

  return {
    ...a,
    lesson: lesson ?? null,
    quiz: quiz ? { ...quiz, questions, attempts, attemptsLeft: attemptsLeft(quiz.maxAttempts, attempts.length) } : null,
    assignment: assignment ? { ...assignment, steps, checkedIds: new Set(checks.map((c) => c.stepId)), submission: submission ?? null } : null,
    notes,
    isFavorite: Boolean(fav),
    threadCount,
  };
}

/* ---------- Quiz ---------- */

export async function submitQuiz(user: U, itemId: string, answers: Record<string, number[]>) {
  const { ctx, item } = await mustAuthorize(user, itemId);
  const [quiz] = await db.select().from(s.quizzes).where(eq(s.quizzes.itemId, itemId));
  if (!quiz) throw new AccessError("זה לא מבדק");
  const [{ used } = { used: 0 }] = await db
    .select({ used: count() })
    .from(s.quizAttempts)
    .where(and(eq(s.quizAttempts.userId, user.id), eq(s.quizAttempts.quizItemId, itemId)));
  if (attemptsLeft(quiz.maxAttempts, used) === 0) throw new Error("נגמרו הניסיונות למבדק הזה");

  const qs = await db.select().from(s.questions).where(eq(s.questions.quizItemId, itemId)).orderBy(asc(s.questions.position));
  const result = gradeQuiz(
    qs.map((q) => ({ id: q.id, kind: q.kind, correct: q.correct, points: q.points, optionCount: q.options.length })),
    answers,
    quiz.passPct,
  );
  await db.insert(s.quizAttempts).values({ userId: user.id, quizItemId: itemId, answers, score: result.score, maxScore: result.maxScore, passed: result.passed });
  if (result.passed) await applyStatus(user.id, ctx.program.id, item, "done");
  else await touchItem(user, itemId);

  return {
    ...result,
    review: qs.map((q) => ({ id: q.id, correct: q.correct, explanation: q.explanation, ok: result.perQuestion[q.id] ?? false })),
    attemptsLeft: attemptsLeft(quiz.maxAttempts, used + 1),
  };
}

/* ---------- Assignments ---------- */

export async function toggleStep(user: U, itemId: string, stepId: string, checked: boolean) {
  const { ctx, item } = await mustAuthorize(user, itemId);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.itemId, itemId));
  const steps = await db.select({ id: s.assignmentSteps.id }).from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, itemId));
  if (!assignment || !steps.some((x) => x.id === stepId)) throw new AccessError();

  if (checked) await db.insert(s.stepChecks).values({ userId: user.id, stepId }).onConflictDoNothing();
  else await db.delete(s.stepChecks).where(and(eq(s.stepChecks.userId, user.id), eq(s.stepChecks.stepId, stepId)));

  const [{ n } = { n: 0 }] = await db
    .select({ n: count() })
    .from(s.stepChecks)
    .where(and(eq(s.stepChecks.userId, user.id), inArray(s.stepChecks.stepId, steps.map((x) => x.id))));
  const allDone = n === steps.length;
  // A checklist-only assignment is complete when every step is checked (PRD #15).
  if (!assignment.requiresSubmission) {
    if (allDone) await applyStatus(user.id, ctx.program.id, item, "done");
    else await touchItem(user, itemId);
  } else {
    await touchItem(user, itemId);
  }
  return { checked: n, total: steps.length };
}

export async function submitAssignment(user: U, itemId: string, input: { linkUrl: string | null; filePath: string | null; fileName: string | null; notes: string }) {
  await mustAuthorize(user, itemId);
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.itemId, itemId));
  if (!assignment?.requiresSubmission) throw new AccessError("המשימה הזו לא דורשת הגשה");
  const [prev] = await db.select().from(s.submissions).where(and(eq(s.submissions.userId, user.id), eq(s.submissions.assignmentItemId, itemId)));
  if (prev?.status === "approved") throw new Error("המשימה כבר אושרה");
  const now = new Date();
  const values = {
    linkUrl: input.linkUrl,
    filePath: input.filePath ?? prev?.filePath ?? null,
    fileName: input.fileName ?? prev?.fileName ?? null,
    notes: input.notes,
    status: "submitted" as const,
    updatedAt: now,
  };
  await db
    .insert(s.submissions)
    .values({ userId: user.id, assignmentItemId: itemId, ...values })
    .onConflictDoUpdate({ target: [s.submissions.userId, s.submissions.assignmentItemId], set: values });
  await touchItem(user, itemId);
  await notifyStaff("submission.new", "הגשה חדשה ממתינה לבדיקה", "/admin/reviews");
}

export async function reviewSubmission(reviewer: U, submissionId: string, decision: "approved" | "needs_changes", feedback: string) {
  if (!canReviewSubmissions(reviewer.role)) throw new AccessError("אין הרשאה");
  const [sub] = await db.select().from(s.submissions).where(eq(s.submissions.id, submissionId));
  if (!sub) throw new AccessError("ההגשה לא נמצאה");
  await db
    .update(s.submissions)
    .set({ status: decision, mentorFeedback: feedback, reviewedBy: reviewer.id, reviewedAt: new Date(), updatedAt: new Date() })
    .where(eq(s.submissions.id, submissionId));

  const owner = await authorizeItem({ id: sub.userId, role: "member" }, sub.assignmentItemId);
  if (decision === "approved" && owner) await applyStatus(sub.userId, owner.ctx.program.id, owner.item, "done");
  const href = owner ? `/learn/${owner.ctx.program.slug}/${sub.assignmentItemId}` : "/";
  await notify(sub.userId, "submission.reviewed", decision === "approved" ? "המשימה שלך אושרה 🎉" : "התקבל משוב על המשימה שלך", { href, email: true, body: feedback });
}

/* ---------- Notes ---------- */

export const NOTE_MAX = 5000;

export async function addNote(user: U, itemId: string, body: string, positionSec: number | null) {
  await mustAuthorize(user, itemId);
  const text = body.trim().slice(0, NOTE_MAX);
  if (!text) throw new Error("ההערה ריקה");
  await db.insert(s.notes).values({ userId: user.id, itemId, body: text, positionSec: positionSec == null ? null : Math.max(0, Math.floor(positionSec)) });
}

export async function updateNote(user: U, noteId: string, body: string) {
  const text = body.trim().slice(0, NOTE_MAX);
  if (!text) throw new Error("ההערה ריקה");
  await db.update(s.notes).set({ body: text, updatedAt: new Date() }).where(and(eq(s.notes.id, noteId), eq(s.notes.userId, user.id)));
}

export async function deleteNote(user: U, noteId: string) {
  await db.delete(s.notes).where(and(eq(s.notes.id, noteId), eq(s.notes.userId, user.id)));
}

export async function listAllNotes(userId: string) {
  return db
    .select({ note: s.notes, item: { id: s.items.id, title: s.items.title }, program: { slug: s.programs.slug, title: s.programs.title } })
    .from(s.notes)
    .innerJoin(s.items, eq(s.items.id, s.notes.itemId))
    .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
    .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
    .innerJoin(s.programs, eq(s.programs.id, s.units.programId))
    .where(eq(s.notes.userId, userId))
    .orderBy(desc(s.notes.updatedAt));
}

/* ---------- Favorites ---------- */

export async function toggleFavorite(user: U, itemId: string) {
  await mustAuthorize(user, itemId);
  const where = and(eq(s.favorites.userId, user.id), eq(s.favorites.entityType, "item"), eq(s.favorites.entityId, itemId));
  const [existing] = await db.select().from(s.favorites).where(where);
  if (existing) await db.delete(s.favorites).where(where);
  else await db.insert(s.favorites).values({ userId: user.id, entityType: "item", entityId: itemId });
  return !existing;
}
