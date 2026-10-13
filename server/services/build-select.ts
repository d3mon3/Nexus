import type { BuildPath, RunePage } from "@/lib/types";

/**
 * Turns the raw counters stored by the aggregator into the build shown to players.
 *
 * The aggregator stores each player's whole item path ("boots-a-b-c-d-e") and whole rune
 * page as one key. With a few hundred games per champion almost every key is unique, so
 * "most common key" picked a random player's build. Here we decide step by step instead,
 * the way op.gg / Porofessor do: the most common first item, then the most common second
 * item among players who started with it, and so on; runes per slot within the most
 * common keystone.
 */

export type Counter = Record<string, { games: number; wins: number }>;
type Entry = { parts: number[]; games: number; wins: number };

export const BOOT_IDS = new Set([3006, 3009, 3020, 3047, 3111, 3158, 3117, 3005, 3010, 3013]);

const wr = (wins: number, games: number) => (games ? wins / games : 0);

function argmax<K>(m: Map<K, { games: number; wins: number }>): K | undefined {
  let best: K | undefined;
  let bestGames = -1;
  for (const [k, v] of m) if (v.games > bestGames) (best = k), (bestGames = v.games);
  return best;
}

function add<K>(m: Map<K, { games: number; wins: number }>, k: K, e: { games: number; wins: number }) {
  const cur = m.get(k) ?? { games: 0, wins: 0 };
  cur.games += e.games;
  cur.wins += e.wins;
  m.set(k, cur);
}

/** Item paths without boots (boots are shown separately). */
function corePaths(core: Counter | undefined): Entry[] {
  return Object.entries(core ?? {}).map(([key, v]) => ({
    parts: key.split("-").map(Number).filter((id) => id > 0 && !BOOT_IDS.has(id)),
    games: v.games,
    wins: v.wins,
  }));
}

/** Greedy most-common path of `length` items. */
export function popularPath(core: Counter | undefined, totalGames: number, length = 3): BuildPath {
  let pool = corePaths(core).filter((e) => e.parts.length >= Math.min(length, 2));
  const items: number[] = [];
  for (let i = 0; i < length; i++) {
    const counts = new Map<number, { games: number; wins: number }>();
    for (const e of pool) if (e.parts[i] && !items.includes(e.parts[i])) add(counts, e.parts[i], e);
    const next = argmax(counts);
    if (next === undefined) break;
    items.push(next);
    pool = pool.filter((e) => e.parts[i] === next);
  }
  const games = pool.reduce((s, e) => s + e.games, 0);
  const wins = pool.reduce((s, e) => s + e.wins, 0);
  return { items, games, winRate: wr(wins, games), pickRate: totalGames ? games / totalGames : 0 };
}

/** Exact first-N paths (order kept), most common first. */
export function pathOptions(core: Counter | undefined, totalGames: number, length = 3): BuildPath[] {
  const m = new Map<string, { games: number; wins: number }>();
  for (const e of corePaths(core)) if (e.parts.length >= length) add(m, e.parts.slice(0, length).join("-"), e);
  return [...m.entries()]
    .sort((a, b) => b[1].games - a[1].games)
    .map(([k, v]) => ({ items: k.split("-").map(Number), games: v.games, winRate: wr(v.wins, v.games), pickRate: totalGames ? v.games / totalGames : 0 }));
}

/** Highest win rate path among those played often enough, shrunk towards 50% for small samples. */
export function bestWinRatePath(core: Counter | undefined, totalGames: number, fallback: BuildPath): BuildPath {
  const min = Math.max(8, Math.round(totalGames * 0.03));
  const score = (p: BuildPath) => (p.winRate * p.games + 0.5 * 20) / (p.games + 20);
  const qualified = pathOptions(core, totalGames).filter((p) => p.games >= min);
  return qualified.sort((a, b) => score(b) - score(a))[0] ?? fallback;
}

/** Items players buy after the core (4th–6th), most common first. */
export function lateItems(core: Counter | undefined, exclude: number[], totalGames: number) {
  const m = new Map<number, { games: number; wins: number }>();
  for (const e of corePaths(core)) for (const id of e.parts.slice(3)) if (!exclude.includes(id)) add(m, id, e);
  return [...m.entries()]
    .sort((a, b) => b[1].games - a[1].games)
    .map(([itemId, v]) => ({ itemId, winRate: wr(v.wins, v.games), pickRate: totalGames ? v.games / totalGames : 0 }));
}

/* ------------------------------------------------------------------ runes */

interface ParsedPage {
  primaryStyle: number;
  subStyle: number;
  perks: number[];
  shards: string;
  games: number;
  wins: number;
}

function parsePages(runes: Counter | undefined): ParsedPage[] {
  const out: ParsedPage[] = [];
  for (const [key, v] of Object.entries(runes ?? {})) {
    const [styles, perks, shards] = key.split("|");
    const [primaryStyle, subStyle] = (styles ?? "").split("-").map(Number);
    const p = (perks ?? "").split("-").map(Number);
    if (!primaryStyle || !subStyle || p.length < 6) continue;
    out.push({ primaryStyle, subStyle, perks: p, shards: shards ?? "", games: v.games, wins: v.wins });
  }
  return out;
}

/**
 * Up to `count` rune pages, one per keystone (most played first). Within a keystone each
 * primary row takes its most common rune; the secondary tree + its two runes and the
 * shards are taken as the most common combination (they must stay a valid pair).
 */
export function runePages(runes: Counter | undefined, count = 3): RunePage[] {
  const pages = parsePages(runes);
  const byKeystone = new Map<string, { games: number; wins: number }>();
  for (const p of pages) add(byKeystone, `${p.primaryStyle}:${p.perks[0]}`, p);
  return [...byKeystone.entries()]
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, count)
    .map(([k, total]) => {
      const [style, keystone] = k.split(":").map(Number);
      const group = pages.filter((p) => p.primaryStyle === style && p.perks[0] === keystone);
      const primary = [keystone];
      for (let slot = 1; slot <= 3; slot++) {
        const m = new Map<number, { games: number; wins: number }>();
        for (const p of group) add(m, p.perks[slot], p);
        primary.push(argmax(m)!);
      }
      const sec = new Map<string, { games: number; wins: number }>();
      for (const p of group) add(sec, `${p.subStyle}:${[p.perks[4], p.perks[5]].sort((a, b) => a - b).join("-")}`, p);
      const [subStyle, pair] = argmax(sec)!.split(":");
      // keep the order the client expects (as most players picked it)
      const pairIds = pair.split("-").map(Number);
      const sample = group.find((p) => p.subStyle === Number(subStyle) && pairIds.includes(p.perks[4]) && pairIds.includes(p.perks[5]));
      const shardCounts = new Map<string, { games: number; wins: number }>();
      for (const p of group) if (p.shards) add(shardCounts, p.shards, p);
      const shards = (argmax(shardCounts) ?? "").split("-").filter(Boolean).map(Number);
      return {
        primaryStyle: style,
        subStyle: Number(subStyle),
        perks: [...primary, ...(sample ? [sample.perks[4], sample.perks[5]] : pairIds)],
        shards,
        games: total.games,
        winRate: wr(total.wins, total.games),
      };
    });
}
