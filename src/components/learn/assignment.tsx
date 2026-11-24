"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { Clock, FileText } from "lucide-react";
import { cn } from "@/lib/cn";
import { submitAssignmentAction, toggleStepAction } from "@/lib/actions/learning";
import { Badge, Button, Card, Input, Label, ProgressBar, Textarea } from "@/components/ui";

type Submission = { status: "submitted" | "needs_changes" | "approved"; linkUrl: string | null; fileName: string | null; filePath: string | null; notes: string; mentorFeedback: string | null } | null;

const statusView = {
  submitted: { tone: "info" as const, label: "הוגשה, ממתינה לבדיקה" },
  needs_changes: { tone: "warning" as const, label: "נדרשים תיקונים" },
  approved: { tone: "success" as const, label: "אושרה" },
};

export function AssignmentView(props: {
  itemId: string;
  briefHtml: string;
  estMinutes: number;
  steps: { id: string; text: string }[];
  checkedIds: string[];
  requiresSubmission: boolean;
  submission: Submission;
}) {
  const [, start] = useTransition();
  const [checked, setChecked] = useOptimistic(new Set(props.checkedIds), (cur, { id, on }: { id: string; on: boolean }) => {
    const n = new Set(cur);
    if (on) n.add(id);
    else n.delete(id);
    return n;
  });
  const [state, submit, pending] = useActionState(submitAssignmentAction, undefined);
  const pct = props.steps.length ? (checked.size / props.steps.length) * 100 : 0;
  const sub = props.submission;

  return (
    <div className="space-y-5">
      {props.estMinutes > 0 && <p className="flex items-center gap-1.5 text-sm text-muted"><Clock aria-hidden size={16} />זמן עבודה משוער: {props.estMinutes} דקות</p>}
      {props.briefHtml && <div className="prose-lms" dangerouslySetInnerHTML={{ __html: props.briefHtml }} />}

      {props.steps.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">שלבי המשימה</h2>
            <span className="text-sm text-muted tabular">{checked.size} מתוך {props.steps.length} סומנו</span>
          </div>
          <ProgressBar value={pct} label="התקדמות במשימה" className="mb-4" />
          <ol className="space-y-2">
            {props.steps.map((st, i) => {
              const on = checked.has(st.id);
              return (
                <li key={st.id}>
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5", on ? "border-success bg-success-subtle" : "border-border hover:bg-surface-muted")}>
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) => {
                        const v = e.target.checked;
                        start(async () => {
                          setChecked({ id: st.id, on: v });
                          await toggleStepAction(props.itemId, st.id, v);
                        });
                      }}
                      className="mt-1 size-4 accent-[var(--success)]"
                    />
                    <span className={cn(on && "line-through opacity-75")}><span className="font-semibold tabular">{i + 1}.</span> {st.text}</span>
                  </label>
                </li>
              );
            })}
          </ol>
          {/* Server-confirmed state only: the optimistic set can run ahead of a request that has not been saved yet. */}
          {!props.requiresSubmission && props.steps.length > 0 && props.checkedIds.length === props.steps.length && <p role="status" className="mt-3 font-semibold text-success">כל השלבים סומנו, המשימה הושלמה ✓</p>}
        </Card>
      )}

      {props.requiresSubmission && (
        <Card className="p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold">הגשה לבדיקה</h2>
            {sub && <Badge tone={statusView[sub.status].tone}>{statusView[sub.status].label}</Badge>}
          </div>
          {sub?.mentorFeedback && (
            <div className="mb-4 rounded-xl bg-surface-muted p-3">
              <p className="text-sm font-semibold">תגובת המנחה</p>
              <p className="whitespace-pre-wrap">{sub.mentorFeedback}</p>
            </div>
          )}
          {sub?.status === "approved" ? (
            <p className="text-muted">המשימה אושרה. אין צורך בהגשה נוספת.</p>
          ) : (
            <form action={submit} className="space-y-3">
              <input type="hidden" name="itemId" value={props.itemId} />
              <div>
                <Label htmlFor="linkUrl">קישור (תרשים, סרטון, ריפו)</Label>
                <Input id="linkUrl" name="linkUrl" type="url" dir="ltr" defaultValue={sub?.linkUrl ?? ""} placeholder="https://" />
              </div>
              <div>
                <Label htmlFor="file">או קובץ PDF (עד 5MB)</Label>
                {sub?.fileName && (
                  <p className="mb-1 flex items-center gap-1.5 text-sm">
                    <FileText aria-hidden size={15} />
                    <a href={`/api/files/${sub.filePath}`} className="underline">{sub.fileName}</a>
                    <input type="hidden" name="keepFile" value="1" />
                  </p>
                )}
                <input id="file" name="file" type="file" accept="application/pdf" className="block w-full text-sm file:me-3 file:rounded-lg file:border-0 file:bg-primary-subtle file:px-3 file:py-2 file:text-on-primary-subtle" />
              </div>
              <div>
                <Label htmlFor="notes">הערות (רשות, עד 500 תווים)</Label>
                <Textarea id="notes" name="notes" maxLength={500} defaultValue={sub?.notes ?? ""} />
              </div>
              {state?.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
              <Button type="submit" disabled={pending}>{pending ? "מגישים…" : sub ? "עדכון ההגשה" : "הגשת המשימה"}</Button>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
