import { requireUser } from "@/lib/auth/session";
import { Card, PageHeader } from "@/components/ui";
import { DeleteAccountForm, ProfileForm } from "./forms";

export const metadata = { title: "הגדרות" };

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="פרופיל והגדרות" />
      <Card className="p-5">
        <h2 className="mb-4 text-lg font-bold">פרופיל</h2>
        <ProfileForm user={{ firstName: user.firstName, lastName: user.lastName, headline: user.headline, email: user.email, avatarUrl: user.avatarUrl }} />
      </Card>
      <Card className="p-5">
        <h2 className="mb-1 text-lg font-bold">ערכת צבעים</h2>
        <p className="text-sm text-muted">אפשר להחליף בתפריט המשתמש, בפינת המסך.</p>
      </Card>
      <Card className="border-danger/40 p-5">
        <h2 className="mb-1 text-lg font-bold text-danger">מחיקת החשבון</h2>
        <p className="mb-4 text-sm text-muted">המחיקה סופית: ההערות, ההתקדמות וההגשות שלכם יימחקו. תעודות שהונפקו יישארו ניתנות לאימות.</p>
        <DeleteAccountForm />
      </Card>
    </div>
  );
}
