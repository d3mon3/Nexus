import "server-only";
import { rankScore } from "@/lib/format";
import type { RankedEntry } from "@/lib/types";
import type { RegionInfo } from "@/lib/regions";
import { invalidate } from "../cache";
import { getDb } from "../db";
import * as riot from "../riot/endpoints";

/**
 * Riot does not expose per-match LP. We derive it from rank snapshots: if exactly one
 * ranked game was played between two snapshots, the LP difference belongs to that game.
 * Anything ambiguous is left as `null` and the UI shows no LP change.
 * Solo/Duo and Flex are tracked separately.
 */
export interface LatestMatch {
  matchId: string;
  /** ms epoch */
  endedAt: number;
}
/** Loads the newest match of a ranked queue (420 / 440), bypassing stale caches. */
export type LatestMatchLoader = (queueId: number) => Promise<LatestMatch | null>;

const QUEUES: { key: RankedEntry["queue"]; queueId: number }[] = [
  { key: "RANKED_SOLO_5x5", queueId: 420 },
  { key: "RANKED_FLEX_SR", queueId: 440 },
];

/** Loader backed by match-v5; skips the short match-id cache so a just-finished game is seen. */
export function latestMatchLoader(region: RegionInfo, puuid: string): LatestMatchLoader {
  return async (queueId) => {
    await invalidate(`mid:${puuid}:`);
    const [id] = await riot.matchIds(region, puuid, { start: 0, count: 1, queue: queueId });
    if (!id) return null;
    const m = await riot.match(region, id);
    const info = m.info as { gameCreation: number; gameDuration: number; gameEndTimestamp?: number };
    const endedAt = info.gameEndTimestamp ?? info.gameCreation + (info.gameDuration > 100_000 ? info.gameDuration : info.gameDuration * 1000);
    return { matchId: id, endedAt };
  };
}

export async function recordRanks(puuid: string, platform: string, ranked: RankedEntry[], latest: LatestMatchLoader) {
  for (const q of QUEUES) {
    const entry = ranked.find((r) => r.queue === q.key);
    if (entry) await recordQueue(puuid, platform, entry, q.queueId, latest).catch(() => undefined);
  }
}

async function recordQueue(puuid: string, platform: string, entry: RankedEntry, queueId: number, latest: LatestMatchLoader) {
  const db = await getDb();
  if (!db) return;
  const last = await db.rankSnapshot.findFirst({ where: { puuid, queue: entry.queue }, orderBy: { capturedAt: "desc" } });
  const games = entry.wins + entry.losses;
  if (last && last.wins + last.losses === games && last.lp === entry.lp && last.tier === entry.tier && last.division === entry.division) return; // nothing changed

  let match: LatestMatch | null = null;
  if (last && games - (last.wins + last.losses) === 1) {
    match = await latest(queueId).catch(() => null);
    // The rank updates right after the game, the match appears in match-v5 a minute or two later.
    // Until it does, keep the old snapshot so the next check can still attribute the LP.
    const fresh = match && match.endedAt > last.capturedAt.getTime() - 5 * 60_000;
    if (!fresh && Date.now() - last.capturedAt.getTime() < 6 * 3600_000) return;
    if (!fresh) match = null;
  }

  await db.rankSnapshot.create({
    data: { puuid, platform, queue: entry.queue, tier: entry.tier, division: entry.division, lp: entry.lp, wins: entry.wins, losses: entry.losses },
  });

  if (last && match) {
    const before = rankScore(last.tier as RankedEntry["tier"], last.division as RankedEntry["division"], last.lp);
    const after = rankScore(entry.tier, entry.division, entry.lp);
    await db.matchLpChange
      .upsert({
        where: { matchId_puuid: { matchId: match.matchId, puuid } },
        create: { matchId: match.matchId, puuid, lpChange: after - before },
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
