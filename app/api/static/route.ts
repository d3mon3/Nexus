import { getStaticBundle } from "@/server/ddragon";
import { handle } from "@/server/http";

export const dynamic = "force-dynamic";

export function GET() {
  return handle(() => getStaticBundle(), 3600);
}
