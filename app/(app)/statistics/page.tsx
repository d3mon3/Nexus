import { Suspense } from "react";
import { StatisticsView } from "@/components/views/statistics-view";

export const metadata = { title: "Statistics" };

export default function Page() {
  return (
    <Suspense>
      <StatisticsView />
    </Suspense>
  );
}
