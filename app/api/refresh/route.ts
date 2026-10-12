import { z } from "zod";
import { invalidate } from "@/server/cache";
import { handle } from "@/server/http";
import { ServiceError } from "@/server/services/player";

export const dynamic = "force-dynamic";

const body = z.object({ puuid: z.string().min(10).max(120), platform: z.string().min(2).max(6) });

/** Drops cached volatile data for one player (rank, match list, live game). */
export function POST(req: Request) {
  return handle(async () => {
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ServiceError(400, "Invalid refresh request.");
    const { puuid, platform } = parsed.data;
    await Promise.all([invalidate(`lea:${platform}:${puuid}`), invalidate(`mid:${puuid}`), invalidate(`spec:${platform}:${puuid}`), invalidate(`sum:${platform}:${puuid}`)]);
    return { ok: true };
  });
}
