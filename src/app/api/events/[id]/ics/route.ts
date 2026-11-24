import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { getEventForUser } from "@/lib/data/events";
import { buildIcs } from "@/lib/domain/ics";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const e = await getEventForUser(user, id);
  if (!e) return new NextResponse(null, { status: 404 });
  const ics = buildIcs([{ uid: `${e.id}@lms`, title: e.title, description: e.description, url: e.joinUrl, startsAt: e.startsAt, endsAt: e.endsAt }], e.title);
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="event.ics"' } });
}
