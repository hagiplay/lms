import Link from "next/link";
import { asc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { createProgram } from "@/lib/actions/admin";
import { AdminForm } from "@/components/admin-form";
import { Badge, Button, Card, Input, Label, PageHeader } from "@/components/ui";

export const metadata = { title: "תוכניות" };

export default async function AdminPrograms() {
  await requireRole("admin");
  const programs = await db.select().from(s.programs).orderBy(asc(s.programs.title));
  return (
    <>
      <PageHeader title="תוכניות ותוכן" />
      <ul className="mb-6 space-y-2">
        {programs.map((p) => (
          <li key={p.id}>
            <Link href={`/admin/programs/${p.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:border-primary">
              <span className="flex-1 font-semibold">{p.title}</span>
              <span className="text-sm text-muted" dir="ltr">/{p.slug}</span>
              {p.isPublished ? <Badge tone="success">מפורסם</Badge> : <Badge>טיוטה</Badge>}
            </Link>
          </li>
        ))}
      </ul>
      <Card className="p-5">
        <h2 className="mb-3 font-bold">תוכנית חדשה</h2>
        <AdminForm action={createProgram} className="flex flex-wrap items-end gap-3" successText={null}>
          <div className="min-w-48 flex-1"><Label htmlFor="title">שם</Label><Input id="title" name="title" required /></div>
          <div className="min-w-48 flex-1"><Label htmlFor="slug">slug (באנגלית)</Label><Input id="slug" name="slug" required dir="ltr" pattern="[a-z0-9-]+" /></div>
          <Button type="submit">יצירה</Button>
        </AdminForm>
      </Card>
    </>
  );
}
