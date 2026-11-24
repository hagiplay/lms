import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireRole } from "@/lib/auth/session";
import { programOfItem } from "@/lib/data/programs";
import { deleteItem, deleteQuestion, saveQuestion, updateItem } from "@/lib/actions/admin";
import { formatClock } from "@/lib/domain/format";
import { AdminForm } from "@/components/admin-form";
import { Button, Card, Input, Label, PageHeader, Select, Textarea } from "@/components/ui";
import { itemTypeLabel } from "@/components/learn/item-icon";

export const metadata = { title: "עריכת פריט" };

export default async function AdminItem({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const owner = await programOfItem(id);
  if (!owner) notFound();
  const { item, program } = owner;
  const [lesson] = await db.select().from(s.lessonContents).where(eq(s.lessonContents.itemId, id));
  const [quiz] = await db.select().from(s.quizzes).where(eq(s.quizzes.itemId, id));
  const [assignment] = await db.select().from(s.assignments).where(eq(s.assignments.itemId, id));
  const questions = quiz ? await db.select().from(s.questions).where(eq(s.questions.quizItemId, id)).orderBy(asc(s.questions.position)) : [];
  const steps = assignment ? await db.select().from(s.assignmentSteps).where(eq(s.assignmentSteps.assignmentItemId, id)).orderBy(asc(s.assignmentSteps.position)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        subtitle={<><Link href={`/admin/programs/${program.id}`} className="text-primary underline">{program.title}</Link> · {itemTypeLabel[item.type]} · <Link href={`/learn/${program.slug}/${id}`} className="text-primary underline">תצוגה מקדימה</Link></>}
      />
      <Card className="p-5">
        <AdminForm action={updateItem} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <div className="grid gap-3 sm:grid-cols-[1fr_90px_110px_90px]">
            <div><Label htmlFor="title">כותרת</Label><Input id="title" name="title" defaultValue={item.title} required /></div>
            <div><Label htmlFor="position">מיקום</Label><Input id="position" name="position" type="number" defaultValue={item.position} /></div>
            <div><Label htmlFor="durationMin">משך (דקות)</Label><Input id="durationMin" name="durationMin" type="number" min={0} step="0.5" defaultValue={item.durationSec / 60} /></div>
            <div><Label htmlFor="points">נקודות</Label><Input id="points" name="points" type="number" min={0} defaultValue={item.points} /></div>
          </div>
          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2"><input type="checkbox" name="isPublished" defaultChecked={item.isPublished} className="size-4" />מפורסם</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="isRequired" defaultChecked={item.isRequired} className="size-4" />פריט חובה (לתעודה)</label>
            {!item.isPublished && <label className="flex items-center gap-2"><input type="checkbox" name="notifyMembers" defaultChecked className="size-4" />בפרסום: התראה &quot;שיעור חדש&quot; לחברי התוכנית</label>}
          </div>
          <div><Label htmlFor="updateNote">הערת עדכון (מוצגת לתלמידים, רשות)</Label><Input id="updateNote" name="updateNote" defaultValue={item.updateNote ?? ""} placeholder="למשל: הוספנו פתרון לתקלה שעלתה בדיון" /></div>

          {lesson && (
            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 font-semibold">תוכן השיעור</legend>
              {item.type === "video" && (
                <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                  <div>
                    <Label htmlFor="videoProvider">ספק וידאו</Label>
                    <Select id="videoProvider" name="videoProvider" defaultValue={lesson.videoProvider}>
                      <option value="none">ללא</option>
                      <option value="bunny">Bunny Stream</option>
                      <option value="url">קישור ישיר (MP4)</option>
                    </Select>
                  </div>
                  <div><Label htmlFor="videoRef">מזהה וידאו ב-Bunny, או קישור</Label><Input id="videoRef" name="videoRef" dir="ltr" defaultValue={lesson.videoRef ?? ""} /></div>
                </div>
              )}
              <div><Label htmlFor="overviewMd">{item.type === "text" ? "תוכן (Markdown)" : "סקירה (Markdown)"}</Label><Textarea id="overviewMd" name="overviewMd" defaultValue={lesson.overviewMd} className="min-h-48 font-mono text-sm" /></div>
              {item.type === "video" && (
                <>
                  <div><Label htmlFor="timestamps">ציר זמן: שורה לכל פרק, &quot;1:30 כותרת&quot;</Label><Textarea id="timestamps" name="timestamps" dir="auto" defaultValue={lesson.timestamps.map((t) => `${formatClock(t.sec)} ${t.label}`).join("\n")} className="font-mono text-sm" /></div>
                  <div><Label htmlFor="transcript">תמלול</Label><Textarea id="transcript" name="transcript" defaultValue={lesson.transcript} className="min-h-40" /></div>
                </>
              )}
              <div><Label htmlFor="attachments">קבצים: שורה לכל קובץ, &quot;שם|קישור|גודל בבתים|סוג&quot;</Label><Textarea id="attachments" name="attachments" dir="ltr" defaultValue={lesson.attachments.map((a) => [a.name, a.url, a.sizeBytes, a.mime].join("|")).join("\n")} className="font-mono text-sm" /></div>
            </fieldset>
          )}

          {quiz && (
            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 font-semibold">הגדרות מבדק</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><Label htmlFor="passPct">ציון עובר (%)</Label><Input id="passPct" name="passPct" type="number" min={0} max={100} defaultValue={quiz.passPct} /></div>
                <div><Label htmlFor="timeLimitMin">מגבלת זמן (דקות, ריק = ללא)</Label><Input id="timeLimitMin" name="timeLimitMin" type="number" min={1} defaultValue={quiz.timeLimitSec ? quiz.timeLimitSec / 60 : ""} /></div>
                <div><Label htmlFor="maxAttempts">ניסיונות (ריק = ללא הגבלה)</Label><Input id="maxAttempts" name="maxAttempts" type="number" min={1} defaultValue={quiz.maxAttempts ?? ""} /></div>
              </div>
              <div><Label htmlFor="introMd">הקדמה (Markdown)</Label><Textarea id="introMd" name="introMd" defaultValue={quiz.introMd} /></div>
            </fieldset>
          )}

          {assignment && (
            <fieldset className="space-y-3 rounded-xl border border-border p-4">
              <legend className="px-1 font-semibold">משימה</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor="estMinutes">זמן עבודה משוער (דקות)</Label><Input id="estMinutes" name="estMinutes" type="number" min={0} defaultValue={assignment.estMinutes} /></div>
                <label className="flex items-center gap-2 self-end pb-2"><input type="checkbox" name="requiresSubmission" defaultChecked={assignment.requiresSubmission} className="size-4" />דורשת הגשה ובדיקת מנחה</label>
              </div>
              <div><Label htmlFor="briefMd">תיאור המשימה (Markdown)</Label><Textarea id="briefMd" name="briefMd" defaultValue={assignment.briefMd} className="min-h-40" /></div>
              <div><Label htmlFor="steps">שלבים: שורה לכל שלב</Label><Textarea id="steps" name="steps" defaultValue={steps.map((x) => x.text).join("\n")} className="min-h-32" /></div>
            </fieldset>
          )}
          <Button type="submit">שמירה</Button>
        </AdminForm>
      </Card>

      {quiz && (
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">שאלות ({questions.length})</h2>
          <ol className="space-y-4">
            {[...questions, null].map((q, idx) => (
              <li key={q?.id ?? "new"} className="rounded-xl border border-border p-4">
                <h3 className="mb-2 font-semibold">{q ? `שאלה ${idx + 1}` : "שאלה חדשה"}</h3>
                <AdminForm action={saveQuestion} className="space-y-3" successText={q ? "נשמר" : null}>
                  <input type="hidden" name="quizItemId" value={id} />
                  {q && <input type="hidden" name="id" value={q.id} />}
                  {q && <input type="hidden" name="position" value={q.position} />}
                  <div><Label htmlFor={`prompt-${idx}`}>שאלה</Label><Input id={`prompt-${idx}`} name="prompt" defaultValue={q?.prompt ?? ""} required /></div>
                  <div><Label htmlFor={`opts-${idx}`}>תשובות: שורה לכל תשובה</Label><Textarea id={`opts-${idx}`} name="options" defaultValue={q?.options.join("\n") ?? ""} required /></div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div><Label htmlFor={`correct-${idx}`}>מספרי התשובות הנכונות (למשל 2 או 1,3)</Label><Input id={`correct-${idx}`} name="correct" defaultValue={q?.correct.map((c) => c + 1).join(",") ?? ""} required dir="ltr" /></div>
                    <div><Label htmlFor={`kind-${idx}`}>סוג</Label><Select id={`kind-${idx}`} name="kind" defaultValue={q?.kind ?? "single"}><option value="single">בחירה יחידה</option><option value="multiple">בחירה מרובה</option></Select></div>
                    <div><Label htmlFor={`points-${idx}`}>נקודות</Label><Input id={`points-${idx}`} name="points" type="number" min={1} defaultValue={q?.points ?? 1} /></div>
                  </div>
                  <div><Label htmlFor={`exp-${idx}`}>הסבר (מוצג אחרי מענה)</Label><Textarea id={`exp-${idx}`} name="explanation" defaultValue={q?.explanation ?? ""} /></div>
                  <Button type="submit" size="sm">{q ? "שמירת שאלה" : "הוספת שאלה"}</Button>
                </AdminForm>
                {q && (
                  <AdminForm action={deleteQuestion} className="mt-2" confirmText="למחוק את השאלה?" successText={null}>
                    <input type="hidden" name="id" value={q.id} />
                    <Button size="sm" variant="danger">מחיקת השאלה</Button>
                  </AdminForm>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <AdminForm action={deleteItem} confirmText="למחוק את הפריט? ההתקדמות, ההערות והדיונים שלו יימחקו." successText={null}>
        <input type="hidden" name="id" value={id} />
        <Button variant="danger">מחיקת הפריט</Button>
      </AdminForm>
    </div>
  );
}
