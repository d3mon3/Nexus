import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Original position glyphs for the five roles. */
export function RoleIcon({ role, className, size = 18 }: { role: Role; className?: string; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", className: cn("shrink-0", className), "aria-label": role, role: "img" as const };
  switch (role) {
    case "TOP":
      return (
        <svg {...common} fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6" />
          <path d="M3 3h12v4H7v8H3z" fill="currentColor" />
        </svg>
      );
    case "JUNGLE":
      return (
        <svg {...common} fill="currentColor">
          <path d="M12 2c1 4 4 6 4 10a4 4 0 0 1-3 3.9V22h-2v-6.1A4 4 0 0 1 8 12c0-4 3-6 4-10Zm-6 6c1 2 2 3 2 5l-2 3c-1-2-2-4 0-8Zm12 0c2 4 1 6 0 8l-2-3c0-2 1-3 2-5Z" />
        </svg>
      );
    case "MIDDLE":
      return (
        <svg {...common} fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6" />
          <path d="M3 17 17 3h4v4L7 21H3z" fill="currentColor" />
        </svg>
      );
    case "BOTTOM":
      return (
        <svg {...common} fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.6" />
          <path d="M21 21H9v-4h8V9h4z" fill="currentColor" />
        </svg>
      );
    case "UTILITY":
      return (
        <svg {...common} fill="currentColor">
          <path d="M9 3h6l-1 4h-4zM4 7h5l3 3 3-3h5l-4 5h-3l1 9h-4l1-9H8z" />
        </svg>
      );
    default:
      return null;
  }
}
