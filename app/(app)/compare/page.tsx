import { Suspense } from "react";
import { CompareView } from "@/components/views/compare-view";

export const metadata = { title: "Comparisons" };

export default function Page() {
  return (
    <Suspense>
      <CompareView />
    </Suspense>
  );
}
