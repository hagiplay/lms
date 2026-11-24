import "server-only";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "private",
  authSecret: process.env.AUTH_SECRET ?? (process.env.NODE_ENV === "production" ? "" : "dev-only-insecure-secret"),
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  bunnyLibraryId: process.env.BUNNY_LIBRARY_ID ?? "",
  bunnyTokenKey: process.env.BUNNY_TOKEN_KEY ?? "",
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  paymentWebhookSecret: process.env.PAYMENT_WEBHOOK_SECRET ?? "",
  allowDevLogin: process.env.ALLOW_DEV_LOGIN === "1",
};

export const supabaseEnabled = () => Boolean(env.supabaseUrl && env.supabaseAnonKey);
/** Dev login only without Supabase, and never in production unless explicitly allowed (e.g. E2E on a preview). */
export const devLoginEnabled = () => !supabaseEnabled() && (process.env.NODE_ENV !== "production" || env.allowDevLogin);
