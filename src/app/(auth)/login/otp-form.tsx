"use client";

import { useActionState } from "react";
import { sendOtp, verifyOtp, type AuthState } from "@/lib/actions/auth";
import { Button, Input, Label } from "@/components/ui";

export function OtpForm() {
  const [sendState, send, sending] = useActionState<AuthState, FormData>(sendOtp, { step: "email" });
  const [verifyState, verify, verifying] = useActionState<AuthState, FormData>(verifyOtp, { step: "code" });
  const email = sendState.step === "code" ? sendState.email : undefined;

  if (!email) {
    return (
      <form action={send} className="space-y-3">
        <div>
          <Label htmlFor="email">אימייל</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required dir="ltr" placeholder="you@example.com" />
        </div>
        {sendState.error && <p role="alert" className="text-sm text-danger">{sendState.error}</p>}
        <Button type="submit" className="w-full" disabled={sending}>{sending ? "שולחים…" : "שלחו לי קוד כניסה"}</Button>
      </form>
    );
  }
  return (
    <form action={verify} className="space-y-3">
      <p className="text-sm" role="status">{sendState.info} ל-<span dir="ltr">{email}</span></p>
      <input type="hidden" name="email" value={email} />
      <div>
        <Label htmlFor="token">קוד חד-פעמי</Label>
        <Input id="token" name="token" inputMode="numeric" autoComplete="one-time-code" required dir="ltr" className="text-center text-lg tracking-[0.4em] tabular" />
      </div>
      {verifyState.error && <p role="alert" className="text-sm text-danger">{verifyState.error}</p>}
      <Button type="submit" className="w-full" disabled={verifying}>{verifying ? "בודקים…" : "כניסה"}</Button>
    </form>
  );
}
