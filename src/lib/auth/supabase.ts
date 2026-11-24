import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Service-role client: storage and deleting auth users. Server only, never exposed. */
export function supabaseAdmin() {
  if (!env.supabaseServiceKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
