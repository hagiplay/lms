"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TabDef = { key: string; label: string; count?: number; content: ReactNode };

/** WAI-ARIA tabs with arrow-key navigation; the active tab is kept in ?tab= so it can be linked. */
export function Tabs({ tabs, defaultKey }: { tabs: TabDef[]; defaultKey: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const requested = params.get("tab");
  const active = tabs.some((t) => t.key === requested) ? requested! : defaultKey;

  const select = (key: string, focus = false) => {
    const sp = new URLSearchParams(params);
    sp.set("tab", key);
    router.replace(`?${sp.toString()}`, { scroll: false });
    if (focus) refs.current[tabs.findIndex((t) => t.key === key)]?.focus();
  };

  return (
    <div id="tabs">
      <div role="tablist" aria-label="תוכן השיעור" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            id={`${id}-tab-${t.key}`}
            aria-selected={active === t.key}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={active === t.key ? 0 : -1}
            onClick={() => select(t.key)}
            onKeyDown={(e) => {
              // RTL: ArrowLeft moves to the next tab.
              const dir = e.key === "ArrowLeft" ? 1 : e.key === "ArrowRight" ? -1 : 0;
              if (dir) {
                e.preventDefault();
                select(tabs[(i + dir + tabs.length) % tabs.length]!.key, true);
              }
            }}
            className={cn("-mb-px shrink-0 border-b-2 px-4 py-3 font-semibold whitespace-nowrap", active === t.key ? "border-primary text-primary" : "border-transparent text-muted hover:text-text")}
          >
            {t.label}
            {t.count != null && t.count > 0 && <span className="ms-1.5 rounded-full bg-surface-muted px-1.5 text-xs tabular">{t.count}</span>}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.key} role="tabpanel" id={`${id}-panel-${t.key}`} aria-labelledby={`${id}-tab-${t.key}`} hidden={active !== t.key} className="py-5">
          {active === t.key && t.content}
        </div>
      ))}
    </div>
  );
}
