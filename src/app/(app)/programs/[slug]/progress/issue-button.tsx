"use client";

import { useTransition, useState } from "react";
import { Award } from "lucide-react";
import { Button } from "@/components/ui";
import { issueCertificateAction } from "@/lib/actions/learning";

export function IssueCertificateButton({ slug }: { slug: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Button disabled={pending} onClick={() => start(async () => setError((await issueCertificateAction(slug))?.error ?? null))}>
        <Award aria-hidden size={18} />{pending ? "מנפיקים…" : "הנפקת התעודה"}
      </Button>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
