"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltipBox } from "./chart-tooltip";

export function SimpleBarChart({
  data,
  xKey,
  bars,
  height = 200,
  format = (v: number) => String(v),
  colorFor,
}: {
  data: Record<string, number | string>[];
  xKey: string;
  bars: { key: string; label: string; color: string }[];
  height?: number;
  format?: (v: number) => string;
  colorFor?: (row: Record<string, number | string>, key: string) => string | undefined;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barGap={4}>
          <CartesianGrid stroke="rgba(145,154,183,0.08)" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: "#919AB7", fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={{ fill: "#5D6585", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => format(v)} width={44} />
          <Tooltip
            cursor={{ fill: "rgba(145,97,255,0.08)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? <ChartTooltipBox title={String(label)} rows={payload.map((p) => ({ label: String(p.name), value: format(Number(p.value)), color: String(p.color ?? p.fill) }))} /> : null
            }
          />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} fill={b.color} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive>
              {colorFor && data.map((row, i) => <Cell key={i} fill={colorFor(row, b.key) ?? b.color} />)}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
