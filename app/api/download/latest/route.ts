import { NextResponse } from "next/server";
import { getDesktopRelease, installerResponse } from "@/server/services/release";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** /api/download/latest — the newest installer, served from this server (never a GitHub link). */
export async function GET(req: Request) {
  const release = await getDesktopRelease();
  if (!release) return NextResponse.redirect(new URL("/download", req.url));
  try {
    return await installerResponse(release);
  } catch (err) {
    console.error("[nexus] installer download failed", err);
    return NextResponse.json({ error: "The installer is being prepared — try again in a minute." }, { status: 503 });
  }
}
