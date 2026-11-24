import { notFound } from "next/navigation";
import { Award, BadgeCheck } from "lucide-react";
import { verifyCertificate } from "@/lib/data/certificates";
import { formatDate } from "@/lib/domain/format";
import { PrintButton } from "./print-button";

export const metadata = { title: "אימות תעודה", robots: { index: false } };

/** Public: anyone with the code can verify the certificate (PRD F10). */
export default async function CertificatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[0-9A-Za-z-]{6,20}$/.test(code)) notFound();
  const row = await verifyCertificate(code);
  if (!row) notFound();
  const { certificate: c, program } = row;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4">
      <p className="no-print inline-flex items-center gap-2 rounded-full bg-success-subtle px-4 py-1.5 font-semibold text-on-success-subtle"><BadgeCheck aria-hidden size={18} />תעודה מאומתת</p>
      <article className="relative w-full max-w-3xl overflow-hidden rounded-[var(--radius-card)] border-4 border-double border-primary bg-surface p-8 text-center shadow-xl sm:p-14 print:shadow-none">
        <div className="hero absolute inset-x-0 top-0 h-3" aria-hidden />
        <Award aria-hidden size={56} className="mx-auto mb-4 text-primary" />
        <p className="text-lg text-muted">תעודת סיום</p>
        <h1 className="mt-2 text-4xl font-extrabold sm:text-5xl">{c.recipientName}</h1>
        <p className="mt-6 text-lg">השלים/ה בהצלחה את התוכנית</p>
        <p className="mt-1 text-2xl font-bold text-primary">{program.title}</p>
        {program.subtitle && <p className="text-muted">{program.subtitle}</p>}
        <dl className="mt-10 flex flex-wrap justify-center gap-10 text-sm">
          <div><dt className="text-muted">תאריך הנפקה</dt><dd className="font-semibold">{formatDate(c.issuedAt)}</dd></div>
          <div><dt className="text-muted">קוד אימות</dt><dd className="font-semibold tabular" dir="ltr">{c.verifyCode}</dd></div>
        </dl>
      </article>
      <PrintButton />
    </main>
  );
}
