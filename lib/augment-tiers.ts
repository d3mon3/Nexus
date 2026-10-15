import type { AugmentStat, TierGrade } from "./types";

const CUTS: [number, TierGrade][] = [
  [0.06, "S+"],
  [0.2, "S"],
  [0.45, "A"],
  [0.72, "B"],
  [0.9, "C"],
  [1, "D"],
];

/**
 * Augment tiers from a counter {augmentId: {games, wins}}. Win rates are shrunk toward the
 * baseline (champion or mode average) so a 3–0 augment doesn't top the list.
 */
export function augmentTiers(counter: Record<string, { games: number; wins: number }> | undefined, totalGames: number, minGames = 5): AugmentStat[] {
  const rows = Object.entries(counter ?? {})
    .map(([id, v]) => ({ id: Number(id), games: v.games, wins: v.wins }))
    .filter((r) => r.id > 0 && r.games >= minGames);
  if (!rows.length) return [];
  const base = rows.reduce((s, r) => s + r.wins, 0) / Math.max(1, rows.reduce((s, r) => s + r.games, 0));
  const scored = rows
    .map((r) => {
      const shrunk = (r.wins + base * 20) / (r.games + 20);
      return { r, score: shrunk + Math.min(0.02, (r.games / Math.max(1, totalGames)) * 0.05) };
    })
    .sort((a, b) => b.score - a.score);
  return scored.map(({ r }, i) => ({
    id: r.id,
    games: r.games,
    winRate: r.wins / r.games,
    pickRate: totalGames ? r.games / totalGames : 0,
    tier: CUTS.find(([cut]) => (i + 1) / scored.length <= cut)![1],
  }));
}
