import type { ChampionInfo } from "./types";

/**
 * Notable enemy items worth reacting to, grouped by what they mean for you.
 * Item ids are Data Dragon ids; unknown ids simply never match.
 */
export interface ItemAlertRule {
  id: string;
  title: string;
  tip: string;
  items: number[];
  /** Alert only when the enemy team owns at least this many matching items. */
  min?: number;
}

export const ITEM_ALERTS: ItemAlertRule[] = [
  { id: "stasis", title: "Stasis", tip: "Can go untargetable for 2.5 s — wait it out before using your key spells.", items: [3157, 2420, 2423] },
  { id: "spellshield", title: "Spell shield", tip: "Blocks the next ability — break it with a cheap spell first.", items: [3102, 3814] },
  { id: "cleanse", title: "Cleanse", tip: "Can remove your crowd control — chain CC or bait the cleanse first.", items: [3140, 3139, 6035] },
  { id: "antiheal", title: "Anti-heal", tip: "Your healing and shields from healing are reduced.", items: [3123, 3033, 3165, 3916, 3075, 3076, 6609, 3011] },
  { id: "sustain", title: "Heavy healing", tip: "This enemy heals a lot — anti-heal is worth buying.", items: [3072, 3153, 3074, 4633, 3065, 3083, 6673, 6333] },
  { id: "armor", title: "Armor stacking", tip: "Enemies stack armor — armor penetration (Lord Dominik's, Black Cleaver, Serylda's) pays off.", items: [3075, 3143, 3110, 3068, 3742, 6662, 3047], min: 3 },
  { id: "mr", title: "Magic resist stacking", tip: "Enemies stack magic resist — magic penetration (Void Staff, Cryptbloom) pays off.", items: [4401, 3065, 2504, 3091, 3156, 3111], min: 3 },
];

/** Anti-heal item that fits your champion's class. */
export function antiHealFor(me: ChampionInfo | undefined): number {
  const cls = me?.tags[0];
  if (cls === "Mage") return 3916; // Oblivion Orb
  if (cls === "Tank" || cls === "Support") return 3076; // Bramble Vest
  return 3123; // Executioner's Calling
}

export interface ItemAlert {
  rule: ItemAlertRule;
  /** Enemy champion name → matching item ids. */
  owners: { championName: string; items: number[] }[];
}

export function itemAlerts(enemies: { championName: string; items: number[] }[]): ItemAlert[] {
  const out: ItemAlert[] = [];
  for (const rule of ITEM_ALERTS) {
    const owners = enemies.map((e) => ({ championName: e.championName, items: e.items.filter((i) => rule.items.includes(i)) })).filter((o) => o.items.length);
    const total = owners.reduce((s, o) => s + o.items.length, 0);
    if (total >= (rule.min ?? 1)) out.push({ rule, owners });
  }
  return out;
}
