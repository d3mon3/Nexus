import { kda } from "@/lib/format";
import type { MatchDetail, PlayerStats, Role } from "@/lib/types";
import { computeInsights } from "./insights";

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

/**
 * Derives player analytics from full match records. Works identically for Riot data and
 * demo data — nothing here is "invented"; every number is computed from the matches.
 */
export function computePlayerStats(matches: MatchDetail[], puuid: string): PlayerStats {
  const games = matches.filter((m) => m.participants.some((p) => p.puuid === puuid));
  const chronological = [...games].sort((a, b) => a.gameCreation - b.gameCreation);

  let wins = 0;
  let k = 0;
  let d = 0;
  let a = 0;
  let cs = 0;
  let vision = 0;
  let dmg = 0;
  let minutes = 0;
  let kpSum = 0;
  const roleMap = new Map<Role, { games: number; wins: number }>();
  const champMap = new Map<number, { games: number; wins: number; k: number; d: number; a: number; cs: number; min: number }>();
  const perGameScore: number[] = [];
  const timeline: PlayerStats["timeline"] = [];
  let cumulativeLp: number | null = 0;
  let rollingWins = 0;

  chronological.forEach((m, i) => {
    const me = m.participants.find((p) => p.puuid === puuid)!;
    const min = Math.max(1, m.durationSec / 60);
    const teamKills = m.participants.filter((p) => p.teamId === me.teamId).reduce((s, p) => s + p.kills, 0);
    const kp = teamKills ? (me.kills + me.assists) / teamKills : 0;
    if (me.win) wins++;
    k += me.kills;
    d += me.deaths;
    a += me.assists;
    cs += me.cs;
    vision += me.visionScore;
    dmg += me.damageToChampions;
    minutes += min;
    kpSum += kp;

    if (me.role) {
      const r = roleMap.get(me.role) ?? { games: 0, wins: 0 };
      r.games++;
      if (me.win) r.wins++;
      roleMap.set(me.role, r);
    }
    const c = champMap.get(me.championId) ?? { games: 0, wins: 0, k: 0, d: 0, a: 0, cs: 0, min: 0 };
    c.games++;
    if (me.win) c.wins++;
    c.k += me.kills;
    c.d += me.deaths;
    c.a += me.assists;
    c.cs += me.cs;
    c.min += min;
    champMap.set(me.championId, c);

    const gameKda = kda(me.kills, me.deaths, me.assists);
    perGameScore.push(clamp(Math.min(gameKda, 8) * 9 + kp * 30 + (me.win ? 10 : 0)));
    rollingWins += me.win ? 1 : 0;
    if (i >= 10) rollingWins -= chronological[i - 10].participants.find((p) => p.puuid === puuid)!.win ? 1 : 0;
    if (cumulativeLp !== null && m.queueId === 420) {
      cumulativeLp = m.lpChange === null ? null : cumulativeLp + m.lpChange;
    }
    timeline.push({
      matchId: m.matchId,
      date: m.gameCreation,
      win: me.win,
      kda: Number(gameKda.toFixed(2)),
      csPerMin: Number((me.cs / min).toFixed(1)),
      damagePerMin: Math.round(me.damageToChampions / min),
      visionScore: me.visionScore,
      lpChange: m.lpChange,
      cumulativeLp,
      rollingWinRate: rollingWins / Math.min(i + 1, 10),
    });
  });

  // LP is only meaningful when every ranked game in the window has a measured change;
  // otherwise the chart falls back to net wins instead of showing a misleading "0 LP".
  const ranked = timeline.filter((_, i) => chronological[i].queueId === 420);
  if (!ranked.length || ranked.some((x) => x.lpChange === null)) for (const x of timeline) x.cumulativeLp = null;

  const n = games.length || 1;
  const csPerMin = minutes ? cs / minutes : 0;
  const visionPerMin = minutes ? vision / minutes : 0;
  const damagePerMin = minutes ? dmg / minutes : 0;
  const killParticipation = kpSum / n;
  const overallKda = kda(k, d, a);
  const mean = perGameScore.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(perGameScore.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const supportShare = (roleMap.get("UTILITY")?.games ?? 0) / n;

  return {
    games: games.length,
    wins,
    losses: games.length - wins,
    winRate: games.length ? wins / games.length : 0,
    kda: overallKda,
    avgKills: k / n,
    avgDeaths: d / n,
    avgAssists: a / n,
    csPerMin,
    visionPerMin,
    damagePerMin,
    killParticipation,
    roles: [...roleMap.entries()].map(([role, r]) => ({ role, games: r.games, winRate: r.wins / r.games })).sort((x, y) => y.games - x.games),
    champions: [...champMap.entries()]
      .map(([championId, c]) => ({
        championId,
        games: c.games,
        wins: c.wins,
        kda: kda(c.k, c.d, c.a),
        kills: c.k / c.games,
        deaths: c.d / c.games,
        assists: c.a / c.games,
        csPerMin: c.min ? c.cs / c.min : 0,
      }))
      .sort((x, y) => y.games - x.games),
    timeline,
    radar: games.length
      ? [
          { axis: "Fighting", value: Math.round(clamp((Math.min(overallKda, 6) / 6) * 60 + killParticipation * 45)) },
          { axis: "Farming", value: Math.round(clamp((csPerMin / (supportShare > 0.5 ? 2 : 9)) * 100)) },
          { axis: "Vision", value: Math.round(clamp((visionPerMin / (supportShare > 0.5 ? 3 : 1.6)) * 100)) },
          { axis: "Consistency", value: Math.round(clamp(100 - sd * 2.2)) },
          { axis: "Survival", value: Math.round(clamp(100 - (d / n) * 10)) },
          { axis: "Damage", value: Math.round(clamp((damagePerMin / 1100) * 100)) },
        ]
      : [],
    insights: computeInsights(games, puuid),
  };
}
