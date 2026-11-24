"use client";

import { useActionState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { submitBugReport, type FormResult } from "@/lib/actions/app";
import { Button, Input, Label, Select, Textarea } from "@/components/ui";

export function BugReportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState<FormResult, FormData>(submitBugReport, {});
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="bug-title" className="m-auto w-[min(94vw,520px)] rounded-[var(--radius-card)] border border-border bg-surface p-0 text-text backdrop:bg-black/40">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h2 id="bug-title" className="text-lg font-bold">דיווח תקלה או בקשת שיפור</h2>
        <button type="button" onClick={onClose} aria-label="סגירה" className="rounded-full p-1.5 hover:bg-surface-muted"><X aria-hidden size={18} /></button>
      </div>
      {state.ok ? (
        <div className="space-y-4 p-5">
          <p role="status">תודה! הדיווח התקבל ויטופל בהקדם.</p>
          <Button onClick={onClose}>סגירה</Button>
        </div>
      ) : (
        <form action={action} className="space-y-4 p-5">
          <input type="hidden" name="pageUrl" value={typeof window !== "undefined" ? window.location.pathname : ""} />
          <div>
            <Label htmlFor="kind">סוג</Label>
            <Select id="kind" name="kind" defaultValue="bug">
              <option value="bug">תקלה</option>
              <option value="improvement">בקשת שיפור</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="subject">נושא</Label>
            <Input id="subject" name="subject" required maxLength={140} />
          </div>
          <div>
            <Label htmlFor="body">תיאור</Label>
            <Textarea id="body" name="body" required maxLength={5000} />
          </div>
          <div>
            <Label htmlFor="screenshot">צילום מסך (רשות, עד 5MB)</Label>
            <input id="screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-primary-subtle file:px-3 file:py-2 file:text-on-primary-subtle" />
          </div>
          {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>ביטול</Button>
            <Button type="submit" disabled={pending}>{pending ? "שולחים…" : "שליחה"}</Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
