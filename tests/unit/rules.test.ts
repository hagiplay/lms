import { describe, expect, it } from "vitest";
import { evaluateUnlock } from "@/lib/domain/unlock";
import { attemptsLeft, gradeQuiz } from "@/lib/domain/quiz";
import { evaluateCertificate } from "@/lib/domain/certificate";
import { atLeast, canAcceptAnswer, canAccessProgram, canDeletePost, canManageContent, canReviewSubmissions } from "@/lib/domain/authz";

const now = new Date("2026-11-24T10:00:00Z");
const ctx = { now, cohortStartsAt: new Date("2026-11-01T00:00:00Z"), unitPct: (id: string) => (id === "u1" ? 80 : 0), unitTitle: () => "יסודות" };

describe("evaluateUnlock", () => {
  it("none", () => expect(evaluateUnlock({ type: "none" }, ctx).unlocked).toBe(true));
  it("date in future/past", () => {
    const r = evaluateUnlock({ type: "date", at: "2026-12-01T00:00:00Z" }, ctx);
    expect(r).toMatchObject({ unlocked: false, opensAt: new Date("2026-12-01T00:00:00Z") });
    expect(evaluateUnlock({ type: "date", at: "2026-11-01T00:00:00Z" }, ctx).unlocked).toBe(true);
  });
  it("invalid date fails open rather than locking content forever", () =>
    expect(evaluateUnlock({ type: "date", at: "garbage" }, ctx).unlocked).toBe(true));
  it("cohort offset", () => {
    expect(evaluateUnlock({ type: "cohort_offset_days", days: 20 }, ctx).unlocked).toBe(true);
    const r = evaluateUnlock({ type: "cohort_offset_days", days: 30 }, ctx);
    expect(r).toMatchObject({ unlocked: false, opensAt: new Date("2026-12-01T00:00:00Z") });
  });
  it("prerequisite", () => {
    expect(evaluateUnlock({ type: "prerequisite", unitId: "u1", minPct: 80 }, ctx).unlocked).toBe(true);
    const r = evaluateUnlock({ type: "prerequisite", unitId: "u2", minPct: 50 }, ctx);
    expect(r.unlocked).toBe(false);
    if (!r.unlocked) expect(r.reason).toContain("יסודות");
  });
});

describe("gradeQuiz", () => {
  const qs = [
    { id: "q1", kind: "single" as const, correct: [1], points: 1, optionCount: 4 },
    { id: "q2", kind: "multiple" as const, correct: [0, 2], points: 2, optionCount: 4 },
    { id: "q3", kind: "single" as const, correct: [3], points: 1, optionCount: 4 },
  ];
  it("scores exact sets, all-or-nothing", () => {
    const r = gradeQuiz(qs, { q1: [1], q2: [2, 0], q3: [0] }, 70);
    expect(r).toMatchObject({ score: 3, maxScore: 4, pct: 75, passed: true });
    expect(r.perQuestion).toEqual({ q1: true, q2: true, q3: false });
  });
  it("partial multiple answer is wrong", () => expect(gradeQuiz(qs, { q2: [0] }, 70).perQuestion.q2).toBe(false));
  it("ignores out-of-range and only first answer for single", () => {
    expect(gradeQuiz(qs, { q1: [9, 1] }, 0).perQuestion.q1).toBe(true);
    expect(gradeQuiz(qs, { q1: [0, 1] }, 0).perQuestion.q1).toBe(false);
  });
  it("empty quiz never passes", () => expect(gradeQuiz([], {}, 0).passed).toBe(false));
  it("attemptsLeft", () => {
    expect(attemptsLeft(null, 5)).toBeNull();
    expect(attemptsLeft(3, 1)).toBe(2);
    expect(attemptsLeft(1, 4)).toBe(0);
  });
});

describe("evaluateCertificate", () => {
  const base = {
    points: 90, doneItemIds: new Set(["a", "cap"]), requiredItemIds: ["a", "b"], itemTitle: () => "משימת סיום",
    joinedAt: new Date("2026-11-20T00:00:00Z"), now,
  };
  it("lists each criterion and requires all", () => {
    const r = evaluateCertificate({ minPoints: 100, requireAllRequiredItems: true, requiredItemIds: ["cap"], minDaysSinceJoin: 3 }, base);
    expect(r.criteria.map((c) => [c.key, c.met])).toEqual([["points", false], ["required", false], ["item:cap", true], ["days", true]]);
    expect(r.eligible).toBe(false);
  });
  it("eligible when all met", () => {
    const r = evaluateCertificate({ minPoints: 50, requiredItemIds: ["cap"] }, base);
    expect(r.eligible).toBe(true);
  });
  it("no rules means no certificate (never auto-eligible)", () => expect(evaluateCertificate({}, base).eligible).toBe(false));
});

describe("authz", () => {
  it("role ladder", () => {
    expect(atLeast("owner", "admin")).toBe(true);
    expect(atLeast("mentor", "admin")).toBe(false);
    expect(canManageContent("mentor")).toBe(false);
    expect(canManageContent("admin")).toBe(true);
    expect(canReviewSubmissions("mentor")).toBe(true);
    expect(canReviewSubmissions("member")).toBe(false);
  });
  it("program access", () => {
    expect(canAccessProgram("member", false)).toBe(false);
    expect(canAccessProgram("member", true)).toBe(true);
    expect(canAccessProgram("mentor", false)).toBe(true);
  });
  it("discussion", () => {
    expect(canAcceptAnswer("member", "u1", "u1")).toBe(true);
    expect(canAcceptAnswer("member", "u2", "u1")).toBe(false);
    expect(canAcceptAnswer("mentor", "u2", "u1")).toBe(true);
    expect(canDeletePost("member", "u2", "u1")).toBe(false);
    expect(canDeletePost("admin", "u2", "u1")).toBe(true);
  });
});
