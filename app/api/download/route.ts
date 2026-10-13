import { handle } from "@/server/http";
import { getDesktopRelease, releaseRepo } from "@/server/services/release";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => {
    const r = await getDesktopRelease();
    // The page only needs version info; the file itself is served from /api/download/latest.
    return { configured: Boolean(releaseRepo()), release: r && { tag: r.tag, name: r.name, publishedAt: r.publishedAt, fileName: r.fileName, size: r.size, url: "/api/download/latest" } };
  }, 60);
}
