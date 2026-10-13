"use client";

import { Lightbulb, ThumbsDown, ThumbsUp, TrendingUp } from "lucide-react";
import { t } from "@/lib/i18n";
import type { PlayerInsight } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "../ui/card";
import { EmptyState } from "../ui/states";

const TONE = {
  bad: { icon: ThumbsDown, ring: "border-loss/35 bg-loss/8", text: "text-loss" },
  good: { icon: ThumbsUp, ring: "border-win/35 bg-win/8", text: "text-win" },
  info: { icon: TrendingUp, ring: "border-secondary/35 bg-secondary/8", text: "text-secondary" },
} as const;

/** Translate the template and any text placeholders (e.g. "in the evening (18–22)"). */
const render = (template: string, vars: PlayerInsight["vars"]) => t(template, Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, typeof v === "string" ? t(v) : v])));

/** "What to improve" — findings from the player's recent matches. */
export function InsightsCard({ insights, games, className }: { insights: PlayerInsight[] | undefined; games: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={t("What to improve")} icon={<Lightbulb className="size-4 text-warning" />} action={<span className="text-xs text-dim">{t("from your last {0} games", [games])}</span>} />
      {!insights?.length ? (
        <EmptyState title={games < 5 ? t("Play a few more games") : t("Nothing stands out")} description={games < 5 ? t("Insights appear after at least 5 games.") : t("Your recent games look balanced against your lane opponents.")} className="py-6" />
      ) : (
        <ul className="space-y-2 p-3 pt-0">
          {insights.map((i) => {
            const tone = TONE[i.tone];
            const Icon = tone.icon;
            return (
              <li key={i.id} className={cn("flex gap-3 rounded-xl border p-3", tone.ring)}>
                <Icon className={cn("mt-0.5 size-4 shrink-0", tone.text)} />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-semibold text-fg">{render(i.title, i.vars)}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{render(i.detail, i.vars)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
