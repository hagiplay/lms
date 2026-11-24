import Link from "next/link";
import { count, eq, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "ניהול" };

export default async function AdminHome() {
  await requireRole("mentor");
  const [[members], [pending], [reports], [programs]] = await Promise.all([
    db.select({ n: count() }).from(s.users).where(isNull(s.users.deletedAt)),
    db.select({ n: count() }).from(s.submissions).where(eq(s.submissions.status, "submitted")),
    db.select({ n: count() }).from(s.bugReports).where(eq(s.bugReports.status, "open")),
    db.select({ n: count() }).from(s.programs),
  ]);
  const tiles = [
    ["משימות ממתינות לבדיקה", pending?.n ?? 0, "/admin/reviews"],
    ["דיווחים פתוחים", reports?.n ?? 0, "/admin/reports"],
    ["משתמשים", members?.n ?? 0, "/admin/members"],
    ["תוכניות", programs?.n ?? 0, "/admin/programs"],
  ] as const;
  return (
    <>
      <PageHeader title="ניהול" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, n, href]) => (
          <Link key={href} href={href}>
            <Card className="p-5 hover:border-primary">
              <p className="text-sm text-muted">{label}</p>
              <p className="text-3xl font-extrabold tabular">{n}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
