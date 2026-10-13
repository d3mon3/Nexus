"use client";

import { GAME_MODES, type GameModeId } from "@/lib/modes";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Game-mode switcher for builds and tier lists (Summoner's Rift, ARAM, ARAM Chaos, Arena, URF). */
export function ModeTabs({ value, onChange, className }: { value: GameModeId; onChange: (m: GameModeId) => void; className?: string }) {
  const t = useT();
  return (
    <div role="tablist" aria-label={t("Game mode")} className={cn("flex flex-wrap gap-1.5", className)}>
      {GAME_MODES.map((m) => (
        <button
          key={m.id}
          role="tab"
          aria-selected={value === m.id}
          onClick={() => onChange(m.id)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors",
            value === m.id ? "border-primary/70 bg-primary-soft text-fg shadow-[0_0_14px_-6px_var(--primary-glow)]" : "border-line bg-surface-2/60 text-muted hover:border-primary/40 hover:text-fg",
          )}
        >
          {t(m.label)}
        </button>
      ))}
    </div>
  );
}
