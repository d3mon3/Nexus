"use client";

import { ExternalLink, Search, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ROLE_LABEL } from "@/lib/format";
import { useProPlayers } from "@/lib/queries";
import { parseRiotId, profileHref, regionLabel } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import type { Role } from "@/lib/types";
import { ROLES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { RoleIcon } from "../game/role-icon";
import { SourceBadge } from "../game/source-badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { PageHeader } from "../ui/page-header";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { Segmented } from "../ui/tabs";

export function ProPlayersView() {
  const q = useProPlayers();
  const { isFavorite, toggleFavorite } = useSettings();
  const [role, setRole] = useState<"all" | Role>("all");
  const [league, setLeague] = useState("all");
  const [search, setSearch] = useState("");
  const leagues = useMemo(() => [...new Set((q.data?.data ?? []).map((p) => p.league))], [q.data]);
  const list = (q.data?.data ?? []).filter(
    (p) => (role === "all" || p.role === role) && (league === "all" || p.league === league) && (!search || `${p.handle} ${p.team} ${p.realName}`.toLowerCase().includes(search.toLowerCase())),
  );
  const teams = [...new Set(list.map((p) => p.team))];

  return (
    <div>
      <PageHeader title="Pro Players" description="Track professional players' solo-queue accounts." actions={<SourceBadge source={q.data?.source} note={q.data?.note} />} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Segmented
          label="Role"
          value={role}
          onChange={setRole}
          items={[{ value: "all", label: "All" }, ...ROLES.map((r) => ({ value: r, label: <><RoleIcon role={r} size={13} /> {ROLE_LABEL[r]}</> }))]}
        />
        <Select className="w-[210px]" label="League" value={league} onChange={setLeague} options={[{ value: "all", label: "All Leagues" }, ...leagues.map((l) => ({ value: l, label: l }))]} />
        <Input wrapperClassName="ml-auto w-[240px]" icon={<Search />} placeholder="Search player or team…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search pro players" />
      </div>
      {q.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[190px] rounded-[14px]" />
          ))}
        </div>
      ) : q.error ? (
        <Card>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <EmptyState icon={<Trophy />} title="No players match" />
        </Card>
      ) : (
        <div className="space-y-5">
          {teams.map((team) => (
            <section key={team}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted">
                <Trophy className="size-4 text-primary" /> {team}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                {list
                  .filter((p) => p.team === team)
                  .map((p) => {
                    const id = p.riotId ? parseRiotId(p.riotId) : null;
                    const ref = id ? { ...id, platform: p.platform as never } : null;
                    return (
                      <Card key={p.handle} hover className="flex flex-col gap-3 p-4">
                        <div className="flex items-center gap-3">
                          <span className="grid size-11 place-items-center rounded-xl border border-primary/40 bg-primary-soft text-primary">
                            <RoleIcon role={p.role} size={20} />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold">{p.handle}</p>
                            <p className="truncate text-xs text-muted">
                              {p.realName} · {p.country}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-dim">
                          {p.league} · {ROLE_LABEL[p.role]} · {regionLabel(p.platform)}
                        </p>
                        <div className="flex gap-1.5">
                          {p.signatureChampionIds.map((c) => (
                            <ChampionIcon key={c} id={c} size={32} />
                          ))}
                        </div>
                        <div className="mt-auto flex gap-2">
                          {ref ? (
                            <>
                              <Link href={profileHref(p.platform, ref.gameName, ref.tagLine)} className="flex-1">
                                <Button size="sm" variant="primary" className="w-full">
                                  Profile <ExternalLink />
                                </Button>
                              </Link>
                              <Button size="sm" variant="outline" onClick={() => toggleFavorite(ref)} aria-pressed={isFavorite(ref)} className={cn(isFavorite(ref) && "border-warning/60 text-warning")}>
                                ★
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-dim">No solo-queue account listed</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
