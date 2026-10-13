import type { ChampionInfo } from "./types";

/**
 * Quick team-composition checks for champion select, from Data Dragon class tags and
 * attack/magic ratings. Only coarse, well-known signals: damage type and frontline.
 */
export interface CompWarning {
  id: "all-ad" | "all-ap" | "no-frontline" | "enemy-ad" | "enemy-ap";
  tone: "bad" | "info";
  text: string;
}

/** Share of magic damage for one champion, 0 (pure AD) … 1 (pure AP). */
export function apShare(c: ChampionInfo): number {
  if (c.info && c.info.attack + c.info.magic > 0) {
    const s = c.info.magic / (c.info.attack + c.info.magic);
    return c.tags[0] === "Mage" ? Math.max(s, 0.75) : c.tags[0] === "Marksman" ? Math.min(s, 0.3) : s;
  }
  if (c.tags[0] === "Mage") return 0.85;
  if (c.tags[0] === "Marksman" || c.tags[0] === "Assassin") return 0.25;
  return 0.4;
}

export function isFrontline(c: ChampionInfo): boolean {
  return c.tags.includes("Tank") || (c.tags[0] === "Fighter" && (c.info?.defense ?? 0) >= 6);
}

export function damageProfile(team: ChampionInfo[]): { ap: number; ad: number } {
  if (!team.length) return { ap: 0, ad: 0 };
  const ap = team.reduce((s, c) => s + apShare(c), 0) / team.length;
  return { ap, ad: 1 - ap };
}

export function compWarnings(mine: ChampionInfo[], enemies: ChampionInfo[]): CompWarning[] {
  const out: CompWarning[] = [];
  if (mine.length >= 4) {
    const { ap } = damageProfile(mine);
    const apCount = mine.filter((c) => apShare(c) >= 0.55).length;
    if (apCount === 0 || ap < 0.22) out.push({ id: "all-ad", tone: "bad", text: "Your team deals almost only physical damage — enemies can stack armor." });
    else if (apCount === mine.length || ap > 0.78) out.push({ id: "all-ap", tone: "bad", text: "Your team deals almost only magic damage — enemies can stack magic resist." });
    if (!mine.some(isFrontline)) out.push({ id: "no-frontline", tone: "bad", text: "No tank or frontline on your team — consider a tankier pick or build." });
  }
  if (enemies.length >= 3) {
    const { ap } = damageProfile(enemies);
    if (ap > 0.68) out.push({ id: "enemy-ap", tone: "info", text: "Enemies deal mostly magic damage — magic resist items are worth more this game." });
    else if (ap < 0.3) out.push({ id: "enemy-ad", tone: "info", text: "Enemies deal mostly physical damage — armor items are worth more this game." });
  }
  return out;
}
