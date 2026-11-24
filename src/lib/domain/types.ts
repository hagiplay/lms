export type Role = "member" | "mentor" | "admin" | "owner";
export type ItemType = "video" | "text" | "quiz" | "assignment";
export type ProgressStatus = "in_progress" | "done" | "skipped";

export type UnlockRule =
  | { type: "none" }
  | { type: "date"; at: string }
  | { type: "cohort_offset_days"; days: number }
  | { type: "prerequisite"; unitId: string; minPct: number };

export type CertificateRules = {
  /** Minimum points from the points ledger. */
  minPoints?: number;
  /** Every item flagged is_required must be done. */
  requireAllRequiredItems?: boolean;
  /** Specific items that must be done (e.g. the capstone). */
  requiredItemIds?: string[];
  /** Days since joining the cohort. */
  minDaysSinceJoin?: number;
};

export type OutlineItem = {
  id: string;
  type: ItemType;
  title: string;
  durationSec: number;
  isRequired: boolean;
  points: number;
  position: number;
};

export type OutlineChapter = { id: string; title: string; position: number; items: OutlineItem[] };

export type OutlineUnit = {
  id: string;
  title: string;
  subtitle: string;
  position: number;
  unlockRule: UnlockRule;
  chapters: OutlineChapter[];
};

export type ItemProgress = {
  status: ProgressStatus;
  positionSec: number;
  watchedPct: number;
  lastSeenAt: Date;
};

export type ProgressMap = Map<string, ItemProgress>;
