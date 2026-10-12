import { z } from "zod";
import { requireAdmin, RIOT_KEY_RE, testKey } from "@/server/admin";
import { saveKey } from "@/server/env";
import { handle } from "@/server/http";
import { ServiceError } from "@/server/services/player";

export const dynamic = "force-dynamic";

const body = z.object({ key: z.string().trim() });

export function POST(req: Request) {
  return handle(async () => {
    requireAdmin(req);
    const parsed = body.safeParse(await req.json().catch(() => null));
    if (!parsed.success || !RIOT_KEY_RE.test(parsed.data.key)) throw new ServiceError(400, "To nie wygląda na klucz Riot (RGAPI-xxxxxxxx-xxxx-…).");
    const check = await testKey(parsed.data.key);
    if (!check.ok) throw new ServiceError(400, check.message);
    saveKey(parsed.data.key);
    return { ok: true, message: "Klucz zapisany. NEXUS używa go od razu — bez restartu." };
  });
}
