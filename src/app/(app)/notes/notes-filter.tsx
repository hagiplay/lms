"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui";

export function NotesFilter({ initial, placeholder = "חיפוש בהערות" }: { initial: string; placeholder?: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  useEffect(() => {
    const t = setTimeout(() => router.replace(q.trim() ? `?q=${encodeURIComponent(q.trim())}` : "?", { scroll: false }), 250);
    return () => clearTimeout(t);
  }, [q, router]);
  return (
    <label className="relative mb-4 block max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search aria-hidden size={16} className="absolute start-3 top-3 text-muted" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="ps-9" />
    </label>
  );
}
