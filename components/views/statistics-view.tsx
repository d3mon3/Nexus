"use client";

import { useProfile } from "@/lib/queries";
import { StatsPanel } from "../stats/stats-panel";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { PlayerPicker, usePlayerParam } from "./player-picker";

export function StatisticsView() {
  const [player, setPlayer] = usePlayerParam();
  const profile = useProfile(player);
  const puuid = profile.data?.data.account.puuid;
  return (
    <div>
      <PageHeader title="Statistics" description="Trends, champion performance and per-game analytics computed from recent matches." />
      <PlayerPicker player={player} onChange={setPlayer} className="mb-3" />
      {!player ? (
        <Card>
          <EmptyState title="Choose a player" />
        </Card>
      ) : profile.isLoading ? (
        <Skeleton className="h-[480px] rounded-[14px]" />
      ) : profile.error || !puuid ? (
        <Card>
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        </Card>
      ) : (
        <StatsPanel region={player.platform} puuid={puuid} />
      )}
    </div>
  );
}
