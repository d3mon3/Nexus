"use client";

import { ChevronRight } from "lucide-react";
import { useChampionDetail } from "@/lib/queries";
import { useStatic } from "@/lib/static-context";
import { GameImage } from "../game/game-image";
import { Tooltip } from "../ui/tooltip";

/** Ability icons in max order (Q → E → W) with the letter chain underneath. */
export function SkillPriorityIcons({ championId, priority, size = 38 }: { championId: number; priority: ("Q" | "W" | "E")[]; size?: number }) {
  const { champion } = useStatic();
  const detail = useChampionDetail(champion(championId)?.key);
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {priority.map((slot, i) => {
          const spell = detail.data?.spells.find((s) => s.slot === slot);
          return (
            <span key={slot} className="flex items-center gap-1.5">
              <Tooltip content={spell ? `${slot} — ${spell.name}` : slot}>
                <GameImage src={spell?.image} alt={spell?.name ?? slot} fallbackText={slot} style={{ width: size, height: size }} className="rounded-lg border border-primary/40 shadow-[0_0_12px_-4px_var(--primary-glow)]" />
              </Tooltip>
              {i < priority.length - 1 && <ChevronRight className="size-3.5 text-dim" />}
            </span>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted">
        {priority.map((s, i) => (
          <span key={s} className="flex items-center gap-1">
            <span className="rounded border border-line px-1.5 py-0.5 font-semibold text-fg/90">{s}</span>
            {i < priority.length - 1 && <ChevronRight className="size-3" />}
          </span>
        ))}
      </div>
    </div>
  );
}
