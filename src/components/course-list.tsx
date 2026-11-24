"use client";

import Link from "next/link";
import { useState } from "react";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/format";
import { Badge, ProgressBar } from "@/components/ui";

export type CourseCard = {
  slug: string;
  title: string;
  subtitle: string;
  pct: number;
  done: number;
  total: number;
  lessons: number;
  quizzes: number;
  assignments: number;
  remainingSec: number;
  nextHref: string | null;
};

export function CourseList({ courses }: { courses: CourseCard[] }) {
  const [filter, setFilter] = useState<"all" | "progress" | "done">("all");
  const status = (c: CourseCard) => (c.total > 0 && c.done === c.total ? "done" : "progress");
  const counts = { all: courses.length, progress: courses.filter((c) => status(c) === "progress").length, done: courses.filter((c) => status(c) === "done").length };
  const shown = filter === "all" ? courses : courses.filter((c) => status(c) === filter);

  return (
    <section aria-labelledby="my-courses">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="my-courses" className="text-xl font-bold">התוכניות שלי</h2>
        <div role="tablist" aria-label="סינון" className="flex gap-1 rounded-full bg-surface-muted p-1">
          {([["all", "הכל"], ["progress", "בתהליך"], ["done", "הושלמו"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cn("rounded-full px-3 py-1 text-sm", filter === k ? "bg-surface font-semibold shadow-sm" : "text-muted")}>
              {label} <span className="tabular">{counts[k]}</span>
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-dashed border-border p-6 text-center text-muted">אין תוכניות בקטגוריה הזו</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => (
            <li key={c.slug} className="flex flex-col rounded-[var(--radius-card)] border border-border bg-surface p-5 shadow-[var(--shadow-card)]">
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex size-11 items-center justify-center rounded-xl bg-primary-subtle text-on-primary-subtle"><BookOpen aria-hidden size={22} /></span>
                {status(c) === "done" ? <Badge tone="success"><CheckCircle2 aria-hidden size={14} />הושלם</Badge> : <Badge tone="primary">בתהליך</Badge>}
              </div>
              <h3 className="text-lg font-bold">{c.title}</h3>
              <p className="mb-4 text-sm text-muted">{c.subtitle}</p>
              <div className="mt-auto space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted">{c.done} מתוך {c.total}</span><span className="font-bold tabular">{c.pct}%</span></div>
                <ProgressBar value={c.pct} label={`התקדמות ב${c.title}`} />
                <p className="text-xs text-muted">{c.lessons} שיעורים · {c.quizzes} מבדקים · {c.assignments} משימות{c.remainingSec ? ` · נותרו ${formatDuration(c.remainingSec)}` : ""}</p>
                <div className="flex gap-2 pt-2">
                  {c.nextHref && <Link href={c.nextHref} className="flex-1 rounded-[var(--radius-btn)] bg-primary px-3 py-2 text-center text-sm font-semibold text-on-primary hover:bg-primary-hover">המשך ללמוד</Link>}
                  <Link href={`/programs/${c.slug}`} className="flex-1 rounded-[var(--radius-btn)] border border-border px-3 py-2 text-center text-sm font-semibold hover:bg-surface-muted">למפת הלמידה</Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
