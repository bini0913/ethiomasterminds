import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Gamepad2, Globe2, Gift, BookOpen, Swords, MessageCircle, BrainCircuit, Trophy, Users, GraduationCap, Timer, Library, Bot, Settings, Bell, Target, CalendarDays, BarChart3 } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const tier = getUserTier(user?.grade);
  const early = tier === "early";
  const upper = tier === "upper";

  const earlyItems = [
    { icon: Home, label: "Home", path: "/", match: ["/"] },
    { icon: Gamepad2, label: "Play", path: "/early-games", match: ["/early-games", "/early-quiz"] },
    { icon: Globe2, label: "Discover", path: "/early-discover", match: ["/early-discover", "/early-videos", "/early-explore"] },
    { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat"] },
    { icon: Gift, label: "Rewards", path: "/store", match: ["/store"] },
  ];
  const upperItems = [
    { icon: Home, label: "Home", path: "/", match: ["/"] },
    { icon: MessageCircle, label: "Community", path: "/social/community", match: ["/social", "/friends", "/chat", "/multiplayer", "/lobby", "/tournaments", "/leaderboard"] },
    { icon: Timer, label: "Study", path: "/study-mode", match: ["/study-mode", "/revision", "/academic", "/library", "/quiz", "/ai-tutor", "/learning-dna"] },
  ];
  const otherItems = [
    { icon: Home, label: "Home", path: "/", match: ["/"] },
    { icon: BookOpen, label: "Study", path: "/academic", match: ["/quiz", "/quiz/filter", "/study-mode", "/library", "/ai-tutor", "/academic", "/revision", "/learning-dna"] },
    { icon: Swords, label: "Play", path: "/lobby", match: ["/lobby", "/multiplayer", "/tournaments", "/leaderboard", "/store"] },
    { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat", "/notifications"] },
  ];
  const items = early ? earlyItems : upper ? upperItems : otherItems;
  const active = (paths: string[]) => paths.some(p => p === "/" ? location.pathname === "/" : location.pathname.startsWith(p));
  return <div data-guide="bottom-nav" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
    <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around gap-1 px-1 sm:h-[68px] sm:px-2">
      {items.map(item => { const Icon = item.icon; const is = active(item.match); return <motion.button key={item.label} type="button" onClick={() => navigate(item.path) whileTap={{ scale: 0.97 }} className={`flex min-h-11 min-w-0 flex-1 max-w-32 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`} aria-label={`Go to ${item.label}`} aria-current={is ? "page" : undefined}><Icon className={`h-5 w-5 ${is ? "stroke-[2.5]" : ""}`} aria-hidden="true"/><span className="text-[11px] font-semibold">{item.label}</span></motion.button>; })}

    </nav>
  </div>;
};

export default StudentBottomNav;
