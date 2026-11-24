import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth/session";
import { upcomingEvents } from "@/lib/data/events";
import { buildIcs } from "@/lib/domain/ics";

export async function GET() {
  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const events = await upcomingEvents(user, new Date(), 100);
  const ics = buildIcs(events.map((e) => ({ uid: `${e.id}@lms`, title: e.title, description: e.description, url: e.joinUrl, startsAt: e.startsAt, endsAt: e.endsAt })), "מפגשים");
  return new NextResponse(ics, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="events.ics"' } });
}
