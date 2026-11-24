import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { CertificateRules, UnlockRule } from "@/lib/domain/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const roleEnum = pgEnum("role", ["member", "mentor", "admin", "owner"]);
export const themeEnum = pgEnum("theme", ["system", "light", "dark"]);
export const enrollmentStatusEnum = pgEnum("enrollment_status", ["active", "cancelled", "refunded"]);
export const itemTypeEnum = pgEnum("item_type", ["video", "text", "quiz", "assignment"]);
export const videoProviderEnum = pgEnum("video_provider", ["none", "bunny", "url"]);
export const questionKindEnum = pgEnum("question_kind", ["single", "multiple"]);
export const progressStatusEnum = pgEnum("progress_status", ["in_progress", "done", "skipped"]);
export const submissionStatusEnum = pgEnum("submission_status", ["submitted", "needs_changes", "approved"]);
export const threadKindEnum = pgEnum("thread_kind", ["question", "share"]);
export const bugKindEnum = pgEnum("bug_kind", ["bug", "improvement"]);
export const bugStatusEnum = pgEnum("bug_status", ["open", "in_progress", "closed"]);

/* ---------- Users ---------- */

export const users = pgTable(
  "users",
  {
    id: id(),
    authId: uuid("auth_id").unique(),
    email: text("email").notNull(),
    firstName: text("first_name").notNull().default(""),
    lastName: text("last_name").notNull().default(""),
    headline: text("headline").notNull().default(""),
    avatarUrl: text("avatar_url"),
    role: roleEnum("role").notNull().default("member"),
    theme: themeEnum("theme").notNull().default("system"),
    aiConsentAt: timestamp("ai_consent_at", { withTimezone: true }),
    createdAt: createdAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${t.email})`)],
);

/* ---------- Programs & cohorts ---------- */

export const programs = pgTable("programs", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  coverUrl: text("cover_url"),
  certificateRules: jsonb("certificate_rules").$type<CertificateRules>().notNull().default({}),
  priceAgorot: integer("price_agorot").notNull().default(0),
  isPublished: boolean("is_published").notNull().default(false),
  createdAt: createdAt(),
});

export const cohorts = pgTable(
  "cohorts",
  {
    id: id(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isEvergreen: boolean("is_evergreen").notNull().default(false),
    zoomUrl: text("zoom_url"),
    whatsappUrl: text("whatsapp_url"),
    createdAt: createdAt(),
  },
  (t) => [index("cohorts_program_idx").on(t.programId)],
);

export const enrollments = pgTable(
  "enrollments",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id").notNull().references(() => cohorts.id, { onDelete: "cascade" }),
    status: enrollmentStatusEnum("status").notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    paymentRef: text("payment_ref"),
  },
  (t) => [uniqueIndex("enrollments_user_cohort_idx").on(t.userId, t.cohortId)],
);

/* ---------- Content tree ---------- */

export const units = pgTable(
  "units",
  {
    id: id(),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    unlockRule: jsonb("unlock_rule").$type<UnlockRule>().notNull().default({ type: "none" }),
  },
  (t) => [index("units_program_idx").on(t.programId, t.position)],
);

export const chapters = pgTable(
  "chapters",
  {
    id: id(),
    unitId: uuid("unit_id").notNull().references(() => units.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    title: text("title").notNull(),
  },
  (t) => [index("chapters_unit_idx").on(t.unitId, t.position)],
);

export const items = pgTable(
  "items",
  {
    id: id(),
    chapterId: uuid("chapter_id").notNull().references(() => chapters.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    type: itemTypeEnum("type").notNull(),
    title: text("title").notNull(),
    durationSec: integer("duration_sec").notNull().default(0),
    isRequired: boolean("is_required").notNull().default(true),
    points: integer("points").notNull().default(0),
    isPublished: boolean("is_published").notNull().default(true),
    updateNote: text("update_note"),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("items_chapter_idx").on(t.chapterId, t.position),
    index("items_title_trgm_idx").using("gin", sql`${t.title} gin_trgm_ops`),
  ],
);

export type Timestamp = { sec: number; label: string };
export type Attachment = { name: string; url: string; sizeBytes: number; mime: string };

export const lessonContents = pgTable(
  "lesson_contents",
  {
    itemId: uuid("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
    videoProvider: videoProviderEnum("video_provider").notNull().default("none"),
    videoRef: text("video_ref"),
    overviewMd: text("overview_md").notNull().default(""),
    transcript: text("transcript").notNull().default(""),
    timestamps: jsonb("timestamps").$type<Timestamp[]>().notNull().default([]),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
  },
  (t) => [index("lesson_transcript_trgm_idx").using("gin", sql`${t.transcript} gin_trgm_ops`)],
);

/* ---------- Quizzes ---------- */

export const quizzes = pgTable("quizzes", {
  itemId: uuid("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  introMd: text("intro_md").notNull().default(""),
  passPct: integer("pass_pct").notNull().default(70),
  timeLimitSec: integer("time_limit_sec"),
  maxAttempts: integer("max_attempts"),
});

export const questions = pgTable(
  "questions",
  {
    id: id(),
    quizItemId: uuid("quiz_item_id").notNull().references(() => quizzes.itemId, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: questionKindEnum("kind").notNull().default("single"),
    prompt: text("prompt").notNull(),
    options: jsonb("options").$type<string[]>().notNull(),
    correct: jsonb("correct").$type<number[]>().notNull(),
    explanation: text("explanation").notNull().default(""),
    points: integer("points").notNull().default(1),
  },
  (t) => [index("questions_quiz_idx").on(t.quizItemId, t.position)],
);

export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    quizItemId: uuid("quiz_item_id").notNull().references(() => quizzes.itemId, { onDelete: "cascade" }),
    answers: jsonb("answers").$type<Record<string, number[]>>().notNull(),
    score: integer("score").notNull(),
    maxScore: integer("max_score").notNull(),
    passed: boolean("passed").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("quiz_attempts_user_idx").on(t.userId, t.quizItemId)],
);

/* ---------- Assignments ---------- */

export const assignments = pgTable("assignments", {
  itemId: uuid("item_id").primaryKey().references(() => items.id, { onDelete: "cascade" }),
  briefMd: text("brief_md").notNull().default(""),
  estMinutes: integer("est_minutes").notNull().default(0),
  requiresSubmission: boolean("requires_submission").notNull().default(false),
});

export const assignmentSteps = pgTable(
  "assignment_steps",
  {
    id: id(),
    assignmentItemId: uuid("assignment_item_id")
      .notNull()
      .references(() => assignments.itemId, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("steps_assignment_idx").on(t.assignmentItemId, t.position)],
);

export const stepChecks = pgTable(
  "step_checks",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    stepId: uuid("step_id").notNull().references(() => assignmentSteps.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.stepId] })],
);

export const submissions = pgTable(
  "submissions",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    assignmentItemId: uuid("assignment_item_id")
      .notNull()
      .references(() => assignments.itemId, { onDelete: "cascade" }),
    linkUrl: text("link_url"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    notes: text("notes").notNull().default(""),
    status: submissionStatusEnum("status").notNull().default("submitted"),
    mentorFeedback: text("mentor_feedback"),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("submissions_user_assignment_idx").on(t.userId, t.assignmentItemId)],
);

/* ---------- Progress, notes, points, certificates ---------- */

export const progress = pgTable(
  "progress",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    status: progressStatusEnum("status").notNull().default("in_progress"),
    positionSec: integer("position_sec").notNull().default(0),
    watchedPct: integer("watched_pct").notNull().default(0),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.userId, t.itemId] }), index("progress_last_seen_idx").on(t.userId, t.lastSeenAt)],
);

export const notes = pgTable(
  "notes",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    positionSec: integer("position_sec"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("notes_user_idx").on(t.userId, t.createdAt)],
);

export const pointsLedger = pgTable(
  "points_ledger",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    points: integer("points").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("points_unique_source_idx").on(t.userId, t.sourceType, t.sourceId)],
);

export const certificates = pgTable(
  "certificates",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    programId: uuid("program_id").notNull().references(() => programs.id, { onDelete: "cascade" }),
    verifyCode: text("verify_code").notNull().unique(),
    recipientName: text("recipient_name").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("certificates_user_program_idx").on(t.userId, t.programId)],
);

export const favorites = pgTable(
  "favorites",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.entityType, t.entityId] })],
);

/* ---------- Discussion ---------- */

export const threads = pgTable(
  "threads",
  {
    id: id(),
    itemId: uuid("item_id").notNull().references(() => items.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: threadKindEnum("kind").notNull().default("question"),
    body: text("body").notNull(),
    acceptedMessageId: uuid("accepted_message_id"),
    videoSec: integer("video_sec"),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("threads_item_idx").on(t.itemId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    threadId: uuid("thread_id").notNull().references(() => threads.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("messages_thread_idx").on(t.threadId, t.createdAt)],
);

/* ---------- Events, notifications, support, payments ---------- */

export const events = pgTable(
  "events",
  {
    id: id(),
    cohortId: uuid("cohort_id").references(() => cohorts.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("כללי"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    joinUrl: text("join_url"),
    recordingProvider: videoProviderEnum("recording_provider").notNull().default("none"),
    recordingRef: text("recording_ref"),
    createdAt: createdAt(),
  },
  (t) => [index("events_starts_idx").on(t.startsAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const bugReports = pgTable("bug_reports", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  kind: bugKindEnum("kind").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  pageUrl: text("page_url"),
  screenshotPath: text("screenshot_path"),
  status: bugStatusEnum("status").notNull().default("open"),
  createdAt: createdAt(),
});

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payment_events_provider_ext_idx").on(t.provider, t.externalId)],
);

export const ALL_TABLES = [
  "users",
  "programs",
  "cohorts",
  "enrollments",
  "units",
  "chapters",
  "items",
  "lesson_contents",
  "quizzes",
  "questions",
  "quiz_attempts",
  "assignments",
  "assignment_steps",
  "step_checks",
  "submissions",
  "progress",
  "notes",
  "points_ledger",
  "certificates",
  "favorites",
  "threads",
  "messages",
  "events",
  "notifications",
  "bug_reports",
  "payment_events",
] as const;
