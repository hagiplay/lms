import Link from "next/link";
import { CalendarDays, Clock, Map, Play, Video } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProgramContext, listUserPrograms, type ProgramContext } from "@/lib/data/programs";
import { upcomingEvents } from "@/lib/data/events";
import { formatDuration, formatEventDate, greeting } from "@/lib/domain/format";
import { Badge, Card, EmptyState, ProgressBar } from "@/components/ui";
import { Countdown } from "@/components/countdown";
import { CourseList } from "@/components/course-list";

export const metadata = { title: "דף הבית" };

const lastSeen = (ctx: ProgramContext) => Math.max(0, ...[...ctx.progress.values()].map((p) => p.lastSeenAt.getTime()));

export default async function Dashboard() {
  const user = await requireUser();
  const now = new Date();
  const rows = await listUserPrograms(user);
  const contexts = (await Promise.all(rows.map((r) => getProgramContext(user, r.program.slug, now)))).filter((c): c is ProgramContext => Boolean(c));
  const [event] = await upcomingEvents(user, now, 1);

  const heroCtx = [...contexts].filter((c) => c.next).sort((a, b) => lastSeen(b) - lastSeen(a))[0];
  const next = heroCtx?.next;
  const nextProgress = next ? heroCtx.progress.get(next.id) : undefined;
  const isNext = !nextProgress || nextProgress.status !== "in_progress";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {heroCtx && next ? (
        <section aria-labelledby="hero-title" className="hero overflow-hidden rounded-[var(--radius-card)] shadow-lg">
          <div className="flex flex-col gap-6 p-5 sm:p-7 md:flex-row-reverse md:items-center">
            <Link href={`/learn/${heroCtx.program.slug}/${next.id}`} aria-hidden tabIndex={-1} className="relative flex aspect-video w-full shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-black/25 md:w-80">
              <span className="flex size-14 items-center justify-center rounded-full bg-white/90 text-[#002E35]"><Play size={26} className="-me-1" /></span>
              {next.durationSec > 0 && <span className="absolute bottom-2 start-2 rounded-md bg-black/60 px-2 py-0.5 text-xs">{formatDuration(next.durationSec)}</span>}
            </Link>
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-semibold">{greeting(now)}, {user.firstName || "שלום"}</span>
                <Badge tone="live"><span aria-hidden className="size-1.5 rounded-full bg-white" />{isNext ? "השיעור הבא שלכם" : "ממשיכים מאיפה שעצרתם"}</Badge>
              </div>
              <h1 id="hero-title" className="text-2xl font-extrabold sm:text-3xl">{next.title}</h1>
              <p className="mt-1 text-white/85">{heroCtx.program.title} · {next.chapterTitle}</p>
              {nextProgress && nextProgress.watchedPct > 0 && nextProgress.status === "in_progress" && <p className="mt-1 text-sm text-white/85">נצפו {nextProgress.watchedPct}% מהשיעור</p>}
              <Link href={`/learn/${heroCtx.program.slug}/${next.id}`} className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-accent px-6 font-bold text-on-accent hover:brightness-95">
                <Play aria-hidden size={18} />{isNext ? "התחילו לצפות" : "המשך לצפות"}
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 border-t border-white/15 bg-black/15 px-5 py-3 sm:px-7">
            <span className="text-sm tabular">{heroCtx.stats.done} מתוך {heroCtx.stats.total} פריטים בתוכנית</span>
            <ProgressBar value={heroCtx.stats.pct} label="התקדמות בתוכנית" tone="accent" className="max-w-xs flex-1" />
            <Link href={`/programs/${heroCtx.program.slug}`} className="ms-auto inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"><Map aria-hidden size={16} />למפת הלמידה</Link>
          </div>
        </section>
      ) : (
        <section>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{greeting(now)}, {user.firstName || "שלום"}</h1>
          {contexts.length > 0 && <p className="mt-1 text-muted">סיימתם את כל מה שפתוח כרגע. כל הכבוד!</p>}
        </section>
      )}

      {event && (
        <Card className="flex flex-col gap-4 bg-surface-muted p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1"><CalendarDays aria-hidden size={15} />{formatEventDate(event.startsAt)}</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-info-subtle px-3 py-1 font-semibold text-on-info-subtle"><Clock aria-hidden size={15} /><Countdown to={event.startsAt.toISOString()} className="tabular" /></span>
            </div>
            <h2 className="text-xl font-bold">{event.title}</h2>
          </div>
          {event.joinUrl && (
            <a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-accent px-5 font-bold text-on-accent hover:brightness-95">
              <Video aria-hidden size={18} />הצטרפות לזום
            </a>
          )}
        </Card>
      )}

      {contexts.length > 0 ? (
        <CourseList
          courses={contexts.map((c) => ({
            slug: c.program.slug,
            title: c.program.title,
            subtitle: c.program.subtitle,
            pct: c.stats.pct,
            done: c.stats.done,
            total: c.stats.total,
            lessons: c.stats.byType.video.total + c.stats.byType.text.total,
            quizzes: c.stats.byType.quiz.total,
            assignments: c.stats.byType.assignment.total,
            remainingSec: c.stats.remainingSec,
            nextHref: c.next ? `/learn/${c.program.slug}/${c.next.id}` : null,
          }))}
        />
      ) : (
        <EmptyState title="עדיין אין לכם תוכניות">אחרי רכישה, התוכנית תופיע כאן אוטומטית.</EmptyState>
      )}
    </div>
  );
}
