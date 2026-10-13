"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "./api-client";
import type { PlayerRef } from "./settings";
import type { LiveParticipant, Role } from "./types";

/** TanStack Query hooks — one place that defines cache keys and stale times. */

export const qk = {
  status: ["status"] as const,
  static: ["static"] as const,
  profile: (region: string, riotId: string) => ["profile", region, riotId.toLowerCase()] as const,
  matches: (puuid: string, rest: object) => ["matches", puuid, rest] as const,
  match: (id: string) => ["match", id] as const,
  live: (puuid: string) => ["live", puuid] as const,
  stats: (puuid: string, count: number, queue: string) => ["stats", puuid, count, queue] as const,
  championStats: (p: object) => ["championStats", p] as const,
  build: (id: number, role: string | null | undefined, patch: string | undefined, mode = "sr") => ["build", id, role ?? "auto", patch ?? "latest", mode] as const,
  leaderboard: (p: object) => ["leaderboard", p] as const,
  pros: ["pros"] as const,
};

export const useStatus = () => useQuery({ queryKey: qk.status, queryFn: api.status, staleTime: 60_000 });
export const useDesktopRelease = () => useQuery({ queryKey: ["download"], queryFn: api.download, staleTime: 5 * 60_000 });

export const riotIdOf = (p: Pick<PlayerRef, "gameName" | "tagLine">) => `${p.gameName}#${p.tagLine}`;

export function useProfile(player: PlayerRef | null | undefined) {
  return useQuery({
    queryKey: qk.profile(player?.platform ?? "", player ? riotIdOf(player) : ""),
    queryFn: () => api.profile(player!.platform, riotIdOf(player!)),
    enabled: Boolean(player),
    staleTime: 60_000,
    retry: (count, err) => count < 1 && !(err instanceof Error && /not found|invalid|must look/i.test(err.message)),
  });
}

export function useMatches(region: string | undefined, puuid: string | undefined, opts: { start: number; count: number; queue?: string; champion?: number | null; result?: string | null }) {
  return useQuery({
    queryKey: qk.matches(puuid ?? "", { region, ...opts }),
    queryFn: () => api.matches({ region: region!, puuid: puuid!, ...opts }),
    enabled: Boolean(region && puuid),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useMatch(region: string, matchId: string | null, puuid?: string) {
  return useQuery({
    queryKey: qk.match(matchId ?? ""),
    queryFn: () => api.match(region, matchId!, puuid),
    enabled: Boolean(matchId),
    staleTime: Infinity,
  });
}

export function useLiveGame(region: string | undefined, puuid: string | undefined, refreshSec = 30) {
  return useQuery({
    queryKey: qk.live(puuid ?? ""),
    queryFn: () => api.live(region!, puuid!),
    enabled: Boolean(region && puuid),
    refetchInterval: refreshSec > 0 ? refreshSec * 1000 : false,
    staleTime: 15_000,
  });
}

export function usePlayerStats(region: string | undefined, puuid: string | undefined, count = 20, queue = "all") {
  return useQuery({
    queryKey: qk.stats(puuid ?? "", count, queue),
    queryFn: () => api.stats(region!, puuid!, count, queue),
    enabled: Boolean(region && puuid),
    staleTime: 120_000,
    placeholderData: keepPreviousData,
  });
}

export function useChampionStats(p: { patch?: string; role?: Role | null; rank?: string; region?: string; mode?: string }) {
  return useQuery({
    queryKey: qk.championStats(p),
    queryFn: () => api.championStats(p),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useChampionBuild(id: number | null | undefined, role?: Role | null, patch?: string, mode: string = "sr") {
  return useQuery({
    queryKey: qk.build(id ?? 0, role, patch, mode),
    queryFn: () => api.championBuild(id!, role, patch, mode),
    enabled: Boolean(id),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useLeaderboard(p: { region: string; tier: string; page: number; pageSize: number; sort: string; q?: string }) {
  return useQuery({ queryKey: qk.leaderboard(p), queryFn: () => api.leaderboard(p), staleTime: 5 * 60_000, placeholderData: keepPreviousData });
}

export const useProPlayers = () => useQuery({ queryKey: qk.pros, queryFn: api.proPlayers, staleTime: 10 * 60_000 });

export function useChampionDetail(key: string | undefined) {
  return useQuery({ queryKey: ["championDetail", key], queryFn: () => api.championDetail(key!), enabled: Boolean(key), staleTime: Infinity });
}

export function useScoutPlayer(region: string, p: LiveParticipant, depth: number) {
  return useQuery({
    queryKey: ["scout", region, p.puuid, p.championId, depth],
    queryFn: () => api.scout(region, p, depth),
    enabled: Boolean(p.puuid),
    staleTime: 10 * 60_000,
    retry: 1,
  });
}
