import { z } from "zod";
import { handle, parseQuery } from "@/server/http";
import { getAugmentCatalog } from "@/server/ddragon";

export const dynamic = "force-dynamic";

const query = z.object({ lang: z.enum(["en", "pl"]).catch("en") });

/** Augment names and icons (CommunityDragon), Polish names when available. */
export function GET(req: Request) {
  return handle(async () => {
    const { lang } = parseQuery(req, query);
    const en = await getAugmentCatalog("en_us");
    if (lang !== "pl") return en;
    const pl = await getAugmentCatalog("pl_pl");
    const plById = new Map(pl.map((a) => [a.id, a.name]));
    return en.map((a) => ({ ...a, name: plById.get(a.id) ?? a.name }));
  }, 3600);
}
