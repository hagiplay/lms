"use client";

import { useMemo, useState, useTransition } from "react";
import { Clock, Download, FileText, Pencil, Search, Trash2 } from "lucide-react";
import { formatBytes, formatClock } from "@/lib/domain/format";
import { addNoteAction, deleteNoteAction, updateNoteAction } from "@/lib/actions/learning";
import { Button, EmptyState, Input, Textarea } from "@/components/ui";
import { usePlayer } from "./player";

export function SeekButton({ sec, className, children }: { sec: number; className?: string; children?: React.ReactNode }) {
  const player = usePlayer();
  return (
    <button
      type="button"
      onClick={() => player?.seek(sec)}
      className={className ?? "inline-flex items-center gap-1 rounded-md bg-primary-subtle px-1.5 py-0.5 text-xs font-semibold text-on-primary-subtle tabular hover:brightness-95"}
      aria-label={children ? undefined : `מעבר ל-${formatClock(sec)} בסרטון`}
    >
      {children ?? <><Clock aria-hidden size={12} />{formatClock(sec)}</>}
    </button>
  );
}

export function Timeline({ items }: { items: { sec: number; label: string }[] }) {
  if (!items.length) return <EmptyState title="אין פרקים לשיעור הזה" />;
  return (
    <ol className="space-y-1">
      {items.map((t) => (
        <li key={`${t.sec}-${t.label}`}>
          <SeekButton sec={t.sec} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start hover:bg-surface-muted">
            <span className="w-16 shrink-0 rounded-md bg-primary-subtle px-2 py-0.5 text-center text-sm font-semibold text-on-primary-subtle tabular">{formatClock(t.sec)}</span>
            <span>{t.label}</span>
          </SeekButton>
        </li>
      ))}
    </ol>
  );
}

export function Transcript({ text }: { text: string }) {
  const [q, setQ] = useState("");
  const lines = useMemo(() => text.split(/\n+/).filter(Boolean), [text]);
  if (!text.trim()) return <EmptyState title="אין תמלול לשיעור הזה" />;
  const shown = q.trim() ? lines.filter((l) => l.includes(q.trim())) : lines;
  return (
    <div>
      <label className="relative mb-3 block max-w-sm">
        <span className="sr-only">חיפוש בתמלול</span>
        <Search aria-hidden size={16} className="absolute start-3 top-3 text-muted" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש בתמלול" className="ps-9" />
      </label>
      <div className="max-h-[28rem] space-y-2 overflow-y-auto leading-7">
        {shown.map((l, i) => {
          const at = q.trim() ? l.indexOf(q.trim()) : -1;
          return <p key={i}>{at < 0 ? l : <>{l.slice(0, at)}<mark className="rounded bg-accent text-on-accent">{l.slice(at, at + q.trim().length)}</mark>{l.slice(at + q.trim().length)}</>}</p>;
        })}
        {shown.length === 0 && <p className="text-muted">לא נמצא</p>}
      </div>
    </div>
  );
}

export function Files({ files }: { files: { name: string; url: string; sizeBytes: number; mime: string }[] }) {
  if (!files.length) return <EmptyState title="אין קבצים לשיעור הזה" />;
  return (
    <ul className="space-y-2">
      {files.map((f) => (
        <li key={f.url} className="flex items-center gap-3 rounded-xl border border-border p-3">
          <FileText aria-hidden size={22} className="text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{f.name}</p>
            <p className="text-xs text-muted">{f.mime.split("/")[1]?.toUpperCase()} · {formatBytes(f.sizeBytes)}</p>
          </div>
          <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-surface-muted">צפייה</a>
          <a href={f.url} download className="inline-flex items-center gap-1 rounded-full bg-primary-subtle px-3 py-1.5 text-sm text-on-primary-subtle"><Download aria-hidden size={14} />הורדה</a>
        </li>
      ))}
    </ul>
  );
}

type Note = { id: string; body: string; positionSec: number | null };

export function Notes({ itemId, notes, hasVideo }: { itemId: string; notes: Note[]; hasVideo: boolean }) {
  const player = usePlayer();
  const [body, setBody] = useState("");
  const [withTime, setWithTime] = useState(hasVideo);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const act = (fn: () => Promise<{ error?: string } | undefined>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r?.error ?? null);
      if (!r?.error) after?.();
    });

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          act(() => addNoteAction(itemId, body, withTime && hasVideo ? Math.floor(player?.time ?? 0) : null), () => setBody(""));
        }}
        className="space-y-2"
      >
        <label htmlFor="note-body" className="sr-only">הערה חדשה</label>
        <Textarea id="note-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="כתבו הערה פרטית לשיעור…" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {hasVideo ? (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={withTime} onChange={(e) => setWithTime(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              לקשר לרגע הנוכחי בסרטון ({formatClock(player?.time ?? 0)})
            </label>
          ) : <span />}
          <Button type="submit" size="sm" disabled={pending || !body.trim()}>שמירת הערה</Button>
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>
      {notes.length === 0 ? (
        <EmptyState title="עוד אין הערות לשיעור הזה">ההערות פרטיות ורק אתם רואים אותן</EmptyState>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-xl border border-border p-3">
              {editing === n.id ? (
                <div className="space-y-2">
                  <label htmlFor={`edit-${n.id}`} className="sr-only">עריכת הערה</label>
                  <Textarea id={`edit-${n.id}`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={5000} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => act(() => updateNoteAction(n.id, draft), () => setEditing(null))}>שמירה</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>ביטול</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {n.positionSec != null && <SeekButton sec={n.positionSec} />}
                    <p className="mt-1 whitespace-pre-wrap">{n.body}</p>
                  </div>
                  <button type="button" onClick={() => { setEditing(n.id); setDraft(n.body); }} aria-label="עריכה" className="rounded p-1.5 text-muted hover:bg-surface-muted"><Pencil aria-hidden size={16} /></button>
                  <button type="button" disabled={pending} onClick={() => confirm("למחוק את ההערה?") && act(() => deleteNoteAction(n.id))} aria-label="מחיקה" className="rounded p-1.5 text-muted hover:bg-surface-muted"><Trash2 aria-hidden size={16} /></button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
