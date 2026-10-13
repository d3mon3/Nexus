"use client";

import { Ban, Crosshair, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { roleFromAssigned } from "@/lib/client-import";
import { useChampSelect, useClientState } from "@/lib/desktop";
import { pct, ROLE_LABEL } from "@/lib/format";
import { t } from "@/lib/i18n";
import { modeForQueue, modeInfo } from "@/lib/modes";
import { useChampionStats, useCounters, usePlayerStats } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { TierBadge } from "../game/tier-badge";
import { Card, CardHeader } from "../ui/card";
import { EmptyState } from "../ui/states";

const wrClass = (wr: number) => (wr >= 0.53 ? "text-win" : wr <= 0.47 ? "text-loss" : "text-fg");

/**
 * Champion-select helper (desktop app): counters for the lane opponent, the player's own
 * results on those champions, and ban suggestions — all from aggregated real matches.
 */
export function ChampSelectAssistant({ forceShow = false }: { forceShow?: boolean }) {
  const client = useClientState();
  const inChampSelect = client?.connected && client.phase === "ChampSelect";
  const cs = useChampSelect(Boolean(inChampSelect));
  const { champion } = useStatic();
  const stats = useChampionStats({ mode: "sr" });
  const platform = resolveRegion(client?.summoner?.platform ?? "")?.platform;
  const mine = usePlayerStats(platform, client?.summoner?.puuid, 40);
  const [manualOpponent, setManualOpponent] = useState<number | null>(null);

  const mainRoleOf = useMemo(() => {
    const best = new Map<number, ChampionStat>();
    for (const r of stats.data?.data.rows ?? []) if (!best.has(r.championId) || r.games > best.get(r.championId)!.games) best.set(r.championId, r);
    return (id: number) => best.get(id)?.role ?? champion(id)?.roles[0] ?? null;
  }, [stats.data, champion]);

  if (!inChampSelect || !cs) {
    if (!forceShow) return null;
    return (
      <Card>
        <EmptyState icon={<Swords />} title={t("Champion select")} description={t("This panel fills in automatically when your champion select starts in the League client.")} />
      </Card>
    );
  }

  const mode = modeForQueue(cs.queueId);
  const me = cs.myTeam.find((m) => m.cellId === cs.myCellId);
  const myChamp = me ? me.championId || me.intentId : 0;
  const myRole: Role | null = roleFromAssigned(me?.position) ?? (myChamp ? (mainRoleOf(myChamp) as Role | null) : null);
  const enemies = cs.theirTeam.filter((e) => e.championId > 0);
  const guessed = enemies.find((e) => (roleFromAssigned(e.position) ?? mainRoleOf(e.championId)) === myRole)?.championId ?? null;
  const opponent = manualOpponent && enemies.some((e) => e.championId === manualOpponent) ? manualOpponent : guessed;

  return (
    <Card className="glow-border">
      <CardHeader
        title={t("Champion select")}
        icon={<Swords className="size-4 text-primary" />}
        action={<span className="text-xs text-muted">{t(modeInfo(mode).label)}</span>}
      />
      {mode !== "sr" ? (
        <p className="px-4 pb-4 text-sm text-muted">{t("Runes and items for {0} are imported automatically when you pick a champion.", [t(modeInfo(mode).label)])}</p>
      ) : (
        <div className="grid gap-3 p-3 pt-0 lg:grid-cols-[1fr_1.4fr_1fr]">
          <LanePanel myRole={myRole} myChamp={myChamp} enemies={enemies.map((e) => e.championId)} opponent={opponent} onPick={setManualOpponent} />
          <CountersPanel opponent={opponent} role={myRole} myChamp={myChamp} mine={mine.data?.data.champions ?? []} />
          <BansPanel rows={stats.data?.data.rows ?? []} taken={new Set([...cs.bans, ...cs.myTeam.flatMap((m) => [m.championId, m.intentId]), ...enemies.map((e) => e.championId)])} highlight={cs.myBanTurn} />
        </div>
      )}
    </Card>
  );
}

function LanePanel({ myRole, myChamp, enemies, opponent, onPick }: { myRole: Role | null; myChamp: number; enemies: number[]; opponent: number | null; onPick: (id: number) => void }) {
  const { champion } = useStatic();
  return (
    <div className="rounded-xl border border-line-soft bg-surface-2/40 p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-dim">{t("Your lane")}</p>
      <div className="flex items-center gap-3">
        {myChamp ? <ChampionIcon id={myChamp} size={44} rounded="full" ring="primary" /> : <span className="grid size-11 place-items-center rounded-full border border-dashed border-line text-dim">?</span>}
        <div className="min-w-0">
          <p className="truncate font-semibold">{myChamp ? champion(myChamp)?.name : t("Not picked yet")}</p>
          <p className="flex items-center gap-1 text-xs text-muted">{myRole ? <><RoleIcon role={myRole} size={13} /> {t(ROLE_LABEL[myRole])}</> : t("Role unknown")}</p>
        </div>
        <span className="mx-1 text-xs font-bold text-dim">VS</span>
        {opponent ? <ChampionIcon id={opponent} size={44} rounded="full" /> : <span className="grid size-11 place-items-center rounded-full border border-dashed border-line text-dim">?</span>}
      </div>
      <p className="mb-1.5 mt-3 text-[11px] text-dim">{enemies.length ? t("Lane opponent — tap to change:") : t("Enemy picks appear here.")}</p>
      <div className="flex flex-wrap gap-1.5">
        {enemies.map((id) => (
          <button key={id} onClick={() => onPick(id)} className={cn("rounded-full ring-2 transition", id === opponent ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100")} aria-label={champion(id)?.name}>
            <ChampionIcon id={id} size={30} rounded="full" tooltip={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

function CountersPanel({ opponent, role, myChamp, mine }: { opponent: number | null; role: Role | null; myChamp: number; mine: { championId: number; games: number; wins: number }[] }) {
  const { champion } = useStatic();
  const q = useCounters(opponent, role);
  const picks = q.data?.data.picks ?? [];
  const myVs = picks.find((p) => p.championId === myChamp);
  const mineById = new Map(mine.map((m) => [m.championId, m]));
  // Prefer counters the player already knows, then by win rate.
  const ranked = [...picks].sort((a, b) => (mineById.has(b.championId) ? 0.03 : 0) + b.winRate - ((mineById.has(a.championId) ? 0.03 : 0) + a.winRate)).slice(0, 7);

  return (
    <div className="rounded-xl border border-line-soft bg-surface-2/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">
        <Crosshair className="size-3.5" /> {opponent ? t("Best picks against {0}", [champion(opponent)?.name ?? ""]) : t("Counters")}
      </p>
      {!opponent || !role ? (
        <p className="text-sm text-muted">{t("Counters appear when the enemy picks a champion for your lane.")}</p>
      ) : q.isLoading ? (
        <p className="text-sm text-muted">{t("Loading…")}</p>
      ) : !picks.length ? (
        <p className="text-sm text-muted">{t("Not enough games against this champion yet.")}</p>
      ) : (
        <>
          {myVs && (
            <p className="mb-2 rounded-lg bg-primary-soft px-2.5 py-1.5 text-xs">
              {t("Your pick {0} wins {1} of {2} games in this matchup.", [champion(myChamp)?.name ?? "", pct(myVs.winRate), myVs.games])}
            </p>
          )}
          <ul className="space-y-1">
            {ranked.map((p) => {
              const m = mineById.get(p.championId);
              return (
                <li key={p.championId} className="flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-surface-hover/40">
                  <ChampionIcon id={p.championId} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{champion(p.championId)?.name}</span>
                  <span className={cn("w-12 text-right text-sm font-semibold tabular", wrClass(p.winRate))}>{pct(p.winRate)}</span>
                  <span className="w-28 text-right text-[11px] text-muted tabular">{m ? t("You: {0} · {1} games", [pct(m.wins / m.games), m.games]) : t("{0} games", [p.games])}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function BansPanel({ rows, taken, highlight }: { rows: ChampionStat[]; taken: Set<number>; highlight: boolean }) {
  const { champion } = useStatic();
  const best = new Map<number, ChampionStat>();
  for (const r of rows) if (!best.has(r.championId) || r.games > best.get(r.championId)!.games) best.set(r.championId, r);
  const score = (r: ChampionStat) => (r.winRate - 0.5) * 3 + r.banRate + r.pickRate * 0.5;
  const list = [...best.values()].filter((r) => !taken.has(r.championId) && r.games >= 10).sort((a, b) => score(b) - score(a)).slice(0, 6);
  return (
    <div className={cn("rounded-xl border bg-surface-2/40 p-3", highlight ? "border-loss/50" : "border-line-soft")}>
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">
        <Ban className="size-3.5" /> {highlight ? t("Your ban — suggestions") : t("Ban suggestions")}
      </p>
      {!list.length ? (
        <p className="text-sm text-muted">{t("Statistics are being collected")}</p>
      ) : (
        <ul className="space-y-1">
          {list.map((r) => (
            <li key={r.championId} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
              <ChampionIcon id={r.championId} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{champion(r.championId)?.name}</span>
              <TierBadge tier={r.tier} />
              <span className={cn("w-11 text-right text-xs font-semibold tabular", wrClass(r.winRate))}>{pct(r.winRate)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
