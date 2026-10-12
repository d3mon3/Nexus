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
if (process.env.SETTINGS) await page.addInitScript((v) => localStorage.setItem("nexus.settings.v1", v), process.env.SETTINGS);
await page.goto(`http://localhost:${port}/?theme=${theme}#${route}`);
await page.waitForTimeout(1600);
await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
await page.waitForTimeout(1200);
if (process.env.GAME_BG) await page.evaluate((bg) => { document.documentElement.style.background = `url(${bg}) center/cover`; }, process.env.GAME_BG);
await page.waitForTimeout(300);
await page.screenshot({ path: outFile, fullPage: full === "1" });
console.log(errors.length ? errors.slice(0, 10).join("\n") : "no errors");
await browser.close();
server.close();
