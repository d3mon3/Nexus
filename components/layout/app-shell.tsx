"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { asset } from "@/lib/assets";
import { getBridge } from "@/lib/desktop";
import { useSettings } from "@/lib/settings";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useSettings();
  // Desktop: jump to the live game page when the League client enters a game.
  useEffect(() => getBridge()?.onNavigate?.((p) => settings.autoDetectClient && router.push(p)), [router, settings.autoDetectClient]);
  return (
    <div className="min-h-dvh">
      {/* Soft champion art behind the glass panels. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <img src={asset.championCentered("Lux", 0)} alt="" className="absolute right-[-6%] top-[-8%] h-[110%] w-[72%] object-cover object-[50%_20%] opacity-[0.22] blur-[2px] saturate-[0.9] [mask-image:radial-gradient(70%_70%_at_60%_40%,black,transparent)] light:opacity-[0.28]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <img src={asset.championCentered("Janna", 0)} alt="" className="absolute bottom-[-12%] left-[-8%] h-[70%] w-[55%] object-cover opacity-[0.14] blur-[3px] [mask-image:radial-gradient(60%_60%_at_40%_60%,black,transparent)] light:opacity-[0.18]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_70%_20%,rgba(131,101,255,0.18),transparent_70%)] light:hidden" />
      </div>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-white">{t("Skip to content")}</a>
      <Topbar />
      <div className="flex">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AnimatePresence mode="wait" initial={false}>
            <motion.main
              id="main"
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="w-full flex-1 px-3 pb-8 pt-1 lg:pl-3 lg:pr-4"
            >
              {children}
            </motion.main>
          </AnimatePresence>
          <footer className="w-full px-4 pb-5 text-[11px] leading-relaxed text-dim">{t("NEXUS isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.")}</footer>
        </div>
      </div>
    </div>
  );
}
