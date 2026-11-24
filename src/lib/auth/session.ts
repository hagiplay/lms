import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { env, devLoginEnabled, supabaseEnabled } from "@/lib/env";
import { hmacHex } from "@/lib/domain/crypto";
import { atLeast } from "@/lib/domain/authz";
import type { Role } from "@/lib/domain/types";
import { supabaseServer } from "./supabase";

export type SessionUser = typeof s.users.$inferSelect;

export const DEV_COOKIE = "lms_dev_session";

export const signDevSession = (userId: string) => `${userId}.${hmacHex(env.authSecret, `dev:${userId}`)}`;
function readDevSession(value: string | undefined): string | null {
  if (!value || !env.authSecret) return null;
  const [id, sig] = value.split(".");
  if (!id || !sig || signDevSession(id) !== value) return null;
  return id;
}

async function findActiveUser(where: ReturnType<typeof eq>) {
  const [u] = await db.select().from(s.users).where(and(where, isNull(s.users.deletedAt))).limit(1);
  return u ?? null;
}

/** Resolves the signed-in app user (cached per request). */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  if (supabaseEnabled()) {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const au = data.user;
    if (!au?.email) return null;
    const byAuth = await findActiveUser(eq(s.users.authId, au.id));
    if (byAuth) return byAuth;
    // First login: link by email (e.g. a buyer created by the payment webhook) or create.
    const [existing] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = lower(${au.email})`).limit(1);
    if (existing) {
      if (existing.deletedAt) return null;
      const [linked] = await db.update(s.users).set({ authId: au.id }).where(eq(s.users.id, existing.id)).returning();
      return linked ?? null;
    }
    const meta = (au.user_metadata ?? {}) as Record<string, string | undefined>;
    const [first, ...rest] = (meta.full_name ?? meta.name ?? "").split(" ");
    const [created] = await db
      .insert(s.users)
      .values({ authId: au.id, email: au.email, firstName: first ?? "", lastName: rest.join(" "), avatarUrl: meta.avatar_url ?? null })
      .returning();
    return created ?? null;
  }
  if (devLoginEnabled()) {
    const id = readDevSession((await cookies()).get(DEV_COOKIE)?.value);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
    return findActiveUser(eq(s.users.id, id));
  }
  return null;
});

export async function requireUser(): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(min: Role): Promise<SessionUser> {
  const u = await requireUser();
  if (!atLeast(u.role, min)) redirect("/");
  return u;
}

/** For server actions: throws instead of redirecting. */
export async function actionUser(min: Role = "member"): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new Error("נדרשת התחברות");
  if (!atLeast(u.role, min)) throw new Error("אין הרשאה");
  return u;
}
