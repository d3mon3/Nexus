"use client";


import { t } from "@/lib/i18n";
import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox } from "./chart-tooltip";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

/** Smooth glowing area chart for time series (win rate, KDA, CS/min …). */
export function TrendChart({
  data,
  series,
  xKey = "label",
  height = 150,
  format = (v: number) => String(v),
  domain,
  showGrid = false,
  showXAxis = true,
  endBadge = false,
}: {
  data: Record<string, number | string | null>[];
  series: TrendSeries[];
  xKey?: string;
  height?: number;
  format?: (v: number) => string;
  domain?: [number | string, number | string];
  showGrid?: boolean;
  showXAxis?: boolean;
  endBadge?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const last = data[data.length - 1];
  return (
    <div style={{ height }} className="relative w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: endBadge ? 44 : 8, bottom: 0, left: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`fill-${id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {showGrid && <CartesianGrid stroke="rgba(145,154,183,0.08)" vertical={false} />}
          <XAxis dataKey={xKey} hide={!showXAxis} tick={{ fill: "#919AB7", fontSize: 11 }} axisLine={{ stroke: "rgba(145,154,183,0.18)" }} tickLine={false} minTickGap={24} />
          <YAxis hide domain={domain ?? ["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: "rgba(145,97,255,0.45)", strokeDasharray: "3 3" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltipBox title={String(label)} rows={payload.map((p) => ({ label: String(p.name), value: format(Number(p.value)), color: String(p.color) }))} />
              ) : null
            }
          />
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={t(s.label)}
              stroke={s.color}
              strokeWidth={2.2}
              fill={`url(#fill-${id}-${s.key})`}
              dot={{ r: 2.6, fill: s.color, stroke: "#0b1020", strokeWidth: 1 }}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 1.5 }}
              connectNulls
              isAnimationActive
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
      {endBadge && last && series[0] && last[series[0].key] !== null && (
        <span className="pointer-events-none absolute right-0 top-1 rounded-md border border-primary/60 bg-primary-soft px-1.5 py-0.5 text-[11px] font-semibold text-fg shadow-[0_0_12px_-4px_var(--primary-glow)]">
          {format(Number(last[series[0].key]))}
        </span>
      )}
    </div>
  );
}
