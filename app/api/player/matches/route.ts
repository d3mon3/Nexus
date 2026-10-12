import { z } from "zod";
import { handle, intParam, parseQuery, puuidParam, regionParam } from "@/server/http";
import { getMatches } from "@/server/services/player";

export const dynamic = "force-dynamic";

const query = z.object({
  region: regionParam,
  puuid: puuidParam,
  start: intParam(0, 1000, 0),
  count: intParam(1, 20, 10),
  queue: z.enum(["all", "solo", "flex", "normal", "aram"]).catch("all"),
  champion: z.coerce.number().int().positive().optional().catch(undefined),
  result: z.enum(["win", "loss"]).optional().catch(undefined),
});

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getMatches(q.region, q.puuid, { start: q.start, count: q.count, queue: q.queue, championId: q.champion ?? null, result: q.result ?? null });
  });
}
