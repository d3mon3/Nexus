import {
  ChartColumnBig,
  ChartSpline,
  Columns2,
  History,
  House,
  Layers,
  MonitorPlay,
  Search,
  Settings,
  Shield,
  Trophy,
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
  { href: "/leaderboards", label: "Leaderboards", icon: ChartColumnBig },
  { href: "/tier-list", label: "Tier List", icon: Layers },
  { href: "/builds", label: "Meta & Builds", icon: Wand },
  { href: "/matches", label: "Match History", icon: History },
  { href: "/statistics", label: "Statistics", icon: ChartSpline },
  { href: "/compare", label: "Comparisons", icon: Columns2 },
  { href: "/multi-search", label: "Multi Search", icon: Search },
  { href: "/pro-players", label: "Pro Players", icon: Trophy },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.match ?? []).some((m) => pathname.startsWith(m));
}
