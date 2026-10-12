import { Suspense } from "react";
import { TierListView } from "@/components/views/tier-list-view";

export const metadata = { title: "Tier List" };

export default function Page() {
  return (
    <Suspense>
      <TierListView />
    </Suspense>
  );
}
