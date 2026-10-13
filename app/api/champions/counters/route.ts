import { z } from "zod";
import { handle, parseQuery } from "@/server/http";
import { getCounters } from "@/server/services/champions";

export const dynamic = "force-dynamic";

const query = z.object({
  opponent: z.coerce.number().int().positive(),
  role: z.enum(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]),
  patch: z.string().max(10).optional(),
});

export function GET(req: Request) {
  return handle(async () => {
    const q = parseQuery(req, query);
    return getCounters(q.opponent, q.role, q.patch);
  }, 300);
}
