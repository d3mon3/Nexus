"use client";


import { t } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpDown, Clock, CornerDownLeft, Search, Star, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { parseRiotId, profileHref, regionLabel } from "@/lib/regions";
import { useSettings } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { NAV } from "./nav";

interface Result {
  id: string;
  group: string;
  label: ReactNode;
  hint?: string;
  icon: ReactNode;
  href: string;
}

/** Ctrl/⌘+K palette: players (Riot ID), champions, recent & favourite profiles, pages. */
export function CommandPalette({ open, onClose, initialQuery = "" }: { open: boolean; onClose: () => void; initialQuery?: string }) {
  const router = useRouter();
  const { settings } = useSettings();
  const { champions } = useStatic();
  const [q, setQ] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ(initialQuery);
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open, initialQuery]);

  const results = useMemo<Result[]>(() => {
    const out: Result[] = [];
    const query = q.trim();
    const lower = query.toLowerCase();
    const riotId = parseRiotId(query.includes("#") ? query : "");
    if (riotId) {
      out.push({
        id: "player",
        group: "Player",
        label: (
          <>
            {riotId.gameName}
            <span className="text-muted">#{riotId.tagLine}</span>
          </>
        ),
        hint: regionLabel(settings.region),
        icon: <User className="size-4" />,
        href: profileHref(settings.region, riotId.gameName, riotId.tagLine),
      });
    } else if (query.length >= 3 && !query.includes("#")) {
      out.push({
        id: "player-hint",
        group: "Player",
        label: <span className="text-muted">{t("Add a tag to search a player — e.g.") + " "}{query}{t("#EUW")}</span>,
        icon: <User className="size-4" />,
        href: profileHref(settings.region, query, settings.region.replace(/\d+$/, "").toUpperCase()),
      });
    }

    const players = [...settings.favorites.map((p) => ({ ...p, fav: true })), ...settings.recent.map((p) => ({ ...p, fav: false }))];
    const seen = new Set<string>();
    for (const p of players) {
      const key = `${p.gameName}#${p.tagLine}@${p.platform}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (lower && !`${p.gameName}#${p.tagLine}`.toLowerCase().includes(lower)) continue;
      out.push({
        id: `p-${key}`,
        group: p.fav ? "Favorites" : "Recent",
        label: (
          <>
            {p.gameName}
            <span className="text-muted">#{p.tagLine}</span>
          </>
        ),
        hint: regionLabel(p.platform),
        icon: p.fav ? <Star className="size-4 text-warning" /> : <Clock className="size-4" />,
        href: profileHref(p.platform, p.gameName, p.tagLine),
      });
    }

    if (lower) {
      champions
        .filter((c) => c.name.toLowerCase().includes(lower) || c.key.toLowerCase().includes(lower))
        .slice(0, 6)
        .forEach((c) => out.push({ id: `c-${c.id}`, group: "Champions", label: c.name, hint: c.title, icon: <ChampionIcon id={c.id} size={22} tooltip={false} rounded="md" />, href: `/champions/${c.key.toLowerCase()}` }));
      NAV.filter((n) => n.label.toLowerCase().includes(lower)).forEach((n) => {
        const Icon = n.icon;
        out.push({ id: `n-${n.href}`, group: "Pages", label: n.label, icon: <Icon className="size-4" />, href: n.href });
      });
    }
    return out.slice(0, 14);
  }, [q, settings, champions]);

  const go = (r: Result | undefined) => {
    if (!r) return;
    onClose();
    router.push(r.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => Math.min(results.length - 1, a + 1));
    else if (e.key === "ArrowUp") setActive((a) => Math.max(0, a - 1));
    else if (e.key === "Enter") go(results[active]);
    else if (e.key === "Escape") onClose();
    else return;
    e.preventDefault();
  };

  let lastGroup = "";
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={t("Search")}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="panel glow-border w-full max-w-xl overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-line-soft px-4">
              <Search className="size-4 text-primary" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder={t("Search a player (Name#TAG), champion or page…")}
                className="h-14 flex-1 bg-transparent text-[15px] text-fg outline-none placeholder:text-dim"
                aria-controls="palette-results"
                aria-activedescendant={results[active] ? `pr-${results[active].id}` : undefined}
              />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">{t("ESC")}</kbd>
            </div>
            <ul id="palette-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted">{t("Type a Riot ID like") + " "}<span className="text-fg">{t("d3monek#EUW")}</span>{" " + t("or a champion name.")}</li>}
              {results.map((r, i) => {
                const header = r.group !== lastGroup ? r.group : null;
                lastGroup = r.group;
                return (
                  <li key={r.id} role="presentation">
                    {header && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-dim">{header}</p>}
                    <div
                      id={`pr-${r.id}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(r)}
                      className={cn("flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm", i === active ? "bg-primary-soft text-fg" : "text-fg/90")}
                    >
                      <span className="grid size-7 place-items-center text-muted">{r.icon}</span>
                      <span className="flex-1 truncate">{t(r.label)}</span>
                      {r.hint && <span className="truncate text-xs text-dim">{t(r.hint)}</span>}
                      {i === active && <CornerDownLeft className="size-3.5 text-primary" />}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-4 border-t border-line-soft px-4 py-2 text-[11px] text-dim">
              <span className="flex items-center gap-1">
                <ArrowUpDown className="size-3" />{" " + t("navigate")}</span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3" />{" " + t("open")}</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
