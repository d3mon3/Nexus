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

  const flex = profile.ranked.find((r) => r.queue === "RANKED_FLEX_SR");
  const artKey = main?.key;
  return (
    <section className="panel overflow-hidden" aria-label={`${account.gameName} profile`}>
      <div className="relative min-h-[150px]">
        {/* champion art on the right, blended into the glass */}
        {artKey && (
          <motion.div
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-y-0 right-0 w-full overflow-hidden sm:w-[72%] [mask-image:linear-gradient(90deg,transparent,black_35%)]"
            aria-hidden
          >
            <img src={asset.championCentered(artKey)} alt="" className="art-duotone h-full w-full object-cover object-[60%_22%]" onError={(e) => (e.currentTarget.style.display = "none")} />
            <div className="art-tint absolute inset-0" />
          </motion.div>
        )}
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(22,34,72,0.95)_25%,rgba(22,34,72,0.55)_55%,rgba(22,34,72,0.15))] light:bg-[linear-gradient(90deg,rgba(255,255,255,0.88)_28%,rgba(255,255,255,0.45)_55%,rgba(255,255,255,0.05))]" />

        <div className="relative flex flex-col gap-5 px-5 pb-3 pt-4 sm:flex-row sm:items-center">
          {/* avatar */}
          <div className="relative w-max shrink-0 self-start">
            <div className="size-[112px] rounded-full bg-[conic-gradient(from_200deg,#4f91ff,#8365ff,#4f91ff)] p-[3px] shadow-[0_0_26px_-4px_rgba(79,145,255,0.7)]">
              <span className="block size-full overflow-hidden rounded-full border-2 border-[#101a36] light:border-white">
                {main ? (
                  <GameImage src={asset.championLoading(main.key)} alt={`${account.gameName} avatar`} loading="eager" className="size-full scale-[1.6] object-[50%_14%] text-3xl" />
                ) : (
                  <ProfileIcon id={account.profileIconId} size={112} className="rounded-full" />
                )}
              </span>
            </div>
            <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-[#8fb6ff]/60 bg-[#162248] px-3 py-0.5 text-[14px] font-bold text-white shadow-[0_0_14px_-4px_var(--primary-glow)] tabular">{account.summonerLevel}</span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-[28px] font-bold tracking-tight text-fg">{account.gameName}</h1>
              <span className="text-lg text-muted">#{account.tagLine}</span>
              <SourceBadge source={source} note={note} className="ml-1" />
            </div>
            {/* small rounded tags */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Chip>
                <Radio className="size-3.5 text-primary" /> {regionLabel(account.platform)}
              </Chip>
              {solo && (
                <Chip>
                  <RankEmblem tier={solo.tier} size={18} /> {t("Solo")} · {rankLabel(solo.tier, solo.division)}
                </Chip>
              )}
              {flex && (
                <Chip>
                  <RankEmblem tier={flex.tier} size={18} /> {t("Flex")} · {rankLabel(flex.tier, flex.division)}
                </Chip>
              )}
              {main && (
                <Chip>
                  <ChampionIcon id={main.id} size={18} rounded="full" tooltip={false} /> {main.name}
                </Chip>
              )}
              {profile.ladder && (
                <Tooltip content={t("Ladder position · {0}", [profile.ladder.scope])}>
                  <span>
                    <Chip>
                      <span className="font-semibold text-primary">#{profile.ladder.position.toLocaleString("en-US")}</span>
                    </Chip>
                  </span>
                </Tooltip>
              )}
            </div>
          </div>

          {/* quote + actions on the right */}
          <div className="flex shrink-0 flex-col items-start gap-3 sm:items-end">
            <Motto value={motto} editable={isMine} onSave={(v) => update({ motto: v })} />
            <div className="flex items-center gap-2">
              <Link href={`/live?player=${encodeURIComponent(`${account.gameName}#${account.tagLine}`)}&region=${account.platform}`}>
                <Button variant="outline" className="h-10 rounded-xl border-[#8fb6ff]/40 bg-white/10 px-4 backdrop-blur">
                  <span className={cn("grid size-4 place-items-center rounded-full border-2 border-current", inGame && "animate-pulse-glow text-success")}>
                    <span className="size-1.5 rounded-full bg-current" />
                  </span>
                  {t("Live Game")}
                </Button>
              </Link>
              <MoreMenu player={player} onRefresh={onRefresh} refreshing={refreshing} />
            </div>
          </div>
        </div>
      </div>
      <div className="relative px-3 pb-2 sm:px-4">
        <div className="flex flex-wrap gap-1">
          {PROFILE_TABS.map((tt) => (
            <button
              key={tt.value}
              onClick={() => onTab(tt.value)}
              aria-pressed={tab === tt.value}
              className={cn(
                "relative rounded-xl px-4 py-2 text-[14px] transition",
                tab === tt.value
                  ? "border border-[#8fb6ff]/50 bg-[rgba(79,145,255,0.28)] font-semibold text-white shadow-[0_0_16px_-6px_rgba(79,145,255,0.8)] light:bg-white light:text-primary"
                  : "text-muted hover:bg-white/5 hover:text-fg",
              )}
            >
              {t(tt.label)}
              {tab === tt.value && <span className="absolute inset-x-4 -bottom-[3px] h-[2px] rounded-full bg-[#7fb0ff] shadow-[0_0_8px_#7fb0ff]" />}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="flex h-8 items-center gap-1.5 rounded-lg border border-[#9bb7ff]/30 bg-white/[0.07] px-2.5 text-[13px] font-medium text-fg backdrop-blur light:border-white light:bg-white/70">{children}</span>;
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
    <p className="flex max-w-[260px] items-center gap-2 text-right text-[14px] italic leading-snug text-fg/80">
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
