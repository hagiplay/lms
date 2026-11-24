"use client";

import { useEffect, useState } from "react";
import { formatCountdown } from "@/lib/domain/format";

export function Countdown({ to, className }: { to: string; className?: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Server render: static text, avoids hydration mismatch. aria-live off to not spam screen readers.
  return (
    <span className={className} aria-live="off">
      {now === null ? "…" : target - now > 0 ? `מתחילים בעוד ${formatCountdown(target - now)}` : "מתחילים עכשיו"}
    </span>
  );
}
