"use client";


import { t } from "@/lib/i18n";
import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleCheck, Download, Moon, Sparkles, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { asset } from "@/lib/assets";
import { useIsDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { isActive, NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const desktop = useIsDesktop();
  return (
    <nav aria-label={t("Main")} className="flex flex-col gap-1">
      {NAV.map((item, i) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <div key={item.href}>
            {/* Personal pages first, then champion data and tools. */}
            {i === 5 && <div className="mx-2 my-2 h-px bg-line-soft" />}
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group relative flex h-[46px] items-center gap-3 rounded-xl px-3 text-[14.5px] font-medium transition-colors",
                active ? "font-semibold text-white light:text-primary" : "text-fg/85 hover:bg-white/[0.05] hover:text-fg light:hover:bg-white/60",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  transition={{ type: "spring", stiffness: 520, damping: 42 }}
                  className="absolute inset-0 rounded-xl border border-[#8fb6ff]/70 bg-[linear-gradient(90deg,rgba(79,145,255,0.55),rgba(79,145,255,0.22))] shadow-[0_0_18px_-4px_rgba(79,145,255,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] light:border-white light:bg-white/90 light:bg-none light:shadow-[0_6px_18px_-8px_rgba(64,76,160,0.45)]"
                />
              )}
              <Icon className={cn("relative size-[20px] transition-transform group-hover:scale-110", active ? "text-white light:text-primary" : "text-[#9fb4e8] group-hover:text-fg light:text-fg/75")} strokeWidth={1.9} />
              <span className="relative">{t(item.label)}</span>
            </Link>
          </div>
        );
      })}
      {!desktop && (
        <Link
          href="/download"
          onClick={onNavigate}
          aria-current={pathname === "/download" ? "page" : undefined}
          className={cn(
            "mt-3 flex h-[46px] items-center gap-3 rounded-xl border px-3 text-[14px] font-semibold transition-colors",
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
    <aside className="panel sticky top-[68px] mb-3 ml-3 hidden h-[calc(100dvh-80px)] w-[235px] shrink-0 flex-col overflow-hidden !rounded-[18px] lg:flex light:border-white/80 light:bg-white/45">
      <div className="flex-1 overflow-y-auto px-2.5 pt-3 scrollbar-none">
        <SidebarNav />
      </div>
      <SidebarPromo />
      <ThemeSwitch />
    </aside>
  );
}

/** Promo card with champion art: augment tiers (Arena / ARAM Chaos). */
function SidebarPromo() {
  return (
    <div className="hero-tile mx-2.5 mb-2.5 shrink-0 border border-[#8fb6ff]/40">
      <img
        src={asset.championCentered("Seraphine", 0)}
        alt=""
        aria-hidden
        className="absolute inset-0 -z-10 h-full w-full object-cover object-[60%_15%]"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#15124a] via-[#2b2580]/75 to-[#2b2580]/10" />
      <div className="px-3.5 pb-3.5 pt-[92px] text-white">
        <p className="text-[19px] font-bold leading-tight">{t("Augment tiers")}</p>
        <ul className="mt-2 space-y-1 text-[12.5px] text-white/90">
          {["Arena and ARAM Chaos", "Best augments for your champion", "In-game widget"].map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <CircleCheck className="size-3.5 shrink-0 text-[#8fb6ff]" /> {t(f)}
            </li>
          ))}
        </ul>
        <Link href="/augments" className="mt-3 flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[linear-gradient(90deg,#4f91ff,#8365ff)] text-[14px] font-semibold shadow-[0_6px_18px_-6px_rgba(79,145,255,0.8)] transition hover:brightness-110">
          <Sparkles className="size-4" /> {t("Open")}
        </Link>
      </div>
    </div>
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
    <div className="mx-2.5 mb-2.5 flex w-fit gap-1 rounded-2xl border border-line-soft bg-surface-2/60 p-1 light:border-white/80 light:bg-white/50">
      <button className={btn(!dark)} onClick={() => setTheme("light")} aria-label={t("Switch to light theme")}>
        <Sun className="size-4" />
      </button>
      <button className={btn(dark)} onClick={() => setTheme("dark")} aria-label={t("Switch to dark theme")}>
        <Moon className="size-4" />
      </button>
    </div>
  );
}
