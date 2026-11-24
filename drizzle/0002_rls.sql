-- Defense in depth: the app reads/writes only via the server (Drizzle, privileged role).
-- RLS enabled with NO policies => Supabase's public Data API (anon/authenticated) sees nothing.
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "programs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cohorts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "units" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chapters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "lesson_contents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assignment_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "step_checks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "points_ledger" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "certificates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bug_reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
