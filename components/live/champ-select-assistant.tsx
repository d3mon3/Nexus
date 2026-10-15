"use client";

import { AlertTriangle, Ban, Crosshair, Download, Info, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { roleFromAssigned } from "@/lib/client-import";
import { getBridge, useChampSelect, useClientState } from "@/lib/desktop";
import { useSettings } from "@/lib/settings";
import { compWarnings } from "@/lib/team-comp";
import { BUILD_STYLE_LABEL, type BuildStyle } from "@/lib/item-kinds";
import type { GameModeId } from "@/lib/modes";
import { pct, ROLE_LABEL } from "@/lib/format";
import { t } from "@/lib/i18n";
import { modeForQueue, modeInfo } from "@/lib/modes";
import { useChampionBuild, useChampionStats, useCounters, usePlayerStats } from "@/lib/queries";
import { resolveRegion } from "@/lib/regions";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon, ItemIcon, RuneIcon, SpellIcon } from "../game/icons";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
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
  const allyChamps = cs.myTeam.map((m) => champion(m.championId || m.intentId)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const enemyChamps = enemies.map((e) => champion(e.championId)).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const warnings = compWarnings(allyChamps, enemyChamps);
  const myStats = (mine.data?.data.champions ?? []).find((c) => c.championId === myChamp) ?? null;

  return (
    <Card className="glow-border">
      <CardHeader
        title={t("Champion select")}
        icon={<Swords className="size-4 text-primary" />}
        action={<span className="text-xs text-muted">{t(modeInfo(mode).label)}</span>}
      />
      {myChamp > 0 && <ImportPanel championId={myChamp} role={mode === "sr" ? myRole : null} mode={mode} myStats={myStats} />}
      {mode === "sr" && warnings.length > 0 && (
        <div className="mx-3 mb-3 space-y-1.5">
          {warnings.map((w) => (
            <p key={w.id} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-xs", w.tone === "bad" ? "border-warning/40 bg-warning/8 text-warning" : "border-secondary/40 bg-secondary/8 text-secondary")}>
              {w.tone === "bad" ? <AlertTriangle className="mt-px size-3.5 shrink-0" /> : <Info className="mt-px size-3.5 shrink-0" />}
              {t(w.text)}
            </p>
          ))}
        </div>
      )}
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

/** What will be imported for the current pick: choose the rune page, import now, or turn auto-import off for this champion. */
function ImportPanel({ championId, role, mode, myStats }: { championId: number; role: Role | null; mode: GameModeId; myStats: { games: number; wins: number; kills: number; deaths: number; assists: number } | null }) {
  const { champion } = useStatic();
  const { settings, update } = useSettings();
  const prefs = settings.importPrefs;
  const chosenVariant = prefs.variantChoice?.[String(championId)] ?? null;
  const q = useChampionBuild(championId, mode === "sr" ? role : null, undefined, mode, chosenVariant);
  const build = q.data?.data ?? null;
  const chosen = prefs.runeChoice?.[String(championId)] ?? 0;
  const disabled = (prefs.disabledChampions ?? []).includes(championId);
  const [status, setStatus] = useState<string | null>(null);
  const bridge = getBridge();

  const setPrefs = (patch: Partial<typeof prefs>) => update((s) => ({ importPrefs: { ...s.importPrefs, ...patch } }));
  const choose = (i: number) => setPrefs({ runeChoice: { ...(prefs.runeChoice ?? {}), [String(championId)]: i } });
  const chooseVariant = (id: string | null) => {
    const next = { ...(prefs.variantChoice ?? {}) };
    if (id) next[String(championId)] = id;
    else delete next[String(championId)];
    // A different style has different rune pages: start from its most played one.
    setPrefs({ variantChoice: next, runeChoice: { ...(prefs.runeChoice ?? {}), [String(championId)]: 0 } });
  };
  const toggleAuto = (on: boolean) => {
    const list = new Set(prefs.disabledChampions ?? []);
    if (on) list.delete(championId);
    else list.add(championId);
    setPrefs({ disabledChampions: [...list] });
  };
  const importNow = async () => {
    if (!bridge?.importBuild) return;
    setStatus(t("Importing…"));
    const r = await bridge.importBuild(championId, role, mode, chosen, build?.variant ?? undefined).catch(() => ({ ok: false, text: t("Import failed.") }));
    setStatus(r.text);
  };

  return (
    <div className="mx-3 mb-3 rounded-xl border border-line-soft bg-surface-2/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <ChampionIcon id={championId} size={36} rounded="full" tooltip={false} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t("Import for {0}", [champion(championId)?.name ?? ""])}</p>
          <p className="text-xs text-muted">
            {myStats && myStats.games > 0
              ? t("You on this champion: {0} win rate in {1} games · {2} KDA", [pct(myStats.wins / myStats.games), myStats.games, ((myStats.kills + myStats.assists) / Math.max(1, myStats.deaths)).toFixed(2)])
              : t("You haven't played this champion in your recent games.")}
          </p>
        </div>
        <span className="flex items-center gap-2 text-xs text-muted">
          {t("Auto-import")}
          <Switch checked={!disabled} onChange={toggleAuto} label={t("Auto-import")} />
        </span>
        <Button size="sm" onClick={importNow} disabled={!bridge?.importBuild || !build}>
          <Download className="size-3.5" /> {t("Import now")}
        </Button>
      </div>
      {q.isLoading ? (
        <p className="mt-2 text-xs text-muted">{t("Loading…")}</p>
      ) : !build ? (
        <p className="mt-2 text-xs text-muted">{t("Build data for this champion is still being collected.")}</p>
      ) : (
        <>
        {(build.variants?.length ?? 0) > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-dim">{t("Build style")}</span>
            {[null, ...(build.variants ?? []).map((v) => v.id)].map((id) => {
              const v = build.variants?.find((x) => x.id === id);
              return (
                <button
                  key={id ?? "all"}
                  onClick={() => chooseVariant(id)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs transition", (build.variant ?? null) === id ? "border-primary bg-primary-soft text-fg" : "border-line-soft text-muted hover:border-line")}
                >
                  {id ? t(BUILD_STYLE_LABEL[id as BuildStyle] ?? id) : t("All")}
                  {v && <span className="ml-1.5 text-[10.5px] text-dim tabular">{pct(v.winRate)}</span>}
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">{t("Rune page — tap to choose")}</p>
            <div className="flex flex-wrap gap-2">
              {build.runes.slice(0, 3).map((r, i) => (
                <button
                  key={i}
                  onClick={() => choose(i)}
                  className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition", i === chosen ? "border-primary bg-primary-soft" : "border-line-soft hover:border-line")}
                >
                  <RuneIcon id={r.perks[0]} size={28} />
                  <RuneIcon id={r.subStyle} size={18} />
                  <span className="text-[11px] leading-tight text-muted tabular">
                    <span className="block font-semibold text-fg">{pct(r.winRate)}</span>
                    {t("{0} games", [r.games])}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dim">{t("Spells and core build")}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              {build.spells[0]?.ids.map((id) => <SpellIcon key={id} id={id} size={26} />)}
              <span className="mx-1 h-5 w-px bg-line-soft" />
              {build.popular.items.map((id) => <ItemIcon key={id} id={id} size={26} />)}
              {build.boots[0] && <ItemIcon id={build.boots[0].items[0]} size={26} />}
            </div>
          </div>
        </div>
        </>
      )}
      {status && <p className="mt-2 text-xs text-muted">{status}</p>}
    </div>
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
