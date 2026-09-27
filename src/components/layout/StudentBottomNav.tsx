import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { useTier } from "@/context/TierContext";
import { Home, Gamepad2, Trophy, Users, Settings, Swords, User, BookOpen, Brain } from "lucide-react";

const UPPER_STUDY_PATHS = ["/quiz", "/study-mode", "/library", "/academic", "/revision", "/ai-tutor"];
const UPPER_PROFILE_PATHS = ["/profile", "/settings", "/enhanced-settings", "/friends", "/store", "/avatar-creator", "/social", "/lobby", "/tournaments", "/leaderboard", "/chat"];

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const tier = useTier();

  if (tier === "upper") {
    const navItems = [
      { icon: Home, label: "Home", path: "/", activePaths: ["/"] },
      { icon: BookOpen, label: "Study", path: "/study-mode", activePaths: UPPER_STUDY_PATHS },
      { icon: Brain, label: "Learning DNA", path: "/learning-dna", activePaths: ["/learning-dna"] },
      { icon: User, label: "Profile", path: "/profile", activePaths: UPPER_PROFILE_PATHS },
    ];
    const isActive = (paths: string[]) => paths.some((path) => path === "/" ? location.pathname === "/" : location.pathname === path || location.pathname.startsWith(`${path}/`));
    return <div data-guide="bottom-nav" className="bottom-safe-area fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 md:bg-background/90 md:backdrop-blur">
      <nav aria-label="Primary navigation" className="mx-auto grid h-16 max-w-md grid-cols-4 items-stretch px-2 md:max-w-lg">
        {navItems.map((item) => { const Icon = item.icon; const active = isActive(item.activePaths); return <motion.button key={item.path} onClick={() => navigate(item.path)} whileTap={{ scale: 0.96 }} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}><Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} aria-hidden="true" /><span>{item.label}</span></motion.button>; })}
      </nav>
    </div>;
  }

  // Preserve the existing Middle-tier navigation and its destinations.
  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";
  const navItems = [
    { icon: Home, label: "Home", path: "/" }, { icon: Gamepad2, label: "Quiz", path: "/quiz" }, { icon: Swords, label: "Lobby", path: "/lobby" }, { icon: Trophy, label: "Ranks", path: "/leaderboard" }, { icon: User, label: "Profile", path: profilePath, matchPath: "/profile/" }, ...(tier === "early" ? [] : [{ icon: Users, label: "Friends", path: "/friends" }]), { icon: Settings, label: "Settings", path: "/settings" },
  ];
  const isActive = (path: string, matchPath?: string) => matchPath ? location.pathname.startsWith(matchPath) : path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
  return <div data-guide="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/80 pb-safe backdrop-blur-xl"><nav className="flex h-16 max-w-lg items-center justify-around px-2">{navItems.map((item) => { const Icon = item.icon; const active = isActive(item.path, item.matchPath); return <motion.button key={item.path} onClick={() => navigate(item.path)} whileTap={{ scale: 0.9 }} className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-all ${active ? "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]" : "text-muted-foreground hover:text-foreground"}`}><div className="relative"><Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />{active && <motion.div layoutId="navIndicator" className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary" transition={{ type: "spring", stiffness: 500, damping: 30 }} />}</div><span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>{item.label}</span></motion.button>; })}</nav></div>;
};
export default StudentBottomNav;
