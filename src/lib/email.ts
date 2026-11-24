import "server-only";
import { env } from "@/lib/env";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export async function sendEmail(to: string, subject: string, text: string, href?: string): Promise<void> {
  const link = href ? `${env.appUrl}${href}` : "";
  if (!env.resendKey || !env.emailFrom) {
    if (process.env.NODE_ENV !== "test") console.info(`[email:dev] to=${to} subject=${subject} ${link}`);
    return;
  }
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6">
<p>${esc(text)}</p>${link ? `<p><a href="${esc(link)}">לצפייה</a></p>` : ""}</div>`;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.emailFrom, to, subject, html, text: link ? `${text}\n${link}` : text }),
    });
    if (!res.ok) console.error(`[email] resend failed ${res.status}`);
  } catch (e) {
    console.error("[email] resend error", e);
  }
}
