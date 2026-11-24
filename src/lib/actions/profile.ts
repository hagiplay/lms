"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { actionUser, DEV_COOKIE } from "@/lib/auth/session";
import { deleteAccount, setAvatar, updateProfile } from "@/lib/data/profile";
import { supabaseServer } from "@/lib/auth/supabase";
import { supabaseEnabled } from "@/lib/env";

export type ProfileState = { ok?: boolean; error?: string };

export async function saveProfile(_: ProfileState, form: FormData): Promise<ProfileState> {
  try {
    const u = await actionUser();
    const firstName = String(form.get("firstName") ?? "");
    if (!firstName.trim()) return { error: "נא למלא שם פרטי" };
    await updateProfile(u.id, { firstName, lastName: String(form.get("lastName") ?? ""), headline: String(form.get("headline") ?? "") });
    const avatar = form.get("avatar");
    if (avatar instanceof File && avatar.size > 0) await setAvatar(u.id, avatar);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "השמירה נכשלה" };
  }
}

export async function deleteMyAccount(_: ProfileState, form: FormData): Promise<ProfileState> {
  const u = await actionUser();
  if (String(form.get("confirm") ?? "").trim() !== "מחיקה") return { error: 'כדי לאשר, הקלידו "מחיקה"' };
  await deleteAccount({ id: u.id, authId: u.authId });
  if (supabaseEnabled()) await (await supabaseServer()).auth.signOut();
  (await cookies()).delete(DEV_COOKIE);
  redirect("/login");
}
