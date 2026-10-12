import "server-only";
import { parseRiotId } from "@/lib/regions";
import type { Envelope, LeaderboardEntry, Tier } from "@/lib/types";
import { getDb } from "../db";
import { demoLeaderboard } from "../demo";
import { assertDemoAllowed, isLiveMode } from "../env";
import * as riot from "../riot/endpoints";
import { mapLimit, requireRegion, toServiceError } from "./player";

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export type LadderFilter = "all" | "challenger" | "grandmaster" | "master";
export type LadderSort = "lp" | "winrate" | "games";

const now = () => new Date().toISOString();

function sortEntries(entries: LeaderboardEntry[], sort: LadderSort) {
  if (sort === "lp") return entries;
  const games = (e: LeaderboardEntry) => e.wins + e.losses;
  return [...entries].sort((a, b) => (sort === "games" ? games(b) - games(a) : b.wins / games(b) - a.wins / games(a)));
}

export async function getLeaderboard(opts: {
  region: string;
  tier: LadderFilter;
  page: number;
  pageSize: number;
  sort: LadderSort;
  query?: string | null;
}): Promise<Envelope<LeaderboardPage>> {
  const region = requireRegion(opts.region);
  const tierFilter = (e: LeaderboardEntry) => opts.tier === "all" || e.tier === (opts.tier.toUpperCase() as Tier);

  if (!isLiveMode()) {
    assertDemoAllowed();
    const q = opts.query?.trim().toLowerCase();
    const all = sortEntries(demoLeaderboard(region.platform).filter(tierFilter), opts.sort).filter((e) => !q || e.riotId.toLowerCase().includes(q));
    const start = (opts.page - 1) * opts.pageSize;
    return {
      data: { entries: all.slice(start, start + opts.pageSize), page: opts.page, pageSize: opts.pageSize, total: all.length },
      source: "demo",
      fetchedAt: now(),
      note: "Demo ladder — add RIOT_API_KEY for the real Challenger/Grandmaster/Master ladder.",
    };
  }

  try {
    const tiers = ["challenger", "grandmaster", "master"] as const;
    const lists = await Promise.all(tiers.map((t) => riot.apexLeague(region.platform, t)));
    const ladder: LeaderboardEntry[] = lists
      .flatMap((l) => l.entries.map((e) => ({ ...e, tier: l.tier as Tier })))
      .sort((a, b) => b.leaguePoints - a.leaguePoints)
      .map((e, i) => ({ rank: i + 1, puuid: e.puuid, riotId: "", tier: e.tier, lp: e.leaguePoints, wins: e.wins, losses: e.losses }));

    void storeLadder(region.platform, ladder);

    let filtered = sortEntries(ladder.filter(tierFilter), opts.sort);
    if (opts.query) {
      const id = parseRiotId(opts.query);
      if (!id) return { data: { entries: [], page: 1, pageSize: opts.pageSize, total: 0 }, source: "riot", fetchedAt: now(), note: "Search the ladder with a full Riot ID (Name#TAG)." };
      const acc = await riot.accountByRiotId(region, id.gameName, id.tagLine).catch(() => null);
      filtered = acc ? filtered.filter((e) => e.puuid === acc.puuid) : [];
    }
    const start = (opts.page - 1) * opts.pageSize;
    const page = filtered.slice(start, start + opts.pageSize);
    // League-V4 apex lists only include puuids, so resolve names for the visible page.
    await mapLimit(page, 5, async (e) => {
      const acc = await riot.accountByPuuid(region, e.puuid).catch(() => null);
      e.riotId = acc ? `${acc.gameName}#${acc.tagLine}` : "Unknown";
    });
    return { data: { entries: page, page: opts.page, pageSize: opts.pageSize, total: filtered.length }, source: "riot", fetchedAt: now() };
  } catch (err) {
    throw toServiceError(err, "Leaderboard unavailable.");
  }
}

async function storeLadder(platform: string, ladder: LeaderboardEntry[]) {
  const db = await getDb();
  if (!db) return;
  const total = ladder.length;
  await db
    .$transaction(
      ladder.map((e) =>
        db.ladderSnapshot.upsert({
          where: { platform_puuid: { platform, puuid: e.puuid } },
          create: { platform, puuid: e.puuid, position: e.rank, total },
          update: { position: e.rank, total, capturedAt: new Date() },
        }),
      ),
    )
    .catch(() => undefined);
}
