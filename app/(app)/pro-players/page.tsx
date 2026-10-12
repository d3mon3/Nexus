import { Suspense } from "react";
import { ProPlayersView } from "@/components/views/pro-players-view";

export const metadata = { title: "Pro Players" };

export default function Page() {
  return (
    <Suspense>
      <ProPlayersView />
    </Suspense>
  );
}
