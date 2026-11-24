import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { listAllNotes } from "@/lib/data/learning";
import { formatClock, relativeTime } from "@/lib/domain/format";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { NotesFilter } from "./notes-filter";

export const metadata = { title: "ההערות שלי" };

export default async function NotesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const all = await listAllNotes(user.id);
  const term = q.trim();
  const notes = term ? all.filter((n) => n.note.body.includes(term) || n.item.title.includes(term)) : all;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="ההערות שלי" subtitle={`${all.length} הערות מכל השיעורים`} />
      <NotesFilter initial={q} />
      {notes.length === 0 ? (
        <EmptyState icon={<NotebookPen size={28} />} title={term ? "לא נמצאו הערות" : "עוד לא כתבתם הערות"}>הערות שכותבים בלשונית &quot;הערות&quot; בשיעור יופיעו כאן</EmptyState>
      ) : (
        <ul className="space-y-3">
          {notes.map(({ note, item, program }) => (
            <li key={note.id}>
              <Card className="p-4">
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <Link href={`/learn/${program.slug}/${item.id}?tab=notes`} className="font-semibold text-primary hover:underline">{item.title}</Link>
                  {note.positionSec != null && <span className="rounded-md bg-primary-subtle px-1.5 text-xs font-semibold text-on-primary-subtle tabular">{formatClock(note.positionSec)}</span>}
                  <span className="text-muted">· {relativeTime(note.updatedAt)}</span>
                </div>
                <p className="whitespace-pre-wrap">{note.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
