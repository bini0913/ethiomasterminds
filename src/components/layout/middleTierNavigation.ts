import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bell,
  BookOpen,
  Bot,
  BrainCircuit,
  CalendarDays,
  Gamepad2,
  GraduationCap,
  Home,
  Layers3,
  Library,
  MessageCircle,
  Settings,
  ShoppingBag,
  Sparkles,
  Swords,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";

export type MiddleNavGroup = "home" | "learn" | "focus" | "play" | "connect" | "account";

export type MiddleNavItem = {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  group: MiddleNavGroup;
  match: string[];
  primary?: boolean;
  mobile?: boolean;
};

export const middlePrimaryNav: MiddleNavItem[] = [
  { id: "home", label: "Home", path: "/", icon: Home, group: "home", match: ["/"], primary: true, mobile: true },
  { id: "learn", label: "Learn", path: "/quiz", icon: BookOpen, group: "learn", match: ["/quiz", "/academic", "/library", "/ai-tutor", "/revision", "/learning-dna"], primary: true, mobile: true },
  { id: "focus", label: "Focus", path: "/study-mode", icon: Timer, group: "focus", match: ["/study-mode"], primary: true, mobile: true },
  { id: "play", label: "Play", path: "/multiplayer", icon: Gamepad2, group: "play", match: ["/multiplayer", "/lobby", "/tournaments", "/leaderboard", "/store"], primary: true, mobile: true },
  { id: "connect", label: "Connect", path: "/social", icon: MessageCircle, group: "connect", match: ["/social", "/friends", "/chat", "/notifications"], primary: true },
];

export const middleSecondaryNav: MiddleNavItem[] = [
  { id: "academic", label: "Academic Mode", path: "/academic", icon: GraduationCap, group: "learn", match: ["/academic"], mobile: true },
  { id: "flashcards", label: "Flashcards", path: "/academic/flashcards", icon: Layers3, group: "learn", match: ["/academic/flashcards"], mobile: true },
  { id: "topics", label: "Topic coverage", path: "/academic/topics", icon: Target, group: "learn", match: ["/academic/topics"], mobile: true },
  { id: "planner", label: "Study planner", path: "/academic/planner", icon: CalendarDays, group: "focus", match: ["/academic/planner"], mobile: true },
  { id: "insights", label: "Academic insights", path: "/academic/insights", icon: Sparkles, group: "learn", match: ["/academic/insights"], mobile: true },
  { id: "revision", label: "Revision", path: "/revision", icon: BrainCircuit, group: "learn", match: ["/revision"], mobile: true },
  { id: "library", label: "Library", path: "/library", icon: Library, group: "learn", match: ["/library"], mobile: true },
  { id: "ai-tutor", label: "AI Tutor", path: "/ai-tutor", icon: Bot, group: "learn", match: ["/ai-tutor"], mobile: true },
  { id: "lobby", label: "Game lobby", path: "/lobby", icon: Swords, group: "play", match: ["/lobby"], mobile: true },
  { id: "friends", label: "Friends", path: "/friends", icon: Users, group: "connect", match: ["/friends"], mobile: true },
  { id: "community", label: "Community", path: "/social/community", icon: MessageCircle, group: "connect", match: ["/social/community"], mobile: true },
  { id: "chat", label: "Chat", path: "/chat", icon: MessageCircle, group: "connect", match: ["/chat"], mobile: true },
  { id: "notifications", label: "Notifications", path: "/notifications", icon: Bell, group: "connect", match: ["/notifications"], mobile: true },
  { id: "settings", label: "Settings", path: "/settings", icon: Settings, group: "account", match: ["/settings", "/enhanced-settings"], mobile: true },
];

export const middleGroupLabels: Record<MiddleNavGroup, string> = {
  home: "Workspace",
  learn: "Learn",
  focus: "Focus",
  play: "Play",
  connect: "Connect",
  account: "Account",
};

export const isMiddlePathActive = (pathname: string, match: string[]) =>
  match.some((path) => (path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`)));

export const getMiddlePrimaryItem = (pathname: string) =>
  middlePrimaryNav.find((item) => isMiddlePathActive(pathname, item.match));

export const getMiddlePageTitle = (pathname: string) => {
  if (pathname === "/") return "Today";
  if (pathname.startsWith("/leaderboard")) return "Rank";
  const exact = [...middleSecondaryNav].reverse().find((item) => isMiddlePathActive(pathname, item.match));
  return exact?.label ?? getMiddlePrimaryItem(pathname)?.label ?? "Master Minds";
};

export const middleDrawerGroups: MiddleNavGroup[] = ["learn", "focus", "play", "connect", "account"];
