"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { DEV_COOKIE, signDevSession } from "@/lib/auth/session";
import { supabaseServer } from "@/lib/auth/supabase";
import { devLoginEnabled, env, supabaseEnabled } from "@/lib/env";

export type AuthState = { step: "email" | "code"; email?: string; error?: string; info?: string };

const emailSchema = z.string().trim().toLowerCase().email("כתובת מייל לא תקינה");

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : env.appUrl;
}

export async function sendOtp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!supabaseEnabled()) return { step: "email", error: "ההתחברות במייל לא הוגדרה בסביבה הזו" };
  const parsed = emailSchema.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", error: parsed.error.issues[0]?.message };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: true, emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { step: "email", error: "שליחת הקוד נכשלה. נסו שוב בעוד דקה." };
  return { step: "code", email: parsed.data, info: "שלחנו קוד חד-פעמי למייל" };
}

export async function verifyOtp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get("email"));
  const token = String(form.get("token") ?? "").replace(/\s/g, "");
  if (!email.success || !/^\d{6,10}$/.test(token)) return { step: "code", email: email.data, error: "הקוד לא תקין" };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email: email.data, token, type: "email" });
  if (error) return { step: "code", email: email.data, error: "הקוד שגוי או שפג תוקפו" };
  redirect("/");
}

export async function signInWithGoogle() {
  if (!supabaseEnabled()) redirect("/login");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${await origin()}/auth/callback` } });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

export async function devLogin(form: FormData) {
  if (!devLoginEnabled()) throw new Error("dev login disabled");
  const id = String(form.get("userId") ?? "");
  const [u] = await db.select({ id: s.users.id }).from(s.users).where(eq(s.users.id, id));
  if (!u) redirect("/login");
  (await cookies()).set(DEV_COOKIE, signDevSession(u.id), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect("/");
}

export async function signOut() {
  if (supabaseEnabled()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEV_COOKIE);
  redirect("/login");
}
