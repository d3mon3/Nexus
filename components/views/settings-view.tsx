"use client";

import { Database, Download, Keyboard, LayoutDashboard, Monitor, Move, Palette, RotateCcw, Star, Trash2, UserRound, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { getBridge, useClientState, useIsDesktop } from "@/lib/desktop";
import { useStatus } from "@/lib/queries";
import { parseRiotId, REGIONS, regionLabel, type Platform } from "@/lib/regions";
import { WIDGET_META, useSettings, type WidgetId } from "@/lib/settings";
import { useStatic } from "@/lib/static-context";
import { ChampionIcon } from "../game/icons";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { PageHeader } from "../ui/page-header";
import { Select } from "../ui/select";
import { Switch } from "../ui/switch";
import { Segmented } from "../ui/tabs";

function Section({ id, icon, title, description, children }: { id?: string; icon: ReactNode; title: string; description?: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-9 place-items-center rounded-lg border border-primary/30 bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

function Row({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <label htmlFor={htmlFor} className="text-sm font-medium text-fg">
          {label}
        </label>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function SettingsView() {
  const { settings, update, reset, toggleFavorite, toggleFavoriteChampion, updateWidget } = useSettings();
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

  return (
    <div>
      <PageHeader title="Settings" description="Preferences are saved on this device." />
      <div className="grid gap-3 xl:grid-cols-2">
        <Section icon={<UserRound />} title="Your account" description="Used for the Home dashboard and as the default player everywhere.">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!parsed) return;
              update({ myAccount: { ...parsed, platform: accRegion } });
              toast.success("Account saved", { description: `${parsed.gameName}#${parsed.tagLine} · ${regionLabel(accRegion)}` });
            }}
          >
            <Input wrapperClassName="flex-1 min-w-[200px]" value={riotId} onChange={(e) => setRiotId(e.target.value)} placeholder="Name#TAG" aria-label="Your Riot ID" />
            <Select className="w-[100px]" label="Account region" value={accRegion} onChange={setAccRegion} options={REGIONS.map((r) => ({ value: r.platform, label: r.label }))} />
            <Button type="submit" variant="primary" disabled={!parsed}>
              Save
            </Button>
          </form>
          <Row label="Default region" hint="Used for searches without an explicit region.">
            <Select className="w-[180px]" label="Default region" value={settings.region} onChange={(v) => update({ region: v })} options={REGIONS.map((r) => ({ value: r.platform, label: `${r.label} — ${r.name}` }))} align="right" />
          </Row>
        </Section>

        <Section icon={<Palette />} title="Appearance">
          <Row label="Theme" hint="Dark is the NEXUS default.">
            {mounted && (
              <Segmented
                label="Theme"
                value={theme === "light" ? "light" : "dark"}
                onChange={setTheme}
                items={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                ]}
              />
            )}
          </Row>
          <Row label="Reduce motion" hint="Turns off animated transitions and glows." htmlFor="reduce-motion">
            <Switch id="reduce-motion" label="Reduce motion" checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
          </Row>
          <Row label="Matches per page">
            <Select className="w-[90px]" label="Matches per page" value={String(settings.matchesPerPage)} onChange={(v) => update({ matchesPerPage: Number(v) })} options={["5", "10", "15", "20"].map((v) => ({ value: v, label: v }))} align="right" />
          </Row>
          <Row label="Profile motto" hint="Shown under your name on the dashboard.">
            <Input wrapperClassName="w-[260px]" value={settings.motto} maxLength={60} onChange={(e) => update({ motto: e.target.value })} aria-label="Profile motto" />
          </Row>
        </Section>

        <Section icon={<Monitor />} title="Live game & desktop" description={desktop ? "NEXUS desktop is connected to this computer." : "Some options only apply in the NEXUS desktop app."}>
          <Row label="Live game refresh" hint="How often the live game page polls for changes.">
            <Select
              className="w-[120px]"
              label="Live game refresh"
              value={String(settings.liveRefreshSec)}
              onChange={(v) => update({ liveRefreshSec: Number(v) })}
              options={[
                { value: "15", label: "15 s" },
                { value: "30", label: "30 s" },
                { value: "60", label: "60 s" },
                { value: "0", label: "Manual" },
              ]}
              align="right"
            />
          </Row>
          <Row label="Detect League client" hint="Follow the account logged into the client and open live games automatically." htmlFor="auto-detect">
            <Switch
              id="auto-detect"
              label="Detect League client"
              checked={settings.autoDetectClient}
              onChange={(v) => {
                update({ autoDetectClient: v });
                getBridge()?.setAutoDetect(v);
              }}
            />
          </Row>
          {desktop && (
            <p className="text-xs text-muted">
              Client status: {client?.connected ? <span className="text-success">connected · {client.phase}</span> : <span>not running</span>}
              {client?.summoner && ` · ${client.summoner.gameName}#${client.summoner.tagLine}`}
            </p>
          )}
        </Section>

        <Section id="import" icon={<Download />} title="Auto import (champ select)" description="When you lock in a champion, NEXUS writes the recommended setup into the League client. Desktop app only.">
          <Row label="Auto import" hint="Master switch for everything below." htmlFor="imp-on">
            <Switch id="imp-on" label="Auto import" checked={settings.importPrefs.enabled} onChange={(v) => setImport({ enabled: v })} />
          </Row>
          <Row label="Runes" hint="Creates a “NEXUS …” rune page and selects it." htmlFor="imp-runes">
            <Switch id="imp-runes" label="Import runes" checked={settings.importPrefs.runes} onChange={(v) => setImport({ runes: v })} />
          </Row>
          <Row label="Summoner spells" htmlFor="imp-spells">
            <Switch id="imp-spells" label="Import summoner spells" checked={settings.importPrefs.spells} onChange={(v) => setImport({ spells: v })} />
          </Row>
          <Row label="Flash on" hint="Which key Flash is put on.">
            <Segmented
              label="Flash key"
              value={settings.importPrefs.flashKey}
              onChange={(v) => setImport({ flashKey: v })}
              items={[
                { value: "D", label: "D" },
                { value: "F", label: "F" },
              ]}
            />
          </Row>
          <Row label="Item set" hint="Adds the build to the in-game shop's recommended tab." htmlFor="imp-items">
            <Switch id="imp-items" label="Import item set" checked={settings.importPrefs.items} onChange={(v) => setImport({ items: v })} />
          </Row>
          <Row label="Import on hover" hint="Import while hovering, before you lock in." htmlFor="imp-hover">
            <Switch id="imp-hover" label="Import on hover" checked={settings.importPrefs.onHover} onChange={(v) => setImport({ onHover: v })} />
          </Row>
        </Section>

        <Section id="overlay" icon={<LayoutDashboard />} title="In-game widgets" description="Shown over League while you play. Use Borderless or Windowed display mode in League.">
          {(Object.keys(WIDGET_META) as WidgetId[]).map((id) => (
            <Row key={id} label={WIDGET_META[id].name} hint={WIDGET_META[id].description} htmlFor={`w-${id}`}>
              <Switch id={`w-${id}`} label={WIDGET_META[id].name} checked={settings.widgets[id].enabled} onChange={(v) => updateWidget(id, { enabled: v })} />
            </Row>
          ))}
          <Row label="Opacity">
            <input type="range" min={0.4} max={1} step={0.02} value={settings.overlayOpacity} onChange={(e) => update({ overlayOpacity: Number(e.target.value) })} className="w-40 accent-[var(--primary)]" aria-label="Overlay opacity" />
          </Row>
          <Row label="Size">
            <input type="range" min={0.8} max={1.4} step={0.05} value={settings.overlayScale} onChange={(e) => update({ overlayScale: Number(e.target.value) })} className="w-40 accent-[var(--primary)]" aria-label="Overlay size" />
          </Row>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => getBridge()?.setOverlayEdit?.(true)} disabled={!desktop}>
              <Move /> Move widgets
            </Button>
            <Button size="sm" variant="outline" onClick={() => getBridge()?.toggleOverlay(true)} disabled={!desktop}>
              Show overlay
            </Button>
            <a href="/overlay?demo=1&edit=1" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline self-center">
              Preview in browser
            </a>
          </div>
        </Section>

        <Section id="scouting" icon={<Users />} title="Loading-screen scouting" description="Cards with rank, champion stats, recent form and tags for all 10 players.">
          <Row label="Show on loading screen" hint="Opens automatically when the game loads and hides when it starts." htmlFor="scout-auto">
            <Switch id="scout-auto" label="Show scouting on loading screen" checked={settings.scoutAutoShow} onChange={(v) => update({ scoutAutoShow: v })} />
          </Row>
          <Row label="Matches analysed per player" hint="More = more accurate tags, but slower with a development API key.">
            <Select
              className="w-[100px]"
              label="Matches analysed"
              value={String(settings.scoutDepth)}
              onChange={(v) => update({ scoutDepth: Number(v) })}
              options={["5", "10", "15", "20"].map((v) => ({ value: v, label: v }))}
              align="right"
            />
          </Row>
          <Button size="sm" variant="outline" onClick={() => getBridge()?.toggleScout?.(true)} disabled={!desktop}>
            Show scouting now
          </Button>
        </Section>

        <Section id="data" icon={<Database />} title="Data & API">
          <Row label="Data mode">
            {status.data ? (
              <Badge variant={status.data.mode === "live" && !status.data.keyRejected ? "success" : "warning"}>
                {status.data.keyRejected ? "Riot key expired" : status.data.mode === "live" ? "Riot API connected" : status.data.mode === "offline" ? "Waiting for Riot API key" : "Demo mode"}
              </Badge>
            ) : (
              <Badge>checking…</Badge>
            )}
          </Row>
          <Row label="Data Dragon version">
            <span className="text-sm text-muted tabular">{status.data?.ddragonVersion ?? "…"}</span>
          </Row>
          <Row label="Database cache">
            <Badge variant={status.data?.database ? "success" : "default"}>{status.data?.database ? "PostgreSQL connected" : "Memory only"}</Badge>
          </Row>
          <Row label="Aggregated dataset" hint="Powers tier lists and builds.">
            <span className="text-sm text-muted">{status.data?.aggregateDataset ? `patch ${status.data.aggregateDataset.patch} · ${status.data.aggregateDataset.matches.toLocaleString()} matches` : status.data?.mode === "offline" || status.data?.mode === "live" ? "being collected" : "not built — demo dataset shown"}</span>
          </Row>
          {status.data?.mode === "demo" && (
            <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted">
              Add <code className="text-fg">RIOT_API_KEY=RGAPI-…</code> to <code className="text-fg">.env</code> and restart NEXUS to switch to real data. The key stays on the server and is never sent to the browser.
            </p>
          )}
        </Section>

        <Section icon={<Star />} title="Favorites">
          {settings.favorites.length === 0 && <p className="text-sm text-muted">No favorite players.</p>}
          <ul className="space-y-1.5">
            {settings.favorites.map((p) => (
              <li key={`${p.gameName}#${p.tagLine}${p.platform}`} className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2 text-sm">
                <span>
                  {p.gameName}
                  <span className="text-muted">#{p.tagLine}</span> <span className="text-xs text-dim">{regionLabel(p.platform)}</span>
                </span>
                <button onClick={() => toggleFavorite(p)} className="text-muted hover:text-danger" aria-label={`Remove ${p.gameName}`}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-2 text-sm font-medium">Favorite champions</p>
            <div className="flex flex-wrap gap-2">
              {settings.favoriteChampions.map((id) => (
                <button key={id} onClick={() => toggleFavoriteChampion(id)} aria-label={`Remove ${champion(id)?.name}`} className="group relative">
                  <ChampionIcon id={id} size={40} />
                  <span className="absolute inset-0 hidden place-items-center rounded-lg bg-black/60 group-hover:grid">
                    <Trash2 className="size-4 text-danger" />
                  </span>
                </button>
              ))}
              {settings.favoriteChampions.length === 0 && <p className="text-sm text-muted">Star champions on the Champions page.</p>}
            </div>
          </div>
          <Row label="Recently viewed" hint={`${settings.recent.length} profiles`}>
            <Button size="sm" variant="outline" onClick={() => update({ recent: [] })} disabled={!settings.recent.length}>
              Clear history
            </Button>
          </Row>
        </Section>

        <Section icon={<Keyboard />} title="Keyboard shortcuts">
          {[
            ["Ctrl / ⌘ + K", "Open search"],
            ["/", "Open search"],
            ["↑ ↓ Enter", "Navigate search results, dropdowns"],
            ["← →", "Switch tabs"],
            ["Esc", "Close menus and dialogs"],
            ["Ctrl + Shift + N", "Show / hide in-game widgets (desktop)"],
            ["Ctrl + Shift + E", "Move widgets (desktop)"],
            ["Ctrl + Shift + S", "Show / hide scouting board (desktop)"],
          ].map(([k, d]) => (
            <Row key={k} label={d}>
              <kbd className="rounded-md border border-line bg-surface-hover/60 px-2 py-0.5 text-xs text-muted">{k}</kbd>
            </Row>
          ))}
          <div className="border-t border-line-soft pt-4">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                reset();
                toast.success("Settings reset");
              }}
            >
              <RotateCcw /> Reset all settings
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}
