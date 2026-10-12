"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Bell, FlaskConical, Menu, Monitor, Moon, Search, Settings, Sun, User, X } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";
import { useClientState } from "@/lib/desktop";
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
    <header className="sticky top-0 z-40 flex h-[68px] items-center gap-3 border-b border-line-soft/60 bg-bg/70 px-4 backdrop-blur-xl lg:px-6">
      <button className="grid size-10 place-items-center rounded-lg text-muted hover:text-fg lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
        <Menu className="size-5" />
      </button>
      <Link href="/" className="lg:hidden" aria-label="NEXUS home">
        <Logo size="sm" />
      </Link>

      <div className="flex flex-1 justify-center">
        <button
          onClick={() => setPaletteOpen(true)}
          className="group flex h-11 w-full max-w-[580px] items-center gap-3 rounded-xl border border-line bg-surface-2/70 px-4 text-left text-sm text-dim transition-all hover:border-primary/50 hover:shadow-[0_0_24px_-10px_var(--primary-glow)]"
          aria-label="Search a player, champion or match (Ctrl+K)"
        >
          <Search className="size-[18px] text-muted transition-colors group-hover:text-primary" />
          <span className="flex-1 truncate">Search a player, champion or match…</span>
          <kbd className="hidden rounded-md border border-line bg-surface-hover/60 px-1.5 py-0.5 text-[11px] text-muted sm:inline">Ctrl K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {status.data?.mode === "demo" && (
          <Tooltip content="No Riot API key configured — showing labelled demo data." side="bottom">
            <Link href="/settings#data" className="hidden items-center gap-1.5 rounded-full border border-warning/40 bg-warning/10 px-2.5 py-1 text-[11px] font-semibold text-warning md:flex">
              <FlaskConical className="size-3.5" /> DEMO
            </Link>
          </Tooltip>
        )}
        {(status.data?.mode === "offline" || status.data?.keyRejected) && (
          <Tooltip content={status.data.keyRejected ? "The server's Riot API key expired. The admin can paste a new one at /admin." : "The server has no Riot API key yet. The admin can add it at /admin."} side="bottom">
            <span className="hidden items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-[11px] font-semibold text-danger md:flex">
              <FlaskConical className="size-3.5" /> {status.data.keyRejected ? "KEY EXPIRED" : "NO API KEY"}
            </span>
          </Tooltip>
        )}
        {client?.connected && (
          <Tooltip content={`League client: ${client.phase}`} side="bottom">
            <span className="hidden items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-[11px] font-semibold text-success md:flex">
              <Monitor className="size-3.5" /> CLIENT
            </span>
          </Tooltip>
        )}
        <Select
          className="w-[92px]"
          label="Region"
          value={settings.region}
          onChange={(v) => update({ region: v as Platform })}
          options={REGIONS.map((r) => ({ value: r.platform, label: r.label }))}
          align="right"
        />
        <ThemeToggle />
        <Notifications demo={status.data?.mode === "demo"} clientPhase={client?.connected ? client.phase : null} />
        <AvatarMenu />
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
              aria-label="Menu"
            >
              <div className="mb-6 flex items-center justify-between">
                <Logo size="sm" />
                <button onClick={() => setDrawer(false)} aria-label="Close menu" className="text-muted hover:text-fg">
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

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = !mounted || resolvedTheme !== "light";
  return (
    <button
      onClick={() => setTheme(dark ? "light" : "dark")}
      className="grid size-10 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-hover/60 hover:text-fg"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
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
    clientPhase && { title: "League client detected", body: `Current phase: ${clientPhase}`, href: "/live" },
    { title: "Patch data refreshed", body: "Champion, item and rune data loaded from Data Dragon.", href: "/tier-list" },
  ].filter(Boolean) as { title: string; body: string; href: string }[];
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Notifications (${items.length})`} className="relative grid size-10 place-items-center rounded-lg text-muted hover:bg-surface-hover/60 hover:text-fg">
        <Bell className="size-[18px]" />
        {items.length > 0 && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-danger shadow-[0_0_8px_var(--danger)]" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="panel absolute right-0 z-50 mt-2 w-80 p-2">
            <p className="px-2 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-dim">Notifications</p>
            {items.map((n) => (
              <Link key={n.title} href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-surface-hover">
                <p className="text-sm font-medium text-fg">{n.title}</p>
                <p className="text-xs text-muted">{n.body}</p>
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
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Account menu" className="grid size-11 place-items-center rounded-full border-2 border-primary/40 p-0.5 transition-colors hover:border-primary">
        <ProfileIcon id={profile.data?.data.account.profileIconId ?? 29} size={36} className="rounded-full" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="panel absolute right-0 z-50 mt-2 w-56 p-1.5 text-sm">
            {me && (
              <p className="truncate px-3 py-2 text-xs text-muted">
                Signed in as <span className="text-fg">{me.gameName}#{me.tagLine}</span>
              </p>
            )}
            {me && (
              <Link onClick={() => setOpen(false)} href={profileHref(me.platform, me.gameName, me.tagLine)} className={cn("flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-hover")}>
                <User className="size-4" /> My profile
              </Link>
            )}
            <Link onClick={() => setOpen(false)} href="/settings" className="flex items-center gap-2 rounded-md px-3 py-2 hover:bg-surface-hover">
              <Settings className="size-4" /> Settings
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
