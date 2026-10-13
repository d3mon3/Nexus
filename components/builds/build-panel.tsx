"use client";

import { Download, Footprints, Shield, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { getBridge } from "@/lib/desktop";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { formatKda, pct, ROLE_LABEL, wrColor } from "@/lib/format";
import type { GameModeId } from "@/lib/modes";
import { useChampionBuild, useChampionDetail } from "@/lib/queries";
import { useStatic } from "@/lib/static-context";
import type { BuildPath, ChampionBuild, Matchup, Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { GameImage } from "../game/game-image";
import { ChampionIcon, ItemIcon, SpellIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { TierBadge } from "../game/tier-badge";
import { Button } from "../ui/button";
import { Card, CardBody, CardHeader } from "../ui/card";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Tabs } from "../ui/tabs";
import { RuneTree } from "./rune-tree";

export type BuildTab = "builds" | "runes" | "skills" | "situational";
export const BUILD_TABS: { value: BuildTab; label: string }[] = [
  { value: "builds", label: "Builds" },
  { value: "runes", label: "Runes" },
  { value: "skills", label: "Skill Orders" },
  { value: "situational", label: "Situational Items" },
];

const wl = (games: number, wr: number) => `${Math.round(games * wr).toLocaleString()}W ${Math.round(games * (1 - wr)).toLocaleString()}L`;

/**
 * Champion build page. On Meta & Builds the section tabs live in the page header
 * (`tab` + `showTabs={false}`); elsewhere the panel renders its own tab bar.
 */
export function BuildPanel({
  championId,
  role: roleProp,
  patch,
  onRoleChange,
  showHeader = true,
  tab: tabProp,
  showTabs = true,
  mode = "sr",
}: {
  mode?: GameModeId;
  championId: number;
  role?: Role | null;
  patch?: string;
  onRoleChange?: (r: Role) => void;
  showHeader?: boolean;
  tab?: BuildTab;
  showTabs?: boolean;
}) {
  const { champion } = useStatic();
  const c = champion(championId);
  const [localRole, setLocalRole] = useState<Role | null>(roleProp ?? null);
  const role = roleProp ?? localRole;
  const q = useChampionBuild(championId, mode === "sr" ? role : null, patch, mode);
  const [localTab, setLocalTab] = useState<BuildTab>("builds");
  const tab = tabProp ?? localTab;
  const b = q.data?.data;

  if (q.isLoading) return <Skeleton className="h-[520px] rounded-[14px]" />;
  if (!q.error && q.data && !b)
    return (
      <Card>
        <EmptyState title="Build data is being collected" description={q.data.note ?? "No build data for this champion yet."} />
      </Card>
    );
  if (q.error || !b)
    return (
      <Card>
        <ErrorState error={q.error ?? new Error("No build data for this champion.")} onRetry={() => q.refetch()} />
      </Card>
    );

  const roles = c?.roles ?? [b.role];
  const changeRole = (r: Role) => (onRoleChange ? onRoleChange(r) : setLocalRole(r));

  const header = showHeader && (
    <div className="flex flex-wrap items-center gap-4 border-b border-line-soft p-4">
      <ChampionIcon id={championId} size={58} rounded="full" ring="primary" tooltip={false} />
      <div className="min-w-0">
        <h2 className="text-[19px] font-bold">{c?.name}</h2>
        <p className="text-[13px] capitalize text-muted">{c?.title}</p>
      </div>
      <div className="ml-auto flex items-center gap-1">
        <div className="grid place-items-center gap-0.5 rounded-lg border border-[#ff4d78]/30 bg-[#ff4d78]/8 px-3 py-1">
          <TierBadge tier={b.summary.tier} className="border-0 bg-transparent" />
          <span className="text-[10px] text-muted">Tier</span>
        </div>
        <Stat label="Win Rate">
          <span className="text-fg">{pct(b.summary.winRate)}</span>
        </Stat>
        <Stat label="KDA">
          <span className="text-success">{formatKda(b.summary.kda)}</span>
        </Stat>
      </div>
      <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted">
        <SourceBadge source={q.data?.source} note={q.data?.note} />
        <span className="tabular">
          Pick {pct(b.summary.pickRate, 1)} · Ban {pct(b.summary.banRate, 1)} · {b.summary.games.toLocaleString()} games · patch {b.patch}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {mode === "sr" && roles.length > 1 && (
            <Select
              size="sm"
              className="w-[120px]"
              label="Role"
              value={b.role}
              onChange={(v) => changeRole(v)}
              options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r], icon: <RoleIcon role={r} size={14} /> }))}
            />
          )}
          <ImportButton championId={championId} role={b.role} mode={mode} />
          <Link href={`/champions/${c?.key.toLowerCase()}`} className="text-primary hover:underline">
            Champion page
          </Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {showTabs && (
        <Tabs value={tab} onChange={setLocalTab} size="sm" label="Build sections" items={BUILD_TABS} className="border-b border-line-soft" />
      )}

      {tab === "builds" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_350px]">
          <div className="min-w-0 space-y-3">
            <Card>
              {header}
              <CardBody className="space-y-4 pt-4">
                <PathRow title="Most Common Build" path={b.popular} />
                <PathRow title="High Winrate Build" path={b.highestWinRate} />
                <div className="grid gap-4 border-t border-line-soft pt-4 sm:grid-cols-3">
                  <MiniList title="Starting Items" icon={<Shield className="size-3.5 text-secondary" />} rows={b.starting.map((p) => ({ ids: p.items, wr: p.winRate, pick: p.pickRate, kind: "item" as const }))} />
                  <MiniList title="Boots" icon={<Footprints className="size-3.5 text-secondary" />} rows={b.boots.map((p) => ({ ids: p.items, wr: p.winRate, pick: p.pickRate, kind: "item" as const }))} />
                  <MiniList title="Summoner Spells" rows={b.spells.map((s) => ({ ids: s.ids, wr: s.winRate, pick: s.games / Math.max(1, b.summary.games), kind: "spell" as const }))} />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Situational Items" />
              <CardBody>
                <SituationalStrip b={b} />
              </CardBody>
            </Card>
          </div>
          <div className="space-y-3">
            <RunesCard b={b} />
            <Card>
              <CardHeader title="Skill Order" />
              <CardBody>
                <SkillGrid b={b} compact />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === "runes" && (
        <Card>
          {header}
          <CardBody className="pt-4">
            <RunePages b={b} />
          </CardBody>
        </Card>
      )}
      {tab === "skills" && (
        <Card>
          {header}
          <CardBody className="pt-4">
            <SkillGrid b={b} />
          </CardBody>
        </Card>
      )}
      {tab === "situational" && (
        <Card>
          {header}
          <CardBody className="pt-4">
            <Situational b={b} />
          </CardBody>
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <MatchupList title="Hardest matchups" icon={<ThumbsDown className="size-4 text-loss" />} list={b.counters} />
        <MatchupList title="Best matchups" icon={<ThumbsUp className="size-4 text-win" />} list={b.favorable} />
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-[68px] border-l border-line-soft px-3 text-center first:border-l-0">
      <p className="text-[17px] font-bold tabular">{children}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}

function PathRow({ title, path }: { title: string; path: BuildPath }) {
  return (
    <div>
      <p className="mb-2 text-[13.5px] font-semibold text-fg">{title}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {path.items.map((id, i) => (
            <ItemIcon key={`${id}-${i}`} id={id} size={44} className="rounded-lg transition-transform hover:scale-110 hover:border-primary/70" />
          ))}
        </div>
        <div className="ml-auto text-right">
          <p className={cn("text-[13px] font-semibold tabular", wrColor(path.winRate))}>{pct(path.winRate)} WR</p>
          <p className="text-[12px] text-muted tabular">{wl(path.games, path.winRate)}</p>
        </div>
      </div>
    </div>
  );
}

function MiniList({ title, icon, rows }: { title: string; icon?: ReactNode; rows: { ids: number[]; wr: number; pick: number; kind: "item" | "spell" }[] }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-muted">
        {icon}
        {title}
      </p>
      {rows.slice(0, 3).map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          {r.ids.map((id, j) => (r.kind === "item" ? <ItemIcon key={j} id={id} size={26} /> : <SpellIcon key={j} id={id} size={26} />))}
          <span className={cn("ml-auto text-[11px] font-semibold tabular", wrColor(r.wr))}>{pct(r.wr, 1)}</span>
          <span className="w-9 text-right text-[10px] text-muted tabular">{pct(r.pick)}</span>
        </div>
      ))}
    </div>
  );
}

function RunesCard({ b }: { b: ChampionBuild }) {
  const page = b.runes[0];
  if (!page) return null;
  const pick = page.games / Math.max(1, b.summary.games);
  return (
    <Card>
      <CardHeader title="Runes" />
      <CardBody>
        <RuneTree page={page} compact />
        <div className="mt-3 grid grid-cols-2 border-t border-line-soft pt-3">
          <div>
            <p className="text-[12px] text-muted">Pick Rate</p>
            <p className="text-[15px] font-bold tabular">{pct(pick)}</p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Win Rate</p>
            <p className={cn("text-[15px] font-bold tabular", wrColor(page.winRate))}>{pct(page.winRate)}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function RunePages({ b }: { b: ChampionBuild }) {
  const [i, setI] = useState(0);
  const page = b.runes[i];
  if (!page) return <EmptyState title="No rune data" />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {b.runes.map((r, idx) => (
          <button
            key={idx}
            onClick={() => setI(idx)}
            className={cn("rounded-lg border px-3 py-2 text-left text-xs transition-colors", idx === i ? "border-primary/70 bg-primary-soft" : "border-line hover:border-primary/40")}
          >
            <p className="font-semibold text-fg">Page {idx + 1}</p>
            <p className="text-muted tabular">
              {pct(r.winRate, 1)} WR · {r.games.toLocaleString()} games
            </p>
          </button>
        ))}
      </div>
      <RuneTree page={page} />
    </div>
  );
}

const SKILL_COLORS: Record<string, string> = { Q: "bg-primary", W: "bg-secondary", E: "bg-[#3f6dff]", R: "bg-warning" };

function SkillGrid({ b, compact = false }: { b: ChampionBuild; compact?: boolean }) {
  const { champion } = useStatic();
  const detail = useChampionDetail(champion(b.championId)?.key);
  const slots = ["Q", "W", "E", "R"] as const;
  const cell = compact ? "h-[18px] w-[15px] text-[9px]" : "h-7 w-7 text-[11px]";
  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm">
          Max order <span className="font-semibold text-fg">{b.skillOrder.priority.join(" > ")}</span> · <span className={cn("font-semibold", wrColor(b.skillOrder.winRate))}>{pct(b.skillOrder.winRate, 1)}</span>{" "}
          <span className="text-muted">win rate</span>
        </p>
      )}
      <div className="overflow-x-auto">
        <table className={cn("border-separate", compact ? "border-spacing-[2px]" : "border-spacing-1")}>
          <thead>
            <tr>
              <th />
              {b.skillOrder.sequence.map((_, i) => (
                <th key={i} className={cn("text-center font-normal text-dim", compact ? "text-[9px]" : "w-7 text-[10px]")}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slots.map((slot) => {
              const spell = detail.data?.spells.find((x) => x.slot === slot);
              return (
                <tr key={slot}>
                  <td className="pr-1.5">
                    <GameImage src={spell?.image} alt={spell?.name ?? slot} fallbackText={slot} className={cn("rounded-md border border-line", compact ? "size-[18px] text-[9px]" : "size-7 text-[11px]")} />
                  </td>
                  {b.skillOrder.sequence.map((s, i) => (
                    <td key={i} className={cn("rounded-[3px] text-center font-bold", cell, s === slot ? `${SKILL_COLORS[slot]} text-white shadow-[0_0_8px_-2px_var(--primary-glow)]` : "bg-white/[0.04]")}>
                      {s === slot ? slot : ""}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SituationalStrip({ b }: { b: ChampionBuild }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {b.situational.slice(0, 8).map((s) => (
        <div key={s.itemId} className="text-center">
          <ItemIcon id={s.itemId} size={44} className="rounded-lg" />
          <p className={cn("mt-1 text-[10px] font-semibold tabular", wrColor(s.winRate))}>{pct(s.winRate)}</p>
        </div>
      ))}
      {b.situational.length === 0 && <EmptyState title="No situational items" />}
    </div>
  );
}

function Situational({ b }: { b: ChampionBuild }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {b.situational.map((s) => (
        <div key={s.itemId} className="flex items-center gap-3 rounded-lg border border-line-soft p-2.5 hover:border-primary/40">
          <ItemIcon id={s.itemId} size={38} />
          <div className="flex-1">
            <p className={cn("text-sm font-semibold tabular", wrColor(s.winRate))}>{pct(s.winRate, 1)} WR</p>
            <p className="text-[11px] text-muted tabular">{pct(s.pickRate)} of games</p>
          </div>
        </div>
      ))}
      {b.situational.length === 0 && <EmptyState title="No situational items" />}
    </div>
  );
}

function MatchupList({ title, icon, list }: { title: string; icon: ReactNode; list: Matchup[] }) {
  const { champion } = useStatic();
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      <CardBody className="space-y-1.5">
        {list.map((m) => (
          <Link key={m.opponentId} href={`/champions/${champion(m.opponentId)?.key.toLowerCase()}`} className="flex items-center gap-3 rounded-lg px-1.5 py-1 hover:bg-surface-hover/50">
            <ChampionIcon id={m.opponentId} size={30} tooltip={false} />
            <span className="flex-1 text-sm">{champion(m.opponentId)?.name}</span>
            <span className={cn("text-sm font-semibold tabular", wrColor(m.winRate))}>{pct(m.winRate, 1)}</span>
            <span className="w-20 text-right text-[11px] text-muted tabular">{m.games.toLocaleString()} games</span>
          </Link>
        ))}
        {list.length === 0 && <EmptyState title="Not enough matchup data" className="py-4" />}
      </CardBody>
    </Card>
  );
}

/** Desktop only: writes this build (runes, spells, item set) into the League client now. */
export function ImportButton({ championId, role, mode = "sr" }: { championId: number; role: Role; mode?: GameModeId }) {
  const [busy, setBusy] = useState(false);
  const bridge = typeof window !== "undefined" ? getBridge() : null;
  if (!bridge?.importBuild) return null;
  return (
    <Button
      size="sm"
      variant="primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await bridge.importBuild!(championId, mode === "sr" ? role : null, mode);
        setBusy(false);
        (r.ok ? toast.success : toast.error)(r.ok ? "Imported to League client" : "Import failed", { description: r.text });
      }}
    >
      <Download /> {busy ? "Importing…" : "Import to client"}
    </Button>
  );
}
