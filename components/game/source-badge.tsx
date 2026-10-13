import { t } from "@/lib/i18n";
import { Database, FlaskConical, Monitor, Radio } from "lucide-react";
import type { DataSource } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Tooltip } from "../ui/tooltip";

const META: Record<DataSource, { label: string; className: string; icon: typeof Database; tip: string }> = {
  demo: { label: "Demo data", className: "border-warning/40 bg-warning/10 text-warning", icon: FlaskConical, tip: "Generated demo data. Add a Riot API key to see real data." },
  riot: { label: "Riot API", className: "border-success/35 bg-success/10 text-success", icon: Radio, tip: "Live data from the official Riot Games API." },
  aggregate: { label: "Aggregated", className: "border-secondary/40 bg-secondary/10 text-secondary", icon: Database, tip: "Computed by NEXUS from collected match data." },
  "local-client": { label: "Local client", className: "border-primary/40 bg-primary-soft text-primary", icon: Monitor, tip: "Read from the League client running on this computer." },
};

export function SourceBadge({ source, note, className }: { source: DataSource | undefined; note?: string; className?: string }) {
  if (!source) return null;
  const m = META[source];
  const Icon = m.icon;
  return (
    <Tooltip content={note ?? m.tip}>
      <span tabIndex={0} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", m.className, className)}>
        <Icon className="size-3" />
        {t(m.label)}
      </span>
    </Tooltip>
  );
}
