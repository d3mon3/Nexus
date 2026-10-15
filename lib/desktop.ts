"use client";

import { useEffect, useState } from "react";

/**
 * Bridge to the Electron shell (electron/preload.ts). In a normal browser `window.nexus`
 * is undefined and every hook returns an inert state.
 */

export type GameflowPhase = "None" | "Lobby" | "Matchmaking" | "ReadyCheck" | "ChampSelect" | "GameStart" | "InProgress" | "WaitingForStats" | "PreEndOfGame" | "EndOfGame" | string;

export interface ClientState {
  connected: boolean;
  phase: GameflowPhase;
  summoner: { gameName: string; tagLine: string; puuid: string; platform: string | null } | null;
}

export interface LiveClientSnapshot {
  gameTime: number;
  gameMode: string;
  activeRiotId: string;
  players: {
    riotId: string;
    /** Set by the desktop app when this entry is the local player. */
    isMe?: boolean;
    championName: string;
    team: "ORDER" | "CHAOS";
    level: number;
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    items: number[];
    spells: string[];
    /** "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" in matchmade games. */
    position?: string | null;
    keystone?: number | null;
  }[];
  activeGold: number | null;
  events: { name: string; time: number; team?: "ORDER" | "CHAOS" }[];
}

const normId = (v: string | null | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, "");

/**
 * The local player in a live-client snapshot, or null when it can't be identified
 * (never guesses another player — that showed someone else's 0/0/0 stats).
 */
export function findMe(snap: LiveClientSnapshot | null | undefined, account?: { gameName?: string; tagLine?: string } | null): LiveClientSnapshot["players"][number] | null {
  if (!snap?.players.length) return null;
  const flagged = snap.players.find((p) => p.isMe);
  if (flagged) return flagged;
  const keys = new Set([snap.activeRiotId, snap.activeRiotId.split("#")[0], account?.gameName && account.tagLine ? `${account.gameName}#${account.tagLine}` : "", account?.gameName ?? ""].map(normId).filter(Boolean));
  return snap.players.find((p) => keys.has(normId(p.riotId)) || keys.has(normId(p.riotId.split("#")[0]))) ?? null;
}

/** Champion select seen from the League client (desktop app only). */
export interface ChampSelectState {
  queueId: number | null;
  phase: string;
  myCellId: number;
  myBanTurn: boolean;
  myTeam: { cellId: number; championId: number; intentId: number; position: string }[];
  theirTeam: { cellId: number; championId: number; position: string }[];
  bans: number[];
}

export interface NexusBridge {
  platform: string;
  version: string;
  getClientState(): Promise<ClientState>;
  onClientState(cb: (s: ClientState) => void): () => void;
  onNavigate?(cb: (path: string) => void): () => void;
  getLiveClient(): Promise<LiveClientSnapshot | null>;
  setAutoDetect(enabled: boolean): Promise<void>;
  toggleOverlay(show: boolean): Promise<void>;
  spectate?(puuid: string): Promise<{ ok: boolean; error?: string }>;
  setPrefs?(prefs: { import?: unknown; scoutAutoShow?: boolean; widgetsEnabled?: boolean; autoAccept?: boolean; autoAcceptDelay?: number; discord?: boolean; champSelectAssist?: boolean; postGame?: boolean; language?: string; widgets?: unknown; minimizeInGame?: boolean; autoBorderless?: boolean; overlayScale?: number; openAtLogin?: boolean; closeToTray?: boolean; hotkeys?: { widgets: string; scout: string; edit: string } }): Promise<void>;
  importBuild?(championId: number, role: string | null, mode?: string, runeIndex?: number, variant?: string): Promise<{ ok: boolean; text: string }>;
  toggleScout?(show: boolean): Promise<void>;
  setOverlayEdit?(on: boolean): Promise<void>;
  onImport?(cb: (r: { text: string; runes: string; spells: string; items: string }) => void): () => void;
  onOverlayEdit?(cb: (on: boolean) => void): () => void;
  getChampSelect?(): Promise<ChampSelectState | null>;
  setWidgetSize?(w: number, h: number): Promise<void>;
  onWidgetMoved?(cb: (m: { id: string; x: number; y: number }) => void): () => void;
  /** The last finished game this app saw (for the post-game summary). */
  getLastGame?(): Promise<{ gameId: number | null; queueId: number | null; endedAt: number } | null>;
}

declare global {
  interface Window {
    nexus?: NexusBridge;
  }
}

export function getBridge(): NexusBridge | null {
  return typeof window !== "undefined" ? (window.nexus ?? null) : null;
}

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(Boolean(getBridge())), []);
  return desktop;
}

export function useClientState(): ClientState | null {
  const [state, setState] = useState<ClientState | null>(null);
  useEffect(() => {
    const bridge = getBridge();
    if (!bridge) return;
    bridge.getClientState().then(setState).catch(() => undefined);
    return bridge.onClientState(setState);
  }, []);
  return state;
}

/** Polls the local Live Client Data API while a game is running (desktop only). */
export function useLiveClient(enabled: boolean, intervalMs = 2000): LiveClientSnapshot | null {
  const [snap, setSnap] = useState<LiveClientSnapshot | null>(null);
  useEffect(() => {
    const bridge = getBridge();
    if (!bridge || !enabled) {
      setSnap(null);
      return;
    }
    let stop = false;
    const tick = async () => {
      const s = await bridge.getLiveClient().catch(() => null);
      if (!stop) setSnap(s);
    };
    tick();
    const t = setInterval(tick, intervalMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [enabled, intervalMs]);
  return snap;
}

/** Polls champ select while the client is in that phase (desktop app only). */
export function useChampSelect(active: boolean, intervalMs = 1500): ChampSelectState | null {
  const [state, setState] = useState<ChampSelectState | null>(null);
  useEffect(() => {
    const bridge = getBridge();
    if (!active || !bridge?.getChampSelect) {
      setState(null);
      return;
    }
    let alive = true;
    const tick = () => bridge.getChampSelect!().then((s) => alive && setState(s)).catch(() => undefined);
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active, intervalMs]);
  return state;
}
