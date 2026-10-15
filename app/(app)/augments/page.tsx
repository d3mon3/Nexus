import { Suspense } from "react";
import { AugmentsView } from "@/components/views/augments-view";

export const metadata = { title: "Augment tiers" };

export default function Page() {
  return (
    <Suspense>
      <AugmentsView />
    </Suspense>
  );
}
