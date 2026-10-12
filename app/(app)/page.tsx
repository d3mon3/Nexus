import { Suspense } from "react";
import { DashboardView } from "@/components/views/dashboard-view";

export default function HomePage() {
  return (
    <Suspense>
      <DashboardView />
    </Suspense>
  );
}
