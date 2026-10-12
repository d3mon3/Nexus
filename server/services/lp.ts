import "server-only";
import { rankScore } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";
import { getDb } from "../db";

/**
 * Riot does not expose per-match LP. We derive it from rank snapshots: if exactly one
 * ranked game was played between two snapshots, the LP difference belongs to that game.
 * Anything ambiguous is left as `null` and the UI shows no LP change.
 */
export async function recordSnapshot(puuid: string, platform: string, solo: RankedEntry | undefined, latestSoloMatchId: string | null) {
  const db = await getDb();
  if (!db || !solo) return;
  const last = await db.rankSnapshot.findFirst({
    where: { puuid, queue: "RANKED_SOLO_5x5" },
    orderBy: { capturedAt: "desc" },
  });
  const games = solo.wins + solo.losses;
  if (last && last.wins + last.losses === games && last.lp === solo.lp) return; // nothing changed

  await db.rankSnapshot.create({
    data: { puuid, platform, queue: "RANKED_SOLO_5x5", tier: solo.tier, division: solo.division, lp: solo.lp, wins: solo.wins, losses: solo.losses },
  });

  if (last && latestSoloMatchId && games - (last.wins + last.losses) === 1) {
    const before = rankScore(last.tier as RankedEntry["tier"], last.division as RankedEntry["division"], last.lp);
    const after = rankScore(solo.tier, solo.division, solo.lp);
    await db.matchLpChange
      .upsert({
        where: { matchId_puuid: { matchId: latestSoloMatchId, puuid } },
        create: { matchId: latestSoloMatchId, puuid, lpChange: after - before },
        update: { lpChange: after - before },
      })
      .catch(() => undefined);
  }
}

export async function lpChangesFor(puuid: string, matchIds: string[]): Promise<Map<string, number>> {
  const db = await getDb();
  if (!db || matchIds.length === 0) return new Map();
  const rows = await db.matchLpChange.findMany({ where: { puuid, matchId: { in: matchIds } } });
  return new Map(rows.map((r) => [r.matchId, r.lpChange]));
}

export async function ladderPosition(platform: string, puuid: string) {
  const db = await getDb();
  if (!db) return null;
  const row = await db.ladderSnapshot.findUnique({ where: { platform_puuid: { platform, puuid } } });
  return row ? { position: row.position, topPercent: null, scope: `apex ladder (${row.total} players)` } : null;
}
