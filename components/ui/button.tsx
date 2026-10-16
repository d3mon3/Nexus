"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg light:rounded-xl text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-[#7a72ff] to-[#5a4cf0] text-white shadow-[0_0_0_1px_rgba(140,130,255,0.55),0_6px_20px_-6px_rgba(98,82,245,0.8)] hover:shadow-[0_0_0_1px_rgba(170,160,255,0.75),0_8px_26px_-4px_rgba(98,82,245,0.95)] hover:brightness-110 active:scale-[0.98] light:from-[#6874ff] light:to-[#4a55f0] light:shadow-[0_8px_20px_-8px_rgba(74,85,240,0.7)]",
        secondary: "bg-surface-hover/70 text-fg border border-line hover:border-primary/60 hover:bg-surface-hover light:bg-white/60 light:shadow-[0_4px_14px_-8px_rgba(64,76,160,0.4)]",
        outline: "border border-line bg-[#0b0f1b] text-fg hover:border-primary/60 hover:bg-primary-soft light:bg-white/60 light:shadow-[0_4px_14px_-8px_rgba(64,76,160,0.4)]",
        ghost: "text-muted hover:text-fg hover:bg-surface-hover/70",
        danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
        blue: "bg-gradient-to-b from-[#4158b8] to-[#33449a] text-white border border-[#5a6fd6]/60 shadow-[0_6px_18px_-8px_rgba(60,80,200,0.8)] hover:brightness-115",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
