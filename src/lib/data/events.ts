import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { isStaff } from "@/lib/domain/authz";
import type { Role } from "@/lib/domain/types";

type U = { id: string; role: Role };

async function cohortScope(user: U) {
  if (isStaff(user.role)) return null; // staff see all
  const rows = await db
    .select({ id: s.enrollments.cohortId })
    .from(s.enrollments)
    .where(and(eq(s.enrollments.userId, user.id), eq(s.enrollments.status, "active")));
  return rows.map((r) => r.id);
}

function scopeWhere(cohorts: string[] | null) {
  if (cohorts === null) return undefined;
  return cohorts.length ? or(isNull(s.events.cohortId), inArray(s.events.cohortId, cohorts)) : isNull(s.events.cohortId);
}

export async function upcomingEvents(user: U, now = new Date(), limit = 20) {
  const scope = scopeWhere(await cohortScope(user));
  return db.select().from(s.events).where(and(gte(s.events.endsAt, now), scope)).orderBy(asc(s.events.startsAt)).limit(limit);
}

export async function pastEvents(user: U, q = "", now = new Date()) {
  const scope = scopeWhere(await cohortScope(user));
  const text = q.trim() ? or(ilike(s.events.title, `%${q.trim()}%`), ilike(s.events.description, `%${q.trim()}%`), ilike(s.events.category, `%${q.trim()}%`)) : undefined;
  return db.select().from(s.events).where(and(lt(s.events.endsAt, now), scope, text)).orderBy(desc(s.events.startsAt)).limit(100);
}

export async function getEventForUser(user: U, id: string) {
  const scope = scopeWhere(await cohortScope(user));
  const [e] = await db.select().from(s.events).where(and(eq(s.events.id, id), scope));
  return e ?? null;
}
