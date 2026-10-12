import { createElement, forwardRef, Fragment, type ReactNode } from "react";

const MOTION_PROPS = ["initial", "animate", "exit", "transition", "layout", "layoutId", "whileHover", "whileTap", "whileInView", "variants", "viewport", "drag"];
const cache = new Map<string, unknown>();
export const motion = new Proxy(
  {},
  {
    get(_t, tag: string) {
      if (!cache.has(tag)) {
        const C = forwardRef<unknown, Record<string, unknown>>((props, ref) => {
          const rest: Record<string, unknown> = { ref };
          for (const [k, v] of Object.entries(props)) if (!MOTION_PROPS.includes(k)) rest[k] = v;
          // emulate the final animated state for size/opacity animations
          const anim = props.animate as Record<string, unknown> | undefined;
          if (anim && typeof anim === "object") {
            const style = { ...((props.style as object) ?? {}) } as Record<string, unknown>;
            if (typeof anim.height === "string" && anim.height !== "auto") style.height = anim.height;
            if (typeof anim.width === "string") style.width = anim.width;
            rest.style = style;
          }
          return createElement(tag, rest);
        });
        cache.set(tag, C);
      }
      return cache.get(tag);
    },
  },
) as Record<string, React.ComponentType<Record<string, unknown>>>;
export function AnimatePresence({ children }: { children: ReactNode }) {
  return createElement(Fragment, null, children);
}
export function MotionConfig({ children }: { children: ReactNode }) {
  return createElement(Fragment, null, children);
}
