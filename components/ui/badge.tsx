import { cva, type VariantProps } from "class-variance-authority";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold tracking-wide", {
  variants: {
    variant: {
      default: "bg-surface-hover text-muted border border-line",
      primary: "bg-primary-soft text-primary border border-primary/40",
      success: "bg-success/12 text-success border border-success/35",
      danger: "bg-danger/12 text-danger border border-danger/35",
      warning: "bg-warning/12 text-warning border border-warning/35",
      blue: "bg-secondary/12 text-secondary border border-secondary/35",
    },
  },
  defaultVariants: { variant: "default" },
});

export function Badge({ className, variant, ...props }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
