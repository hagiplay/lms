import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/auth/session";
import { recordPosition } from "@/lib/data/learning";

const body = z.object({ itemId: z.string().uuid(), positionSec: z.number().min(0).max(86400), durationSec: z.number().min(0).max(86400) });

/** Video position beacon (navigator.sendBeacon / fetch keepalive). */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  // sendBeacon cannot set custom headers; require same-origin to block CSRF.
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 400 });
  try {
    await recordPosition(user, parsed.data.itemId, parsed.data.positionSec, parsed.data.durationSec);
  } catch {
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204 });
}
