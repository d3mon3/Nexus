import { contextBridge, ipcRenderer } from "electron";

/** The only API the web UI can use to talk to the desktop shell (see lib/desktop.ts). */
contextBridge.exposeInMainWorld("nexus", {
  platform: process.platform,
  version: process.env.npm_package_version ?? "0.1.0",
  getClientState: () => ipcRenderer.invoke("nexus:get-client-state"),
  onClientState: (cb: (s: unknown) => void) => {
    const handler = (_e: unknown, s: unknown) => cb(s);
    ipcRenderer.on("nexus:client-state", handler);
    return () => ipcRenderer.removeListener("nexus:client-state", handler);
  },
  onNavigate: (cb: (path: string) => void) => {
    const handler = (_e: unknown, p: string) => cb(p);
    ipcRenderer.on("nexus:navigate", handler);
    return () => ipcRenderer.removeListener("nexus:navigate", handler);
  },
  getLiveClient: () => ipcRenderer.invoke("nexus:get-live-client"),
  setAutoDetect: (enabled: boolean) => ipcRenderer.invoke("nexus:set-auto-detect", enabled),
  toggleOverlay: (show: boolean) => ipcRenderer.invoke("nexus:toggle-overlay", show),
  spectate: (puuid: string) => ipcRenderer.invoke("nexus:spectate", puuid),
  setPrefs: (prefs: unknown) => ipcRenderer.invoke("nexus:set-prefs", prefs),
  importBuild: (championId: number, role: string | null, mode?: string, runeIndex?: number, variant?: string) => ipcRenderer.invoke("nexus:import-build", championId, role, mode, runeIndex, variant),
  getChampSelect: () => ipcRenderer.invoke("nexus:get-champ-select"),
  setWidgetSize: (w: number, h: number) => ipcRenderer.invoke("nexus:widget-size", w, h),
  onWidgetMoved: (cb: (m: unknown) => void) => {
    const handler = (_e: unknown, m: unknown) => cb(m);
    ipcRenderer.on("nexus:widget-moved", handler);
    return () => ipcRenderer.removeListener("nexus:widget-moved", handler);
  },
  getLastGame: () => ipcRenderer.invoke("nexus:get-last-game"),
  toggleScout: (show: boolean) => ipcRenderer.invoke("nexus:toggle-scout", show),
  setOverlayEdit: (on: boolean) => ipcRenderer.invoke("nexus:set-overlay-edit", on),
  onImport: (cb: (r: unknown) => void) => {
    const handler = (_e: unknown, r: unknown) => cb(r);
    ipcRenderer.on("nexus:import", handler);
    return () => ipcRenderer.removeListener("nexus:import", handler);
  },
  onOverlayEdit: (cb: (on: boolean) => void) => {
    const handler = (_e: unknown, on: boolean) => cb(on);
    ipcRenderer.on("nexus:overlay-edit", handler);
    return () => ipcRenderer.removeListener("nexus:overlay-edit", handler);
  },
});
