import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, hover = false, ...props }: HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn("panel", hover && "panel-hover", className)} {...props} />;
}

export function CardHeader({ title, action, className, icon }: { title: ReactNode; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 px-4 pt-3 pb-1.5", className)}>
      <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-tight text-fg">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}
