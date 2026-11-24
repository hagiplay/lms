"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { BookOpen, CalendarDays, ChevronsLeft, ChevronsRight, Home, LifeBuoy, Map, NotebookPen, Settings, Shield, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { setSidebarCollapsed } from "@/lib/actions/app";

export type NavProgram = { slug: string; title: string };

export function Sidebar({ programs, isStaff, initialCollapsed, onReport }: { programs: NavProgram[]; isStaff: boolean; initialCollapsed: boolean; onReport?: () => void }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener("lms:open-nav", open);
    return () => window.removeEventListener("lms:open-nav", open);
  }, []);
  useEffect(() => setMobileOpen(false), [pathname]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    start(() => setSidebarCollapsed(next));
  };

  const items = [
    { href: "/", label: "דף הבית", icon: Home, match: (p: string) => p === "/" },
    ...programs.map((p) => ({ href: `/programs/${p.slug}`, label: p.title, icon: Map, match: (x: string) => x.startsWith(`/programs/${p.slug}`) || x.startsWith(`/learn/${p.slug}`) })),
    { href: "/events", label: "המפגשים", icon: CalendarDays, match: (p: string) => p.startsWith("/events") },
    { href: "/notes", label: "ההערות שלי", icon: NotebookPen, match: (p: string) => p.startsWith("/notes") },
    ...(isStaff ? [{ href: "/admin", label: "ניהול", icon: Shield, match: (p: string) => p.startsWith("/admin") }] : []),
    { href: "/settings", label: "הגדרות", icon: Settings, match: (p: string) => p.startsWith("/settings") },
  ];

  const nav = (compact: boolean) => (
    <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-1">
      {items.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            title={compact ? label : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-full px-3 py-2.5 font-medium transition-colors",
              active ? "bg-primary text-on-primary" : "text-text hover:bg-surface-muted",
              compact && "justify-center px-0",
            )}
          >
            <Icon aria-hidden size={20} className="shrink-0" />
            {!compact && <span className="truncate">{label}</span>}
          </Link>
        );
      })}
      <div className="mt-auto border-t border-border pt-2">
        <button type="button" onClick={onReport} title={compact ? "דיווח תקלה או שיפור" : undefined} className={cn("flex w-full items-center gap-3 rounded-full px-3 py-2.5 text-muted hover:bg-surface-muted hover:text-text", compact && "justify-center px-0")}>
          <LifeBuoy aria-hidden size={20} />
          {!compact && <span>דיווח תקלה או שיפור</span>}
        </button>
      </div>
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/" className={cn("mb-4 flex items-center gap-2 px-2 text-lg font-extrabold", compact && "justify-center px-0")}>
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-on-accent"><BookOpen aria-hidden size={20} /></span>
      {!compact && <span>למידה</span>}
    </Link>
  );

  return (
    <>
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 flex-col border-e border-border bg-surface p-3 lg:flex", collapsed ? "w-[76px]" : "w-64")}>
        {brand(collapsed)}
        {nav(collapsed)}
        <button type="button" onClick={toggle} aria-label={collapsed ? "הרחבת התפריט" : "כיווץ התפריט"} className="mt-2 flex items-center justify-center rounded-full py-2 text-muted hover:bg-surface-muted">
          {collapsed ? <ChevronsLeft aria-hidden size={18} /> : <ChevronsRight aria-hidden size={18} />}
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="תפריט">
          <button type="button" aria-label="סגירת התפריט" className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-surface p-3 shadow-xl">
            <div className="flex items-center justify-between">
              {brand(false)}
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="סגירה" className="mb-4 rounded-full p-2 hover:bg-surface-muted"><X aria-hidden size={20} /></button>
            </div>
            {nav(false)}
          </div>
        </div>
      )}
    </>
  );
}

export function AiBadge() {
  return <Sparkles aria-hidden size={16} className="text-ai" />;
}
