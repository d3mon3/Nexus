import { z } from "zod";
import { handle, intParam, parseQuery, puuidParam, regionParam } from "@/server/http";
import { getPlayerStats } from "@/server/services/player";

export const dynamic = "force-dynamic";

const query = z.object({
  region: regionParam,
  puuid: puuidParam,
  count: intParam(5, 40, 20),
  queue: z.enum(["all", "solo", "flex", "normal", "aram"]).catch("all"),
});

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getPlayerStats(q.region, q.puuid, q.count, q.queue);
  });
}
