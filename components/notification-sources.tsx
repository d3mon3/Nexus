"use client";

import { useEffect, useRef } from "react";
import { useClientState, useUpdateState } from "@/lib/desktop";
import { t } from "@/lib/i18n";
import { notify } from "@/lib/notifications";
import { useStatus } from "@/lib/queries";
import { useSettings } from "@/lib/settings";

const IN_GAME = new Set(["GameStart", "InProgress", "WaitingForStats", "PreEndOfGame"]);

/** Turns app events into bell notifications (runs in the main window only). */
export function NotificationSources() {
  const { settings, update } = useSettings();
  const system = settings.systemNotifications;
  const status = useStatus();
  const client = useClientState();
  const upd = useUpdateState();

  // Desktop update ready to install.
  useEffect(() => {
    if (upd.state !== "available") return;
    notify({ id: `update:${upd.tag}`, kind: "info", title: t("Update available"), body: t("{0} is ready — click Update in the top bar.", [upd.name]) }, { system });
  }, [upd, system]);

  // New patch data.
  const patch = status.data?.ddragonVersion;
  useEffect(() => {
    if (!patch) return;
    const short = patch.split(".").slice(0, 2).join(".");
    if (settings.lastSeenPatch === short) return;
    if (settings.lastSeenPatch) notify({ id: `patch:${short}`, kind: "info", title: t("New patch {0}", [short]), body: t("Champion, item and rune data updated. Tier list and builds follow as games are collected."), href: "/tier-list" }, { system });
    update({ lastSeenPatch: short });
  }, [patch, settings.lastSeenPatch, update, system]);

  // Server problems.
  const keyRejected = status.data?.keyRejected;
  const mode = status.data?.mode;
  useEffect(() => {
    const day = new Date().toISOString().slice(0, 10);
    if (keyRejected) notify({ id: `key-expired:${day}`, kind: "warning", title: t("Riot key expired"), body: t("Player data can't be refreshed until the admin adds a new key."), href: "/settings#data" });
    else if (mode === "demo") notify({ id: "demo-mode", kind: "warning", title: t("Demo mode is on"), body: t("Add RIOT_API_KEY to your .env to load real player data."), href: "/settings#data" });
  }, [keyRejected, mode]);

  // Game finished → summary.
  const prev = useRef<string | null>(null);
  const phase = client?.connected ? client.phase : "None";
  useEffect(() => {
    const was = prev.current;
    prev.current = phase;
    if (was && IN_GAME.has(was) && !IN_GAME.has(phase)) notify({ id: `game:${Date.now()}`, kind: "success", title: t("Game finished"), body: t("Your summary and LP change are ready."), href: "/post-game" });
  }, [phase]);

  return null;
}
