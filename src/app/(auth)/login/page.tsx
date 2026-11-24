import { redirect } from "next/navigation";
import { asc, isNull } from "drizzle-orm";
import { Sparkles } from "lucide-react";
import { db, schema as s } from "@/db";
import { getUser } from "@/lib/auth/session";
import { devLogin, signInWithGoogle } from "@/lib/actions/auth";
import { devLoginEnabled, supabaseEnabled } from "@/lib/env";
import { Avatar, Button, Card } from "@/components/ui";
import { OtpForm } from "./otp-form";

export const metadata = { title: "התחברות" };

const roleLabel = { member: "חבר/ת תוכנית", mentor: "מנחה", admin: "מנהל/ת", owner: "בעלים" } as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  const devUsers = devLoginEnabled()
    ? await db.select().from(s.users).where(isNull(s.users.deletedAt)).orderBy(asc(s.users.role), asc(s.users.firstName)).limit(20)
    : [];

  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-on-accent"><Sparkles aria-hidden size={22} /></span>
          <div>
            <h1 className="text-2xl font-extrabold">ברוכים הבאים</h1>
            <p className="text-sm text-muted">התחברו כדי להמשיך ללמוד</p>
          </div>
        </div>

        {error && <p role="alert" className="mb-4 rounded-lg bg-danger-subtle px-3 py-2 text-sm text-on-danger-subtle">ההתחברות נכשלה. נסו שוב.</p>}

        {supabaseEnabled() && (
          <div className="space-y-4">
            <OtpForm />
            <div className="flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-border" />או<span className="h-px flex-1 bg-border" /></div>
            <form action={signInWithGoogle}>
              <Button type="submit" variant="secondary" className="w-full">התחברות עם Google</Button>
            </form>
          </div>
        )}

        {devLoginEnabled() && (
          <section aria-labelledby="dev-login">
            <h2 id="dev-login" className="mb-1 font-bold">התחברות פיתוח</h2>
            <p className="mb-3 text-sm text-muted">Supabase לא מוגדר, אז אפשר להתחבר כמשתמש לדוגמה. המסך הזה לא קיים ב-production.</p>
            <ul className="space-y-2">
              {devUsers.map((u) => (
                <li key={u.id}>
                  <form action={devLogin}>
                    <input type="hidden" name="userId" value={u.id} />
                    <button type="submit" className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2 text-start hover:bg-surface-muted">
                      <Avatar user={u} size={32} />
                      <span className="flex-1">
                        <span className="block font-semibold">{u.firstName} {u.lastName}</span>
                        <span className="block text-xs text-muted" dir="ltr">{u.email}</span>
                      </span>
                      <span className="text-xs text-muted">{roleLabel[u.role]}</span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            {devUsers.length === 0 && <p className="text-sm text-muted">אין משתמשים. הריצו <code dir="ltr">npm run db:seed</code>.</p>}
          </section>
        )}

        {!supabaseEnabled() && !devLoginEnabled() && <p className="text-sm text-muted">ההתחברות לא הוגדרה. ראו README.</p>}
      </Card>
    </main>
  );
}
