"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, type NavProgram } from "./sidebar";
import { Header, type HeaderNotification } from "./header";
import { CommandPalette } from "./command-palette";
import { BugReportDialog } from "./bug-report";

export function AppShell(props: {
  children: ReactNode;
  programs: NavProgram[];
  isStaff: boolean;
  collapsed: boolean;
  user: { firstName: string; lastName: string; email: string; avatarUrl: string | null; theme: "system" | "light" | "dark" };
  notifications: HeaderNotification[];
  unread: number;
}) {
  const [report, setReport] = useState(false);
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-on-primary">דילוג לתוכן</a>
      <Sidebar programs={props.programs} isStaff={props.isStaff} initialCollapsed={props.collapsed} onReport={() => setReport(true)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header user={props.user} notifications={props.notifications} unread={props.unread} />
        <main id="main" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{props.children}</main>
      </div>
      <CommandPalette />
      <BugReportDialog open={report} onClose={() => setReport(false)} />
    </div>
  );
}
