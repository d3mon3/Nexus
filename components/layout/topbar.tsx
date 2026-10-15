"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Download, FlaskConical, Menu, Minus, Monitor, Moon, Search, Settings, Square, Sun, User, X } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { getBridge, useClientState, useUpdateState } from "@/lib/desktop";
import { useProfile, useStatus } from "@/lib/queries";
import { REGIONS, profileHref, type Platform } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";
import { ProfileIcon } from "../game/icons";
import { Select } from "../ui/select";
import { Tooltip } from "../ui/tooltip";
import { CommandPalette } from "./command-palette";
import { Logo } from "./logo";
import { SidebarNav } from "./sidebar";

export function Topbar() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { settings, update } = useSettings();
  const status = useStatus();
  const client = useClientState();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" || e.key === "K") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="app-drag sticky top-0 z-40 flex h-[68px] items-center gap-2 border-b border-line-soft/60 bg-bg/70 px-3 backdrop-blur-xl sm:gap-3 sm:px-4 lg:px-6">
      <button className="grid size-10 place-items-center rounded-lg text-muted hover:text-fg lg:hidden" onClick={() => setDrawer(true)} aria-label={t("Open menu")}>
        <Menu className="size-5" />
      </button>
      <Link href="/" className="lg:hidden" aria-label={t("NEXUS home")}>
        <Logo size="sm" />
      </Link>

      <div className="flex min-w-0 flex-1 justify-end sm:justify-center">
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex h-11 w-11 shrink-0 items-center justify-center gap-3 rounded-xl sm:w-full sm:max-w-[580px] sm:justify-start border border-line bg-surface-2/70 text-left text-sm text-dim transition-all sm:px-4 hover:border-primary/50 hover:shadow-[0_0_24px_-10px_var(--primary-glow)]"
          aria-label={t("Search a player, champion or match (Ctrl+K)")}
        >
          <Search className="size-[18px] text-muted transition-colors group-hover:text-primary" />
          <span className="hidden flex-1 truncate sm:inline">{t("Search a player, champion or match…")}</span>
          <kbd className="hidden rounded-md border border-line bg-surface-hover/60 px-1.5 py-0.5 text-[11px] text-muted sm:inline">{t("Ctrl K")}</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {status.data?.mode === "demo" && (
          <Tooltip content={t("No Riot API key configured — showing labelled demo data.")} side="bottom">
            <Link href="/settings#data" className="hidden items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning md:flex">
              <FlaskConical className="size-3.5" />{" " + t("DEMO")}</Link>
          </Tooltip>
        )}
        {(status.data?.mode === "offline" || status.data?.keyRejected) && (
          <Tooltip content={status.data.keyRejected ? t("The server's Riot API key expired. The admin can paste a new one at /admin.") : t("The server has no Riot API key yet. The admin can add it at /admin.")} side="bottom">
            <span className="hidden items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger md:flex">
              <FlaskConical className="size-3.5" /> {status.data.keyRejected ? t("KEY EXPIRED") : t("NO API KEY")}
            </span>
          </Tooltip>
        )}
        {client?.connected && (
          <Tooltip content={t("League client: {0}", [client.phase])} side="bottom">
            <span className="hidden items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success md:flex">
              <Monitor className="size-3.5" />{" " + t("CLIENT")}</span>
          </Tooltip>
        )}
        <Select
          className="hidden w-[92px] sm:block"
          label={t("Region")}
          value={settings.region}
          onChange={(v) => update({ region: v as Platform })}
          options={REGIONS.map((r) => ({ value: r.platform, label: t(r.label) }))}
          align="right"
        />
        <span className="hidden sm:contents">
          <ThemeToggle />
        </span>
        <UpdateButton />
        <Notifications demo={status.data?.mode === "demo"} clientPhase={client?.connected ? client.phase : null} />
        <AvatarMenu />
        <WindowControls />
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />

      <AnimatePresence>
        {drawer && (
          <motion.div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDrawer(false)}>
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 400, damping: 38 }}
              className="h-full w-[260px] border-r border-line bg-sidebar p-4"
              onClick={(e) => e.stopPropagation()}
              aria-label={t("Menu")}
            >
              <div className="mb-6 flex items-center justify-between">
                <Logo size="sm" />
                <button onClick={() => setDrawer(false)} aria-label={t("Close menu")} className="text-muted hover:text-fg">
                  <X className="size-5" />
                </button>
              </div>
              <SidebarNav onNavigate={() => setDrawer(false)} />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/** Desktop: "Update" button with an in-app download progress bar. */
function UpdateButton() {
  const u = useUpdateState();
  if (u.state === "none") return null;
  const bridge = getBridge();
  if (u.state === "downloading" || u.state === "installing") {
    const pctDone = u.state === "installing" ? 100 : Math.round(u.progress * 100);
    return (
      <div className="flex w-[170px] flex-col gap-1 rounded-lg border border-primary/50 bg-primary-soft px-3 py-1.5">
        <span className="flex items-center justify-between text-[11px] font-semibold text-fg">
          {u.state === "installing" ? t("Installing…") : t("Downloading update")}
          <span className="tabular text-muted">{pctDone}%</span>
        </span>
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
          <span className="block h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${pctDone}%` }} />
        </span>
      </div>
    );
  }
  return (
    <Tooltip content={u.state === "error" ? t("Update failed: {0}. Click to try again.", [u.message]) : t("New version {0} — downloads and installs inside NEXUS, then restarts.", [u.name])} side="bottom">
      <button
        onClick={() => bridge?.installUpdate?.()}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-white shadow-[0_0_18px_-6px_var(--primary-glow)] transition hover:brightness-110",
          u.state === "error" ? "bg-danger" : "animate-pulse bg-primary",
        )}
      >
        <Download className="size-3.5" />
        {u.state === "error" ? t("Try again") : t("Update now")}
      </button>
    </Tooltip>
  );
}

/** Desktop (Windows): our own minimise / maximise / close buttons instead of the system title bar. */
function WindowControls() {
  const [bridge, setBridge] = useState<ReturnType<typeof getBridge>>(null);
  useEffect(() => setBridge(getBridge()), []);
  if (!bridge?.windowControl || bridge.platform !== "win32") return null;
  const btn = "grid h-10 w-11 place-items-center rounded-md text-muted transition-colors hover:bg-surface-hover/70 hover:text-fg";
  return (
    <div className="-mr-2 ml-1 flex items-center border-l border-line-soft/60 pl-1 sm:-mr-3 lg:-mr-5">
      <button className={btn} onClick={() => bridge.windowControl!("minimize")} aria-label={t("Minimise")}>
        <Minus className="size-4" />
      </button>
      <button className={btn} onClick={() => bridge.windowControl!("maximize")} aria-label={t("Maximise")}>
        <Square className="size-3.5" />
      </button>
      <button className={cn(btn, "hover:bg-danger hover:text-white")} onClick={() => bridge.windowControl!("close")} aria-label={t("Close")}>
        <X className="size-4" />
      </button>
    </div>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-hover/60 hover:text-fg"
      aria-label={dark ? t("Switch to light theme") : t("Switch to dark theme")}
    >
      {dark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Notifications({ demo, clientPhase }: { demo: boolean; clientPhase: string | null }) {
  const { open, setOpen, ref } = usePopover();
  const items = [
    demo && { title: "Demo mode is on", body: "Add RIOT_API_KEY to your .env to load real player data.", href: "/settings#data" },
    clientPhase && { title: "League client detected", body: t("Current phase: {0}", [clientPhase]), href: "/live" },
    { title: "Patch data refreshed", body: "Champion, item and rune data loaded from Data Dragon.", href: "/tier-list" },
  ].filter(Boolean) as { title: string; body: string; href: string }[];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("Notifications ({0})", [items.length])} className="relative grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-hover/60 hover:text-fg">
        <Bell className="size-[18px]" />
        {items.length > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger shadow-[0_0_8px_var(--danger)]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="panel absolute right-0 z-50 mt-2 w-80 p-2">
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-dim">{t("Notifications")}</p>
            {items.map((n) => (
              <Link key={n.title} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-hover">
                <p className="text-sm font-medium text-fg">{t(n.title)}</p>
                <p className="text-xs text-muted">{t(n.body)}</p>
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AvatarMenu() {
  const { settings } = useSettings();
  const profile = useProfile(settings.myAccount);
  const { open, setOpen, ref } = usePopover();
  const me = settings.myAccount;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t("Account menu")} className="grid size-11 place-items-center rounded-full border-2 border-primary/40 p-0.5 transition-colors hover:border-primary">
        <ProfileIcon id={profile.data?.data.account.profileIconId ?? 29} size={36} className="rounded-full" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="panel absolute right-0 z-50 mt-2 w-56 p-1.5 text-sm">
            {me && (
              <p className="truncate px-3 py-2 text-xs text-muted">{t("Signed in as") + " "}<span className="text-fg">{me.gameName}#{me.tagLine}</span>
              </p>
            )}
            {me && (
              <Link onClick={() => setOpen(false)} href={profileHref(me.platform, me.gameName, me.tagLine)} className={cn("flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-hover")}>
                <User className="size-4" />{" " + t("My profile")}</Link>
            )}
            <Link onClick={() => setOpen(false)} href="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-hover">
              <Settings className="size-4" />{" " + t("Settings")}</Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
