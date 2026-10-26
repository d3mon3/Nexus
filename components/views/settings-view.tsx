"use client";


import { LANGS, t, useLanguage, type Lang } from "@/lib/i18n";
import { Database, Download, Gamepad2, History, Keyboard, LayoutDashboard, Monitor, Move, Palette, RotateCcw, Search, SearchX, UserRound, Users, X, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getBridge, useClientState, useIsDesktop } from "@/lib/desktop";
import { useStatus } from "@/lib/queries";
import { parseRiotId, REGIONS, regionLabel, type Platform } from "@/lib/regions";
import { WIDGET_META, useSettings, type WidgetId } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { cn } from "@/lib/utils";
import { ChampionIcon } from "../game/icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { PageHeader } from "../ui/page-header";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Segmented } from "../ui/tabs";

type Cat = "account" | "appearance" | "client" | "ingame" | "hotkeys" | "app" | "data";

/** Categories in the settings menu; `anchors` keep old /settings#… links working. */
const CATS: { id: Cat; label: string; hint: string; icon: LucideIcon; anchors?: string[] }[] = [
  { id: "account", label: "Account", hint: "Riot ID, region, history", icon: UserRound },
  { id: "appearance", label: "Appearance", hint: "Language, theme, motto", icon: Palette },
  { id: "client", label: "League client", hint: "Auto-accept, runes and items import", icon: Gamepad2, anchors: ["import"] },
  { id: "ingame", label: "In game", hint: "Widgets and scouting board", icon: LayoutDashboard, anchors: ["overlay", "scouting"] },
  { id: "hotkeys", label: "Keyboard shortcuts", hint: "Alt + letter in game", icon: Keyboard },
  { id: "app", label: "Desktop app", hint: "Windows start, tray, fullscreen", icon: Monitor, anchors: ["desktop"] },
  { id: "data", label: "Data & reset", hint: "Riot API status, reset", icon: Database },
];

/** Search text; rows that don't match hide themselves, sections without rows too. */
const SearchCtx = createContext("");

function Section({ id, icon, title, description, children }: { id?: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  const q = useContext(SearchCtx);
  return (
    <Card id={id} className={cn("scroll-mt-24 p-5", q && "[&:not(:has([data-row]))]:hidden")}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-primary/30 bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      <div className="divide-y divide-line-soft/60 [&>*]:py-3 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">{children}</div>
    </Card>
  );
}

function NoResults() {
  const ref = useRef<HTMLDivElement>(null);
  const q = useContext(SearchCtx);
  const [empty, setEmpty] = useState(false);
  useEffect(() => {
    setEmpty(!ref.current?.parentElement?.querySelector("[data-row]"));
  }, [q]);
  return (
    <div ref={ref} className={cn("panel flex flex-col items-center gap-2 p-8 text-center text-sm text-muted", !empty && "hidden")}>
      <SearchX className="size-6" />
      {t("No settings match your search.")}
    </div>
  );
}

/** Letters League already uses with Alt (self-cast, level-up, items…) are left out. */
const HOTKEY_LETTERS = "ABCGHIJKLMNOTUVXYZ".split("");

function HotkeyRow({ label, value, onChange, taken }: { label: string; value: string; onChange: (v: string) => void; taken: string[] }) {
  return (
    <Row label={label}>
      <Select
        size="sm"
        className="w-[120px]"
        label={label}
        value={value}
        onChange={onChange}
        options={HOTKEY_LETTERS.filter((l) => l === value || !taken.includes(l)).map((l) => ({ value: l, label: `Alt + ${l}` }))}
      />
    </Row>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  const q = useContext(SearchCtx);
  if (q && ![label, hint ?? "", t(label), hint ? t(hint) : ""].join(" ").toLowerCase().includes(q)) return null;
  return (
    <div data-row className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0 flex-1 basis-[240px]">
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
          {t(label)}
        </label>
        {hint && <p className="text-xs text-muted">{t(hint)}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const { settings, update, reset, updateWidget } = useSettings();
  const setImport = (patch: Partial<typeof settings.importPrefs>) => update((s) => ({ importPrefs: { ...s.importPrefs, ...patch } }));
  const { theme, setTheme } = useTheme();
  const status = useStatus();
  const desktop = useIsDesktop();
  const client = useClientState();
  const { champion } = useStatic();
  const [riotId, setRiotId] = useState(settings.myAccount ? `${settings.myAccount.gameName}#${settings.myAccount.tagLine}` : "");
  const [accRegion, setAccRegion] = useState<Platform>(settings.myAccount?.platform ?? settings.region);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const parsed = parseRiotId(riotId);
  const { lang, setLanguage } = useLanguage();

  const [cat, setCat] = useState<Cat>("account");
  const [query, setQuery] = useState("");
  // deep links like /settings#data open the right category
  useEffect(() => {
    const pick = () => {
      const h = window.location.hash.slice(1);
      const found = CATS.find((c) => c.id === h || c.anchors?.includes(h));
      if (found) setCat(found.id);
    };
    pick();
    window.addEventListener("hashchange", pick);
    return () => window.removeEventListener("hashchange", pick);
  }, []);
  const q = query.trim().toLowerCase();
  const show = (c: Cat) => (q ? true : cat === c);

  return (
    <SearchCtx.Provider value={q}>
      <PageHeader title={t("Settings")} description={t("Everything is saved automatically.")} />
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-[84px] lg:self-start">
          <div className="panel p-2">
            <label className="mb-2 flex h-10 items-center gap-2 rounded-xl border border-line-soft bg-surface-2/50 px-3 text-sm focus-within:border-primary/60">
              <Search className="size-4 shrink-0 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("Search settings…")} className="w-full bg-transparent outline-none placeholder:text-muted" aria-label={t("Search settings")} />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted hover:text-fg" aria-label={t("Clear")}>
                  <X className="size-4" />
                </button>
              )}
            </label>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col scrollbar-none" aria-label={t("Settings categories")}>
              {CATS.map((c) => {
                const Icon = c.icon;
                const on = !q && cat === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setQuery("");
                      setCat(c.id);
                      history.replaceState(null, "", `#${c.id}`);
                    }}
                    className={cn(
                      "flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      on ? "bg-[linear-gradient(90deg,rgba(79,145,255,0.45),rgba(79,145,255,0.15))] font-semibold text-fg shadow-[inset_0_0_0_1px_rgba(143,182,255,0.5)] light:bg-white light:bg-none light:text-primary" : "text-fg/80 hover:bg-white/[0.05] hover:text-fg light:hover:bg-white/60",
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", on ? "text-white light:text-primary" : "text-[#9fb4e8] light:text-fg/70")} />
                    <span className="min-w-0">
                      <span className="block">{t(c.label)}</span>
                      <span className="hidden text-[11.5px] font-normal leading-tight text-muted lg:block">{t(c.hint)}</span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          {q && <p className="text-sm text-muted">{t("Results for “{0}”", [query.trim()])}</p>}
          {show("account") && (
            <>
              <Section id="account" icon={<UserRound />} title={t("Your account")} description={t("Used for the Home dashboard and as the default player everywhere.")}>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!parsed) return;
              update({ myAccount: { ...parsed, platform: accRegion } });
              toast.success(t("Account saved"), { description: `${parsed.gameName}#${parsed.tagLine} · ${regionLabel(accRegion)}` });
            }}
          >
            <Input wrapperClassName="flex-1 min-w-[200px]" value={riotId} onChange={(e) => setRiotId(e.target.value)} placeholder={t("Name#TAG")} aria-label={t("Your Riot ID")} />
            <Select className="w-[100px]" label={t("Account region")} value={accRegion} onChange={setAccRegion} options={REGIONS.map((r) => ({ value: r.platform, label: t(r.label) }))} />
            <Button type="submit" variant="primary" disabled={!parsed}>{t("Save")}</Button>
          </form>
          <Row label={t("Default region")} hint={t("Used for searches without an explicit region.")}>
            <Select className="w-[180px]" label={t("Default region")} value={settings.region} onChange={(v) => update({ region: v })} options={REGIONS.map((r) => ({ value: r.platform, label: `${r.label} — ${t(r.name)}` }))} align="right" />
          </Row>
        </Section>
              <Section icon={<History />} title={t("History")}>
                <Row label={t("Recently viewed")} hint={`${settings.recent.length} profiles`}>
            <Button size="sm" variant="outline" onClick={() => update({ recent: [] })} disabled={!settings.recent.length}>{t("Clear history")}</Button>
          </Row>
              </Section>
            </>
          )}

          {show("appearance") && <Section id="appearance" icon={<Palette />} title={t("Appearance")}>
          <Row label={t("Language")} hint={t("Interface language. Champion and item names stay as in the game data.")}>
            <Segmented label={t("Language")} value={lang} onChange={(v: Lang) => setLanguage(v)} items={LANGS.map((l) => ({ value: l.value, label: t(l.label) }))} />
          </Row>
          <Row label={t("Theme")} hint={t("Dark is the NEXUS default.")}>
            {mounted && (
              <Segmented
                label={t("Theme")}
                value={theme === "light" ? "light" : "dark"}
                onChange={setTheme}
                items={[
                  { value: "dark", label: t("Dark") },
                  { value: "light", label: t("Light") },
                ]}
              />
            )}
          </Row>
          <Row label={t("Reduce motion")} hint={t("Turns off animated transitions and glows.")} htmlFor="reduce-motion">
            <Switch id="reduce-motion" label={t("Reduce motion")} checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
          </Row>
          <Row label={t("Matches per page")}>
            <Select className="w-[90px]" label={t("Matches per page")} value={String(settings.matchesPerPage)} onChange={(v) => update({ matchesPerPage: Number(v) })} options={["5", "10", "15", "20"].map((v) => ({ value: v, label: v }))} align="right" />
          </Row>
          <Row label={t("Profile motto")} hint={t("Shown under your name on the dashboard.")}>
            <Input wrapperClassName="w-[260px]" value={settings.motto} maxLength={60} onChange={(e) => update({ motto: e.target.value })} aria-label={t("Profile motto")} />
          </Row>
        </Section>}

          {show("client") && (
            <>
              <Section id="client" icon={<Gamepad2 />} title={t("League client assistant")} description={t("Things NEXUS does for you while the League client is open. Desktop app only.")}>
          <Row label={t("Auto-accept queue")} hint={t("Accepts the match when it's found. You can still decline in the client during the delay.")} htmlFor="auto-accept">
            <Switch id="auto-accept" label={t("Auto-accept queue")} checked={settings.autoAccept} onChange={(v) => update({ autoAccept: v })} />
          </Row>
          <Row label={t("Accept after")}>
            <Select
              className="w-[110px]"
              label={t("Accept after")}
              value={String(settings.autoAcceptDelay)}
              onChange={(v) => update({ autoAcceptDelay: Number(v) })}
              options={["0", "2", "4", "6", "8"].map((v) => ({ value: v, label: t("{0} s", [v]) }))}
              align="right"
            />
          </Row>
          <Row label={t("Champ select assistant")} hint={t("Opens counters for your lane opponent, your win rates and ban suggestions when champ select starts.")} htmlFor="cs-assist">
            <Switch id="cs-assist" label={t("Champ select assistant")} checked={settings.champSelectAssist} onChange={(v) => update({ champSelectAssist: v })} />
          </Row>
          <Row label={t("Post-game summary")} hint={t("Shows your LP change and how you did against your lane opponent after every game.")} htmlFor="post-game">
            <Switch id="post-game" label={t("Post-game summary")} checked={settings.postGameSummary} onChange={(v) => update({ postGameSummary: v })} />
          </Row>
          <Row label={t("Discord status")} hint={t("Shows your champion and game mode on your Discord profile (Discord must be running).")} htmlFor="discord-rpc">
            <Switch id="discord-rpc" label={t("Discord status")} checked={settings.discordPresence} onChange={(v) => update({ discordPresence: v })} />
          </Row>
        </Section>
              <Section id="import" icon={<Download />} title={t("Auto import (champ select)")} description={t("When you lock in a champion, NEXUS writes the recommended setup into the League client. Desktop app only.")}>
          <Row label={t("Auto import")} hint={t("Master switch for everything below.")} htmlFor="imp-on">
            <Switch id="imp-on" label={t("Auto import")} checked={settings.importPrefs.enabled} onChange={(v) => setImport({ enabled: v })} />
          </Row>
          <Row label={t("Runes")} hint={t("Creates a “NEXUS …” rune page and selects it.")} htmlFor="imp-runes">
            <Switch id="imp-runes" label={t("Import runes")} checked={settings.importPrefs.runes} onChange={(v) => setImport({ runes: v })} />
          </Row>
          <Row label={t("Summoner spells")} htmlFor="imp-spells">
            <Switch id="imp-spells" label={t("Import summoner spells")} checked={settings.importPrefs.spells} onChange={(v) => setImport({ spells: v })} />
          </Row>
          <Row label={t("Flash on")} hint={t("Which key Flash is put on.")}>
            <Segmented
              label={t("Flash key")}
              value={settings.importPrefs.flashKey}
              onChange={(v) => setImport({ flashKey: v })}
              items={[
                { value: "D", label: "D" },
                { value: "F", label: "F" },
              ]}
            />
          </Row>
          <Row label={t("Item set")} hint={t("Adds the build to the in-game shop's recommended tab.")} htmlFor="imp-items">
            <Switch id="imp-items" label={t("Import item set")} checked={settings.importPrefs.items} onChange={(v) => setImport({ items: v })} />
          </Row>
          <Row label={t("Import on hover")} hint={t("Import while hovering, before you lock in.")} htmlFor="imp-hover">
            <Switch id="imp-hover" label={t("Import on hover")} checked={settings.importPrefs.onHover} onChange={(v) => setImport({ onHover: v })} />
          </Row>
        </Section>
            </>
          )}

          {show("ingame") && (
            <>
              <Section id="overlay" icon={<LayoutDashboard />} title={t("In-game widgets")} description={t("Small windows over League while you play. Turn on the ones you want.")}>
                {(Object.keys(WIDGET_META) as WidgetId[]).map((id) => (
            <Row key={id} label={t(WIDGET_META[id].name)} hint={t(WIDGET_META[id].description)} htmlFor={`w-${id}`}>
              <Switch id={`w-${id}`} label={t(WIDGET_META[id].name)} checked={settings.widgets[id].enabled} onChange={(v) => updateWidget(id, { enabled: v })} />
            </Row>
          ))}
          <Row label={t("Opacity")}>
            <input type="range" min={0.4} max={1} step={0.02} value={settings.overlayOpacity} onChange={(e) => update({ overlayOpacity: Number(e.target.value) })} className="w-40 accent-[var(--primary)]" aria-label={t("Overlay opacity")} />
          </Row>
          <Row label={t("Size")}>
            <input type="range" min={0.8} max={1.4} step={0.05} value={settings.overlayScale} onChange={(e) => update({ overlayScale: Number(e.target.value) })} className="w-40 accent-[var(--primary)]" aria-label={t("Overlay size")} />
          </Row>
                <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => getBridge()?.setOverlayEdit?.(true)} disabled={!desktop}>
              <Move />{" " + t("Move widgets")}</Button>
            <Button size="sm" variant="outline" onClick={() => getBridge()?.toggleOverlay(true)} disabled={!desktop}>{t("Show overlay")}</Button>
            <a href="/overlay?demo=1&edit=1" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline self-center">{t("Preview in browser")}</a>
          </div>
              </Section>
              <Section id="scouting" icon={<Users />} title={t("Loading-screen scouting")} description={t("Cards with rank, champion stats, recent form and tags for all 10 players.")}>
          <Row label={t("Show on loading screen")} hint={t("Opens automatically when the game loads and hides when it starts.")} htmlFor="scout-auto">
            <Switch id="scout-auto" label={t("Show scouting on loading screen")} checked={settings.scoutAutoShow} onChange={(v) => update({ scoutAutoShow: v })} />
          </Row>
          <Row label={t("Matches analysed per player")} hint={t("More = more accurate tags, but slower with a development API key.")}>
            <Select
              className="w-[100px]"
              label={t("Matches analysed")}
              value={String(settings.scoutDepth)}
              onChange={(v) => update({ scoutDepth: Number(v) })}
              options={["5", "10", "15", "20"].map((v) => ({ value: v, label: v }))}
              align="right"
            />
          </Row>
          <Button size="sm" variant="outline" onClick={() => getBridge()?.toggleScout?.(true)} disabled={!desktop}>{t("Show scouting now")}</Button>
        </Section>
            </>
          )}

          {show("hotkeys") && (
            <Section id="hotkeys" icon={<Keyboard />} title={t("Keyboard shortcuts")} description={t("Alt shortcuts work in game too.")}>
              <HotkeyRow label={t("Show / hide widgets")} value={settings.hotkeys.widgets} onChange={(v) => update((s) => ({ hotkeys: { ...s.hotkeys, widgets: v } }))} taken={[settings.hotkeys.scout, settings.hotkeys.edit]} />
          <HotkeyRow label={t("Show / hide scouting board")} value={settings.hotkeys.scout} onChange={(v) => update((s) => ({ hotkeys: { ...s.hotkeys, scout: v } }))} taken={[settings.hotkeys.widgets, settings.hotkeys.edit]} />
          <HotkeyRow label={t("Move widgets and the scouting board")} value={settings.hotkeys.edit} onChange={(v) => update((s) => ({ hotkeys: { ...s.hotkeys, edit: v } }))} taken={[settings.hotkeys.widgets, settings.hotkeys.scout]} />
              <div className="space-y-3 border-t border-line-soft pt-4">
                {[
            ["Ctrl / ⌘ + K", "Open search"],
            ["/", "Open search"],
            ["↑ ↓ Enter", "Navigate search results, dropdowns"],
            ["← →", "Switch tabs"],
            ["Esc", "Close menus and dialogs"],
            [`Alt + ${settings.hotkeys.widgets}`, "Show / hide in-game widgets (desktop)"],
            [`Alt + ${settings.hotkeys.edit}`, "Move widgets (desktop)"],
            [`Alt + ${settings.hotkeys.scout}`, "Show / hide scouting board (desktop)"],
          ].map(([k, d]) => (
            <Row key={k} label={d}>
              <kbd className="rounded-md border border-line bg-surface-hover/60 px-2 py-0.5 text-xs text-muted">{k}</kbd>
            </Row>
          ))}
              </div>
            </Section>
          )}

          {show("app") && (
            <Section id="desktop" icon={<Monitor />} title={t("Desktop app")} description={desktop ? t("NEXUS desktop is connected to this computer.") : t("Some options only apply in the NEXUS desktop app.")}>
              <Row label={t("Works in Fullscreen")} hint={t("Exclusive Fullscreen hides every overlay. NEXUS switches League to Borderless before the game — it looks the same.")} htmlFor="auto-borderless">
            <Switch id="auto-borderless" label={t("Works in Fullscreen")} checked={settings.autoBorderless} onChange={(v) => update({ autoBorderless: v })} />
          </Row>
          <Row label={t("Minimise NEXUS during games")} hint={t("Leaves CPU and graphics card to League. The window comes back after the game.")} htmlFor="min-in-game">
            <Switch id="min-in-game" label={t("Minimise NEXUS during games")} checked={settings.minimizeInGame} onChange={(v) => update({ minimizeInGame: v })} />
          </Row>
          <Row label={t("Start with Windows")} hint={t("NEXUS starts hidden in the tray and opens by itself when champion select begins.")} htmlFor="start-win">
            <Switch id="start-win" label={t("Start with Windows")} checked={settings.startWithWindows} onChange={(v) => update({ startWithWindows: v })} />
          </Row>
          <Row label={t("Windows notifications")} hint={t("Also shows NEXUS notifications (updates, new patch) in Windows while the app is in the background.")} htmlFor="sys-notif">
            <Switch id="sys-notif" label={t("Windows notifications")} checked={settings.systemNotifications} onChange={(v) => update({ systemNotifications: v })} />
          </Row>
          <Row label={t("Keep running in the tray")} hint={t("Closing the window keeps NEXUS in the tray (next to the clock). Quit from the tray menu.")} htmlFor="close-tray">
            <Switch id="close-tray" label={t("Keep running in the tray")} checked={settings.closeToTray} onChange={(v) => update({ closeToTray: v })} />
          </Row>
              <Row label={t("Live game refresh")} hint={t("How often the live game page polls for changes.")}>
            <Select
              className="w-[120px]"
              label={t("Live game refresh")}
              value={String(settings.liveRefreshSec)}
              onChange={(v) => update({ liveRefreshSec: Number(v) })}
              options={[
                { value: "15", label: "15 s" },
                { value: "30", label: "30 s" },
                { value: "60", label: "60 s" },
                { value: "0", label: t("Manual") },
              ]}
              align="right"
            />
          </Row>
          <Row label={t("Detect League client")} hint={t("Switches to the account logged into the client — also when you log into another account — and opens live games automatically.")} htmlFor="auto-detect">
            <Switch
              id="auto-detect"
              label={t("Detect League client")}
              checked={settings.autoDetectClient}
              onChange={(v) => {
                update({ autoDetectClient: v });
                getBridge()?.setAutoDetect(v);
              }}
            />
          </Row>
          {desktop && (
            <p className="text-xs text-muted">{t("Client status:") + " "}{client?.connected ? <span className="text-success">{t("connected ·") + " "}{client.phase}</span> : <span>{t("not running")}</span>}
              {client?.summoner && ` · ${client.summoner.gameName}#${client.summoner.tagLine}`}
            </p>
          )}
            </Section>
          )}

          {show("data") && (
            <>
              <Section id="data" icon={<Database />} title={t("Data & API")}>
                <Row label={t("Data mode")}>
            {status.data ? (
              <Badge variant={status.data.mode === "live" && !status.data.keyRejected ? "success" : "warning"}>
                {status.data.keyRejected ? t("Riot key expired") : status.data.mode === "live" ? t("Riot API connected") : status.data.mode === "offline" ? t("Waiting for Riot API key") : t("Demo mode")}
              </Badge>
            ) : (
              <Badge>{t("checking…")}</Badge>
            )}
          </Row>
          <Row label={t("Data Dragon version")}>
            <span className="text-sm text-muted tabular">{status.data?.ddragonVersion ?? "…"}</span>
          </Row>
          <Row label={t("Database cache")}>
            <Badge variant={status.data?.database ? "success" : "default"}>{status.data?.database ? t("PostgreSQL connected") : t("Memory only")}</Badge>
          </Row>
          <Row label={t("Aggregated dataset")} hint={t("Powers tier lists and builds.")}>
            <span className="text-sm text-muted">{status.data?.aggregateDataset ? t("patch {0} · {1} matches", [status.data.aggregateDataset.patch, status.data.aggregateDataset.matches.toLocaleString()]) : status.data?.mode === "offline" || status.data?.mode === "live" ? t("being collected") : t("not built — demo dataset shown")}</span>
          </Row>
          {status.data?.mode === "demo" && (
            <p className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted">{t("Add") + " "}<code className="text-fg">RIOT_API_KEY=RGAPI-…</code>{" " + t("to") + " "}<code className="text-fg">.env</code>{" " + t("and restart NEXUS to switch to real data. The key stays on the server and is never sent to the browser.")}</p>
          )}
              </Section>
              <Section icon={<RotateCcw />} title={t("Reset")} description={t("Brings back the default settings. Your account and history are cleared too.")}>
                <Row label={t("Reset all settings")}>
                  <Button
              variant="danger"
              size="sm"
              onClick={() => {
                reset();
                toast.success(t("Settings reset"));
              }}
            >
              <RotateCcw />{" " + t("Reset all settings")}</Button>
                </Row>
              </Section>
            </>
          )}

          {q && <NoResults />}
        </div>
      </div>
    </SearchCtx.Provider>
  );
}
