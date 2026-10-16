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
    <div className="flex min-h-dvh">
      {/* Glass theme: soft painted champion art behind everything. */}
      <div className="pointer-events-none fixed inset-0 -z-10 hidden overflow-hidden light:block" aria-hidden>
        <img src={asset.championCentered("Lux", 0)} alt="" className="absolute right-[-8%] top-[-6%] h-[115%] w-[75%] object-cover object-[50%_20%] opacity-[0.28] blur-[3px] saturate-[0.85] [mask-image:radial-gradient(70%_70%_at_60%_40%,black,transparent)]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <img src={asset.championCentered("Janna", 0)} alt="" className="absolute bottom-[-10%] left-[-10%] h-[70%] w-[55%] object-cover opacity-[0.18] blur-[4px] [mask-image:radial-gradient(60%_60%_at_40%_60%,black,transparent)]" onError={(e) => (e.currentTarget.style.display = "none")} />
      </div>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-white">{t("Skip to content")}</a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            id="main"
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-10 pt-2 sm:px-4 lg:px-4"
          >
            {children}
          </motion.main>
        </AnimatePresence>
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-6 text-[11px] leading-relaxed text-dim">{t("NEXUS isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.")}</footer>
      </div>
    </div>
  );
}
