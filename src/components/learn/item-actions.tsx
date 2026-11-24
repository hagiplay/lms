"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Check, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, SkipForward, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { setStatusAction, toggleFavoriteAction } from "@/lib/actions/learning";

export function ItemActions(props: {
  itemId: string;
  status: "in_progress" | "done" | "skipped" | null;
  canMarkManually: boolean;
  isFavorite: boolean;
  threadCount: number;
  prevHref: string | null;
  nextHref: string | null;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const act = (fn: () => Promise<{ error?: string } | undefined>) => start(async () => setError((await fn())?.error ?? null));
  const done = props.status === "done";

  const share = async () => {
    const url = window.location.href.split("?")[0]!;
    if (navigator.share) await navigator.share({ url }).catch(() => {});
    else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.canMarkManually && (
        <button
          type="button"
          disabled={pending}
          aria-pressed={done}
          onClick={() => act(() => setStatusAction(props.itemId, done ? "reset" : "done"))}
          className={cn("inline-flex h-10 items-center gap-2 rounded-full px-4 font-semibold transition-colors", done ? "bg-success-subtle text-on-success-subtle" : "bg-accent text-on-accent hover:brightness-95")}
        >
          {done ? <><Check aria-hidden size={18} />הושלם</> : <><Check aria-hidden size={18} />סמנו כהושלם</>}
        </button>
      )}
      {!done && props.status !== "skipped" && (
        <button type="button" disabled={pending} onClick={() => act(() => setStatusAction(props.itemId, "skipped"))} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-muted hover:bg-surface-muted">
          <SkipForward aria-hidden size={18} />דלגו
        </button>
      )}
      {props.status === "skipped" && (
        <button type="button" disabled={pending} onClick={() => act(() => setStatusAction(props.itemId, "reset"))} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-muted hover:bg-surface-muted">
          <Undo2 aria-hidden size={18} />ביטול דילוג
        </button>
      )}
      <button type="button" disabled={pending} aria-pressed={props.isFavorite} onClick={() => act(() => toggleFavoriteAction(props.itemId))} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 hover:bg-surface-muted">
        <Heart aria-hidden size={18} className={props.isFavorite ? "fill-danger text-danger" : "text-muted"} />
        <span className="sr-only sm:not-sr-only">{props.isFavorite ? "במועדפים" : "למועדפים"}</span>
      </button>
      <button type="button" onClick={share} className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-muted hover:bg-surface-muted">
        <Share2 aria-hidden size={18} /><span className="sr-only sm:not-sr-only">{copied ? "הקישור הועתק" : "שיתוף"}</span>
      </button>
      <a href="?tab=discussion#tabs" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-muted hover:bg-surface-muted">
        <MessageCircle aria-hidden size={18} /><span className="tabular">{props.threadCount}</span><span className="sr-only">דיונים</span>
      </a>
      <div className="ms-auto flex gap-2">
        {props.prevHref && <Link href={props.prevHref} className="inline-flex h-10 items-center gap-1 rounded-full border border-border px-3 hover:bg-surface-muted"><ChevronRight aria-hidden size={18} />הקודם</Link>}
        {props.nextHref && <Link href={props.nextHref} className="inline-flex h-10 items-center gap-1 rounded-full bg-primary px-4 font-semibold text-on-primary hover:bg-primary-hover">הבא<ChevronLeft aria-hidden size={18} /></Link>}
      </div>
      {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
    </div>
  );
}
