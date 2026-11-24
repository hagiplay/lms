"use server";

import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { and, eq, max, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { actionUser } from "@/lib/auth/session";
import { reviewSubmission } from "@/lib/data/learning";
import { notify } from "@/lib/data/notifications";
import { israelLocalToDate } from "@/lib/domain/format";
import type { CertificateRules, UnlockRule } from "@/lib/domain/types";

/* ---------- helpers ---------- */

export type AdminState = { ok?: boolean; error?: string };

/** Server-action errors are redacted in production, so return the message instead of throwing. */
async function guard(fn: () => Promise<void>): Promise<AdminState> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    unstable_rethrow(e); // let redirect()/notFound() through
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "נתונים לא תקינים" };
    return { error: e instanceof Error ? e.message : "הפעולה נכשלה" };
  }
}

const str = (f: FormData, k: string, maxLen = 10_000) => String(f.get(k) ?? "").trim().slice(0, maxLen);
const optStr = (f: FormData, k: string) => str(f, k) || null;
const int = (f: FormData, k: string, def = 0) => {
  const n = Number.parseInt(String(f.get(k) ?? ""), 10);
  return Number.isFinite(n) ? n : def;
};
const optInt = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  if (!v) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "1" || f.get(k) === "true";
const id = (f: FormData, k: string) => z.string().uuid().parse(f.get(k));
const httpUrl = (v: string | null) => {
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) throw new Error("קישור חייב להתחיל ב-http או https");
  return v;
};

async function admin() {
  return actionUser("admin");
}
function done(path?: string) {
  revalidatePath("/", "layout");
  if (path) redirect(path);
}

async function nextPosition(table: typeof s.units | typeof s.chapters | typeof s.items, where: ReturnType<typeof eq>) {
  const [r] = await db.select({ m: max(table.position) }).from(table).where(where);
  return (r?.m ?? 0) + 1;
}

/** "m:ss label" or "h:mm:ss label" per line → timestamps. */
function parseTimestamps(text: string) {
  const out: { sec: number; label: string }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^(\d{1,2}:)?(\d{1,2}):(\d{2})\s+(.+)$/.exec(line);
    if (!m) throw new Error(`שורת ציר זמן לא תקינה: "${line}" (פורמט: 1:30 כותרת)`);
    const h = m[1] ? Number(m[1].slice(0, -1)) : 0;
    out.push({ sec: h * 3600 + Number(m[2]) * 60 + Number(m[3]), label: m[4]!.slice(0, 200) });
  }
  return out.sort((a, b) => a.sec - b.sec);
}

/* ---------- programs & cohorts ---------- */

export async function createProgram(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const slug = str(form, "slug", 80).toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) throw new Error("slug: אותיות באנגלית, ספרות ומקפים בלבד");
    const [p] = await db.insert(s.programs).values({ slug, title: str(form, "title", 200) || slug }).returning();
    done(`/admin/programs/${p!.id}`);
  });
}

export async function updateProgram(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const programId = id(form, "id");
    const slug = str(form, "slug", 80).toLowerCase();
    if (!/^[a-z0-9-]{2,80}$/.test(slug)) throw new Error("slug לא תקין");
    const rules: CertificateRules = {
      minPoints: optInt(form, "minPoints") ?? undefined,
      requireAllRequiredItems: bool(form, "requireAllRequiredItems"),
      minDaysSinceJoin: optInt(form, "minDaysSinceJoin") ?? undefined,
      requiredItemIds: form.getAll("requiredItemIds").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v)),
    };
    await db
      .update(s.programs)
      .set({
        slug,
        title: str(form, "title", 200),
        subtitle: str(form, "subtitle", 300),
        isPublished: bool(form, "isPublished"),
        priceAgorot: Math.max(0, Math.round(Number(str(form, "priceShekels") || "0") * 100)),
        certificateRules: rules,
      })
      .where(eq(s.programs.id, programId));
    done();
  });
}

export async function createCohort(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const startsAt = israelLocalToDate(str(form, "startsAt"));
    if (Number.isNaN(startsAt.getTime())) throw new Error("תאריך התחלה לא תקין");
    await db.insert(s.cohorts).values({
      programId: id(form, "programId"),
      title: str(form, "title", 120) || "מחזור",
      startsAt,
      isEvergreen: bool(form, "isEvergreen"),
      zoomUrl: httpUrl(optStr(form, "zoomUrl")),
      whatsappUrl: httpUrl(optStr(form, "whatsappUrl")),
    });
    done();
  });
}

export async function deleteCohort(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.delete(s.cohorts).where(eq(s.cohorts.id, id(form, "id")));
    done();
  });
}

/* ---------- units / chapters / items ---------- */

function unlockFromForm(form: FormData): UnlockRule {
  switch (str(form, "unlockType")) {
    case "date": {
      const at = israelLocalToDate(str(form, "unlockDate"));
      if (Number.isNaN(at.getTime())) throw new Error("תאריך פתיחה לא תקין");
      return { type: "date", at: at.toISOString() };
    }
    case "cohort_offset_days":
      return { type: "cohort_offset_days", days: Math.max(0, int(form, "unlockDays")) };
    case "prerequisite":
      return { type: "prerequisite", unitId: id(form, "unlockUnitId"), minPct: Math.min(100, Math.max(1, int(form, "unlockPct", 100))) };
    default:
      return { type: "none" };
  }
}

export async function saveUnit(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const programId = id(form, "programId");
    const values = { title: str(form, "title", 200), subtitle: str(form, "subtitle", 300), unlockRule: unlockFromForm(form) };
    const unitId = optStr(form, "id");
    if (unitId) await db.update(s.units).set({ ...values, position: int(form, "position", 1) }).where(eq(s.units.id, z.string().uuid().parse(unitId)));
    else await db.insert(s.units).values({ ...values, programId, position: await nextPosition(s.units, eq(s.units.programId, programId)) });
    done();
  });
}

export async function deleteUnit(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.delete(s.units).where(eq(s.units.id, id(form, "id")));
    done();
  });
}

export async function saveChapter(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const chapterId = optStr(form, "id");
    if (chapterId) await db.update(s.chapters).set({ title: str(form, "title", 200), position: int(form, "position", 1) }).where(eq(s.chapters.id, z.string().uuid().parse(chapterId)));
    else {
      const unitId = id(form, "unitId");
      await db.insert(s.chapters).values({ unitId, title: str(form, "title", 200), position: await nextPosition(s.chapters, eq(s.chapters.unitId, unitId)) });
    }
    done();
  });
}

export async function deleteChapter(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.delete(s.chapters).where(eq(s.chapters.id, id(form, "id")));
    done();
  });
}

export async function createItem(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const chapterId = id(form, "chapterId");
    const type = z.enum(["video", "text", "quiz", "assignment"]).parse(form.get("type"));
    const [item] = await db
      .insert(s.items)
      .values({ chapterId, type, title: str(form, "title", 200) || "פריט חדש", position: await nextPosition(s.items, eq(s.items.chapterId, chapterId)), isPublished: false })
      .returning();
    if (type === "video" || type === "text") await db.insert(s.lessonContents).values({ itemId: item!.id });
    if (type === "quiz") await db.insert(s.quizzes).values({ itemId: item!.id });
    if (type === "assignment") await db.insert(s.assignments).values({ itemId: item!.id });
    done(`/admin/items/${item!.id}`);
  });
}

export async function updateItem(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const itemId = id(form, "id");
    const [item] = await db.select().from(s.items).where(eq(s.items.id, itemId));
    if (!item) throw new Error("לא נמצא");
    const updateNote = optStr(form, "updateNote");
    const wasPublished = item.isPublished;
    const isPublished = bool(form, "isPublished");
    await db
      .update(s.items)
      .set({
        title: str(form, "title", 200),
        position: int(form, "position", item.position),
        durationSec: Math.max(0, Math.round(Number(str(form, "durationMin") || "0") * 60)),
        points: Math.max(0, int(form, "points")),
        isRequired: bool(form, "isRequired"),
        isPublished,
        updateNote,
        updatedAt: updateNote && updateNote !== item.updateNote ? new Date() : item.updatedAt,
      })
      .where(eq(s.items.id, itemId));

    if (item.type === "video" || item.type === "text") {
      const provider = z.enum(["none", "bunny", "url"]).parse(form.get("videoProvider") ?? "none");
      const ref = optStr(form, "videoRef");
      if (provider === "url") httpUrl(ref);
      const attachments = str(form, "attachments")
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [name, url, size, mime] = l.split("|").map((x) => x.trim());
          if (!name || !url) throw new Error(`שורת קובץ לא תקינה: "${l}" (פורמט: שם|קישור|גודל בבתים|סוג)`);
          if (!/^(https?:\/\/|\/)/.test(url)) throw new Error("קישור לקובץ חייב להיות https או נתיב יחסי");
          return { name, url, sizeBytes: Number(size) || 0, mime: mime || "application/pdf" };
        });
      await db
        .update(s.lessonContents)
        .set({ videoProvider: provider, videoRef: ref, overviewMd: str(form, "overviewMd", 50_000), transcript: str(form, "transcript", 500_000), timestamps: parseTimestamps(str(form, "timestamps")), attachments })
        .where(eq(s.lessonContents.itemId, itemId));
    }
    if (item.type === "quiz") {
      await db.update(s.quizzes).set({ introMd: str(form, "introMd"), passPct: Math.min(100, Math.max(0, int(form, "passPct", 70))), timeLimitSec: optInt(form, "timeLimitMin") ? optInt(form, "timeLimitMin")! * 60 : null, maxAttempts: optInt(form, "maxAttempts") }).where(eq(s.quizzes.itemId, itemId));
    }
    if (item.type === "assignment") {
      await db.update(s.assignments).set({ briefMd: str(form, "briefMd", 50_000), estMinutes: Math.max(0, int(form, "estMinutes")), requiresSubmission: bool(form, "requiresSubmission") }).where(eq(s.assignments.itemId, itemId));
      // Steps: one per line. Existing steps keep their ids (and student check-marks) when text matches by position.
      const lines = str(form, "steps", 50_000).split("\n").map((l) => l.trim()).filter(Boolean);
      const existing = await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, itemId));
      const byPos = new Map(existing.map((e) => [e.position, e]));
      for (let i = 0; i < lines.length; i++) {
        const e = byPos.get(i + 1);
        if (e) await db.update(s.assignmentSteps).set({ text: lines[i]! }).where(eq(s.assignmentSteps.id, e.id));
        else await db.insert(s.assignmentSteps).values({ assignmentItemId: itemId, position: i + 1, text: lines[i]! });
      }
      for (const e of existing) if (e.position > lines.length) await db.delete(s.assignmentSteps).where(eq(s.assignmentSteps.id, e.id));
    }

    // "New lesson" notification to enrolled members on first publish (PRD A FR-32).
    if (!wasPublished && isPublished && bool(form, "notifyMembers")) {
      const rows = await db
        .select({ userId: s.enrollments.userId, slug: s.programs.slug })
        .from(s.items)
        .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
        .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
        .innerJoin(s.programs, eq(s.programs.id, s.units.programId))
        .innerJoin(s.cohorts, eq(s.cohorts.programId, s.programs.id))
        .innerJoin(s.enrollments, and(eq(s.enrollments.cohortId, s.cohorts.id), eq(s.enrollments.status, "active")))
        .where(eq(s.items.id, itemId));
      const seen = new Set<string>();
      for (const r of rows) {
        if (seen.has(r.userId)) continue;
        seen.add(r.userId);
        await notify(r.userId, "lesson.new", `שיעור חדש נוסף: ${str(form, "title", 200)}`, { href: `/learn/${r.slug}/${itemId}` });
      }
    }
    done();
  });
}

export async function deleteItem(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const itemId = id(form, "id");
    const [row] = await db
      .select({ programId: s.units.programId })
      .from(s.items)
      .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
      .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
      .where(eq(s.items.id, itemId));
    await db.delete(s.items).where(eq(s.items.id, itemId));
    done(row ? `/admin/programs/${row.programId}` : "/admin");
  });
}

/* ---------- quiz questions ---------- */

export async function saveQuestion(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const quizItemId = id(form, "quizItemId");
    const options = str(form, "options", 5000).split("\n").map((o) => o.trim()).filter(Boolean).slice(0, 10);
    if (options.length < 2) throw new Error("צריך לפחות 2 תשובות");
    const correct = str(form, "correct")
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((n) => Number(n) - 1)
      .filter((n) => Number.isInteger(n) && n >= 0 && n < options.length);
    if (!correct.length) throw new Error("סמנו לפחות תשובה נכונה אחת (מספר התשובה, למשל 2)");
    const kind = correct.length > 1 || form.get("kind") === "multiple" ? "multiple" : "single";
    const values = { prompt: str(form, "prompt", 2000), options, correct: [...new Set(correct)].sort(), kind: kind as "single" | "multiple", explanation: str(form, "explanation", 2000), points: Math.max(1, int(form, "points", 1)) };
    if (!values.prompt) throw new Error("חסר נוסח שאלה");
    const qid = optStr(form, "id");
    if (qid) await db.update(s.questions).set({ ...values, position: int(form, "position", 1) }).where(eq(s.questions.id, z.string().uuid().parse(qid)));
    else {
      const [r] = await db.select({ m: max(s.questions.position) }).from(s.questions).where(eq(s.questions.quizItemId, quizItemId));
      await db.insert(s.questions).values({ ...values, quizItemId, position: (r?.m ?? 0) + 1 });
    }
    done();
  });
}

export async function deleteQuestion(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.delete(s.questions).where(eq(s.questions.id, id(form, "id")));
    done();
  });
}

/* ---------- events ---------- */

export async function saveEvent(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const startsAt = israelLocalToDate(str(form, "startsAt"));
    const minutes = Math.max(5, int(form, "durationMin", 60));
    if (Number.isNaN(startsAt.getTime())) throw new Error("מועד לא תקין");
    const provider = z.enum(["none", "bunny", "url"]).parse(form.get("recordingProvider") ?? "none");
    const recordingRef = optStr(form, "recordingRef");
    if (provider === "url") httpUrl(recordingRef);
    const values = {
      cohortId: optStr(form, "cohortId") ? z.string().uuid().parse(form.get("cohortId")) : null,
      title: str(form, "title", 200),
      description: str(form, "description", 2000),
      category: str(form, "category", 60) || "כללי",
      startsAt,
      endsAt: new Date(startsAt.getTime() + minutes * 60_000),
      joinUrl: httpUrl(optStr(form, "joinUrl")),
      recordingProvider: provider,
      recordingRef,
    };
    if (!values.title) throw new Error("חסרה כותרת");
    const eventId = optStr(form, "id");
    if (eventId) await db.update(s.events).set(values).where(eq(s.events.id, z.string().uuid().parse(eventId)));
    else await db.insert(s.events).values(values);
    done("/admin/events");
  });
}

export async function deleteEvent(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.delete(s.events).where(eq(s.events.id, id(form, "id")));
    done("/admin/events");
  });
}

/* ---------- reviews, reports, members ---------- */

export async function reviewAction(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    const u = await actionUser("mentor");
    const decision = z.enum(["approved", "needs_changes"]).parse(form.get("decision"));
    await reviewSubmission(u, id(form, "id"), decision, str(form, "feedback", 5000));
    done();
  });
}

export async function setReportStatus(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await actionUser("mentor");
    await db.update(s.bugReports).set({ status: z.enum(["open", "in_progress", "closed"]).parse(form.get("status")) }).where(eq(s.bugReports.id, id(form, "id")));
    done();
  });
}

export async function setRole(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    const me = await actionUser("owner");
    const userId = id(form, "id");
    if (userId === me.id) throw new Error("אי אפשר לשנות את התפקיד של עצמכם");
    await db.update(s.users).set({ role: z.enum(["member", "mentor", "admin", "owner"]).parse(form.get("role")) }).where(eq(s.users.id, userId));
    done();
  });
}

export async function enrollUser(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    const email = z.string().trim().toLowerCase().email("אימייל לא תקין").parse(form.get("email"));
    const cohortId = id(form, "cohortId");
    let [u] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = ${email}`);
    if (!u) [u] = await db.insert(s.users).values({ email, firstName: str(form, "firstName", 60), lastName: str(form, "lastName", 60) }).returning();
    await db
      .insert(s.enrollments)
      .values({ userId: u!.id, cohortId, paymentRef: "manual" })
      .onConflictDoUpdate({ target: [s.enrollments.userId, s.enrollments.cohortId], set: { status: "active" } });
    await notify(u!.id, "enrollment.created", "הגישה לתוכנית נפתחה", { href: "/", email: true, body: "אפשר להתחיל ללמוד." });
    done();
  });
}

export async function setEnrollmentStatus(_: AdminState, form: FormData): Promise<AdminState> {
  return guard(async () => {
    await admin();
    await db.update(s.enrollments).set({ status: z.enum(["active", "cancelled", "refunded"]).parse(form.get("status")) }).where(eq(s.enrollments.id, id(form, "id")));
    done();
  });
}
