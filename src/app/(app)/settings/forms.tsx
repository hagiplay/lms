"use client";

import { useActionState } from "react";
import { deleteMyAccount, saveProfile, type ProfileState } from "@/lib/actions/profile";
import { Avatar, Button, Input, Label } from "@/components/ui";

export function ProfileForm({ user }: { user: { firstName: string; lastName: string; headline: string; email: string; avatarUrl: string | null } }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfile, {});
  return (
    <form action={action} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar user={user} size={64} />
        <div>
          <Label htmlFor="avatar">תמונת פרופיל (JPG, PNG, GIF, WebP עד 2MB)</Label>
          <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="block text-sm file:me-3 file:rounded-lg file:border-0 file:bg-primary-subtle file:px-3 file:py-2 file:text-on-primary-subtle" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><Label htmlFor="firstName">שם פרטי</Label><Input id="firstName" name="firstName" defaultValue={user.firstName} required maxLength={60} autoComplete="given-name" /></div>
        <div><Label htmlFor="lastName">שם משפחה</Label><Input id="lastName" name="lastName" defaultValue={user.lastName} maxLength={60} autoComplete="family-name" /></div>
      </div>
      <div><Label htmlFor="headline">שורת ביו</Label><Input id="headline" name="headline" defaultValue={user.headline} maxLength={140} placeholder="למשל: בונה אוטומציות לעסק קטן" /></div>
      <div><Label htmlFor="email">אימייל</Label><Input id="email" value={user.email} readOnly dir="ltr" className="bg-surface-muted" aria-describedby="email-hint" /><p id="email-hint" className="mt-1 text-xs text-muted">האימייל משמש להתחברות ולא ניתן לשינוי כאן</p></div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="text-sm text-success">נשמר</p>}
      <Button type="submit" disabled={pending}>{pending ? "שומרים…" : "שמירה"}</Button>
    </form>
  );
}

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState<ProfileState, FormData>(deleteMyAccount, {});
  return (
    <form action={action} className="space-y-3">
      <div><Label htmlFor="confirm">להמשך, הקלידו &quot;מחיקה&quot;</Label><Input id="confirm" name="confirm" autoComplete="off" className="max-w-xs" /></div>
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <Button type="submit" variant="danger" disabled={pending}>מחיקת החשבון לצמיתות</Button>
    </form>
  );
}
