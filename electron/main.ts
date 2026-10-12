/**
 * NEXUS desktop shell. Boots the bundled Next.js server (standalone output) on a free
 * loopback port, opens the app window and watches the League client:
 *  - champ select → auto-imports runes, summoner spells and an item set,
 *  - loading screen → shows the scouting board (Ctrl+Shift+S),
 *  - in game → transparent widget overlay (Ctrl+Shift+N, Ctrl+Shift+E to move widgets).
 */
import { app, BrowserWindow, globalShortcut, ipcMain, Notification, screen, shell } from "electron";
import { fork, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { DEFAULT_IMPORT_PREFS, type ImportPrefs } from "../lib/client-import";
import { normalizeServerUrl } from "../server/admin-utils";
import type { Role } from "../lib/types";
import { ChampSelectWatcher, importBuild, type ImportResult } from "./importer";
import { findConnection, getLiveClientSnapshot, lcuPost, readClientState, type LcuConnection } from "./lcu";

const isDev = process.argv.includes("--dev");
const DEV_URL = process.env.NEXUS_DEV_URL ?? "http://localhost:3210";

let mainWindow: BrowserWindow | null = null;
let overlay: BrowserWindow | null = null;
let scoutWin: BrowserWindow | null = null;
let editMode = false;
let server: ChildProcess | null = null;
let baseUrl = DEV_URL;
let autoDetect = true;

interface DesktopPrefs {
  import: ImportPrefs & { enabled: boolean; onHover: boolean };
  scoutAutoShow: boolean;
  widgetsEnabled: boolean;
}
let prefs: DesktopPrefs = { import: { ...DEFAULT_IMPORT_PREFS, enabled: true, onHover: false }, scoutAutoShow: true, widgetsEnabled: true };
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
function toggleOverlay(show = !overlay) {
  if (!show) {
    overlay?.close();
    overlay = null;
    editMode = false;
    return;
  }
  if (overlay) return;
  const { bounds } = screen.getPrimaryDisplay();
  overlay = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    webPreferences: overlayWebPrefs(),
  });
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadURL(`${baseUrl}/overlay`);
  overlay.on("closed", () => (overlay = null));
}

/** Edit mode makes the overlay interactive so widgets can be dragged. */
function setEditMode(on: boolean) {
  if (on && !overlay) toggleOverlay(true);
  editMode = on;
  if (!overlay) return;
  overlay.setIgnoreMouseEvents(!on, { forward: true });
  overlay.setFocusable(on);
  if (on) overlay.focus();
  overlay.webContents.send("nexus:overlay-edit", on);
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
  for (const w of [mainWindow, overlay, scoutWin]) w?.webContents.send("nexus:client-state", state);
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

async function runImport(championId: number, role: Role | null, manual: boolean): Promise<ImportResult> {
  if (!conn) throw new Error("League client is not running.");
  const name = await championName(championId);
  const result = await importBuild(conn, baseUrl, championId, role, name, prefs.import);
  const text = describeImport(result, name);
  mainWindow?.webContents.send("nexus:import", { ...result, text });
  if (!manual) new Notification({ title: "NEXUS", body: text, silent: true }).show();
  return result;
}

let conn: LcuConnection | null = null;
let scoutShownAt = 0;
async function pollClient() {
  if (!autoDetect) return;
  try {
    conn = conn ?? (await findConnection());
    const next: ClientState = conn ? await readClientState(conn) : { connected: false, phase: "None", summoner: null };
    const prevPhase = clientState.phase;
    clientState = next;
    broadcast(next);

    // Champ select → auto import once per champion/role.
    if (next.phase === "ChampSelect" && conn && prefs.import.enabled) {
      const pick = await watcher.lockedChampion(conn, prefs.import.onHover).catch(() => null);
      if (pick && watcher.shouldImport(pick.championId, pick.role)) runImport(pick.championId, pick.role, false).catch(() => undefined);
    }
    if (next.phase !== "ChampSelect" && prevPhase === "ChampSelect") watcher.reset();

    // Game start → scouting board on the loading screen, widgets once in game.
    if (next.phase === "InProgress" && prevPhase !== "InProgress") {
      mainWindow?.webContents.send("nexus:navigate", "/live");
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
    }
  } catch {
    conn = null; // client closed or restarted — the lockfile password changes
    if (clientState.connected) {
      clientState = { connected: false, phase: "None", summoner: null };
      broadcast(clientState);
    }
  }
}

ipcMain.handle("nexus:get-client-state", () => clientState);
ipcMain.handle("nexus:get-live-client", () => getLiveClientSnapshot());
ipcMain.handle("nexus:set-auto-detect", (_e, enabled: boolean) => {
  autoDetect = Boolean(enabled);
});
ipcMain.handle("nexus:set-prefs", (_e, next: Partial<DesktopPrefs>) => {
  prefs = { ...prefs, ...next, import: { ...prefs.import, ...(next?.import ?? {}) } };
  if (!prefs.widgetsEnabled) toggleOverlay(false);
});
ipcMain.handle("nexus:import-build", async (_e, championId: number, role: Role | null) => {
  try {
    conn = conn ?? (await findConnection());
    const r = await runImport(Number(championId), role ?? null, true);
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

app.whenReady().then(async () => {
  try {
    baseUrl = await startServer();
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow();
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
  server?.kill();
});
