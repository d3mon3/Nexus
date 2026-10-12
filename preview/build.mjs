// Preview bundler: renders the real NEXUS components in a static page using local shims
// for Next.js/Recharts/etc. (the real app is built by `next build`).
import * as esbuild from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
import tw from "/opt/npm-tools/node_modules/tailwindcss/dist/lib.js";
const { compile } = tw;
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(import.meta.dirname, "dist");
fs.mkdirSync(out, { recursive: true });

const files = [];
const walk = (d) => {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    if (["node_modules", "preview", ".next", "dist-electron", "release"].includes(f.name)) continue;
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(f.name)) files.push(p);
  }
};
walk(root);
for (const f of fs.readdirSync(path.join(import.meta.dirname, "shims"))) files.push(path.join(import.meta.dirname, "shims", f));
files.push(path.join(import.meta.dirname, "routes.tsx"));

// lucide-react → react-icons/lu
const icons = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"lucide-react"/g))
    m[1].split(",").map((s) => s.trim().replace(/^type\s+/, "")).filter(Boolean).forEach((n) => icons.add(n.split(" as ")[0].trim()));
}
icons.delete("LucideIcon");
fs.writeFileSync(
  path.join(import.meta.dirname, "shims", "lucide.gen.ts"),
  `export { ${[...icons].map((n) => `Lu${n} as ${n}`).join(", ")} } from "react-icons/lu";\nexport type LucideIcon = any;\n`,
);

const shim = (p) => path.join(import.meta.dirname, "shims", p);
const alias = {
  "next/link": shim("next-link.tsx"),
  "next/navigation": shim("next-navigation.ts"),
  "next-themes": shim("next-themes.tsx"),
  sonner: shim("sonner.tsx"),
  "framer-motion": shim("framer-motion.tsx"),
  "@tanstack/react-query": shim("tanstack.tsx"),
  recharts: shim("recharts.tsx"),
  "lucide-react": shim("lucide.gen.ts"),
  "server-only": shim("server-only.ts"),
  "@/lib/api-client": shim("api-client.ts"),
};

await esbuild.build({
  entryPoints: [path.join(import.meta.dirname, "entry.tsx")],
  bundle: true,
  outfile: path.join(out, "app.js"),
  format: "esm",
  jsx: "automatic",
  sourcemap: "inline",
  define: { "process.env.NODE_ENV": '"development"' },
  nodePaths: ["/opt/npm-tools/node_modules"],
  logLevel: "warning",
  plugins: [
    {
      name: "alias",
      setup(b) {
        b.onResolve({ filter: /.*/ }, (args) => {
          if (alias[args.path]) return { path: alias[args.path] };
          if (args.path === "./api-client" && args.resolveDir === path.join(root, "lib")) return { path: alias["@/lib/api-client"] };
          if (args.path.startsWith("@/")) {
            const base = path.join(root, args.path.slice(2));
            for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) return { path: base + ext };
          }
          if (args.path.startsWith("d3-")) return { path: path.join("/opt/npm-tools/node_modules", args.path, "src/index.js") };
          return undefined;
        });
      },
    },
  ],
});

// Tailwind v4 compile with candidates scanned from sources.
const css = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const twDir = "/opt/npm-tools/node_modules/tailwindcss";
const compiler = await compile(css, {
  base: root,
  loadStylesheet: async (id, base) => {
    const file = id === "tailwindcss" ? path.join(twDir, "index.css") : path.resolve(base, id);
    return { content: fs.readFileSync(file, "utf8"), base: path.dirname(file), path: file };
  },
  loadModule: async () => ({ module: {}, base: root }),
});
const candidates = new Set();
for (const f of files) for (const m of fs.readFileSync(f, "utf8").matchAll(/[^\s"'`]+/g)) candidates.add(m[0]);
const builtCss = compiler.build([...candidates]);
fs.writeFileSync(path.join(out, "app.css"), builtCss);
fs.writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html><html lang="en" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NEXUS preview</title><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>`,
);
fs.cpSync(path.join(root, "public"), out, { recursive: true });
console.log("built", (fs.statSync(path.join(out, "app.js")).size / 1024).toFixed(0), "KB js,", (builtCss.length / 1024).toFixed(0), "KB css,", icons.size, "icons");
