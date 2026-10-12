/**
 * Riot routing. "Platform" hosts (euw1, na1 …) serve Summoner, League, Spectator and
 * Champion-Mastery. "Regional" hosts (europe, americas …) serve Account-V1 and Match-V5.
 */

export type Platform =
  | "euw1"
  | "eun1"
  | "tr1"
  | "ru"
  | "me1"
  | "na1"
  | "br1"
  | "la1"
  | "la2"
  | "kr"
  | "jp1"
  | "oc1"
  | "sg2"
  | "tw2"
  | "vn2";

export type RegionalRoute = "europe" | "americas" | "asia" | "sea";

export interface RegionInfo {
  platform: Platform;
  /** Short label shown in the UI (EUW, NA …). */
  label: string;
  name: string;
  /** Routing value for Match-V5. */
  matchRoute: RegionalRoute;
  /** Routing value for Account-V1 (does not support "sea"). */
  accountRoute: Exclude<RegionalRoute, "sea">;
}

export const REGIONS: RegionInfo[] = [
  { platform: "euw1", label: "EUW", name: "Europe West", matchRoute: "europe", accountRoute: "europe" },
  { platform: "eun1", label: "EUNE", name: "Europe Nordic & East", matchRoute: "europe", accountRoute: "europe" },
  { platform: "tr1", label: "TR", name: "Türkiye", matchRoute: "europe", accountRoute: "europe" },
  { platform: "ru", label: "RU", name: "Russia", matchRoute: "europe", accountRoute: "europe" },
  { platform: "me1", label: "ME", name: "Middle East", matchRoute: "europe", accountRoute: "europe" },
  { platform: "na1", label: "NA", name: "North America", matchRoute: "americas", accountRoute: "americas" },
  { platform: "br1", label: "BR", name: "Brazil", matchRoute: "americas", accountRoute: "americas" },
  { platform: "la1", label: "LAN", name: "Latin America North", matchRoute: "americas", accountRoute: "americas" },
  { platform: "la2", label: "LAS", name: "Latin America South", matchRoute: "americas", accountRoute: "americas" },
  { platform: "kr", label: "KR", name: "Korea", matchRoute: "asia", accountRoute: "asia" },
  { platform: "jp1", label: "JP", name: "Japan", matchRoute: "asia", accountRoute: "asia" },
  { platform: "oc1", label: "OCE", name: "Oceania", matchRoute: "sea", accountRoute: "americas" },
  { platform: "sg2", label: "SEA", name: "Southeast Asia", matchRoute: "sea", accountRoute: "asia" },
  { platform: "tw2", label: "TW", name: "Taiwan", matchRoute: "sea", accountRoute: "asia" },
  { platform: "vn2", label: "VN", name: "Vietnam", matchRoute: "sea", accountRoute: "asia" },
];

const byPlatform = new Map(REGIONS.map((r) => [r.platform, r]));
const byLabel = new Map(REGIONS.map((r) => [r.label.toLowerCase(), r]));

export function isPlatform(value: string): value is Platform {
  return byPlatform.has(value as Platform);
}

/** Accepts "euw1", "EUW", "euw" … and returns the region, or undefined. */
export function resolveRegion(value: string | null | undefined): RegionInfo | undefined {
  if (!value) return undefined;
  const v = value.trim().toLowerCase();
  return byPlatform.get(v as Platform) ?? byLabel.get(v) ?? byPlatform.get(`${v}1` as Platform);
}

export function regionLabel(platform: string): string {
  return resolveRegion(platform)?.label ?? platform.toUpperCase();
}

export function platformHost(platform: Platform): string {
  return `https://${platform}.api.riotgames.com`;
}

export function regionalHost(route: RegionalRoute): string {
  return `https://${route}.api.riotgames.com`;
}

/**
 * Riot IDs are "GameName#TAG". In URLs we use "GameName-TAG" because "#" is a fragment.
 * Game names may contain spaces and dashes, so we split on the LAST dash/hash.
 */
export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const raw = decodeURIComponent(input).trim();
  const idx = Math.max(raw.lastIndexOf("#"), raw.lastIndexOf("-"));
  if (idx <= 0 || idx === raw.length - 1) return null;
  const gameName = raw.slice(0, idx).trim();
  const tagLine = raw.slice(idx + 1).trim();
  if (gameName.length < 3 || gameName.length > 16) return null;
  if (tagLine.length < 2 || tagLine.length > 5) return null;
  return { gameName, tagLine };
}

export function riotIdToSlug(gameName: string, tagLine: string): string {
  return encodeURIComponent(`${gameName}-${tagLine}`);
}

export function profileHref(platform: string, gameName: string, tagLine: string): string {
  return `/profile/${resolveRegion(platform)?.label.toLowerCase() ?? platform}/${riotIdToSlug(gameName, tagLine)}`;
}
