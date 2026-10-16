"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, Ellipsis, History, Pencil, Radio, RefreshCw, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { asset } from "@/lib/assets";
import { rankLabel } from "@/lib/format";
import { regionLabel } from "@/lib/regions";
import { useSettings, type PlayerRef } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { DataSource, PlayerProfile } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GameImage } from "../game/game-image";
import { ChampionIcon, ProfileIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { SourceBadge } from "../game/source-badge";
import { Button } from "../ui/button";
import { Tabs } from "../ui/tabs";
import { Tooltip } from "../ui/tooltip";

export const PROFILE_TABS = [
  { value: "overview", label: "Overview" },
  { value: "champions", label: "Champions" },
  { value: "matches", label: "Match History" },
  { value: "live", label: "Live Game" },
  { value: "statistics", label: "Statistics" },
  { value: "builds", label: "Runes & Builds" },
  { value: "trends", label: "Trends" },
] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number]["value"];

export function ProfileBanner({
  profile,
  player,
  source,
  note,
  tab,
  onTab,
  inGame,
  onRefresh,
  refreshing,
  isMine,
}: {
  profile: PlayerProfile;
  player: PlayerRef;
  source: DataSource;
  note?: string;
  tab: ProfileTab;
  onTab: (t: ProfileTab) => void;
  inGame: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  isMine: boolean;
}) {
  const { champion } = useStatic();
  const { settings, update } = useSettings();
  const { account } = profile;
  const solo = profile.ranked.find((r) => r.queue === "RANKED_SOLO_5x5");
  const main = profile.mainChampionId ? champion(profile.mainChampionId) : undefined;
  const favChamps = profile.mastery.map((m) => m.championId).slice(0, 4);
  const extra = Math.max(0, profile.mastery.length - 4);
  const motto = isMine ? settings.motto : profile.motto;

  return (
    <section className="panel overflow-hidden" aria-label={`${account.gameName} profile`}>
      <div className="relative min-h-[198px]">
        {/* cinematic art — violet duotone like the NEXUS key art */}
        {main && (
          <motion.div
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-y-0 right-0 w-full overflow-hidden sm:w-[76%] [mask-image:linear-gradient(90deg,transparent,black_30%)]"
            aria-hidden
          >
            <img src={asset.championSplash(main.key)} alt="" className="art-duotone h-full w-full object-cover object-[60%_22%]" onError={(e) => (e.currentTarget.style.display = "none")} />
            <div className="art-tint absolute inset-0" />
            <div className="absolute inset-0 bg-[radial-gradient(60%_90%_at_70%_35%,rgba(160,110,255,0.35),transparent_70%)] mix-blend-screen" />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,#0b1020_22%,rgba(11,16,32,0.55)_45%,rgba(11,16,32,0.05)_75%)] light:bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_28%,rgba(255,255,255,0.45)_55%,rgba(255,255,255,0.05))]" />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0d1324] to-transparent light:from-white/70" />

        <div className="relative flex flex-col gap-5 p-5 sm:flex-row sm:px-6 sm:pb-3 sm:pt-5">
          <div className="relative w-max shrink-0 self-start">
            <div className="glow-border relative size-[124px] overflow-hidden rounded-2xl p-[3px] light:rounded-full light:border-[3px] light:border-white light:p-0 light:shadow-[0_0_0_3px_rgba(120,110,255,0.45),0_12px_30px_-10px_rgba(64,76,160,0.6)]">
              {main ? (
                <span className="relative block size-full overflow-hidden rounded-[13px] light:rounded-full">
                  <GameImage src={asset.championLoading(main.key)} alt={`${account.gameName} avatar`} loading="eager" className="art-duotone size-full scale-[1.6] object-[50%_14%] text-3xl" />
                  <span className="art-tint absolute inset-0" aria-hidden />
                  <span className="absolute inset-0 bg-[radial-gradient(circle_at_60%_40%,rgba(190,150,255,0.35),transparent_65%)] mix-blend-screen" aria-hidden />
                </span>
              ) : (
                <ProfileIcon id={account.profileIconId} size={128} className="rounded-[13px]" />
              )}
            </div>
            <span className="absolute -bottom-1 -right-2 rounded-lg border border-primary/60 bg-[#0d1226] px-2 py-0.5 text-[15px] font-bold text-fg shadow-[0_0_14px_-3px_var(--primary-glow)] tabular light:-bottom-2 light:left-1/2 light:right-auto light:-translate-x-1/2 light:rounded-full light:border-white light:bg-[#1c2348] light:px-3 light:text-white">{account.summonerLevel}</span>
          </div>

          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[24px] font-bold tracking-tight text-fg">{account.gameName}</h1>
              <span className="text-lg text-muted">#{account.tagLine}</span>
              <Tooltip content={solo ? rankLabel(solo.tier, solo.division) : t("Unranked")}>
                <RankEmblem tier={solo?.tier ?? null} size={30} />
              </Tooltip>
              <SourceBadge source={source} note={note} className="ml-1" />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-fg/90">
              <span className="flex items-center gap-1.5">
                <Radio className="size-3.5 text-primary" />
                {regionLabel(account.platform)}
              </span>
              <span className="h-4 w-px bg-line" />
              <span>{t("Level") + " "}{account.summonerLevel}</span>
              {profile.ladder && (
                <>
                  <span className="h-4 w-px bg-line" />
                  <Tooltip content={t("Ladder position · {0}", [profile.ladder.scope])}>
                    <span>
                      <span className="font-semibold text-primary">#{profile.ladder.position.toLocaleString("en-US")}</span>
                      {profile.ladder.topPercent !== null && <span className="text-muted">{" " + t("(Top") + " "}{profile.ladder.topPercent}%)</span>}
                    </span>
                  </Tooltip>
                </>
              )}
            </div>
            {main && (
              <p className="mt-2 flex items-center gap-2 text-[14px] text-fg/90">
                <ChampionIcon id={main.id} size={24} rounded="full" />{" " + t("Main:") + " "}{main.name}
              </p>
            )}
            <Motto value={motto} editable={isMine} onSave={(v) => update({ motto: v })} />

            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <Link href={`/live?player=${encodeURIComponent(`${account.gameName}#${account.tagLine}`)}&region=${account.platform}`}>
                <Button variant="primary" className="h-10 px-5">
                  <span className={cn("grid size-4 place-items-center rounded-full border-2 border-white/90", inGame && "animate-pulse-glow")}>
                    <span className="size-1.5 rounded-full bg-white" />
                  </span>{t("Live Game")}</Button>
              </Link>
              <MoreMenu player={player} onRefresh={onRefresh} refreshing={refreshing} />
            </div>
          </div>

          <div className="hidden self-end md:block">
            <p className="mb-2 text-xs font-medium text-fg/80">{t("Top champions")}</p>
            <div className="flex items-center gap-2">
              {favChamps.map((id) => (
                <ChampionIcon key={id} id={id} size={50} className="border-primary/40 transition-transform hover:-translate-y-0.5 hover:border-primary" />
              ))}
              {extra > 0 && (
                <button onClick={() => onTab("champions")} className="grid size-[50px] place-items-center rounded-lg border border-line bg-black/30 text-sm text-fg/80 hover:border-primary">
                  +{extra}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="relative border-t border-line-soft/60 px-3 sm:px-5">
        <Tabs value={tab} onChange={onTab} items={PROFILE_TABS.map((tt) => ({ value: tt.value, label: t(tt.label) }))} label={t("Profile sections")} className="[&_button]:pb-2.5 [&_button]:pt-1.5" />
      </div>
    </section>
  );
}

function Motto({ value, editable, onSave }: { value?: string; editable: boolean; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);
  if (!value && !editable) return null;
  if (editing)
    return (
      <form
        className="mt-2 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(draft.slice(0, 60));
          setEditing(false);
        }}
      >
        <input ref={ref} value={draft} maxLength={60} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(false)} className="w-72 rounded-md border border-primary/50 bg-black/30 px-2 py-1 text-sm text-fg outline-none" aria-label={t("Profile motto")} />
        <button type="submit" onMouseDown={(e) => e.preventDefault()} className="text-success" aria-label={t("Save motto")}>
          <Check className="size-4" />
        </button>
      </form>
    );
  return (
    <p className="mt-2 flex items-center gap-2 text-[13.5px] text-fg/75">
      “{value || t("Add a motto")}”
      {editable && (
        <button onClick={() => { setDraft(value ?? ""); setEditing(true); }} aria-label={t("Edit motto")} className="text-dim hover:text-primary">
          <Pencil className="size-3.5" />
        </button>
      )}
    </p>
  );
}

function MoreMenu({ player, onRefresh, refreshing }: { player: PlayerRef; onRefresh: () => void; refreshing: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const item = (icon: ReactNode, label: string, fn: () => void) => (
    <button
      role="menuitem"
      onClick={() => {
        fn();
        setOpen(false);
      }}
      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-fg/90 hover:bg-surface-hover"
    >
      {icon}
      {t(label)}
    </button>
  );
  const riotId = `${player.gameName}#${player.tagLine}`;
  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="icon" className="size-10" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("More actions")}>
        <Ellipsis />
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div role="menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className="panel absolute left-0 z-50 mt-2 w-52 p-1.5">
            {item(<RefreshCw className={cn("size-4", refreshing && "animate-spin")} />, "Refresh data", onRefresh)}
            {item(<Copy className="size-4" />, "Copy Riot ID", () => {
              navigator.clipboard?.writeText(riotId).then(() => toast.success(t("Riot ID copied"), { description: riotId }));
            })}
            <Link role="menuitem" href={`/matches?player=${encodeURIComponent(riotId)}&region=${player.platform}`} className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg/90 hover:bg-surface-hover">
              <History className="size-4" />{" " + t("Full match history")}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
