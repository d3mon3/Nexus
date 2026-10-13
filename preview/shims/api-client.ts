/* Preview-only API client: same surface as lib/api-client.ts, served from the demo dataset in-browser. */
import { resolveRegion } from "@/lib/regions";
import { FALLBACK_CHAMPIONS, FALLBACK_DDRAGON_VERSION, QUEUE_FILTERS, RUNES } from "@/lib/static-data";
import { parseRiotId } from "@/lib/regions";
import { demoChampionBuild, demoChampionStats, demoLeaderboard, demoLiveGame, demoMatchDetail, demoMatchSummaries, demoPatches, demoProfile, demoProPlayers } from "@/server/demo";
import { computePlayerStats } from "@/server/services/stats";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const now = () => new Date().toISOString();
const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 120));
const env = <T,>(data: T, note = "Demo mode — add RIOT_API_KEY to load real Riot data.") => wait({ data, source: "demo" as const, fetchedAt: now(), note });
const plat = (r: string) => resolveRegion(r)?.platform ?? "euw1";

export const api = {
  download: () =>
    wait({
      configured: true,
      release: { repo: "login/nexus", tag: "build-12", name: "NEXUS build 12", publishedAt: "2026-10-13T06:10:00Z", fileName: "NEXUS-Setup-0.1.0.exe", url: "#", size: 98_400_000, pageUrl: "#" },
    }),
  status: () => wait({ mode: "demo" as const, ddragonVersion: FALLBACK_DDRAGON_VERSION, database: false, aggregateDataset: null }),
  staticData: () => wait({ version: FALLBACK_DDRAGON_VERSION, champions: [...FALLBACK_CHAMPIONS].sort((a, b) => a.name.localeCompare(b.name)), runeIcons: Object.fromEntries(RUNES.map((r) => [r.id, r.icon])), source: "embedded" as const }),
  profile: (region: string, riotId: string) => {
    const id = parseRiotId(riotId);
    if (!id) return Promise.reject(new ApiError(400, "Riot ID must look like Name#TAG."));
    return env(demoProfile(id.gameName, id.tagLine, plat(region)));
  },
  matches: (p: { region: string; puuid: string; start: number; count: number; queue?: string; champion?: number | null; result?: string | null }) => {
    const f = QUEUE_FILTERS.find((x) => x.value === (p.queue ?? "all"))!;
    const { matches, total } = demoMatchSummaries(p.puuid, plat(p.region), { start: p.start, count: p.count, queueIds: f.ids, championId: p.champion ?? null, result: (p.result as "win" | "loss" | null) ?? null });
    return env({ matches, start: p.start, count: p.count, total, hasMore: p.start + p.count < total });
  },
  match: (_region: string, matchId: string) => env(demoMatchDetail(matchId)!),
  live: (_region: string, puuid: string) => env(demoLiveGame(puuid), "Demo mode. Live KDA, CS and items are what the desktop app reads from the local League client during your own game."),
  stats: (region: string, puuid: string, count = 20, queue = "all") => {
    const f = QUEUE_FILTERS.find((x) => x.value === queue)!;
    const { matches } = demoMatchSummaries(puuid, plat(region), { start: 0, count, queueIds: f.ids });
    return env(computePlayerStats(matches.map((m) => demoMatchDetail(m.matchId)!), puuid), `Computed from the last ${matches.length} matches.`);
  },
  championStats: (p: { patch?: string; role?: any; rank?: string; region?: string }) => {
    const patches = demoPatches(FALLBACK_DDRAGON_VERSION);
    const patch = p.patch && patches.includes(p.patch) ? p.patch : patches[0];
    return env({ patch, patches, rows: demoChampionStats({ patch, role: p.role ?? null, rank: p.rank, region: p.region }), sampleSize: null });
  },
  championBuild: (id: number, role?: any, patch?: string) => env(demoChampionBuild(id, role ?? null, patch ?? demoPatches(FALLBACK_DDRAGON_VERSION)[0])!),
  leaderboard: (p: { region: string; tier: string; page: number; pageSize: number; sort: string; q?: string }) => {
    let all = demoLeaderboard(plat(p.region)).filter((e) => p.tier === "all" || e.tier === p.tier.toUpperCase());
    if (p.sort === "winrate") all = [...all].sort((a, b) => b.wins / (b.wins + b.losses) - a.wins / (a.wins + a.losses));
    if (p.sort === "games") all = [...all].sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
    if (p.q) all = all.filter((e) => e.riotId.toLowerCase().includes(p.q!.toLowerCase()));
    const start = (p.page - 1) * p.pageSize;
    return env({ entries: all.slice(start, start + p.pageSize), page: p.page, pageSize: p.pageSize, total: all.length });
  },
  championDetail: async (key: string) => {
    const DD = "https://ddragon.leagueoflegends.com/cdn/" + FALLBACK_DDRAGON_VERSION;
    try {
      const res = await fetch(`${DD}/data/en_US/champion/${key}.json`);
      const c: any = Object.values((await res.json()).data)[0];
      return { key: c.id, name: c.name, title: c.title, lore: c.lore ?? "", tags: c.tags, passive: { name: c.passive.name, image: `${DD}/img/passive/${c.passive.image.full}` }, spells: c.spells.map((s: any, i: number) => ({ slot: "QWER"[i], name: s.name, image: `${DD}/img/spell/${s.image.full}` })) };
    } catch {
      return { key, name: key, title: "", lore: "", tags: [], passive: null, spells: [] };
    }
  },
  scout: async (region: string, p: any, depth: number) => {
    const { computeScout } = await import("@/server/services/scout-compute");
    const { decodeDemoPuuid } = await import("@/server/demo");
    const id = decodeDemoPuuid(p.puuid)!;
    const profile = demoProfile(id.gameName, id.tagLine, plat(region));
    const all = demoMatchSummaries(p.puuid, plat(region), { start: 0, count: 200 }).matches;
    const now = Date.now();
    const m = profile.mastery.find((x) => x.championId === p.championId);
    const name = (cid: number) => FALLBACK_CHAMPIONS.find((c) => c.id === cid)?.name ?? String(cid);
    const pro = demoProPlayers().find((x) => x.riotId?.toLowerCase() === p.riotId.toLowerCase());
    return env(
      computeScout(
        {
          puuid: p.puuid, riotId: p.riotId, teamId: p.teamId, championId: p.championId, championName: name(p.championId), spells: p.spells,
          keystone: p.perks?.keystone ?? null, subStyle: p.perks?.subStyle ?? null, summonerLevel: profile.account.summonerLevel, profileIconId: profile.account.profileIconId,
          ranked: profile.ranked.find((r) => r.queue === "RANKED_SOLO_5x5") ?? null, ladderRank: profile.ladder?.position ?? null,
          mastery: m ? { level: m.championLevel, points: m.championPoints } : null,
          matches: all.slice(0, depth).map((x) => demoMatchDetail(x.matchId)!),
          games12h: all.filter((x) => now - x.gameCreation <= 12 * 3600e3).length,
          games30d: all.filter((x) => now - x.gameCreation <= 30 * 86400e3).length,
          proTeam: pro?.team ?? null, now,
        },
        name,
      ),
    );
  },
  proPlayers: () => env(demoProPlayers(), "Fictional demo roster. Add data/pro-players.json to track real players."),
  refresh: async () => {},
};
