import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, schema as s, sql } from "@/db";
import { seed } from "@/db/seed-data";
import { authorizeItem, getProgramContext, listUserPrograms } from "@/lib/data/programs";
import { getItemDetails, recordPosition, reviewSubmission, setItemStatus, submitAssignment, submitQuiz, toggleStep } from "@/lib/data/learning";
import { certificateStatus, issueCertificate, verifyCertificate } from "@/lib/data/certificates";
import { acceptAnswer, createThread, listThreads, reply } from "@/lib/data/discussion";
import { processPaymentEvent } from "@/lib/data/payments";
import { search } from "@/lib/data/search";
import { pastEvents, upcomingEvents } from "@/lib/data/events";
import { listNotifications, unreadCount } from "@/lib/data/notifications";
import { deleteAccount } from "@/lib/data/profile";

let S: Awaited<ReturnType<typeof seed>>;
beforeEach(async () => {
  S = await seed(db);
});
afterAll(async () => {
  await sql.end();
});

const answersFor = async (itemId: string, right: boolean) => {
  const qs = await db.select().from(s.questions).where(eq(s.questions.quizItemId, itemId));
  return Object.fromEntries(qs.map((q) => [q.id, right ? q.correct : [(q.correct[0]! + 1) % q.options.length]]));
};

describe("program context", () => {
  it("member: unit 2 unlocked by prerequisite, unit 3 locked by cohort offset, continue = in-progress lesson", async () => {
    const ctx = (await getProgramContext(S.users.member, "ai-automations"))!;
    expect(ctx.unitStates.map((u) => u.state)).toEqual(["in_progress", "not_started", "locked"]);
    expect(ctx.next?.id).toBe(S.items.v15.id);
    expect(ctx.points).toBe(10);
    expect(ctx.stats).toMatchObject({ total: 9, done: 4 });
  });
  it("new member: unit 2 locked until 50% of unit 1", async () => {
    const ctx = (await getProgramContext(S.users.member2, "ai-automations"))!;
    expect(ctx.unitStates[1]!.state).toBe("locked");
    expect(ctx.next?.id).toBe(S.items.v11.id);
    expect(await authorizeItem(S.users.member2, S.items.v21.id)).toBeNull();
  });
  it("staff bypass locks; outsiders get nothing", async () => {
    const ctx = (await getProgramContext(S.users.mentor, "ai-automations"))!;
    expect(ctx.lockedItemIds.size).toBe(0);
    const [outsider] = await db.insert(s.users).values({ email: "x@example.com" }).returning();
    expect(await getProgramContext(outsider!, "ai-automations")).toBeNull();
    expect(await listUserPrograms(outsider!)).toEqual([]);
    expect(await getItemDetails(outsider!, S.items.v11.id)).toBeNull();
  });
});

describe("items", () => {
  it("quiz details never leak answers", async () => {
    const d = (await getItemDetails(S.users.member2, S.items.q13.id))!;
    expect(d.quiz!.questions[0]).not.toHaveProperty("correct");
    expect(d.quiz!.questions[0]).not.toHaveProperty("explanation");
  });
  it("failed quiz keeps item open, passing awards points once", async () => {
    const u = S.users.member2;
    const bad = await submitQuiz(u, S.items.q13.id, await answersFor(S.items.q13.id, false));
    expect(bad.passed).toBe(false);
    expect(bad.review[0]!.explanation).toBeTruthy();
    const good = await submitQuiz(u, S.items.q13.id, await answersFor(S.items.q13.id, true));
    expect(good).toMatchObject({ passed: true, pct: 100 });
    await submitQuiz(u, S.items.q13.id, await answersFor(S.items.q13.id, true));
    const ledger = await db.select().from(s.pointsLedger).where(eq(s.pointsLedger.userId, u.id));
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.points).toBe(10);
  });
  it("max attempts enforced", async () => {
    const u = S.users.member;
    for (let i = 0; i < 3; i++) await submitQuiz(u, S.items.q22.id, await answersFor(S.items.q22.id, false));
    await expect(submitQuiz(u, S.items.q22.id, {})).rejects.toThrow("נגמרו");
  });
  it("checklist assignment completes when all steps are checked, and un-checking does not revoke points", async () => {
    const u = S.users.member;
    const steps = await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, S.items.a16.id));
    for (const st of steps) await toggleStep(u, S.items.a16.id, st.id, true);
    const [p] = await db.select().from(s.progress).where(and(eq(s.progress.userId, u.id), eq(s.progress.itemId, S.items.a16.id)));
    expect(p!.status).toBe("done");
    expect((await getProgramContext(u, "ai-automations"))!.points).toBe(20);
  });
  it("rejects steps from another assignment", async () => {
    const [other] = await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, S.items.a31.id));
    await expect(toggleStep(S.users.member, S.items.a16.id, other!.id, true)).rejects.toThrow();
  });
  it("position beacon clamps and computes percent", async () => {
    await recordPosition(S.users.member, S.items.v15.id, 270, 540);
    const [p] = await db.select().from(s.progress).where(and(eq(s.progress.userId, S.users.member.id), eq(s.progress.itemId, S.items.v15.id)));
    expect(p).toMatchObject({ positionSec: 270, watchedPct: 50, status: "in_progress" });
  });
});

describe("capstone review + certificate", () => {
  it("submission → mentor approval → done → certificate issued once → public verify", async () => {
    await db.update(s.cohorts).set({ startsAt: new Date(Date.now() - 40 * 86_400_000) }).where(eq(s.cohorts.id, S.cohort.id));
    const u = { ...S.users.member };
    await expect(submitAssignment(u, S.items.a16.id, { linkUrl: null, filePath: null, fileName: null, notes: "" })).rejects.toThrow("לא דורשת");
    await submitAssignment(u, S.items.a31.id, { linkUrl: "https://example.com/demo", filePath: null, fileName: null, notes: "הנה" });
    const [sub] = await db.select().from(s.submissions).where(eq(s.submissions.userId, u.id));
    await expect(reviewSubmission(S.users.member2, sub!.id, "approved", "")).rejects.toThrow();
    await reviewSubmission(S.users.mentor, sub!.id, "approved", "מצוין");
    expect((await listNotifications(u.id))[0]!.title).toContain("אושרה");

    let ctx = (await getProgramContext(u, "ai-automations"))!;
    expect(certificateStatus(ctx).eligible).toBe(false);
    for (const i of ctx.flat) if (i.type !== "quiz" && i.type !== "assignment") await setItemStatus(u, i.id, "done");
    await submitQuiz(u, S.items.q22.id, await answersFor(S.items.q22.id, true));
    const steps = await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, S.items.a16.id));
    for (const st of steps) await toggleStep(u, S.items.a16.id, st.id, true);
    ctx = (await getProgramContext(u, "ai-automations"))!;
    const status = certificateStatus(ctx);
    expect(status.criteria.every((c) => c.met)).toBe(true);
    const c1 = await issueCertificate(u, ctx);
    const c2 = await issueCertificate(u, ctx);
    expect(c2.id).toBe(c1.id);
    const v = await verifyCertificate(c1.verifyCode.toLowerCase());
    expect(v?.program.title).toBe("אוטומציות AI מאפס");
    expect(v?.certificate.recipientName).toBe("נועה כהן");
  });
  it("cannot issue when not eligible", async () => {
    const ctx = (await getProgramContext(S.users.member2, "ai-automations"))!;
    await expect(issueCertificate(S.users.member2, ctx)).rejects.toThrow("עוד לא");
  });
});

describe("discussion", () => {
  it("reply notifies the author; only author or staff accept; accepted answer persists", async () => {
    await createThread(S.users.member, S.items.v11.id, "question", "שאלה?", 42);
    let threads = await listThreads(S.users.member, S.items.v11.id);
    const t = threads[0]!.thread;
    expect(t.videoSec).toBe(42);
    await reply({ ...S.users.member2 }, t.id, "תשובה");
    expect(await unreadCount(S.users.member.id)).toBe(3);
    threads = await listThreads(S.users.member, S.items.v11.id);
    const m = threads[0]!.replies[0]!.message;
    await expect(acceptAnswer(S.users.member2, t.id, m.id)).rejects.toThrow("אין הרשאה");
    await acceptAnswer(S.users.member, t.id, m.id);
    threads = await listThreads(S.users.member, S.items.v11.id);
    expect(threads[0]!.thread.acceptedMessageId).toBe(m.id);
  });
  it("cannot post on a locked item", async () => {
    await expect(createThread(S.users.member2, S.items.v21.id, "question", "x", null)).rejects.toThrow();
  });
});

describe("payments webhook", () => {
  it("creates user + enrollment, is idempotent, and refunds revoke access", async () => {
    const ev = { id: "pay_1", type: "payment.succeeded" as const, email: "Buyer@Example.com", firstName: "ליה", lastName: "רז", programSlug: "ai-automations" };
    const r = await processPaymentEvent("test", ev);
    expect(r.status).toBe("ok");
    expect((await processPaymentEvent("test", ev)).status).toBe("duplicate");
    const [u] = await db.select().from(s.users).where(eq(s.users.email, "buyer@example.com"));
    expect(await getProgramContext(u!, "ai-automations")).not.toBeNull();
    await processPaymentEvent("test", { ...ev, id: "pay_1_refund", type: "payment.refunded" });
    expect(await getProgramContext(u!, "ai-automations")).toBeNull();
  });
  it("unknown program records the error and throws", async () => {
    await expect(processPaymentEvent("test", { id: "p2", type: "payment.succeeded", email: "a@b.co", firstName: "", lastName: "", programSlug: "nope" })).rejects.toThrow();
    const [rec] = await db.select().from(s.paymentEvents).where(eq(s.paymentEvents.externalId, "p2"));
    expect(rec!.error).toContain("cohort");
    expect(rec!.processedAt).toBeNull();
  });
});

describe("search & events", () => {
  it("finds Hebrew substrings in titles and transcripts, scoped to the user's programs", async () => {
    const hits = await search(S.users.member, "webhook");
    expect(hits.some((h) => h.kind === "item" && h.title.includes("Webhook"))).toBe(true);
    const t = await search(S.users.member, "בית קפה");
    expect(t.some((h) => h.kind === "transcript" && h.snippet?.includes("בית קפה"))).toBe(true);
    const [outsider] = await db.insert(s.users).values({ email: "y@example.com" }).returning();
    expect(await search(outsider!, "webhook")).toEqual([]);
    expect(await search(S.users.member, "%")).toEqual([]);
  });
  it("events scoped to the user's cohorts", async () => {
    expect((await upcomingEvents(S.users.member)).map((e) => e.title)).toEqual(["מפגש שאלות ותשובות", "סדנת סוכנים"]);
    expect((await pastEvents(S.users.member)).map((e) => e.title)).toEqual(["מפגש פתיחה"]);
    expect(await pastEvents(S.users.member, "סדנה")).toEqual([]);
    const [outsider] = await db.insert(s.users).values({ email: "z@example.com" }).returning();
    expect(await upcomingEvents(outsider!)).toEqual([]);
  });
});

describe("account deletion", () => {
  it("wipes personal data and tombstones the user", async () => {
    await deleteAccount({ id: S.users.member.id, authId: null });
    const [u] = await db.select().from(s.users).where(eq(s.users.id, S.users.member.id));
    expect(u!.deletedAt).not.toBeNull();
    expect(u!.email).toMatch(/^deleted\+/);
    expect(await db.select().from(s.notes).where(eq(s.notes.userId, S.users.member.id))).toEqual([]);
  });
});
