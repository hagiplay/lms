import { asc, eq, ilike, isNull, or, and } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { enrollUser, setEnrollmentStatus, setRole } from "@/lib/actions/admin";
import { atLeast } from "@/lib/domain/authz";
import { AdminForm } from "@/components/admin-form";
import { Badge, Button, Card, Input, Label, PageHeader, Select } from "@/components/ui";
import { NotesFilter } from "../../notes/notes-filter";

export const metadata = { title: "משתמשים" };
const roleLabel = { member: "חבר/ה", mentor: "מנחה", admin: "מנהל/ת", owner: "בעלים" } as const;

export default async function Members({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requireRole("admin");
  const q = ((await searchParams).q ?? "").trim();
  const [users, cohorts, enr] = await Promise.all([
    db.select().from(s.users).where(and(isNull(s.users.deletedAt), q ? or(ilike(s.users.email, `%${q}%`), ilike(s.users.firstName, `%${q}%`), ilike(s.users.lastName, `%${q}%`)) : undefined)).orderBy(asc(s.users.firstName)).limit(200),
    db.select({ id: s.cohorts.id, title: s.cohorts.title, programTitle: s.programs.title }).from(s.cohorts).innerJoin(s.programs, eq(s.programs.id, s.cohorts.programId)),
    db.select({ e: s.enrollments, cohortTitle: s.cohorts.title, programTitle: s.programs.title }).from(s.enrollments).innerJoin(s.cohorts, eq(s.cohorts.id, s.enrollments.cohortId)).innerJoin(s.programs, eq(s.programs.id, s.cohorts.programId)),
  ]);
  const isOwner = atLeast(me.role, "owner");

  return (
    <div className="space-y-6">
      <PageHeader title="משתמשים" subtitle="רכישה דרך הסליקה יוצרת הרשמה אוטומטית. כאן אפשר להוסיף ידנית." />
      <Card className="p-5">
        <h2 className="mb-3 font-bold">הרשמה ידנית לתוכנית</h2>
        <AdminForm action={enrollUser} className="grid gap-3 sm:grid-cols-4" successText="נרשם/ה">
          <div><Label htmlFor="en-email">אימייל</Label><Input id="en-email" name="email" type="email" dir="ltr" required /></div>
          <div><Label htmlFor="en-first">שם פרטי</Label><Input id="en-first" name="firstName" /></div>
          <div><Label htmlFor="en-last">שם משפחה</Label><Input id="en-last" name="lastName" /></div>
          <div><Label htmlFor="en-cohort">מחזור</Label><Select id="en-cohort" name="cohortId" required>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.programTitle} · {c.title}</option>)}</Select></div>
          <Button type="submit" className="sm:col-span-4 sm:w-fit">הרשמה</Button>
        </AdminForm>
      </Card>
      <NotesFilter initial={q} placeholder="חיפוש לפי שם או אימייל" />
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{u.firstName} {u.lastName}</span>
              <span className="text-sm text-muted" dir="ltr">{u.email}</span>
              <Badge tone={u.role === "member" ? "neutral" : "primary"}>{roleLabel[u.role]}</Badge>
              {isOwner && u.id !== me.id && (
                <AdminForm action={setRole} className="ms-auto flex items-center gap-2" successText={null}>
                  <input type="hidden" name="id" value={u.id} />
                  <Select name="role" defaultValue={u.role} aria-label={`תפקיד של ${u.firstName}`} className="h-8 w-32 text-sm">{Object.entries(roleLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
                  <Button size="sm" variant="secondary" type="submit">שינוי</Button>
                </AdminForm>
              )}
            </div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {enr.filter((x) => x.e.userId === u.id).map(({ e, cohortTitle, programTitle }) => (
                <li key={e.id}>
                  <AdminForm action={setEnrollmentStatus} className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-sm" successText={null}>
                    <input type="hidden" name="id" value={e.id} />
                    <span>{programTitle} · {cohortTitle}</span>
                    <Badge tone={e.status === "active" ? "success" : "neutral"}>{e.status === "active" ? "פעיל" : e.status === "refunded" ? "הוחזר" : "בוטל"}</Badge>
                    <input type="hidden" name="status" value={e.status === "active" ? "cancelled" : "active"} />
                    <button type="submit" className="text-xs text-primary underline">{e.status === "active" ? "ביטול גישה" : "הפעלה"}</button>
                  </AdminForm>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
