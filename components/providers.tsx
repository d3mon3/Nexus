"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster, toast } from "sonner";
import { getBridge, useClientState } from "@/lib/desktop";
import { resolveRegion } from "@/lib/regions";
import { SettingsProvider, useSettings } from "@/lib/settings";
import { StaticDataProvider } from "@/lib/static-context";
import { LangProvider, type Lang } from "@/lib/i18n";

/** Keeps the Electron shell in sync with settings and surfaces import results as toasts. */
function DesktopSync() {
  const { settings, update } = useSettings();
  const client = useClientState();
  // First run of the desktop app: use the account logged into the League client.
  useEffect(() => {
    const s = client?.summoner;
    const platform = resolveRegion(s?.platform ?? "")?.platform;
    if (!settings.myAccount && s?.gameName && platform) update({ myAccount: { gameName: s.gameName, tagLine: s.tagLine, platform }, region: platform });
  }, [client?.summoner, settings.myAccount, update]);
  const anyWidget = Object.values(settings.widgets).some((w) => w.enabled);
  useEffect(() => {
    getBridge()?.setPrefs?.({ import: settings.importPrefs, scoutAutoShow: settings.scoutAutoShow, widgetsEnabled: anyWidget });
  }, [settings.importPrefs, settings.scoutAutoShow, anyWidget]);
  useEffect(
    () =>
      getBridge()?.onImport?.((r) => {
        const ok = [r.runes, r.spells, r.items].includes("ok");
        (ok ? toast.success : toast.error)(ok ? "Build imported" : "Import failed", { description: r.text });
      }),
    [],
  );
  return null;
}

function MotionPrefs({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
  }, [settings.reduceMotion]);
  return <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>{children}</MotionConfig>;
}

export function Providers({ children, lang = "pl" }: { children: ReactNode; lang?: Lang }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} themes={["dark", "light"]} value={{ dark: "dark", light: "light" }}>
      <QueryClientProvider client={client}>
        <SettingsProvider>
          <LangProvider initial={lang}>
          <StaticDataProvider>
            <MotionPrefs>{children}</MotionPrefs>
            <DesktopSync />
            <Toaster
              theme="dark"
              position="bottom-right"
              toastOptions={{ className: "!bg-[#101729] !border !border-[#2b3355] !text-[#F5F6FF] !shadow-[0_0_24px_-8px_#7042FF]" }}
            />
          </StaticDataProvider>
          </LangProvider>
        </SettingsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
