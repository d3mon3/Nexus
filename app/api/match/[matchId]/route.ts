import { z } from "zod";
import { handle, parseQuery, regionParam } from "@/server/http";
import { getMatch } from "@/server/services/player";

export const dynamic = "force-dynamic";

const query = z.object({ region: regionParam, puuid: z.string().max(120).optional() });

export async function GET(req: Request, ctx: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await ctx.params;
  return handle(async () => {
    const q = parseQuery(req, query);
    return getMatch(q.region, decodeURIComponent(matchId), q.puuid ?? null);
  });
}
