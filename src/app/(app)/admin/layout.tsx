import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { canManageContent } from "@/lib/domain/authz";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole("mentor");
  const links = [
    ...(canManageContent(user.role) ? [["/admin", "סקירה"], ["/admin/programs", "תוכניות ותוכן"], ["/admin/events", "מפגשים"], ["/admin/members", "משתמשים"]] : [["/admin", "סקירה"]]),
    ["/admin/reviews", "בדיקת משימות"],
    ["/admin/reports", "דיווחים"],
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <nav aria-label="ניהול" className="mb-6 flex flex-wrap gap-1 rounded-full bg-surface-muted p-1">
        {links.map(([href, label]) => (
          <Link key={href} href={href!} className="rounded-full px-4 py-1.5 text-sm font-semibold hover:bg-surface">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
