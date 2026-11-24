import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { canAccessProgram, isStaff } from "@/lib/domain/authz";
import { computeStats, continueLearning, flattenOutline, unitItems, type FlatItem, type Stats } from "@/lib/domain/progress";
import { evaluateUnlock, type UnlockResult } from "@/lib/domain/unlock";
import type { OutlineUnit, ProgressMap, Role } from "@/lib/domain/types";

type U = { id: string; role: Role };

export type ProgramRow = typeof s.programs.$inferSelect;
export type CohortRow = typeof s.cohorts.$inferSelect;

/** Programs the user can see, with their active enrollment (if any). */
export async function listUserPrograms(user: U) {
  const enrolled = await db
    .select({ program: s.programs, cohort: s.cohorts, enrollment: s.enrollments })
    .from(s.enrollments)
    .innerJoin(s.cohorts, eq(s.cohorts.id, s.enrollments.cohortId))
    .innerJoin(s.programs, eq(s.programs.id, s.cohorts.programId))
    .where(and(eq(s.enrollments.userId, user.id), eq(s.enrollments.status, "active")))
    .orderBy(desc(s.enrollments.joinedAt));

  const byProgram = new Map(enrolled.map((r) => [r.program.id, r]));
  if (isStaff(user.role)) {
    const all = await db.select().from(s.programs).orderBy(asc(s.programs.title));
    return all.map((p) => byProgram.get(p.id) ?? { program: p, cohort: null, enrollment: null });
  }
  return enrolled.filter((r) => r.program.isPublished);
}

export async function loadOutline(programId: string, includeUnpublished: boolean): Promise<OutlineUnit[]> {
  const rows = await db
    .select({ unit: s.units, chapter: s.chapters, item: s.items })
    .from(s.units)
    .leftJoin(s.chapters, eq(s.chapters.unitId, s.units.id))
    .leftJoin(s.items, eq(s.items.chapterId, s.chapters.id))
    .where(eq(s.units.programId, programId))
    .orderBy(asc(s.units.position), asc(s.chapters.position), asc(s.items.position));

  const units = new Map<string, OutlineUnit>();
  for (const { unit, chapter, item } of rows) {
    let u = units.get(unit.id);
    if (!u) {
      u = { id: unit.id, title: unit.title, subtitle: unit.subtitle, position: unit.position, unlockRule: unit.unlockRule, chapters: [] };
      units.set(unit.id, u);
    }
    if (!chapter) continue;
    let c = u.chapters.find((x) => x.id === chapter.id);
    if (!c) {
      c = { id: chapter.id, title: chapter.title, position: chapter.position, items: [] };
      u.chapters.push(c);
    }
    if (item && (item.isPublished || includeUnpublished)) {
      c.items.push({ id: item.id, type: item.type, title: item.title, durationSec: item.durationSec, isRequired: item.isRequired, points: item.points, position: item.position });
    }
  }
  return [...units.values()];
}

export async function loadProgress(userId: string, itemIds: string[]): Promise<ProgressMap> {
  if (!itemIds.length) return new Map();
  const rows = await db.select().from(s.progress).where(and(eq(s.progress.userId, userId), inArray(s.progress.itemId, itemIds)));
  return new Map(rows.map((r) => [r.itemId, { status: r.status, positionSec: r.positionSec, watchedPct: r.watchedPct, lastSeenAt: r.lastSeenAt }]));
}

export type UnitState = {
  unit: OutlineUnit;
  stats: Stats;
  lock: UnlockResult;
  state: "done" | "in_progress" | "not_started" | "locked";
};

export type ProgramContext = {
  program: ProgramRow;
  cohort: CohortRow | null;
  joinedAt: Date | null;
  units: OutlineUnit[];
  flat: FlatItem[];
  progress: ProgressMap;
  unitStates: UnitState[];
  lockedItemIds: Set<string>;
  stats: Stats;
  next: FlatItem | null;
  points: number;
};

/** Everything a program-scoped page needs. Returns null when the user has no access. */
export async function getProgramContext(user: U, slug: string, now = new Date()): Promise<ProgramContext | null> {
  const [program] = await db.select().from(s.programs).where(eq(s.programs.slug, slug)).limit(1);
  if (!program) return null;
  const staff = isStaff(user.role);

  const [enr] = await db
    .select({ cohort: s.cohorts, enrollment: s.enrollments })
    .from(s.enrollments)
    .innerJoin(s.cohorts, eq(s.cohorts.id, s.enrollments.cohortId))
    .where(and(eq(s.enrollments.userId, user.id), eq(s.cohorts.programId, program.id), eq(s.enrollments.status, "active")))
    .orderBy(desc(s.enrollments.joinedAt))
    .limit(1);

  if (!canAccessProgram(user.role, Boolean(enr)) || (!program.isPublished && !staff)) return null;

  const units = await loadOutline(program.id, staff);
  const flat = flattenOutline(units);
  const progress = await loadProgress(user.id, flat.map((i) => i.id));

  const unitPct = new Map(units.map((u) => [u.id, computeStats(unitItems(u), progress).pct]));
  const lockedItemIds = new Set<string>();
  const unitStates: UnitState[] = units.map((u) => {
    const stats = computeStats(unitItems(u), progress);
    const lock: UnlockResult = staff
      ? { unlocked: true }
      : evaluateUnlock(u.unlockRule, {
          now,
          cohortStartsAt: enr?.cohort.startsAt ?? null,
          unitPct: (id) => unitPct.get(id) ?? 0,
          unitTitle: (id) => units.find((x) => x.id === id)?.title,
        });
    if (!lock.unlocked) for (const i of unitItems(u)) lockedItemIds.add(i.id);
    const anyTouched = unitItems(u).some((i) => progress.has(i.id));
    const state: UnitState["state"] = !lock.unlocked
      ? "locked"
      : stats.total > 0 && stats.done === stats.total
        ? "done"
        : anyTouched
          ? "in_progress"
          : "not_started";
    return { unit: u, stats, lock, state };
  });

  const [{ points } = { points: 0 }] = await db
    .select({ points: sql<number>`coalesce(sum(${s.pointsLedger.points}), 0)::int` })
    .from(s.pointsLedger)
    .where(and(eq(s.pointsLedger.userId, user.id), eq(s.pointsLedger.programId, program.id)));

  return {
    program,
    cohort: enr?.cohort ?? null,
    joinedAt: enr?.enrollment.joinedAt ?? null,
    units,
    flat,
    progress,
    unitStates,
    lockedItemIds,
    stats: computeStats(flat, progress),
    next: continueLearning(flat, progress, lockedItemIds),
    points,
  };
}

/** Which program does an item belong to? Used to authorize item-scoped mutations. */
export async function programOfItem(itemId: string) {
  const [row] = await db
    .select({ program: s.programs, item: s.items })
    .from(s.items)
    .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
    .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
    .innerJoin(s.programs, eq(s.programs.id, s.units.programId))
    .where(eq(s.items.id, itemId))
    .limit(1);
  return row ?? null;
}

/**
 * Authorizes access to a single item: the user must have program access and the item
 * must not be locked for them. Returns the program context for reuse.
 */
export async function authorizeItem(user: U, itemId: string) {
  const owner = await programOfItem(itemId);
  if (!owner) return null;
  const ctx = await getProgramContext(user, owner.program.slug);
  if (!ctx) return null;
  const flatItem = ctx.flat.find((i) => i.id === itemId);
  if (!flatItem || ctx.lockedItemIds.has(itemId)) return null;
  return { ctx, item: owner.item, flatItem };
}
