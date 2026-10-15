import "server-only";
import { z } from "zod";
import { DDRAGON, FALLBACK_CHAMPIONS, FALLBACK_DDRAGON_VERSION, RUNES } from "@/lib/static-data";
import type { AugmentInfo, ChampionInfo, Role } from "@/lib/types";
import { classifyAll, type ItemKind } from "@/lib/item-kinds";

export interface ItemCatalog {
  kinds: Record<number, ItemKind>;
  tags: Record<number, string[]>;
}
import { cached, TTL } from "./cache";

/**
 * Data Dragon is public (no key). We fetch the latest version, the champion list and
 * the rune tree, merging them over the embedded fallback so offline launches still work.
 */

export interface StaticBundle {
  version: string;
  champions: ChampionInfo[];
  runeIcons: Record<number, string>;
  source: "ddragon" | "embedded";
}

const versionsSchema = z.array(z.string());
const championsSchema = z.object({
  data: z.record(
    z.object({
      key: z.string(),
      id: z.string(),
      name: z.string(),
      title: z.string(),
      tags: z.array(z.string()),
      info: z.object({ attack: z.number(), defense: z.number(), magic: z.number() }).partial().optional(),
    }),
  ),
});
const runesSchema = z.array(
  z.object({
    id: z.number(),
    icon: z.string(),
    slots: z.array(z.object({ runes: z.array(z.object({ id: z.number(), icon: z.string() })) })),
  }),
);

async function getJson<T>(url: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(url, { next: { revalidate: TTL.ddragon } } as RequestInit);
  if (!res.ok) throw new Error(`Data Dragon ${res.status} for ${url}`);
  return schema.parse(await res.json());
}

const TAG_ROLES: Record<string, Role[]> = {
  Marksman: ["BOTTOM"],
  Support: ["UTILITY"],
  Mage: ["MIDDLE"],
  Assassin: ["MIDDLE"],
  Fighter: ["TOP"],
  Tank: ["TOP"],
};

export function getStaticBundle(): Promise<StaticBundle> {
  return cached("ddragon:bundle", TTL.ddragon, async () => {
    try {
      const versions = await getJson(`${DDRAGON}/api/versions.json`, versionsSchema);
      const version = versions[0] ?? FALLBACK_DDRAGON_VERSION;
      const [champs, runes] = await Promise.all([
        getJson(`${DDRAGON}/cdn/${version}/data/en_US/champion.json`, championsSchema),
        getJson(`${DDRAGON}/cdn/${version}/data/en_US/runesReforged.json`, runesSchema).catch(() => []),
      ]);
      const fallbackById = new Map(FALLBACK_CHAMPIONS.map((c) => [c.id, c]));
      const champions: ChampionInfo[] = Object.values(champs.data)
        .map((c) => {
          const id = Number(c.key);
          const known = fallbackById.get(id);
          return {
            id,
            key: c.id,
            name: c.name,
            title: c.title,
            tags: c.tags,
            info: c.info?.attack != null && c.info.magic != null ? { attack: c.info.attack, defense: c.info.defense ?? 0, magic: c.info.magic } : undefined,
            // Data Dragon has no positions; prefer curated roles, else derive from class tags.
            roles: known?.roles ?? TAG_ROLES[c.tags[0]] ?? ["MIDDLE"],
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const runeIcons: Record<number, string> = {};
      for (const style of runes) {
        runeIcons[style.id] = style.icon;
        for (const slot of style.slots) for (const r of slot.runes) runeIcons[r.id] = r.icon;
      }
      return { version, champions, runeIcons, source: "ddragon" as const };
    } catch (err) {
      console.warn("[nexus] Data Dragon unreachable, using embedded data:", String(err));
      return embeddedBundle();
    }
  });
}

const itemsSchema = z.object({
  data: z.record(
    z
      .object({
        gold: z.object({ total: z.number(), purchasable: z.boolean().optional() }),
        tags: z.array(z.string()).optional(),
        into: z.array(z.string()).optional(),
        from: z.array(z.string()).optional(),
        consumed: z.boolean().optional(),
      })
      .passthrough(),
  ),
});

/** Item classes and stat tags for the latest patch. Empty if Data Dragon is unreachable. */
export function getItemCatalog(): Promise<ItemCatalog> {
  return cached("ddragon:item-catalog", TTL.ddragon, async () => {
    try {
      const versions = await getJson(`${DDRAGON}/api/versions.json`, versionsSchema);
      const items = await getJson(`${DDRAGON}/cdn/${versions[0] ?? FALLBACK_DDRAGON_VERSION}/data/en_US/item.json`, itemsSchema);
      const tags: Record<number, string[]> = {};
      for (const [id, it] of Object.entries(items.data)) tags[Number(id)] = it.tags ?? [];
      return { kinds: classifyAll(items.data), tags };
    } catch {
      return { kinds: {}, tags: {} };
    }
  });
}

/** id → item class (boots / finished item / starter / component …). */
export async function getItemKinds(): Promise<Record<number, ItemKind>> {
  return (await getItemCatalog()).kinds;
}

const augmentsSchema = z.object({
  augments: z.array(
    z
      .object({ id: z.number(), name: z.string(), iconLarge: z.string().optional(), iconSmall: z.string().optional(), rarity: z.number().optional() })
      .passthrough(),
  ),
});

/** Arena / ARAM Mayhem augment names and icons (CommunityDragon). Empty if unreachable. */
export function getAugmentCatalog(lang: "en_us" | "pl_pl" = "en_us"): Promise<AugmentInfo[]> {
  return cached(`cdragon:augments:${lang}`, TTL.ddragon, async () => {
    try {
      const data = await getJson(`https://raw.communitydragon.org/latest/cdragon/arena/${lang}.json`, augmentsSchema);
      return data.augments.map((a) => {
        const icon = a.iconLarge || a.iconSmall;
        return { id: a.id, name: a.name, rarity: a.rarity ?? 0, icon: icon ? `https://raw.communitydragon.org/latest/game/${icon.toLowerCase()}` : null };
      });
    } catch {
      return [];
    }
  });
}

export function embeddedBundle(): StaticBundle {
  return {
    version: FALLBACK_DDRAGON_VERSION,
    champions: [...FALLBACK_CHAMPIONS].sort((a, b) => a.name.localeCompare(b.name)),
    runeIcons: Object.fromEntries(RUNES.map((r) => [r.id, r.icon])),
    source: "embedded",
  };
}

const championDetailSchema = z.object({
  data: z.record(
    z.object({
      id: z.string(),
      name: z.string(),
      title: z.string(),
      lore: z.string().optional(),
      tags: z.array(z.string()).default([]),
      spells: z.array(z.object({ id: z.string(), name: z.string(), image: z.object({ full: z.string() }) })),
      passive: z.object({ name: z.string(), image: z.object({ full: z.string() }) }),
    }),
  ),
});

export interface ChampionDetail {
  key: string;
  name: string;
  title: string;
  lore: string;
  tags: string[];
  passive: { name: string; image: string } | null;
  spells: { slot: "Q" | "W" | "E" | "R"; name: string; image: string }[];
}

/** Ability names and icon paths for one champion (Data Dragon `champion/<key>.json`). */
export function getChampionDetail(key: string): Promise<ChampionDetail> {
  return cached(`ddragon:champ:${key}`, TTL.ddragon, async () => {
    const { version, champions } = await getStaticBundle();
    const known = champions.find((c) => c.key.toLowerCase() === key.toLowerCase());
    const fallback: ChampionDetail = { key: known?.key ?? key, name: known?.name ?? key, title: known?.title ?? "", lore: "", tags: known?.tags ?? [], passive: null, spells: [] };
    if (!known) return fallback;
    try {
      const json = await getJson(`${DDRAGON}/cdn/${version}/data/en_US/champion/${known.key}.json`, championDetailSchema);
      const c = Object.values(json.data)[0];
      const slots = ["Q", "W", "E", "R"] as const;
      return {
        key: c.id,
        name: c.name,
        title: c.title,
        lore: c.lore ?? "",
        tags: c.tags,
        passive: { name: c.passive.name, image: `${DDRAGON}/cdn/${version}/img/passive/${c.passive.image.full}` },
        spells: c.spells.slice(0, 4).map((s, i) => ({ slot: slots[i], name: s.name, image: `${DDRAGON}/cdn/${version}/img/spell/${s.image.full}` })),
      };
    } catch {
      return fallback;
    }
  });
}
