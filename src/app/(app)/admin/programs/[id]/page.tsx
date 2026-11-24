import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { loadOutline } from "@/lib/data/programs";
import { createCohort, createItem, deleteChapter, deleteCohort, deleteUnit, saveChapter, saveUnit, updateProgram } from "@/lib/actions/admin";
import { AdminForm } from "@/components/admin-form";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { ItemIcon } from "@/components/learn/item-icon";
import { dateToIsraelLocal, formatDate } from "@/lib/domain/format";
import type { UnlockRule } from "@/lib/domain/types";

export const metadata = { title: "עריכת תוכנית" };


function UnlockFields({ rule, units, selfId }: { rule: UnlockRule; units: { id: string; title: string }[]; selfId?: string }) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-4">
      <legend className="mb-1 text-sm font-semibold">פתיחת היחידה</legend>
      <Select name="unlockType" defaultValue={rule.type} aria-label="כלל פתיחה">
        <option value="none">פתוחה תמיד</option>
        <option value="date">בתאריך</option>
        <option value="cohort_offset_days">X ימים מתחילת המחזור</option>
        <option value="prerequisite">אחרי השלמת יחידה</option>
      </Select>
      <Input name="unlockDate" type="datetime-local" aria-label="תאריך פתיחה" defaultValue={rule.type === "date" ? dateToIsraelLocal(new Date(rule.at)) : ""} />
      <Input name="unlockDays" type="number" min={0} aria-label="ימים מתחילת המחזור" placeholder="ימים" defaultValue={rule.type === "cohort_offset_days" ? rule.days : ""} />
      <div className="flex gap-2">
        <Select name="unlockUnitId" aria-label="יחידה קודמת" defaultValue={rule.type === "prerequisite" ? rule.unitId : ""}>
          <option value="">יחידה…</option>
          {units.filter((u) => u.id !== selfId).map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
        </Select>
        <Input name="unlockPct" type="number" min={1} max={100} aria-label="אחוז השלמה" placeholder="%" className="w-20" defaultValue={rule.type === "prerequisite" ? rule.minPct : 100} />
      </div>
    </fieldset>
  );
}

export default async function AdminProgram({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [program] = await db.select().from(s.programs).where(eq(s.programs.id, id));
  if (!program) notFound();
  const [units, cohorts] = await Promise.all([loadOutline(id, true), db.select().from(s.cohorts).where(eq(s.cohorts.programId, id)).orderBy(asc(s.cohorts.startsAt))]);
  const allItems = units.flatMap((u) => u.chapters.flatMap((c) => c.items));
  const rules = program.certificateRules;

  return (
    <div className="space-y-6">
      <PageHeader title={program.title} subtitle={<Link href={`/programs/${program.slug}`} className="text-primary underline">צפייה כתלמיד/ה</Link>} />

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-bold">פרטי התוכנית ותעודה</h2>
        <AdminForm action={updateProgram} className="space-y-4">
          <input type="hidden" name="id" value={program.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="p-title">שם</Label><Input id="p-title" name="title" defaultValue={program.title} required /></div>
            <div><Label htmlFor="p-slug">slug</Label><Input id="p-slug" name="slug" defaultValue={program.slug} dir="ltr" required /></div>
            <div><Label htmlFor="p-sub">תת-כותרת</Label><Input id="p-sub" name="subtitle" defaultValue={program.subtitle} /></div>
            <div><Label htmlFor="p-price">מחיר (₪)</Label><Input id="p-price" name="priceShekels" type="number" min={0} step="0.01" defaultValue={program.priceAgorot / 100} /></div>
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={program.isPublished} className="size-4" />מפורסמת (גלויה לתלמידים רשומים)</label>
          <fieldset className="rounded-xl border border-border p-4">
            <legend className="px-1 font-semibold">תנאי תעודה</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label htmlFor="minPoints">מינימום נקודות</Label><Input id="minPoints" name="minPoints" type="number" min={0} defaultValue={rules.minPoints ?? ""} /></div>
              <div><Label htmlFor="minDays">ימים מההצטרפות</Label><Input id="minDays" name="minDaysSinceJoin" type="number" min={0} defaultValue={rules.minDaysSinceJoin ?? ""} /></div>
            </div>
            <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="requireAllRequiredItems" defaultChecked={rules.requireAllRequiredItems} className="size-4" />חובה להשלים את כל פריטי החובה</label>
            <Label htmlFor="reqItems" className="mt-3">פריטים ספציפיים שחובה להשלים (למשל משימת סיום)</Label>
            <select id="reqItems" name="requiredItemIds" multiple defaultValue={rules.requiredItemIds ?? []} className="h-32 w-full rounded-[var(--radius-btn)] border border-border-input bg-surface p-2">
              {allItems.map((i) => <option key={i.id} value={i.id}>{i.title}</option>)}
            </select>
          </fieldset>
          <Button type="submit">שמירה</Button>
        </AdminForm>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-bold">מחזורים</h2>
        <ul className="mb-4 space-y-2">
          {cohorts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3">
              <span className="font-semibold">{c.title}</span>
              <span className="text-sm text-muted">מתחיל {formatDate(c.startsAt)}</span>
              {c.isEvergreen && <Badge tone="info">פתוח תמיד</Badge>}
              <span className="text-xs text-muted" dir="ltr">{c.id}</span>
              <AdminForm action={deleteCohort} className="ms-auto" confirmText="למחוק את המחזור וכל ההרשמות אליו?" successText={null}>
                <input type="hidden" name="id" value={c.id} />
                <Button size="sm" variant="danger">מחיקה</Button>
              </AdminForm>
            </li>
          ))}
        </ul>
        <AdminForm action={createCohort} className="grid gap-3 sm:grid-cols-3" successText="נוצר">
          <input type="hidden" name="programId" value={program.id} />
          <div><Label htmlFor="c-title">שם</Label><Input id="c-title" name="title" placeholder="מחזור 2" /></div>
          <div><Label htmlFor="c-start">התחלה</Label><Input id="c-start" name="startsAt" type="datetime-local" required /></div>
          <div><Label htmlFor="c-zoom">קישור זום קבוע</Label><Input id="c-zoom" name="zoomUrl" type="url" dir="ltr" /></div>
          <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" name="isEvergreen" className="size-4" />פתוח תמיד (קורס עצמאי, לא מחזור)</label>
          <Button type="submit" variant="secondary">הוספת מחזור</Button>
        </AdminForm>
      </Card>

      <section className="space-y-4">
        <h2 className="text-lg font-bold">יחידות, פרקים ופריטים</h2>
        {units.map((u) => (
          <Card key={u.id} className="p-5">
            <AdminForm action={saveUnit} className="space-y-3">
              <input type="hidden" name="id" value={u.id} />
              <input type="hidden" name="programId" value={program.id} />
              <div className="grid gap-3 sm:grid-cols-[80px_1fr_1fr]">
                <div><Label htmlFor={`pos-${u.id}`}>מיקום</Label><Input id={`pos-${u.id}`} name="position" type="number" defaultValue={u.position} /></div>
                <div><Label htmlFor={`t-${u.id}`}>שם היחידה</Label><Input id={`t-${u.id}`} name="title" defaultValue={u.title} required /></div>
                <div><Label htmlFor={`st-${u.id}`}>תיאור</Label><Input id={`st-${u.id}`} name="subtitle" defaultValue={u.subtitle} /></div>
              </div>
              <UnlockFields rule={u.unlockRule} units={units} selfId={u.id} />
              <Button type="submit" size="sm" variant="secondary">שמירת יחידה</Button>
            </AdminForm>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {u.chapters.map((c) => (
                <div key={c.id} className="rounded-xl bg-surface-muted p-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <AdminForm action={saveChapter} className="flex flex-1 flex-wrap items-end gap-2" successText={null}>
                      <input type="hidden" name="id" value={c.id} />
                      <Input name="position" type="number" defaultValue={c.position} aria-label="מיקום הפרק" className="w-20" />
                      <Input name="title" defaultValue={c.title} aria-label="שם הפרק" className="min-w-48 flex-1" required />
                      <Button type="submit" size="sm" variant="secondary">שמירה</Button>
                    </AdminForm>
                    <AdminForm action={deleteChapter} confirmText="למחוק את הפרק וכל הפריטים בו?" successText={null}>
                      <input type="hidden" name="id" value={c.id} />
                      <Button size="sm" variant="danger">מחיקה</Button>
                    </AdminForm>
                  </div>
                  <ul className="mt-2 space-y-1">
                    {c.items.map((i) => (
                      <li key={i.id}>
                        <Link href={`/admin/items/${i.id}`} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 hover:ring-1 hover:ring-primary">
                          <span className="w-6 text-xs text-muted tabular">{i.position}</span>
                          <ItemIcon type={i.type} size={16} className="text-muted" />
                          <span className="flex-1">{i.title}</span>
                          {i.points > 0 && <span className="text-xs text-muted">{i.points} נק&apos;</span>}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <AdminForm action={createItem} className="mt-2 flex flex-wrap gap-2" successText={null}>
                    <input type="hidden" name="chapterId" value={c.id} />
                    <Select name="type" aria-label="סוג פריט" className="w-36">
                      <option value="video">שיעור וידאו</option>
                      <option value="text">קריאה</option>
                      <option value="quiz">מבדק</option>
                      <option value="assignment">משימה</option>
                    </Select>
                    <Input name="title" placeholder="שם הפריט" aria-label="שם הפריט" className="min-w-48 flex-1" />
                    <Button type="submit" size="sm">הוספת פריט</Button>
                  </AdminForm>
                </div>
              ))}
              <div className="flex flex-wrap items-end justify-between gap-2">
                <AdminForm action={saveChapter} className="flex flex-wrap gap-2" successText={null}>
                  <input type="hidden" name="unitId" value={u.id} />
                  <Input name="title" placeholder="שם פרק חדש" aria-label="שם פרק חדש" required className="min-w-48" />
                  <Button type="submit" size="sm" variant="secondary">הוספת פרק</Button>
                </AdminForm>
                <AdminForm action={deleteUnit} confirmText="למחוק את היחידה, הפרקים והפריטים שבה?" successText={null}>
                  <input type="hidden" name="id" value={u.id} />
                  <Button size="sm" variant="danger">מחיקת היחידה</Button>
                </AdminForm>
              </div>
            </div>
          </Card>
        ))}
        <Card className="p-5">
          <h3 className="mb-3 font-bold">יחידה חדשה</h3>
          <AdminForm action={saveUnit} className="space-y-3" successText={null}>
            <input type="hidden" name="programId" value={program.id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="title" placeholder="שם היחידה" aria-label="שם היחידה" required />
              <Input name="subtitle" placeholder="תיאור" aria-label="תיאור" />
            </div>
            <UnlockFields rule={{ type: "none" }} units={units} />
            <Button type="submit">הוספת יחידה</Button>
          </AdminForm>
        </Card>
      </section>
    </div>
  );
}
