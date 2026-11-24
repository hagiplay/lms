import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Bunny Stream embed with Token Authentication:
 * token = SHA256_HEX(tokenAuthKey + videoId + expires), expires = unix seconds.
 */
export function bunnyEmbedUrl(opts: {
  libraryId: string;
  videoId: string;
  tokenKey?: string;
  ttlSec?: number;
  now?: Date;
  startSec?: number;
}): string {
  const u = new URL(`https://iframe.mediadelivery.net/embed/${encodeURIComponent(opts.libraryId)}/${encodeURIComponent(opts.videoId)}`);
  if (opts.tokenKey) {
    const expires = Math.floor((opts.now ?? new Date()).getTime() / 1000) + (opts.ttlSec ?? 3600);
    const token = createHash("sha256").update(opts.tokenKey + opts.videoId + expires).digest("hex");
    u.searchParams.set("token", token);
    u.searchParams.set("expires", String(expires));
  }
  u.searchParams.set("autoplay", "false");
  u.searchParams.set("preload", "true");
  if (opts.startSec && opts.startSec > 0) u.searchParams.set("t", String(Math.floor(opts.startSec)));
  return u.toString();
}

export const hmacHex = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** Constant-time comparison of a hex HMAC signature. Accepts an optional "sha256=" prefix. */
export function verifyHmac(secret: string, body: string, signature: string | null | undefined): boolean {
  if (!secret || !signature) return false;
  const given = signature.replace(/^sha256=/, "").trim();
  if (!/^[0-9a-f]{64}$/i.test(given)) return false;
  const expected = Buffer.from(hmacHex(secret, body), "hex");
  return timingSafeEqual(expected, Buffer.from(given, "hex"));
}

/** Human-friendly verification code, no ambiguous characters (0/O, 1/I/L). */
export function verifyCode(length = 10): string {
  const alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return `${out.slice(0, 5)}-${out.slice(5)}`;
}
