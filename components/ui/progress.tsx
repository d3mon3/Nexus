import { cn } from "@/lib/utils";

export function Progress({ value, className, color = "var(--primary)", glow = true }: { value: number; className?: string; color?: string; glow?: boolean }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, white))`, boxShadow: glow ? `0 0 10px ${color}` : undefined }}
      />
    </div>
  );
}
