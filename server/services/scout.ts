import "server-only";
import type { Envelope, LiveParticipant, MatchDetail, ScoutPlayer } from "@/lib/types";
import { getStaticBundle } from "../ddragon";
import { decodeDemoPuuid, demoMatchDetail, demoMatchSummaries, demoProfile, demoPuuid } from "../demo";
import { assertDemoAllowed, isLiveMode } from "../env";
import * as riot from "../riot/endpoints";
import { mapLeagueEntries, mapMatch } from "../riot/mappers";
import { ladderPosition } from "./lp";
import { mapLimit, requireRegion, toServiceError } from "./player";
import { getProPlayers } from "./pros";
import { computeScout } from "./scout-compute";

const HOUR = 3600e3;
const now = () => new Date().toISOString();

export interface ScoutRequest {
  region: string;
  puuid: string;
  riotId: string;
  teamId: 100 | 200;
  championId: number;
  spells: [number, number];
  keystone: number | null;
  subStyle: number | null;
  /** How many recent matches to analyse (cost: one Match-V5 call each, cached forever). */
  depth: number;
}

export function scoutRequestFrom(region: string, p: LiveParticipant, depth: number): ScoutRequest | null {
  if (!p.puuid) return null;
  return {
    region,
    puuid: p.puuid,
    riotId: p.riotId,
    teamId: p.teamId,
    championId: p.championId,
    spells: p.spells,
    keystone: p.perks?.keystone ?? null,
    subStyle: p.perks?.subStyle ?? null,
    depth,
  };
}

export async function getScoutPlayer(req: ScoutRequest): Promise<Envelope<ScoutPlayer>> {
  const region = requireRegion(req.region);
  const { champions } = await getStaticBundle();
  const nameOf = (id: number) => champions.find((c) => c.id === id)?.name ?? `#${id}`;
  const championName = nameOf(req.championId);
  const pros = (await getProPlayers()).data;
  const pro = pros.find((p) => p.riotId && p.riotId.toLowerCase() === req.riotId.toLowerCase());
  const nowMs = Date.now();

  const demoId = decodeDemoPuuid(req.puuid);
  if (!isLiveMode() || demoId) {
    assertDemoAllowed();
    const id = demoId ?? { gameName: req.riotId.split("#")[0], tagLine: req.riotId.split("#")[1] ?? "EUW" };
    const puuid = demoId ? req.puuid : demoPuuid(id.gameName, id.tagLine);
    const profile = demoProfile(id.gameName, id.tagLine, region.platform);
    const all = demoMatchSummaries(puuid, region.platform, { start: 0, count: 200 }).matches;
    const matches = all.slice(0, req.depth).map((m) => demoMatchDetail(m.matchId)!);
    const mastery = profile.mastery.find((m) => m.championId === req.championId);
    return {
      data: computeScout(
        {
          ...req,
          puuid,
          championName,
          summonerLevel: profile.account.summonerLevel,
          profileIconId: profile.account.profileIconId,
          ranked: profile.ranked.find((r) => r.queue === "RANKED_SOLO_5x5") ?? null,
          ladderRank: profile.ladder?.position ?? null,
          mastery: mastery ? { level: mastery.championLevel, points: mastery.championPoints } : null,
          matches,
          games12h: all.filter((m) => nowMs - m.gameCreation <= 12 * HOUR).length,
          games30d: all.filter((m) => nowMs - m.gameCreation <= 30 * 24 * HOUR).length,
          proTeam: pro?.team ?? null,
          now: nowMs,
        },
        nameOf,
      ),
      source: "demo",
      fetchedAt: now(),
      note: "Demo data.",
    };
  }

  try {
    const [summoner, entries, mastery, ids12, ids30, ladder] = await Promise.all([
      riot.summonerByPuuid(region.platform, req.puuid),
      riot.leagueEntries(region.platform, req.puuid),
      riot.masteryByChampion(region.platform, req.puuid, req.championId).catch(() => null),
      riot.matchIds(region, req.puuid, { count: 100, startTime: (nowMs - 12 * HOUR) / 1000 }).catch(() => [] as string[]),
      riot.matchIds(region, req.puuid, { count: 100, startTime: (nowMs - 30 * 24 * HOUR) / 1000 }).catch(() => [] as string[]),
      ladderPosition(region.platform, req.puuid).catch(() => null),
    ]);
    const recentIds = ids30.length ? ids30.slice(0, req.depth) : await riot.matchIds(region, req.puuid, { count: req.depth }).catch(() => [] as string[]);
    const matches: MatchDetail[] = (await mapLimit(recentIds, 3, (id) => riot.match(region, id).catch(() => null))).filter(Boolean).map((m) => mapMatch(m!, req.puuid));
    return {
      data: computeScout(
        {
          ...req,
          championName,
          summonerLevel: summoner.summonerLevel,
          profileIconId: summoner.profileIconId,
          ranked: mapLeagueEntries(entries).find((e) => e.queue === "RANKED_SOLO_5x5") ?? null,
          ladderRank: ladder?.position ?? null,
          mastery: mastery ? { level: mastery.championLevel, points: mastery.championPoints } : null,
          matches,
          games12h: ids12.length,
          games30d: ids30.length,
          proTeam: pro?.team ?? null,
          now: nowMs,
        },
        nameOf,
      ),
      source: "riot",
      fetchedAt: now(),
      note: `Based on the last ${matches.length} matches${ids30.length >= 100 ? "; 30-day count capped at 100" : ""}.`,
    };
  } catch (err) {
    throw toServiceError(err, "Player not found.");
  }
}
