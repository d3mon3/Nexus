import { z } from "zod";
import { handle, parseQuery, roleParam } from "@/server/http";
import { getChampionStats } from "@/server/services/champions";
import { MODE_IDS, type GameModeId } from "@/lib/modes";

export const dynamic = "force-dynamic";

const query = z.object({
  patch: z.string().max(10).optional(),
  role: roleParam,
  rank: z.string().max(20).optional(),
  region: z.string().max(6).optional(),
  mode: z.enum(MODE_IDS as [GameModeId, ...GameModeId[]]).optional().catch(undefined),
});

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getChampionStats({ patch: q.patch, role: q.role ?? null, rank: q.rank && q.rank !== "all" ? q.rank : null, region: q.region && q.region !== "all" ? q.region : null, mode: q.mode ?? "sr" });
  }, 300);
}
