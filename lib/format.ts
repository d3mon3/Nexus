import type { Division, RankedEntry, Role, Tier } from "./types";

export function kda(k: number, d: number, a: number): number {
  return d === 0 ? k + a : (k + a) / d;
}

export function formatKda(value: number): string {
  if (!Number.isFinite(value)) return "Perfect";
  return `${value.toFixed(2)}:1`;
}

export function pct(value: number, digits = 0): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(Math.round(n));
}

export function duration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function minutes(sec: number): string {
  return `${Math.round(sec / 60)} min`;
}

export function timeAgo(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.floor(d / 30);
  return `${mo} month${mo === 1 ? "" : "s"} ago`;
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export const TIER_LABEL: Record<Tier, string> = {
  IRON: "Iron",
  BRONZE: "Bronze",
  SILVER: "Silver",
  GOLD: "Gold",
  PLATINUM: "Platinum",
  EMERALD: "Emerald",
  DIAMOND: "Diamond",
  MASTER: "Master",
  GRANDMASTER: "Grandmaster",
  CHALLENGER: "Challenger",
};

export const TIER_COLOR: Record<Tier, string> = {
  IRON: "#7C6F6A",
  BRONZE: "#B07A4E",
  SILVER: "#A9B4C2",
  GOLD: "#E2B654",
  PLATINUM: "#4FC3B4",
  EMERALD: "#2ED37A",
  DIAMOND: "#8C7BFF",
  MASTER: "#C35CFF",
  GRANDMASTER: "#FF5470",
  CHALLENGER: "#5FD3FF",
};

export function rankLabel(tier: Tier, division: Division | null): string {
  const apex = tier === "MASTER" || tier === "GRANDMASTER" || tier === "CHALLENGER";
  return apex || !division ? TIER_LABEL[tier] : `${TIER_LABEL[tier]} ${division}`;
}

export function winRate(e: Pick<RankedEntry, "wins" | "losses">): number {
  const g = e.wins + e.losses;
  return g === 0 ? 0 : e.wins / g;
}

export const ROLE_LABEL: Record<Role, string> = {
  TOP: "Top",
  JUNGLE: "Jungle",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
};

/** Numeric value used to sort ranks. */
export function rankScore(tier: Tier, division: Division | null, lp: number): number {
  const tiers: Tier[] = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
  const div = { IV: 0, III: 1, II: 2, I: 3 }[division ?? "I"] ?? 3;
  return tiers.indexOf(tier) * 400 + (tiers.indexOf(tier) >= 7 ? 0 : div * 100) + lp;
}

export function kdaColor(value: number): string {
  if (value >= 4) return "text-[#439eee]";
  if (value >= 3) return "text-[var(--success)]";
  return "text-[var(--text)]/80";
}

export function wrColor(value: number): string {
  if (value >= 0.52) return "text-[var(--success)]";
  if (value < 0.48) return "text-[var(--danger)]";
  return "text-[var(--text)]";
}
