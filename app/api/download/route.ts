import { handle } from "@/server/http";
import { getDesktopRelease, releaseRepo } from "@/server/services/release";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(async () => ({ configured: Boolean(releaseRepo()), release: await getDesktopRelease() }), 60);
}
