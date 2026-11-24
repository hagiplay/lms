CREATE TYPE "public"."bug_kind" AS ENUM('bug', 'improvement');--> statement-breakpoint
CREATE TYPE "public"."bug_status" AS ENUM('open', 'in_progress', 'closed');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status" AS ENUM('active', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('video', 'text', 'quiz', 'assignment');--> statement-breakpoint
CREATE TYPE "public"."progress_status" AS ENUM('in_progress', 'done', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."question_kind" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('member', 'mentor', 'admin', 'owner');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('submitted', 'needs_changes', 'approved');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TYPE "public"."thread_kind" AS ENUM('question', 'share');--> statement-breakpoint
CREATE TYPE "public"."video_provider" AS ENUM('none', 'bunny', 'url');--> statement-breakpoint
CREATE TABLE "assignment_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assignment_item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"brief_md" text DEFAULT '' NOT NULL,
	"est_minutes" integer DEFAULT 0 NOT NULL,
	"requires_submission" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bug_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" "bug_kind" NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"page_url" text,
	"screenshot_path" text,
	"status" "bug_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"verify_code" text NOT NULL,
	"recipient_name" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "certificates_verify_code_unique" UNIQUE("verify_code")
);
--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"unit_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"is_evergreen" boolean DEFAULT false NOT NULL,
	"zoom_url" text,
	"whatsapp_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	"status" "enrollment_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payment_ref" text
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cohort_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'כללי' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"join_url" text,
	"recording_provider" "video_provider" DEFAULT 'none' NOT NULL,
	"recording_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_entity_type_entity_id_pk" PRIMARY KEY("user_id","entity_type","entity_id")
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"type" "item_type" NOT NULL,
	"title" text NOT NULL,
	"duration_sec" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"update_note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_contents" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"video_provider" "video_provider" DEFAULT 'none' NOT NULL,
	"video_ref" text,
	"overview_md" text DEFAULT '' NOT NULL,
	"transcript" text DEFAULT '' NOT NULL,
	"timestamps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"body" text NOT NULL,
	"position_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "points_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"certificate_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"price_agorot" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "progress" (
	"user_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"status" "progress_status" DEFAULT 'in_progress' NOT NULL,
	"position_sec" integer DEFAULT 0 NOT NULL,
	"watched_pct" integer DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "progress_user_id_item_id_pk" PRIMARY KEY("user_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_item_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"kind" "question_kind" DEFAULT 'single' NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct" jsonb NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_item_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"passed" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quizzes" (
	"item_id" uuid PRIMARY KEY NOT NULL,
	"intro_md" text DEFAULT '' NOT NULL,
	"pass_pct" integer DEFAULT 70 NOT NULL,
	"time_limit_sec" integer,
	"max_attempts" integer
);
--> statement-breakpoint
CREATE TABLE "step_checks" (
	"user_id" uuid NOT NULL,
	"step_id" uuid NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "step_checks_user_id_step_id_pk" PRIMARY KEY("user_id","step_id")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"assignment_item_id" uuid NOT NULL,
	"link_url" text,
	"file_path" text,
	"file_name" text,
	"notes" text DEFAULT '' NOT NULL,
	"status" "submission_status" DEFAULT 'submitted' NOT NULL,
	"mentor_feedback" text,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"kind" "thread_kind" DEFAULT 'question' NOT NULL,
	"body" text NOT NULL,
	"accepted_message_id" uuid,
	"video_sec" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"title" text NOT NULL,
	"subtitle" text DEFAULT '' NOT NULL,
	"unlock_rule" jsonb DEFAULT '{"type":"none"}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" uuid,
	"email" text NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"role" "role" DEFAULT 'member' NOT NULL,
	"theme" "theme" DEFAULT 'system' NOT NULL,
	"ai_consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id")
);
--> statement-breakpoint
ALTER TABLE "assignment_steps" ADD CONSTRAINT "assignment_steps_assignment_item_id_assignments_item_id_fk" FOREIGN KEY ("assignment_item_id") REFERENCES "public"."assignments"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bug_reports" ADD CONSTRAINT "bug_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_unit_id_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_contents" ADD CONSTRAINT "lesson_contents_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_thread_id_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "points_ledger" ADD CONSTRAINT "points_ledger_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "progress" ADD CONSTRAINT "progress_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_quiz_item_id_quizzes_item_id_fk" FOREIGN KEY ("quiz_item_id") REFERENCES "public"."quizzes"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_item_id_quizzes_item_id_fk" FOREIGN KEY ("quiz_item_id") REFERENCES "public"."quizzes"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_checks" ADD CONSTRAINT "step_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "step_checks" ADD CONSTRAINT "step_checks_step_id_assignment_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."assignment_steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_assignment_item_id_assignments_item_id_fk" FOREIGN KEY ("assignment_item_id") REFERENCES "public"."assignments"("item_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "units" ADD CONSTRAINT "units_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "steps_assignment_idx" ON "assignment_steps" USING btree ("assignment_item_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_program_idx" ON "certificates" USING btree ("user_id","program_id");--> statement-breakpoint
CREATE INDEX "chapters_unit_idx" ON "chapters" USING btree ("unit_id","position");--> statement-breakpoint
CREATE INDEX "cohorts_program_idx" ON "cohorts" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enrollments_user_cohort_idx" ON "enrollments" USING btree ("user_id","cohort_id");--> statement-breakpoint
CREATE INDEX "events_starts_idx" ON "events" USING btree ("starts_at");--> statement-breakpoint
CREATE INDEX "items_chapter_idx" ON "items" USING btree ("chapter_id","position");--> statement-breakpoint
CREATE INDEX "items_title_trgm_idx" ON "items" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "lesson_transcript_trgm_idx" ON "lesson_contents" USING gin ("transcript" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "messages_thread_idx" ON "messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_provider_ext_idx" ON "payment_events" USING btree ("provider","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "points_unique_source_idx" ON "points_ledger" USING btree ("user_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "progress_last_seen_idx" ON "progress" USING btree ("user_id","last_seen_at");--> statement-breakpoint
CREATE INDEX "questions_quiz_idx" ON "questions" USING btree ("quiz_item_id","position");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_idx" ON "quiz_attempts" USING btree ("user_id","quiz_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_user_assignment_idx" ON "submissions" USING btree ("user_id","assignment_item_id");--> statement-breakpoint
CREATE INDEX "threads_item_idx" ON "threads" USING btree ("item_id","created_at");--> statement-breakpoint
CREATE INDEX "units_program_idx" ON "units" USING btree ("program_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "users" USING btree (lower("email"));