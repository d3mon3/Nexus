import { z } from "zod";
import { handle, intParam, parseQuery, puuidParam, regionParam } from "@/server/http";
import { getScoutPlayer } from "@/server/services/scout";

export const dynamic = "force-dynamic";

const query = z.object({
  region: regionParam,
  puuid: puuidParam,
  riotId: z.string().min(1).max(40),
  team: z.coerce.number().pipe(z.union([z.literal(100), z.literal(200)])).catch(100),
  champion: z.coerce.number().int().positive(),
  spell1: z.coerce.number().int().catch(4),
  spell2: z.coerce.number().int().catch(14),
  keystone: z.coerce.number().int().optional().catch(undefined),
  sub: z.coerce.number().int().optional().catch(undefined),
  depth: intParam(5, 20, 10),
});

/** One scouting card. Called once per player so the board fills in progressively. */
export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getScoutPlayer({
      region: q.region,
      puuid: q.puuid,
      riotId: q.riotId,
      teamId: q.team as 100 | 200,
      championId: q.champion,
      spells: [q.spell1, q.spell2],
      keystone: q.keystone ?? null,
      subStyle: q.sub ?? null,
      depth: q.depth,
    });
  }, 120);
}
