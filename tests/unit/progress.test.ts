import { describe, expect, it } from "vitest";
import { computeStats, continueLearning, flattenOutline, neighbours } from "@/lib/domain/progress";
import type { OutlineUnit, ProgressMap } from "@/lib/domain/types";

const item = (id: string, position: number, type: "video" | "quiz" = "video") => ({
  id, type, title: id, durationSec: 60, isRequired: true, points: 0, position,
});
const units: OutlineUnit[] = [
  { id: "u2", title: "U2", subtitle: "", position: 2, unlockRule: { type: "none" }, chapters: [{ id: "c3", title: "C3", position: 1, items: [item("e", 1), item("f", 2)] }] },
  {
    id: "u1", title: "U1", subtitle: "", position: 1, unlockRule: { type: "none" },
    chapters: [
      { id: "c2", title: "C2", position: 2, items: [item("d", 1, "quiz")] },
      { id: "c1", title: "C1", position: 1, items: [item("b", 2), item("a", 1), item("c", 3)] },
    ],
  },
];
const flat = flattenOutline(units);
const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m));
const p = (entries: [string, "in_progress" | "done" | "skipped", number][]): ProgressMap =>
  new Map(entries.map(([id, status, m]) => [id, { status, positionSec: 0, watchedPct: 0, lastSeenAt: at(m) }]));

describe("flattenOutline", () => {
  it("orders by unit, chapter, item position", () => {
    expect(flat.map((i) => i.id)).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(flat[3]).toMatchObject({ unitId: "u1", chapterId: "c2", chapterTitle: "C2" });
  });
});

describe("computeStats", () => {
  it("counts done per type and remaining time excluding done/skipped", () => {
    const s = computeStats(flat, p([["a", "done", 1], ["b", "skipped", 2], ["d", "done", 3]]));
    expect(s).toMatchObject({ total: 6, done: 2, pct: 33, remainingSec: 180 });
    expect(s.byType.quiz).toEqual({ total: 1, done: 1 });
    expect(s.byType.video).toEqual({ total: 5, done: 1 });
  });
  it("handles empty", () => expect(computeStats([], new Map()).pct).toBe(0));
});

describe("continueLearning", () => {
  it("starts at the first item with no progress", () => expect(continueLearning(flat, new Map())?.id).toBe("a"));
  it("returns the most recently seen unfinished item", () => {
    expect(continueLearning(flat, p([["a", "done", 1], ["c", "in_progress", 5], ["b", "in_progress", 3]]))?.id).toBe("c");
  });
  it("after finishing the last seen item, moves to the next unfinished one", () => {
    expect(continueLearning(flat, p([["b", "in_progress", 1], ["c", "done", 5]]))?.id).toBe("d");
  });
  it("wraps around to earlier unfinished items", () => {
    expect(continueLearning(flat, p([["a", "in_progress", 1], ["f", "done", 9]]))?.id).toBe("a");
  });
  it("skips locked items", () => {
    expect(continueLearning(flat, p([["d", "done", 1]]), new Set(["e", "f"]))?.id).toBe("a");
  });
  it("returns null when everything is finished", () => {
    expect(continueLearning(flat, p(flat.map((i, k) => [i.id, "done", k] as [string, "done", number])))).toBeNull();
  });
});

describe("neighbours", () => {
  it("finds prev/next skipping locked", () => {
    const n = neighbours(flat, "d", new Set(["e"]));
    expect(n.prev?.id).toBe("c");
    expect(n.next?.id).toBe("f");
  });
  it("handles edges and unknown ids", () => {
    expect(neighbours(flat, "a").prev).toBeNull();
    expect(neighbours(flat, "zz")).toEqual({ prev: null, next: null });
  });
});
