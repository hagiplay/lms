import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { search } from "@/lib/data/search";

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const hits = await search(user, req.nextUrl.searchParams.get("q") ?? "");
  return NextResponse.json({ hits }, { headers: { "Cache-Control": "private, no-store" } });
}
