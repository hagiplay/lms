"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BookOpen, FileText, HelpCircle, ListChecks, Map, PlayCircle, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/format";

type Hit = { kind: "program" | "item" | "transcript"; id: string; title: string; subtitle: string; href: string; itemType?: string; durationSec?: number; snippet?: string };
const TABS = [
  { key: "all", label: "הכל" },
  { key: "program", label: "תוכניות" },
  { key: "item", label: "שיעורים" },
  { key: "transcript", label: "בתמלול" },
] as const;
const typeIcon = { video: PlayCircle, text: FileText, quiz: HelpCircle, assignment: ListChecks } as Record<string, typeof PlayCircle>;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lms:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lms:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => input.current?.focus(), 0);
    else {
      setQ("");
      setHits([]);
    }
  }, [open]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (res.ok) setHits(((await res.json()) as { hits: Hit[] }).hits);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const shown = tab === "all" ? hits : hits.filter((h) => h.kind === tab);
  useEffect(() => setActive(0), [q, tab]);

  if (!open) return null;

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    router.push(h.href);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 p-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-label="חיפוש" className="w-full max-w-2xl overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search aria-hidden size={20} className="text-muted" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, shown.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter") go(shown[active]);
            }}
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls={listId}
            aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
            placeholder="חיפוש שיעורים, תוכניות ותמלולים…"
            className="h-14 flex-1 bg-transparent text-lg outline-none"
          />
          <kbd className="rounded border border-border px-1.5 text-xs text-muted">Esc</kbd>
        </div>
        <div role="tablist" aria-label="סינון תוצאות" className="flex gap-1 border-b border-border px-3 py-2">
          {TABS.map((t) => {
            const n = t.key === "all" ? hits.length : hits.filter((h) => h.kind === t.key).length;
            return (
              <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => { setTab(t.key); input.current?.focus(); }} className={cn("rounded-full px-3 py-1 text-sm", tab === t.key ? "bg-primary-subtle font-semibold text-on-primary-subtle" : "text-muted hover:bg-surface-muted")}>
                {t.label} <span className="tabular">{n}</span>
              </button>
            );
          })}
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {q.trim().length < 2 && <li className="px-3 py-6 text-center text-sm text-muted">הקלידו לפחות 2 תווים</li>}
          {q.trim().length >= 2 && !loading && shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-muted">לא נמצאו תוצאות</li>}
          {shown.map((h, i) => {
            const Icon = h.kind === "program" ? Map : (typeIcon[h.itemType ?? ""] ?? BookOpen);
            return (
              <li key={`${h.kind}-${h.id}`} id={`${listId}-${i}`} role="option" aria-selected={i === active} onMouseEnter={() => setActive(i)} onClick={() => go(h)} className={cn("flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5", i === active && "bg-surface-muted")}>
                <Icon aria-hidden size={20} className="mt-0.5 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{h.title}</p>
                  <p className="truncate text-sm text-muted">{h.snippet || h.subtitle}</p>
                </div>
                {h.durationSec ? <span className="shrink-0 text-xs text-muted">{formatDuration(h.durationSec)}</span> : null}
              </li>
            );
          })}
        </ul>
        <div className="flex gap-4 border-t border-border px-4 py-2 text-xs text-muted">
          <span>↑↓ ניווט</span><span>Enter פתיחה</span><span>Esc סגירה</span>
        </div>
      </div>
    </div>
  );
}
