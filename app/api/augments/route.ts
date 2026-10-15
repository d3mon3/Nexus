import { z } from "zod";
import { handle, parseQuery } from "@/server/http";
import { getAugmentTierList } from "@/server/services/champions";

export const dynamic = "force-dynamic";

const query = z.object({ mode: z.enum(["arena", "aram-mayhem"]).catch("arena") });

/** Augment tier list for Arena or ARAM Mayhem, from aggregated matches. */
export function GET(req: Request) {
  return handle(async () => getAugmentTierList(parseQuery(req, query).mode), 300);
}
