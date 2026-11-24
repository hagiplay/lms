import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { env, supabaseEnabled } from "@/lib/env";
import { supabaseAdmin } from "@/lib/auth/supabase";

const LOCAL_ROOT = join(process.cwd(), ".data", "uploads");

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export function safePath(p: string): string {
  const n = normalize(p).replace(/^(\.\.(\/|\\|$))+/, "");
  if (n.startsWith("/") || n.includes("..") || !/^[\w\-./֐-׿ ]+$/.test(n)) throw new Error("bad path");
  return n;
}

export async function putFile(path: string, data: Uint8Array, contentType: string) {
  const p = safePath(path);
  const admin = supabaseEnabled() ? supabaseAdmin() : null;
  if (admin) {
    const { error } = await admin.storage.from(env.storageBucket).upload(p, data, { contentType, upsert: true });
    if (error) throw new Error(`upload failed: ${error.message}`);
    return p;
  }
  if (supabaseEnabled()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for uploads");
  const full = join(LOCAL_ROOT, p);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, data);
  return p;
}

/** Returns either a short-lived signed URL (Supabase) or the bytes (local). */
export async function getFile(path: string): Promise<{ redirect: string } | { bytes: Buffer } | null> {
  const p = safePath(path);
  const admin = supabaseEnabled() ? supabaseAdmin() : null;
  if (admin) {
    const { data, error } = await admin.storage.from(env.storageBucket).createSignedUrl(p, 60);
    return error || !data ? null : { redirect: data.signedUrl };
  }
  try {
    return { bytes: await readFile(join(LOCAL_ROOT, p)) };
  } catch {
    return null;
  }
}

/** Validates an uploaded File: size and an allow-list of MIME types (checked against magic bytes). */
export async function readUpload(file: File, allowed: ("pdf" | "image")[]): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  if (file.size === 0) throw new Error("הקובץ ריק");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("הקובץ גדול מ-5MB");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = Array.from(bytes.slice(0, 12));
  const is = (sig: number[], off = 0) => sig.every((b, i) => head[off + i] === b);
  const kinds: { kind: "pdf" | "image"; mime: string; ext: string; ok: boolean }[] = [
    { kind: "pdf", mime: "application/pdf", ext: "pdf", ok: is([0x25, 0x50, 0x44, 0x46]) },
    { kind: "image", mime: "image/png", ext: "png", ok: is([0x89, 0x50, 0x4e, 0x47]) },
    { kind: "image", mime: "image/jpeg", ext: "jpg", ok: is([0xff, 0xd8, 0xff]) },
    { kind: "image", mime: "image/gif", ext: "gif", ok: is([0x47, 0x49, 0x46, 0x38]) },
    { kind: "image", mime: "image/webp", ext: "webp", ok: is([0x52, 0x49, 0x46, 0x46]) && is([0x57, 0x45, 0x42, 0x50], 8) },
  ];
  const match = kinds.find((k) => k.ok && allowed.includes(k.kind));
  if (!match) throw new Error(allowed.includes("pdf") && !allowed.includes("image") ? "רק קובצי PDF" : "סוג קובץ לא נתמך");
  return { bytes, mime: match.mime, ext: match.ext };
}
