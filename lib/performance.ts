import type { ParticipantSummary } from "./types";

/**
 * Post-game rating for all ten players (0–10), relative to the others in the same game:
 * KDA, kill participation, damage share, gold, vision and farm (supports are judged on
 * vision instead of farm, tanks also get credit for damage taken). MVP = best on the
 * winning team, ACE = best on the losing team.
 */
export interface PlayerRating {
  puuid: string;
  score: number;
  grade: "S+" | "S" | "A" | "B" | "C" | "D";
  badge: "MVP" | "ACE" | null;
  rank: number;
}

const gradeOf = (s: number): PlayerRating["grade"] => (s >= 8.5 ? "S+" : s >= 7.5 ? "S" : s >= 6.5 ? "A" : s >= 5.5 ? "B" : s >= 4.5 ? "C" : "D");

export function ratePlayers(players: ParticipantSummary[], durationSec: number): PlayerRating[] {
  if (!players.length) return [];
  const min = Math.max(1, durationSec / 60);
  const teamKills = new Map<number, number>();
  const teamDamage = new Map<number, number>();
  const teamTaken = new Map<number, number>();
  for (const p of players) {
    teamKills.set(p.teamId, (teamKills.get(p.teamId) ?? 0) + p.kills);
    teamDamage.set(p.teamId, (teamDamage.get(p.teamId) ?? 0) + p.damageToChampions);
    teamTaken.set(p.teamId, (teamTaken.get(p.teamId) ?? 0) + p.damageTaken);
  }
  const raw = players.map((p) => ({
    p,
    kda: (p.kills + p.assists) / Math.max(1, p.deaths),
    kp: (p.kills + p.assists) / Math.max(1, teamKills.get(p.teamId) ?? 0),
    dmg: p.damageToChampions / Math.max(1, teamDamage.get(p.teamId) ?? 0),
    taken: p.damageTaken / Math.max(1, teamTaken.get(p.teamId) ?? 0),
    gold: p.gold / min,
    vision: p.visionScore / min,
    cs: p.cs / min,
  }));
  const max = (f: (r: (typeof raw)[number]) => number) => Math.max(1e-9, ...raw.map(f));
  const mx = { kda: max((r) => r.kda), kp: max((r) => r.kp), dmg: max((r) => r.dmg), taken: max((r) => r.taken), gold: max((r) => r.gold), vision: max((r) => r.vision), cs: max((r) => r.cs) };

  const scored = raw.map((r) => {
    const support = r.p.role === "UTILITY";
    const parts =
      0.26 * Math.min(1, r.kda / mx.kda) +
      0.2 * Math.min(1, r.kp / mx.kp) +
      0.18 * (r.dmg / mx.dmg) +
      0.08 * (r.taken / mx.taken) +
      0.12 * (r.gold / mx.gold) +
      (support ? 0.16 * (r.vision / mx.vision) : 0.08 * (r.vision / mx.vision) + 0.08 * (r.cs / mx.cs));
    const score = Math.min(10, Math.max(0, parts * 10 + (r.p.win ? 0.6 : 0)));
    return { puuid: r.p.puuid, score: Math.round(score * 10) / 10, win: r.p.win };
  });

  const ordered = [...scored].sort((a, b) => b.score - a.score);
  const mvp = ordered.find((s) => s.win)?.puuid;
  const ace = ordered.find((s) => !s.win)?.puuid;
  return scored.map((s) => ({
    puuid: s.puuid,
    score: s.score,
    grade: gradeOf(s.score),
    badge: s.puuid === mvp ? "MVP" : s.puuid === ace ? "ACE" : null,
    rank: ordered.findIndex((o) => o.puuid === s.puuid) + 1,
  }));
}
