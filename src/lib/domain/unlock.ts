import type { UnlockRule } from "./types";

export type UnlockContext = {
  now: Date;
  cohortStartsAt: Date | null;
  /** Percentage (0-100) of a unit the user has completed. */
  unitPct: (unitId: string) => number;
  unitTitle?: (unitId: string) => string | undefined;
};

export type UnlockResult = { unlocked: true } | { unlocked: false; opensAt?: Date; reason: string };

const DAY = 86_400_000;

export function evaluateUnlock(rule: UnlockRule, ctx: UnlockContext): UnlockResult {
  switch (rule.type) {
    case "none":
      return { unlocked: true };
    case "date": {
      const at = new Date(rule.at);
      if (Number.isNaN(at.getTime())) return { unlocked: true };
      return ctx.now >= at ? { unlocked: true } : { unlocked: false, opensAt: at, reason: "נפתח בתאריך" };
    }
    case "cohort_offset_days": {
      if (!ctx.cohortStartsAt) return { unlocked: true };
      const at = new Date(ctx.cohortStartsAt.getTime() + rule.days * DAY);
      return ctx.now >= at ? { unlocked: true } : { unlocked: false, opensAt: at, reason: "נפתח בתאריך" };
    }
    case "prerequisite": {
      const pct = ctx.unitPct(rule.unitId);
      if (pct >= rule.minPct) return { unlocked: true };
      const name = ctx.unitTitle?.(rule.unitId) ?? "היחידה הקודמת";
      return { unlocked: false, reason: `נפתח אחרי השלמת ${rule.minPct}% מ"${name}"` };
    }
  }
}
