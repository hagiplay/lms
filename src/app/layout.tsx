import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/heebo/600.css";
import "@fontsource/heebo/700.css";
import "@fontsource/heebo/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "פלטפורמת למידה", template: "%s · פלטפורמת למידה" },
  description: "קורסים, תרגול ומפגשים חיים במקום אחד",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8FAFC" },
    { media: "(prefers-color-scheme: dark)", color: "#0F172A" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("theme")?.value;
  return (
    <html lang="he" dir="rtl" data-theme={theme === "light" || theme === "dark" ? theme : undefined} suppressHydrationWarning>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
