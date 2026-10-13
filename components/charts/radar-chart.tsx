"use client";


import { t } from "@/lib/i18n";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartTooltipBox } from "./chart-tooltip";

export interface RadarSeries {
  key: string;
  label: string;
  color: string;
}

export function StatRadar({ data: raw, series, height = 190 }: { data: Record<string, number | string>[]; series: RadarSeries[]; height?: number }) {
  const data = raw.map((d) => ({ ...d, axis: t(d.axis) }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="68%" margin={{ top: 4, right: 18, bottom: 4, left: 18 }}>
          <PolarGrid gridType="polygon" stroke="rgba(145,154,183,0.18)" />
          <PolarAngleAxis dataKey="axis" tick={{ fill: "#919AB7", fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <ChartTooltipBox title={label as string} rows={payload.map((p) => ({ label: String(p.name), value: String(p.value), color: String(p.color) }))} />
              ) : null
            }
          />
          {series.map((s) => (
            <Radar
              key={s.key}
              name={t(s.label)}
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={s.color}
              fillOpacity={0.32}
              dot={{ r: 2.5, fill: "#fff", strokeWidth: 0 }}
              isAnimationActive
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
