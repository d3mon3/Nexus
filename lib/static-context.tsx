"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { api, type StaticBundle } from "./api-client";
import { setDDragonVersion } from "./assets";
import { FALLBACK_CHAMPIONS, FALLBACK_DDRAGON_VERSION, RUNES } from "./static-data";
import type { ChampionInfo } from "./types";

interface StaticApi {
  version: string;
  champions: ChampionInfo[];
  byId: Map<number, ChampionInfo>;
  byKey: Map<string, ChampionInfo>;
  runeIcon: (id: number) => string | undefined;
  champion: (id: number) => ChampionInfo | undefined;
  findChampion: (query: string) => ChampionInfo | undefined;
}

const fallback: StaticBundle = {
  version: FALLBACK_DDRAGON_VERSION,
  champions: [...FALLBACK_CHAMPIONS].sort((a, b) => a.name.localeCompare(b.name)),
  runeIcons: Object.fromEntries(RUNES.map((r) => [r.id, r.icon])),
  source: "embedded",
};

const StaticContext = createContext<StaticApi | null>(null);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Champion list + Data Dragon version, available synchronously everywhere (embedded fallback first). */
export function StaticDataProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({ queryKey: ["static"], queryFn: api.staticData, staleTime: Infinity, retry: 1 });
  const bundle = data ?? fallback;
  setDDragonVersion(bundle.version);

  const value = useMemo<StaticApi>(() => {
    const byId = new Map(bundle.champions.map((c) => [c.id, c]));
    const byKey = new Map(bundle.champions.map((c) => [c.key.toLowerCase(), c]));
    const byNorm = new Map(bundle.champions.map((c) => [norm(c.name), c]));
    return {
      version: bundle.version,
      champions: bundle.champions,
      byId,
      byKey,
      champion: (id) => byId.get(id),
      runeIcon: (id) => bundle.runeIcons[id],
      findChampion: (q) => byKey.get(q.toLowerCase()) ?? byNorm.get(norm(q)) ?? (/^\d+$/.test(q) ? byId.get(Number(q)) : undefined),
    };
  }, [bundle]);

  return <StaticContext.Provider value={value}>{children}</StaticContext.Provider>;
}

export function useStatic(): StaticApi {
  const ctx = useContext(StaticContext);
  if (!ctx) throw new Error("useStatic must be used inside <StaticDataProvider>");
  return ctx;
}
