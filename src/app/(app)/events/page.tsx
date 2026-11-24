import { CalendarDays, CalendarPlus, Clock, PlayCircle, Video } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { pastEvents, upcomingEvents } from "@/lib/data/events";
import { bunnyEmbedUrl } from "@/lib/domain/crypto";
import { formatDuration, formatEventDate } from "@/lib/domain/format";
import { env } from "@/lib/env";
import { Badge, Card, EmptyState, PageHeader, buttonClass } from "@/components/ui";
import { Countdown } from "@/components/countdown";
import { NotesFilter } from "../notes/notes-filter";

export const metadata = { title: "המפגשים" };

function googleCalUrl(e: { title: string; startsAt: Date; endsAt: Date; joinUrl: string | null; description: string }) {
  const f = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", e.title);
  u.searchParams.set("dates", `${f(e.startsAt)}/${f(e.endsAt)}`);
  u.searchParams.set("details", [e.description, e.joinUrl].filter(Boolean).join("\n"));
  return u.toString();
}

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const [upcoming, past] = await Promise.all([upcomingEvents(user), pastEvents(user, q)]);
  const [next, ...rest] = upcoming;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader
        title="המפגשים"
        subtitle="מפגשים חיים והקלטות"
        actions={<a href="/api/events/ics" className={buttonClass("secondary")}><CalendarPlus aria-hidden size={18} />כל המפגשים ליומן (ICS)</a>}
      />

      {next ? (
        <Card className="bg-surface-muted p-5">
          <p className="mb-2 text-sm font-semibold text-muted">המפגש הבא</p>
          <div className="mb-2 flex flex-wrap gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1"><CalendarDays aria-hidden size={15} />{formatEventDate(next.startsAt)}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-info-subtle px-3 py-1 font-semibold text-on-info-subtle"><Clock aria-hidden size={15} /><Countdown to={next.startsAt.toISOString()} className="tabular" /></span>
            <Badge>{next.category}</Badge>
          </div>
          <h2 className="text-xl font-bold">{next.title}</h2>
          {next.description && <p className="mt-1 text-muted">{next.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {next.joinUrl && <a href={next.joinUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("accent")}><Video aria-hidden size={18} />הצטרפות לזום</a>}
            <a href={`/api/events/${next.id}/ics`} className={buttonClass("secondary")}><CalendarPlus aria-hidden size={18} />הוספה ליומן</a>
            <a href={googleCalUrl(next)} target="_blank" rel="noopener noreferrer" className={buttonClass("ghost")}>Google Calendar</a>
          </div>
        </Card>
      ) : (
        <EmptyState icon={<CalendarDays size={28} />} title="אין מפגשים קרובים" />
      )}

      {rest.length > 0 && (
        <section aria-labelledby="later">
          <h2 id="later" className="mb-3 text-lg font-bold">בהמשך</h2>
          <ul className="space-y-2">
            {rest.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-muted">{formatEventDate(e.startsAt)} · {formatDuration((e.endsAt.getTime() - e.startsAt.getTime()) / 1000)}</p>
                </div>
                <Badge>{e.category}</Badge>
                <a href={`/api/events/${e.id}/ics`} className="text-sm font-semibold text-primary hover:underline">הוספה ליומן</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="recordings">
        <h2 id="recordings" className="mb-3 text-lg font-bold">ארכיון הקלטות</h2>
        <NotesFilter initial={q} placeholder="חיפוש בהקלטות" />
        {past.length === 0 ? (
          <EmptyState title={q ? "לא נמצאו הקלטות" : "עוד אין הקלטות"} />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {past.map((e) => {
              const src = e.recordingProvider === "bunny" && e.recordingRef && env.bunnyLibraryId
                ? bunnyEmbedUrl({ libraryId: env.bunnyLibraryId, videoId: e.recordingRef, tokenKey: env.bunnyTokenKey || undefined })
                : e.recordingProvider === "url" ? e.recordingRef : null;
              return (
                <li key={e.id}>
                  <Card className="overflow-hidden">
                    {src ? (
                      e.recordingProvider === "bunny" ? <iframe src={src} title={e.title} className="aspect-video w-full" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen loading="lazy" /> : <video src={src} controls preload="none" className="aspect-video w-full bg-black" aria-label={e.title} />
                    ) : (
                      <div className="hero flex aspect-video items-center justify-center gap-2 text-sm"><PlayCircle aria-hidden size={22} />ההקלטה תעלה בקרוב</div>
                    )}
                    <div className="p-4">
                      <div className="mb-1 flex items-center gap-2"><Badge>{e.category}</Badge><span className="text-xs text-muted">{formatEventDate(e.startsAt)}</span></div>
                      <p className="font-semibold">{e.title}</p>
                      {e.description && <p className="text-sm text-muted">{e.description}</p>}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
