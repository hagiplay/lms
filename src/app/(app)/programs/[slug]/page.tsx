import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, Circle, Lock, PlayCircle } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProgramContext } from "@/lib/data/programs";
import { formatDate, formatDuration } from "@/lib/domain/format";
import { Badge, Card, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { ItemIcon } from "@/components/learn/item-icon";
import { cn } from "@/lib/cn";

export default async function ProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const ctx = await getProgramContext(user, slug);
  if (!ctx) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={ctx.program.title}
        subtitle={ctx.program.subtitle}
        actions={
          <div className="flex gap-2">
            {ctx.next && <LinkButton href={`/learn/${slug}/${ctx.next.id}`}><PlayCircle aria-hidden size={18} />המשך ללמוד</LinkButton>}
            <LinkButton href={`/programs/${slug}/progress`} variant="secondary"><Award aria-hidden size={18} />התקדמות ותעודה</LinkButton>
          </div>
        }
      />

      <Card className="mb-6 p-5">
        <div className="mb-2 flex justify-between text-sm">
          <span>{ctx.stats.done} מתוך {ctx.stats.total} פריטים</span>
          <span className="font-bold tabular">{ctx.stats.pct}%</span>
        </div>
        <ProgressBar value={ctx.stats.pct} label="התקדמות בתוכנית" />
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          {[
            ["שיעורים", ctx.stats.byType.video.done + ctx.stats.byType.text.done, ctx.stats.byType.video.total + ctx.stats.byType.text.total],
            ["מבדקים", ctx.stats.byType.quiz.done, ctx.stats.byType.quiz.total],
            ["משימות", ctx.stats.byType.assignment.done, ctx.stats.byType.assignment.total],
          ].map(([label, d, t]) => (
            <div key={label as string} className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">{label}</dt><dd className="text-lg font-bold tabular">{d}/{t}</dd></div>
          ))}
          <div className="rounded-xl bg-surface-muted p-3"><dt className="text-muted">זמן שנותר</dt><dd className="text-lg font-bold">{formatDuration(ctx.stats.remainingSec) || "0"}</dd></div>
        </dl>
      </Card>

      <ol className="space-y-4">
        {ctx.unitStates.map(({ unit, stats, lock, state }, idx) => (
          <li key={unit.id}>
            <Card className={cn("overflow-hidden", state === "locked" && "bg-surface-muted")}>
              <div className="flex items-center gap-4 border-b border-border p-5">
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full text-lg font-extrabold", state === "done" ? "bg-success-subtle text-on-success-subtle" : state === "locked" ? "bg-surface-muted text-locked" : "bg-primary-subtle text-on-primary-subtle")}>
                  {state === "done" ? <CheckCircle2 aria-label="הושלמה" size={24} /> : state === "locked" ? <Lock aria-label="נעולה" size={22} /> : idx + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold">{unit.title}</h2>
                    {state === "in_progress" && <Badge tone="primary">אתם כאן</Badge>}
                    {state === "done" && <Badge tone="success">הושלמה</Badge>}
                    {state === "not_started" && <Badge>לא התחילה</Badge>}
                    {!lock.unlocked && <Badge tone="neutral"><Lock aria-hidden size={12} />{lock.opensAt ? `נפתחת ב-${formatDate(lock.opensAt)}` : lock.reason}</Badge>}
                  </div>
                  {unit.subtitle && <p className="text-sm text-muted">{unit.subtitle}</p>}
                </div>
                <span className="text-sm font-bold tabular" aria-label={`${stats.pct} אחוז`}>{stats.pct}%</span>
              </div>
              <div className="divide-y divide-border">
                {unit.chapters.map((c) => (
                  <section key={c.id} aria-label={c.title} className="px-5 py-3">
                    <h3 className="mb-2 text-sm font-semibold text-muted">{c.title}</h3>
                    <ul className="space-y-1">
                      {c.items.map((i) => {
                        const p = ctx.progress.get(i.id);
                        const done = p?.status === "done";
                        const row = (
                          <>
                            {done ? <CheckCircle2 aria-label="הושלם" size={18} className="shrink-0 text-success" /> : <Circle aria-label={p?.status === "skipped" ? "דולג" : "לא הושלם"} size={18} className="shrink-0 text-muted" />}
                            <ItemIcon type={i.type} size={18} className="shrink-0 text-muted" />
                            <span className={cn("flex-1", done && "text-muted")}>{i.title}</span>
                            {i.durationSec > 0 && <span className="text-xs text-muted">{formatDuration(i.durationSec)}</span>}
                          </>
                        );
                        return (
                          <li key={i.id}>
                            {lock.unlocked ? (
                              <Link href={`/learn/${slug}/${i.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-muted">{row}</Link>
                            ) : (
                              <div className="flex items-center gap-3 px-2 py-2 text-muted">{row}</div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </div>
  );
}
