"use client";


import { t } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";
import { useProfile } from "@/lib/queries";
import { MatchList } from "../matches/match-list";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Skeleton } from "../ui/skeleton";
import { EmptyState, ErrorState } from "../ui/states";
import { PlayerPicker, usePlayerParam } from "./player-picker";

export function MatchesView() {
  const [player, setPlayer] = usePlayerParam();
  const profile = useProfile(player);
  const qc = useQueryClient();
  const puuid = profile.data?.data.account.puuid;
  const refresh = async () => {
    if (!puuid || !player) return;
    await api.refresh(puuid, player.platform).catch(() => undefined);
    await qc.invalidateQueries({ queryKey: ["matches", puuid] });
    toast.success(t("Match history refreshed"));
  };
  return (
    <div>
      <PageHeader title={t("Match History")} description={t("Every game with builds, damage and objectives. Expand a match for the full scoreboard.")} />
      <PlayerPicker player={player} onChange={setPlayer} className="mb-3" />
      {!player ? (
        <Card>
          <EmptyState title={t("Choose a player")} description={t("Enter a Riot ID above to load their matches.")} />
        </Card>
      ) : profile.isLoading ? (
        <Skeleton className="h-[480px] rounded-[14px]" />
      ) : profile.error || !puuid ? (
        <Card>
          <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
        </Card>
      ) : (
        <Card className="p-4">
          <MatchList region={player.platform} puuid={puuid} onRefresh={refresh} />
        </Card>
      )}
    </div>
  );
}
