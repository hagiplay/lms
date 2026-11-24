import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/domain/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent" | "ai";
const variants: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-surface text-text border border-border hover:bg-surface-muted",
  ghost: "text-text hover:bg-surface-muted",
  danger: "bg-danger-subtle text-on-danger-subtle hover:opacity-90",
  accent: "bg-accent text-on-accent hover:brightness-95",
  ai: "bg-ai text-on-ai hover:opacity-90",
};
const sizes = { sm: "h-8 px-3 text-sm gap-1.5", md: "h-10 px-4 text-[15px] gap-2", lg: "h-12 px-5 text-base gap-2" };

export function buttonClass(variant: Variant = "primary", size: keyof typeof sizes = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-[var(--radius-btn)] font-semibold whitespace-nowrap transition-colors disabled:opacity-50 disabled:pointer-events-none",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...p }: ComponentProps<"button"> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <button {...p} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({ variant = "primary", size = "md", className, ...p }: ComponentProps<typeof Link> & { variant?: Variant; size?: keyof typeof sizes }) {
  return <Link {...p} className={buttonClass(variant, size, className)} />;
}

export function Card({ className, ...p }: ComponentProps<"div">) {
  return <div {...p} className={cn("rounded-[var(--radius-card)] border border-border bg-surface shadow-[var(--shadow-card)]", className)} />;
}

type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info" | "ai" | "live";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  primary: "bg-primary-subtle text-on-primary-subtle",
  success: "bg-success-subtle text-on-success-subtle",
  warning: "bg-warning-subtle text-on-warning-subtle",
  danger: "bg-danger-subtle text-on-danger-subtle",
  info: "bg-info-subtle text-on-info-subtle",
  ai: "bg-ai-subtle text-on-ai-subtle",
  live: "bg-live text-white",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", tones[tone], className)}>{children}</span>;
}

export function ProgressBar({ value, label, className, tone = "primary" }: { value: number; label: string; className?: string; tone?: "primary" | "accent" }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={cn("h-2 w-full overflow-hidden rounded-full", tone === "accent" ? "bg-white/20" : "bg-surface-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width]", tone === "accent" ? "bg-accent" : "bg-primary")} style={{ width: `${v}%` }} />
    </div>
  );
}

export function Avatar({ user, size = 36 }: { user: { firstName: string; lastName: string; avatarUrl?: string | null }; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.38 };
  if (user.avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.avatarUrl} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span aria-hidden style={style} className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary-subtle font-bold text-on-primary-subtle">
      {initials(user)}
    </span>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border px-6 py-10 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted">{children}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

const field = "w-full rounded-[var(--radius-btn)] border border-border-input bg-surface px-3 text-text placeholder:text-muted";
export function Input({ className, ...p }: ComponentProps<"input">) {
  return <input {...p} className={cn(field, "h-10", className)} />;
}
export function Textarea({ className, ...p }: ComponentProps<"textarea">) {
  return <textarea {...p} className={cn(field, "min-h-24 py-2", className)} />;
}
export function Select({ className, ...p }: ComponentProps<"select">) {
  return <select {...p} className={cn(field, "h-10", className)} />;
}
export function Label({ className, ...p }: ComponentProps<"label">) {
  return <label {...p} className={cn("mb-1 block text-sm font-semibold", className)} />;
}
