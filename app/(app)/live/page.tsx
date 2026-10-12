import { Suspense } from "react";
import { LiveView } from "@/components/views/live-view";

export const metadata = { title: "Live Game" };

export default function Page() {
  return (
    <Suspense>
      <LiveView />
    </Suspense>
  );
}
