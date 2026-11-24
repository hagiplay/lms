import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { FileText } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { reviewAction } from "@/lib/actions/admin";
import { relativeTime } from "@/lib/domain/format";
import { AdminForm } from "@/components/admin-form";
import { Badge, Button, Card, EmptyState, Label, PageHeader, Textarea } from "@/components/ui";

export const metadata = { title: "בדיקת משימות" };

export default async function Reviews({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  await requireRole("mentor");
  const showAll = (await searchParams).all === "1";
  const rows = await db
    .select({ sub: s.submissions, user: { firstName: s.users.firstName, lastName: s.users.lastName, email: s.users.email }, item: { id: s.items.id, title: s.items.title }, slug: s.programs.slug })
    .from(s.submissions)
    .innerJoin(s.users, eq(s.users.id, s.submissions.userId))
    .innerJoin(s.items, eq(s.items.id, s.submissions.assignmentItemId))
    .innerJoin(s.chapters, eq(s.chapters.id, s.items.chapterId))
    .innerJoin(s.units, eq(s.units.id, s.chapters.unitId))
    .innerJoin(s.programs, eq(s.programs.id, s.units.programId))
    .where(showAll ? undefined : inArray(s.submissions.status, ["submitted"]))
    .orderBy(showAll ? desc(s.submissions.updatedAt) : asc(s.submissions.updatedAt))
    .limit(100);

  return (
    <div className="space-y-4">
      <PageHeader title="בדיקת משימות" subtitle={showAll ? "כל ההגשות" : "ממתינות לבדיקה, הוותיקות קודם"} actions={<Link href={showAll ? "?" : "?all=1"} className="text-sm font-semibold text-primary underline">{showAll ? "רק ממתינות" : "כל ההגשות"}</Link>} />
      {rows.length === 0 && <EmptyState title="אין הגשות ממתינות 🎉" />}
      {rows.map(({ sub, user, item, slug }) => (
        <Card key={sub.id} className="p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-bold">{user.firstName} {user.lastName}</span>
            <span className="text-sm text-muted" dir="ltr">{user.email}</span>
            <Badge tone={sub.status === "approved" ? "success" : sub.status === "needs_changes" ? "warning" : "info"}>{sub.status === "approved" ? "אושרה" : sub.status === "needs_changes" ? "נדרשים תיקונים" : "ממתינה"}</Badge>
            <span className="text-sm text-muted">{relativeTime(sub.updatedAt)}</span>
          </div>
          <p className="mb-2"><Link href={`/learn/${slug}/${item.id}`} className="text-primary underline">{item.title}</Link></p>
          <div className="mb-3 space-y-1 text-sm">
            {sub.linkUrl && <p>קישור: <a href={sub.linkUrl} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline" dir="ltr">{sub.linkUrl}</a></p>}
            {sub.filePath && <p className="flex items-center gap-1.5"><FileText aria-hidden size={15} /><a href={`/api/files/${sub.filePath}`} target="_blank" className="text-primary underline">{sub.fileName ?? "קובץ"}</a></p>}
            {sub.notes && <p className="whitespace-pre-wrap rounded-lg bg-surface-muted p-2">{sub.notes}</p>}
          </div>
          <AdminForm action={reviewAction} className="space-y-2" successText="נשלח לתלמיד/ה">
            <input type="hidden" name="id" value={sub.id} />
            <Label htmlFor={`fb-${sub.id}`}>תגובת מנחה</Label>
            <Textarea id={`fb-${sub.id}`} name="feedback" defaultValue={sub.mentorFeedback ?? ""} />
            <div className="flex gap-2">
              <Button type="submit" name="decision" value="approved">אישור</Button>
              <Button type="submit" name="decision" value="needs_changes" variant="secondary">החזרה לתיקונים</Button>
            </div>
          </AdminForm>
        </Card>
      ))}
    </div>
  );
}
