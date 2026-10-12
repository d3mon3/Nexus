"use client";

import { useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * <img> with a styled fallback. Data Dragon images may be unreachable (offline desktop,
 * blocked networks); the fallback keeps layouts intact and shows initials instead.
 */
export function GameImage({
  src,
  alt,
  className,
  fallbackText,
  style,
  loading = "lazy",
}: {
  src: string | undefined;
  alt: string;
  className?: string;
  fallbackText?: string;
  style?: CSSProperties;
  loading?: "lazy" | "eager";
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    const text = (fallbackText ?? alt)
      .replace(/[^A-Za-z0-9 ]/g, "")
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <span
        role="img"
        aria-label={alt}
        style={style}
        className={cn(
          "grid select-none place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,#3b2a7a,#141a33_70%)] text-[0.7em] font-bold text-white/80",
          className,
        )}
      >
        {text || "?"}
      </span>
    );
  }
  return <img src={src} alt={alt} loading={loading} decoding="async" draggable={false} onError={() => setFailed(true)} style={style} className={cn("object-cover", className)} />;
}
