import { Suspense } from "react";
import { ChampionsView } from "@/components/views/champions-view";

export const metadata = { title: "Champions" };

export default function Page() {
  return (
    <Suspense>
      <ChampionsView />
    </Suspense>
  );
}
