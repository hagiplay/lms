import "server-only";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { evaluateCertificate } from "@/lib/domain/certificate";
import { verifyCode } from "@/lib/domain/crypto";
import { fullName } from "@/lib/domain/format";
import type { ProgramContext } from "./programs";

export function certificateStatus(ctx: ProgramContext, now = new Date()) {
  const doneItemIds = new Set([...ctx.progress].filter(([, p]) => p.status === "done").map(([id]) => id));
  const titles = new Map(ctx.flat.map((i) => [i.id, i.title]));
  return evaluateCertificate(ctx.program.certificateRules, {
    points: ctx.points,
    doneItemIds,
    requiredItemIds: ctx.flat.filter((i) => i.isRequired).map((i) => i.id),
    itemTitle: (id) => titles.get(id) ?? "פריט",
    joinedAt: ctx.joinedAt,
    now,
  });
}

export async function getCertificate(userId: string, programId: string) {
  const [c] = await db.select().from(s.certificates).where(and(eq(s.certificates.userId, userId), eq(s.certificates.programId, programId)));
  return c ?? null;
}

/** Issues once; re-checks eligibility server-side. */
export async function issueCertificate(user: { id: string; firstName: string; lastName: string; email: string }, ctx: ProgramContext) {
  const existing = await getCertificate(user.id, ctx.program.id);
  if (existing) return existing;
  if (!certificateStatus(ctx).eligible) throw new Error("עוד לא עומדים בתנאים לתעודה");
  for (let attempt = 0; attempt < 3; attempt++) {
    const [c] = await db
      .insert(s.certificates)
      .values({ userId: user.id, programId: ctx.program.id, verifyCode: verifyCode(), recipientName: fullName(user) })
      .onConflictDoNothing()
      .returning();
    if (c) return c;
    const raced = await getCertificate(user.id, ctx.program.id);
    if (raced) return raced;
  }
  throw new Error("הנפקת התעודה נכשלה, נסו שוב");
}

export async function verifyCertificate(code: string) {
  const [row] = await db
    .select({ certificate: s.certificates, program: { title: s.programs.title, subtitle: s.programs.subtitle } })
    .from(s.certificates)
    .innerJoin(s.programs, eq(s.programs.id, s.certificates.programId))
    .where(eq(s.certificates.verifyCode, code.toUpperCase()))
    .limit(1);
  return row ?? null;
}
