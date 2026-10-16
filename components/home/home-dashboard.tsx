"use client";

import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { asset } from "@/lib/assets";
import { formatKda, pct, rankLabel, TIER_LABEL, timeAgo, winRate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useStatic } from "@/lib/static-context";
import { queueName } from "@/lib/static-data";
import type { MatchSummary, PlayerProfile, PlayerStats, RankedEntry } from "@/lib/types";
import { cn } from "@/lib/utils";
import { RankEmblem } from "../game/rank-emblem";
import { Card, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

/* ------------------------------------------------------------------ hero tiles */

const HERO_TILES = [
  { href: "/builds", title: "Builds & runes", text: "Every champion, every mode — imported for you in champion select.", art: "Ahri", tint: "from-[#2a2f8f]/90 via-[#4a4fd0]/45" },
  { href: "/tier-list", title: "Tier list", text: "Win, pick and ban rates from real ranked games.", art: "Jinx", tint: "from-[#8a1d4a]/90 via-[#d0436e]/40" },
  { href: "/live", title: "Live game", text: "Scout all ten players, then follow your game live.", art: "Yasuo", tint: "from-[#1e2a44]/90 via-[#3d5a8a]/40" },
] as const;

/** Three big feature tiles with champion art at the top of the home page. */
export function HeroTiles() {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {HERO_TILES.map((h) => (
        <Link key={h.href} href={h.href} className="hero-tile group block h-[150px]">
          <img
            src={asset.championCentered(h.art)}
            alt=""
            aria-hidden
            className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_25%] transition-transform duration-700 group-hover:scale-105"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
          <div className={cn("absolute inset-0 -z-10 bg-gradient-to-r to-transparent", h.tint)} />
          <div className="flex h-full flex-col justify-end p-5 text-white">
            <p className="text-[22px] font-extrabold uppercase leading-none tracking-wide drop-shadow">{t(h.title)}</p>
            <p className="mt-2 max-w-[230px] text-[13px] leading-snug text-white/85">{t(h.text)}</p>
          </div>
          <span className="absolute bottom-4 right-4 grid size-9 place-items-center rounded-xl border border-white/35 bg-white/15 text-white backdrop-blur-md transition group-hover:bg-white/30">
            <ArrowRight className="size-4" />
          </span>
        </Link>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ rank tiles */

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - ((v - min) / span) * 32}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-12 w-full overflow-visible" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RankTile({ title, entry, art, color, trend }: { title: string; entry: RankedEntry | undefined; art: string | undefined; color: string; trend: number[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative p-4">
        {art && (
          <img
            src={asset.championCentered(art)}
            alt=""
            aria-hidden
            className="absolute inset-y-0 right-0 -z-0 h-full w-[60%] object-cover object-[50%_20%] opacity-30 [mask-image:linear-gradient(90deg,transparent,black_60%)]"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        )}
        <p className="relative text-[15px] font-semibold text-fg">{t(title)}</p>
        <div className="relative mt-3 flex items-center gap-3">
          <RankEmblem tier={entry?.tier ?? null} size={64} />
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-fg">{entry ? (["MASTER", "GRANDMASTER", "CHALLENGER"].includes(entry.tier) ? t(TIER_LABEL[entry.tier]) : rankLabel(entry.tier, entry.division)) : t("Unranked")}</p>
            {entry && <p className="text-[13px] text-muted tabular">{entry.lp} LP</p>}
          </div>
        </div>
        <div className="relative mt-1 flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <Sparkline values={trend} color={color} />
          </div>
          {entry && (
            <p className="shrink-0 text-right text-[12px] leading-tight text-muted tabular">
              <span className="block font-semibold text-fg">{pct(winRate(entry))} WR</span>
              {entry.wins}W {entry.losses}L
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

/** Solo/Duo, Flex and recent form, each with a small trend line. */
export function RankTiles({ profile, stats }: { profile: PlayerProfile; stats: PlayerStats | undefined }) {
  const { champion } = useStatic();
  const solo = profile.ranked.find((r) => r.queue === "RANKED_SOLO_5x5");
  const flex = profile.ranked.find((r) => r.queue === "RANKED_FLEX_SR");
  const tl = stats?.timeline ?? [];
  const lp = tl.map((g) => g.cumulativeLp).filter((v): v is number => v !== null);
  const form = tl.map((g) => g.rollingWinRate);
  const arts = profile.mastery.slice(0, 3).map((m) => champion(m.championId)?.key);
  return (
    <div className="grid gap-3 md:grid-cols-3">
      <RankTile title="Ranked Solo/Duo" entry={solo} art={arts[0]} color="#4f5dff" trend={lp.length > 1 ? lp : form} />
      <RankTile title="Ranked Flex" entry={flex} art={arts[1]} color="#e5484d" trend={form} />
      <Card className="overflow-hidden p-4">
        <p className="text-[15px] font-semibold text-fg">{t("Recent form")}</p>
        {stats ? (
          <>
            <div className="mt-3 flex items-baseline gap-2">
              <span className={cn("text-[28px] font-bold tabular", stats.winRate >= 0.5 ? "text-win" : "text-loss")}>{pct(stats.winRate)}</span>
              <span className="text-[13px] text-muted">
                {stats.wins}W {stats.losses}L · {formatKda(stats.kda)} KDA
              </span>
            </div>
            <Sparkline values={form} color="#e09b12" />
            <p className="text-[12px] text-muted">{t("Last {0} games", [stats.games])}</p>
          </>
        ) : (
          <Skeleton className="mt-3 h-24" />
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ match strip */

/** Last matches as art cards (Victory / Defeat, KDA, queue, time). */
export function MatchStrip({ matches, loading, onViewAll }: { matches: MatchSummary[] | undefined; loading: boolean; onViewAll: () => void }) {
  const { champion } = useStatic();
  return (
    <Card>
      <CardHeader
        title="Recent Matches"
        action={
          <button onClick={onViewAll} className="flex items-center gap-1 text-[13px] font-medium text-primary hover:underline">
            {t("See all")} <ChevronRight className="size-3.5" />
          </button>
        }
      />
      <div className="grid gap-2.5 p-3 pt-1 sm:grid-cols-3 xl:grid-cols-5">
        {loading || !matches
          ? Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-[112px] rounded-2xl" />)
          : matches.slice(0, 5).map((m) => {
              const c = champion(m.me.championId);
              const remake = m.durationSec < 300;
              return (
                <div key={m.matchId} className="hero-tile h-[112px]">
                  {c && <img src={asset.championCentered(c.key)} alt="" aria-hidden className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_20%]" onError={(e) => (e.currentTarget.style.display = "none")} />}
                  <div className={cn("absolute inset-0 -z-10 bg-gradient-to-r", remake ? "from-[#3b4157]/95 to-[#3b4157]/40" : m.me.win ? "from-[#1f3b8f]/95 via-[#2f5bd0]/60 to-transparent" : "from-[#7a1430]/95 via-[#c23a5a]/55 to-transparent")} />
                  <div className="flex h-full flex-col justify-center gap-0.5 px-3.5 text-white">
                    <p className="text-[16px] font-extrabold leading-none">{remake ? t("Remake") : m.me.win ? t("Victory") : t("Defeat")}</p>
                    <p className="text-[15px] font-bold tabular">
                      {m.me.kills} / {m.me.deaths} / {m.me.assists}
                    </p>
                    <p className="truncate text-[11.5px] text-white/85">{t(queueName(m.queueId))}</p>
                    <p className="text-[11px] text-white/70">{timeAgo(m.gameCreation + m.durationSec * 1000)}</p>
                  </div>
                  {m.lpChange !== null && (
                    <span className={cn("absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-white tabular", m.lpChange >= 0 ? "bg-win/90" : "bg-loss/90")}>
                      {m.lpChange >= 0 ? "+" : ""}
                      {m.lpChange} LP
                    </span>
                  )}
                </div>
              );
            })}
      </div>
    </Card>
  );
}
