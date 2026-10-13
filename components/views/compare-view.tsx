"use client";


import { t } from "@/lib/i18n";
import { ArrowLeftRight, Trophy } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { compact, formatKda, pct, rankLabel } from "@/lib/format";
import { usePlayerStats, useProfile } from "@/lib/queries";
import { regionLabel } from "@/lib/regions";
import type { PlayerRef } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { PlayerProfile, PlayerStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { StatRadar } from "../charts/radar-chart";
import { TrendChart } from "../charts/trend-chart";
import { ChampionIcon, ProfileIcon } from "../game/icons";
import { RankEmblem } from "../game/rank-emblem";
import { Button } from "../ui/button";
import { Card, CardBody, CardHeader } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { PlayerPicker, usePlayerParam } from "./player-picker";

const A = "#9161FF";
const B = "#24D6A0";

function usePlayerData(player: PlayerRef | null) {
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;
  const stats = usePlayerStats(player?.platform, puuid, 20);
  return { profile, stats };
}

export function CompareView() {
  const [a, setA] = usePlayerParam();
  const [b, setB] = usePlayerParam("vs");
  const da = usePlayerData(a);
  const db = usePlayerData(b);
  const sa = da.stats.data?.data;
  const sb = db.stats.data?.data;
  const swap = () => {
    if (a && b) {
      setA(b);
      setTimeout(() => setB(a), 0);
    }
  };
  return (
    <div>
      <PageHeader
        title={t("Player Comparison")}
        description={t("Head-to-head across the last 20 games of each player.")}
        actions={
          <Button variant="outline" size="sm" onClick={swap} disabled={!a || !b}>
            <ArrowLeftRight />{" " + t("Swap")}</Button>
        }
      />
      <div className="mb-3 grid gap-3 lg:grid-cols-2">
        <PlayerPicker player={a} onChange={setA} label={t("Player A")} />
        <PlayerPicker player={b} onChange={setB} label={t("Player B")} />
      </div>
      {!b ? (
        <Card>
          <EmptyState icon={<ArrowLeftRight />} title={t("Pick a second player")} description={t("Enter a Riot ID for Player B — or pick one of your favorites.")} />
        </Card>
      ) : da.profile.error || db.profile.error ? (
        <Card>
          <ErrorState error={da.profile.error ?? db.profile.error} />
        </Card>
      ) : !sa || !sb || !da.profile.data || !db.profile.data ? (
        <Skeleton className="h-[520px] rounded-[14px]" />
      ) : (
        <Comparison pa={da.profile.data.data} pb={db.profile.data.data} sa={sa} sb={sb} />
      )}
    </div>
  );
}

function Comparison({ pa, pb, sa, sb }: { pa: PlayerProfile; pb: PlayerProfile; sa: PlayerStats; sb: PlayerStats }) {
  const { champion } = useStatic();
  const metrics: { label: string; a: number; b: number; fmt: (v: number) => string; lowerIsBetter?: boolean }[] = [
    { label: "Win rate", a: sa.winRate, b: sb.winRate, fmt: (v) => pct(v) },
    { label: "KDA", a: sa.kda, b: sb.kda, fmt: formatKda },
    { label: "Deaths / game", a: sa.avgDeaths, b: sb.avgDeaths, fmt: (v) => v.toFixed(1), lowerIsBetter: true },
    { label: "Kill participation", a: sa.killParticipation, b: sb.killParticipation, fmt: (v) => pct(v) },
    { label: "CS / min", a: sa.csPerMin, b: sb.csPerMin, fmt: (v) => v.toFixed(1) },
    { label: "Vision / min", a: sa.visionPerMin, b: sb.visionPerMin, fmt: (v) => v.toFixed(2) },
    { label: "Damage / min", a: sa.damagePerMin, b: sb.damagePerMin, fmt: compact },
  ];
  const radar = sa.radar.map((r, i) => ({ axis: r.axis, a: r.value, b: sb.radar[i]?.value ?? 0 }));
  const trend = useMemo(() => {
    const n = Math.max(sa.timeline.length, sb.timeline.length);
    return Array.from({ length: n }, (_, i) => ({ label: `G${i + 1}`, a: sa.timeline[i] ? Math.round(sa.timeline[i].rollingWinRate * 100) : null, b: sb.timeline[i] ? Math.round(sb.timeline[i].rollingWinRate * 100) : null }));
  }, [sa, sb]);
  const common = sa.champions.filter((c) => sb.champions.some((x) => x.championId === c.championId)).slice(0, 6);
  const winsA = metrics.filter((m) => (m.lowerIsBetter ? m.a < m.b : m.a > m.b)).length;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <Side p={pa} color={A} winner={winsA > metrics.length / 2} />
        <div className="grid place-items-center">
          <span className="font-display text-3xl font-bold text-primary text-glow">{t("VS")}</span>
          <p className="text-xs text-muted tabular">
            {winsA} – {metrics.length - winsA}
          </p>
        </div>
        <Side p={pb} color={B} winner={winsA < metrics.length / 2} align="right" />
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={t("Head to head")} />
          <CardBody className="space-y-3">
            {metrics.map((m) => {
              const total = Math.abs(m.a) + Math.abs(m.b) || 1;
              const aBetter = m.lowerIsBetter ? m.a < m.b : m.a > m.b;
              const bBetter = m.lowerIsBetter ? m.b < m.a : m.b > m.a;
              return (
                <div key={m.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className={cn("font-semibold tabular", aBetter ? "text-fg" : "text-muted")}>{m.fmt(m.a)}</span>
                    <span className="text-xs text-dim">{t(m.label)}</span>
                    <span className={cn("font-semibold tabular", bBetter ? "text-fg" : "text-muted")}>{m.fmt(m.b)}</span>
                  </div>
                  <div className="flex h-2 gap-1">
                    <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-white/[0.05]">
                      <div className="h-full rounded-l-full transition-[width] duration-700" style={{ width: `${(Math.abs(m.a) / total) * 100}%`, background: A, opacity: aBetter ? 1 : 0.45 }} />
                    </div>
                    <div className="flex-1 overflow-hidden rounded-r-full bg-white/[0.05]">
                      <div className="h-full rounded-r-full transition-[width] duration-700" style={{ width: `${(Math.abs(m.b) / total) * 100}%`, background: B, opacity: bBetter ? 1 : 0.45 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Performance profile")} />
          <CardBody>
            <StatRadar data={radar} height={300} series={[{ key: "a", label: pa.account.gameName, color: A }, { key: "b", label: pb.account.gameName, color: B }]} />
          </CardBody>
        </Card>
      </div>
      <div className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader title={t("Rolling win rate")} />
          <CardBody>
            <TrendChart data={trend} series={[{ key: "a", label: pa.account.gameName, color: A }, { key: "b", label: pb.account.gameName, color: B }]} format={(v) => `${v}%`} domain={[0, 100]} height={220} showGrid />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Shared champions")} />
          <CardBody className="space-y-2">
            {common.length === 0 && <EmptyState title={t("No champions in common")} className="py-4" />}
            {common.map((c) => {
              const other = sb.champions.find((x) => x.championId === c.championId)!;
              return (
                <div key={c.championId} className="flex items-center gap-3">
                  <ChampionIcon id={c.championId} size={32} />
                  <span className="w-24 truncate text-sm">{champion(c.championId)?.name}</span>
                  <span className="flex-1 text-right text-xs tabular" style={{ color: A }}>
                    {pct(c.wins / c.games)} · {formatKda(c.kda)}
                  </span>
                  <span className="flex-1 text-right text-xs tabular" style={{ color: B }}>
                    {pct(other.wins / other.games)} · {formatKda(other.kda)}
                  </span>
                </div>
              );
            })}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Side({ p, color, winner, align = "left" }: { p: PlayerProfile; color: string; winner: boolean; align?: "left" | "right" }) {
  const solo = p.ranked.find((r) => r.queue === "RANKED_SOLO_5x5");
  const body: ReactNode = (
    <>
      <ProfileIcon id={p.account.profileIconId} size={64} className="rounded-xl" />
      <div className={cn("min-w-0", align === "right" && "text-right")}>
        <p className="truncate text-lg font-bold">
          {p.account.gameName}
          <span className="text-muted">#{p.account.tagLine}</span>
        </p>
        <p className="text-sm text-muted">
          {regionLabel(p.account.platform)}{" " + t("· Level") + " "}{p.account.summonerLevel}
        </p>
        <p className="text-sm font-medium" style={{ color }}>
          {solo ? t("{0} · {1} LP", [rankLabel(solo.tier, solo.division), solo.lp]) : t("Unranked")}
        </p>
      </div>
      <RankEmblem tier={solo?.tier ?? null} size={60} />
    </>
  );
  return (
    <Card className={cn("relative flex items-center gap-4 p-4", align === "right" && "flex-row-reverse", winner && "glow-border")} style={{ borderTop: `2px solid ${color}` }}>
      {winner && <Trophy className={cn("absolute top-3 size-4 text-warning", align === "right" ? "left-3" : "right-3")} />}
      {body}
    </Card>
  );
}
