/**
 * NEXUS desktop shell. Boots the bundled Next.js server (standalone output) on a free
 * loopback port, opens the app window and watches the League client:
 *  - champ select → auto-imports runes, summoner spells and an item set,
 *  - loading screen → shows the scouting board (Ctrl+Shift+S),
 *  - in game → transparent widget overlay (Ctrl+Shift+N, Ctrl+Shift+E to move widgets).
 */
import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Notification, screen, shell } from "electron";
import { fork, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { DEFAULT_IMPORT_PREFS, type ImportPrefs } from "../lib/client-import";
import { normalizeServerUrl } from "../server/admin-utils";
import type { Role } from "../lib/types";
import { ChampSelectWatcher, importBuild, type ImportResult } from "./importer";
import { DiscordPresence } from "./discord";
import { ForegroundWatcher, isGameProcess } from "./foreground";
import { acceptReadyCheck, findConnection, getLiveClientSnapshot, lcuPost, lcuRequest, readChampSelect, readClientState, readGameflowSession, type GameflowInfo, type LcuConnection } from "./lcu";
import { modeForQueue, modeInfo, isGameModeId, type GameModeId } from "../lib/modes";
import { queueName } from "../lib/static-data";

const isDev = process.argv.includes("--dev");
const DEV_URL = process.env.NEXUS_DEV_URL ?? "http://localhost:3210";

let mainWindow: BrowserWindow | null = null;
let scoutWin: BrowserWindow | null = null;
let editMode = false;
let server: ChildProcess | null = null;
let baseUrl = DEV_URL;
let autoDetect = true;

interface DesktopPrefs {
  import: ImportPrefs & { enabled: boolean; onHover: boolean };
  scoutAutoShow: boolean;
  widgetsEnabled: boolean;
  autoAccept: boolean;
  /** Seconds to wait before accepting (gives you time to decline). */
  autoAcceptDelay: number;
  discord: boolean;
  champSelectAssist: boolean;
  postGame: boolean;
  language: "pl" | "en";
  /** Widget layout from Settings (enabled + screen-fraction position). */
  widgets: Record<string, { enabled: boolean; x: number; y: number }>;
  /** Minimise the NEXUS window while a game is running (saves CPU/GPU for League). */
  minimizeInGame: boolean;
  /** Switch League from exclusive Fullscreen to Borderless before the game, so widgets are visible. */
  autoBorderless: boolean;
}
let prefs: DesktopPrefs = {
  import: { ...DEFAULT_IMPORT_PREFS, enabled: true, onHover: false },
  scoutAutoShow: true,
  widgetsEnabled: true,
  autoAccept: false,
  autoAcceptDelay: 2,
  discord: true,
  champSelectAssist: true,
  postGame: true,
  language: "pl",
  widgets: { build: { enabled: true, x: 0.012, y: 0.2 }, stats: { enabled: true, x: 0.012, y: 0.42 } },
  minimizeInGame: true,
  autoBorderless: true,
};
const watcher = new ChampSelectWatcher();

type ClientState = { connected: boolean; phase: string; summoner: { gameName: string; tagLine: string; puuid: string; platform: string | null } | null };
let clientState: ClientState = { connected: false, phase: "None", summoner: null };

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const port = (s.address() as net.AddressInfo).port;
      s.close(() => resolve(port));
    });
    s.on("error", reject);
  });
}

function loadEnvFile(dir: string): Record<string, string> {
  // Lets packaged users keep RIOT_API_KEY in %APPDATA%/NEXUS/.env (never inside the renderer).
  const file = path.join(dir, ".env");
  if (!fs.existsSync(file)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

declare const __NEXUS_SERVER_URL__: string;
declare const __NEXUS_BUILD_TAG__: string;
declare const __NEXUS_DISCORD_CLIENT_ID__: string;
const BUILD_TAG = typeof __NEXUS_BUILD_TAG__ === "string" ? __NEXUS_BUILD_TAG__ : "";

/**
 * Updates. In remote mode the window shows pages from the server, so most updates arrive
 * without reinstalling. When a new installer is published (new client features), the app
 * offers to download it from the NEXUS server and runs it.
 */
let updatePrompted = false;
async function checkForUpdate(manual = false) {
  if (isDev || !BUILD_TAG || !baseUrl.startsWith("https://") || (updatePrompted && !manual)) return;
  try {
    const info = (await fetch(`${baseUrl}/api/download`).then((r) => r.json())) as { release?: { tag: string; name: string } | null };
    const latest = info.release;
    if (!latest || latest.tag === BUILD_TAG) return;
    updatePrompted = true;
    const pl = prefs.language === "pl";
    const { response } = await dialog.showMessageBox({
      type: "info",
      title: pl ? "Aktualizacja NEXUS" : "NEXUS update",
      message: pl ? `Dostępna jest nowa wersja NEXUS (${latest.name}).` : `A new version of NEXUS is available (${latest.name}).`,
      detail: pl ? "Pobrać i zainstalować teraz? NEXUS zamknie się na czas instalacji." : "Download and install it now? NEXUS will close while the installer runs.",
      buttons: pl ? ["Aktualizuj teraz", "Później"] : ["Update now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response !== 0) return;
    const file = path.join(app.getPath("temp"), `NEXUS-Setup-${latest.tag.replace(/[^\w.-]/g, "_")}.exe`);
    const res = await fetch(`${baseUrl}/api/download/latest`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    spawn(file, [], { detached: true, stdio: "ignore" }).unref();
    app.quit();
  } catch (err) {
    console.error("[nexus] update check failed", err);
    if (manual) dialog.showMessageBox({ type: "error", title: "NEXUS", message: prefs.language === "pl" ? "Nie udało się pobrać aktualizacji. Spróbuj później albo pobierz ją ze strony." : "Couldn't download the update. Try again later or get it from the Download page." });
  }
}

/**
 * Remote mode: the .exe shared with friends talks to one NEXUS server (which holds the Riot key).
 * The address is baked in at build time (NEXUS_SERVER_URL) and can be overridden with
 * NEXUS_SERVER_URL=... in %APPDATA%/NEXUS/.env. Without an address the app runs its own local server.
 */
function remoteServerUrl(): string | null {
  const raw = (loadEnvFile(app.getPath("userData")).NEXUS_SERVER_URL || process.env.NEXUS_SERVER_URL || (typeof __NEXUS_SERVER_URL__ === "string" ? __NEXUS_SERVER_URL__ : "")).trim();
  if (!raw) return null;
  const url = normalizeServerUrl(raw);
  if (!url) console.error(`[nexus] ignoring invalid NEXUS_SERVER_URL "${raw}" (use https://…)`);
  return url;
}

function offlinePage(url: string, detail: string) {
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const html = `<!doctype html><meta charset="utf-8"><title>NEXUS</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#070A13;color:#e8e9f3;font:15px system-ui,sans-serif">
<div style="max-width:440px;text-align:center;padding:24px">
<div style="font:700 28px system-ui;letter-spacing:.12em;color:#a183ff">NEXUS</div>
<p>Can't reach the NEXUS server.</p>
<p style="color:#8b8fa8;font-size:13px">${esc(url)}<br>${esc(detail)}</p>
<a href="${esc(url)}" style="display:inline-block;margin-top:12px;padding:10px 18px;border-radius:10px;background:#7c4dff;color:#fff;text-decoration:none;font-weight:600">Try again</a>
</div></body>`;
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function startServer(): Promise<string> {
  if (isDev) return DEV_URL;
  const remote = remoteServerUrl();
  if (remote) return remote;
  const port = await freePort();
  const appDir = path.join(process.resourcesPath, "app");
  server = fork(path.join(appDir, "server.js"), [], {
    cwd: appDir,
    env: { ...process.env, ...loadEnvFile(app.getPath("userData")), PORT: String(port), HOSTNAME: "127.0.0.1", NODE_ENV: "production" },
    stdio: "inherit",
  });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    const ok = await fetch(`${url}/api/status`).then((r) => r.ok).catch(() => false);
    if (ok) return url;
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error("NEXUS server did not start");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1536,
    height: 1000,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#070A13",
    title: "NEXUS",
    show: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.loadURL(baseUrl);
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 && url.startsWith(baseUrl)) mainWindow?.loadURL(offlinePage(baseUrl, desc || `error ${code}`));
  });
  // The preload bridge is only meant for NEXUS pages: never navigate the window elsewhere.
  mainWindow.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith(baseUrl)) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });
  // External links open in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(baseUrl)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => (mainWindow = null));
}

const overlayWebPrefs = () => ({ preload: path.join(__dirname, "preload.js"), contextIsolation: true, sandbox: true });

/** Full-screen, transparent, click-through window that hosts the in-game widgets. */
/* In-game widgets ----------------------------------------------------------
 * One small transparent window per widget (instead of one full-screen layer), so Windows
 * only composites a few hundred pixels over the game. Positions are screen fractions. */
const widgetWins = new Map<string, BrowserWindow>();
let overlayDisplay: Electron.Display | null = null;

function overlayShown() {
  return widgetWins.size > 0;
}

function placeWidget(win: BrowserWindow, id: string) {
  const d = overlayDisplay ?? screen.getPrimaryDisplay();
  const cfg = prefs.widgets[id] ?? { x: 0.02, y: 0.2 };
  win.setPosition(Math.round(d.bounds.x + cfg.x * d.bounds.width), Math.round(d.bounds.y + cfg.y * d.bounds.height));
}

function toggleOverlay(show = !overlayShown()) {
  if (!show) {
    for (const w of widgetWins.values()) w.close();
    widgetWins.clear();
    editMode = false;
    return;
  }
  // The game is usually on the screen the mouse is on when it starts.
  overlayDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const ids = Object.entries(prefs.widgets).filter(([, w]) => w.enabled).map(([id]) => id);
  for (const id of ids) {
    if (widgetWins.has(id)) continue;
    const win = new BrowserWindow({
      width: 300,
      height: 160,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      show: false,
      backgroundColor: "#00000000",
      webPreferences: { ...overlayWebPrefs(), backgroundThrottling: false },
    });
    win.setAlwaysOnTop(true, "screen-saver");
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    win.setIgnoreMouseEvents(true);
    placeWidget(win, id);
    win.loadURL(`${baseUrl}/overlay?widget=${encodeURIComponent(id)}`);
    win.once("ready-to-show", () => {
      if (editMode || !foreground.current || isGameProcess(foreground.current)) win.showInactive();
    });
    win.on("moved", () => {
      const d = overlayDisplay ?? screen.getPrimaryDisplay();
      const [x, y] = win.getPosition();
      const fx = Math.min(0.98, Math.max(0, (x - d.bounds.x) / d.bounds.width));
      const fy = Math.min(0.97, Math.max(0, (y - d.bounds.y) / d.bounds.height));
      prefs.widgets[id] = { ...(prefs.widgets[id] ?? { enabled: true }), x: fx, y: fy };
      win.webContents.send("nexus:widget-moved", { id, x: fx, y: fy });
    });
    win.on("closed", () => widgetWins.delete(id));
    widgetWins.set(id, win);
  }
  for (const [id, w] of widgetWins) if (!ids.includes(id)) w.close();
}

/* Show widgets (and the scouting board) only while the game is the app in front — not over
 * Discord, the browser or the desktop when you alt-tab. Edit mode keeps them visible. */
function applyForeground(name: string) {
  if (!overlayShown() && !scoutWin) return;
  // "" = Windows is between windows (alt-tab, lock screen) — keep the current state.
  if (!name && !editMode) return;
  // Widgets only over the game itself; alt-tab to Discord / desktop / browser hides them.
  const visible = editMode || isGameProcess(name);
  for (const w of [...widgetWins.values(), ...(scoutWin ? [scoutWin] : [])]) {
    if (visible && !w.isVisible()) w.showInactive();
    else if (!visible && w.isVisible()) w.hide();
  }
}
const foreground = new ForegroundWatcher(applyForeground);

/** Edit mode makes the widget windows draggable (Ctrl+Shift+E). */
function setEditMode(on: boolean) {
  if (on && !overlayShown()) toggleOverlay(true);
  editMode = on;
  for (const w of widgetWins.values()) {
    w.setIgnoreMouseEvents(!on);
    w.setFocusable(on);
    w.webContents.send("nexus:overlay-edit", on);
  }
}

/** Porofessor-style scouting board, centred on screen. */
function toggleScout(show = !scoutWin) {
  if (!show) {
    scoutWin?.close();
    scoutWin = null;
    return;
  }
  if (scoutWin) return;
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1500, workArea.width - 40);
  const height = Math.min(760, workArea.height - 40);
  scoutWin = new BrowserWindow({
    width,
    height,
    x: workArea.x + Math.round((workArea.width - width) / 2),
    y: workArea.y + Math.round((workArea.height - height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: overlayWebPrefs(),
  });
  scoutWin.setAlwaysOnTop(true, "screen-saver");
  scoutWin.setIgnoreMouseEvents(true, { forward: true });
  scoutWin.loadURL(`${baseUrl}/overlay/scout`);
  scoutWin.on("closed", () => (scoutWin = null));
}

function broadcast(state: ClientState) {
  for (const w of [mainWindow, scoutWin, ...widgetWins.values()]) w?.webContents.send("nexus:client-state", state);
}

let championNames: Map<number, string> | null = null;
async function championName(id: number): Promise<string> {
  if (!championNames) {
    const res = await fetch(`${baseUrl}/api/static`).then((r) => r.json() as Promise<{ champions: { id: number; name: string }[] }>);
    championNames = new Map(res.champions.map((c) => [c.id, c.name]));
  }
  return championNames.get(id) ?? `Champion ${id}`;
}

function describeImport(r: ImportResult, name: string): string {
  const parts = [r.runes === "ok" && "runes", r.spells === "ok" && "summoner spells", r.items === "ok" && "item set"].filter(Boolean);
  const failed = [r.runes === "failed" && "runes", r.spells === "failed" && "spells", r.items === "failed" && "items"].filter(Boolean);
  if (!parts.length) return `Couldn't import the ${name} build${r.message ? `: ${r.message}` : "."}`;
  return `${name}: imported ${parts.join(", ")}${failed.length ? ` (failed: ${failed.join(", ")})` : ""}.`;
}

async function runImport(championId: number, role: Role | null, manual: boolean, mode: GameModeId = "sr"): Promise<ImportResult> {
  if (!conn) throw new Error("League client is not running.");
  const name = await championName(championId);
  const result = await importBuild(conn, baseUrl, championId, mode === "sr" ? role : null, name, prefs.import, mode);
  const text = describeImport(result, mode === "sr" ? name : `${name} (${modeInfo(mode).label})`);
  mainWindow?.webContents.send("nexus:import", { ...result, text });
  if (!manual) new Notification({ title: "NEXUS", body: text, silent: true }).show();
  return result;
}

/* Discord Rich Presence ---------------------------------------------------- */
const DISCORD_ID = typeof __NEXUS_DISCORD_CLIENT_ID__ === "string" ? __NEXUS_DISCORD_CLIENT_ID__ : "";
const discord = new DiscordPresence(DISCORD_ID);
const DISCORD_TEXT = {
  pl: { lobby: "W lobby", queue: "Szuka meczu", select: "Wybór bohatera", inGame: "W grze", get: "Pobierz NEXUS" },
  en: { lobby: "In lobby", queue: "In queue", select: "Champion select", inGame: "In game", get: "Get NEXUS" },
};
let championIds: Map<string, number> | null = null;
async function championIdByName(name: string): Promise<number | null> {
  if (!championIds) {
    const res = await fetch(`${baseUrl}/api/static`).then((r) => r.json() as Promise<{ champions: { id: number; name: string }[] }>);
    championIds = new Map(res.champions.map((c) => [c.name.toLowerCase(), c.id]));
  }
  return championIds.get(name.toLowerCase()) ?? null;
}
const championIconUrl = (id: number) => `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

async function updatePresence(phase: string) {
  if (!discord.enabled) return;
  if (!prefs.discord || !clientState.connected) return discord.update(null);
  const tx = DISCORD_TEXT[prefs.language] ?? DISCORD_TEXT.en;
  const queue = flow.queueId != null ? queueName(flow.queueId) : "";
  const buttons = baseUrl.startsWith("https://") ? [{ label: tx.get, url: `${baseUrl}/download` }] : undefined;
  const base = { largeImageUrl: "https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Yasuo_0.jpg", largeText: "NEXUS", buttons };
  switch (phase) {
    case "Lobby":
      return discord.update({ ...base, details: tx.lobby, state: queue || undefined });
    case "Matchmaking":
    case "ReadyCheck":
      return discord.update({ ...base, details: tx.queue, state: queue || undefined, startTimestamp: phaseSince });
    case "ChampSelect":
      return discord.update({ ...base, details: tx.select, state: queue || undefined, startTimestamp: phaseSince });
    case "GameStart":
    case "InProgress": {
      const live = await getLiveClientSnapshot();
      const me = live?.players.find((p) => p.isMe) ?? null;
      const champId = me ? await championIdByName(me.championName).catch(() => null) : null;
      const k = me ? `${me.kills}/${me.deaths}/${me.assists}` : "";
      return discord.update({
        ...base,
        details: me ? `${me.championName} · ${queue || live?.gameMode || ""}` : tx.inGame,
        state: me ? `${tx.inGame} · ${k}` : queue || undefined,
        startTimestamp: live ? Date.now() - Math.round(live.gameTime * 1000) : phaseSince,
        largeImageUrl: champId ? championIconUrl(champId) : base.largeImageUrl,
        largeText: me?.championName ?? "NEXUS",
      });
    }
    default:
      return discord.update(null);
  }
}

let conn: LcuConnection | null = null;
let scoutShownAt = 0;
let flow: GameflowInfo = { queueId: null, gameId: null, gameMode: null };
let phaseSince = Date.now();
let readyCheckAt = 0;
let lastGame: { gameId: number | null; queueId: number | null; endedAt: number } | null = null;
let lastPresenceAt = 0;
const IN_GAME = new Set(["GameStart", "InProgress", "WaitingForStats", "PreEndOfGame"]);

/** Ask the server to snapshot this player's rank now (before and after games → exact LP per game). */
async function snapshotRank() {
  const s = clientState.summoner;
  if (!s?.puuid || !s.platform || !s.gameName) return;
  await fetch(`${baseUrl}/api/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ puuid: s.puuid, platform: s.platform }) }).catch(() => undefined);
  await fetch(`${baseUrl}/api/player?region=${encodeURIComponent(s.platform)}&riotId=${encodeURIComponent(`${s.gameName}#${s.tagLine}`)}`).catch(() => undefined);
}

/** Exclusive fullscreen hides every overlay; Borderless looks the same and keeps widgets visible. */
async function ensureBorderless() {
  if (!conn || !prefs.autoBorderless || !(prefs.widgetsEnabled || prefs.scoutAutoShow)) return;
  const cur = await lcuRequest<{ General?: { WindowMode?: number } }>(conn, "GET", "/lol-game-settings/v1/game-settings").catch(() => null);
  if (cur?.body?.General?.WindowMode !== 0) return; // 0 = Fullscreen, 1 = Windowed, 2 = Borderless
  const r = await lcuRequest(conn, "PATCH", "/lol-game-settings/v1/game-settings", { General: { WindowMode: 2 } }).catch(() => null);
  if (r && r.status < 300)
    new Notification({
      title: "NEXUS",
      body: prefs.language === "pl" ? "Przełączyłem LoL na tryb Bez ramki, żeby widgety były widoczne w grze (wygląda jak pełny ekran)." : "Switched League to Borderless so widgets show in game (it looks like fullscreen).",
      silent: true,
    }).show();
}

function showMain(path: string) {
  if (!mainWindow) createWindow();
  mainWindow?.webContents.send("nexus:navigate", path);
  if (mainWindow?.isMinimized()) mainWindow.restore();
  mainWindow?.showInactive();
}

async function pollClient() {
  if (!autoDetect) return;
  try {
    conn = conn ?? (await findConnection());
    const next: ClientState = conn ? await readClientState(conn) : { connected: false, phase: "None", summoner: null };
    const prevPhase = clientState.phase;
    clientState = next;
    broadcast(next);
    if (next.phase !== prevPhase) phaseSince = Date.now();

    // Queue / mode of the current lobby or game.
    if (conn && next.phase !== prevPhase && ["Lobby", "Matchmaking", "ChampSelect", "GameStart", "InProgress"].includes(next.phase)) {
      flow = await readGameflowSession(conn).catch(() => flow);
    }
    const mode = modeForQueue(flow.queueId, flow.gameMode);

    // Ready check → accept after the chosen delay (unless the player already answered).
    if (next.phase === "ReadyCheck" && conn && prefs.autoAccept) {
      readyCheckAt ||= Date.now();
      if (Date.now() - readyCheckAt >= prefs.autoAcceptDelay * 1000) await acceptReadyCheck(conn).catch(() => false);
    } else readyCheckAt = 0;

    // Champ select → show the assistant page, auto import once per champion/role.
    if (next.phase === "ChampSelect" && prevPhase !== "ChampSelect") {
      if (prefs.champSelectAssist) showMain("/live?view=champ-select");
      void snapshotRank();
      void ensureBorderless().catch(() => undefined);
    }
    if (next.phase === "ChampSelect" && conn && prefs.import.enabled) {
      const pick = await watcher.lockedChampion(conn, prefs.import.onHover).catch(() => null);
      if (pick && watcher.shouldImport(pick.championId, mode === "sr" ? pick.role : null)) runImport(pick.championId, pick.role, false, mode).catch(() => undefined);
    }
    if (next.phase !== "ChampSelect" && prevPhase === "ChampSelect") watcher.reset();

    // Game start → scouting board on the loading screen, widgets once in game.
    if (next.phase === "InProgress" && prevPhase !== "InProgress") {
      mainWindow?.webContents.send("nexus:navigate", "/live");
      if (prefs.minimizeInGame && mainWindow && !mainWindow.isFocused()) mainWindow.minimize();
      foreground.start();
      if (prefs.scoutAutoShow) {
        toggleScout(true);
        scoutShownAt = Date.now();
      }
      if (prefs.widgetsEnabled) toggleOverlay(true);
    }
    // Hide the auto-shown board once the game has actually started (loading finished).
    if (scoutWin && scoutShownAt && next.phase === "InProgress") {
      const live = await getLiveClientSnapshot();
      if (live && live.gameTime > 15) {
        toggleScout(false);
        scoutShownAt = 0;
      }
    }
    if (next.phase !== "InProgress" && prevPhase === "InProgress") {
      toggleOverlay(false);
      toggleScout(false);
      foreground.stop();
    }

    // Game over → post-game summary.
    if (IN_GAME.has(prevPhase) && (next.phase === "EndOfGame" || (!IN_GAME.has(next.phase) && prevPhase === "InProgress"))) {
      if (!lastGame || lastGame.gameId !== flow.gameId || flow.gameId == null) {
        lastGame = { gameId: flow.gameId, queueId: flow.queueId, endedAt: Date.now() };
        // Riot updates LP a little after the game; snapshot twice to catch it.
        setTimeout(() => void snapshotRank(), 45_000);
        setTimeout(() => void snapshotRank(), 150_000);
        if (prefs.postGame) {
          showMain("/post-game");
          new Notification({ title: "NEXUS", body: prefs.language === "pl" ? "Podsumowanie meczu jest gotowe." : "Your game summary is ready.", silent: true }).show();
        }
      }
    }

    if (next.phase !== prevPhase || Date.now() - lastPresenceAt > 15_000) {
      lastPresenceAt = Date.now();
      void updatePresence(next.phase).catch(() => undefined);
    }
  } catch {
    conn = null; // client closed or restarted — the lockfile password changes
    if (clientState.connected) {
      clientState = { connected: false, phase: "None", summoner: null };
      broadcast(clientState);
      discord.update(null);
    }
  }
}

ipcMain.handle("nexus:get-client-state", () => clientState);
// Several widget windows ask for the same data; share one request per second.
let liveCache: { at: number; value: Promise<Awaited<ReturnType<typeof getLiveClientSnapshot>>> } | null = null;
ipcMain.handle("nexus:get-live-client", () => {
  if (!liveCache || Date.now() - liveCache.at > 1000) liveCache = { at: Date.now(), value: getLiveClientSnapshot() };
  return liveCache.value;
});
ipcMain.handle("nexus:set-auto-detect", (_e, enabled: boolean) => {
  autoDetect = Boolean(enabled);
});
ipcMain.handle("nexus:set-prefs", (_e, next: Partial<DesktopPrefs>) => {
  const discordWas = prefs.discord;
  prefs = { ...prefs, ...next, import: { ...prefs.import, ...(next?.import ?? {}) } };
  prefs.autoAcceptDelay = Math.min(10, Math.max(0, Number(prefs.autoAcceptDelay) || 0));
  if (!prefs.widgetsEnabled) toggleOverlay(false);
  else if (overlayShown()) toggleOverlay(true); // add/remove widgets switched in Settings
  if (discordWas !== prefs.discord) void updatePresence(clientState.phase).catch(() => undefined);
});
ipcMain.handle("nexus:get-champ-select", async () => {
  if (!conn || clientState.phase !== "ChampSelect") return null;
  return readChampSelect(conn, flow.queueId).catch(() => null);
});
ipcMain.handle("nexus:get-last-game", () => lastGame);
ipcMain.handle("nexus:import-build", async (_e, championId: number, role: Role | null, modeArg?: string) => {
  try {
    conn = conn ?? (await findConnection());
    const r = await runImport(Number(championId), role ?? null, true, isGameModeId(modeArg) ? modeArg : "sr");
    return { ok: r.runes === "ok" || r.spells === "ok" || r.items === "ok", text: describeImport(r, await championName(Number(championId))) };
  } catch (err) {
    return { ok: false, text: err instanceof Error ? err.message : String(err) };
  }
});
// Asks the League client to open the spectator for a player in an active game.
ipcMain.handle("nexus:spectate", async (_e, puuid: string) => {
  try {
    conn = conn ?? (await findConnection());
    if (!conn) return { ok: false, error: "League client is not running." };
    const status = await lcuPost(conn, "/lol-spectator/v1/spectate/launch", { allowObserveMode: "ALL", dropInSpectateGameId: "", gameQueueType: "", puuid });
    return status < 300 ? { ok: true } : { ok: false, error: `The client refused to spectate (HTTP ${status}).` };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});
ipcMain.handle("nexus:toggle-overlay", (_e, show: boolean) => toggleOverlay(Boolean(show)));
ipcMain.handle("nexus:toggle-scout", (_e, show: boolean) => toggleScout(Boolean(show)));
ipcMain.handle("nexus:set-overlay-edit", (_e, on: boolean) => setEditMode(Boolean(on)));
// A widget page reports its rendered size so its window fits it exactly.
ipcMain.handle("nexus:widget-size", (e, w: number, h: number) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || ![...widgetWins.values()].includes(win)) return;
  win.setContentSize(Math.min(520, Math.max(120, Math.ceil(w))), Math.min(520, Math.max(40, Math.ceil(h))));
});

app.whenReady().then(async () => {
  try {
    baseUrl = await startServer();
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow();
  setTimeout(() => void checkForUpdate(), 8000);
  setInterval(() => void checkForUpdate(), 6 * 3600e3);
  // Overlays only draw over League in Borderless / Windowed display mode.
  globalShortcut.register("CommandOrControl+Shift+N", () => toggleOverlay());
  globalShortcut.register("CommandOrControl+Shift+E", () => setEditMode(!editMode));
  globalShortcut.register("CommandOrControl+Shift+S", () => {
    scoutShownAt = 0; // manual toggle: don't auto-hide
    toggleScout();
  });
  setInterval(pollClient, 2000);
  pollClient();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  discord.close();
  foreground.stop();
  server?.kill();
});
