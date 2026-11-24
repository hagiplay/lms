export const TZ = "Asia/Jerusalem";

export function greeting(now: Date): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  if (h >= 5 && h < 12) return "בוקר טוב";
  if (h >= 12 && h < 16) return "צהריים טובים";
  if (h >= 16 && h < 21) return "ערב טוב";
  return "לילה טוב";
}

export function formatDuration(sec: number): string {
  if (sec <= 0) return "";
  const m = Math.round(sec / 60);
  if (m < 60) return `${Math.max(1, m)} דק'`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ש' ${rest} דק'` : `${h} ש'`;
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function formatEventDate(d: Date): string {
  const day = new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: TZ }).format(d);
  const date = new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "short", timeZone: TZ }).format(d);
  const time = new Intl.DateTimeFormat("he-IL", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ }).format(d);
  return `${day}, ${date} ${time}`;
}

export function formatDate(d: Date): string {
  return new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric", timeZone: TZ }).format(d);
}

export function relativeTime(d: Date, now = new Date()): string {
  const diff = Math.round((d.getTime() - now.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("he", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(diff, "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  return formatDate(d);
}

/** "11 שעות, 26 דקות ו-40 שניות" (PRD 4.4). */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return "מתחילים עכשיו";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const parts: string[] = [];
  if (d) parts.push(d === 1 ? "יום" : `${d} ימים`);
  if (h) parts.push(h === 1 ? "שעה" : `${h} שעות`);
  if (m) parts.push(m === 1 ? "דקה" : `${m} דקות`);
  if (s || parts.length === 0) parts.push(s === 1 ? "שנייה" : `${s} שניות`);
  if (parts.length === 1) return parts[0]!;
  const last = parts.pop()!;
  return `${parts.join(", ")} ו${/^\d/.test(last) ? "-" : ""}${last}`;
}

export const fullName = (u: { firstName: string; lastName: string; email?: string }) =>
  `${u.firstName} ${u.lastName}`.trim() || u.email || "";

export const initials = (u: { firstName: string; lastName: string }) =>
  `${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}`.toUpperCase() || "?";

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
