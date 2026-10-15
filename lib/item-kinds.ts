/**
 * Item classes from Data Dragon item.json (works for every patch, unlike a hand-made list).
 */
export type ItemKind = "boots" | "core" | "starter" | "component" | "consumable" | "other";

export interface DdItem {
  gold: { total: number; purchasable?: boolean };
  tags?: string[];
  into?: string[];
  from?: string[];
  consumed?: boolean;
}

export function classifyItem(id: number, it: DdItem | undefined): ItemKind {
  if (!it) return "other";
  const tags = it.tags ?? [];
  if (tags.includes("Consumable") || tags.includes("Trinket") || it.consumed) return "consumable";
  if (tags.includes("Boots")) return id === 1001 ? "component" : "boots";
  const into = it.into ?? [];
  if (!it.from?.length && it.gold.total <= 500) return "starter";
  if (into.length === 0 && it.gold.total >= 2000) return "core";
  if (into.length > 0) return "component";
  return "other";
}

export function classifyAll(data: Record<string, DdItem>): Record<number, ItemKind> {
  const out: Record<number, ItemKind> = {};
  for (const [id, it] of Object.entries(data)) {
    // Items that only "upgrade" into things you can't buy (Manamune → Muramana, Ornn masterworks)
    // are finished items too.
    const buyableInto = (it.into ?? []).filter((t) => data[t]?.gold.purchasable !== false);
    out[Number(id)] = classifyItem(Number(id), { ...it, into: buyableInto });
  }
  return out;
}

/** Build style of one player from their finished items (first three count most). */
export type BuildStyle = "ap" | "crit" | "onhit" | "lethality" | "bruiser" | "tank" | "ad";

export const BUILD_STYLE_LABEL: Record<BuildStyle, string> = {
  ap: "AP",
  crit: "Crit",
  onhit: "On-hit / attack speed",
  lethality: "Lethality",
  bruiser: "Bruiser",
  tank: "Tank",
  ad: "AD",
};

export function buildStyle(core: number[], tagsOf: (id: number) => string[] | undefined): BuildStyle | null {
  const items = core.slice(0, 3).map((id) => tagsOf(id) ?? []);
  if (items.length < 2) return null;
  const n = items.length;
  const count = (f: (t: string[]) => boolean) => items.filter(f).length;
  const has = (t: string[], ...xs: string[]) => xs.some((x) => t.includes(x));
  const ap = count((t) => has(t, "SpellDamage"));
  const dmg = count((t) => has(t, "Damage", "CriticalStrike", "AttackSpeed", "ArmorPenetration", "OnHit"));
  if (ap >= Math.ceil(n / 2) && ap > dmg - ap) return "ap";
  if (count((t) => has(t, "CriticalStrike")) >= 2) return "crit";
  if (count((t) => has(t, "OnHit") || (has(t, "AttackSpeed") && !has(t, "CriticalStrike"))) >= 2) return "onhit";
  if (count((t) => has(t, "ArmorPenetration")) >= 2) return "lethality";
  if (count((t) => has(t, "Health", "Armor", "SpellBlock") && !has(t, "Damage", "SpellDamage", "CriticalStrike", "AttackSpeed")) >= 2) return "tank";
  if (count((t) => has(t, "Damage") && has(t, "Health", "Armor", "SpellBlock")) >= 2) return "bruiser";
  return dmg >= 2 ? "ad" : null;
}
