"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode; trailing?: ReactNode; wrapperClassName?: string }>(
  ({ className, icon, trailing, wrapperClassName, ...props }, ref) => (
    <div
      className={cn(
        "group flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2/80 px-3 text-sm transition-colors focus-within:border-primary/70 focus-within:shadow-[0_0_0_3px_rgba(145,97,255,0.15)] hover:border-line",
        wrapperClassName,
      )}
    >
      {icon && <span className="text-muted [&_svg]:size-4">{icon}</span>}
      <input ref={ref} className={cn("h-full w-full min-w-0 bg-transparent text-fg placeholder:text-dim outline-none", className)} {...props} />
      {trailing}
    </div>
  ),
);
Input.displayName = "Input";
