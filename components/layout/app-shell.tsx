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
    <div className="relative isolate min-h-dvh">
      {/* Champion art and soft light behind the glass panels. */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <img src={asset.championCentered("Lux", 0)} alt="" className="absolute right-[-4%] top-[-4%] h-[78%] w-[62%] object-cover object-[55%_18%] opacity-[0.55] saturate-[1.1] [mask-image:radial-gradient(65%_70%_at_55%_40%,black_35%,transparent_75%)] light:opacity-[0.4]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <img src={asset.championCentered("Janna", 0)} alt="" className="absolute bottom-[-6%] left-[-6%] h-[62%] w-[50%] object-cover object-[50%_25%] opacity-[0.6] [mask-image:radial-gradient(60%_65%_at_45%_55%,black_30%,transparent_75%)] light:opacity-[0.3]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <img src={asset.championCentered("Seraphine", 0)} alt="" className="absolute bottom-[-10%] right-[8%] h-[55%] w-[42%] object-cover object-[50%_20%] opacity-[0.5] [mask-image:radial-gradient(60%_60%_at_50%_50%,black_25%,transparent_75%)]" onError={(e) => (e.currentTarget.style.display = "none")} />
        <img src={asset.championCentered("Ahri", 0)} alt="" className="absolute left-[28%] top-[-12%] h-[48%] w-[36%] object-cover object-[50%_20%] opacity-[0.4] [mask-image:radial-gradient(55%_60%_at_50%_50%,black_20%,transparent_75%)]" onError={(e) => (e.currentTarget.style.display = "none")} />
        {/* light: soft glows that brighten parts of the window */}
        <div className="absolute right-[12%] top-[8%] size-[620px] rounded-full bg-[radial-gradient(circle,rgba(160,140,255,0.32),transparent_65%)] blur-2xl" />
        <div className="absolute left-[-5%] top-[35%] size-[520px] rounded-full bg-[radial-gradient(circle,rgba(90,160,255,0.26),transparent_65%)] blur-2xl" />
        <div className="absolute bottom-[-10%] left-[40%] size-[560px] rounded-full bg-[radial-gradient(circle,rgba(200,150,255,0.18),transparent_65%)] blur-2xl" />
        {/* keep text readable: gentle tint over the art */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,26,54,0.15),rgba(16,26,54,0.35))] light:bg-[linear-gradient(180deg,rgba(238,240,255,0.35),rgba(238,240,255,0.55))]" />
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
