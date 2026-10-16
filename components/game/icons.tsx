"use client";


import { t } from "@/lib/i18n";
import { asset } from "@/lib/assets";
import { ITEMS, RUNE_STYLES, RUNES, SPELLS, STAT_SHARDS } from "@/lib/static-data";
import { useStatic } from "@/lib/static-context";
import { cn } from "@/lib/utils";
import { Tooltip } from "../ui/tooltip";
import { GameImage } from "./game-image";

type Size = number;

export function ChampionIcon({
  id,
  size = 40,
  className,
  rounded = "lg",
  tooltip = true,
  ring,
}: {
  id: number;
  size?: Size;
  className?: string;
  rounded?: "lg" | "full" | "md";
  tooltip?: boolean;
  ring?: "win" | "loss" | "primary";
}) {
  const { champion } = useStatic();
  const c = champion(id);
  const img = (
    <GameImage
      src={c ? asset.championIcon(c.key) : undefined}
      alt={c?.name ?? t("Champion {0}", [id])}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      className={cn(
        "shrink-0 border border-white/10",
        rounded === "full" ? "rounded-full" : rounded === "md" ? "rounded-md" : "rounded-xl",
        ring === "win" && "border-win/70 shadow-[0_0_10px_-2px_var(--win)]",
        ring === "loss" && "border-loss/70",
        ring === "primary" && "border-primary/80 shadow-[0_0_12px_-2px_var(--primary-glow)]",
        className,
      )}
    />
  );
  return tooltip && c ? <Tooltip content={c.name}>{img}</Tooltip> : img;
}

export function ItemIcon({ id, size = 26, className }: { id: number; size?: Size; className?: string }) {
  if (!id) return <span style={{ width: size, height: size }} className={cn("inline-block shrink-0 rounded-md border border-line-soft bg-white/[0.03]", className)} aria-hidden />;
  const name = ITEMS[id] ?? `Item ${id}`;
  return (
    <Tooltip content={name}>
      <GameImage src={asset.item(id)} alt={name} style={{ width: size, height: size, fontSize: size * 0.4 }} className={cn("shrink-0 rounded-md border border-white/10", className)} />
    </Tooltip>
  );
}

export function SpellIcon({ id, size = 22, className }: { id: number; size?: Size; className?: string }) {
  const name = SPELLS[id]?.name ?? `Spell ${id}`;
  return (
    <Tooltip content={name}>
      <GameImage src={asset.spell(id)} alt={name} style={{ width: size, height: size, fontSize: size * 0.42 }} className={cn("shrink-0 rounded-md border border-white/10", className)} />
    </Tooltip>
  );
}

export function RuneIcon({ id, size = 22, className, dim = false }: { id: number; size?: Size; className?: string; dim?: boolean }) {
  const { runeIcon } = useStatic();
  const def = RUNES.find((r) => r.id === id);
  const style = RUNE_STYLES.find((s) => s.id === id);
  const shard = STAT_SHARDS[id];
  const icon = runeIcon(id) ?? def?.icon ?? style?.icon ?? shard?.icon;
  const name = def?.name ?? style?.name ?? shard?.name ?? `Rune ${id}`;
  return (
    <Tooltip content={name}>
      <GameImage
        src={icon ? asset.rune(icon) : undefined}
        alt={name}
        style={{ width: size, height: size, fontSize: size * 0.4 }}
        className={cn("shrink-0 rounded-full object-contain", dim && "opacity-30 grayscale", className)}
      />
    </Tooltip>
  );
}

export function ProfileIcon({ id, size = 64, className }: { id: number; size?: Size; className?: string }) {
  return <GameImage src={asset.profileIcon(id)} alt={t("Profile icon")} style={{ width: size, height: size }} className={className} />;
}
