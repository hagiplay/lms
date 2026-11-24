"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function PrintButton() {
  return <Button variant="secondary" className="no-print" onClick={() => window.print()}><Printer aria-hidden size={18} />הדפסה או שמירה כ-PDF</Button>;
}
