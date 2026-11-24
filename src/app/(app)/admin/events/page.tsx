import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { deleteEvent, saveEvent } from "@/lib/actions/admin";
import { dateToIsraelLocal, formatEventDate } from "@/lib/domain/format";
import { AdminForm } from "@/components/admin-form";
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";

export const metadata = { title: "ניהול מפגשים" };

type Ev = typeof s.events.$inferSelect;
type Co = { id: string; title: string; programTitle: string };

function EventFields({ e, cohorts }: { e?: Ev; cohorts: Co[] }) {
  const k = e?.id ?? "new";
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {e && <input type="hidden" name="id" value={e.id} />}
      <div><Label htmlFor={`t-${k}`}>כותרת</Label><Input id={`t-${k}`} name="title" defaultValue={e?.title} required /></div>
      <div>
        <Label htmlFor={`c-${k}`}>מחזור</Label>
        <Select id={`c-${k}`} name="cohortId" defaultValue={e?.cohortId ?? ""}>
          <option value="">כולם</option>
          {cohorts.map((c) => <option key={c.id} value={c.id}>{c.programTitle} · {c.title}</option>)}
        </Select>
      </div>
      <div><Label htmlFor={`s-${k}`}>מועד (שעון ישראל)</Label><Input id={`s-${k}`} name="startsAt" type="datetime-local" required defaultValue={e ? dateToIsraelLocal(e.startsAt) : ""} /></div>
      <div><Label htmlFor={`d-${k}`}>משך (דקות)</Label><Input id={`d-${k}`} name="durationMin" type="number" min={5} defaultValue={e ? Math.round((e.endsAt.getTime() - e.startsAt.getTime()) / 60000) : 60} /></div>
      <div><Label htmlFor={`cat-${k}`}>קטגוריה</Label><Input id={`cat-${k}`} name="category" defaultValue={e?.category ?? ""} placeholder="טכני / עסקי" /></div>
      <div><Label htmlFor={`j-${k}`}>קישור הצטרפות</Label><Input id={`j-${k}`} name="joinUrl" type="url" dir="ltr" defaultValue={e?.joinUrl ?? ""} /></div>
      <div>
        <Label htmlFor={`rp-${k}`}>הקלטה</Label>
        <Select id={`rp-${k}`} name="recordingProvider" defaultValue={e?.recordingProvider ?? "none"}>
          <option value="none">אין</option><option value="bunny">Bunny Stream</option><option value="url">קישור ישיר</option>
        </Select>
      </div>
      <div><Label htmlFor={`rr-${k}`}>מזהה/קישור הקלטה</Label><Input id={`rr-${k}`} name="recordingRef" dir="ltr" defaultValue={e?.recordingRef ?? ""} /></div>
      <div className="sm:col-span-2"><Label htmlFor={`desc-${k}`}>תיאור</Label><Textarea id={`desc-${k}`} name="description" defaultValue={e?.description ?? ""} /></div>
    </div>
  );
}

export default async function AdminEvents() {
  await requireRole("admin");
  const [events, cohorts] = await Promise.all([
    db.select().from(s.events).orderBy(desc(s.events.startsAt)).limit(100),
    db.select({ id: s.cohorts.id, title: s.cohorts.title, programTitle: s.programs.title }).from(s.cohorts).innerJoin(s.programs, eq(s.programs.id, s.cohorts.programId)).orderBy(asc(s.programs.title), asc(s.cohorts.startsAt)),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader title="מפגשים" />
      <Card className="p-5">
        <h2 className="mb-3 font-bold">מפגש חדש</h2>
        <AdminForm action={saveEvent} className="space-y-3" successText={null}>
          <EventFields cohorts={cohorts} />
          <Button type="submit">הוספה</Button>
        </AdminForm>
      </Card>
      {events.map((e) => (
        <details key={e.id} className="rounded-[var(--radius-card)] border border-border bg-surface">
          <summary className="cursor-pointer px-5 py-3 font-semibold">{e.title} <span className="font-normal text-muted">· {formatEventDate(e.startsAt)}</span></summary>
          <div className="space-y-3 border-t border-border p-5">
            <AdminForm action={saveEvent} className="space-y-3"><EventFields e={e} cohorts={cohorts} /><Button type="submit">שמירה</Button></AdminForm>
            <AdminForm action={deleteEvent} confirmText="למחוק את המפגש?" successText={null}><input type="hidden" name="id" value={e.id} /><Button size="sm" variant="danger">מחיקה</Button></AdminForm>
          </div>
        </details>
      ))}
    </div>
  );
}
