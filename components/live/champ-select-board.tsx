"use client";

import { Skull } from "lucide-react";
import { useMemo } from "react";
import { roleFromAssigned } from "@/lib/client-import";
import type { ChampSelectState } from "@/lib/desktop";
import { pct, ROLE_LABEL } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useChampionStats, useCounters, useProfile } from "@/lib/queries";
import { parseRiotId, type Platform } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, LiveParticipant, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { ScoutCard } from "./scout-board";
import { Skeleton } from "../ui/skeleton";

/**
 * Champion-select board (Porofessor "pregame"): my team's players with their stats, and
 * under every picked champion — ours and theirs — who counters it in that lane.
 * Names hidden by the client stay hidden.
 */
export function ChampSelectBoard({ cs, region, myRiotId, compactMode = false, counters = true }: { cs: ChampSelectState; region: Platform; myRiotId: string | null; compactMode?: boolean; counters?: boolean }) {
  const stats = useChampionStats({ mode: "sr" });
  const rows = stats.data?.data.rows ?? [];
  const { settings } = useSettings();
  const best = useMemo(() => {
    const m = new Map<number, ChampionStat>();
    for (const r of rows) if (!m.has(r.championId) || r.games > m.get(r.championId)!.games) m.set(r.championId, r);
    return m;
  }, [rows]);
  const roleOf = (championId: number, position: string): Role | null => roleFromAssigned(position) ?? best.get(championId)?.role ?? null;
  const statOf = (championId: number, role: Role | null) => rows.find((r) => r.championId === championId && r.role === role) ?? best.get(championId);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {cs.myTeam.map((m) => {
          const champ = m.championId || m.intentId;
          const role = roleOf(champ, m.position);
          const riotId = m.cellId === cs.myCellId ? myRiotId : (m.riotId ?? null);
          return (
            <div key={m.cellId} className="space-y-2">
              <AllyPlayer riotId={riotId} championId={champ} spells={m.spells ?? [0, 0]} region={region} depth={settings.scoutDepth} compactMode={compactMode} me={m.cellId === cs.myCellId} />
              {counters && <ChampionCounters championId={champ} role={role} stat={statOf(champ, role)} hovering={!m.championId && Boolean(m.intentId)} side="ally" />}
            </div>
          );
        })}
      </div>
      {counters && cs.theirTeam.length > 0 && (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {cs.theirTeam.map((e) => {
          const role = roleOf(e.championId, e.position);
          return <ChampionCounters key={e.cellId} championId={e.championId} role={role} stat={statOf(e.championId, role)} side="enemy" />;
        })}
      </div>
      )}
    </div>
  );
}

function AllyPlayer({ riotId, championId, spells, region, depth, compactMode, me }: { riotId: string | null; championId: number; spells: [number, number]; region: Platform; depth: number; compactMode: boolean; me: boolean }) {
  const parsed = riotId ? parseRiotId(riotId) : null;
  const profile = useProfile(parsed ? { ...parsed, platform: region } : null);
  const participant: LiveParticipant = {
    puuid: parsed ? (profile.data?.data.account.puuid ?? null) : null,
    riotId: riotId ?? "",
    championId,
    teamId: 100,
    spells,
    perks: null,
    ranked: null,
  };
  // Still resolving the Riot ID → loading card instead of the "hidden player" one.
  if (parsed && !participant.puuid)
    return (
      <div className="widget-card space-y-2 p-3">
        <p className="truncate text-[13px] font-semibold">{riotId}</p>
        {profile.error ? <p className="text-xs text-muted">{t("Couldn't load this player.")}</p> : <Skeleton className="h-24" />}
      </div>
    );
  return (
    <div className={cn(me && "rounded-[20px] ring-2 ring-primary/70")}>
      <ScoutCard participant={participant} region={region} depth={depth} compactMode={compactMode} hiddenText={t("The client hides this name in champion select. Their stats appear on the loading screen.")} />
    </div>
  );
}

function ChampionCounters({ championId, role, stat, side, hovering = false }: { championId: number; role: Role | null; stat: ChampionStat | undefined; side: "ally" | "enemy"; hovering?: boolean }) {
  const { champion } = useStatic();
  const counters = useCounters(championId || null, role);
  const picks = (counters.data?.data.picks ?? []).filter((p) => p.winRate > 0.5).slice(0, 5);
  const c = champion(championId);
  return (
    <div className={cn("widget-card border-t-2 p-3", side === "ally" ? "border-t-secondary/80" : "border-t-loss/80")}>
      {!championId ? (
        <p className="py-3 text-center text-xs text-muted">{side === "ally" ? t("Picking…") : t("Not picked yet")}</p>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <ChampionIcon id={championId} size={38} rounded="md" className={cn(hovering && "opacity-60")} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-semibold">{c?.name ?? "—"}</p>
              <p className="flex items-center gap-1 text-[11px] text-muted">
                {role && <RoleIcon role={role} size={12} />}
                {role ? t(ROLE_LABEL[role]) : t("Unknown role")}
                {hovering && <span className="text-dim">· {t("hovering")}</span>}
              </p>
            </div>
            {stat && (
              <div className="text-right text-[11px] leading-tight tabular">
                <p className={cn("font-semibold", stat.winRate >= 0.51 ? "text-win" : stat.winRate <= 0.49 ? "text-loss" : "text-fg")}>{pct(stat.winRate, 1)}</p>
                <p className="text-muted">{t("{0} picks", [pct(stat.pickRate, 1)])}</p>
              </div>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t border-line-soft pt-2.5">
            <Skull className="size-4 shrink-0 text-loss" />
            <span className="whitespace-nowrap text-[11px] text-muted">{t("Countered by:")}</span>
            <span className="ml-auto flex gap-1">
              {picks.length ? (
                picks.map((p) => (
                  <span key={p.championId} title={`${champion(p.championId)?.name ?? ""} · ${pct(p.winRate, 1)}`}>
                    <ChampionIcon id={p.championId} size={22} rounded="md" />
                  </span>
                ))
              ) : (
                <span className="text-[11px] text-dim">{counters.isLoading ? "…" : t("no clear counters")}</span>
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
