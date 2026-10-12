import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import pw from "/opt/npm-tools/node_modules/playwright/index.js";
const [route = "/", w = "1536", script = ""] = process.argv.slice(2);
const dist = path.join(import.meta.dirname, "dist");
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split("?")[0]);
  const p = path.join(dist, u === "/" ? "index.html" : u);
  if (!fs.existsSync(p)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : "text/html" }).end(fs.readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 1000 } });
await page.route(/ddragon|communitydragon|fonts\.g/, (r) => r.abort());
await page.goto(`http://localhost:${server.address().port}/#${route}`);
await page.waitForTimeout(1500);
const res = await page.evaluate(script || `(() => {
  const vw = document.documentElement.clientWidth;
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.right > vw + 1 && r.width > 0) out.push(el.tagName + "." + String(el.className).slice(0, 90) + " right=" + Math.round(r.right) + " w=" + Math.round(r.width));
  }
  return { vw, sw: document.documentElement.scrollWidth, out: out.slice(0, 12) };
})()`);
console.log(JSON.stringify(res, null, 1));
await browser.close();
server.close();
