import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { buildIcs, foldLine, icsDate, icsEscape } from "@/lib/domain/ics";
import { bunnyEmbedUrl, hmacHex, verifyCode, verifyHmac } from "@/lib/domain/crypto";
import { formatCountdown, formatDuration, formatClock, greeting } from "@/lib/domain/format";
import { renderMarkdown } from "@/lib/domain/markdown";
import { paymentEventSchema } from "@/lib/domain/webhook";

describe("ics", () => {
  it("formats UTC dates and escapes text", () => {
    expect(icsDate(new Date("2026-11-24T17:00:00Z"))).toBe("20261124T170000Z");
    expect(icsEscape("a,b;c\nd\\")).toBe("a\\,b\;c\\nd\\\\");
  });
  it("folds long UTF-8 lines at 75 octets", () => {
    const line = "SUMMARY:" + "מפגש תמיכה טכני ".repeat(10);
    const folded = foldLine(line);
    for (const part of folded.split("\r\n")) expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe(line);
  });
  it("builds a calendar with alarm", () => {
    const ics = buildIcs([{ uid: "e1@lms", title: "מפגש", startsAt: new Date("2026-11-24T17:00:00Z"), endsAt: new Date("2026-11-24T18:00:00Z"), url: "https://zoom.us/j/1" }], "יומן", new Date("2026-11-01T00:00:00Z"));
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261124T170000Z");
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("crypto", () => {
  it("bunny token = sha256(key + videoId + expires)", () => {
    const url = new URL(bunnyEmbedUrl({ libraryId: "123", videoId: "abc", tokenKey: "k", ttlSec: 60, now: new Date(1_000_000_000_000) }));
    const expires = String(1_000_000_000 + 60);
    expect(url.searchParams.get("expires")).toBe(expires);
    expect(url.searchParams.get("token")).toBe(createHash("sha256").update("kabc" + expires).digest("hex"));
    expect(url.pathname).toBe("/embed/123/abc");
  });
  it("bunny without key has no token", () => expect(bunnyEmbedUrl({ libraryId: "1", videoId: "v" })).not.toContain("token="));
  it("verifies HMAC in constant time, with optional prefix", () => {
    const sig = hmacHex("s3cret", "{}");
    expect(verifyHmac("s3cret", "{}", sig)).toBe(true);
    expect(verifyHmac("s3cret", "{}", `sha256=${sig}`)).toBe(true);
    expect(verifyHmac("s3cret", "{ }", sig)).toBe(false);
    expect(verifyHmac("s3cret", "{}", "zz")).toBe(false);
    expect(verifyHmac("", "{}", sig)).toBe(false);
    expect(verifyHmac("s3cret", "{}", null)).toBe(false);
  });
  it("verify codes are unambiguous", () => {
    for (let i = 0; i < 50; i++) expect(verifyCode()).toMatch(/^[2-9A-HJKMNP-Z]{5}-[2-9A-HJKMNP-Z]{5}$/);
  });
});

describe("format", () => {
  it("duration", () => {
    expect(formatDuration(540)).toBe("9 דק'");
    expect(formatDuration(3600 * 2 + 600)).toBe("2 ש' 10 דק'");
    expect(formatDuration(0)).toBe("");
  });
  it("clock", () => expect(formatClock(3725)).toBe("1:02:05"));
  it("countdown matches the PRD phrasing", () => {
    expect(formatCountdown((11 * 3600 + 26 * 60 + 40) * 1000)).toBe("11 שעות, 26 דקות ו-40 שניות");
    expect(formatCountdown(61_000)).toBe("דקה ושנייה");
    expect(formatCountdown(0)).toBe("מתחילים עכשיו");
  });
  it("greeting uses Israel time", () => {
    expect(greeting(new Date("2026-11-24T06:00:00Z"))).toBe("בוקר טוב");
    expect(greeting(new Date("2026-11-24T21:30:00Z"))).toBe("לילה טוב");
  });
});

describe("markdown", () => {
  it("renders basics", () => {
    const h = renderMarkdown("# כותרת\n\nטקסט **מודגש** ו-`code`\n\n- א\n- ב\n\n1. ראשון");
    expect(h).toContain("<h2>כותרת</h2>");
    expect(h).toContain("<strong>מודגש</strong>");
    expect(h).toContain("<code>code</code>");
    expect(h).toContain("<ul><li>א</li><li>ב</li></ul>");
    expect(h).toContain("<ol><li>ראשון</li></ol>");
  });
  it("escapes HTML and blocks dangerous links", () => {
    const h = renderMarkdown('<script>alert(1)</script> [x](javascript:alert(1)) [y](https://a.com/?a=1&b="2") <img src=x onerror=1>');
    expect(h).not.toMatch(/<script|<img|javascript:/i);
    expect(h).toContain('href="https://a.com/?a=1&amp;b=&quot;2&quot;"');
    expect(h).toContain("&lt;script&gt;");
  });
  it("keeps code fences verbatim and escaped", () => {
    expect(renderMarkdown("```\n<b>x</b>\n```")).toBe('<pre dir="ltr"><code>&lt;b&gt;x&lt;/b&gt;</code></pre>');
  });
});

describe("payment webhook schema", () => {
  it("requires cohort or program", () => {
    expect(paymentEventSchema.safeParse({ id: "1", type: "payment.succeeded", email: "a@b.co" }).success).toBe(false);
    expect(paymentEventSchema.safeParse({ id: "1", type: "payment.succeeded", email: "a@b.co", programSlug: "x" }).success).toBe(true);
    expect(paymentEventSchema.safeParse({ id: "1", type: "payment.succeeded", email: "bad", programSlug: "x" }).success).toBe(false);
  });
});

import { dateToIsraelLocal, israelLocalToDate } from "@/lib/domain/format";
describe("Israel local time", () => {
  it("winter (UTC+2) and summer (UTC+3)", () => {
    expect(israelLocalToDate("2026-11-25T19:00").toISOString()).toBe("2026-11-25T17:00:00.000Z");
    expect(israelLocalToDate("2026-07-01T19:00").toISOString()).toBe("2026-07-01T16:00:00.000Z");
  });
  it("round-trips and rejects garbage", () => {
    expect(dateToIsraelLocal(new Date("2026-11-25T17:00:00Z"))).toBe("2026-11-25T19:00");
    expect(dateToIsraelLocal(israelLocalToDate("2026-03-29T12:30"))).toBe("2026-03-29T12:30");
    expect(Number.isNaN(israelLocalToDate("nope").getTime())).toBe(true);
  });
});
