"use client";


import { t } from "@/lib/i18n";
import { TriangleAlert, Inbox, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function EmptyState({ title, description, icon, action, className }: { title: string; description?: ReactNode; icon?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-10 text-center", className)}>
      <div className="grid size-12 place-items-center rounded-xl border border-line bg-surface-hover/60 text-primary [&_svg]:size-5">{icon ?? <Inbox />}</div>
      <div>
        <p className="font-semibold text-fg">{t(title)}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{t(description)}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  const offline = /network|fetch/i.test(message);
  return (
    <EmptyState
      className={className}
      icon={offline ? <WifiOff /> : <TriangleAlert />}
      title={offline ? t("Connection problem") : t("Couldn't load this")}
      description={message}
      action={
        onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            <RefreshCw />{" " + t("Try again")}</Button>
        )
      }
    />
  );
}

export function Unavailable({ label, reason, className }: { label: string; reason: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted", className)}>
      <span className="size-1.5 rounded-full bg-dim" />
      <span className="font-medium text-fg/80">{t(label)}</span>
      <span className="text-dim">— {t(reason)}</span>
    </div>
  );
}
