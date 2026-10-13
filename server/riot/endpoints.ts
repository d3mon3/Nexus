import "server-only";
import { z } from "zod";
import { platformHost, regionalHost, type Platform, type RegionInfo } from "@/lib/regions";
import { cached, TTL } from "../cache";
import { env, markKeyRejected } from "../env";
import { healForeignPuuid } from "../puuid-reset";
import { riotRequest, RiotApiError } from "./client";
import {
  accountSchema,
  leagueEntriesSchema,
  leagueListSchema,
  masterySchema,
  matchIdsSchema,
  matchSchema,
  spectatorSchema,
  summonerSchema,
  timelineSchema,
} from "./schemas";

function key(): string {
  const k = env.riotApiKey;
  if (!k) throw new RiotApiError(401, "RIOT_API_KEY is not configured.");
  return k;
}

/** riotRequest with the server key; remembers when Riot rejects the key (expired dev key). */
async function req<T>(url: string, schema: z.ZodType<T>, allowNotFound = false): Promise<T | null> {
  const apiKey = key();
  try {
    return await riotRequest(url, schema, { apiKey, allowNotFound });
  } catch (err) {
    if (err instanceof RiotApiError && (err.status === 401 || err.status === 403)) markKeyRejected(apiKey);
    // A PUUID from another Riot project (after switching keys): drop stale data so the next load works.
    const foreign = err instanceof RiotApiError && err.status === 400 ? /\/by-puuid\/([^/?]+)/.exec(url)?.[1] : undefined;
    if (foreign) await healForeignPuuid(decodeURIComponent(foreign)).catch(() => false);
    throw err;
  }
}

async function get<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const data = await req(url, schema);
  if (data === null) throw new RiotApiError(404, "Not found.", url);
  return data;
}

const enc = encodeURIComponent;

/* Account-V1 (regional) */
export function accountByRiotId(region: RegionInfo, gameName: string, tagLine: string) {
  const url = `${regionalHost(region.accountRoute)}/riot/account/v1/accounts/by-riot-id/${enc(gameName)}/${enc(tagLine)}`;
  return cached(`acc:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`, TTL.account, () => get(url, accountSchema), { persist: true });
}

export function accountByPuuid(region: RegionInfo, puuid: string) {
  const url = `${regionalHost(region.accountRoute)}/riot/account/v1/accounts/by-puuid/${enc(puuid)}`;
  return cached(`accp:${puuid}`, TTL.account, () => get(url, accountSchema), { persist: true });
}

/* Summoner-V4 (platform) */
export function summonerByPuuid(platform: Platform, puuid: string) {
  const url = `${platformHost(platform)}/lol/summoner/v4/summoners/by-puuid/${enc(puuid)}`;
  return cached(`sum:${platform}:${puuid}`, TTL.summoner, () => get(url, summonerSchema));
}

/* League-V4 (platform) */
export function leagueEntries(platform: Platform, puuid: string) {
  const url = `${platformHost(platform)}/lol/league/v4/entries/by-puuid/${enc(puuid)}`;
  return cached(`lea:${platform}:${puuid}`, TTL.league, () => get(url, leagueEntriesSchema));
}

export type ApexTier = "challenger" | "grandmaster" | "master";
export function apexLeague(platform: Platform, tier: ApexTier, queue = "RANKED_SOLO_5x5") {
  const url = `${platformHost(platform)}/lol/league/v4/${tier}leagues/by-queue/${queue}`;
  return cached(`apex:${platform}:${tier}:${queue}`, TTL.leaderboard, () => get(url, leagueListSchema), { persist: true });
}

export function leagueEntriesByTier(platform: Platform, tier: string, division: string, page = 1, queue = "RANKED_SOLO_5x5") {
  const url = `${platformHost(platform)}/lol/league/v4/entries/${queue}/${tier}/${division}?page=${page}`;
  return cached(`tierlist:${platform}:${tier}:${division}:${page}`, TTL.leaderboard, () => get(url, leagueEntriesSchema));
}

/* Champion-Mastery-V4 (platform) */
export function topMastery(platform: Platform, puuid: string, count = 10) {
  const url = `${platformHost(platform)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${enc(puuid)}/top?count=${count}`;
  return cached(`mas:${platform}:${puuid}:${count}`, TTL.mastery, () => get(url, masterySchema));
}

export function masteryByChampion(platform: Platform, puuid: string, championId: number) {
  const url = `${platformHost(platform)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${enc(puuid)}/by-champion/${championId}`;
  return cached(`masc:${platform}:${puuid}:${championId}`, TTL.mastery, () =>
    req(url, masterySchema.element, true),
  );
}

/* Match-V5 (regional) */
export function matchIds(region: RegionInfo, puuid: string, opts: { start?: number; count?: number; queue?: number; startTime?: number } = {}) {
  const params = new URLSearchParams({ start: String(opts.start ?? 0), count: String(opts.count ?? 20) });
  if (opts.queue) params.set("queue", String(opts.queue));
  // startTime is epoch seconds; round to the hour so the cache key stays stable.
  if (opts.startTime) params.set("startTime", String(Math.floor(opts.startTime / 3600) * 3600));
  const url = `${regionalHost(region.matchRoute)}/lol/match/v5/matches/by-puuid/${enc(puuid)}/ids?${params}`;
  return cached(`mid:${puuid}:${params}`, TTL.matchIds, () => get(url, matchIdsSchema));
}

export function match(region: RegionInfo, matchId: string) {
  const url = `${regionalHost(region.matchRoute)}/lol/match/v5/matches/${enc(matchId)}`;
  return cached(`match:${matchId}`, TTL.match, () => get(url, matchSchema), { persist: true });
}

export function matchTimeline(region: RegionInfo, matchId: string) {
  const url = `${regionalHost(region.matchRoute)}/lol/match/v5/matches/${enc(matchId)}/timeline`;
  return cached(`tl:${matchId}`, TTL.match, () => get(url, timelineSchema), { persist: true });
}

/* Spectator-V5 (platform) — 404 means "not in game", which is not an error. */
export function activeGame(platform: Platform, puuid: string) {
  const url = `${platformHost(platform)}/lol/spectator/v5/active-games/by-summoner/${enc(puuid)}`;
  return cached(`spec:${platform}:${puuid}`, TTL.spectator, () =>
    req(url, spectatorSchema, true),
  );
}
