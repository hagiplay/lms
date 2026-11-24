"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, HelpCircle, Megaphone, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/domain/format";
import { acceptAnswerAction, createThreadAction, deleteMessageAction, deleteThreadAction, replyAction } from "@/lib/actions/learning";
import { Avatar, Badge, Button, EmptyState, Textarea } from "@/components/ui";
import { usePlayer } from "./player";
import { SeekButton } from "./lesson-panels";

type Author = { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: string; headline: string };
export type ThreadView = {
  thread: { id: string; kind: "question" | "share"; body: string; acceptedMessageId: string | null; videoSec: number | null; createdAt: string; authorId: string };
  author: Author;
  replies: { message: { id: string; body: string; createdAt: string; authorId: string }; author: Author }[];
};

const staffRoles = new Set(["mentor", "admin", "owner"]);

function Byline({ a, at }: { a: Author; at: string }) {
  return (
    <div className="flex items-center gap-2">
      <Avatar user={a} size={30} />
      <div className="min-w-0">
        <p className="text-sm font-semibold">
          {a.firstName} {a.lastName} {staffRoles.has(a.role) && <Badge tone="primary" className="ms-1">צוות</Badge>}
        </p>
        <p className="truncate text-xs text-muted">{a.headline ? `${a.headline} · ` : ""}{relativeTime(new Date(at))}</p>
      </div>
    </div>
  );
}

export function Discussion({ itemId, threads, me, hasVideo }: { itemId: string; threads: ThreadView[]; me: { id: string; role: string }; hasVideo: boolean }) {
  const player = usePlayer();
  const [kind, setKind] = useState<"question" | "share">("question");
  const [body, setBody] = useState("");
  const [sort, setSort] = useState<"new" | "top">("new");
  const [error, setError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const isStaff = staffRoles.has(me.role);
  const act = (fn: () => Promise<{ error?: string } | undefined>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setError(r?.error ?? null);
      if (!r?.error) after?.();
    });

  const sorted = sort === "new" ? threads : [...threads].sort((a, b) => b.replies.length - a.replies.length);

  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); act(() => createThreadAction(itemId, kind, body, hasVideo ? Math.floor(player?.time ?? 0) || null : null), () => setBody("")); }} className="space-y-2 rounded-xl border border-border p-3">
        <fieldset className="flex gap-2">
          <legend className="sr-only">סוג ההודעה</legend>
          {([["question", "שאלה", HelpCircle], ["share", "שיתוף", Megaphone]] as const).map(([k, label, Icon]) => (
            <label key={k} className={cn("flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm", kind === k ? "border-primary bg-primary-subtle text-on-primary-subtle" : "border-border")}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <Icon aria-hidden size={15} />{label}
            </label>
          ))}
        </fieldset>
        <label htmlFor="thread-body" className="sr-only">ההודעה שלכם</label>
        <Textarea id="thread-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={4000} placeholder={kind === "question" ? "מה לא ברור? פרטו כמה שיותר" : "מה בניתם? שתפו את הקבוצה"} />
        <div className="flex justify-end"><Button type="submit" size="sm" disabled={pending || !body.trim()}>פרסום</Button></div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </form>

      {threads.length > 1 && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted">מיון:</span>
          {([["new", "חדשות"], ["top", "פופולריות"]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={sort === k} onClick={() => setSort(k)} className={cn("rounded-full px-3 py-1", sort === k ? "bg-surface-muted font-semibold" : "text-muted")}>{label}</button>
          ))}
        </div>
      )}

      {threads.length === 0 && <EmptyState title="עדיין אין דיון בשיעור הזה">היו הראשונים לשאול או לשתף</EmptyState>}

      <ul className="space-y-4">
        {sorted.map(({ thread: t, author, replies }) => {
          const answered = Boolean(t.acceptedMessageId);
          const canAccept = t.kind === "question" && (t.authorId === me.id || isStaff);
          return (
            <li key={t.id} id={`t-${t.id}`} className="rounded-xl border border-border p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <Byline a={author} at={t.createdAt} />
                <div className="flex items-center gap-1">
                  {t.kind === "question" ? <Badge tone={answered ? "success" : "warning"}>{answered ? "נענתה" : "ממתינה לתשובה"}</Badge> : <Badge>שיתוף</Badge>}
                  {(t.authorId === me.id || me.role === "admin" || me.role === "owner") && (
                    <button type="button" aria-label="מחיקת הדיון" onClick={() => confirm("למחוק את הדיון?") && act(() => deleteThreadAction(t.id))} className="rounded p-1 text-muted hover:bg-surface-muted"><Trash2 aria-hidden size={15} /></button>
                  )}
                </div>
              </div>
              {t.videoSec != null && <SeekButton sec={t.videoSec} />}
              <p className="mt-1 whitespace-pre-wrap">{t.body}</p>

              {replies.length > 0 && (
                <ul className="mt-3 space-y-3 border-s-2 border-border ps-4">
                  {replies.map(({ message: m, author: a }) => {
                    const accepted = t.acceptedMessageId === m.id;
                    return (
                      <li key={m.id} className={cn("rounded-lg p-2", accepted && "bg-success-subtle")}>
                        <div className="flex items-start justify-between gap-2">
                          <Byline a={a} at={m.createdAt} />
                          <div className="flex items-center gap-1">
                            {accepted && <Badge tone="success"><CheckCircle2 aria-hidden size={13} />תשובה נבחרת</Badge>}
                            {canAccept && (
                              <button type="button" disabled={pending} onClick={() => act(() => acceptAnswerAction(t.id, accepted ? null : m.id))} className="rounded-full px-2 py-0.5 text-xs text-muted hover:bg-surface-muted">
                                {accepted ? "ביטול בחירה" : "סימון כתשובה נבחרת"}
                              </button>
                            )}
                            {(m.authorId === me.id || me.role === "admin" || me.role === "owner") && (
                              <button type="button" aria-label="מחיקת התגובה" onClick={() => confirm("למחוק את התגובה?") && act(() => deleteMessageAction(m.id))} className="rounded p-1 text-muted hover:bg-surface-muted"><Trash2 aria-hidden size={14} /></button>
                            )}
                          </div>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-[15px]">{m.body}</p>
                      </li>
                    );
                  })}
                </ul>
              )}

              <form onSubmit={(e) => { e.preventDefault(); act(() => replyAction(t.id, replyDrafts[t.id] ?? ""), () => setReplyDrafts((d) => ({ ...d, [t.id]: "" }))); }} className="mt-3 flex gap-2">
                <label htmlFor={`reply-${t.id}`} className="sr-only">תגובה</label>
                <input id={`reply-${t.id}`} value={replyDrafts[t.id] ?? ""} onChange={(e) => setReplyDrafts((d) => ({ ...d, [t.id]: e.target.value }))} maxLength={4000} placeholder="כתבו תגובה…" className="h-9 flex-1 rounded-full border border-border-input bg-surface px-3 text-sm" />
                <Button type="submit" size="sm" variant="secondary" disabled={pending || !(replyDrafts[t.id] ?? "").trim()}>שליחה</Button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
