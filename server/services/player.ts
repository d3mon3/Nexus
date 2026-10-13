import "server-only";
import { parseRiotId, resolveRegion, type RegionInfo } from "@/lib/regions";
import { QUEUE_FILTERS } from "@/lib/static-data";
import type { Envelope, LiveGame, MatchDetail, MatchSummary, PlayerProfile, PlayerStats, RankedEntry } from "@/lib/types";
import { decodeDemoPuuid, demoLiveGame, demoMatchDetail, demoMatchSummaries, demoProfile, toSummary } from "../demo";
import { assertDemoAllowed, isLiveMode } from "../env";
import * as riot from "../riot/endpoints";
import { RiotApiError } from "../riot/client";
import { mapLeagueEntries, mapMatch, mapSpectator } from "../riot/mappers";
import { ladderPosition, latestMatchLoader, lpChangesFor, recordRanks } from "./lp";
import { computePlayerStats } from "./stats";
import { healForeignPuuid } from "../puuid-reset";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

const now = () => new Date().toISOString();

export function requireRegion(value: string | null | undefined): RegionInfo {
  const region = resolveRegion(value);
  if (!region) throw new ServiceError(400, `Unknown region "${value}".`);
  return region;
}

const DEMO_NOTE = "Demo mode — add RIOT_API_KEY to load real Riot data.";

/* ---------------------------------------------------------------- profile */

export async function getProfile(regionValue: string, riotIdValue: string): Promise<Envelope<PlayerProfile>> {
  const region = requireRegion(regionValue);
  const id = parseRiotId(riotIdValue);
  if (!id) throw new ServiceError(400, "Riot ID must look like Name#TAG.");

  if (!isLiveMode()) {
    assertDemoAllowed();
    return { data: demoProfile(id.gameName, id.tagLine, region.platform), source: "demo", fetchedAt: now(), note: DEMO_NOTE };
  }

  try {
    return await loadProfile(region, id);
  } catch (err) {
    // 400 on a PUUID endpoint after switching Riot keys: the cached PUUID is from the old project.
    if (err instanceof RiotApiError && err.status === 400) {
      const stale = await riot.accountByRiotId(region, id.gameName, id.tagLine).catch(() => null);
      if (stale && (await healForeignPuuid(stale.puuid))) {
        try {
          return await loadProfile(region, id);
        } catch (retryErr) {
          throw toServiceError(retryErr, "Player not found on this region.");
        }
      }
    }
    throw toServiceError(err, "Player not found on this region.");
  }
}

async function loadProfile(region: RegionInfo, id: { gameName: string; tagLine: string }): Promise<Envelope<PlayerProfile>> {
  {
    const account = await riot.accountByRiotId(region, id.gameName, id.tagLine);
    const [summoner, entries, mastery] = await Promise.all([
      riot.summonerByPuuid(region.platform, account.puuid),
      riot.leagueEntries(region.platform, account.puuid),
      riot.topMastery(region.platform, account.puuid, 30),
    ]);
    const ranked = mapLeagueEntries(entries);
    await recordRanks(account.puuid, region.platform, ranked, latestMatchLoader(region, account.puuid)).catch(() => undefined);
    return {
      data: {
        account: {
          puuid: account.puuid,
          gameName: account.gameName || id.gameName,
          tagLine: account.tagLine || id.tagLine,
          platform: region.platform,
          profileIconId: summoner.profileIconId,
          summonerLevel: summoner.summonerLevel,
        },
        ranked,
        mastery,
        ladder: await ladderPosition(region.platform, account.puuid).catch(() => null),
        peak: null, // not exposed by the Riot API
        mainChampionId: mastery[0]?.championId ?? null,
      },
      source: "riot",
      fetchedAt: now(),
    };
  }
}

/* ---------------------------------------------------------------- matches */

export interface MatchPage {
  matches: MatchSummary[];
  start: number;
  count: number;
  /** Total is known only for demo data; Riot only tells us whether more ids exist. */
  total: number | null;
  hasMore: boolean;
}

export async function getMatches(
  regionValue: string,
  puuid: string,
  opts: { start: number; count: number; queue?: string | null; championId?: number | null; result?: "win" | "loss" | null },
): Promise<Envelope<MatchPage>> {
  const region = requireRegion(regionValue);
  const filter = QUEUE_FILTERS.find((f) => f.value === (opts.queue ?? "all")) ?? QUEUE_FILTERS[0];

  if (!isLiveMode() || decodeDemoPuuid(puuid)) {
    assertDemoAllowed();
    const { matches, total } = demoMatchSummaries(puuid, region.platform, { ...opts, queueIds: filter.ids });
    return {
      data: { matches, start: opts.start, count: opts.count, total, hasMore: opts.start + opts.count < total },
      source: "demo",
      fetchedAt: now(),
      note: DEMO_NOTE,
    };
  }

  try {
    // Match-V5 filters by one queue id server-side; champion/result filters are applied
    // to the fetched page (the API has no such parameters).
    const queue = filter.ids?.length === 1 ? filter.ids[0] : undefined;
    const ids = await riot.matchIds(region, puuid, { start: opts.start, count: opts.count, queue });
    const details = await mapLimit(ids, 5, (id) => riot.match(region, id));
    const lp = await lpChangesFor(puuid, ids);
    const matches = details
      .map((m) => mapMatch(m, puuid, lp.get(m.metadata.matchId) ?? null))
      .filter((m) => !filter.ids || filter.ids.includes(m.queueId))
      .filter((m) => !opts.championId || m.me.championId === opts.championId)
      .filter((m) => !opts.result || (opts.result === "win") === m.me.win)
      .map(toSummary);
    return {
      data: { matches, start: opts.start, count: opts.count, total: null, hasMore: ids.length === opts.count },
      source: "riot",
      fetchedAt: now(),
      note: opts.championId || opts.result ? "Champion and result filters apply to each page of matches." : undefined,
    };
  } catch (err) {
    throw toServiceError(err, "Could not load match history.");
  }
}

export async function getMatch(regionValue: string, matchId: string, puuid: string | null): Promise<Envelope<MatchDetail>> {
  const region = requireRegion(regionValue);
  if (matchId.startsWith("DEMO_")) {
    assertDemoAllowed();
    const m = demoMatchDetail(matchId);
    if (!m) throw new ServiceError(404, "Match not found.");
    return { data: m, source: "demo", fetchedAt: now(), note: DEMO_NOTE };
  }
  if (!isLiveMode()) throw new ServiceError(404, "Match not found.");
  try {
    const raw = await riot.match(region, matchId);
    const me = puuid ?? raw.metadata.participants[0];
    const lp = await lpChangesFor(me, [matchId]);
    return { data: mapMatch(raw, me, lp.get(matchId) ?? null), source: "riot", fetchedAt: now() };
  } catch (err) {
    throw toServiceError(err, "Match not found.");
  }
}

/* -------------------------------------------------------------- live game */

export async function getLiveGame(regionValue: string, puuid: string): Promise<Envelope<LiveGame | null>> {
  const region = requireRegion(regionValue);
  if (!isLiveMode() || decodeDemoPuuid(puuid)) {
    assertDemoAllowed();
    return {
      data: demoLiveGame(puuid),
      source: "demo",
      fetchedAt: now(),
      note: "Demo mode. Live KDA, CS and items are what the desktop app reads from the local League client during your own game.",
    };
  }
  try {
    const game = await riot.activeGame(region.platform, puuid);
    if (!game) return { data: null, source: "riot", fetchedAt: now() };
    const ranks = new Map<string, RankedEntry | null>();
    await mapLimit(game.participants, 4, async (p) => {
      if (!p.puuid) return;
      const entries = await riot.leagueEntries(region.platform, p.puuid).catch(() => []);
      ranks.set(p.puuid, mapLeagueEntries(entries).find((e) => e.queue === "RANKED_SOLO_5x5") ?? null);
    });
    return {
      data: mapSpectator(game, ranks),
      source: "riot",
      fetchedAt: now(),
      note: "Spectator-V5 does not include KDA, gold, items or objective timers.",
    };
  } catch (err) {
    throw toServiceError(err, "Could not load live game.");
  }
}

/* ------------------------------------------------------------------ stats */

export async function getPlayerStats(regionValue: string, puuid: string, count = 20, queue: string | null = null): Promise<Envelope<PlayerStats>> {
  const region = requireRegion(regionValue);
  const page = await getMatches(region.platform, puuid, { start: 0, count, queue });
  const details: MatchDetail[] = [];
  if (page.source === "demo") {
    for (const s of page.data.matches) {
      const d = demoMatchDetail(s.matchId);
      if (d) details.push(d);
    }
  } else {
    const loaded = await mapLimit(page.data.matches, 5, (s) => getMatch(region.platform, s.matchId, puuid).then((e) => e.data));
    details.push(...loaded);
  }
  return {
    data: computePlayerStats(details, puuid),
    source: page.source,
    fetchedAt: now(),
    note: `Computed from the last ${details.length} matches.`,
  };
}

/* ---------------------------------------------------------------- helpers */

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export function toServiceError(err: unknown, notFoundMessage: string): ServiceError {
  if (err instanceof ServiceError) return err;
  const status = (err as { status?: unknown } | null)?.status;
  if (err instanceof Error && !(err instanceof RiotApiError) && typeof status === "number") return new ServiceError(status, err.message);
  if (err instanceof RiotApiError) {
    if (err.status === 404) return new ServiceError(404, notFoundMessage);
    if (err.status === 429) return new ServiceError(429, err.message);
    if (err.status === 401 || err.status === 403)
      return new ServiceError(503, "The server's Riot API key is invalid or expired. The admin can paste a new one at /admin.");
    if (err.status === 400) return new ServiceError(400, "Riot didn't accept this request — refresh the page and search the player again.");
    return new ServiceError(502, err.message);
  }
  console.error("[nexus] unexpected error", err);
  return new ServiceError(500, "Unexpected server error.");
}
