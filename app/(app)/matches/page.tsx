import { Suspense } from "react";
import { MatchesView } from "@/components/views/matches-view";

export const metadata = { title: "Match History" };

export default function Page() {
  return (
    <Suspense>
      <MatchesView />
    </Suspense>
  );
}
