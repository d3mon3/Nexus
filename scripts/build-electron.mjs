// Compiles the Electron main and preload scripts to dist-electron/.
import { build } from "esbuild";

// NEXUS_SERVER_URL (e.g. https://1-2-3-4.sslip.io) makes the .exe use your server instead of a local one.
const serverUrl = (process.env.NEXUS_SERVER_URL ?? "").trim();
// Release tag of this build (set by GitHub Actions) — lets the app notice newer installers.
const buildTag = (process.env.NEXUS_BUILD_TAG ?? "").trim();
if (serverUrl) console.log(`[nexus] desktop app will use server ${serverUrl}`);
const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  external: ["electron"],
  sourcemap: true,
  logLevel: "info",
  define: { __NEXUS_SERVER_URL__: JSON.stringify(serverUrl), __NEXUS_BUILD_TAG__: JSON.stringify(buildTag) },
};
await build({ ...common, entryPoints: ["electron/main.ts"], outfile: "dist-electron/main.js" });
await build({ ...common, entryPoints: ["electron/preload.ts"], outfile: "dist-electron/preload.js" });
