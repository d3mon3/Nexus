"use client";

import { Sparkles } from "lucide-react";
import { useMemo } from "react";
import { pct } from "@/lib/format";
import { t, useLanguage } from "@/lib/i18n";
import { useAugmentCatalog } from "@/lib/queries";
import type { AugmentInfo, AugmentStat } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TierBadge } from "../game/tier-badge";

const RARITY_RING = ["ring-[#b8c4d6]/50", "ring-[#f2b544]/60", "ring-[#c77dff]/70", "ring-[#ff6b9d]/70", "ring-[#4fd1ff]/70"];

export function useAugmentNames() {
  const { lang } = useLanguage();
  const q = useAugmentCatalog(lang);
  return useMemo(() => new Map((q.data ?? []).map((a) => [a.id, a])), [q.data]);
}

export function AugmentIcon({ info, size = 32 }: { info: AugmentInfo | undefined; size?: number }) {
  return info?.icon ? (
    <img src={info.icon} alt="" width={size} height={size} className={cn("shrink-0 rounded-md bg-black/40 ring-2", RARITY_RING[info.rarity] ?? RARITY_RING[0])} loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-md bg-surface-hover text-dim" style={{ width: size, height: size }}>
      <Sparkles className="size-4" />
    </span>
  );
}

/** Augments with tier, win rate (Arena: top-4 rate) and pick rate. */
export function AugmentList({ augments, limit, compact = false, arena = false }: { augments: AugmentStat[]; limit?: number; compact?: boolean; arena?: boolean }) {
  const names = useAugmentNames();
  const list = limit ? augments.slice(0, limit) : augments;
  if (!list.length) return <p className="text-sm text-muted">{t("Augment statistics are still being collected.")}</p>;
  return (
    <ul className={cn("grid gap-1.5", !compact && "sm:grid-cols-2")}>
      {list.map((a) => {
        const info = names.get(a.id);
        return (
          <li key={a.id} className="flex items-center gap-2.5 rounded-lg border border-line-soft bg-surface-2/40 px-2.5 py-1.5">
            <AugmentIcon info={info} size={compact ? 28 : 34} />
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{info?.name ?? `#${a.id}`}</span>
            <TierBadge tier={a.tier} size="sm" />
            <span className="w-12 text-right text-xs font-semibold tabular" title={arena ? t("Top-4 rate") : t("Win Rate")}>
              {pct(a.winRate)}
            </span>
            {!compact && <span className="w-16 text-right text-[11px] text-muted tabular">{t("{0} games", [a.games])}</span>}
          </li>
        );
      })}
    </ul>
  );
}
