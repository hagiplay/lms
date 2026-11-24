import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth/session";
import { isStaff } from "@/lib/domain/authz";
import { getFile, safePath } from "@/lib/storage";

const MIME: Record<string, string> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", gif: "image/gif", webp: "image/webp" };

/**
 * Private files. Authorization by path prefix:
 *   avatars/*                 any signed-in user
 *   submissions/{userId}/*    owner or staff
 *   bug-reports/{userId}/*    owner or staff
 */
export async function GET(_: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const user = await getUser();
  if (!user) return new NextResponse(null, { status: 401 });
  let path: string;
  try {
    path = safePath((await params).path.map(decodeURIComponent).join("/"));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const [area, owner] = path.split("/");
  const allowed = area === "avatars" || ((area === "submissions" || area === "bug-reports") && (owner === user.id || isStaff(user.role)));
  if (!allowed) return new NextResponse(null, { status: 403 });

  const f = await getFile(path);
  if (!f) return new NextResponse(null, { status: 404 });
  if ("redirect" in f) return NextResponse.redirect(f.redirect);
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return new NextResponse(new Uint8Array(f.bytes), {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Content-Disposition": ext === "pdf" ? "inline" : "inline",
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
