/**
 * League Client (LCU) and Live Client Data helpers for the desktop app.
 *
 * - The League client writes a `lockfile` (name:pid:port:password:protocol) while running.
 *   Its local REST API (https://127.0.0.1:<port>, basic auth riot:<password>) tells us the
 *   logged-in account and the gameflow phase (Lobby, ChampSelect, InProgress …).
 * - During a game, the Live Client Data API on https://127.0.0.1:2999 exposes scores and
 *   items for the current match. Both use Riot's self-signed certificate, so TLS
 *   verification is relaxed ONLY for these loopback requests.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import https from "node:https";
import os from "node:os";
import path from "node:path";

export interface LcuConnection {
  port: number;
  password: string;
  protocol: string;
}

export function parseLockfile(content: string): LcuConnection | null {
  const parts = content.trim().split(":");
  if (parts.length < 5) return null;
  const port = Number(parts[2]);
  if (!Number.isInteger(port) || port <= 0) return null;
  return { port, password: parts[3], protocol: parts[4] };
}

/** Extracts the connection from LeaderClientUx command-line arguments (fallback when the install path is unusual). */
export function parseProcessArgs(cmdline: string): LcuConnection | null {
  const port = /--app-port=["']?(\d+)/.exec(cmdline)?.[1];
  const token = /--remoting-auth-token=["']?([\w-]+)/.exec(cmdline)?.[1];
  return port && token ? { port: Number(port), password: token, protocol: "https" } : null;
}

export function lockfileCandidates(platform = process.platform, home = os.homedir()): string[] {
  if (platform === "win32")
    return ["C:\\Riot Games\\League of Legends\\lockfile", "D:\\Riot Games\\League of Legends\\lockfile", "C:\\Program Files\\Riot Games\\League of Legends\\lockfile", "E:\\Riot Games\\League of Legends\\lockfile"];
  if (platform === "darwin") return ["/Applications/League of Legends.app/Contents/LoL/lockfile", path.join(home, "Applications/League of Legends.app/Contents/LoL/lockfile")];
  return [];
}

function processCommandLine(): Promise<string> {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-Command", "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\" | Select-Object -ExpandProperty CommandLine"],
        { windowsHide: true, timeout: 4000 },
        (_e, out) => resolve(out ?? ""),
      );
    } else if (process.platform === "darwin") {
      execFile("ps", ["-A", "-o", "args"], { timeout: 4000 }, (_e, out) => resolve((out ?? "").split("\n").filter((l) => l.includes("LeagueClientUx")).join("\n")));
    } else resolve("");
  });
}

export async function findConnection(extraPaths: string[] = []): Promise<LcuConnection | null> {
  for (const p of [...extraPaths, ...lockfileCandidates()]) {
    try {
      const conn = parseLockfile(await fs.readFile(p, "utf8"));
      if (conn) return conn;
    } catch {
      /* not here */
    }
  }
  return parseProcessArgs(await processCommandLine());
}

const loopbackAgent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 2500): Promise<T> {
  const u = new URL(url);
  if (u.hostname !== "127.0.0.1") return Promise.reject(new Error("Only loopback requests are allowed here"));
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: loopbackAgent, headers: { Accept: "application/json", ...headers }, timeout: timeoutMs }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        if ((res.statusCode ?? 500) >= 400) return reject(new Error(`HTTP ${res.statusCode}`));
        try {
          resolve(JSON.parse(body) as T);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

export interface LcuResponse<T = unknown> {
  status: number;
  body: T | null;
}

/** Any-method request to the League client API (loopback only). */
export function lcuRequest<T = unknown>(conn: LcuConnection, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", route: string, body?: unknown): Promise<LcuResponse<T>> {
  const auth = Buffer.from(`riot:${conn.password}`).toString("base64");
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port: conn.port,
        path: route,
        method,
        agent: loopbackAgent,
        timeout: 5000,
        headers: {
          Authorization: `Basic ${auth}`,
          Accept: "application/json",
          ...(data ? { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed: T | null = null;
          try {
            parsed = raw ? (JSON.parse(raw) as T) : null;
          } catch {
            parsed = null;
          }
          resolve({ status: res.statusCode ?? 500, body: parsed });
        });
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end(data);
  });
}

export async function lcuPost(conn: LcuConnection, route: string, body: unknown): Promise<number> {
  return (await lcuRequest(conn, "POST", route, body)).status;
}

export function lcuGet<T>(conn: LcuConnection, route: string): Promise<T> {
  const auth = Buffer.from(`riot:${conn.password}`).toString("base64");
  return getJson<T>(`https://127.0.0.1:${conn.port}${route}`, { Authorization: `Basic ${auth}` });
}

/* ---------------------------------------------------------- Live Client */

interface RawLivePlayer {
  riotId?: string;
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  championName: string;
  team: "ORDER" | "CHAOS";
  level: number;
  items: { itemID: number; slot: number }[];
  scores: { kills: number; deaths: number; assists: number; creepScore: number };
  summonerSpells?: { summonerSpellOne?: { displayName: string }; summonerSpellTwo?: { displayName: string } };
  position?: string;
  runes?: { keystone?: { id: number }; secondaryRuneTree?: { id: number } };
}

interface RawAllGameData {
  activePlayer?: { riotId?: string; riotIdGameName?: string; riotIdTagLine?: string; summonerName?: string; currentGold?: number };
  allPlayers: RawLivePlayer[];
  events?: { Events: { EventName: string; EventTime: number; KillerName?: string }[] };
  gameData: { gameMode: string; gameTime: number };
}

export function mapLiveClient(raw: RawAllGameData) {
  const riotIdOf = (p: RawLivePlayer) => p.riotId ?? (p.riotIdGameName ? `${p.riotIdGameName}#${p.riotIdTagLine ?? ""}` : (p.summonerName ?? ""));
  // The active player's id comes in different shapes depending on the patch (riotId,
  // gameName + tag, or the old summonerName) — compare all of them, case-insensitively.
  const norm = (v: string | undefined) => (v ?? "").trim().toLowerCase().replace(/\s+/g, "");
  const ap = raw.activePlayer;
  const activeKeys = new Set(
    [ap?.riotId, ap?.riotIdGameName && `${ap.riotIdGameName}#${ap.riotIdTagLine ?? ""}`, ap?.riotIdGameName, ap?.summonerName, ap?.riotId?.split("#")[0]]
      .map((v) => norm(v || ""))
      .filter(Boolean),
  );
  const isMe = (p: RawLivePlayer) =>
    [p.riotId, riotIdOf(p), p.riotIdGameName, p.summonerName, p.riotId?.split("#")[0]].some((v) => v && activeKeys.has(norm(v)));
  return {
    gameTime: raw.gameData.gameTime,
    gameMode: raw.gameData.gameMode,
    activeRiotId: raw.activePlayer?.riotId ?? raw.activePlayer?.summonerName ?? "",
    activeGold: raw.activePlayer?.currentGold != null ? Math.floor(raw.activePlayer.currentGold) : null,
    players: raw.allPlayers.map((p) => {
      const items = Array<number>(6).fill(0);
      for (const it of p.items) if (it.slot >= 0 && it.slot < 6) items[it.slot] = it.itemID;
      return {
        riotId: riotIdOf(p),
        isMe: activeKeys.size > 0 && isMe(p),
        championName: p.championName,
        team: p.team,
        level: p.level,
        kills: p.scores.kills,
        deaths: p.scores.deaths,
        assists: p.scores.assists,
        cs: p.scores.creepScore,
        items,
        spells: [p.summonerSpells?.summonerSpellOne?.displayName ?? "", p.summonerSpells?.summonerSpellTwo?.displayName ?? ""],
        position: p.position || null,
        keystone: p.runes?.keystone?.id ?? null,
      };
    }),
    events: (raw.events?.Events ?? []).map((e) => ({ name: e.EventName, time: e.EventTime })),
  };
}

export async function getLiveClientSnapshot() {
  try {
    return mapLiveClient(await getJson<RawAllGameData>("https://127.0.0.1:2999/liveclientdata/allgamedata", {}, 1500));
  } catch {
    return null;
  }
}

/* ----------------------------------------------------------- client state */

const REGION_TO_PLATFORM: Record<string, string> = {
  EUW: "euw1", EUNE: "eun1", NA: "na1", KR: "kr", JP: "jp1", BR: "br1", LA1: "la1", LA2: "la2", LAN: "la1", LAS: "la2", OC1: "oc1", OCE: "oc1", TR: "tr1", RU: "ru", ME1: "me1", SG2: "sg2", TW2: "tw2", VN2: "vn2",
};

export async function readClientState(conn: LcuConnection) {
  const [phase, summoner, region] = await Promise.all([
    lcuGet<string>(conn, "/lol-gameflow/v1/gameflow-phase").catch(() => "None"),
    lcuGet<{ gameName?: string; tagLine?: string; puuid: string; displayName?: string }>(conn, "/lol-summoner/v1/current-summoner").catch(() => null),
    lcuGet<{ region?: string }>(conn, "/riotclient/region-locale").catch(() => null),
  ]);
  return {
    connected: true,
    phase,
    summoner: summoner
      ? {
          gameName: summoner.gameName ?? summoner.displayName ?? "",
          tagLine: summoner.tagLine ?? "",
          puuid: summoner.puuid,
          platform: region?.region ? (REGION_TO_PLATFORM[region.region.toUpperCase()] ?? region.region.toLowerCase()) : null,
        }
      : null,
  };
}

/* ------------------------------------------------------- gameflow & champ select */

export interface GameflowInfo {
  queueId: number | null;
  gameMode: string | null;
  /** Game id while in game (used to tell games apart). */
  gameId: number | null;
}

export async function readGameflowSession(conn: LcuConnection): Promise<GameflowInfo> {
  const s = await lcuGet<{ gameData?: { gameId?: number; queue?: { id?: number; gameMode?: string } } }>(conn, "/lol-gameflow/v1/session").catch(() => null);
  return { queueId: s?.gameData?.queue?.id ?? null, gameMode: s?.gameData?.queue?.gameMode ?? null, gameId: s?.gameData?.gameId ?? null };
}

/** Accepts the ready check if one is waiting for this player. Returns true when it accepted. */
export async function acceptReadyCheck(conn: LcuConnection): Promise<boolean> {
  const rc = await lcuGet<{ state?: string; playerResponse?: string }>(conn, "/lol-matchmaking/v1/ready-check").catch(() => null);
  if (!rc || rc.state !== "InProgress" || rc.playerResponse !== "None") return false;
  const status = await lcuPost(conn, "/lol-matchmaking/v1/ready-check/accept", {});
  return status < 300;
}

interface RawChampSelect {
  localPlayerCellId: number;
  myTeam: { cellId: number; championId: number; championPickIntent: number; assignedPosition: string }[];
  theirTeam: { cellId: number; championId: number; championPickIntent?: number; assignedPosition: string }[];
  bans?: { myTeamBans?: number[]; theirTeamBans?: number[] };
  actions?: { actorCellId: number; type: string; completed: boolean; championId: number; isInProgress?: boolean }[][];
  timer?: { phase?: string };
}

/** Champ select as the NEXUS page needs it (see ChampSelectState in lib/desktop.ts). */
export async function readChampSelect(conn: LcuConnection, queueId: number | null) {
  const s = await lcuGet<RawChampSelect>(conn, "/lol-champ-select/v1/session").catch(() => null);
  if (!s) return null;
  const actions = (s.actions ?? []).flat();
  const bans = actions.filter((a) => a.type === "ban" && a.completed && a.championId > 0).map((a) => a.championId);
  const myBanTurn = actions.some((a) => a.type === "ban" && a.actorCellId === s.localPlayerCellId && a.isInProgress && !a.completed);
  return {
    queueId,
    phase: s.timer?.phase ?? "",
    myCellId: s.localPlayerCellId,
    myBanTurn,
    myTeam: s.myTeam.map((m) => ({ cellId: m.cellId, championId: m.championId || 0, intentId: m.championPickIntent || 0, position: m.assignedPosition || "" })),
    theirTeam: s.theirTeam.map((m) => ({ cellId: m.cellId, championId: m.championId || 0, position: m.assignedPosition || "" })),
    bans: [...new Set([...(s.bans?.myTeamBans ?? []), ...(s.bans?.theirTeamBans ?? []), ...bans])].filter((id) => id > 0),
  };
}
