/**
 * NEXUS desktop shell. Boots the bundled Next.js server (standalone output) on a free
 * loopback port, opens the app window and watches the League client:
 *  - champ select → auto-imports runes, summoner spells and an item set,
 *  - loading screen → shows the scouting board (Alt+Z by default),
 *  - in game → transparent widget overlay (Alt+X, Alt+V to move widgets and the board).
 */
import { app, BrowserWindow, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from "electron";
import { fork, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { DEFAULT_IMPORT_PREFS, type ImportPrefs } from "../lib/client-import";
import { normalizeServerUrl } from "../server/admin-utils";
import type { Role } from "../lib/types";
import { ChampSelectWatcher, importBuild, type ImportResult } from "./importer";
import { DiscordPresence } from "./discord";
import { ForegroundWatcher, isClientProcess, isGameProcess } from "./foreground";
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
  /** Start NEXUS (hidden, in the tray) when Windows starts. */
  openAtLogin: boolean;
  /** The window's X button hides NEXUS to the tray instead of quitting. */
  closeToTray: boolean;
  /** Alt + letter hotkeys. */
  hotkeys: { widgets: string; scout: string; edit: string };
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
  openAtLogin: true,
  closeToTray: true,
  hotkeys: { widgets: "X", scout: "Z", edit: "V" },
};

/* Tray, start with Windows, single instance ---------------------------------- */
let tray: Tray | null = null;
let quitting = false;
const startHidden = process.argv.includes("--hidden");

function iconPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "icon.png") : path.join(__dirname, "..", "build", "icon.png");
}

function openMain() {
  if (!mainWindow) createWindow(true);
  else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function applyLoginItem() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: prefs.openAtLogin, args: ["--hidden"] });
}

function buildTrayMenu() {
  if (!tray) return;
  const pl = prefs.language === "pl";
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: pl ? "Otwórz NEXUS" : "Open NEXUS", click: openMain },
      { label: `${pl ? "Pokaż / ukryj widgety" : "Show / hide widgets"} (Alt+${prefs.hotkeys.widgets})`, click: () => toggleOverlay() },
      { label: `${pl ? "Tabela graczy" : "Scouting board"} (Alt+${prefs.hotkeys.scout})`, click: () => runHotkey("scout") },
      { label: `${pl ? "Przesuń widgety i tabelę" : "Move widgets and board"} (Alt+${prefs.hotkeys.edit})`, click: () => runHotkey("edit") },
      { label: pl ? "Ustawienia" : "Settings", click: () => (showMain("/settings"), openMain()) },
      ...(update.state === "available" ? [{ label: pl ? `Zaktualizuj do ${update.name}` : `Update to ${update.name}`, click: () => void installUpdate() }] : []),
      { type: "separator" },
      { label: pl ? "Zamknij NEXUS" : "Quit NEXUS", click: () => ((quitting = true), app.quit()) },
    ]),
  );
}

function createTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(iconPath());
  tray = new Tray(img.isEmpty() ? img : img.resize({ width: 16, height: 16 }));
  tray.setToolTip("NEXUS");
  tray.on("click", openMain);
  buildTrayMenu();
}

if (!app.requestSingleInstanceLock()) app.quit();
else app.on("second-instance", () => openMain());
app.on("before-quit", () => (quitting = true));
const watcher = new ChampSelectWatcher();

/* Settings survive restarts in %APPDATA%/NEXUS: desktop prefs (used before the window has
 * loaded, e.g. auto-accept right after Windows starts) and the full settings of the UI. */
const prefsFile = () => path.join(app.getPath("userData"), "prefs.json");
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");
function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}
function writeJson(file: string, value: unknown) {
  try {
    fs.writeFileSync(file, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
function loadSavedPrefs() {
  const saved = readJson<Partial<DesktopPrefs>>(prefsFile());
  if (saved) prefs = { ...prefs, ...saved, import: { ...prefs.import, ...(saved.import ?? {}) }, hotkeys: { ...prefs.hotkeys, ...(saved.hotkeys ?? {}) } };
}

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
/* In-app updates: the topbar shows "Update", the installer downloads inside the app with a
 * progress bar and installs silently, then NEXUS restarts by itself. */
type UpdateState =
  | { state: "none" }
  | { state: "available"; tag: string; name: string }
  | { state: "downloading"; tag: string; name: string; progress: number }
  | { state: "installing"; tag: string; name: string }
  | { state: "error"; tag: string; name: string; message: string };
let update: UpdateState = { state: "none" };

function setUpdate(next: UpdateState) {
  update = next;
  mainWindow?.webContents.send("nexus:update", update);
  buildTrayMenu();
}

async function checkForUpdate() {
  if (isDev || !BUILD_TAG || !baseUrl.startsWith("https://") || update.state === "downloading" || update.state === "installing") return;
  try {
    const info = (await fetch(`${baseUrl}/api/download`).then((r) => r.json())) as { release?: { tag: string; name: string } | null };
    const latest = info.release;
    if (!latest || latest.tag === BUILD_TAG) return;
    if (update.state === "none" || update.tag !== latest.tag) setUpdate({ state: "available", tag: latest.tag, name: latest.name });
  } catch (err) {
    console.error("[nexus] update check failed", err);
  }
}

async function installUpdate() {
  if (update.state !== "available" && update.state !== "error") return;
  const { tag, name } = update;
  try {
    setUpdate({ state: "downloading", tag, name, progress: 0 });
    const res = await fetch(`${baseUrl}/api/download/latest`);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get("content-length")) || 0;
    const file = path.join(app.getPath("temp"), `NEXUS-Setup-${tag.replace(/[^\w.-]/g, "_")}.exe`);
    const out = fs.createWriteStream(file);
    const reader = res.body.getReader();
    let received = 0;
    let lastSent = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      if (!out.write(Buffer.from(value))) await new Promise((r) => out.once("drain", r));
      if (total && Date.now() - lastSent > 150) {
        lastSent = Date.now();
        setUpdate({ state: "downloading", tag, name, progress: Math.min(0.99, received / total) });
      }
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
    if (total && received < total) throw new Error("download incomplete");
    setUpdate({ state: "installing", tag, name });
    // Silent install over the current version; --force-run starts NEXUS again afterwards.
    spawn(file, ["/S", "--force-run"], { detached: true, stdio: "ignore" }).unref();
    setTimeout(() => {
      quitting = true;
      app.quit();
    }, 800);
  } catch (err) {
    setUpdate({ state: "error", tag, name, message: err instanceof Error ? err.message : String(err) });
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
<div style="position:fixed;top:0;left:0;right:0;height:40px;-webkit-app-region:drag;display:flex;justify-content:flex-end">
<button onclick="window.nexus&&window.nexus.windowControl('minimize')" style="-webkit-app-region:no-drag;width:46px;background:none;border:0;color:#8b8fa8;font-size:16px;cursor:pointer">&#8212;</button>
<button onclick="window.nexus&&window.nexus.windowControl('close')" style="-webkit-app-region:no-drag;width:46px;background:none;border:0;color:#8b8fa8;font-size:16px;cursor:pointer">&#10005;</button>
</div>
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

function createWindow(show = true) {
  mainWindow = new BrowserWindow({
    width: 1536,
    height: 1000,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: "#070A13",
    title: "NEXUS",
    show: false,
    // Windows: no system title bar — NEXUS draws its own (drag area + buttons in the top bar).
    frame: process.platform !== "win32",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  mainWindow.once("ready-to-show", () => show && mainWindow?.show());
  // X hides to the tray (League sessions keep working); quit from the tray menu.
  mainWindow.on("close", (e) => {
    if (!quitting && prefs.closeToTray && tray) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });
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
      // Only over the League game itself — never over other games or apps.
      if (editMode || isGameProcess(foreground.current)) win.showInactive();
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
  // Widgets only over the game itself; alt-tab to another game, Discord or the desktop hides them.
  const visible = editMode || isGameProcess(name);
  for (const w of widgetWins.values()) setShown(w, visible);
  // The board also shows over the League client (champ select) and NEXUS itself; one moved
  // to another monitor stays there while you play.
  if (scoutWin && scoutOnGameDisplay()) setShown(scoutWin, visible || isClientProcess(name) || name === OWN_PROCESS);
}
function setShown(w: BrowserWindow, show: boolean) {
  if (show && !w.isVisible()) w.showInactive();
  else if (!show && w.isVisible()) w.hide();
}
/** Process name of NEXUS itself (e.g. "NEXUS" for NEXUS.exe). */
const OWN_PROCESS = path.parse(process.execPath).name;
const foreground = new ForegroundWatcher(
  applyForeground,
  (letter) => {
    const action = (Object.entries(prefs.hotkeys) as [keyof DesktopPrefs["hotkeys"], string][]).find(([, l]) => l.toUpperCase() === letter)?.[0];
    if (action) runHotkey(action);
  },
  // Alt+letter works only while League (game or client) or NEXUS is in front.
  ["League of Legends", "LeagueClientUx", "LeagueClientUxRender", "LeagueClient", OWN_PROCESS],
);

/* Hotkeys: Alt + letter. Registered globally (outside the game) and read by the foreground
 * watcher while League is in front (the game blocks normal global hotkeys). */
const lastHotkey = new Map<string, number>();
function runHotkey(action: keyof DesktopPrefs["hotkeys"]) {
  const now = Date.now();
  if (now - (lastHotkey.get(action) ?? 0) < 400) return; // both paths may fire for one press
  lastHotkey.set(action, now);
  if (action === "widgets") toggleOverlay();
  else if (action === "scout") {
    scoutShownAt = 0; // manual toggle: don't auto-hide
    toggleScout();
  } else setEditMode(!editMode);
}

let registeredKeys = "";
function registerHotkeys() {
  const keys = prefs.hotkeys;
  const sig = `${keys.widgets}${keys.scout}${keys.edit}`;
  if (sig === registeredKeys) return;
  registeredKeys = sig;
  globalShortcut.unregisterAll();
  foreground.setKeys(Object.values(keys));
  // Windows: the foreground watcher reads the keys only while League or NEXUS is in front, so
  // Alt+X & co. never trigger (or get stolen) in other games and apps.
  if (process.platform === "win32") return;
  for (const [action, letter] of Object.entries(keys) as [keyof DesktopPrefs["hotkeys"], string][]) {
    if (!/^[A-Z]$/i.test(letter)) continue;
    try {
      if (!globalShortcut.register(`Alt+${letter.toUpperCase()}`, () => runHotkey(action))) console.warn(`[nexus] Alt+${letter} is used by another app`);
    } catch {
      /* invalid accelerator */
    }
  }
}

/** Edit mode makes the widget windows draggable (Ctrl+Shift+E). */
function setEditMode(on: boolean) {
  if (on && !overlayShown()) toggleOverlay(true);
  if (!on && editMode) saveScoutBounds();
  editMode = on;
  for (const w of widgetWins.values()) {
    w.setIgnoreMouseEvents(!on);
    w.setFocusable(on);
    w.webContents.send("nexus:overlay-edit", on);
  }
  // The scouting board can be moved too (e.g. to a second monitor).
  if (on && !scoutWin) {
    toggleScout(true);
    scoutForEdit = true;
  } else if (!on && scoutForEdit) {
    scoutForEdit = false;
    if (clientState.phase !== "InProgress") toggleScout(false);
  }
  applyScoutMode();
}

/** Porofessor-style scouting board, centred on screen. */
/* Scouting board: movable (edit mode) and remembered, e.g. on a second monitor. */
const scoutBoundsFile = () => path.join(app.getPath("userData"), "scout-bounds.json");
let scoutForEdit = false;

function loadScoutBounds(): Electron.Rectangle | null {
  try {
    const b = JSON.parse(fs.readFileSync(scoutBoundsFile(), "utf8")) as Electron.Rectangle;
    if (![b.x, b.y, b.width, b.height].every(Number.isFinite) || b.width < 400 || b.height < 250) return null;
    // Only if that spot is still on a connected monitor.
    const onScreen = screen.getAllDisplays().some((d) => b.x < d.bounds.x + d.bounds.width - 50 && b.x + b.width > d.bounds.x + 50 && b.y < d.bounds.y + d.bounds.height - 50 && b.y + b.height > d.bounds.y + 50);
    return onScreen ? b : null;
  } catch {
    return null;
  }
}

function saveScoutBounds() {
  if (!scoutWin) return;
  try {
    fs.writeFileSync(scoutBoundsFile(), JSON.stringify(scoutWin.getBounds()));
  } catch {
    /* ignore */
  }
}

/** True when the board is on the monitor the game runs on (then it's a click-through overlay). */
function scoutOnGameDisplay(): boolean {
  if (!scoutWin) return true;
  const game = overlayDisplay ?? screen.getPrimaryDisplay();
  return screen.getDisplayMatching(scoutWin.getBounds()).id === game.id;
}

/** The board was last placed on a monitor other than the one League is on. */
function scoutOnOtherMonitor(): boolean {
  const saved = loadScoutBounds();
  if (!saved) return false;
  const game = overlayDisplay ?? screen.getPrimaryDisplay();
  return screen.getDisplayMatching(saved).id !== game.id;
}

function applyScoutMode() {
  if (!scoutWin) return;
  const interactive = editMode || !scoutOnGameDisplay();
  scoutWin.setIgnoreMouseEvents(!interactive, interactive ? undefined : { forward: true });
  scoutWin.setFocusable(editMode);
  scoutWin.webContents.send("nexus:overlay-edit", editMode);
}

function toggleScout(show = !scoutWin) {
  if (!show) {
    if (editMode) saveScoutBounds();
    scoutWin?.close();
    scoutWin = null;
    return;
  }
  if (scoutWin) return;
  const { workArea } = screen.getPrimaryDisplay();
  const width = Math.min(1500, workArea.width - 40);
  const height = Math.min(760, workArea.height - 40);
  const saved = loadScoutBounds();
  scoutWin = new BrowserWindow({
    width: saved?.width ?? width,
    height: saved?.height ?? height,
    x: saved?.x ?? workArea.x + Math.round((workArea.width - width) / 2),
    y: saved?.y ?? workArea.y + Math.round((workArea.height - height) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    minWidth: 600,
    minHeight: 300,
    webPreferences: overlayWebPrefs(),
  });
  scoutWin.setAlwaysOnTop(true, "screen-saver");
  scoutWin.loadURL(`${baseUrl}/overlay/scout`);
  scoutWin.webContents.once("did-finish-load", applyScoutMode);
  applyScoutMode();
  let lastDisplay = screen.getDisplayMatching(scoutWin.getBounds()).id;
  scoutWin.on("moved", () => {
    if (!scoutWin) return;
    // Dropped on another monitor: fill that monitor (transparent windows can't be resized by hand).
    const d = screen.getDisplayMatching(scoutWin.getBounds());
    if (d.id !== lastDisplay) {
      lastDisplay = d.id;
      const wa = d.workArea;
      const onGame = d.id === (overlayDisplay ?? screen.getPrimaryDisplay()).id;
      const w = onGame ? Math.min(1500, wa.width - 40) : wa.width;
      const h = onGame ? Math.min(760, wa.height - 40) : wa.height;
      scoutWin.setBounds({ x: wa.x + Math.round((wa.width - w) / 2), y: wa.y + Math.round((wa.height - h) / 2), width: w, height: h });
    }
    saveScoutBounds();
    applyScoutMode();
  });
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

async function runImport(championId: number, role: Role | null, manual: boolean, mode: GameModeId = "sr", runeIndex?: number, variant?: string): Promise<ImportResult> {
  if (!conn) throw new Error("League client is not running.");
  const name = await championName(championId);
  const result = await importBuild(conn, baseUrl, championId, mode === "sr" ? role : null, name, prefs.import, mode, runeIndex, variant);
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
      // 10-player board right away: the League client is on the screen the mouse is on.
      overlayDisplay = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
      if (prefs.scoutAutoShow && scoutOnOtherMonitor()) {
        toggleScout(true);
        scoutShownAt = Date.now();
      }
      void snapshotRank();
      void ensureBorderless().catch(() => undefined);
    }
    if (next.phase === "ChampSelect" && conn && prefs.import.enabled) {
      const pick = await watcher.lockedChampion(conn, prefs.import.onHover).catch(() => null);
      const off = pick && (prefs.import.disabledChampions ?? []).includes(pick.championId);
      if (pick && !off && watcher.shouldImport(pick.championId, mode === "sr" ? pick.role : null)) runImport(pick.championId, pick.role, false, mode).catch(() => undefined);
    }
    if (next.phase !== "ChampSelect" && prevPhase === "ChampSelect") {
      watcher.reset();
      // Dodge / back to lobby: close the auto-shown board.
      if (!IN_GAME.has(next.phase) && scoutShownAt && !editMode) {
        toggleScout(false);
        scoutShownAt = 0;
      }
    }

    // Game start → scouting board on the loading screen, widgets once in game.
    if (next.phase === "InProgress" && prevPhase !== "InProgress") {
      mainWindow?.webContents.send("nexus:navigate", "/live");
      if (prefs.minimizeInGame && mainWindow && !mainWindow.isFocused()) mainWindow.minimize();
      if (prefs.scoutAutoShow) {
        toggleScout(true);
        scoutShownAt = Date.now();
      }
      if (prefs.widgetsEnabled) toggleOverlay(true);
    }
    // Hide the auto-shown board once the game has actually started (loading finished).
    if (scoutWin && scoutShownAt && next.phase === "InProgress" && scoutOnGameDisplay()) {
      const live = await getLiveClientSnapshot();
      if (live && live.gameTime > 15) {
        toggleScout(false);
        scoutShownAt = 0;
      }
    }
    if (next.phase !== "InProgress" && prevPhase === "InProgress") {
      toggleOverlay(false);
      toggleScout(false);
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
      // Client closed or crashed mid-game: never leave widgets over other apps.
      if (!editMode) {
        toggleOverlay(false);
        toggleScout(false);
      }
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
  const prevHotkeys = prefs.hotkeys;
  prefs = { ...prefs, ...next, import: { ...prefs.import, ...(next?.import ?? {}) } };
  prefs.autoAcceptDelay = Math.min(10, Math.max(0, Number(prefs.autoAcceptDelay) || 0));
  if (!prefs.widgetsEnabled) toggleOverlay(false);
  else if (overlayShown()) toggleOverlay(true); // add/remove widgets switched in Settings
  if (discordWas !== prefs.discord) void updatePresence(clientState.phase).catch(() => undefined);
  const hk = (next as Partial<DesktopPrefs> | undefined)?.hotkeys;
  prefs.hotkeys = {
    widgets: /^[A-Z]$/i.test(hk?.widgets ?? "") ? hk!.widgets.toUpperCase() : prevHotkeys.widgets,
    scout: /^[A-Z]$/i.test(hk?.scout ?? "") ? hk!.scout.toUpperCase() : prevHotkeys.scout,
    edit: /^[A-Z]$/i.test(hk?.edit ?? "") ? hk!.edit.toUpperCase() : prevHotkeys.edit,
  };
  registerHotkeys();
  applyLoginItem();
  buildTrayMenu();
  writeJson(prefsFile(), prefs);
});
ipcMain.handle("nexus:load-settings", () => readJson(settingsFile()));
ipcMain.handle("nexus:save-settings", (_e, value: unknown) => {
  if (value && typeof value === "object") writeJson(settingsFile(), value);
});
ipcMain.handle("nexus:window", (e, action: string) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win || win !== mainWindow) return;
  if (action === "minimize") win.minimize();
  else if (action === "maximize") (win.isMaximized() ? win.unmaximize() : win.maximize());
  else if (action === "close") win.close();
});
ipcMain.handle("nexus:get-update", () => update);
ipcMain.handle("nexus:install-update", () => installUpdate());
ipcMain.handle("nexus:get-champ-select", async () => {
  if (!conn || clientState.phase !== "ChampSelect") return null;
  return readChampSelect(conn, flow.queueId).catch(() => null);
});
ipcMain.handle("nexus:get-last-game", () => lastGame);
ipcMain.handle("nexus:import-build", async (_e, championId: number, role: Role | null, modeArg?: string, runeIndex?: number, variant?: string) => {
  try {
    conn = conn ?? (await findConnection());
    const idx = Number.isInteger(runeIndex) ? Math.max(0, Math.min(4, Number(runeIndex))) : undefined;
    const style = typeof variant === "string" && /^[a-z]{2,12}$/.test(variant) ? variant : undefined;
    const r = await runImport(Number(championId), role ?? null, true, isGameModeId(modeArg) ? modeArg : "sr", idx, style);
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
  loadSavedPrefs();
  try {
    baseUrl = await startServer();
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow(!startHidden);
  createTray();
  applyLoginItem();
  setTimeout(() => void checkForUpdate(), 8000);
  setInterval(() => void checkForUpdate(), 6 * 3600e3);
  // Overlays only draw over League in Borderless / Windowed display mode.
  registerHotkeys();
  foreground.start();
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
