"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Download } from "lucide-react";
import { asset } from "@/lib/assets";
import { useIsDesktop } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { isActive, NAV } from "./nav";

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname() ?? "/";
  const desktop = useIsDesktop();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
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
              "group relative flex h-[40px] items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium transition-colors",
              active ? "font-semibold text-fg" : "text-fg/80 hover:bg-white/[0.035] hover:text-fg",
            )}
          >
            {active && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: "spring", stiffness: 520, damping: 42 }}
                className="absolute inset-0 rounded-lg border border-[#a58df8]/80 bg-[linear-gradient(90deg,rgba(80,68,170,0.45),rgba(22,25,51,0.9))] shadow-[0_0_16px_-6px_rgba(150,120,255,0.8)]"
              />
            )}
            <Icon className={cn("relative size-[18px] transition-transform group-hover:scale-110", active ? "text-fg" : "text-muted group-hover:text-primary")} strokeWidth={1.8} />
            <span className="relative">{item.label}</span>
          </Link>
        );
      })}
      {!desktop && (
        <Link
          href="/download"
          onClick={onNavigate}
          aria-current={pathname === "/download" ? "page" : undefined}
          className={cn(
            "mt-3 flex h-[40px] items-center gap-3 rounded-lg border px-3 text-[13.5px] font-semibold transition-colors",
            pathname === "/download" ? "border-primary/70 bg-primary-soft text-fg" : "border-primary/35 bg-primary-soft/50 text-primary hover:border-primary/70 hover:text-fg",
          )}
        >
          <Download className="size-[18px]" strokeWidth={1.9} />
          Download app
        </Link>
      )}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-dvh w-[188px] shrink-0 flex-col overflow-hidden border-r border-line-soft bg-sidebar/80 backdrop-blur-xl lg:flex">
      <div className="px-5 pt-4 pb-5">
        <Link href="/" aria-label="NEXUS home">
          <Logo />
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto px-3 scrollbar-none">
        <SidebarNav />
      </div>
      <SidebarArt />
    </aside>
  );
}

function SidebarArt() {
  return (
    <div className="relative h-[250px] shrink-0 overflow-hidden">
      <img
        src={asset.championLoading("Yasuo", 0)}
        alt=""
        aria-hidden
        className="art-duotone absolute inset-0 h-full w-full object-cover object-[40%_10%] opacity-45 [mask-image:linear-gradient(to_top,black_35%,transparent)]"
        onError={(e) => (e.currentTarget.style.display = "none")}
      />
      <div className="art-tint absolute inset-0 opacity-90 [mask-image:linear-gradient(to_top,black_35%,transparent)]" aria-hidden />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_20%_100%,rgba(112,66,255,0.35),transparent_70%)]" />
      <div className="absolute bottom-6 left-5 right-3">
        <p className="font-jp text-[26px] font-light tracking-[0.12em] text-fg/80">ネクサス</p>
        <p className="mt-2 text-[12px] tracking-[0.9em] text-fg/70">NEXUS</p>
        <p className="mt-5 text-[10px] font-medium leading-[1.9] tracking-[0.42em] text-muted">
          STATS BEYOND
          <br />
          THE GAME
        </p>
      </div>
    </div>
  );
}
