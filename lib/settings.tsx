"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { getBridge } from "./desktop";
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
  /** Desktop: accept the ready check automatically after `autoAcceptDelay` seconds. */
  autoAccept: boolean;
  autoAcceptDelay: number;
  /** Desktop: open the champ-select assistant (counters, bans) when champ select starts. */
  champSelectAssist: boolean;
  /** Desktop: open the post-game summary when a game ends. */
  postGameSummary: boolean;
  /** Desktop: show what you're playing on Discord. */
  discordPresence: boolean;
  /** Desktop: minimise the NEXUS window during games to leave CPU/GPU to League. */
  minimizeInGame: boolean;
  /** Desktop: switch League from exclusive Fullscreen to Borderless so widgets are visible. */
  autoBorderless: boolean;
  /** Desktop: start with Windows (hidden in the tray). */
  startWithWindows: boolean;
  /** Desktop: closing the window keeps NEXUS running in the tray. */
  closeToTray: boolean;
  /** Desktop hotkeys: Alt + letter. */
  hotkeys: { widgets: string; scout: string; edit: string };
  /** Riot ID of the account last seen in the League client (to notice account switches). */
  lastClientAccount: string | null;
  /** Data Dragon patch the user last saw (for the "new patch" notification). */
  lastSeenPatch: string | null;
  /** Mirror notifications as Windows notifications while NEXUS isn't in front. */
  systemNotifications: boolean;
  /** When these settings were last changed (ms). */
  savedAt?: number;
}

export type WidgetId = "build" | "stats" | "timers" | "lane" | "enemySpells" | "enemyItems" | "augments";

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
  augments: { name: "Augment tiers", description: "Arena and ARAM Chaos: the best augments for your champion, so you can pick fast when the choice appears." },
  enemyItems: { name: "Situational items & enemy alerts", description: "Anti-heal, magic resist, armor and penetration for this enemy team — for AD, ADC, AP or tank — plus warnings when enemies buy Zhonya's, spell shields or cleanse." },
};

const KEY = "nexus.settings.v1";

export const DEFAULT_SETTINGS: Settings = {
  region: "euw1",
  myAccount: null,
  favorites: [],
  recent: [],
  favoriteChampions: [],
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
    enemyItems: { enabled: true, x: 0.83, y: 0.5 },
    augments: { enabled: true, x: 0.012, y: 0.62 },
  },
  overlayOpacity: 0.92,
  overlayScale: 1,
  autoAccept: false,
  autoAcceptDelay: 2,
  champSelectAssist: true,
  postGameSummary: true,
  discordPresence: true,
  minimizeInGame: true,
  autoBorderless: true,
  startWithWindows: true,
  closeToTray: true,
  hotkeys: { widgets: "X", scout: "Z", edit: "V" },
  lastClientAccount: null,
  lastSeenPatch: null,
  systemNotifications: true,
};

let cache: Settings | null = null;
const listeners = new Set<() => void>();

function merge(saved: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    importPrefs: { ...DEFAULT_SETTINGS.importPrefs, ...(saved.importPrefs ?? {}) },
    widgets: { ...DEFAULT_SETTINGS.widgets, ...(saved.widgets ?? {}) },
    hotkeys: { ...DEFAULT_SETTINGS.hotkeys, ...(saved.hotkeys ?? {}) },
  };
}

function read(): Settings {
  if (cache) return cache;
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = merge(raw ? (JSON.parse(raw) as Partial<Settings>) : {});
  } catch {
    cache = DEFAULT_SETTINGS;
  }
  return cache;
}

/** Overlay windows (widgets, scouting board) only read settings; the main window owns them. */
const isOverlayWindow = () => typeof window !== "undefined" && window.location.pathname.startsWith("/overlay");

function write(next: Settings, toDisk = true) {
  const stamped = { ...next, savedAt: Date.now() };
  cache = stamped;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(stamped));
  } catch {
    /* storage may be unavailable (private mode) — settings stay in memory */
  }
  // Desktop: also keep a copy in %APPDATA%/NEXUS so nothing resets between launches.
  if (toDisk && !isOverlayWindow()) getBridge()?.saveSettings?.(stamped)?.catch(() => undefined);
  listeners.forEach((l) => l());
}

/** Desktop: on start, take the copy saved by the app if it is newer than the browser storage. */
function hydrateFromDisk() {
  const bridge = getBridge();
  if (!bridge?.loadSettings || isOverlayWindow()) return;
  bridge
    .loadSettings()
    .then((disk) => {
      if (!disk) {
        bridge.saveSettings?.(read()).catch(() => undefined); // first run: create the file
        return;
      }
      const diskAt = Number((disk as { savedAt?: number }).savedAt ?? 0);
      if (diskAt > (read().savedAt ?? 0)) write(merge(disk as Partial<Settings>), false);
    })
    .catch(() => undefined);
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
  useEffect(hydrateFromDisk, []);

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
