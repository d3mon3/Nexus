import { useId } from "react";
import { cn } from "@/lib/utils";

/** NEXUS wordmark — hand-drawn spiky lettering with a violet gradient and neon bloom. */
export function Logo({ className, size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="60 40 820 330"
      role="img"
      aria-label="NEXUS — Stats Beyond The Game"
      className={cn("block w-auto overflow-visible", size === "md" ? "h-[38px]" : "h-[28px]", className)}
    >
      <defs>
        <linearGradient id={`nx-g-${id}`} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#c3b6ff" />
          <stop offset=".5" stopColor="#a183ff" />
          <stop offset="1" stopColor="#8455f2" />
        </linearGradient>
        <filter id={`nx-f-${id}`} x="-20%" y="-30%" width="140%" height="160%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feColorMatrix in="b" values="0 0 0 0 0.42  0 0 0 0 0.25  0 0 0 0 1  0 0 0 .8 0" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g fill={`url(#nx-g-${id})`} stroke={`url(#nx-g-${id})`} filter={`url(#nx-f-${id})`} transform="skewX(-4) translate(18 0)">
        <path stroke="none" d="M92 56 L152 152 L150 290 L84 356 L114 298 L112 160 Z" />
        <path stroke="none" d="M114 94 L150 102 L298 302 L302 344 L264 306 Z" />
        <path stroke="none" d="M272 154 L324 50 L308 148 L306 322 L296 348 L276 318 Z" />
        <path fill="none" strokeWidth="25" d="M446 152 C 418 132 370 134 354 162 C 336 194 338 258 362 280 C 386 302 430 298 450 284" />
        <path stroke="none" d="M354 204 L432 200 L438 216 L354 228 Z" />
        <path stroke="none" d="M454 136 L490 136 L582 300 L546 300 Z" />
        <path stroke="none" d="M610 88 L582 170 L384 342 L466 236 L538 168 Z" />
        <path fill="none" strokeWidth="25" d="M614 140 L614 250 C 614 294 684 308 706 266 L714 140" />
        <path fill="none" strokeWidth="25" d="M842 152 C 822 128 770 130 762 162 C 754 196 806 206 820 222 C 842 246 826 296 778 300 C 760 302 746 296 736 288" />
        <path stroke="none" d="M826 144 L860 84 L852 156 Z" />
        <path stroke="none" d="M750 290 L694 334 L758 272 Z" />
      </g>
    </svg>
  );
}
