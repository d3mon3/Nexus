import { DDRAGON, FALLBACK_DDRAGON_VERSION, SPELLS } from "./static-data";

let currentVersion = FALLBACK_DDRAGON_VERSION;

/** Called by the static-data provider once the live Data Dragon version is known. */
export function setDDragonVersion(version: string) {
  if (version) currentVersion = version;
}

export function ddragonVersion() {
  return currentVersion;
}

export const asset = {
  championIcon: (key: string) => `${DDRAGON}/cdn/${currentVersion}/img/champion/${key}.png`,
  championSplash: (key: string, skin = 0) => `${DDRAGON}/cdn/img/champion/splash/${key}_${skin}.jpg`,
  championLoading: (key: string, skin = 0) => `${DDRAGON}/cdn/img/champion/loading/${key}_${skin}.jpg`,
  championCentered: (key: string, skin = 0) => `${DDRAGON}/cdn/img/champion/centered/${key}_${skin}.jpg`,
  item: (id: number) => `${DDRAGON}/cdn/${currentVersion}/img/item/${id}.png`,
  spell: (id: number) => `${DDRAGON}/cdn/${currentVersion}/img/spell/${SPELLS[id]?.key ?? "SummonerFlash"}.png`,
  rune: (iconPath: string) => `${DDRAGON}/cdn/img/${iconPath}`,
  map: (id = 11) => `${DDRAGON}/cdn/${currentVersion}/img/map/map${id}.png`,
  profileIcon: (id: number) => `${DDRAGON}/cdn/${currentVersion}/img/profileicon/${id}.png`,
  ability: (key: string, slot: "Q" | "W" | "E" | "R") =>
    `${DDRAGON}/cdn/${currentVersion}/img/spell/${key}${slot}.png`,
};
