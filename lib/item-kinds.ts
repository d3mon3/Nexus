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
  maps?: Record<string, boolean>;
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
