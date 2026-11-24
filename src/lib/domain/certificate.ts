import type { CertificateRules } from "./types";

export type CertificateContext = {
  points: number;
  doneItemIds: Set<string>;
  requiredItemIds: string[];
  itemTitle: (id: string) => string;
  joinedAt: Date | null;
  now: Date;
};

export type Criterion = { key: string; label: string; met: boolean; current: number; target: number };
export type CertificateEvaluation = { eligible: boolean; criteria: Criterion[] };

const DAY = 86_400_000;

export function evaluateCertificate(rules: CertificateRules, ctx: CertificateContext): CertificateEvaluation {
  const criteria: Criterion[] = [];

  if (rules.minPoints && rules.minPoints > 0) {
    criteria.push({
      key: "points",
      label: `צבירת ${rules.minPoints} נקודות`,
      met: ctx.points >= rules.minPoints,
      current: ctx.points,
      target: rules.minPoints,
    });
  }

  if (rules.requireAllRequiredItems) {
    const done = ctx.requiredItemIds.filter((id) => ctx.doneItemIds.has(id)).length;
    criteria.push({
      key: "required",
      label: "השלמת כל פריטי החובה",
      met: done === ctx.requiredItemIds.length,
      current: done,
      target: ctx.requiredItemIds.length,
    });
  }

  for (const id of rules.requiredItemIds ?? []) {
    const met = ctx.doneItemIds.has(id);
    criteria.push({ key: `item:${id}`, label: `השלמת "${ctx.itemTitle(id)}"`, met, current: met ? 1 : 0, target: 1 });
  }

  if (rules.minDaysSinceJoin && rules.minDaysSinceJoin > 0) {
    const days = ctx.joinedAt ? Math.floor((ctx.now.getTime() - ctx.joinedAt.getTime()) / DAY) : 0;
    criteria.push({
      key: "days",
      label: `${rules.minDaysSinceJoin} ימים מההצטרפות`,
      met: days >= rules.minDaysSinceJoin,
      current: Math.max(0, days),
      target: rules.minDaysSinceJoin,
    });
  }

  return { eligible: criteria.length > 0 && criteria.every((c) => c.met), criteria };
}
