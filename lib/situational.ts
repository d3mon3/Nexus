import type { ChampionInfo } from "./types";

/**
 * Situational items for one game: looks at the enemy team (and, in game, what they bought)
 * and suggests answers for every kind of champion — AD fighters/assassins, marksmen, mages
 * and tanks — not only for marksmen. Item ids are Data Dragon ids.
 */

export type ItemStyle = "ad" | "adc" | "ap" | "tank";
export const ITEM_STYLES: { value: ItemStyle; label: string }[] = [
  { value: "ad", label: "AD" },
  { value: "adc", label: "ADC" },
  { value: "ap", label: "AP" },
  { value: "tank", label: "Tank" },
];

export type ThreatId = "heal" | "ap" | "ad" | "tanks" | "cc" | "burst" | "shields" | "armor" | "mr";

interface ThreatRule {
  id: ThreatId;
  title: string;
  tip: string;
  items: Partial<Record<ItemStyle, number[]>>;
}

export const THREATS: Record<ThreatId, ThreatRule> = {
  heal: {
    id: "heal",
    title: "Anti-heal",
    tip: "Enemies heal a lot — buy Grievous Wounds early.",
    items: { ad: [3123, 6609], adc: [3033, 3123], ap: [3165, 3916], tank: [3075, 3076] },
  },
  ap: {
    id: "ap",
    title: "Lots of magic damage",
    tip: "Most of their damage is magic — magic resist pays off.",
    items: { ad: [3156, 3091], adc: [3139, 3156], ap: [3102, 3111], tank: [4401, 2504, 3065, 8020] },
  },
  ad: {
    id: "ad",
    title: "Lots of physical damage",
    tip: "Most of their damage is physical — armor pays off.",
    items: { ad: [6333, 3026, 3047], adc: [3026, 6673, 3047], ap: [3157, 3047], tank: [3143, 3110, 3075, 3047] },
  },
  tanks: {
    id: "tanks",
    title: "Tanks",
    tip: "Several tanky enemies — penetration and %-health damage.",
    items: { ad: [3071, 6694, 3153], adc: [3036, 3153], ap: [3135, 6653, 3137], tank: [3084, 3068] },
  },
  cc: {
    id: "cc",
    title: "Heavy crowd control",
    tip: "Lots of stuns and roots — tenacity or a cleanse.",
    items: { ad: [3111, 3053], adc: [3139, 3111], ap: [3111, 3102], tank: [3111, 2504] },
  },
  burst: {
    id: "burst",
    title: "Assassins",
    tip: "They can burst you — a defensive item keeps you alive.",
    items: { ad: [3814, 3026, 3053], adc: [6673, 3026], ap: [3157, 3102], tank: [3083, 3047] },
  },
  shields: {
    id: "shields",
    title: "Shields",
    tip: "Their shields absorb a lot of damage — Serpent's Fang cuts them.",
    items: { ad: [6695], adc: [6695] },
  },
  armor: {
    id: "armor",
    title: "Armor stacking",
    tip: "They bought a lot of armor — armor penetration.",
    items: { ad: [6694, 3071], adc: [3036] },
  },
  mr: {
    id: "mr",
    title: "Magic resist stacking",
    tip: "They bought a lot of magic resist — magic penetration.",
    items: { ap: [3135, 3137] },
  },
};

// Data Dragon keys.
const HEALERS = new Set("Aatrox Vladimir Soraka Yuumi Warwick DrMundo Sylas Swain Fiddlesticks Nami Sona Seraphine Briar Olaf Illaoi Kayn Fiora Irelia Samira Senna Milio Maokai Zac Gwen Viego Udyr Trundle Volibear Darius Nasus Taric Belveth Nidalee Renekton Ambessa".split(" "));
const SHIELDERS = new Set("Lulu Janna Karma Sett Seraphine Renata Orianna Yuumi Milio Ivern Rakan Shen Riven Mordekaiser Camille Lux Sion Galio KSante Urgot Rumble Vi Yasuo Diana Malphite Taric".split(" "));
const CC = new Set("Leona Nautilus Morgana Lissandra Ashe Sejuani Amumu Malphite TwistedFate Veigar Annie Rell Thresh Blitzcrank Pyke Rakan Alistar Lux Zyra Neeko Vex Cassiopeia Skarner Maokai Zac JarvanIV Vi Warwick Nunu Poppy Rammus Braum Galio Ornn Sion Gragas MonkeyKing Kennen Orianna Hwei Syndra Fiddlesticks Nami Lulu Janna Bard Swain Varus Sett Taric".split(" "));
const HEAL_ITEMS = [3072, 3153, 3074, 4633, 3065, 3083, 6673, 6333, 6610, 3161];
const ARMOR_ITEMS = [3075, 3143, 3110, 3068, 3742, 6662, 3047, 3076, 6665];
const MR_ITEMS = [4401, 3065, 2504, 3091, 3156, 3111, 8020, 3102];

const isTank = (c: ChampionInfo) => c.tags.includes("Tank") || (c.info?.defense ?? 0) >= 7;
const isMagic = (c: ChampionInfo) => (c.info ? c.info.magic > c.info.attack : c.tags[0] === "Mage" || (c.tags[0] === "Support" && c.tags.includes("Mage")));

/** Item style that fits a champion (changeable in the UI). */
export function itemStyleFor(c: ChampionInfo | undefined | null): ItemStyle {
  if (!c) return "ad";
  if (c.tags[0] === "Marksman") return "adc";
  if (c.tags.includes("Tank") && c.tags[0] !== "Mage") return "tank";
  if (isMagic(c) || c.tags[0] === "Support") return "ap";
  return "ad";
}

export interface Threat {
  rule: ThreatRule;
  /** Enemy champions behind it. */
  championIds: number[];
}

export interface EnemyInput {
  champion: ChampionInfo;
  /** Items they own (live game only). */
  items?: number[];
}

/** What to react to this game, most important first. */
export function gameThreats(enemies: EnemyInput[]): Threat[] {
  const out: Threat[] = [];
  const push = (id: ThreatId, list: EnemyInput[], min: number) => {
    const ids = [...new Set(list.map((e) => e.champion.id))];
    if (ids.length >= min) out.push({ rule: THREATS[id], championIds: ids });
  };
  const owns = (e: EnemyInput, set: number[]) => (e.items ?? []).filter((i) => set.includes(i)).length;
  const damage = enemies.filter((e) => e.champion.tags[0] !== "Tank");

  push("heal", enemies.filter((e) => HEALERS.has(e.champion.key) || owns(e, HEAL_ITEMS) > 0), 1);
  push("burst", enemies.filter((e) => e.champion.tags[0] === "Assassin"), 2);
  push("ap", damage.filter((e) => isMagic(e.champion)), 3);
  push("ad", damage.filter((e) => !isMagic(e.champion)), 3);
  push("tanks", enemies.filter((e) => isTank(e.champion)), 2);
  push("cc", enemies.filter((e) => CC.has(e.champion.key)), 3);
  push("shields", enemies.filter((e) => SHIELDERS.has(e.champion.key)), 2);
  const armor = enemies.filter((e) => owns(e, ARMOR_ITEMS) > 0);
  if (enemies.reduce((s, e) => s + owns(e, ARMOR_ITEMS), 0) >= 3) push("armor", armor, 1);
  const mr = enemies.filter((e) => owns(e, MR_ITEMS) > 0);
  if (enemies.reduce((s, e) => s + owns(e, MR_ITEMS), 0) >= 3) push("mr", mr, 1);
  return out;
}

/** Threats that have an answer for this style, with its items. */
export function situationalFor(threats: Threat[], style: ItemStyle) {
  return threats.flatMap((t) => {
    const items = t.rule.items[style];
    return items?.length ? [{ ...t, items }] : [];
  });
}
