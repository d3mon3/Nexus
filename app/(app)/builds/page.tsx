import { Suspense } from "react";
import { BuildsView } from "@/components/views/builds-view";

export const metadata = { title: "Meta & Builds" };

export default function Page() {
  return (
    <Suspense>
      <BuildsView />
    </Suspense>
  );
}
