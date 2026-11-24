import type { ItemType, OutlineItem, OutlineUnit, ProgressMap } from "./types";

export type FlatItem = OutlineItem & { unitId: string; chapterId: string; chapterTitle: string; unitTitle: string };

/** All items in course order: unit → chapter → item, each by position. */
export function flattenOutline(units: OutlineUnit[]): FlatItem[] {
  const out: FlatItem[] = [];
  for (const u of [...units].sort((a, b) => a.position - b.position)) {
    for (const c of [...u.chapters].sort((a, b) => a.position - b.position)) {
      for (const i of [...c.items].sort((a, b) => a.position - b.position)) {
        out.push({ ...i, unitId: u.id, chapterId: c.id, chapterTitle: c.title, unitTitle: u.title });
      }
    }
  }
  return out;
}

export const isDone = (p: ProgressMap, itemId: string) => p.get(itemId)?.status === "done";
const isHandled = (p: ProgressMap, itemId: string) => {
  const s = p.get(itemId)?.status;
  return s === "done" || s === "skipped";
};

export type Stats = {
  total: number;
  done: number;
  pct: number;
  byType: Record<ItemType, { total: number; done: number }>;
  remainingSec: number;
};

export function computeStats(items: OutlineItem[], p: ProgressMap): Stats {
  const byType: Stats["byType"] = {
    video: { total: 0, done: 0 },
    text: { total: 0, done: 0 },
    quiz: { total: 0, done: 0 },
    assignment: { total: 0, done: 0 },
  };
  let done = 0;
  let remainingSec = 0;
  for (const i of items) {
    byType[i.type].total++;
    if (isDone(p, i.id)) {
      done++;
      byType[i.type].done++;
    } else if (!isHandled(p, i.id)) {
      remainingSec += i.durationSec;
    }
  }
  return { total: items.length, done, pct: items.length ? Math.round((done / items.length) * 100) : 0, byType, remainingSec };
}

export function unitItems(unit: OutlineUnit): OutlineItem[] {
  return unit.chapters.flatMap((c) => c.items);
}

/**
 * "Continue learning" (PRD #39): the most recently seen item that is not finished;
 * otherwise the first unfinished item after the most recently finished one;
 * otherwise the first unfinished item. Locked items are never returned.
 */
export function continueLearning(flat: FlatItem[], p: ProgressMap, locked: Set<string> = new Set()): FlatItem | null {
  const open = (i: FlatItem) => !locked.has(i.id) && !isHandled(p, i.id);
  const seen = flat
    .map((i, idx) => ({ i, idx, at: p.get(i.id)?.lastSeenAt?.getTime() ?? -1 }))
    .filter((x) => x.at >= 0)
    .sort((a, b) => b.at - a.at);

  const lastOpen = seen.find((x) => open(x.i));
  const lastAny = seen[0];
  if (lastOpen && (!lastAny || lastOpen.at >= lastAny.at)) return lastOpen.i;

  if (lastAny) {
    for (let k = 1; k <= flat.length; k++) {
      const cand = flat[(lastAny.idx + k) % flat.length]!;
      if (open(cand)) return cand;
    }
    return null;
  }
  return flat.find(open) ?? null;
}

/** Neighbours for prev/next navigation, skipping locked items. */
export function neighbours(flat: FlatItem[], itemId: string, locked: Set<string> = new Set()) {
  const idx = flat.findIndex((i) => i.id === itemId);
  if (idx < 0) return { prev: null, next: null };
  let prev: FlatItem | null = null;
  let next: FlatItem | null = null;
  for (let k = idx - 1; k >= 0; k--) if (!locked.has(flat[k]!.id)) { prev = flat[k]!; break; }
  for (let k = idx + 1; k < flat.length; k++) if (!locked.has(flat[k]!.id)) { next = flat[k]!; break; }
  return { prev, next };
}
