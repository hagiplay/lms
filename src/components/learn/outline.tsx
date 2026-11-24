"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, Circle, Lock, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/format";
import { ProgressBar } from "@/components/ui";
import { ItemIcon } from "./item-icon";
import type { ItemType } from "@/lib/domain/types";

export type OutlineView = {
  slug: string;
  title: string;
  pct: number;
  counters: { label: string; done: number; total: number }[];
  remaining: string;
  units: {
    id: string;
    title: string;
    locked: boolean;
    lockLabel?: string;
    chapters: { id: string; title: string; items: { id: string; title: string; type: ItemType; durationSec: number; status: "done" | "skipped" | "in_progress" | null }[] }[];
  }[];
};

export function Outline({ data, currentId }: { data: OutlineView; currentId: string }) {
  const [q, setQ] = useState("");
  const currentUnit = data.units.find((u) => u.chapters.some((c) => c.items.some((i) => i.id === currentId)))?.id;
  const [open, setOpen] = useState<Set<string>>(new Set(currentUnit ? [currentUnit] : []));
  const term = q.trim();

  const units = useMemo(
    () =>
      term
        ? data.units.map((u) => ({ ...u, chapters: u.chapters.map((c) => ({ ...c, items: c.items.filter((i) => i.title.includes(term)) })).filter((c) => c.items.length) })).filter((u) => u.chapters.length)
        : data.units,
    [data.units, term],
  );

  return (
    <nav aria-label="תוכנית הקורס" className="flex flex-col">
      <div className="border-b border-border p-4">
        <Link href={`/programs/${data.slug}`} className="font-bold hover:underline">{data.title}</Link>
        <div className="mt-2 flex items-center gap-2"><ProgressBar value={data.pct} label="התקדמות" /><span className="text-sm font-bold tabular">{data.pct}%</span></div>
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
          {data.counters.map((c) => <div key={c.label} className="flex justify-between"><dt>{c.label}</dt><dd className="tabular">{c.done}/{c.total}</dd></div>)}
          {data.remaining && <div className="flex justify-between"><dt>נותר</dt><dd>{data.remaining}</dd></div>}
        </dl>
        <label className="relative mt-3 block">
          <span className="sr-only">חיפוש שיעור</span>
          <Search aria-hidden size={15} className="absolute start-3 top-2.5 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש שיעור" className="h-9 w-full rounded-full border border-border bg-surface ps-8 pe-3 text-sm" />
        </label>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {units.map((u) => {
          const isOpen = Boolean(term) || open.has(u.id);
          const all = u.chapters.flatMap((c) => c.items);
          const done = all.filter((i) => i.status === "done").length;
          return (
            <li key={u.id} className="border-b border-border">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen((s) => { const n = new Set(s); if (n.has(u.id)) n.delete(u.id); else n.add(u.id); return n; })}
                className="flex w-full items-center gap-2 px-4 py-3 text-start font-semibold hover:bg-surface-muted"
              >
                {u.locked && <Lock aria-label="נעולה" size={15} className="shrink-0 text-locked" />}
                <span className="flex-1">{u.title}</span>
                <span className="text-xs font-normal text-muted tabular">{done}/{all.length}</span>
                <ChevronDown aria-hidden size={16} className={cn("transition-transform", isOpen && "rotate-180")} />
              </button>
              {isOpen && (
                <div className="pb-2">
                  {u.locked && u.lockLabel && <p className="px-4 pb-2 text-xs text-muted">{u.lockLabel}</p>}
                  {u.chapters.map((c) => (
                    <div key={c.id}>
                      <p className="px-4 pt-2 pb-1 text-xs font-semibold text-muted">{c.title}</p>
                      <ul>
                        {c.items.map((i) => {
                          const current = i.id === currentId;
                          const inner = (
                            <>
                              {i.status === "done" ? <CheckCircle2 aria-label="הושלם" size={17} className="shrink-0 text-success" /> : <Circle aria-label={i.status === "skipped" ? "דולג" : "לא הושלם"} size={17} className="shrink-0 text-muted" />}
                              <span className={cn("flex-1 text-sm", i.status === "done" && "text-muted line-through decoration-1")}>{i.title}</span>
                              <ItemIcon type={i.type} size={15} className="shrink-0 text-muted" />
                              {i.durationSec > 0 && <span className="w-12 shrink-0 text-end text-xs text-muted">{formatDuration(i.durationSec)}</span>}
                            </>
                          );
                          return (
                            <li key={i.id}>
                              {u.locked ? (
                                <div className="flex items-center gap-2 px-4 py-2 text-muted">{inner}</div>
                              ) : (
                                <Link href={`/learn/${data.slug}/${i.id}`} aria-current={current ? "page" : undefined} className={cn("flex items-center gap-2 border-s-4 px-3 py-2 hover:bg-surface-muted", current ? "border-primary bg-primary-subtle font-semibold" : "border-transparent")}>
                                  {inner}
                                </Link>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {units.length === 0 && <li className="p-4 text-center text-sm text-muted">לא נמצא</li>}
      </ul>
    </nav>
  );
}
