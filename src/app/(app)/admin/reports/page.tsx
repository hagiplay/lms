import { desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { setReportStatus } from "@/lib/actions/admin";
import { relativeTime } from "@/lib/domain/format";
import { AdminForm } from "@/components/admin-form";
import { Badge, Button, Card, EmptyState, PageHeader, Select } from "@/components/ui";

export const metadata = { title: "דיווחים" };

export default async function Reports() {
  await requireRole("mentor");
  const rows = await db
    .select({ r: s.bugReports, user: { firstName: s.users.firstName, lastName: s.users.lastName } })
    .from(s.bugReports)
    .leftJoin(s.users, eq(s.users.id, s.bugReports.userId))
    .orderBy(desc(s.bugReports.createdAt))
    .limit(200);
  return (
    <div className="space-y-4">
      <PageHeader title="דיווחי תקלות ובקשות שיפור" />
      {rows.length === 0 && <EmptyState title="אין דיווחים" />}
      {rows.map(({ r, user }) => (
        <Card key={r.id} className="p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone={r.kind === "bug" ? "danger" : "info"}>{r.kind === "bug" ? "תקלה" : "שיפור"}</Badge>
            <span className="font-bold">{r.subject}</span>
            <span className="text-sm text-muted">{user ? `${user.firstName} ${user.lastName}` : "משתמש שנמחק"} · {relativeTime(r.createdAt)}</span>
          </div>
          {r.pageUrl && <p className="text-xs text-muted" dir="ltr">{r.pageUrl}</p>}
          <p className="my-2 whitespace-pre-wrap">{r.body}</p>
          {r.screenshotPath && <a href={`/api/files/${r.screenshotPath}`} target="_blank" className="text-sm text-primary underline">צילום מסך</a>}
          <AdminForm action={setReportStatus} className="mt-3 flex items-center gap-2" successText={null}>
            <input type="hidden" name="id" value={r.id} />
            <Select name="status" defaultValue={r.status} aria-label="סטטוס" className="w-40"><option value="open">פתוח</option><option value="in_progress">בטיפול</option><option value="closed">סגור</option></Select>
            <Button size="sm" variant="secondary" type="submit">עדכון</Button>
          </AdminForm>
        </Card>
      ))}
    </div>
  );
}
