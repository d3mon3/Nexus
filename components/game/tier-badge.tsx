import type { TierGrade } from "@/lib/types";
import { cn } from "@/lib/utils";

export const GRADE_STYLE: Record<TierGrade, { text: string; bg: string; glow: string }> = {
  "S+": { text: "text-[#ff4d78]", bg: "bg-[#ff4d78]/12 border-[#ff4d78]/50", glow: "#ff4d78" },
  S: { text: "text-[#ff8a4c]", bg: "bg-[#ff8a4c]/12 border-[#ff8a4c]/50", glow: "#ff8a4c" },
  A: { text: "text-[#b28bff]", bg: "bg-[#9161ff]/12 border-[#9161ff]/50", glow: "#9161ff" },
  B: { text: "text-[#458cff]", bg: "bg-[#458cff]/12 border-[#458cff]/50", glow: "#458cff" },
  C: { text: "text-[#24d6a0]", bg: "bg-[#24d6a0]/12 border-[#24d6a0]/45", glow: "#24d6a0" },
  D: { text: "text-[#919ab7]", bg: "bg-white/5 border-white/15", glow: "#919ab7" },
};

export function TierBadge({ tier, size = "md", className }: { tier: TierGrade; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = GRADE_STYLE[tier];
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-md border font-black tracking-tight",
        s.bg,
        s.text,
        size === "sm" ? "h-5 min-w-6 px-1 text-[11px]" : size === "lg" ? "h-12 min-w-12 px-2 text-2xl" : "h-7 min-w-8 px-1.5 text-sm",
        className,
      )}
      style={{ textShadow: `0 0 12px ${s.glow}88` }}
    >
      {tier}
    </span>
  );
}
