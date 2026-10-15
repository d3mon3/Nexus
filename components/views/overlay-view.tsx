"use client";


import { t } from "@/lib/i18n";
import { Coins, Crosshair, Move, Swords, Timer } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { duration } from "@/lib/format";
import { demoLiveSnapshot } from "@/lib/demo-live";
import { findMe, getBridge, useClientState, useLiveClient, type LiveClientSnapshot } from "@/lib/desktop";
import { useChampionBuild } from "@/lib/queries";
import { WIDGET_META, useSettings, type WidgetId } from "@/lib/settings";
import { SPELLS } from "@/lib/static-data";
import { antiHealFor, itemAlerts } from "@/lib/enemy-items";
import { AugmentList } from "../augments/augment-list";
import { useStatic } from "@/lib/static-context";
import { cn } from "@/lib/utils";
import { ChampionIcon, ItemIcon, SpellIcon } from "../game/icons";
import { Logo } from "../layout/logo";

type Snap = LiveClientSnapshot;
type Player = Snap["players"][number];

const spellId = (name: string) => Number(Object.entries(SPELLS).find(([, s]) => s.name.toLowerCase() === name.toLowerCase())?.[0] ?? 0);

function useSnapshot(): Snap | null {
  const params = useSearchParams();
  const demo = params?.get("demo") === "1";
  const live = useLiveClient(!demo, 2000);
  const [demoSnap, setDemoSnap] = useState<Snap | null>(null);
  useEffect(() => {
    if (demo) demoLiveSnapshot().then(setDemoSnap);
  }, [demo]);
  return demo ? demoSnap : live;
}

/**
 * Transparent full-screen overlay. Each widget can be switched on/off in Settings and,
 * in edit mode (Alt+V by default), dragged anywhere — positions are saved as screen fractions.
 */
export function OverlayView() {
  const params = useSearchParams();
  const widget = params?.get("widget") as WidgetId | null;
  return widget ? <SingleWidget id={widget} /> : <FullOverlay />;
}

/**
 * Desktop: one widget per small transparent window. The window is sized to the content
 * (reported to the main process) and dragged by the OS in edit mode.
 */
function SingleWidget({ id }: { id: WidgetId }) {
  const { settings, updateWidget } = useSettings();
  const [edit, setEdit] = useState(false);
  const snap = useSnapshot();
  const client = useClientState();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.documentElement.classList.add("overlay-root");
    const offEdit = getBridge()?.onOverlayEdit?.(setEdit);
    const offMoved = getBridge()?.onWidgetMoved?.((m) => m.id === id && updateWidget(id, { x: m.x, y: m.y }));
    return () => {
      offEdit?.();
      offMoved?.();
    };
  }, [id, updateWidget]);
  useEffect(() => {
    const el = box.current;
    const bridge = getBridge();
    if (!el || !bridge?.setWidgetSize) return;
    const report = () => bridge.setWidgetSize!(el.offsetWidth * settings.overlayScale + 2, el.offsetHeight * settings.overlayScale + 2);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => ro.disconnect();
  }, [settings.overlayScale]);
  if (!WIDGET_META[id]) return null;
  const me = findMe(snap, client?.summoner);
  // Augment tiers only make sense in Arena / ARAM Mayhem: stay invisible in other modes.
  if (id === "augments" && !edit && snap && snap.gameMode !== "CHERRY" && snap.gameMode !== "KIWI") return <div ref={box} />;
  return (
    <div
      ref={box}
      className={cn("w-max min-w-[200px] max-w-[320px] select-none rounded-xl border bg-[#070a13]/92 p-3 text-fg", edit ? "cursor-move border-primary ring-2 ring-primary/50" : "border-[#a58df8]/35")}
      style={{ opacity: settings.overlayOpacity, transform: `scale(${settings.overlayScale})`, transformOrigin: "top left", ...(edit ? ({ WebkitAppRegion: "drag" } as React.CSSProperties) : {}) }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b8a4fb]">{t(WIDGET_META[id].name)}</span>
        {edit ? <Move className="size-3.5 text-primary" /> : <Logo size="sm" className="h-[12px] opacity-70" />}
      </div>
      {edit && <p className="mb-1.5 text-[10px] text-primary">{t("Drag to move · Alt+{0} to lock", [settings.hotkeys.edit])}</p>}
      {!snap || !me ? <p className="text-xs text-muted">{t("Waiting for game data…")}</p> : <WidgetBody id={id} snap={snap} me={me} />}
    </div>
  );
}

function FullOverlay() {
  const { settings } = useSettings();
  const params = useSearchParams();
  const [edit, setEdit] = useState(params?.get("edit") === "1");
  const snap = useSnapshot();
  const client = useClientState();

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    return getBridge()?.onOverlayEdit?.(setEdit);
  }, []);

  const me = findMe(snap, client?.summoner);
  const ids = (Object.keys(settings.widgets) as WidgetId[]).filter((id) => settings.widgets[id].enabled);

  return (
    <div className={cn("fixed inset-0 select-none overflow-hidden", edit && "bg-black/35")} style={{ opacity: settings.overlayOpacity }}>
      {edit && (
        <div className="absolute left-1/2 top-6 -translate-x-1/2 rounded-xl border border-primary/60 bg-[#0b0f1a]/95 px-4 py-2 text-center text-sm text-fg shadow-[0_0_30px_-8px_var(--primary-glow)]">
          <p className="font-semibold">{t("Edit layout — drag widgets to move them")}</p>
          <p className="text-xs text-muted">{t("Press Alt+{0} again to lock. Turn widgets on or off in NEXUS → Settings.", [settings.hotkeys.edit])}</p>
          <button className="mt-1 text-xs text-primary hover:underline" onClick={() => (getBridge()?.setOverlayEdit ? getBridge()!.setOverlayEdit!(false) : setEdit(false))}>{t("Done")}</button>
        </div>
      )}
      {ids.map((id) => (
        <DraggableWidget key={id} id={id} edit={edit}>
          {!snap || !me ? <Waiting /> : <WidgetBody id={id} snap={snap} me={me} />}
        </DraggableWidget>
      ))}
    </div>
  );
}

function Waiting() {
  return <p className="text-xs text-muted">{t("Waiting for a game…")}</p>;
}

function DraggableWidget({ id, edit, children }: { id: WidgetId; edit: boolean; children: ReactNode }) {
  const { settings, updateWidget } = useSettings();
  const cfg = settings.widgets[id];
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: cfg.x, y: cfg.y });
  useEffect(() => setPos({ x: cfg.x, y: cfg.y }), [cfg.x, cfg.y]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!edit) return;
    const el = ref.current!;
    el.setPointerCapture(e.pointerId);
    const start = { px: e.clientX, py: e.clientY, x: pos.x, y: pos.y };
    const move = (ev: PointerEvent) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setPos({
        x: Math.min(0.98, Math.max(0, start.x + (ev.clientX - start.px) / w)),
        y: Math.min(0.97, Math.max(0, start.y + (ev.clientY - start.py) / h)),
      });
    };
    const up = (ev: PointerEvent) => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      const w = window.innerWidth;
      const h = window.innerHeight;
      updateWidget(id, {
        x: Math.min(0.98, Math.max(0, start.x + (ev.clientX - start.px) / w)),
        y: Math.min(0.97, Math.max(0, start.y + (ev.clientY - start.py) / h)),
      });
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute w-max min-w-[220px] max-w-[320px] rounded-xl border bg-[#070a13]/92 p-3 text-fg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9)]",
        edit ? "cursor-grab border-primary/80 ring-2 ring-primary/40 active:cursor-grabbing" : "border-[#a58df8]/35",
      )}
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: `scale(${settings.overlayScale})`, transformOrigin: "top left" }}
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#b8a4fb]">{t(WIDGET_META[id].name)}</span>
        {edit ? <Move className="size-3.5 text-primary" /> : <Logo size="sm" className="h-[12px] opacity-70" />}
      </div>
      {children}
    </div>
  );
}

function WidgetBody({ id, snap, me }: { id: WidgetId; snap: Snap; me: Player }) {
  switch (id) {
    case "build":
      return <BuildWidget me={me} />;
    case "stats":
      return <StatsWidget snap={snap} me={me} />;
    case "timers":
      return <TimersWidget snap={snap} />;
    case "lane":
      return <LaneWidget snap={snap} me={me} />;
    case "enemySpells":
      return <EnemyWidget snap={snap} me={me} />;
    case "enemyItems":
      return <EnemyItemsWidget snap={snap} me={me} />;
    case "augments":
      return <AugmentsWidget snap={snap} me={me} />;
  }
}

/** Arena / ARAM Mayhem: best augments for my champion (glance at it when the choice appears). */
function AugmentsWidget({ snap, me }: { snap: Snap; me: Player }) {
  const { findChampion } = useStatic();
  const mode = snap.gameMode === "CHERRY" ? "arena" : snap.gameMode === "KIWI" ? "aram-mayhem" : null;
  const champ = findChampion(me.championName);
  const build = useChampionBuild(mode ? champ?.id : null, null, undefined, mode ?? "sr");
  if (!mode) return <p className="max-w-[220px] text-[11px] text-muted">{t("Only in Arena and ARAM Chaos.")}</p>;
  const list = build.data?.data?.augments ?? [];
  return (
    <div className="w-[260px]">
      <AugmentList augments={list} limit={8} compact arena={mode === "arena"} />
    </div>
  );
}

function EnemyItemsWidget({ snap, me }: { snap: Snap; me: Player }) {
  const { findChampion } = useStatic();
  const alerts = itemAlerts(snap.players.filter((p) => p.team !== me.team));
  // Remember when each alert first appeared, to highlight new ones for 20 s.
  const firstSeen = useRef(new Map<string, number>());
  const now = Date.now();
  for (const a of alerts) if (!firstSeen.current.has(a.rule.id)) firstSeen.current.set(a.rule.id, now);
  if (!alerts.length) return <p className="max-w-[240px] text-[11px] text-muted">{t("Nothing to watch out for yet — alerts appear when enemies buy key items.")}</p>;
  const myChamp = findChampion(me.championName);
  return (
    <div className="max-w-[280px] space-y-2">
      {alerts.map((a) => {
        const fresh = now - (firstSeen.current.get(a.rule.id) ?? 0) < 20_000;
        return (
          <div key={a.rule.id} className={cn("rounded-lg border px-2 py-1.5", fresh ? "border-warning/70 bg-warning/10" : "border-line-soft")}>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[12px] font-semibold", fresh ? "text-warning" : "text-fg")}>{t(a.rule.title)}</span>
              <span className="ml-auto flex gap-1">
                {a.owners.slice(0, 4).map((o) => (
                  <span key={o.championName} className="relative">
                    <ChampionIcon id={findChampion(o.championName)?.id ?? 0} size={20} rounded="md" tooltip={false} />
                    <ItemIcon id={o.items[0]} size={12} className="absolute -bottom-1 -right-1 rounded-sm ring-1 ring-black" />
                  </span>
                ))}
              </span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{t(a.rule.tip)}</p>
            {a.rule.id === "sustain" && (
              <p className="mt-1 flex items-center gap-1 text-[10.5px] text-muted">
                {t("Suggested:")} <ItemIcon id={antiHealFor(myChamp)} size={16} />
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BuildWidget({ me }: { me: Player }) {
  const { findChampion } = useStatic();
  const champ = findChampion(me.championName);
  const role = (me.position ?? undefined) as "TOP" | "JUNGLE" | "MIDDLE" | "BOTTOM" | "UTILITY" | undefined;
  const build = useChampionBuild(champ?.id, role ?? null);
  const items = build.data?.data?.popular.items ?? [];
  const next = items.find((id) => !me.items.includes(id));
  if (!champ) return <Waiting />;
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <ChampionIcon id={champ.id} size={26} rounded="md" tooltip={false} />
        <span className="text-sm font-semibold">{champ.name}</span>
      </div>
      <div className="flex gap-1">
        {items.map((id) => (
          <ItemIcon key={id} id={id} size={32} className={cn(id === next ? "ring-2 ring-primary shadow-[0_0_12px_var(--primary-glow)]" : me.items.includes(id) ? "opacity-35 grayscale" : undefined)} />
        ))}
      </div>
      {next && <p className="mt-1.5 text-[11px] text-muted">{t("Next: highlighted item")}</p>}
    </div>
  );
}

function StatsWidget({ snap, me }: { snap: Snap; me: Player }) {
  const mins = Math.max(1, snap.gameTime / 60);
  const cell = (icon: ReactNode, value: ReactNode, label: string) => (
    <div className="rounded-lg bg-white/[0.05] px-2 py-1.5 text-center">
      <div className="mx-auto mb-0.5 flex justify-center text-[#b8a4fb] [&_svg]:size-3.5">{icon}</div>
      <p className="text-sm font-bold tabular">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {cell(<Swords />, `${me.kills}/${me.deaths}/${me.assists}`, "KDA")}
      {cell(<Crosshair />, `${me.cs} · ${(me.cs / mins).toFixed(1)}`, "CS · per min")}
      {cell(<Coins />, snap.activeGold ?? "—", `Gold · Lvl ${me.level}`)}
    </div>
  );
}

function TimersWidget({ snap }: { snap: Snap }) {
  const last = (name: string) => snap.events.filter((e) => e.name === name).at(-1);
  const next = (name: string, first: number, respawn: number) => {
    const e = last(name);
    return Math.max(0, (e ? e.time + respawn : first) - snap.gameTime);
  };
  // Standard Summoner's Rift timings.
  const rows: [string, number | null][] = [
    ["Dragon", next("DragonKill", 300, 300)],
    // Herald leaves the pit shortly before Baron spawns.
    ["Rift Herald", last("HeraldKill") || snap.gameTime > 1185 ? null : Math.max(0, 840 - snap.gameTime)],
    ["Baron", next("BaronKill", 1200, 360)],
  ];
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-[11px] text-muted">
        <Timer className="size-3" /> {duration(snap.gameTime)}
      </p>
      {rows.map(([label, v]) => (
        <div key={label} className="flex items-center justify-between gap-6 text-sm">
          <span className="text-fg/85">{label}</span>
          <span className={cn("font-bold tabular", v === 0 ? "text-success" : "text-fg")}>{v === null ? "—" : v === 0 ? t("UP") : duration(v)}</span>
        </div>
      ))}
    </div>
  );
}

function LaneWidget({ snap, me }: { snap: Snap; me: Player }) {
  const { findChampion } = useStatic();
  const opp = snap.players.find((p) => p.team !== me.team && p.position && p.position === me.position);
  if (!opp) return <p className="text-xs text-muted">{t("No lane opponent detected (needs a matchmade game).")}</p>;
  const cs = me.cs - opp.cs;
  const lvl = me.level - opp.level;
  const tone = (v: number) => (v > 0 ? "text-success" : v < 0 ? "text-loss" : "text-fg");
  return (
    <div className="flex items-center gap-3">
      <ChampionIcon id={findChampion(me.championName)?.id ?? 0} size={30} rounded="md" tooltip={false} />
      <div className="flex-1 text-center">
        <p className={cn("text-sm font-bold tabular", tone(cs))}>
          {cs > 0 ? "+" : ""}
          {cs}{" " + t("CS")}</p>
        <p className={cn("text-xs font-semibold tabular", tone(lvl))}>
          {lvl > 0 ? "+" : ""}
          {lvl}{" " + t("lvl")}</p>
      </div>
      <ChampionIcon id={findChampion(opp.championName)?.id ?? 0} size={30} rounded="md" tooltip={false} />
    </div>
  );
}

function EnemyWidget({ snap, me }: { snap: Snap; me: Player }) {
  const { findChampion } = useStatic();
  const enemies = snap.players.filter((p) => p.team !== me.team);
  return (
    <div className="space-y-1">
      {enemies.map((p) => (
        <div key={p.riotId} className="flex items-center gap-2">
          <ChampionIcon id={findChampion(p.championName)?.id ?? 0} size={24} rounded="md" tooltip={false} />
          <SpellIcon id={spellId(p.spells[0])} size={20} />
          <SpellIcon id={spellId(p.spells[1])} size={20} />
          <span className="ml-auto text-[11px] text-muted tabular">{t("Lvl") + " "}{p.level}</span>
        </div>
      ))}
    </div>
  );
}
