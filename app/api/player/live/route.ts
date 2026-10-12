import { z } from "zod";
import { handle, parseQuery, puuidParam, regionParam } from "@/server/http";
import { getLiveGame } from "@/server/services/player";

export const dynamic = "force-dynamic";

const query = z.object({ region: regionParam, puuid: puuidParam });

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getLiveGame(q.region, q.puuid);
  });
}
