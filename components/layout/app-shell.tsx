"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
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
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-white">
        Skip to content
      </a>
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
        <footer className="mx-auto w-full max-w-[1400px] px-4 pb-6 text-[11px] leading-relaxed text-dim">
          NEXUS isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
        </footer>
      </div>
    </div>
  );
}
