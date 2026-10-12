import { Suspense } from "react";
import { LeaderboardsView } from "@/components/views/leaderboards-view";

export const metadata = { title: "Leaderboards" };

export default function Page() {
  return (
    <Suspense>
      <LeaderboardsView />
    </Suspense>
  );
}
