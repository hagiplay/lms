"use client";

import { useActionState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { AdminState } from "@/lib/actions/admin";

/** Wraps an admin server action, showing its error/success inline. */
export function AdminForm({
  action,
  children,
  className,
  confirmText,
  successText = "נשמר",
}: {
  action: (s: AdminState, f: FormData) => Promise<AdminState>;
  children: ReactNode;
  className?: string;
  confirmText?: string;
  successText?: string | null;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} onSubmit={confirmText ? (e) => !window.confirm(confirmText) && e.preventDefault() : undefined} className={cn(className, pending && "opacity-70")} aria-busy={pending}>
      {children}
      {state.error && <p role="alert" className="mt-2 w-full text-sm text-danger">{state.error}</p>}
      {state.ok && successText && <p role="status" className="mt-2 w-full text-sm text-success">{successText}</p>}
    </form>
  );
}
