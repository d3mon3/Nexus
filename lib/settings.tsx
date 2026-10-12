"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_IMPORT_PREFS, type ImportPrefs } from "./client-import";
import type { Platform } from "./regions";

/**
 * Client settings persisted to localStorage (works in the browser and in the Electron
 * window). Uses useSyncExternalStore so every component stays in sync, including
 * across tabs via the `storage` event.
 */

export interface PlayerRef {
  gameName: string;
  tagLine: string;
  platform: Platform;
}

export interface Settings {
  region: Platform;
  myAccount: PlayerRef | null;
  favorites: PlayerRef[];
  recent: (PlayerRef & { viewedAt: number })[];
  favoriteChampions: number[];
  matchesPerPage: number;
  reduceMotion: boolean;
  liveRefreshSec: number;
  autoDetectClient: boolean;
  motto: string;
  compactMatches: boolean;
  /** Matches analysed per player on the scouting board. */
  scoutDepth: number;
  /** Desktop: show the scouting board automatically on the loading screen. */
  scoutAutoShow: boolean;
  importPrefs: ImportPrefs & { enabled: boolean; onHover: boolean };
  widgets: Record<WidgetId, WidgetConfig>;
  overlayOpacity: number;
  overlayScale: number;
}

export type WidgetId = "build" | "stats" | "timers" | "lane" | "enemySpells";

export interface WidgetConfig {
  enabled: boolean;
  /** Position as a fraction of the screen (0–1) so it survives resolution changes. */
  x: number;
  y: number;
}

export const WIDGET_META: Record<WidgetId, { name: string; description: string }> = {
  build: { name: "Build & next item", description: "Recommended build for your champion; the next item to buy is highlighted." },
  stats: { name: "My stats", description: "KDA, CS, CS per minute, gold and level." },
  timers: { name: "Objective timers", description: "Dragon, Rift Herald and Baron respawns from the game's event feed." },
  lane: { name: "Lane opponent", description: "CS and level difference against the enemy in your role." },
  enemySpells: { name: "Enemy summoners", description: "Enemy champions with their summoner spells and levels." },
};

const KEY = "nexus.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  region: "euw1",
  myAccount: null,
  favorites: [
    { gameName: "Kaizen", tagLine: "PRO", platform: "euw1" },
    { gameName: "Ravenna", tagLine: "PRO", platform: "euw1" },
  ],
  recent: [],
  favoriteChampions: [157, 238, 266, 245],
  matchesPerPage: 10,
  reduceMotion: false,
  liveRefreshSec: 30,
  autoDetectClient: true,
  motto: "Same game, different mindset.",
  compactMatches: false,
  scoutDepth: 10,
  scoutAutoShow: true,
  importPrefs: { ...DEFAULT_IMPORT_PREFS, enabled: true, onHover: false },
  widgets: {
    build: { enabled: true, x: 0.012, y: 0.2 },
    stats: { enabled: true, x: 0.012, y: 0.42 },
    timers: { enabled: false, x: 0.83, y: 0.08 },
    lane: { enabled: false, x: 0.83, y: 0.22 },
    enemySpells: { enabled: false, x: 0.83, y: 0.34 },
  },
  overlayOpacity: 0.92,
  overlayScale: 1,
};

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function read(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    const saved = raw ? (JSON.parse(raw) as Partial<Settings>) : {};
    cache = {
      ...DEFAULT_SETTINGS,
      ...saved,
      importPrefs: { ...DEFAULT_SETTINGS.importPrefs, ...(saved.importPrefs ?? {}) },
      widgets: { ...DEFAULT_SETTINGS.widgets, ...(saved.widgets ?? {}) },
    };
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

function write(next: Settings) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage may be unavailable (private mode) — settings stay in memory */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings> | ((s: Settings) => Partial<Settings>)) => void;
  reset: () => void;
  isFavorite: (p: PlayerRef) => boolean;
  toggleFavorite: (p: PlayerRef) => void;
  pushRecent: (p: PlayerRef) => void;
  toggleFavoriteChampion: (id: number) => void;
  updateWidget: (id: WidgetId, patch: Partial<WidgetConfig>) => void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

const same = (a: PlayerRef, b: PlayerRef) =>
  a.gameName.toLowerCase() === b.gameName.toLowerCase() && a.tagLine.toLowerCase() === b.tagLine.toLowerCase() && a.platform === b.platform;

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);

  const update = useCallback<SettingsApi["update"]>((patch) => {
    const current = read();
    write({ ...current, ...(typeof patch === "function" ? patch(current) : patch) });
  }, []);

  const api = useMemo<SettingsApi>(
    () => ({
      settings,
      update,
      reset: () => write(DEFAULT_SETTINGS),
      isFavorite: (p) => settings.favorites.some((f) => same(f, p)),
      toggleFavorite: (p) =>
        update((s) => ({
          favorites: s.favorites.some((f) => same(f, p)) ? s.favorites.filter((f) => !same(f, p)) : [{ gameName: p.gameName, tagLine: p.tagLine, platform: p.platform }, ...s.favorites].slice(0, 24),
        })),
      pushRecent: (p) =>
        update((s) => ({
          recent: [{ gameName: p.gameName, tagLine: p.tagLine, platform: p.platform, viewedAt: Date.now() }, ...s.recent.filter((r) => !same(r, p))].slice(0, 12),
        })),
      updateWidget: (id, patch) => update((s) => ({ widgets: { ...s.widgets, [id]: { ...s.widgets[id], ...patch } } })),
      toggleFavoriteChampion: (id) =>
        update((s) => ({
          favoriteChampions: s.favoriteChampions.includes(id) ? s.favoriteChampions.filter((c) => c !== id) : [...s.favoriteChampions, id],
        })),
    }),
    [settings, update],
  );

  return <SettingsContext.Provider value={api}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside <SettingsProvider>");
  return ctx;
}
