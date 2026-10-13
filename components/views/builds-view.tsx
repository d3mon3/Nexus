"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { pct, ROLE_LABEL } from "@/lib/format";
import { useChampionStats } from "@/lib/queries";
import { useStatic } from "@/lib/static-context";
import type { ChampionStat, Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BUILD_TABS, BuildPanel, type BuildTab } from "../builds/build-panel";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Tabs } from "../ui/tabs";
import { Select } from "../ui/select";
import { rankOptions } from "./champions-view";
import { ModeTabs } from "../builds/mode-tabs";
import { isGameModeId, type GameModeId } from "@/lib/modes";

export function BuildsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { findChampion, champion, champions } = useStatic();
  const [role, setRole] = useState<"all" | Role>("all");
  const [rank, setRank] = useState("all");
  const [patch, setPatch] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(12);
  const [tab, setTab] = useState<BuildTab>("builds");
  const modeParam = params?.get("mode");
  const mode: GameModeId = isGameModeId(modeParam) ? modeParam : "sr";
  const sr = mode === "sr";
  const setMode = (m: GameModeId) => {
    const next = new URLSearchParams(params?.toString());
    if (m === "sr") next.delete("mode");
    else next.set("mode", m);
    setPatch(undefined);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  const stats = useChampionStats({ patch, role: !sr || role === "all" ? null : role, rank: !sr || rank === "all" ? undefined : rank, mode });

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    const seen = new Set<number>();
    const rows = stats.data?.data.rows ?? [];
    // No statistics yet (fresh server): still let people browse every champion.
    const source: ChampionStat[] = rows.length
      ? rows
      : [...champions].sort((a, b) => a.name.localeCompare(b.name)).map((c) => ({ championId: c.id, role: c.roles[0], tier: "C", winRate: 0, pickRate: 0, banRate: 0, games: 0, kda: 0 }));
    return [...source]
      .sort((a, b) => b.pickRate - a.pickRate)
      .filter((r) => {
        if (seen.has(r.championId)) return false;
        seen.add(r.championId);
        return !term || champion(r.championId)?.name.toLowerCase().includes(term);
      });
  }, [stats.data, search, champion, champions]);

  const selected = findChampion(params?.get("champion") ?? "") ?? (list[0] ? champion(list[0].championId) : findChampion("Yasuo"));
  const selectedRow = list.find((r) => r.championId === selected?.id);
  const choose = (key: string) => {
    const next = new URLSearchParams(params?.toString());
    next.set("champion", key.toLowerCase());
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[22px] font-bold tracking-tight">Runes &amp; Builds</h1>
        <SourceBadge source={stats.data?.source} note={stats.data?.note} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {sr && <Select size="sm" className="w-[128px]" label="Role" value={role} onChange={setRole} options={[{ value: "all", label: "All Roles" }, ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r], icon: <RoleIcon role={r} size={14} /> }))]} />}
          {sr && <Select size="sm" className="w-[128px]" label="Rank" value={rank} onChange={setRank} options={rankOptions()} />}
          {stats.data && <Select size="sm" className="w-[200px]" label="Patch" value={stats.data.data.patch} onChange={setPatch} options={stats.data.data.patches.map((p) => ({ value: p, label: `Patch ${p}` }))} />}
        </div>
      </div>
      <ModeTabs value={mode} onChange={setMode} className="mb-2" />
      <Tabs value={tab} onChange={setTab} size="sm" label="Build sections" items={BUILD_TABS} className="mb-3" />
      <div className="grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
        <Card className="h-max p-2 lg:sticky lg:top-[84px]">
          <Input wrapperClassName="mb-2" icon={<Search />} placeholder="Search champion…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search champion" />
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto pr-1" role="listbox" aria-label="Champions">
            {list.slice(0, search ? 60 : limit).map((r) => {
              const c = champion(r.championId);
              const active = selected?.id === r.championId;
              return (
                <li key={r.championId} role="option" aria-selected={active}>
                  <button
                    onClick={() => c && choose(c.key)}
                    className={cn("flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition-colors", active ? "border-primary/60 bg-primary-soft shadow-[0_0_16px_-6px_var(--primary-glow)]" : "border-transparent hover:bg-surface-hover/60")}
                  >
                    <ChampionIcon id={r.championId} size={38} tooltip={false} />
                    <span className="flex-1 truncate text-[14px] font-medium">{c?.name}</span>
                    <span className="text-[11px] text-muted tabular">{r.games ? pct(r.winRate) : ""}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!search && list.length > limit && (
            <Button size="sm" variant="secondary" className="mt-2 w-full" onClick={() => setLimit((l) => l + 24)}>
              Show More
            </Button>
          )}
        </Card>
        {selected ? <BuildPanel key={`${selected.id}-${role}-${mode}`} mode={mode} championId={selected.id} role={!sr ? null : role === "all" ? (selectedRow?.games ? selectedRow.role : undefined) : role} patch={stats.data?.data.patch} tab={tab} showTabs={false} /> : null}
      </div>
    </div>
  );
}
