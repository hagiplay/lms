import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getItemDetails, touchItem } from "@/lib/data/learning";
import { listThreads } from "@/lib/data/discussion";
import { neighbours } from "@/lib/domain/progress";
import { bunnyEmbedUrl } from "@/lib/domain/crypto";
import { formatDate, formatDuration } from "@/lib/domain/format";
import { renderMarkdown } from "@/lib/domain/markdown";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui";
import { PlayerProvider, VideoPlayer } from "@/components/learn/player";
import { ItemActions } from "@/components/learn/item-actions";
import { Tabs, type TabDef } from "@/components/learn/tabs";
import { Files, Notes, Timeline, Transcript } from "@/components/learn/lesson-panels";
import { Discussion } from "@/components/learn/discussion";
import { QuizRunner } from "@/components/learn/quiz";
import { AssignmentView } from "@/components/learn/assignment";
import { Outline, type OutlineView } from "@/components/learn/outline";
import { itemTypeLabel } from "@/components/learn/item-icon";

export const metadata = { title: "שיעור" };

export default async function LearnPage({ params }: { params: Promise<{ slug: string; itemId: string }> }) {
  const { slug, itemId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) notFound();
  const user = await requireUser();
  const d = await getItemDetails(user, itemId);
  if (!d) notFound();
  if (d.ctx.program.slug !== slug) redirect(`/learn/${d.ctx.program.slug}/${itemId}`);
  await touchItem(user, itemId);

  const { ctx, item, flatItem, lesson } = d;
  const prog = ctx.progress.get(itemId);
  const { prev, next } = neighbours(ctx.flat, itemId, ctx.lockedItemIds);
  const threads = await listThreads(user, itemId);

  const hasVideo = item.type === "video" && Boolean(lesson && lesson.videoProvider !== "none" && lesson.videoRef);
  const videoSrc =
    lesson?.videoProvider === "bunny" && lesson.videoRef && env.bunnyLibraryId
      ? bunnyEmbedUrl({ libraryId: env.bunnyLibraryId, videoId: lesson.videoRef, tokenKey: env.bunnyTokenKey || undefined, startSec: prog?.positionSec })
      : lesson?.videoProvider === "url"
        ? lesson.videoRef
        : null;

  const outline: OutlineView = {
    slug,
    title: ctx.program.title,
    pct: ctx.stats.pct,
    counters: [
      { label: "שיעורים", done: ctx.stats.byType.video.done + ctx.stats.byType.text.done, total: ctx.stats.byType.video.total + ctx.stats.byType.text.total },
      { label: "מבדקים", done: ctx.stats.byType.quiz.done, total: ctx.stats.byType.quiz.total },
      { label: "משימות", done: ctx.stats.byType.assignment.done, total: ctx.stats.byType.assignment.total },
    ],
    remaining: formatDuration(ctx.stats.remainingSec),
    units: ctx.unitStates.map(({ unit, lock }) => ({
      id: unit.id,
      title: unit.title,
      locked: !lock.unlocked,
      lockLabel: lock.unlocked ? undefined : lock.opensAt ? `נפתחת ב-${formatDate(lock.opensAt)}` : lock.reason,
      chapters: unit.chapters.map((c) => ({ id: c.id, title: c.title, items: c.items.map((i) => ({ id: i.id, title: i.title, type: i.type, durationSec: i.durationSec, status: ctx.progress.get(i.id)?.status ?? null })) })),
    })),
  };

  const discussionTab: TabDef = {
    key: "discussion",
    label: "דיון",
    count: d.threadCount,
    content: (
      <Discussion
        itemId={itemId}
        hasVideo={hasVideo}
        me={{ id: user.id, role: user.role }}
        threads={threads.map((t) => ({
          thread: { id: t.thread.id, kind: t.thread.kind, body: t.thread.body, acceptedMessageId: t.thread.acceptedMessageId, videoSec: t.thread.videoSec, createdAt: t.thread.createdAt.toISOString(), authorId: t.thread.authorId },
          author: t.author,
          replies: t.replies.map((r) => ({ message: { id: r.message.id, body: r.message.body, createdAt: r.message.createdAt.toISOString(), authorId: r.message.authorId }, author: r.author })),
        }))}
      />
    ),
  };
  const notesTab: TabDef = { key: "notes", label: "הערות", count: d.notes.length, content: <Notes itemId={itemId} hasVideo={hasVideo} notes={d.notes.map((n) => ({ id: n.id, body: n.body, positionSec: n.positionSec }))} /> };

  let tabs: TabDef[];
  let main: React.ReactNode = null;
  if (item.type === "quiz" && d.quiz) {
    const best = d.quiz.attempts.reduce<{ pct: number; passed: boolean } | null>((b, a) => {
      const pct = a.maxScore ? Math.round((a.score / a.maxScore) * 100) : 0;
      return !b || pct > b.pct ? { pct, passed: a.passed || (b?.passed ?? false) } : { ...b, passed: b.passed || a.passed };
    }, null);
    main = <QuizRunner itemId={itemId} introHtml={renderMarkdown(d.quiz.introMd)} questions={d.quiz.questions} passPct={d.quiz.passPct} timeLimitSec={d.quiz.timeLimitSec} attemptsLeft={d.quiz.attemptsLeft} best={best} />;
    tabs = [discussionTab, notesTab];
  } else if (item.type === "assignment" && d.assignment) {
    const sub = d.assignment.submission;
    main = (
      <AssignmentView
        itemId={itemId}
        briefHtml={renderMarkdown(d.assignment.briefMd)}
        estMinutes={d.assignment.estMinutes}
        steps={d.assignment.steps.map((st) => ({ id: st.id, text: st.text }))}
        checkedIds={[...d.assignment.checkedIds]}
        requiresSubmission={d.assignment.requiresSubmission}
        submission={sub ? { status: sub.status, linkUrl: sub.linkUrl, fileName: sub.fileName, filePath: sub.filePath, notes: sub.notes, mentorFeedback: sub.mentorFeedback } : null}
      />
    );
    tabs = [discussionTab, notesTab];
  } else {
    if (item.type === "video") main = <VideoPlayer itemId={itemId} provider={lesson?.videoProvider ?? "none"} src={videoSrc} startSec={prog?.positionSec ?? 0} durationSec={item.durationSec} title={item.title} />;
    tabs = [
      { key: "overview", label: item.type === "text" ? "תוכן" : "סקירה", content: lesson?.overviewMd ? <div className="prose-lms" dangerouslySetInnerHTML={{ __html: renderMarkdown(lesson.overviewMd) }} /> : <p className="text-muted">אין סקירה לשיעור הזה</p> },
      ...(item.type === "video" ? [{ key: "timeline", label: "ציר זמן", count: lesson?.timestamps.length, content: <Timeline items={lesson?.timestamps ?? []} /> }, { key: "transcript", label: "תמלול", content: <Transcript text={lesson?.transcript ?? ""} /> }] : []),
      { key: "files", label: "קבצים", count: lesson?.attachments.length, content: <Files files={lesson?.attachments ?? []} /> },
      notesTab,
      discussionTab,
    ];
  }

  return (
    <PlayerProvider>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 xl:flex-row xl:items-start">
        <article className="min-w-0 flex-1 space-y-5">
          <header>
            <p className="text-sm text-muted">{flatItem.unitTitle} · {flatItem.chapterTitle}</p>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-extrabold">{item.title}</h1>
              <Badge>{itemTypeLabel[item.type]}</Badge>
              {item.points > 0 && <Badge tone="primary">{item.points} נק&apos;</Badge>}
            </div>
            {item.updateNote && <p className="mt-1 text-sm text-info">עודכן ב-{formatDate(item.updatedAt)}: {item.updateNote}</p>}
          </header>
          {main}
          <ItemActions
            itemId={itemId}
            status={prog?.status ?? null}
            canMarkManually={item.type === "video" || item.type === "text"}
            isFavorite={d.isFavorite}
            threadCount={d.threadCount}
            prevHref={prev ? `/learn/${slug}/${prev.id}` : null}
            nextHref={next ? `/learn/${slug}/${next.id}` : null}
          />
          <Tabs tabs={tabs} defaultKey={tabs[0]!.key} />
        </article>
        <aside className="w-full shrink-0 overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:w-96 xl:overflow-y-auto">
          <Outline data={outline} currentId={itemId} />
        </aside>
      </div>
    </PlayerProvider>
  );
}
