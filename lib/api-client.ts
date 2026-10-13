import type {
  DesktopReleaseInfo,
  AppStatus,
  ChampionBuild,
  ChampionInfo,
  ChampionStat,
  Envelope,
  LeaderboardEntry,
  LiveGame,
  LiveParticipant,
  MatchDetail,
  MatchSummary,
  PlayerProfile,
  PlayerStats,
  ProPlayer,
  Role,
  ScoutPlayer,
} from "./types";

/**
 * Typed browser client for NEXUS API routes. The browser only ever talks to our own
 * server — the Riot API key never reaches it.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function getJson<T>(path: string, params: Record<string, string | number | null | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
  const url = qs.size ? `${path}?${qs}` : path;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string }).error ?? `Request failed (${res.status})`);
  return body as T;
}

export interface StaticBundle {
  version: string;
  champions: ChampionInfo[];
  runeIcons: Record<number, string>;
  source: "ddragon" | "embedded";
}

export interface MatchPage {
  matches: MatchSummary[];
  start: number;
  count: number;
  total: number | null;
  hasMore: boolean;
}

export interface ChampionStatsPayload {
  patch: string;
  patches: string[];
  rows: ChampionStat[];
  sampleSize: number | null;
}

export interface LeaderboardPage {
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ChampionDetail {
  key: string;
  name: string;
  title: string;
  lore: string;
  tags: string[];
  passive: { name: string; image: string } | null;
  spells: { slot: "Q" | "W" | "E" | "R"; name: string; image: string }[];
}

export const api = {
  status: () => getJson<AppStatus>("/api/status"),
  download: () => getJson<DesktopReleaseInfo>("/api/download"),
  staticData: () => getJson<StaticBundle>("/api/static"),
  profile: (region: string, riotId: string) => getJson<Envelope<PlayerProfile>>("/api/player", { region, riotId }),
  matches: (p: { region: string; puuid: string; start: number; count: number; queue?: string; champion?: number | null; result?: string | null }) =>
    getJson<Envelope<MatchPage>>("/api/player/matches", p),
  match: (region: string, matchId: string, puuid?: string) => getJson<Envelope<MatchDetail>>(`/api/match/${encodeURIComponent(matchId)}`, { region, puuid }),
  live: (region: string, puuid: string) => getJson<Envelope<LiveGame | null>>("/api/player/live", { region, puuid }),
  stats: (region: string, puuid: string, count = 20, queue = "all") => getJson<Envelope<PlayerStats>>("/api/player/stats", { region, puuid, count, queue }),
  championStats: (p: { patch?: string; role?: Role | null; rank?: string; region?: string; mode?: string }) => getJson<Envelope<ChampionStatsPayload>>("/api/champions", p),
  championBuild: (id: number, role?: Role | null, patch?: string, mode?: string) => getJson<Envelope<ChampionBuild | null>>(`/api/champions/${id}`, { role, patch, mode: mode && mode !== "sr" ? mode : undefined }),
  leaderboard: (p: { region: string; tier: string; page: number; pageSize: number; sort: string; q?: string }) => getJson<Envelope<LeaderboardPage>>("/api/leaderboard", p),
  championDetail: (key: string) => getJson<ChampionDetail>(`/api/static/champion/${encodeURIComponent(key)}`),
  scout: (region: string, p: LiveParticipant, depth: number) =>
    getJson<Envelope<ScoutPlayer>>("/api/scout", {
      region,
      puuid: p.puuid,
      riotId: p.riotId,
      team: p.teamId,
      champion: p.championId,
      spell1: p.spells[0],
      spell2: p.spells[1],
      keystone: p.perks?.keystone,
      sub: p.perks?.subStyle,
      depth,
    }),
  proPlayers: () => getJson<Envelope<ProPlayer[]>>("/api/pro-players"),
  refresh: async (puuid: string, platform: string) => {
    const res = await fetch("/api/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ puuid, platform }) });
    if (!res.ok) throw new ApiError(res.status, "Refresh failed");
  },
};

export type Api = typeof api;
