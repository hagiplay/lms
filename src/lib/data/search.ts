import "server-only";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { listUserPrograms } from "./programs";
import type { Role } from "@/lib/domain/types";

export type SearchHit = {
  kind: "program" | "item" | "transcript";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  itemType?: string;
  durationSec?: number;
  snippet?: string;
};

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => `\\${c}`);

function snippet(text: string, q: string, radius = 60): string {
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return "";
  const start = Math.max(0, i - radius);
  return `${start > 0 ? "…" : ""}${text.slice(start, i + q.length + radius).replace(/\s+/g, " ")}${i + q.length + radius < text.length ? "…" : ""}`;
}

/** Substring search over the user's programs, item titles and transcripts (pg_trgm-indexed). */
export async function search(user: { id: string; role: Role }, raw: string): Promise<SearchHit[]> {
  const q = raw.trim().slice(0, 100);
  if (q.length < 2) return [];
  const programs = (await listUserPrograms(user)).map((r) => r.program);
  if (!programs.length) return [];
  const ids = programs.map((p) => p.id);
  const pattern = `%${escapeLike(q)}%`;

  const hits: SearchHit[] = programs
    .filter((p) => p.title.toLowerCase().includes(q.toLowerCase()) || p.subtitle.toLowerCase().includes(q.toLowerCase()))
    .map((p) => ({ kind: "program", id: p.id, title: p.title, subtitle: p.subtitle, href: `/programs/${p.slug}` }));

  const rows = await db
    .select({
      id: s.items.id,
      title: s.items.title,
      type: s.items.type,
      durationSec: s.items.durationSec,
      slug: s.programs.slug,
      programTitle: s.programs.title,
      transcript: s.lessonContents.transcript,
      titleHit: sql<boolean>`${s.items.title} ilike ${pattern}`,
    })
    .from(s.items)
    .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
    .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
    .innerJoin(s.programs, eq(s.programs.id, s.units.programId))
    .leftJoin(s.lessonContents, eq(s.lessonContents.itemId, s.items.id))
    .where(and(inArray(s.programs.id, ids), eq(s.items.isPublished, true), or(ilike(s.items.title, pattern), ilike(s.lessonContents.transcript, pattern), ilike(s.lessonContents.overviewMd, pattern))))
    .limit(40);

  for (const r of rows) {
    const base = { id: r.id, title: r.title, subtitle: r.programTitle, href: `/learn/${r.slug}/${r.id}`, itemType: r.type, durationSec: r.durationSec };
    if (r.titleHit) hits.push({ kind: "item", ...base });
    else hits.push({ kind: "transcript", ...base, href: `${base.href}?tab=transcript`, snippet: snippet(r.transcript ?? "", q) });
  }
  return hits;
}
