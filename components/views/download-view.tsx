"use client";

import { Download, Keyboard, Layers, MonitorPlay, ShieldCheck, Sparkles, Users, Wand } from "lucide-react";
import type { ReactNode } from "react";
import { asset } from "@/lib/assets";
import { useIsDesktop } from "@/lib/desktop";
import { useDesktopRelease } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { buttonVariants } from "../ui/button";
import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

const FEATURES: { icon: ReactNode; title: string; text: string }[] = [
  { icon: <Wand />, title: "Auto import", text: "Lock in a champion and your runes, summoner spells and item set are set up in the client." },
  { icon: <Users />, title: "Loading-screen scouting", text: "Rank, champion mastery, recent form and tags for all ten players while the game loads." },
  { icon: <Layers />, title: "In-game widgets", text: "Build with the next item, your stats and lane opponent. Turn each one on or off." },
  { icon: <MonitorPlay />, title: "Live client", text: "Detects your League client and opens the live game automatically." },
];

const HOTKEYS: [string, string][] = [
  ["Ctrl + Shift + N", "show / hide widgets"],
  ["Ctrl + Shift + S", "show / hide scouting table"],
  ["Ctrl + Shift + E", "move widgets"],
];

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`;
const date = (iso: string) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/** Public download page for the Windows desktop app (latest GitHub release). */
export function DownloadView() {
  const q = useDesktopRelease();
  const desktop = useIsDesktop();
  const r = q.data?.release ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      {/* hero */}
      <Card className="glow-border relative overflow-hidden p-0">
        <img
          src={asset.championSplash("Yasuo", 0)}
          alt=""
          aria-hidden
          className="art-duotone absolute inset-0 h-full w-full object-cover object-[70%_20%] opacity-40 [mask-image:linear-gradient(to_left,black_30%,transparent_85%)]"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
        <div className="art-tint absolute inset-0 opacity-70 [mask-image:linear-gradient(to_left,black_30%,transparent_85%)]" aria-hidden />
        <div className="relative px-6 py-9 sm:px-10 sm:py-12">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">
            <Sparkles className="size-3.5" /> Desktop app
          </p>
          <h1 className="mt-3 max-w-md text-3xl font-bold leading-tight tracking-tight sm:text-4xl">NEXUS for Windows</h1>
          <p className="mt-2 max-w-md text-[15px] leading-relaxed text-muted">Everything from the website, plus auto import, scouting and in-game widgets that work with your League client.</p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            {desktop ? (
              <span className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm font-semibold text-success">You&apos;re already using the desktop app.</span>
            ) : q.isLoading ? (
              <Skeleton className="h-12 w-[250px] rounded-lg" />
            ) : r ? (
              <a href={r.url} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "min-w-[250px]")} download>
                <Download /> Download for Windows
              </a>
            ) : (
              <span className="rounded-lg border border-line bg-surface-hover/60 px-4 py-3 text-sm text-muted">
                {q.data?.configured === false ? "Downloads aren't set up on this server yet." : "The first build is on its way — check back in a few minutes."}
              </span>
            )}
            {r && !desktop && (
              <span className="text-xs leading-relaxed text-muted tabular">
                {r.name} · {mb(r.size)}
                <br />
                {date(r.publishedAt)} · Windows 10/11
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* features */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <Card key={f.title} className="p-4">
            <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary [&_svg]:size-[18px]">{f.icon}</span>
            <h2 className="mt-3 text-[15px] font-semibold">{f.title}</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">{f.text}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {/* install steps */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <ShieldCheck className="size-4 text-primary" /> How to install
          </h2>
          <ol className="mt-4 space-y-3.5">
            {[
              <>Download the installer and open it.</>,
              <>
                Windows may show <b className="text-fg">“Windows protected your PC”</b> because the installer isn&apos;t code-signed. Click <b className="text-fg">More info</b>, then <b className="text-fg">Run anyway</b>.
              </>,
              <>Finish the setup and start NEXUS. It finds your League client by itself.</>,
              <>
                For widgets over the game, set League to <b className="text-fg">Borderless</b> or <b className="text-fg">Windowed</b> (Settings → Video → Window mode).
              </>,
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-muted">
                <span className="grid size-6 shrink-0 place-items-center rounded-full border border-primary/50 bg-primary-soft text-xs font-bold text-primary">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* hotkeys + note */}
        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Keyboard className="size-4 text-primary" /> In-game hotkeys
          </h2>
          <ul className="mt-4 space-y-2">
            {HOTKEYS.map(([k, v]) => (
              <li key={k} className="flex items-center justify-between gap-3 text-sm">
                <kbd className="rounded-md border border-line bg-surface-hover/60 px-2 py-1 text-[12px] font-semibold text-fg">{k}</kbd>
                <span className="text-right text-muted">{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 border-t border-line-soft pt-4 text-xs leading-relaxed text-dim">
            NEXUS only reads data your client already shows you. It never changes game files and never asks for your Riot password.
          </p>
        </Card>
      </div>
    </div>
  );
}
