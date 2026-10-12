import { Suspense } from "react";
import { SettingsView } from "@/components/views/settings-view";

export const metadata = { title: "Settings" };

export default function Page() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
