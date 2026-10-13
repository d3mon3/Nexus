/**
 * LP tracker: Riot has no per-match LP, so NEXUS snapshots the rank of recently viewed
 * players every few minutes. When exactly one ranked game happened between two snapshots,
 * that game gets its exact LP change (server/services/lp.ts). Run by deploy/aggregate-loop.sh.
 *
 *   npx tsx --conditions=react-server scripts/track-lp.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveRegion } from "../lib/regions";
import { env } from "../server/env";
import * as riot from "../server/riot/endpoints";
import { mapLeagueEntries } from "../server/riot/mappers";
import { latestMatchLoader, recordRanks } from "../server/services/lp";

const MAX_PLAYERS = Number(process.env.LP_TRACK_MAX ?? 60);
const DAYS = Number(process.env.LP_TRACK_DAYS ?? 14);

async function main() {
  if (!env.riotApiKey || !process.env.DATABASE_URL) return;
  const db = new PrismaClient();
  try {
    const since = new Date(Date.now() - DAYS * 24 * 3600e3);
    const players = await db.rankSnapshot.groupBy({
      by: ["puuid", "platform"],
      where: { capturedAt: { gte: since } },
      _max: { capturedAt: true },
      orderBy: { _max: { capturedAt: "desc" } },
      take: MAX_PLAYERS,
    });
    let changed = 0;
    for (const p of players) {
      const region = resolveRegion(p.platform);
      if (!region) continue;
      try {
        const entries = await riot.leagueEntries(region.platform, p.puuid);
        const before = await db.rankSnapshot.count({ where: { puuid: p.puuid } });
        await recordRanks(p.puuid, region.platform, mapLeagueEntries(entries), latestMatchLoader(region, p.puuid));
        if ((await db.rankSnapshot.count({ where: { puuid: p.puuid } })) > before) changed++;
      } catch {
        /* expired key or Riot busy — try again next round */
      }
    }
    if (changed) console.log(`[lp] ${players.length} players checked, ${changed} rank changes recorded`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error("[lp]", err instanceof Error ? err.message : err);
  process.exit(0);
});
