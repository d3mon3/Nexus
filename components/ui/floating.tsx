"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Fixed-position coordinates for a popup anchored to `anchor`, so menus and tooltips can be
 * rendered in a portal and never get clipped by cards (overflow) or covered by later cards.
 */
export function useAnchoredStyle(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  opts: { side?: "top" | "bottom"; align?: "left" | "right" | "center"; gap?: number; matchWidth?: boolean } = {},
): CSSProperties | null {
  const { side = "bottom", align = "left", gap = 6, matchWidth = false } = opts;
  const [style, setStyle] = useState<CSSProperties | null>(null);
  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const place = () => {
      const el = anchor.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const s: CSSProperties = { position: "fixed", zIndex: 1000 };
      if (side === "bottom") {
        // Flip above when there's no room below.
        const below = window.innerHeight - r.bottom;
        if (below < 220 && r.top > below) s.bottom = window.innerHeight - r.top + gap;
        else s.top = r.bottom + gap;
      } else s.bottom = window.innerHeight - r.top + gap;
      if (align === "right") s.right = Math.max(8, window.innerWidth - r.right);
      else if (align === "center") {
        s.left = r.left + r.width / 2;
        s.transform = "translateX(-50%)";
      } else s.left = Math.max(8, r.left);
      if (matchWidth) s.minWidth = r.width;
      setStyle(s);
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, open, side, align, gap, matchWidth]);
  return style;
}
