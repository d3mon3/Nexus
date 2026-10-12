import { createRoot } from "react-dom/client";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { routes } from "./routes";
import { OverlayView } from "@/components/views/overlay-view";
import { AdminView } from "@/components/views/admin-view";
import { ScoutOverlayView } from "@/components/views/scout-overlay-view";
import { useLocation } from "./shims/router";

function match(path: string) {
  for (const r of routes) {
    const m = r.pattern.exec(path);
    if (m) return r.render(m.slice(1).map(decodeURIComponent));
  }
  return <p>404 {path}</p>;
}

function App() {
  const loc = useLocation();
  const path = loc.split("?")[0];
  if (path === "/admin") return <Providers><AdminView /></Providers>;
  if (path.startsWith("/overlay")) return <Providers>{path === "/overlay/scout" ? <ScoutOverlayView /> : <OverlayView />}</Providers>;
  return (
    <Providers>
      <AppShell>{match(path)}</AppShell>
    </Providers>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
