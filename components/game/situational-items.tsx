"use client";

import { ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { t } from "@/lib/i18n";
import { gameThreats, ITEM_STYLES, itemStyleFor, situationalFor, type EnemyInput, type ItemStyle } from "@/lib/situational";
import type { ChampionInfo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon, ItemIcon } from "./icons";

/**
 * Situational items for this game: what the enemy team does (healing, magic damage, tanks,
 * CC…) and what to buy against it — for AD, ADC, AP or tank builds. Starts on the style that
 * fits my champion; the tabs switch to the others.
 */
export function SituationalItems({ me, enemies, owned = [], compact = false, className }: { me: ChampionInfo | undefined | null; enemies: EnemyInput[]; owned?: number[]; compact?: boolean; className?: string }) {
  const auto = itemStyleFor(me);
  const [style, setStyle] = useState<ItemStyle>(auto);
  useEffect(() => setStyle(auto), [auto, me?.id]);
  const threats = useMemo(() => gameThreats(enemies), [enemies]);
  const rows = situationalFor(threats, style);
  const icon = compact ? 22 : 34;

  return (
    <div className={cn("space-y-2", className)}>
      <div role="radiogroup" aria-label={t("Build type")} className="inline-flex rounded-xl border border-line-soft bg-white/[0.04] p-0.5">
        {ITEM_STYLES.map((s) => (
          <button
            key={s.value}
            role="radio"
            aria-checked={style === s.value}
            onClick={() => setStyle(s.value)}
            className={cn(
              "rounded-lg font-semibold transition",
              compact ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs",
              style === s.value ? "bg-primary/90 text-white" : "text-muted hover:text-fg",
            )}
          >
            {t(s.label)}
            {s.value === auto && <span className="ml-0.5 opacity-70">•</span>}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={cn("text-muted", compact ? "text-[11px]" : "text-sm")}>{enemies.length ? t("Nothing special this game — follow the core build.") : t("Appears once enemy champions are known.")}</p>
      ) : (
        <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
          {rows.map((r) => (
            <div key={r.rule.id} className={cn("rounded-xl border border-line-soft bg-white/[0.03]", compact ? "px-2 py-1.5" : "p-3")}>
              <div className="flex items-center gap-1.5">
                <ShieldAlert className={cn("shrink-0 text-warning", compact ? "size-3" : "size-4")} />
                <span className={cn("font-semibold", compact ? "text-[11.5px]" : "text-sm")}>{t(r.rule.title)}</span>
                <span className="ml-auto flex -space-x-1">
                  {r.championIds.slice(0, 5).map((id) => (
                    <ChampionIcon key={id} id={id} size={compact ? 16 : 22} rounded="full" className="ring-1 ring-black/40" />
                  ))}
                </span>
              </div>
              {!compact && <p className="mt-1 text-xs text-muted">{t(r.rule.tip)}</p>}
              <div className={cn("flex flex-wrap gap-1.5", compact ? "mt-1" : "mt-2")}>
                {r.items.map((id) => (
                  <ItemIcon key={id} id={id} size={icon} className={cn(owned.includes(id) && "opacity-35 grayscale")} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
