import Link from "next/link";
import { notFound } from "next/navigation";
import { Award, CheckCircle2, Circle, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getProgramContext } from "@/lib/data/programs";
import { certificateStatus, getCertificate } from "@/lib/data/certificates";
import { Badge, Card, PageHeader, ProgressBar } from "@/components/ui";
import { IssueCertificateButton } from "./issue-button";

export const metadata = { title: "התקדמות ותעודה" };

export default async function ProgressPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await requireUser();
  const ctx = await getProgramContext(user, slug);
  if (!ctx) notFound();
  const status = certificateStatus(ctx);
  const cert = await getCertificate(user.id, ctx.program.id);
  const minPoints = ctx.program.certificateRules.minPoints ?? 0;
  const quizzes = ctx.flat.filter((i) => i.type === "quiz");
  const assignments = ctx.flat.filter((i) => i.type === "assignment");

  const statusBadge = (id: string) => {
    const p = ctx.progress.get(id);
    if (ctx.lockedItemIds.has(id)) return <Badge>נעול</Badge>;
    if (p?.status === "done") return <Badge tone="success">הושלם</Badge>;
    if (p?.status === "skipped") return <Badge>דולג</Badge>;
    if (p) return <Badge tone="warning">בתהליך</Badge>;
    return <Badge>טרם התחיל</Badge>;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="התקדמות ותעודה" subtitle={ctx.program.title} />

      <section className="hero rounded-[var(--radius-card)] p-6">
        <p className="text-white/85">הניקוד שלכם</p>
        <p className="text-4xl font-extrabold tabular">{ctx.points}{minPoints ? <span className="text-xl font-semibold text-white/85"> מתוך {minPoints}</span> : null}</p>
        {minPoints > 0 && (
          <>
            <ProgressBar value={(ctx.points / minPoints) * 100} label="ניקוד לתעודה" tone="accent" className="mt-3" />
            <p className="mt-2 text-sm text-white/85">{ctx.points >= minPoints ? "צברתם מספיק נקודות לתעודה" : `נותרו לכם עוד ${minPoints - ctx.points} נקודות`}</p>
          </>
        )}
      </section>

      <Card className="p-5">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Award aria-hidden size={20} className="text-primary" />בדרך לתעודה</h2>
        {status.criteria.length === 0 ? (
          <p className="text-muted">לתוכנית הזו לא מוגדרת תעודה.</p>
        ) : (
          <ul className="space-y-2">
            {status.criteria.map((c) => (
              <li key={c.key} className="flex items-center gap-3">
                {c.met ? <CheckCircle2 aria-label="הושלם" size={20} className="text-success" /> : <Circle aria-label="לא הושלם" size={20} className="text-muted" />}
                <span className="flex-1">{c.label}</span>
                {c.target > 1 && <span className="text-sm text-muted tabular">{c.current}/{c.target}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5">
          {cert ? (
            <Link href={`/certificates/${cert.verifyCode}`} className="inline-flex items-center gap-2 font-semibold text-primary hover:underline"><ExternalLink aria-hidden size={16} />לצפייה בתעודה ({cert.verifyCode})</Link>
          ) : status.eligible ? (
            <IssueCertificateButton slug={slug} />
          ) : null}
        </div>
      </Card>

      {[["מבדקים", quizzes], ["משימות", assignments]].map(([title, list]) => (
        <Card key={title as string} className="overflow-hidden">
          <h2 className="border-b border-border px-5 py-3 text-lg font-bold">{title as string}</h2>
          <table className="w-full text-sm">
            <caption className="sr-only">{title as string}</caption>
            <thead className="bg-surface-muted text-muted"><tr><th scope="col" className="px-5 py-2 text-start font-semibold">פריט</th><th scope="col" className="px-5 py-2 text-start font-semibold">ניקוד</th><th scope="col" className="px-5 py-2 text-start font-semibold">סטטוס</th></tr></thead>
            <tbody className="divide-y divide-border">
              {(list as typeof quizzes).map((i) => (
                <tr key={i.id}>
                  <td className="px-5 py-2.5">{ctx.lockedItemIds.has(i.id) ? i.title : <Link href={`/learn/${slug}/${i.id}`} className="hover:underline">{i.title}</Link>}</td>
                  <td className="px-5 py-2.5 tabular">{i.points}</td>
                  <td className="px-5 py-2.5">{statusBadge(i.id)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}
