import "server-only";
import type { BuildPath, ChampionBuild, ChampionStat, Envelope, Matchup, Role, RunePage } from "@/lib/types";
import { getDb } from "../db";
import { getStaticBundle } from "../ddragon";
import { demoChampionBuild, demoChampionStats, demoPatches, gradeStats } from "../demo";
import { skillSequence } from "../demo/archetypes";
import { env } from "../env";

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
  const runs = await db.aggregateRun.findMany({ orderBy: { finishedAt: "desc" }, take: 50 }).catch(() => []);
  return runs.length ? { db, runs } : null;
}

export async function getChampionStats(opts: { patch?: string | null; role?: Role | null; rank?: string | null; region?: string | null }): Promise<Envelope<ChampionStatsPayload>> {
  const agg = await latestRuns();
  if (agg) {
    const patches = [...new Set(agg.runs.map((r) => r.patch))];
    const patch = opts.patch && patches.includes(opts.patch) ? opts.patch : patches[0];
    const runs = agg.runs.filter((r) => r.patch === patch && (!opts.region || r.platform === opts.region) && (!opts.rank || r.rankBand === opts.rank));
    const matches = runs.reduce((s, r) => s + r.matches, 0);
    if (matches > 0) {
      const rows = await agg.db.championAggregate.findMany({
        where: {
          patch,
          ...(opts.role ? { role: opts.role } : {}),
          ...(opts.region ? { platform: opts.region } : {}),
          ...(opts.rank ? { rankBand: opts.rank } : {}),
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
        .filter((m) => m.games >= Math.max(5, Math.round(matches * 0.004)))
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
  if (env.demoDisabled) return { data: { patch, patches: [patch], rows: [], sampleSize: 0 }, source: "aggregate", fetchedAt: now(), note: COLLECTING_NOTE };
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

export async function getChampionBuild(championId: number, role: Role | null, patchValue?: string | null): Promise<Envelope<ChampionBuild | null>> {
  const stats = await getChampionStats({ patch: patchValue, role: null });
  if (stats.source === "aggregate") {
    const db = (await getDb())!;
    const rows = await db.championAggregate.findMany({ where: { patch: stats.data.patch, championId, ...(role ? { role } : {}) } });
    if (rows.length) {
      const mainRole = (role ?? rows.sort((a, b) => b.games - a.games)[0].role) as Role;
      const summary = stats.data.rows.find((r) => r.championId === championId && r.role === mainRole);
      const forRole = rows.filter((r) => r.role === mainRole);
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
      const games = summary?.games ?? forRole.reduce((s, r) => s + r.games, 0);
      const toPath = ([key, v]: [string, { games: number; wins: number }]): BuildPath => ({
        items: key.split("-").map(Number),
        games: v.games,
        winRate: v.wins / v.games,
        pickRate: v.games / games,
      });
      const corePaths = top(merged.core, 20).map(toPath);
      const qualified = corePaths.filter((p) => p.games >= Math.max(10, games * 0.02));
      const runes: RunePage[] = top(merged.runes, 3).map(([key, v]) => {
        const [styles, perks, shards] = key.split("|");
        const [primaryStyle, subStyle] = styles.split("-").map(Number);
        return { primaryStyle, subStyle, perks: perks.split("-").map(Number), shards: (shards ?? "").split("-").filter(Boolean).map(Number), games: v.games, winRate: v.wins / v.games };
      });
      const skill = top(merged.skills, 1)[0];
      const priority = (skill?.[0].split("-") ?? ["Q", "E", "W"]) as ("Q" | "W" | "E")[];
      const matchups: Matchup[] = top(merged.matchups, 60)
        .filter(([, v]) => v.games >= 8)
        .map(([id, v]) => ({ opponentId: Number(id), games: v.games, winRate: v.wins / v.games }));
      const build: ChampionBuild = {
        championId,
        role: mainRole,
        patch: stats.data.patch,
        summary: summary ?? { championId, role: mainRole, tier: "C", winRate: 0, pickRate: 0, banRate: 0, games, kda: 0 },
        starting: top(merged.starting, 2).map(toPath),
        popular: corePaths[0] ?? { items: [], games: 0, winRate: 0, pickRate: 0 },
        highestWinRate: [...qualified].sort((a, b) => b.winRate - a.winRate)[0] ?? corePaths[0] ?? { items: [], games: 0, winRate: 0, pickRate: 0 },
        boots: top(merged.boots, 3).map(toPath),
        situational: top(merged.items, 12).map(([id, v]) => ({ itemId: Number(id), winRate: v.wins / v.games, pickRate: v.games / games })),
        runes,
        spells: top(merged.spells, 2).map(([key, v]) => ({ ids: key.split("-").map(Number) as [number, number], games: v.games, winRate: v.wins / v.games })),
        skillOrder: { priority, sequence: skillSequence(priority), winRate: skill ? skill[1].wins / skill[1].games : 0 },
        counters: [...matchups].sort((a, b) => a.winRate - b.winRate).slice(0, 5),
        favorable: [...matchups].sort((a, b) => b.winRate - a.winRate).slice(0, 5),
      };
      return { data: build, source: "aggregate", fetchedAt: now(), note: `${games.toLocaleString()} games on patch ${stats.data.patch}.` };
    }
  }
  if (env.demoDisabled) return { data: null, source: "aggregate", fetchedAt: now(), note: COLLECTING_NOTE };
  return {
    data: demoChampionBuild(championId, role, stats.data.patch),
    source: "demo",
    fetchedAt: now(),
    note: DEMO_NOTE,
  };
}
