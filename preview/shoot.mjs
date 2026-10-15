// Usage: node shoot.mjs <route> <outfile> [width] [height] [fullPage] [theme]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import pw from "/opt/npm-tools/node_modules/playwright/index.js";

const [route = "/", outFile = "shot.png", w = "1536", h = "1024", full = "0", theme = "dark"] = process.argv.slice(2);
const dist = path.join(import.meta.dirname, "dist");
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split("?")[0]) === "/" ? "index.html" : decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }).end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("ERR_") && !m.text().includes("Failed to load resource") && errors.push("console: " + m.text()));
const DD = "/tmp/claude-0/-home-claude/ab9638e8-f349-5558-95fd-4689181a4d7a/scratchpad/dd";
await page.route(/ddragon\.leagueoflegends\.com/, (r) => {
  const u = new URL(r.request().url()).pathname;
  const local = u.startsWith("/cdn/img/") ? path.join(DD, "img", u.slice(9)) : path.join(DD, "latest", u.replace(/^\/cdn\/[^/]+\//, ""));
  return fs.existsSync(local) ? r.fulfill({ path: local }) : r.abort();
});
await page.route(/communitydragon|fonts\.g/, (r) => r.abort());
if (process.env.ADMIN_MOCK) {
  await page.addInitScript(() => sessionStorage.setItem("nexus.admin.pw", "x"));
  await page.route(/\/api\/admin\/status/, (r) => r.fulfill({ contentType: "application/json", body: process.env.ADMIN_MOCK }));
}
if (process.env.MOCK_CS) {
  await page.addInitScript(() => {
    const state = { connected: true, phase: "ChampSelect", summoner: { gameName: "d3monek", tagLine: "EUW", puuid: "demo-ZDNtb25layNFVVc", platform: "euw1" } };
    window.nexus = {
      platform: "win32", version: "dev",
      getClientState: async () => state, onClientState: () => () => {}, getLiveClient: async () => null, setAutoDetect: async () => {}, toggleOverlay: async () => {},
      setPrefs: async () => {},
      windowControl: async () => {},
      getUpdate: async () => ({ state: "downloading", tag: "build-12", name: "build 12", progress: 0.42 }),
      onUpdate: () => () => {},
      getChampSelect: async () => ({ queueId: 420, phase: "BAN_PICK", myCellId: 2, myBanTurn: false,
        myTeam: [{ cellId: 0, championId: 266, intentId: 0, position: "top" }, { cellId: 1, championId: 64, intentId: 0, position: "jungle" }, { cellId: 2, championId: 0, intentId: 157, position: "middle" }, { cellId: 3, championId: 0, intentId: 0, position: "bottom" }, { cellId: 4, championId: 0, intentId: 0, position: "utility" }],
        theirTeam: [{ cellId: 5, championId: 103, position: "" }, { cellId: 6, championId: 122, position: "" }, { cellId: 7, championId: 0, position: "" }, { cellId: 8, championId: 0, position: "" }, { cellId: 9, championId: 0, position: "" }],
        bans: [238, 777, 555] }),
    };
  });
}
if (process.env.SETTINGS) await page.addInitScript((v) => localStorage.setItem("nexus.settings.v1", v), process.env.SETTINGS);
await page.goto(`http://localhost:${port}/?theme=${theme}#${route}`);
await page.waitForTimeout(1600);
await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
await page.waitForTimeout(1200);
if (process.env.GAME_BG) await page.evaluate((bg) => { document.documentElement.style.background = `url(${bg}) center/cover`; }, process.env.GAME_BG);
await page.waitForTimeout(300);
if (process.env.CLICK) {
  await page.locator(process.env.CLICK).first().click();
  await page.waitForTimeout(400);
}
if (process.env.HOVER) {
  await page.locator(process.env.HOVER).first().hover();
  await page.waitForTimeout(400);
}
await page.screenshot({ path: outFile, fullPage: full === "1" });
console.log(errors.length ? errors.slice(0, 10).join("\n") : "no errors");
await browser.close();
server.close();
