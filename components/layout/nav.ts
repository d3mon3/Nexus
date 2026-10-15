import {
  ChartSpline,
  Columns2,
  History,
  House,
  Layers,
  MonitorPlay,
  Settings,
  Shield,
  Sparkles,
  User,
  Wand,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Extra path prefixes that should highlight this item. */
  match?: string[];
}

export const NAV: NavItem[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/champions", label: "Champions", icon: Shield },
  { href: "/live", label: "Live Game", icon: MonitorPlay },
  { href: "/tier-list", label: "Tier List", icon: Layers },
  { href: "/builds", label: "Meta & Builds", icon: Wand },
  { href: "/augments", label: "Augment tiers", icon: Sparkles },
  { href: "/matches", label: "Match History", icon: History },
  { href: "/statistics", label: "Statistics", icon: ChartSpline },
  { href: "/compare", label: "Comparisons", icon: Columns2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.match ?? []).some((m) => pathname.startsWith(m));
}
