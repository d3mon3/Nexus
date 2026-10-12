import { TIER_COLOR, TIER_LABEL } from "@/lib/format";
import type { Tier } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Original NEXUS rank crest (not Riot's emblem art): a faceted gem whose wings grow
 * with the tier. Colour comes from the tier palette.
 */
export function RankEmblem({ tier, size = 72, className }: { tier: Tier | null; size?: number; className?: string }) {
  const color = tier ? TIER_COLOR[tier] : "#4b5270";
  const level = tier ? ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"].indexOf(tier) : -1;
  const id = `g-${tier ?? "none"}`;
  const wings = level >= 3;
  const big = level >= 6;
  return (
    <svg viewBox="0 0 120 100" width={size} height={(size * 100) / 120} className={cn("shrink-0 drop-shadow-[0_0_14px_rgba(145,97,255,0.45)]", className)} role="img" aria-label={tier ? TIER_LABEL[tier] : "Unranked"}>
      <defs>
        <linearGradient id={`${id}-a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.35" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.95" />
          <stop offset="1" stopColor="#1a1440" />
        </linearGradient>
      </defs>
      {wings && (
        <g fill={`url(#${id}-b)`} stroke={color} strokeOpacity="0.8" strokeWidth="1">
          <path d="M52 38 L14 18 L24 38 L6 34 L22 52 L12 56 L44 60 Z" />
          <path d="M68 38 L106 18 L96 38 L114 34 L98 52 L108 56 L76 60 Z" />
          {big && (
            <>
              <path d="M48 30 L30 4 L44 22 L40 6 Z" opacity="0.8" />
              <path d="M72 30 L90 4 L76 22 L80 6 Z" opacity="0.8" />
            </>
          )}
        </g>
      )}
      <path d="M60 10 L84 40 L60 92 L36 40 Z" fill={`url(#${id}-a)`} stroke="#fff" strokeOpacity="0.5" strokeWidth="1.2" />
      <path d="M60 10 L60 92 M36 40 L84 40 M60 10 L48 40 L60 92 L72 40 Z" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.8" />
      <circle cx="60" cy="44" r="6" fill="#fff" opacity="0.85" />
    </svg>
  );
}
