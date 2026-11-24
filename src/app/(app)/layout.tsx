import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth/session";
import { listUserPrograms } from "@/lib/data/programs";
import { listNotifications, unreadCount } from "@/lib/data/notifications";
import { isStaff } from "@/lib/domain/authz";
import { AppShell } from "@/components/shell/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [programs, notifications, unread, jar] = await Promise.all([listUserPrograms(user), listNotifications(user.id, 20), unreadCount(user.id), cookies()]);
  return (
    <AppShell
      programs={programs.map((p) => ({ slug: p.program.slug, title: p.program.title }))}
      isStaff={isStaff(user.role)}
      collapsed={jar.get("sidebar")?.value === "collapsed"}
      user={{ firstName: user.firstName, lastName: user.lastName, email: user.email, avatarUrl: user.avatarUrl, theme: user.theme }}
      notifications={notifications.map((n) => ({ id: n.id, title: n.title, body: n.body, href: n.href, readAt: n.readAt?.toISOString() ?? null, createdAt: n.createdAt.toISOString() }))}
      unread={unread}
    >
      {children}
    </AppShell>
  );
}
