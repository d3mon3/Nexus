import { z } from "zod";
import { handle, intParam, parseQuery, regionParam } from "@/server/http";
import { getLeaderboard } from "@/server/services/leaderboard";

export const dynamic = "force-dynamic";

const query = z.object({
  region: regionParam,
  tier: z.enum(["all", "challenger", "grandmaster", "master"]).catch("all"),
  page: intParam(1, 400, 1),
  pageSize: intParam(10, 50, 25),
  sort: z.enum(["lp", "winrate", "games"]).catch("lp"),
  q: z.string().max(40).optional(),
});

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getLeaderboard({ region: q.region, tier: q.tier, page: q.page, pageSize: q.pageSize, sort: q.sort, query: q.q ?? null });
  });
}
