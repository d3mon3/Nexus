import { Suspense } from "react";
import { ScoutOverlayView } from "@/components/views/scout-overlay-view";

export const metadata = { title: "Scouting" };

export default function ScoutOverlayPage() {
  return (
    <Suspense>
      <ScoutOverlayView />
    </Suspense>
  );
}
