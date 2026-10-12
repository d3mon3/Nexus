"use client";

import { useId } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortDate } from "@/lib/format";
import { ChartTooltipBox } from "./chart-tooltip";

export interface LpPoint {
  i: number;
  value: number;
  win: boolean;
  date: number;
  label?: string;
}

const WIN = "#2FCF98";
const LOSS = "#F54C7C";

/**
 * Cumulative LP (or score) line where each segment is coloured by the result of the game
 * that produced it — green for wins, red for losses — over a soft glow area.
 */
export function LpChart({ data, height = 110, valueLabel = "LP" }: { data: LpPoint[]; height?: number; valueLabel?: string }) {
  const id = useId().replace(/:/g, "");
  const n = Math.max(1, data.length - 1);
  const stops = data.flatMap((d, i) => {
    if (i === 0) return [];
    const color = d.win ? WIN : LOSS;
    return [
      { offset: (i - 1) / n, color },
      { offset: i / n, color },
    ];
  });
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 6, bottom: 0, left: 6 }}>
          <defs>
            <linearGradient id={`seg-${id}`} x1="0" y1="0" x2="1" y2="0">
              {stops.map((s, i) => (
                <stop key={i} offset={`${(s.offset * 100).toFixed(2)}%`} stopColor={s.color} />
              ))}
            </linearGradient>
            <linearGradient id={`area-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={WIN} stopOpacity={0.14} />
              <stop offset="100%" stopColor={WIN} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(130,133,166,0.09)" />
          <XAxis dataKey="i" hide />
          <YAxis hide domain={["dataMin - 10", "dataMax + 10"]} />
          <Tooltip
            cursor={{ stroke: "rgba(145,97,255,0.4)", strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as LpPoint | undefined;
              if (!active || !p) return null;
              return <ChartTooltipBox title={p.label ?? shortDate(p.date)} rows={[{ label: p.win ? "Victory" : "Defeat", value: `${p.value > 0 ? "+" : ""}${p.value} ${valueLabel}`, color: p.win ? WIN : LOSS }]} />;
            }}
          />
          <Area type="monotone" dataKey="value" stroke="none" fill={`url(#area-${id})`} isAnimationActive />
          <Line
            type="monotone"
            dataKey="value"
            stroke={`url(#seg-${id})`}
            strokeWidth={2.2}
            dot={(props: { cx?: number; cy?: number; index?: number }) => {
              const d = data[props.index ?? 0];
              return <circle key={props.index} cx={props.cx} cy={props.cy} r={3.2} fill={d?.win ? WIN : LOSS} stroke="#0b1020" strokeWidth={1.2} />;
            }}
            activeDot={{ r: 5, stroke: "#fff", strokeWidth: 1.5 }}
            isAnimationActive
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
