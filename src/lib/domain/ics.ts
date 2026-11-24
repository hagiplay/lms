export type IcsEvent = {
  uid: string;
  title: string;
  description?: string;
  url?: string | null;
  startsAt: Date;
  endsAt: Date;
};

const pad = (n: number) => String(n).padStart(2, "0");
export const icsDate = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

export const icsEscape = (s: string) =>
  s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 §3.1: fold lines longer than 75 octets (UTF-8 aware). */
export function foldLine(line: string): string {
  const enc = new TextEncoder();
  const parts: string[] = [];
  let cur = "";
  let curBytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = parts.length === 0 ? 75 : 74;
    if (curBytes + b > limit) {
      parts.push(cur);
      cur = "";
      curBytes = 0;
    }
    cur += ch;
    curBytes += b;
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function buildIcs(events: IcsEvent[], calName: string, now = new Date()): string {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//lms//he", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${icsEscape(calName)}`];
  for (const e of events) {
    const desc = [e.description, e.url].filter(Boolean).join("\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(e.startsAt)}`,
      `DTEND:${icsDate(e.endsAt)}`,
      `SUMMARY:${icsEscape(e.title)}`,
    );
    if (desc) lines.push(`DESCRIPTION:${icsEscape(desc)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("BEGIN:VALARM", "TRIGGER:-PT15M", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(e.title)}`, "END:VALARM", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
