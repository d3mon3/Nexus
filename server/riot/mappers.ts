import { queueName } from "@/lib/static-data";
import type { Division, LiveGame, MatchDetail, ParticipantSummary, QueueKey, RankedEntry, Role, Tier } from "@/lib/types";
import type { RiotMatch, RiotParticipant, RiotSpectatorGame } from "./schemas";

const ROLE_SET = new Set(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);

export function mapParticipant(p: RiotParticipant): ParticipantSummary {
  const name = p.riotIdGameName || p.summonerName || "Unknown";
  const primary = p.perks?.styles?.[0];
  const secondary = p.perks?.styles?.[1];
  return {
    puuid: p.puuid,
    riotId: p.riotIdTagline ? `${name}#${p.riotIdTagline}` : name,
    championId: p.championId,
    championName: p.championName,
    teamId: p.teamId === 200 ? 200 : 100,
    role: ROLE_SET.has(p.teamPosition) ? (p.teamPosition as Role) : null,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    cs: p.totalMinionsKilled + p.neutralMinionsKilled,
    gold: p.goldEarned,
    damageToChampions: p.totalDamageDealtToChampions,
    damageTaken: p.totalDamageTaken,
    visionScore: p.visionScore,
    wardsPlaced: p.wardsPlaced,
    champLevel: p.champLevel,
    items: { items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5], trinket: p.item6 },
    spells: [p.summoner1Id, p.summoner2Id],
    primaryRune: primary?.selections?.[0]?.perk ?? 0,
    secondaryStyle: secondary?.style ?? 0,
    win: p.win,
  };
}

export function patchFromVersion(gameVersion: string): string {
  const [major, minor] = gameVersion.split(".");
  return major && minor ? `${major}.${minor}` : gameVersion;
}

export function mapMatch(m: RiotMatch, puuid: string, lpChange: number | null = null): MatchDetail {
  const participants = m.info.participants.map(mapParticipant);
  const me = participants.find((p) => p.puuid === puuid) ?? participants[0];
  // gameDuration is in seconds since patch 11.20; older matches report milliseconds.
  const durationSec = m.info.gameDuration > 100_000 ? Math.round(m.info.gameDuration / 1000) : m.info.gameDuration;
  return {
    matchId: m.metadata.matchId,
    queueId: m.info.queueId,
    queueName: queueName(m.info.queueId),
    gameCreation: m.info.gameCreation,
    durationSec,
    patch: patchFromVersion(m.info.gameVersion),
    me,
    lpChange,
    teams: ([100, 200] as const).map((teamId) => ({
      teamId,
      championIds: participants.filter((p) => p.teamId === teamId).map((p) => p.championId),
      riotIds: participants.filter((p) => p.teamId === teamId).map((p) => p.riotId),
    })),
    participants,
    objectives: m.info.teams.map((t) => ({
      teamId: t.teamId === 200 ? 200 : 100,
      win: t.win,
      kills: t.objectives.champion?.kills ?? participants.filter((p) => p.teamId === t.teamId).reduce((s, p) => s + p.kills, 0),
      baron: t.objectives.baron?.kills ?? 0,
      dragon: t.objectives.dragon?.kills ?? 0,
      herald: t.objectives.riftHerald?.kills ?? 0,
      grubs: t.objectives.horde?.kills ?? 0,
      tower: t.objectives.tower?.kills ?? 0,
      inhibitor: t.objectives.inhibitor?.kills ?? 0,
    })),
  };
}

const TIERS = new Set(["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"]);

export function mapLeagueEntries(
  entries: { queueType: string; tier: string; rank?: string | null; leaguePoints: number; wins: number; losses: number; hotStreak?: boolean }[],
): RankedEntry[] {
  return entries
    .filter((e) => (e.queueType === "RANKED_SOLO_5x5" || e.queueType === "RANKED_FLEX_SR") && TIERS.has(e.tier))
    .map((e) => ({
      queue: e.queueType as QueueKey,
      tier: e.tier as Tier,
      division: (["I", "II", "III", "IV"].includes(e.rank ?? "") ? e.rank : null) as Division | null,
      lp: e.leaguePoints,
      wins: e.wins,
      losses: e.losses,
      hotStreak: e.hotStreak,
    }))
    .sort((a, b) => (a.queue === "RANKED_SOLO_5x5" ? 0 : 1) - (b.queue === "RANKED_SOLO_5x5" ? 0 : 1));
}

export function mapSpectator(g: RiotSpectatorGame, rankByPuuid: Map<string, RankedEntry | null>): LiveGame {
  const lengthSec = g.gameStartTime > 0 ? Math.max(0, Math.round((Date.now() - g.gameStartTime) / 1000)) : g.gameLength;
  return {
    gameId: g.gameId,
    queueId: g.gameQueueConfigId,
    queueName: queueName(g.gameQueueConfigId),
    mapName: g.mapId === 12 ? "Howling Abyss" : "Summoner's Rift",
    gameStartTime: g.gameStartTime,
    gameLengthSec: lengthSec,
    participants: g.participants.map((p) => ({
      puuid: p.puuid ?? null,
      riotId: p.riotId || "Hidden player",
      championId: p.championId,
      teamId: p.teamId === 200 ? 200 : 100,
      spells: [p.spell1Id, p.spell2Id],
      perks: p.perks ? { primaryStyle: p.perks.perkStyle, subStyle: p.perks.perkSubStyle, keystone: p.perks.perkIds[0] ?? 0 } : null,
      ranked: p.puuid ? (rankByPuuid.get(p.puuid) ?? null) : null,
      live: null,
    })),
    bans: g.bannedChampions.filter((b) => b.championId > 0).map((b) => ({ championId: b.championId, teamId: b.teamId === 200 ? 200 : 100 })),
    unavailable: ["KDA", "Gold", "Items", "Objective timers"],
  };
}
