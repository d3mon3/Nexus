import "server-only";
import type { BuildPath, ChampionBuild, ChampionStat, Envelope, Matchup, Role, RunePage } from "@/lib/types";
import { getDb } from "../db";
import { getItemKinds, getStaticBundle } from "../ddragon";
import { demoChampionBuild, demoChampionStats, demoPatches, gradeStats } from "../demo";
import { skillSequence } from "../demo/archetypes";
import { env } from "../env";
import { NON_SR_MODES, type GameModeId } from "@/lib/modes";
import { BOOT_IDS, bestWinRatePath, lateItems, popularPath, runePages } from "./build-select";

const now = () => new Date().toISOString();
const COLLECTING_NOTE = "Statistics are being collected from real ranked games. The first results appear after the server's first aggregation run (it starts automatically).";
const DEMO_NOTE = "Demo dataset — run `npm run aggregate` with a Riot API key and database to build real statistics.";

export interface ChampionStatsPayload {
  patch: string;
  patches: string[];
  rows: ChampionStat[];
  sampleSize: number | null;
}

/** Aggregated statistics stored by scripts/aggregate.ts, if any exist. */
async function latestRuns() {
  const db = await getDb();
  if (!db) return null;
  // Sum all runs per patch/platform/band (the aggregator now runs often, in small batches).
  const grouped = await db.aggregateRun
    .groupBy({ by: ["patch", "platform", "rankBand"], _sum: { matches: true, totalBans: true }, _max: { finishedAt: true } })
    .catch(() => []);
  const runs = grouped
    .map((g) => ({ patch: g.patch, platform: g.platform, rankBand: g.rankBand, matches: g._sum.matches ?? 0, totalBans: g._sum.totalBans ?? 0, finishedAt: g._max.finishedAt ?? new Date(0) }))
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
  return runs.length ? { db, runs } : null;
}

/** SR bands stored by the aggregator, lowest first (Master+ is one band). */
const SR_BANDS = ["iron", "bronze", "silver", "gold", "platinum", "emerald", "diamond", "master"];
/** "gold" in the rank filter means Gold and above. */
function bandsFrom(rank: string): string[] {
  const r = ["grandmaster", "challenger"].includes(rank) ? "master" : rank;
  const i = SR_BANDS.indexOf(r);
  return i < 0 ? [rank] : SR_BANDS.slice(i);
}
/** rankBand filter for a mode: SR uses rank bands, other modes store their id as the band. */
function bandFilter(mode: GameModeId, rank?: string | null) {
  if (mode !== "sr") return { rankBand: mode };
  return rank ? { rankBand: { in: bandsFrom(rank) } } : { rankBand: { notIn: NON_SR_MODES } };
}
const bandMatches = (band: string, mode: GameModeId, rank?: string | null) => (mode !== "sr" ? band === mode : rank ? bandsFrom(rank).includes(band) : !NON_SR_MODES.includes(band));
/** Build-variant rows are stored with role "TOP~ap"; they never count in champion stats. */
const BASE_ROLE = { role: { not: { contains: "~" } } };

export async function getChampionStats(opts: { patch?: string | null; role?: Role | null; rank?: string | null; region?: string | null; mode?: GameModeId | null }): Promise<Envelope<ChampionStatsPayload>> {
  const mode: GameModeId = opts.mode ?? "sr";
  const agg = await latestRuns();
  if (agg) {
    const modeRuns = agg.runs.filter((r) => bandMatches(r.rankBand, mode, null));
    const patches = [...new Set(modeRuns.map((r) => r.patch))];
    const patch = opts.patch && patches.includes(opts.patch) ? opts.patch : patches[0];
    const runs = modeRuns.filter((r) => r.patch === patch && (!opts.region || r.platform === opts.region) && bandMatches(r.rankBand, mode, opts.rank));
    const matches = runs.reduce((s, r) => s + r.matches, 0);
    if (matches > 0) {
      const rows = await agg.db.championAggregate.findMany({
        where: {
          patch,
          ...(opts.role && mode === "sr" ? { role: opts.role } : BASE_ROLE),
          ...(opts.region ? { platform: opts.region } : {}),
          ...bandFilter(mode, opts.rank),
        },
      });
      const merged = new Map<string, { championId: number; role: Role; games: number; wins: number; bans: number; k: number; d: number; a: number }>();
      for (const r of rows) {
        const key = `${r.championId}:${r.role}`;
        const m = merged.get(key) ?? { championId: r.championId, role: r.role as Role, games: 0, wins: 0, bans: 0, k: 0, d: 0, a: 0 };
        m.games += r.games;
        m.wins += r.wins;
        m.bans += r.bans;
        m.k += r.kills;
        m.d += r.deaths;
        m.a += r.assists;
        merged.set(key, m);
      }
      const stats: ChampionStat[] = [...merged.values()]
        .filter((m) => m.games >= Math.max(10, Math.round(matches * 0.005)))
        .map((m) => ({
          championId: m.championId,
          role: m.role,
          tier: "B",
          winRate: m.wins / m.games,
          pickRate: m.games / matches,
          banRate: m.bans / matches,
          games: m.games,
          kda: m.d ? (m.k + m.a) / m.d : m.k + m.a,
        }));
      return { data: { patch, patches, rows: gradeStats(stats), sampleSize: matches }, source: "aggregate", fetchedAt: now() };
    }
  }

  const { version } = await getStaticBundle();
  const patches = demoPatches(version);
  const patch = opts.patch && patches.includes(opts.patch) ? opts.patch : patches[0];
  if (env.demoDisabled || mode !== "sr") return { data: { patch, patches: [patch], rows: [], sampleSize: 0 }, source: "aggregate", fetchedAt: now(), note: COLLECTING_NOTE };
  return {
    data: { patch, patches, rows: demoChampionStats({ patch, role: opts.role, rank: opts.rank, region: opts.region }), sampleSize: null },
    source: "demo",
    fetchedAt: now(),
    note: DEMO_NOTE,
  };
}

type Counter = Record<string, { games: number; wins: number }>;
interface StoredBuilds {
  core?: Counter;
  starting?: Counter;
  boots?: Counter;
  items?: Counter;
  runes?: Counter;
  spells?: Counter;
  skills?: Counter;
  matchups?: Counter;
}

const top = (c: Counter | undefined, n: number) =>
  Object.entries(c ?? {})
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, n);

export async function getChampionBuild(championId: number, role: Role | null, patchValue?: string | null, modeValue?: GameModeId | null, variantValue?: string | null): Promise<Envelope<ChampionBuild | null>> {
  const mode: GameModeId = modeValue ?? "sr";
  const stats = await getChampionStats({ patch: patchValue, role: null, mode });
  if (stats.source === "aggregate" && stats.data.rows.length) {
    const db = (await getDb())!;
    // Rows "TOP" (all games) and "TOP~ap", "TOP~onhit" … (build variants).
    const find = (patch: string) => db.championAggregate.findMany({ where: { patch, championId, ...bandFilter(mode), ...(role && mode === "sr" ? { role: { startsWith: role } } : {}) } });
    let rows = await find(stats.data.patch);
    // Early in a new patch the sample is small: add the previous patch until there are enough games.
    let patchLabel = stats.data.patch;
    if (!patchValue && rows.filter((r) => !r.role.includes("~")).reduce((s, r) => s + r.games, 0) < 400) {
      const ordered = [...stats.data.patches].sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      const prev = ordered[ordered.indexOf(stats.data.patch) + 1];
      if (prev) {
        const older = await find(prev);
        if (older.length) {
          rows = [...rows, ...older];
          patchLabel = `${stats.data.patch} + ${prev}`;
        }
      }
    }
    const kinds = await getItemKinds().catch(() => ({}) as Record<number, string>);
    const known = Object.keys(kinds).length > 0;
    // Finished items only (no boots, components or starters) when Data Dragon is available.
    const keepCore = (id: number) => (known ? kinds[id] === "core" || kinds[id] === undefined : !BOOT_IDS.has(id));
    const baseRows = rows.filter((r) => !r.role.includes("~"));
    if (baseRows.length) {
      const mainRole = (role ?? [...baseRows].sort((a, b) => b.games - a.games)[0].role) as Role;
      const summary = stats.data.rows.find((r) => r.championId === championId && r.role === mainRole);
      const baseForRole = baseRows.filter((r) => r.role === mainRole);
      const baseGames = baseForRole.reduce((s, r) => s + r.games, 0);
      // Variants worth showing: at least 15 games and 5% of the champion's games in this role.
      const byVariant = new Map<string, { games: number; wins: number }>();
      for (const r of rows)
        if (r.role.startsWith(`${mainRole}~`)) {
          const id = r.role.split("~")[1];
          const v = byVariant.get(id) ?? { games: 0, wins: 0 };
          v.games += r.games;
          v.wins += r.wins;
          byVariant.set(id, v);
        }
      const variants = [...byVariant.entries()]
        .filter(([, v]) => v.games >= Math.max(15, baseGames * 0.05))
        .sort((a, b) => b[1].games - a[1].games)
        .map(([id, v]) => ({ id, games: v.games, winRate: v.wins / v.games }));
      const variant = variantValue && variants.some((v) => v.id === variantValue) ? variantValue : null;
      const forRole = variant ? rows.filter((r) => r.role === `${mainRole}~${variant}`) : baseForRole;
      const merged: StoredBuilds = {};
      for (const r of forRole) {
        const b = r.builds as StoredBuilds;
        for (const k of Object.keys(b) as (keyof StoredBuilds)[]) {
          const target = (merged[k] ??= {});
          for (const [key, v] of Object.entries(b[k] ?? {})) {
            target[key] ??= { games: 0, wins: 0 };
            target[key].games += v.games;
            target[key].wins += v.wins;
          }
        }
      }
      const roleGames = forRole.reduce((s, r) => s + r.games, 0);
      const games = variant || patchLabel !== stats.data.patch ? roleGames : (summary?.games ?? roleGames);
      const toPath = ([key, v]: [string, { games: number; wins: number }]): BuildPath => ({
        items: key.split("-").map(Number),
        games: v.games,
        winRate: v.wins / v.games,
        pickRate: v.games / games,
      });
      const coreLength = mode === "sr" ? 3 : 2;
      const popular = popularPath(merged.core, games, coreLength, keepCore);
      const highest = bestWinRatePath(merged.core, games, popular, keepCore);
      const late = lateItems(merged.core, popular.items, games, keepCore);
      const runes: RunePage[] = runePages(merged.runes, 3);
      const skill = top(merged.skills, 1)[0];
      const priority = (skill?.[0].split("-") ?? ["Q", "E", "W"]) as ("Q" | "W" | "E")[];
      const matchups: Matchup[] = top(merged.matchups, 60)
        .filter(([, v]) => v.games >= 8)
        .map(([id, v]) => ({ opponentId: Number(id), games: v.games, winRate: v.wins / v.games }));
      const build: ChampionBuild = {
        championId,
        mode,
        role: mainRole,
        patch: stats.data.patch,
        summary: (() => {
          const base = summary ?? { championId, role: mainRole, tier: "C" as const, winRate: 0, pickRate: 0, banRate: 0, games, kda: 0 };
          const v = variant ? variants.find((x) => x.id === variant) : null;
          return v ? { ...base, games: v.games, winRate: v.winRate } : base;
        })(),
        starting: top(merged.starting, 2).map(toPath),
        popular,
        highestWinRate: highest,
        boots: top(merged.boots, 3).map(toPath),
        situational: (late.length >= 4
          ? late
          : top(merged.items, 20)
              .map(([id, v]) => ({ itemId: Number(id), winRate: v.wins / v.games, pickRate: v.games / games }))
              .filter((x) => !popular.items.includes(x.itemId) && keepCore(x.itemId))
        ).slice(0, 12),
        runes,
        spells: top(merged.spells, 2).map(([key, v]) => ({ ids: key.split("-").map(Number) as [number, number], games: v.games, winRate: v.wins / v.games })),
        skillOrder: { priority, sequence: skillSequence(priority), winRate: skill ? skill[1].wins / skill[1].games : 0 },
        counters: [...matchups].sort((a, b) => a.winRate - b.winRate).slice(0, 5),
        favorable: [...matchups].sort((a, b) => b.winRate - a.winRate).slice(0, 5),
        variants: variants.length >= 2 || (variants.length === 1 && variants[0].games < baseGames * 0.85) ? variants : [],
        variant,
      };
      return { data: build, source: "aggregate", fetchedAt: now(), note: `${games.toLocaleString()} games on patch ${patchLabel}.` };
    }
  }
  if (env.demoDisabled || mode !== "sr") return { data: null, source: "aggregate", fetchedAt: now(), note: COLLECTING_NOTE };
  return {
    data: demoChampionBuild(championId, role, stats.data.patch),
    source: "demo",
    fetchedAt: now(),
    note: DEMO_NOTE,
  };
}

export interface CounterPick {
  championId: number;
  games: number;
  winRate: number;
}

/**
 * Champions in `role` and how they fare against `opponentId` in that lane (from aggregated
 * Summoner's Rift matches). Sorted best first; only pairs with enough games are listed.
 */
export async function getCounters(opponentId: number, role: Role, patchValue?: string | null): Promise<Envelope<{ patch: string; opponentId: number; role: Role; picks: CounterPick[] }>> {
  const stats = await getChampionStats({ patch: patchValue, role: null, mode: "sr" });
  const patch = stats.data.patch;
  const db = stats.source === "aggregate" ? await getDb() : null;
  if (!db || !stats.data.rows.length) return { data: { patch, opponentId, role, picks: [] }, source: "aggregate", fetchedAt: now(), note: COLLECTING_NOTE };
  const rows = await db.championAggregate.findMany({ where: { patch, role, ...bandFilter("sr") } });
  const merged = new Map<number, { games: number; wins: number }>();
  for (const r of rows) {
    const v = (r.builds as StoredBuilds).matchups?.[String(opponentId)];
    if (!v) continue;
    const e = merged.get(r.championId) ?? { games: 0, wins: 0 };
    e.games += v.games;
    e.wins += v.wins;
    merged.set(r.championId, e);
  }
  const minGames = 3;
  const picks = [...merged.entries()]
    .filter(([, v]) => v.games >= minGames)
    .map(([championId, v]) => ({ championId, games: v.games, winRate: v.wins / v.games }))
    .sort((a, b) => b.winRate - a.winRate || b.games - a.games);
  return { data: { patch, opponentId, role, picks }, source: "aggregate", fetchedAt: now(), note: picks.length ? `${picks.reduce((s, p) => s + p.games, 0)} lane games against this champion.` : "Not enough games against this champion yet." };
}
