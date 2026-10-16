"use client";


import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { asset } from "@/lib/assets";
import { useIsDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isActive, NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const desktop = useIsDesktop();
  return (
    <nav aria-label={t("Main")} className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex h-[44px] items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
              active ? "font-semibold text-fg light:text-primary" : "text-fg/80 hover:bg-white/[0.035] hover:text-fg light:hover:bg-white/60",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className="absolute inset-0 rounded-xl border border-[#a58df8]/80 bg-[linear-gradient(90deg,rgba(80,68,170,0.45),rgba(22,25,51,0.9))] shadow-[0_0_16px_-6px_rgba(150,120,255,0.8)] light:border-white light:bg-white/90 light:bg-none light:shadow-[0_6px_18px_-8px_rgba(64,76,160,0.45)]"
              />
            )}
            <Icon className={cn("relative size-[19px] transition-transform group-hover:scale-110", active ? "text-fg light:text-primary" : "text-muted group-hover:text-primary light:text-fg/75")} strokeWidth={1.9} />
            <span className="relative">{t(item.label)}</span>
          </Link>
        );
      })}
      {!desktop && (
        <Link
          href="/download"
          onClick={onNavigate}
          aria-current={pathname === "/download" ? "page" : undefined}
          className={cn(
            "mt-3 flex h-[44px] items-center gap-3 rounded-xl border px-3 text-[14px] font-semibold transition-colors",
            pathname === "/download" ? "border-primary/70 bg-primary-soft text-fg" : "border-primary/35 bg-primary-soft/50 text-primary hover:border-primary/70 hover:text-fg",
          )}
        >
          <Download className="size-[19px]" strokeWidth={1.9} />{t("Download app")}</Link>
      )}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col overflow-hidden border-r border-line-soft bg-sidebar/80 backdrop-blur-xl lg:flex light:top-3 light:m-3 light:mr-0 light:h-[calc(100dvh-24px)] light:rounded-[22px] light:border light:border-white/80 light:bg-white/45 light:shadow-[0_12px_40px_-18px_rgba(64,76,160,0.45)] light:backdrop-blur-2xl">
      <div className="px-5 pb-4 pt-4">
        <Link href="/" aria-label={t("NEXUS home")} className="flex items-center gap-2.5">
          <Logo />
          <span className="rounded-md border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-muted light:border-primary/20 light:bg-white/70 light:text-primary">BETA</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 scrollbar-none">
        <SidebarNav />
      </div>
      <SidebarPromo />
      <ThemeSwitch />
    </aside>
  );
}

/** Promo tile with champion art: what's new in NEXUS (augment tiers). */
function SidebarPromo() {
  return (
    <Link href="/augments" className="hero-tile group mx-3 mb-3 block h-[190px] shrink-0">
      <img
        src={asset.championCentered("Seraphine", 0)}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_20%] transition-transform duration-500 group-hover:scale-105"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#1d1a5c]/95 via-[#3b2f9a]/50 to-transparent" />
      <div className="absolute inset-x-4 bottom-4 text-white">
        <p className="text-[18px] font-bold leading-tight">{t("Augment tiers")}</p>
        <p className="mt-1 text-[12px] leading-snug text-white/80">{t("Arena and ARAM Chaos — the best augments for your champion.")}</p>
        <span className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/30 bg-white/15 text-[13px] font-semibold backdrop-blur-md transition group-hover:bg-white/25">
          <Sparkles className="size-4" /> {t("Open")}
        </span>
      </div>
    </Link>
  );
}

/** Light (glass) / dark switch at the bottom of the sidebar. */
function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  const btn = (on: boolean) => cn("grid h-9 w-11 place-items-center rounded-xl transition", on ? (dark ? "bg-surface-hover text-fg" : "bg-white text-primary shadow-[0_4px_12px_-4px_rgba(64,76,160,0.45)]") : "text-muted hover:text-fg");
  return (
    <div className="mx-3 mb-3 flex w-fit gap-1 rounded-2xl border border-line-soft bg-surface-2/60 p-1 light:border-white/80 light:bg-white/50">
      <button className={btn(!dark)} onClick={() => setTheme("light")} aria-label={t("Switch to light theme")}>
        <Sun className="size-4" />
      </button>
      <button className={btn(dark)} onClick={() => setTheme("dark")} aria-label={t("Switch to dark theme")}>
        <Moon className="size-4" />
      </button>
    </div>
  );
}
