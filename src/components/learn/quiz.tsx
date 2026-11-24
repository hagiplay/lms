"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { submitQuizAction } from "@/lib/actions/learning";
import { Badge, Button, Card } from "@/components/ui";

type Q = { id: string; kind: "single" | "multiple"; prompt: string; options: string[]; points: number };
type Review = { id: string; correct: number[]; explanation: string; ok: boolean };
type Result = { score: number; maxScore: number; pct: number; passed: boolean; review: Review[]; attemptsLeft: number | null };

export function QuizRunner(props: {
  itemId: string;
  introHtml: string;
  questions: Q[];
  passPct: number;
  timeLimitSec: number | null;
  attemptsLeft: number | null;
  best: { pct: number; passed: boolean } | null;
}) {
  const [stage, setStage] = useState<"intro" | "answering" | "result">("intro");
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const totalPoints = props.questions.reduce((a, q) => a + q.points, 0);
  const left = result ? result.attemptsLeft : props.attemptsLeft;
  const answeredAll = props.questions.every((q) => (answers[q.id]?.length ?? 0) > 0);

  const pick = (q: Q, idx: number) =>
    setAnswers((a) => {
      const cur = a[q.id] ?? [];
      if (q.kind === "single") return { ...a, [q.id]: [idx] };
      return { ...a, [q.id]: cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx] };
    });

  if (stage === "intro") {
    return (
      <Card className="p-6">
        {props.introHtml && <div className="prose-lms mb-4" dangerouslySetInnerHTML={{ __html: props.introHtml }} />}
        <dl className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["שאלות", `${props.questions.length} (${totalPoints} נק')`],
            ["ציון עובר", `${props.passPct}%`],
            ["מגבלת זמן", props.timeLimitSec ? `${Math.round(props.timeLimitSec / 60)} דק'` : "ללא"],
            ["ניסיונות", left == null ? "ללא הגבלה" : `נותרו ${left}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-surface-muted p-3"><dt className="text-sm text-muted">{k}</dt><dd className="font-bold">{v}</dd></div>
          ))}
        </dl>
        {props.best && <p className="mb-4 text-sm">הציון הטוב ביותר שלכם: <strong className="tabular">{props.best.pct}%</strong> {props.best.passed && <Badge tone="success">עברתם</Badge>}</p>}
        <Button disabled={left === 0 || props.questions.length === 0} onClick={() => { setAnswers({}); setStage("answering"); }}>
          {left === 0 ? "נגמרו הניסיונות" : props.best ? "ניסיון נוסף" : "התחלת המבדק"}
        </Button>
      </Card>
    );
  }

  if (stage === "result" && result) {
    return (
      <div className="space-y-4">
        <Card className={cn("p-6", result.passed ? "bg-success-subtle text-on-success-subtle" : "bg-warning-subtle text-on-warning-subtle")} role="status">
          <p className="text-3xl font-extrabold tabular">{result.pct}%</p>
          <p className="font-semibold">{result.passed ? "עברתם את המבדק! 🎉" : `עוד לא. הציון העובר הוא ${props.passPct}%`}</p>
          <p className="text-sm">{result.score} מתוך {result.maxScore} נקודות</p>
        </Card>
        <ol className="space-y-3">
          {props.questions.map((q, i) => {
            const r = result.review.find((x) => x.id === q.id);
            return (
              <li key={q.id} className="rounded-xl border border-border p-4">
                <p className="mb-2 flex items-start gap-2 font-semibold">
                  {r?.ok ? <CheckCircle2 aria-label="נכון" size={20} className="shrink-0 text-success" /> : <XCircle aria-label="שגוי" size={20} className="shrink-0 text-danger" />}
                  {i + 1}. {q.prompt}
                </p>
                <ul className="mb-2 space-y-1 text-sm">
                  {q.options.map((o, idx) => {
                    const chosen = answers[q.id]?.includes(idx);
                    const correct = r?.correct.includes(idx);
                    return (
                      <li key={idx} className={cn("rounded-lg px-3 py-1.5", correct ? "bg-success-subtle text-on-success-subtle" : chosen ? "bg-danger-subtle text-on-danger-subtle" : "")}>
                        {o} {correct ? "(נכון)" : chosen ? "(הבחירה שלכם)" : ""}
                      </li>
                    );
                  })}
                </ul>
                {r?.explanation && <p className="text-sm text-muted">{r.explanation}</p>}
              </li>
            );
          })}
        </ol>
        {!result.passed && left !== 0 && <Button variant="secondary" onClick={() => { setAnswers({}); setResult(null); setStage("answering"); }}><RotateCcw aria-hidden size={16} />ניסיון נוסף</Button>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitQuizAction(props.itemId, answers);
          if ("error" in r && r.error) setError(r.error);
          else if ("result" in r && r.result) {
            setResult(r.result);
            setStage("result");
            setError(null);
          }
        });
      }}
      className="space-y-4"
    >
      {props.questions.map((q, i) => (
        <fieldset key={q.id} className="rounded-xl border border-border p-4">
          <legend className="px-1 font-semibold">{i + 1}. {q.prompt}</legend>
          {q.kind === "multiple" && <p className="mb-2 text-xs text-muted">אפשר לבחור יותר מתשובה אחת</p>}
          <div className="space-y-2">
            {q.options.map((o, idx) => {
              const checked = answers[q.id]?.includes(idx) ?? false;
              return (
                <label key={idx} className={cn("flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2", checked ? "border-primary bg-primary-subtle" : "border-border hover:bg-surface-muted")}>
                  <input type={q.kind === "single" ? "radio" : "checkbox"} name={q.id} checked={checked} onChange={() => pick(q, idx)} className="size-4 accent-[var(--primary)]" />
                  <span>{o}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending || !answeredAll}>{pending ? "בודקים…" : "שליחת תשובות"}</Button>
        {!answeredAll && <span className="text-sm text-muted">צריך לענות על כל השאלות</span>}
      </div>
    </form>
  );
}
