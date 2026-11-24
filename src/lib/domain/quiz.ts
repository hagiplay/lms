export type GradableQuestion = { id: string; kind: "single" | "multiple"; correct: number[]; points: number; optionCount: number };

export type GradeResult = {
  score: number;
  maxScore: number;
  pct: number;
  passed: boolean;
  perQuestion: Record<string, boolean>;
};

const sameSet = (a: number[], b: number[]) => {
  const sa = new Set(a);
  const sb = new Set(b);
  if (sa.size !== sb.size) return false;
  for (const x of sa) if (!sb.has(x)) return false;
  return true;
};

/** All-or-nothing per question; multiple-choice requires the exact set. */
export function gradeQuiz(qs: GradableQuestion[], answers: Record<string, number[]>, passPct: number): GradeResult {
  let score = 0;
  let maxScore = 0;
  const perQuestion: Record<string, boolean> = {};
  for (const q of qs) {
    maxScore += q.points;
    const raw = answers[q.id] ?? [];
    const valid = raw.filter((n) => Number.isInteger(n) && n >= 0 && n < q.optionCount);
    const given = q.kind === "single" ? valid.slice(0, 1) : valid;
    const ok = given.length > 0 && sameSet(given, q.correct);
    perQuestion[q.id] = ok;
    if (ok) score += q.points;
  }
  const pct = maxScore ? Math.round((score / maxScore) * 100) : 0;
  return { score, maxScore, pct, passed: maxScore > 0 && pct >= passPct, perQuestion };
}

export function attemptsLeft(maxAttempts: number | null, used: number): number | null {
  return maxAttempts == null ? null : Math.max(0, maxAttempts - used);
}
