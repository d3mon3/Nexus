import { z } from "zod";
import { handle, parseQuery, regionParam } from "@/server/http";
import { getProfile } from "@/server/services/player";

export const dynamic = "force-dynamic";

const query = z.object({ region: regionParam, riotId: z.string().min(5).max(40) });

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getProfile(q.region, q.riotId);
  });
}
