"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, LogOut, Menu, Monitor, Moon, Search, Sun, Trash2, User } from "lucide-react";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/domain/format";
import { changeTheme, clearAllNotifications, markNotificationsRead, removeNotification } from "@/lib/actions/app";
import { signOut } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui";

export type HeaderNotification = { id: string; title: string; body: string; href: string | null; readAt: string | null; createdAt: string };
type HeaderUser = { firstName: string; lastName: string; email: string; avatarUrl: string | null; theme: "system" | "light" | "dark" };

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function Header({ user, notifications, unread }: { user: HeaderUser; notifications: HeaderNotification[]; unread: number }) {
  const bell = usePopover();
  const menu = usePopover();
  const [, start] = useTransition();
  const [isMac, setIsMac] = useState(false);
  useEffect(() => setIsMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);

  const openBell = () => {
    bell.setOpen(!bell.open);
    if (!bell.open && unread > 0) start(() => markNotificationsRead());
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur sm:px-6">
      <button type="button" onClick={() => window.dispatchEvent(new Event("lms:open-nav"))} aria-label="פתיחת התפריט" className="rounded-full p-2 hover:bg-surface-muted lg:hidden">
        <Menu aria-hidden size={22} />
      </button>

      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event("lms:open-search"))}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4 text-muted hover:border-border-input sm:max-w-md"
      >
        <Search aria-hidden size={18} />
        <span className="truncate">חיפוש…</span>
        <kbd className="ms-auto hidden rounded border border-border px-1.5 text-xs sm:inline" dir="ltr">{isMac ? "⌘K" : "Ctrl K"}</kbd>
      </button>

      <div className="ms-auto flex items-center gap-1">
        <div ref={bell.ref} className="relative">
          <button type="button" onClick={openBell} aria-expanded={bell.open} aria-label={`התראות${unread ? `, ${unread} חדשות` : ""}`} className="relative rounded-full p-2 hover:bg-surface-muted">
            <Bell aria-hidden size={22} />
            {unread > 0 && <span className="absolute -top-0.5 -end-0.5 flex min-w-5 items-center justify-center rounded-full bg-live px-1 text-[11px] font-bold text-white tabular">{unread > 9 ? "9+" : unread}</span>}
          </button>
          {bell.open && (
            <div className="absolute end-0 top-12 w-[min(92vw,380px)] overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="font-bold">התראות</h2>
                {notifications.length > 0 && (
                  <button type="button" onClick={() => start(() => clearAllNotifications())} className="text-sm text-muted hover:text-text">נקה הכל</button>
                )}
              </div>
              <ul className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && <li className="px-4 py-8 text-center text-sm text-muted">אין התראות</li>}
                {notifications.map((n) => (
                  <li key={n.id} className={cn("group flex items-start gap-2 border-b border-border px-4 py-3 last:border-0", !n.readAt && "bg-primary-subtle/50")}>
                    <Link href={n.href ?? "#"} onClick={() => bell.setOpen(false)} className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      {n.body && <p className="line-clamp-2 text-sm text-muted">{n.body}</p>}
                      <p className="mt-1 text-xs text-muted">{relativeTime(new Date(n.createdAt))}</p>
                    </Link>
                    <button type="button" onClick={() => start(() => removeNotification(n.id))} aria-label="מחיקת ההתראה" className="rounded p-1 text-muted opacity-60 hover:opacity-100">
                      <Trash2 aria-hidden size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div ref={menu.ref} className="relative">
          <button type="button" onClick={() => menu.setOpen(!menu.open)} aria-expanded={menu.open} aria-label="תפריט משתמש" className="flex items-center gap-2 rounded-full p-1 hover:bg-surface-muted">
            <Avatar user={user} size={34} />
          </button>
          {menu.open && (
            <div className="absolute end-0 top-12 w-64 rounded-[var(--radius-card)] border border-border bg-surface p-2 shadow-xl">
              <div className="border-b border-border px-2 pb-2">
                <p className="font-semibold">{user.firstName} {user.lastName}</p>
                <p className="truncate text-xs text-muted" dir="ltr">{user.email}</p>
              </div>
              <Link href="/settings" onClick={() => menu.setOpen(false)} className="mt-1 flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-muted"><User aria-hidden size={18} />פרופיל והגדרות</Link>
              <fieldset className="px-2 py-2">
                <legend className="mb-1 text-xs text-muted">ערכת צבעים</legend>
                <div className="flex gap-1">
                  {([["light", Sun, "בהיר"], ["dark", Moon, "כהה"], ["system", Monitor, "מערכת"]] as const).map(([v, Icon, label]) => (
                    <button key={v} type="button" aria-pressed={user.theme === v} onClick={() => start(() => changeTheme(v))} className={cn("flex flex-1 flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-xs", user.theme === v ? "border-primary bg-primary-subtle text-on-primary-subtle" : "border-border hover:bg-surface-muted")}>
                      <Icon aria-hidden size={16} />{label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <form action={signOut}>
                <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-2 py-2 hover:bg-surface-muted"><LogOut aria-hidden size={18} />התנתקות</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
