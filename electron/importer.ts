/**
 * Champion-select auto import: when you lock (or hover, if enabled) a champion, the
 * recommended rune page, summoner spells and item set from NEXUS are written into the
 * League client through its local API.
 */
import { randomUUID } from "node:crypto";
import { roleFromAssigned, toItemSet, toRunePage, toSpells, NEXUS_PREFIX, type ImportPrefs } from "../lib/client-import";
import type { GameModeId } from "../lib/modes";
import type { ChampionBuild, Role } from "../lib/types";
import { lcuRequest, type LcuConnection } from "./lcu";

interface ChampSelectSession {
  localPlayerCellId: number;
  myTeam: { cellId: number; championId: number; championPickIntent: number; assignedPosition: string }[];
  actions?: { actorCellId: number; type: string; completed: boolean; championId: number }[][];
}

interface PerkPage {
  id: number;
  name: string;
  isDeletable: boolean;
  isEditable: boolean;
  current: boolean;
}

export interface ImportResult {
  championId: number;
  role: Role | null;
  runes: "ok" | "skipped" | "failed";
  spells: "ok" | "skipped" | "failed";
  items: "ok" | "skipped" | "failed";
  message?: string;
}

/** Fetches the build from the NEXUS server and writes it into the client. */
export async function importBuild(conn: LcuConnection, baseUrl: string, championId: number, role: Role | null, championName: string, prefs: ImportPrefs, mode: GameModeId = "sr", runeIndex?: number, variant?: string): Promise<ImportResult> {
  const result: ImportResult = { championId, role, runes: "skipped", spells: "skipped", items: "skipped" };
  const params = new URLSearchParams();
  if (role && mode === "sr") params.set("role", role);
  if (mode !== "sr") params.set("mode", mode);
  const style = variant ?? prefs.variantChoice?.[String(championId)];
  if (style && /^[a-z]{2,12}$/.test(style)) params.set("variant", style);
  const qs = params.size ? `?${params}` : "";
  const res = await fetch(`${baseUrl}/api/champions/${championId}${qs}`);
  if (!res.ok) return { ...result, runes: "failed", spells: "failed", items: "failed", message: `No build for this champion (${res.status}).` };
  const body = (await res.json()) as { data: ChampionBuild | null; note?: string };
  const build = body.data;
  if (!build) return { ...result, message: body.note ?? "Build data for this champion is still being collected." };

  if (mode === "arena") prefs = { ...prefs, runes: false, spells: false }; // Arena has no rune pages or spell picks
  const index = runeIndex ?? prefs.runeChoice?.[String(championId)] ?? 0;
  if (prefs.runes) result.runes = await importRunes(conn, build, championName, mode, index).catch(() => "failed" as const);
  if (prefs.spells) result.spells = await importSpells(conn, build, prefs.flashKey).catch(() => "failed" as const);
  if (prefs.items) result.items = await importItems(conn, build, championName, mode).catch(() => "failed" as const);
  return result;
}

async function importRunes(conn: LcuConnection, build: ChampionBuild, championName: string, mode: GameModeId, index = 0) {
  const page = toRunePage(build, championName, mode, index);
  if (!page) return "skipped" as const;
  const pages = (await lcuRequest<PerkPage[]>(conn, "GET", "/lol-perks/v1/pages")).body ?? [];
  // Replace our previous page; otherwise free a slot by overwriting the current editable page.
  const ours = pages.find((p) => p.isDeletable && p.name.startsWith(NEXUS_PREFIX));
  if (ours) await lcuRequest(conn, "DELETE", `/lol-perks/v1/pages/${ours.id}`);
  let created = await lcuRequest(conn, "POST", "/lol-perks/v1/pages", page);
  if (created.status >= 300) {
    const fallback = pages.find((p) => p.current && p.isEditable && p.isDeletable) ?? pages.find((p) => p.isEditable && p.isDeletable);
    if (!fallback) return "failed" as const;
    await lcuRequest(conn, "DELETE", `/lol-perks/v1/pages/${fallback.id}`);
    created = await lcuRequest(conn, "POST", "/lol-perks/v1/pages", page);
  }
  return created.status < 300 ? ("ok" as const) : ("failed" as const);
}

async function importSpells(conn: LcuConnection, build: ChampionBuild, flashKey: "D" | "F") {
  const spells = toSpells(build, flashKey);
  if (!spells) return "skipped" as const;
  const r = await lcuRequest(conn, "PATCH", "/lol-champ-select/v1/session/my-selection", spells);
  return r.status < 300 ? ("ok" as const) : ("failed" as const);
}

async function importItems(conn: LcuConnection, build: ChampionBuild, championName: string, mode: GameModeId) {
  const me = (await lcuRequest<{ summonerId: number; accountId: number }>(conn, "GET", "/lol-summoner/v1/current-summoner")).body;
  if (!me) return "failed" as const;
  const route = `/lol-item-sets/v1/item-sets/${me.summonerId}/sets`;
  const current = (await lcuRequest<{ itemSets: { title: string; associatedChampions: number[] }[] }>(conn, "GET", route)).body;
  const keep = (current?.itemSets ?? []).filter((s) => !(s.title.startsWith(NEXUS_PREFIX) && s.associatedChampions.includes(build.championId)));
  const r = await lcuRequest(conn, "PUT", route, {
    accountId: me.accountId,
    itemSets: [...keep, toItemSet(build, championName, randomUUID(), mode)],
    timestamp: Date.now(),
  });
  return r.status < 300 ? ("ok" as const) : ("failed" as const);
}

/**
 * Watches champ select and triggers an import once per (champion, role). Call `tick`
 * every poll while the gameflow phase is ChampSelect; `reset` when it ends.
 */
export class ChampSelectWatcher {
  private done = new Set<string>();

  reset() {
    this.done.clear();
  }

  /** Returns the champion the local player has locked in, or null. */
  async lockedChampion(conn: LcuConnection, onHover: boolean): Promise<{ championId: number; role: Role | null } | null> {
    const session = (await lcuRequest<ChampSelectSession>(conn, "GET", "/lol-champ-select/v1/session")).body;
    if (!session) return null;
    const me = session.myTeam.find((m) => m.cellId === session.localPlayerCellId);
    if (!me) return null;
    const pick = (session.actions ?? []).flat().find((a) => a.actorCellId === session.localPlayerCellId && a.type === "pick");
    const locked = me.championId > 0 && (pick?.completed ?? true);
    const championId = locked ? me.championId : onHover ? me.championPickIntent || me.championId : 0;
    return championId > 0 ? { championId, role: roleFromAssigned(me.assignedPosition) } : null;
  }

  shouldImport(championId: number, role: Role | null): boolean {
    const key = `${championId}:${role ?? "auto"}`;
    if (this.done.has(key)) return false;
    this.done.add(key);
    return true;
  }
}
