import { getChampionDetail } from "@/server/ddragon";
import { handle } from "@/server/http";
import { ServiceError } from "@/server/services/player";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  return handle(async () => {
    if (!/^[A-Za-z]{2,20}$/.test(key)) throw new ServiceError(400, "Invalid champion key.");
    return getChampionDetail(key);
  }, 3600);
}
