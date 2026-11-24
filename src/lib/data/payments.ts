import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { PaymentEvent } from "@/lib/domain/webhook";
import { notify } from "./notifications";

/** Idempotent: the same (provider, id) is processed once. */
export async function processPaymentEvent(provider: string, ev: PaymentEvent) {
  const [rec] = await db
    .insert(s.paymentEvents)
    .values({ provider, externalId: ev.id, payload: ev })
    .onConflictDoNothing()
    .returning();
  if (!rec) {
    const [prev] = await db.select().from(s.paymentEvents).where(and(eq(s.paymentEvents.provider, provider), eq(s.paymentEvents.externalId, ev.id)));
    if (prev?.processedAt) return { status: "duplicate" as const };
  }
  const recordId = rec?.id;
  try {
    const cohort = await resolveCohort(ev);
    if (!cohort) throw new Error("cohort not found");

    let [user] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = lower(${ev.email})`).limit(1);
    if (!user) {
      [user] = await db.insert(s.users).values({ email: ev.email.toLowerCase(), firstName: ev.firstName, lastName: ev.lastName }).returning();
    }
    if (!user) throw new Error("user create failed");

    const status = ev.type === "payment.succeeded" ? "active" : "refunded";
    await db
      .insert(s.enrollments)
      .values({ userId: user.id, cohortId: cohort.id, status, paymentRef: `${provider}:${ev.id}` })
      .onConflictDoUpdate({ target: [s.enrollments.userId, s.enrollments.cohortId], set: { status, paymentRef: `${provider}:${ev.id}` } });

    if (status === "active") await notify(user.id, "enrollment.created", "ברוכים הבאים! הגישה לתוכנית נפתחה", { href: "/", email: true, body: "אפשר להתחיל ללמוד עכשיו." });
    if (recordId) await db.update(s.paymentEvents).set({ processedAt: new Date(), error: null }).where(eq(s.paymentEvents.id, recordId));
    else await db.update(s.paymentEvents).set({ processedAt: new Date(), error: null }).where(and(eq(s.paymentEvents.provider, provider), eq(s.paymentEvents.externalId, ev.id)));
    return { status: "ok" as const, userId: user.id, cohortId: cohort.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(s.paymentEvents).set({ error: msg }).where(and(eq(s.paymentEvents.provider, provider), eq(s.paymentEvents.externalId, ev.id)));
    throw e;
  }
}

async function resolveCohort(ev: PaymentEvent) {
  if (ev.cohortId) {
    const [c] = await db.select().from(s.cohorts).where(eq(s.cohorts.id, ev.cohortId));
    return c ?? null;
  }
  const [p] = await db.select().from(s.programs).where(eq(s.programs.slug, ev.programSlug!));
  if (!p) return null;
  // Prefer an evergreen cohort, otherwise the most recently started one.
  const [c] = await db.select().from(s.cohorts).where(eq(s.cohorts.programId, p.id)).orderBy(desc(s.cohorts.isEvergreen), desc(s.cohorts.startsAt), asc(s.cohorts.createdAt)).limit(1);
  return c ?? null;
}
