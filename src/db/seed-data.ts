import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as s from "./schema";

type Db = PostgresJsDatabase<typeof s>;

const DAY = 86_400_000;

export const SEED_USERS = {
  member: { email: "noa@example.com", firstName: "נועה", lastName: "כהן", role: "member" as const },
  member2: { email: "omer@example.com", firstName: "עומר", lastName: "בר", role: "member" as const },
  mentor: { email: "mentor@example.com", firstName: "דני", lastName: "לוי", role: "mentor" as const },
  admin: { email: "admin@example.com", firstName: "מאיה", lastName: "אדמין", role: "admin" as const },
};

/** Israel-time wall clock → Date (Israel is UTC+2 in winter, UTC+3 in summer). */
function israelAt(base: Date, dayOffset: number, hour: number): Date {
  const d = new Date(base.getTime() + dayOffset * DAY);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
  const probe = new Date(`${ymd}T${String(hour).padStart(2, "0")}:00:00Z`);
  const israelHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jerusalem" }).format(probe));
  return new Date(probe.getTime() - (israelHour - hour) * 3_600_000);
}

export async function seed(db: Db, now = new Date()) {
  await db.execute(sql.raw(`TRUNCATE ${s.ALL_TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`));

  const [member, member2, mentor, admin] = await db
    .insert(s.users)
    .values([SEED_USERS.member, SEED_USERS.member2, SEED_USERS.mentor, SEED_USERS.admin].map((u) => ({
      ...u,
      headline: u.role === "member" ? "בונה אוטומציות לעסק קטן" : "צוות התוכנית",
    })))
    .returning();

  const [program] = await db
    .insert(s.programs)
    .values({
      slug: "ai-automations",
      title: "אוטומציות AI מאפס",
      subtitle: "בונים תהליכים אוטומטיים לעסק, צעד אחר צעד",
      isPublished: true,
      priceAgorot: 149000,
      certificateRules: { minPoints: 30, requireAllRequiredItems: true },
    })
    .returning();

  const [cohort] = await db
    .insert(s.cohorts)
    .values({
      programId: program!.id,
      title: "מחזור 1",
      startsAt: new Date(now.getTime() - 10 * DAY),
      zoomUrl: "https://zoom.us/j/0000000000",
    })
    .returning();

  await db.insert(s.enrollments).values([
    { userId: member!.id, cohortId: cohort!.id, joinedAt: new Date(now.getTime() - 10 * DAY) },
    { userId: member2!.id, cohortId: cohort!.id, joinedAt: new Date(now.getTime() - 3 * DAY) },
  ]);

  const [u1, u2, u3] = await db
    .insert(s.units)
    .values([
      { programId: program!.id, position: 1, title: "יסודות האוטומציה", subtitle: "מושגים, טריגרים ו-Webhooks" },
      { programId: program!.id, position: 2, title: "סוכני AI בעבודה", subtitle: "חיבור מודל שפה לתהליך" },
      { programId: program!.id, position: 3, title: "פרויקט סיום", subtitle: "בונים אוטומציה אמיתית לעסק" },
    ])
    .returning();
  await db.update(s.units).set({ unlockRule: { type: "prerequisite", unitId: u1!.id, minPct: 50 } }).where(eq(s.units.id, u2!.id));
  await db.update(s.units).set({ unlockRule: { type: "cohort_offset_days", days: 30 } }).where(eq(s.units.id, u3!.id));

  const [c11, c12, c21, c31] = await db
    .insert(s.chapters)
    .values([
      { unitId: u1!.id, position: 1, title: "מה זו אוטומציה" },
      { unitId: u1!.id, position: 2, title: "טריגרים ו-Webhooks" },
      { unitId: u2!.id, position: 1, title: "המודל כחלק מהתהליך" },
      { unitId: u3!.id, position: 1, title: "הפרויקט" },
    ])
    .returning();

  const it = await db
    .insert(s.items)
    .values([
      { chapterId: c11!.id, position: 1, type: "video", title: "1.1 · למה אוטומציה ומתי לא", durationSec: 540 },
      { chapterId: c11!.id, position: 2, type: "text", title: "1.2 · מילון מושגים בסיסי", durationSec: 300 },
      { chapterId: c11!.id, position: 3, type: "quiz", title: "1.3 · מבדק: יסודות", durationSec: 300, points: 10 },
      { chapterId: c12!.id, position: 1, type: "video", title: "1.4 · טריגר: מה מפעיל תהליך", durationSec: 720 },
      { chapterId: c12!.id, position: 2, type: "video", title: "1.5 · Webhook, הכתובת שמפעילה את האוטומציה", durationSec: 540 },
      { chapterId: c12!.id, position: 3, type: "assignment", title: "1.6 · תרגול: Webhook ראשון", durationSec: 1800, points: 10 },
      { chapterId: c21!.id, position: 1, type: "video", title: "2.1 · מודל שפה כצעד בתהליך", durationSec: 660 },
      { chapterId: c21!.id, position: 2, type: "quiz", title: "2.2 · מבדק: סוכנים", durationSec: 300, points: 10 },
      { chapterId: c31!.id, position: 1, type: "assignment", title: "3.1 · משימת סיום", durationSec: 7200, points: 20 },
    ])
    .returning();
  const [v11, t12, q13, v14, v15, a16, v21, q22, a31] = it;

  const transcript = (topic: string) =>
    [`שלום לכולם, בשיעור הזה נדבר על ${topic}.`, "נתחיל בדוגמה מעסק קטן: בית קפה שמקבל הזמנות בוואטסאפ.", "כל הזמנה נרשמת ידנית בגיליון, וזה לוקח זמן ויוצר טעויות.", "נראה איך תהליך אוטומטי חוסך את זה, ומתי דווקא לא כדאי להפוך משהו לאוטומטי."].join("\n");

  await db.insert(s.lessonContents).values([
    {
      itemId: v11!.id,
      overviewMd: "## מה בונים בשיעור\n\n- מבינים מה אוטומציה פותרת\n- מזהים תהליך שכדאי **לא** להפוך לאוטומטי\n\n> כלל אצבע: אם תהליך משתנה כל שבוע, מוקדם מדי לאוטומט אותו.",
      transcript: transcript("אוטומציה"),
      timestamps: [{ sec: 0, label: "פתיחה" }, { sec: 95, label: "דוגמת בית הקפה" }, { sec: 310, label: "מתי לא לאוטומט" }],
      attachments: [{ name: "מצגת השיעור.pdf", url: "/files/sample.pdf", sizeBytes: 482_000, mime: "application/pdf" }],
    },
    { itemId: t12!.id, overviewMd: "## מילון מושגים\n\n- **טריגר:** האירוע שמתחיל תהליך\n- **פעולה:** צעד בתהליך\n- **Webhook:** כתובת שמקבלת נתונים מבחוץ ומפעילה תהליך\n- **API:** הדרך שבה מערכות מדברות זו עם זו" },
    { itemId: v14!.id, overviewMd: "## טריגרים\n\nסוגי טריגרים: לפי זמן, לפי אירוע, וידני.", transcript: transcript("טריגרים"), timestamps: [{ sec: 0, label: "פתיחה" }, { sec: 240, label: "טריגר לפי זמן" }, { sec: 480, label: "טריגר לפי אירוע" }] },
    { itemId: v15!.id, overviewMd: "## Webhook\n\nכתובת שמערכת אחרת שולחת אליה נתונים, וזה מפעיל את התהליך.", transcript: transcript("Webhooks"), timestamps: [{ sec: 0, label: "פתיחה" }, { sec: 180, label: "בדיקה עם curl" }] },
    { itemId: v21!.id, overviewMd: "## מודל שפה בתהליך\n\nמתי לתת למודל להחליט, ומתי רק לסכם.", transcript: transcript("מודלי שפה") },
  ]);

  await db.insert(s.quizzes).values([
    { itemId: q13!.id, introMd: "מבדק קצר על יסודות האוטומציה.", passPct: 70 },
    { itemId: q22!.id, introMd: "מבדק על סוכני AI.", passPct: 70, maxAttempts: 3 },
  ]);
  await db.insert(s.questions).values([
    { quizItemId: q13!.id, position: 1, prompt: "מה מתחיל תהליך אוטומטי?", options: ["פעולה", "טריגר", "דוח", "משתמש"], correct: [1], explanation: "טריגר הוא האירוע שמפעיל את התהליך." },
    { quizItemId: q13!.id, position: 2, kind: "multiple", prompt: "אילו מהבאים הם סוגי טריגרים? (אפשר לבחור כמה)", options: ["לפי זמן", "לפי אירוע", "לפי צבע", "ידני"], correct: [0, 1, 3], explanation: "טריגרים פועלים לפי זמן, לפי אירוע או ידנית." },
    { quizItemId: q13!.id, position: 3, prompt: "מתי כדאי לא לאוטומט תהליך?", options: ["כשהוא חוזר כל יום", "כשהוא משתנה כל שבוע", "כשהוא לוקח הרבה זמן", "תמיד כדאי"], correct: [1], explanation: "תהליך שמשתנה כל הזמן יישבר שוב ושוב." },
    { quizItemId: q22!.id, position: 1, prompt: "מה התפקיד הבטוח ביותר למודל שפה בתהליך עסקי?", options: ["לאשר תשלומים", "לסכם ולסווג", "למחוק רשומות", "לשנות הרשאות"], correct: [1], explanation: "סיכום וסיווג הם משימות שקל לבדוק ולתקן." },
  ]);

  await db.insert(s.assignments).values([
    { itemId: a16!.id, briefMd: "## הקייס\n\nבית הקפה \"פינה שקטה\" רוצה לקבל הזמנות מטופס ולשמור אותן בגיליון.", estMinutes: 30 },
    { itemId: a31!.id, briefMd: "## משימת הסיום\n\nבנו אוטומציה לעסק אמיתי (שלכם או של מכרים). הגישו קישור לתרשים או לסרטון קצר, ותיאור של התהליך.", estMinutes: 120, requiresSubmission: true },
  ]);
  const steps = await db
    .insert(s.assignmentSteps)
    .values([
      { assignmentItemId: a16!.id, position: 1, text: "פתחו תהליך חדש עם טריגר מסוג Webhook" },
      { assignmentItemId: a16!.id, position: 2, text: "שלחו בקשת בדיקה וודאו שהנתונים מגיעים" },
      { assignmentItemId: a16!.id, position: 3, text: "הוסיפו צעד ששומר שורה בגיליון" },
      { assignmentItemId: a16!.id, position: 4, text: "חברו את הטופס לכתובת ה-Webhook" },
      { assignmentItemId: a31!.id, position: 1, text: "בחרו תהליך ותארו אותו במשפט אחד" },
      { assignmentItemId: a31!.id, position: 2, text: "בנו את האוטומציה ובדקו אותה על 3 מקרים" },
      { assignmentItemId: a31!.id, position: 3, text: "הגישו קישור ותיאור" },
    ])
    .returning();

  // Member progress: unit 1 partly done.
  await db.insert(s.progress).values([
    { userId: member!.id, itemId: v11!.id, status: "done", watchedPct: 100, positionSec: 540, completedAt: new Date(now.getTime() - 9 * DAY), lastSeenAt: new Date(now.getTime() - 9 * DAY) },
    { userId: member!.id, itemId: t12!.id, status: "done", watchedPct: 100, completedAt: new Date(now.getTime() - 8 * DAY), lastSeenAt: new Date(now.getTime() - 8 * DAY) },
    { userId: member!.id, itemId: q13!.id, status: "done", completedAt: new Date(now.getTime() - 8 * DAY), lastSeenAt: new Date(now.getTime() - 8 * DAY) },
    { userId: member!.id, itemId: v14!.id, status: "done", watchedPct: 100, positionSec: 720, completedAt: new Date(now.getTime() - 2 * DAY), lastSeenAt: new Date(now.getTime() - 2 * DAY) },
    { userId: member!.id, itemId: v15!.id, status: "in_progress", watchedPct: 40, positionSec: 216, lastSeenAt: new Date(now.getTime() - DAY) },
  ]);
  await db.insert(s.quizAttempts).values({ userId: member!.id, quizItemId: q13!.id, answers: {}, score: 3, maxScore: 3, passed: true, createdAt: new Date(now.getTime() - 8 * DAY) });
  await db.insert(s.pointsLedger).values({ userId: member!.id, programId: program!.id, sourceType: "item", sourceId: q13!.id, points: 10 });
  await db.insert(s.stepChecks).values({ userId: member!.id, stepId: steps[0]!.id });
  await db.insert(s.notes).values({ userId: member!.id, itemId: v11!.id, body: "לבדוק אם תהליך ההזמנות אצלנו יציב מספיק לאוטומציה.", positionSec: 310 });

  const [thread] = await db
    .insert(s.threads)
    .values({ itemId: v15!.id, authorId: member2!.id, kind: "question", body: "הבקשה מגיעה ריקה ל-Webhook. מה בודקים קודם?", videoSec: 180, createdAt: new Date(now.getTime() - 2 * DAY) })
    .returning();
  const [answer] = await db
    .insert(s.messages)
    .values({ threadId: thread!.id, authorId: mentor!.id, body: "קודם בודקים שה-Content-Type הוא application/json, ושהגוף נשלח ב-POST ולא ב-GET.", createdAt: new Date(now.getTime() - DAY) })
    .returning();
  await db.update(s.threads).set({ acceptedMessageId: answer!.id }).where(eq(s.threads.id, thread!.id));
  await db.insert(s.threads).values({ itemId: v15!.id, authorId: member!.id, kind: "share", body: "חיברתי את הטופס של העסק שלי, עובד! 🎉", createdAt: new Date(now.getTime() - 3 * 3_600_000) });

  await db.insert(s.events).values([
    { cohortId: cohort!.id, title: "מפגש שאלות ותשובות", category: "טכני", startsAt: israelAt(now, 1, 19), endsAt: israelAt(now, 1, 20), joinUrl: cohort!.zoomUrl, description: "מביאים שאלות מהשבוע." },
    { cohortId: cohort!.id, title: "סדנת סוכנים", category: "עסקי", startsAt: israelAt(now, 8, 19), endsAt: israelAt(now, 8, 21), joinUrl: cohort!.zoomUrl },
    { cohortId: cohort!.id, title: "מפגש פתיחה", category: "עסקי", startsAt: israelAt(now, -7, 19), endsAt: israelAt(now, -7, 20), recordingProvider: "none", description: "היכרות, מבנה התוכנית ומה בונים." },
  ]);

  await db.insert(s.notifications).values([
    { userId: member!.id, type: "lesson.new", title: "שיעור חדש נוסף: 2.1 · מודל שפה כצעד בתהליך", href: `/learn/${program!.slug}/${v21!.id}`, createdAt: new Date(now.getTime() - 5 * 3_600_000) },
    { userId: member!.id, type: "event.reminder", title: "מחר: מפגש שאלות ותשובות", href: "/events", createdAt: new Date(now.getTime() - 3_600_000) },
  ]);

  return { users: { member: member!, member2: member2!, mentor: mentor!, admin: admin! }, program: program!, cohort: cohort!, items: { v11: v11!, t12: t12!, q13: q13!, v14: v14!, v15: v15!, a16: a16!, v21: v21!, q22: q22!, a31: a31! }, units: { u1: u1!, u2: u2!, u3: u3! } };
}
