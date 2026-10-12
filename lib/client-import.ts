/**
 * Pure conversions from a NEXUS ChampionBuild into the payloads the League client
 * accepts (rune page, summoner spells, item set). Shared by the Electron importer and tests.
 */
import type { ChampionBuild, Role } from "./types";

export const DEFAULT_SHARDS = [5008, 5008, 5011];
export const NEXUS_PREFIX = "NEXUS";

export interface ImportPrefs {
  runes: boolean;
  spells: boolean;
  items: boolean;
  /** Which key Flash should be on. */
  flashKey: "D" | "F";
}

export const DEFAULT_IMPORT_PREFS: ImportPrefs = { runes: true, spells: true, items: true, flashKey: "F" };

export interface ClientRunePage {
  name: string;
  primaryStyleId: number;
  subStyleId: number;
  selectedPerkIds: number[];
  current: boolean;
}

const ROLE_SHORT: Record<Role, string> = { TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid", BOTTOM: "ADC", UTILITY: "Support" };

export function toRunePage(build: ChampionBuild, championName: string): ClientRunePage | null {
  const page = build.runes[0];
  if (!page || page.perks.length < 6) return null;
  const shards = page.shards.length === 3 ? page.shards : DEFAULT_SHARDS;
  return {
    // The client limits page names; keep it short.
    name: `${NEXUS_PREFIX} ${championName} ${ROLE_SHORT[build.role]}`.slice(0, 32),
    primaryStyleId: page.primaryStyle,
    subStyleId: page.subStyle,
    selectedPerkIds: [...page.perks.slice(0, 6), ...shards],
    current: true,
  };
}

/** Summoner spells with Flash placed on the preferred key (D = spell1, F = spell2). */
export function toSpells(build: ChampionBuild, flashKey: "D" | "F"): { spell1Id: number; spell2Id: number } | null {
  const ids = build.spells[0]?.ids;
  if (!ids) return null;
  const [a, b] = ids;
  const FLASH = 4;
  if (a === FLASH || b === FLASH) {
    const other = a === FLASH ? b : a;
    return flashKey === "D" ? { spell1Id: FLASH, spell2Id: other } : { spell1Id: other, spell2Id: FLASH };
  }
  return { spell1Id: a, spell2Id: b };
}

export interface ClientItemSet {
  title: string;
  type: "custom";
  map: "SR";
  mode: "CLASSIC";
  priority: false;
  sortrank: number;
  startedFrom: "blank";
  associatedChampions: number[];
  associatedMaps: number[];
  uid: string;
  blocks: { type: string; items: { id: string; count: number }[] }[];
  preferredItemSlots: unknown[];
}

const block = (type: string, ids: number[]) => ({ type, items: ids.filter((id) => id > 0).map((id) => ({ id: String(id), count: 1 })) });
const wr = (v: number) => `${(v * 100).toFixed(1)}% WR`;

export function toItemSet(build: ChampionBuild, championName: string, uid: string): ClientItemSet {
  const starting = build.starting[0];
  const blocks = [
    starting && block(`Starting Items · ${wr(starting.winRate)}`, starting.items),
    block(`Most Common Build · ${wr(build.popular.winRate)}`, build.popular.items),
    block(`Highest Win Rate · ${wr(build.highestWinRate.winRate)}`, build.highestWinRate.items),
    build.boots.length > 0 && block("Boots", build.boots.map((b) => b.items[0])),
    build.situational.length > 0 && block("Situational", build.situational.map((s) => s.itemId)),
    block("Consumables", [2003, 2055, 3340, 3364]),
  ].filter(Boolean) as ClientItemSet["blocks"];
  return {
    title: `${NEXUS_PREFIX} ${championName} ${ROLE_SHORT[build.role]} (${build.patch})`,
    type: "custom",
    map: "SR",
    mode: "CLASSIC",
    priority: false,
    sortrank: 0,
    startedFrom: "blank",
    associatedChampions: [build.championId],
    associatedMaps: [11],
    uid,
    blocks: blocks.filter((b) => b.items.length > 0),
    preferredItemSlots: [],
  };
}

/** Lane from the champ-select `assignedPosition` value. */
export function roleFromAssigned(position: string | undefined | null): Role | null {
  switch ((position ?? "").toLowerCase()) {
    case "top":
      return "TOP";
    case "jungle":
      return "JUNGLE";
    case "middle":
    case "mid":
      return "MIDDLE";
    case "bottom":
    case "bot":
      return "BOTTOM";
    case "utility":
    case "support":
      return "UTILITY";
    default:
      return null;
  }
}
