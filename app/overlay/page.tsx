import { Suspense } from "react";
import { OverlayView } from "@/components/views/overlay-view";

export const metadata = { title: "Overlay" };

export default function OverlayPage() {
  return (
    <Suspense>
      <OverlayView />
    </Suspense>
  );
}
