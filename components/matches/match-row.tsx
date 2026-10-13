"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { compact, formatKda, kda, kdaColor, minutes, timeAgo } from "@/lib/format";
import type { MatchSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "../game/icons";
import { Tooltip } from "../ui/tooltip";
import { MatchDetailPanel } from "./match-detail";

function KdaLine({ k, d, a, size = "md" }: { k: number; d: number; a: number; size?: "md" | "lg" }) {
  return (
    <p className={cn("font-semibold tabular text-fg", size === "lg" ? "text-[15px]" : "text-[14px]")}>
      {k} <span className="text-dim">/</span> <span className="text-loss">{d}</span> <span className="text-dim">/</span> {a}
    </p>
  );
}

function Items({ items, trinket, size = 22 }: { items: number[]; trinket: number; size?: number }) {
  const all = [...items.slice(0, 6), trinket];
  return (
    <div className="grid w-max grid-cols-4 gap-[3px]">
      {all.map((id, i) => (
        <ItemIcon key={i} id={id} size={size} className={i === 6 ? "rounded-full" : undefined} />
      ))}
    </div>
  );
}

/**
 * One match. `compact` is the dashboard card row, `full` the match-history list row.
 * Clicking expands the full scoreboard (loaded lazily).
 */
export function MatchRow({ match, region, puuid, variant = "full", defaultOpen = false }: { match: MatchSummary; region: string; puuid: string; variant?: "compact" | "full"; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const me = match.me;
  const ratio = kda(me.kills, me.deaths, me.assists);
  const mins = Math.max(1, match.durationSec / 60);
  const win = me.win;
  const remake = match.durationSec < 300;
  const result = remake ? t("Remake") : win ? t("Victory") : t("Defeat");
  const tone = remake ? "text-muted" : win ? "text-victory" : "text-loss";
  const full = variant === "full";

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border transition-all duration-200",
        remake ? "border-line-soft bg-white/[0.02]" : win ? "border-[#1b2440] bg-[linear-gradient(90deg,rgba(54,92,190,0.22),rgba(30,40,80,0.18)_50%,rgba(14,19,38,0.6))]" : "border-[#2a1a2c] bg-[linear-gradient(90deg,rgba(190,50,90,0.2),rgba(60,25,45,0.25)_50%,rgba(24,20,34,0.6))]",
        "hover:border-primary/40 hover:shadow-[0_0_24px_-10px_var(--primary-glow)]",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", remake ? "bg-dim" : win ? "bg-win shadow-[0_0_8px_var(--win)]" : "bg-loss shadow-[0_0_8px_var(--loss)]")} />
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("{0} as {1}, {2}/{3}/{4}. Show details", [result, me.championName, me.kills, me.deaths, me.assists])}
        className={cn("flex w-full items-center text-left", full ? "justify-between gap-3 px-4 py-2.5 sm:gap-5" : "gap-3 py-1.5 pl-4 pr-2")}
      >
        <div className={cn("shrink-0", full ? "w-[78px]" : "w-[68px]")}>
          <p className={cn("text-[13px] font-semibold", tone)}>{result}</p>
          <p className="truncate text-[11px] text-muted">{full ? match.queueName.replace("Ranked Solo/Duo", "Ranked Solo") : timeAgo(match.gameCreation)}</p>
          {full && <p className="text-[11px] text-dim">{timeAgo(match.gameCreation)}</p>}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <ChampionIcon id={me.championId} size={full ? 46 : 36} />
          <div className="flex flex-col gap-[3px]">
            <SpellIcon id={me.spells[0]} size={full ? 21 : 17} />
            <SpellIcon id={me.spells[1]} size={full ? 21 : 17} />
          </div>
        </div>

        <div className={cn("shrink-0", full ? "w-[92px]" : "w-[84px]")}>
          <KdaLine k={me.kills} d={me.deaths} a={me.assists} size={full ? "lg" : "md"} />
          <p className={cn("text-[12px] font-semibold tabular", kdaColor(ratio))}>{formatKda(ratio)}{" " + t("KDA")}</p>
        </div>

        {full && (
          <div className="hidden w-[86px] shrink-0 md:block">
            <p className="text-[12px] text-fg tabular">
              {me.cs}{" " + t("CS") + " "}<span className="text-muted">({(me.cs / mins).toFixed(1)})</span>
            </p>
            <p className="text-[12px] text-muted tabular">{compact(me.gold)}{" " + t("Gold")}</p>
          </div>
        )}

        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          <Items items={me.items.items} trinket={me.items.trinket} size={full ? 23 : 18} />
          <span className="grid size-8 place-items-center rounded-full bg-black/30 ring-1 ring-white/10">
            <RuneIcon id={me.primaryRune} size={26} />
          </span>
        </div>

        {!full && (
          <div className="hidden w-[58px] shrink-0 xl:block">
            <p className="text-[12px] text-fg tabular">{me.cs}{" " + t("CS")}</p>
            <p className="text-[12px] text-muted tabular">{compact(me.gold)}</p>
          </div>
        )}

        <div className={cn("w-[64px] shrink-0 text-right", !full && "ml-auto")}>
          {match.lpChange !== null ? (
            <p className={cn("text-[13px] font-semibold tabular", match.lpChange >= 0 ? "text-win" : "text-loss")}>
              {match.lpChange >= 0 ? "+" : ""}
              {match.lpChange}{" " + t("LP")}</p>
          ) : (
            <Tooltip content={t("LP change is only shown when it can be determined reliably.")}>
              <p className="text-[13px] text-dim">{t("— LP")}</p>
            </Tooltip>
          )}
          <p className="text-[11px] text-muted tabular">{minutes(match.durationSec)}</p>
        </div>

        {full && <p className="hidden w-[96px] shrink-0 text-right text-[11px] text-secondary/90 xl:block">{match.queueId === 450 ? t("Howling Abyss") : t("Summoner's Rift")}</p>}
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform group-hover:text-fg", open && "rotate-180")} />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="overflow-hidden">
            <MatchDetailPanel matchId={match.matchId} region={region} puuid={puuid} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
