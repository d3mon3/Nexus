import { kda } from "@/lib/format";
import type { MatchDetail, RankedEntry, Role, ScoutPlayer, ScoutTag } from "@/lib/types";

const HOUR = 3600e3;
const DAY = 24 * HOUR;

export interface ScoutInput {
  puuid: string;
  riotId: string;
  teamId: 100 | 200;
  championId: number;
  championName: string;
  spells: [number, number];
  keystone: number | null;
  subStyle: number | null;
  summonerLevel: number;
  profileIconId: number;
  ranked: RankedEntry | null;
  ladderRank: number | null;
  mastery: { level: number; points: number } | null;
  /** Most recent first. */
  matches: MatchDetail[];
  /** Game counts from id lists (exact up to the request limit). */
  games12h: number;
  games30d: number;
  proTeam?: string | null;
  now?: number;
}

const ROLE_ADJ: Record<Role, string> = { TOP: "Laner", MIDDLE: "Laner", BOTTOM: "Laner", JUNGLE: "Jungler", UTILITY: "Support" };

/**
 * Builds a scouting card from recent matches. Every tag is derived from the numbers below,
 * so a tag never claims something the data doesn't show.
 */
export function computeScout(input: ScoutInput, nameOf: (championId: number) => string): ScoutPlayer {
  const now = input.now ?? Date.now();
  const mine = input.matches
    .map((m) => ({ m, p: m.participants.find((p) => p.puuid === input.puuid) }))
    .filter((x): x is { m: MatchDetail; p: NonNullable<typeof x.p> } => Boolean(x.p))
    .filter((x) => x.m.durationSec >= 300);

  const n = mine.length;
  const within = (ms: number) => mine.filter(({ m }) => now - m.gameCreation <= ms);
  const w12 = within(12 * HOUR);
  const w30 = within(30 * DAY);

  // Champion performance (current champion)
  const onChamp = mine.filter(({ p }) => p.championId === input.championId);
  const champion = onChamp.length
    ? {
        games: onChamp.length,
        wins: onChamp.filter(({ p }) => p.win).length,
        kills: avg(onChamp.map(({ p }) => p.kills)),
        deaths: avg(onChamp.map(({ p }) => p.deaths)),
        assists: avg(onChamp.map(({ p }) => p.assists)),
      }
    : null;

  // Main role
  const roleCount = new Map<Role, number>();
  for (const { p } of mine) if (p.role) roleCount.set(p.role, (roleCount.get(p.role) ?? 0) + 1);
  const mainRole = [...roleCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Aggregates for tags
  const minutes = mine.map(({ m }) => Math.max(1, m.durationSec / 60));
  const csPerMin = avg(mine.map(({ p }, i) => p.cs / minutes[i]));
  const visionPerMin = avg(mine.map(({ p }, i) => p.visionScore / minutes[i]));
  const deaths = avg(mine.map(({ p }) => p.deaths));
  const kp = avg(
    mine.map(({ m, p }) => {
      const teamKills = m.participants.filter((x) => x.teamId === p.teamId).reduce((s, x) => s + x.kills, 0);
      return teamKills ? (p.kills + p.assists) / teamKills : 0;
    }),
  );
  const fightsPerMin = avg(mine.map(({ p }, i) => (p.kills + p.deaths) / minutes[i]));
  const champCounts = new Map<number, number>();
  for (const { p } of mine) champCounts.set(p.championId, (champCounts.get(p.championId) ?? 0) + 1);
  const [topChamp, topChampGames] = [...champCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [0, 0];

  let streak = 0;
  for (const { p } of mine) {
    if (streak === 0) streak = p.win ? 1 : -1;
    else if ((streak > 0) === p.win) streak += streak > 0 ? 1 : -1;
    else break;
  }

  const tags: ScoutTag[] = [];
  const add = (label: string, tone: ScoutTag["tone"]) => tags.push({ label, tone });
  const champName = input.championName;

  if (input.proTeam) add(`Pro: ${input.proTeam}`, "info");
  if (n >= 5) {
    if (mainRole && mainRole !== "UTILITY" && mainRole !== "JUNGLE" && csPerMin >= 7.5) add("Good CSer", "good");
    if (visionPerMin >= (mainRole === "UTILITY" ? 2.3 : 1.3)) add("Good vision", "good");
    if (kp >= 0.65) add("High Kill Participation", "good");
    if (mainRole && mainRole !== "UTILITY" && fightsPerMin >= 0.42) add(`Aggressive ${ROLE_ADJ[mainRole]}`, "good");
    if (mainRole === "MIDDLE" && kp >= 0.6) add("Roaming", "neutral");
    if (deaths >= 7) add(mainRole === "JUNGLE" ? "Vulnerable Jungler" : "Vulnerable Laner", "bad");
    if (topChampGames / n >= 0.7) add(`OTP ${nameOf(topChamp)}`, "good");
    else if (topChampGames / n >= 0.4) add(`${nameOf(topChamp)} lover`, "good");
  }
  if (champion && champion.games >= 4 && champion.wins / champion.games >= 0.65 && kda(champion.kills, champion.deaths, champion.assists) >= 3.5) add(`Godlike ${champName}`, "good");
  if (input.mastery && input.mastery.points >= 1_000_000) add(`Millionaire: ${champName}`, "good");
  if (!champion && n >= 5 && (input.mastery?.points ?? 0) < 10_000) add(`First time ${champName}`, "bad");
  if (streak >= 3) add(`Win streak ×${streak}`, "good");
  if (streak <= -3) add(`Loss streak ×${-streak}`, "bad");
  const last = mine[0]?.m;
  if (last && now - (last.gameCreation + last.durationSec * 1000) >= 12 * HOUR) add("Waking up", "neutral");
  if (n > 0 && n < 3) add("Few recent games", "neutral");

  return {
    puuid: input.puuid,
    riotId: input.riotId,
    teamId: input.teamId,
    championId: input.championId,
    summonerLevel: input.summonerLevel,
    profileIconId: input.profileIconId,
    spells: input.spells,
    keystone: input.keystone,
    subStyle: input.subStyle,
    mastery: input.mastery,
    champion,
    ranked: input.ranked,
    ladderRank: input.ladderRank,
    last12h: { games: Math.max(input.games12h, w12.length), wins: w12.length === Math.max(input.games12h, w12.length) ? w12.filter(({ p }) => p.win).length : null },
    last30d: { games: Math.max(input.games30d, w30.length), wins: w30.filter(({ p }) => p.win).length, analysed: w30.length },
    mainRole,
    tags,
    analysed: n,
  };
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}
