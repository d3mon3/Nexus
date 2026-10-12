/* Minimal SVG re-implementation of the Recharts API surface NEXUS uses — preview only. */
import { area as d3area, curveLinearClosed, curveMonotoneX, line as d3line } from "d3-shape";
import { Children, createContext, isValidElement, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";

const SizeCtx = createContext<{ width: number; height: number }>({ width: 400, height: 200 });

export function ResponsiveContainer({ children }: { children: ReactNode; width?: string | number; height?: string | number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }));
    ro.observe(el);
    setSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {size.width > 0 && <SizeCtx.Provider value={size}>{children}</SizeCtx.Provider>}
    </div>
  );
}

type AnyProps = Record<string, any>;
export const XAxis = (_: AnyProps) => null;
export const YAxis = (_: AnyProps) => null;
export const Tooltip = (_: AnyProps) => null;
export const CartesianGrid = (_: AnyProps) => null;
export const Area = (_: AnyProps) => null;
export const Line = (_: AnyProps) => null;
export const Bar = (_: AnyProps) => null;
export const Cell = (_: AnyProps) => null;
export const PolarGrid = (_: AnyProps) => null;
export const PolarAngleAxis = (_: AnyProps) => null;
export const PolarRadiusAxis = (_: AnyProps) => null;
export const Radar = (_: AnyProps) => null;
export const ReferenceLine = (_: AnyProps) => null;

function flat(children: ReactNode): ReactElement<AnyProps>[] {
  const out: ReactElement<AnyProps>[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if ((c.type as any) === Symbol.for("react.fragment")) out.push(...flat((c.props as AnyProps).children));
    else out.push(c as ReactElement<AnyProps>);
  });
  return out;
}

function Cartesian({ data, margin = {}, children }: { data: AnyProps[]; margin?: AnyProps; children: ReactNode }) {
  const { width, height } = useContext(SizeCtx);
  const kids = flat(children);
  const xAxis = kids.find((k) => k.type === XAxis);
  const yAxis = kids.find((k) => k.type === YAxis);
  const showX = xAxis && !xAxis.props.hide;
  const showY = yAxis && !yAxis.props.hide;
  const m = { top: margin.top ?? 5, right: margin.right ?? 5, bottom: (margin.bottom ?? 5) + (showX ? 18 : 0), left: Math.max(0, (margin.left ?? 5) + (showY ? (yAxis!.props.width ?? 40) : 0)) };
  const w = Math.max(1, width - m.left - m.right);
  const h = Math.max(1, height - m.top - m.bottom);
  const series = kids.filter((k) => k.type === Area || k.type === Line || k.type === Bar);
  const values = series.flatMap((s) => data.map((d) => Number(d[s.props.dataKey])).filter((v) => Number.isFinite(v)));
  let lo = Math.min(...values, series.some((s) => s.type === Bar) ? 0 : Infinity);
  let hi = Math.max(...values);
  const dom = yAxis?.props.domain;
  if (Array.isArray(dom)) {
    if (typeof dom[0] === "number") lo = dom[0];
    else if (typeof dom[0] === "string" && dom[0].includes("-")) lo -= Number(dom[0].split("-")[1]);
    if (typeof dom[1] === "number") hi = dom[1];
    else if (typeof dom[1] === "string" && dom[1].includes("+")) hi += Number(dom[1].split("+")[1]);
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo === hi) {
    lo = (lo || 0) - 1;
    hi = (hi || 0) + 1;
  }
  const hasBar = series.some((s) => s.type === Bar);
  const n = Math.max(1, data.length);
  const x = (i: number) => (hasBar ? ((i + 0.5) / n) * w : n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => h - ((v - lo) / (hi - lo)) * h;
  const grid = kids.find((k) => k.type === CartesianGrid);
  const defs = kids.filter((k) => k.type === "defs");
  const bars = series.filter((s) => s.type === Bar);
  const bw = Math.min(28, (w / n) * 0.7) / Math.max(1, bars.length);
  return (
    <svg width={width} height={height}>
      {defs}
      <g transform={`translate(${m.left},${m.top})`}>
        {grid && [0, 0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1={0} x2={w} y1={t * h} y2={t * h} stroke={grid.props.stroke} />)}
        {showY && [0, 0.5, 1].map((t) => <text key={t} x={-6} y={t * h + 3} textAnchor="end" fontSize={10} fill="#5D6585">{yAxis!.props.tickFormatter ? yAxis!.props.tickFormatter(hi - t * (hi - lo)) : Math.round(hi - t * (hi - lo))}</text>)}
        {series.map((s, si) => {
          const p = s.props;
          const pts = data.map((d, i) => [x(i), y(Number(d[p.dataKey]))] as [number, number]).filter(([, yy]) => Number.isFinite(yy));
          if (s.type === Bar) {
            const cells = flat(p.children).filter((c) => c.type === Cell);
            const bi = bars.indexOf(s);
            return (
              <g key={si}>
                {data.map((d, i) => {
                  const v = Number(d[p.dataKey]);
                  const top = y(Math.max(v, 0));
                  return <rect key={i} x={x(i) - (bw * bars.length) / 2 + bi * bw} y={top} width={bw - 2} height={Math.max(0, y(0) - top)} rx={3} fill={cells[i]?.props.fill ?? p.fill} />;
                })}
              </g>
            );
          }
          const lineGen = d3line().curve(curveMonotoneX);
          const dots = p.dot;
          return (
            <g key={si}>
              {s.type === Area && <path d={d3area().curve(curveMonotoneX).y0(h).x((q) => q[0]).y1((q) => q[1])(pts) ?? ""} fill={p.fill} stroke="none" />}
              {p.stroke !== "none" && <path d={lineGen(pts) ?? ""} fill="none" stroke={p.stroke} strokeWidth={p.strokeWidth ?? 1.5} />}
              {dots &&
                pts.map(([cx, cy], i) =>
                  typeof dots === "function" ? dots({ cx, cy, index: i, key: i }) : <circle key={i} cx={cx} cy={cy} r={dots.r ?? 3} fill={dots.fill ?? p.stroke} stroke={dots.stroke} strokeWidth={dots.strokeWidth} />,
                )}
            </g>
          );
        })}
        {showX &&
          data.map((d, i) => {
            const every = Math.ceil(n / Math.max(1, Math.floor(w / 60)));
            return i % every === 0 ? (
              <text key={i} x={x(i)} y={h + 14} textAnchor="middle" fontSize={11} fill="#919AB7">
                {String(d[xAxis!.props.dataKey])}
              </text>
            ) : null;
          })}
      </g>
    </svg>
  );
}

export const ComposedChart = Cartesian;
export const AreaChart = Cartesian;
export const LineChart = Cartesian;
export const BarChart = Cartesian;

export function RadarChart({ data, children, outerRadius = "70%" }: { data: AnyProps[]; children: ReactNode; outerRadius?: string | number; margin?: AnyProps }) {
  const { width, height } = useContext(SizeCtx);
  const kids = flat(children);
  const cx = width / 2;
  const cy = height / 2;
  const r = (Math.min(width, height) / 2) * (typeof outerRadius === "string" ? parseFloat(outerRadius) / 100 : outerRadius / 100);
  const n = data.length;
  const angle = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, v: number): [number, number] => [cx + Math.cos(angle(i)) * r * v, cy + Math.sin(angle(i)) * r * v];
  const grid = kids.find((k) => k.type === PolarGrid);
  const axis = kids.find((k) => k.type === PolarAngleAxis);
  const close = d3line().curve(curveLinearClosed);
  return (
    <svg width={width} height={height}>
      {grid && [0.2, 0.4, 0.6, 0.8, 1].map((t) => <path key={t} d={close(data.map((_, i) => pt(i, t))) ?? ""} fill="none" stroke={grid.props.stroke} />)}
      {grid && data.map((_, i) => <line key={i} x1={cx} y1={cy} x2={pt(i, 1)[0]} y2={pt(i, 1)[1]} stroke={grid.props.stroke} />)}
      {kids
        .filter((k) => k.type === Radar)
        .map((s, si) => {
          const pts = data.map((d, i) => pt(i, Number(d[s.props.dataKey]) / 100));
          return (
            <g key={si}>
              <path d={close(pts) ?? ""} fill={s.props.fill} fillOpacity={s.props.fillOpacity} stroke={s.props.stroke} strokeWidth={s.props.strokeWidth} />
              {pts.map(([x, y], i) => (
                <circle key={i} cx={x} cy={y} r={2.5} fill="#fff" />
              ))}
            </g>
          );
        })}
      {axis &&
        data.map((d, i) => {
          const [x, y] = pt(i, 1.2);
          return (
            <text key={i} x={x} y={y + 4} textAnchor={Math.abs(x - cx) < 4 ? "middle" : x > cx ? "start" : "end"} fontSize={11} fill="#919AB7">
              {String(d[axis.props.dataKey])}
            </text>
          );
        })}
    </svg>
  );
}
