"use client";


import { t } from "@/lib/i18n";
import { ChartColumn, Crosshair, Eye, Flame, Swords, Target, Trophy, Users } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { compact, formatKda, pct, ROLE_LABEL, shortDate } from "@/lib/format";
import { usePlayerStats } from "@/lib/queries";
import { InsightsCard } from "./insights-card";
import { QUEUE_FILTERS } from "@/lib/static-data";
import { useStatic } from "@/lib/static-context";
import type { PlayerStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SimpleBarChart } from "../charts/bar-chart";
import { StatRadar } from "../charts/radar-chart";
import { TrendChart } from "../charts/trend-chart";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Progress } from "../ui/progress";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Segmented } from "../ui/tabs";

export function Kpi({ icon, label, value, sub, tone }: { icon: ReactNode; label: string; value: ReactNode; sub?: ReactNode; tone?: "win" | "loss" | "primary" }) {
  return (
    <Card hover className="flex items-center gap-3 p-3.5">
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-lg border [&_svg]:size-[18px]", tone === "win" ? "border-win/30 bg-win/10 text-win" : tone === "loss" ? "border-loss/30 bg-loss/10 text-loss" : "border-primary/30 bg-primary-soft text-primary")}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-dim">{label}</p>
        <p className="text-lg font-bold leading-tight text-fg tabular">{value}</p>
        {sub && <p className="truncate text-[11px] text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

export function StatsPanel({ region, puuid }: { region: string; puuid: string }) {
  const [count, setCount] = useState<"20" | "40">("20");
  const [queue, setQueue] = useState("all");
  const q = usePlayerStats(region, puuid, Number(count), queue);
  const s = q.data?.data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label={t("Sample size")}
          value={count}
          onChange={setCount}
          items={[
            { value: "20", label: t("Last 20") },
            { value: "40", label: t("Last 40") },
          ]}
        />
        <Select className="w-[150px]" size="sm" label={t("Queue")} value={queue} onChange={setQueue} options={QUEUE_FILTERS.map((f) => ({ value: f.value, label: t(f.label) }))} />
        <div className="ml-auto">
          <SourceBadge source={q.data?.source} note={t(q.data?.note)} />
        </div>
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={cn("rounded-[14px]", i < 4 ? "h-[72px]" : "h-[240px] sm:col-span-2")} />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : !s || s.games === 0 ? (
        <Card>
          <EmptyState icon={<ChartColumn />} title={t("No games to analyse")} description={t("Play some matches in this queue, or pick another queue.")} />
        </Card>
      ) : (
        <StatsBody s={s} loadingMore={q.isFetching} />
      )}
    </div>
  );
}

function StatsBody({ s, loadingMore }: { s: PlayerStats; loadingMore: boolean }) {
  const { champion } = useStatic();
  const timeline = useMemo(
    () =>
      s.timeline.map((tt, i) => ({
        label: `${i + 1}`,
        date: shortDate(tt.date),
        winrate: Math.round(tt.rollingWinRate * 100),
        kda: Math.min(tt.kda, 15),
        cs: tt.csPerMin,
        damage: tt.damagePerMin,
        vision: tt.visionScore,
        lp: tt.cumulativeLp,
        result: tt.win ? 1 : 0,
      })),
    [s],
  );
  const hasLp = s.timeline.some((tt) => tt.cumulativeLp !== null);
  return (
    <div className={cn("space-y-3 transition-opacity", loadingMore && "opacity-70")}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={<Trophy />} label={t("Win rate")} value={pct(s.winRate)} sub={t("{0}W {1}L · {2} games", [s.wins, s.losses, s.games])} tone={s.winRate >= 0.5 ? "win" : "loss"} />
        <Kpi icon={<Swords />} label={t("KDA")} value={formatKda(s.kda)} sub={`${s.avgKills.toFixed(1)} / ${s.avgDeaths.toFixed(1)} / ${s.avgAssists.toFixed(1)}`} />
        <Kpi icon={<Crosshair />} label={t("CS / min")} value={s.csPerMin.toFixed(1)} sub={t("minions + monsters")} />
        <Kpi icon={<Users />} label={t("Kill participation")} value={pct(s.killParticipation)} sub={t("of team kills")} />
        <Kpi icon={<Flame />} label={t("Damage / min")} value={compact(s.damagePerMin)} sub={t("to champions")} />
        <Kpi icon={<Eye />} label={t("Vision / min")} value={s.visionPerMin.toFixed(2)} sub={t("vision score")} />
        <Kpi icon={<Target />} label={t("Main role")} value={s.roles[0] ? ROLE_LABEL[s.roles[0].role] : "—"} sub={s.roles[0] ? t("{0} games · {1} WR", [s.roles[0].games, pct(s.roles[0].winRate)]) : undefined} />
        <Kpi icon={<ChartColumn />} label={t("Champions")} value={s.champions.length} sub={s.champions[0] ? t("most: {0}", [champion(s.champions[0].championId)?.name]) : undefined} />
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card>
          <CardHeader title={hasLp ? t("LP & win-rate trend") : t("Win-rate trend")} />
          <CardBody>
            <TrendChart
              data={timeline}
              xKey="date"
              series={[{ key: "winrate", label: "Win rate (rolling 10)", color: "#9161FF" }]}
              format={(v) => `${v}%`}
              domain={[0, 100]}
              height={220}
              showGrid
            />
            {hasLp && (
              <TrendChart data={timeline} xKey="date" series={[{ key: "lp", label: "Cumulative LP", color: "#24D6A0" }]} format={(v) => `${v > 0 ? "+" : ""}${v} LP`} height={120} showXAxis={false} />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("KDA per game")} action={<span className="text-xs text-dim">{t("green = win · red = loss")}</span>} />
          <CardBody>
            <SimpleBarChart data={timeline} xKey="label" bars={[{ key: "kda", label: "KDA", color: "#9161FF" }]} height={280} format={(v) => v.toFixed(1)} colorFor={(row) => (row.result ? "#24D6A0" : "#FF4D78")} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Farming & vision")} />
          <CardBody>
            <TrendChart
              data={timeline}
              xKey="date"
              series={[
                { key: "cs", label: "CS / min", color: "#458CFF" },
                { key: "vision", label: "Vision score", color: "#24D6A0" },
              ]}
              format={(v) => v.toFixed(1)}
              height={240}
              showGrid
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Damage to champions / min")} />
          <CardBody>
            <TrendChart data={timeline} xKey="date" series={[{ key: "damage", label: "Damage / min", color: "#FF4D78" }]} format={(v) => compact(v)} height={240} showGrid />
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.4fr]">
        <Card>
          <CardHeader title={t("Performance profile")} />
          <CardBody>
            <StatRadar data={s.radar} series={[{ key: "value", label: "Score", color: "#9161FF" }]} height={240} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Role distribution")} />
          <CardBody className="space-y-3">
            {s.roles.map((r) => (
              <div key={r.role} className="flex items-center gap-3">
                <RoleIcon role={r.role} className="text-primary" />
                <span className="w-16 text-sm text-fg">{t(ROLE_LABEL[r.role])}</span>
                <Progress value={r.games / s.games} className="flex-1" />
                <span className="w-24 text-right text-xs text-muted tabular">
                  {r.games} · {pct(r.winRate)}{" " + t("WR")}</span>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("Champion performance")} />
          <CardBody className="space-y-1.5">
            {s.champions.slice(0, 6).map((c) => (
              <div key={c.championId} className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-surface-hover/40">
                <ChampionIcon id={c.championId} size={32} />
                <span className="w-24 truncate text-sm font-medium">{champion(c.championId)?.name}</span>
                <span className="w-14 text-xs text-muted tabular">{c.games}{" " + t("games")}</span>
                <Progress value={c.wins / c.games} className="flex-1" color={c.wins / c.games >= 0.5 ? "#24D6A0" : "#FF4D78"} glow={false} />
                <span className="w-10 text-right text-xs tabular">{pct(c.wins / c.games)}</span>
                <span className="w-16 text-right text-xs text-muted tabular">{formatKda(c.kda)}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
      <InsightsCard insights={s.insights} games={s.games} />
    </div>
  );
}
