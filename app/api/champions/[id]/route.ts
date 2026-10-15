import { z } from "zod";
import { handle, parseQuery, roleParam } from "@/server/http";
import { getChampionBuild } from "@/server/services/champions";
import { ServiceError } from "@/server/services/player";
import { MODE_IDS, type GameModeId } from "@/lib/modes";

export const dynamic = "force-dynamic";

const query = z.object({ role: roleParam, patch: z.string().max(10).optional(), mode: z.enum(MODE_IDS as [GameModeId, ...GameModeId[]]).optional().catch(undefined), variant: z.string().regex(/^[a-z]{2,12}$/).optional().catch(undefined) });

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return handle(async () => {
    const championId = Number(id);
    if (!Number.isInteger(championId) || championId <= 0) throw new ServiceError(400, "Invalid champion id.");
    const q = parseQuery(req, query);
    const res = await getChampionBuild(championId, q.role ?? null, q.patch, q.mode ?? "sr", q.variant ?? null);
    if (!res.data && res.source === "demo") throw new ServiceError(404, "Champion not found.");
    return res;
  }, 300);
}
