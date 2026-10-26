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
import { LangProvider, t, useLanguage, type Lang } from "@/lib/i18n";
import { notify } from "@/lib/notifications";
import { NotificationSources } from "./notification-sources";

/** Keeps the Electron shell in sync with settings and surfaces import results as toasts. */
function DesktopSync() {
  const { settings, update } = useSettings();
  const client = useClientState();
  // Follow the account logged into the League client: first run, and every time you log
  // into another account (a different account typed in Settings stays until the client changes).
  useEffect(() => {
    const s = client?.summoner;
    const platform = resolveRegion(s?.platform ?? "")?.platform;
    if (!s?.gameName || !s.tagLine || !platform) return;
    const id = `${s.gameName}#${s.tagLine}@${platform}`;
    if (!settings.myAccount) {
      update({ myAccount: { gameName: s.gameName, tagLine: s.tagLine, platform }, region: platform, lastClientAccount: id });
      return;
    }
    if (id === settings.lastClientAccount) return;
    if (!settings.autoDetectClient) {
      update({ lastClientAccount: id });
      return;
    }
    const same = settings.myAccount.gameName.toLowerCase() === s.gameName.toLowerCase() && settings.myAccount.tagLine.toLowerCase() === s.tagLine.toLowerCase() && settings.myAccount.platform === platform;
    update({ myAccount: { gameName: s.gameName, tagLine: s.tagLine, platform }, region: platform, lastClientAccount: id });
    if (!same && settings.lastClientAccount) {
      toast.success(t("Switched to {0}", [`${s.gameName}#${s.tagLine}`]), { description: t("NEXUS follows the account logged into the League client.") });
      notify({ id: `account:${id}:${Date.now()}`, kind: "info", title: t("Account switched"), body: t("Now showing {0}.", [`${s.gameName}#${s.tagLine}`]), href: "/" });
    }
  }, [client?.summoner, settings.myAccount, settings.lastClientAccount, settings.autoDetectClient, update]);
  const anyWidget = Object.values(settings.widgets).some((w) => w.enabled);
  const { lang } = useLanguage();
  useEffect(() => {
    getBridge()?.setPrefs?.({
      import: settings.importPrefs,
      scoutAutoShow: settings.scoutAutoShow,
      widgetsEnabled: anyWidget,
      autoAccept: settings.autoAccept,
      autoAcceptDelay: settings.autoAcceptDelay,
      champSelectAssist: settings.champSelectAssist,
      postGame: settings.postGameSummary,
      discord: settings.discordPresence,
      language: lang,
      widgets: settings.widgets,
      minimizeInGame: settings.minimizeInGame,
      autoBorderless: settings.autoBorderless,
      openAtLogin: settings.startWithWindows,
      closeToTray: settings.closeToTray,
      hotkeys: settings.hotkeys,
    });
  }, [settings.hotkeys, settings.importPrefs, settings.scoutAutoShow, anyWidget, settings.autoAccept, settings.autoAcceptDelay, settings.champSelectAssist, settings.postGameSummary, settings.discordPresence, lang, settings.widgets, settings.minimizeInGame, settings.autoBorderless, settings.startWithWindows, settings.closeToTray]);
  // Light mode while a game runs: no blur, glow animations or transitions (frees GPU for League).
  const inGame = Boolean(client?.connected && ["GameStart", "InProgress"].includes(client.phase));
  useEffect(() => {
    document.documentElement.classList.toggle("in-game", inGame);
  }, [inGame]);
  useEffect(
    () =>
      getBridge()?.onImport?.((r) => {
        const ok = [r.runes, r.spells, r.items].includes("ok");
        (ok ? toast.success : toast.error)(ok ? t("Build imported") : t("Import failed"), { description: t(r.text) });
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

/** Only the main window pushes settings to the desktop shell (overlay windows may be stale). */
function MainWindowSync() {
  const [main, setMain] = useState(false);
  useEffect(() => setMain(!window.location.pathname.startsWith("/overlay")), []);
  return main ? (
    <>
      <DesktopSync />
      <NotificationSources />
    </>
  ) : null;
}

export function Providers({ children, lang = "pl" }: { children: ReactNode; lang?: Lang }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
      }),
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" storageKey="nexus-theme-v3" enableSystem={false} themes={["dark", "light"]} value={{ dark: "dark", light: "light" }}>
      <QueryClientProvider client={client}>
        <SettingsProvider>
          <LangProvider initial={lang}>
          <StaticDataProvider>
            <MotionPrefs>{children}</MotionPrefs>
            <MainWindowSync />
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
