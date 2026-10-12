"use client";

import { Filter, RefreshCw, Search, Swords } from "lucide-react";
import { useMemo, useState } from "react";
import { QUEUE_FILTERS } from "@/lib/static-data";
import { useMatches } from "@/lib/queries";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { cn } from "@/lib/utils";
import { SourceBadge } from "../game/source-badge";
import { ChampionIcon } from "../game/icons";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Pagination } from "../ui/pagination";
import { Select } from "../ui/select";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { MatchRow } from "./match-row";

type Outcome = "all" | "win" | "loss";

/** Filterable, paginated match history used by the Match History page and profile tab. */
export function MatchList({ region, puuid, onRefresh }: { region: string; puuid: string; onRefresh?: () => void }) {
  const { settings } = useSettings();
  const { champions, findChampion } = useStatic();
  const [queue, setQueue] = useState("all");
  const [champion, setChampion] = useState<string>("all");
  const [outcome, setOutcome] = useState<Outcome>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const perPage = settings.matchesPerPage;

  const searchedChampion = search.trim() ? findChampion(search.trim()) : undefined;
  const championId = champion !== "all" ? Number(champion) : searchedChampion?.id ?? null;

  const q = useMatches(region, puuid, {
    start: (page - 1) * perPage,
    count: perPage,
    queue,
    champion: championId,
    result: outcome === "all" ? null : outcome,
  });

  const championOptions = useMemo(
    () => [{ value: "all", label: "All Champions" }, ...champions.map((c) => ({ value: String(c.id), label: c.name, icon: <ChampionIcon id={c.id} size={18} tooltip={false} rounded="md" /> }))],
    [champions],
  );

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const data = q.data?.data;
  const totalPages = data?.total != null ? Math.max(1, Math.ceil(data.total / perPage)) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select className="w-[150px]" label="Queue" value={queue} onChange={(v) => reset(() => setQueue(v))} options={QUEUE_FILTERS.map((f) => ({ value: f.value, label: f.label }))} />
        <Select className="w-[170px]" label="Champion" value={champion} onChange={(v) => reset(() => setChampion(v))} options={championOptions} />
        <Select
          className="w-[150px]"
          label="Outcome"
          value={outcome}
          onChange={(v) => reset(() => setOutcome(v))}
          options={[
            { value: "all", label: "All Outcomes" },
            { value: "win", label: "Victories" },
            { value: "loss", label: "Defeats" },
          ]}
        />
        <div className="ml-auto flex items-center gap-2">
          <SourceBadge source={q.data?.source} note={q.data?.note} />
          <Input
            wrapperClassName="w-[220px]"
            icon={<Search />}
            placeholder="Search champion…"
            value={search}
            onChange={(e) => reset(() => setSearch(e.target.value))}
            aria-label="Search champion in match history"
          />
          {onRefresh && (
            <Button size="icon" variant="outline" onClick={onRefresh} aria-label="Refresh matches">
              <RefreshCw className={cn(q.isFetching && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {search.trim() && !searchedChampion && champion === "all" && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <Filter className="size-3.5" /> No champion matches “{search}”.
        </p>
      )}

      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[66px] rounded-xl" />
          ))}
        </div>
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !data?.matches.length ? (
        <EmptyState icon={<Swords />} title="No matches found" description="Try another queue, champion or outcome filter." />
      ) : (
        <div className={cn("space-y-2 transition-opacity", q.isFetching && "opacity-60")}>
          {data.matches.map((m) => (
            <MatchRow key={m.matchId} match={m} region={region} puuid={puuid} variant="full" />
          ))}
        </div>
      )}

      {data && (data.matches.length > 0 || page > 1) && <Pagination page={page} totalPages={totalPages} hasMore={data.hasMore} onChange={setPage} />}
    </div>
  );
}
