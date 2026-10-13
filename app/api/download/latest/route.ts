import { NextResponse } from "next/server";
import { getDesktopRelease } from "@/server/services/release";

export const dynamic = "force-dynamic";

/** Short, shareable link: /api/download/latest always redirects to the newest installer. */
export async function GET(req: Request) {
  const release = await getDesktopRelease();
  if (!release) return NextResponse.redirect(new URL("/download", req.url));
  return NextResponse.redirect(release.url, 302);
}
