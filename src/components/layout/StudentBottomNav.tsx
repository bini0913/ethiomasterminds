import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Gamepad2, Globe2, Gift, BookOpen, Swords, MessageCircle, BrainCircuit, Trophy, MoreHorizontal, Users, GraduationCap, Timer, Library, Bot, Settings, Bell, X, Target, CalendarDays, BarChart3, Route } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const tier = getUserTier(user?.grade);
  const [moreOpen, setMoreOpen] = useState(false);
  const early = tier === "early";
  const upper = tier === "upper";

  const earlyItems = [
    { icon: Home, label: "Home", path: "/", match: ["/"] },
    { icon: Gamepad2, label: "Play", path: "/early-games", match: ["/early-games", "/early-quiz"] },
    { icon: Globe2, label: "Discover", path: "/early-discover", match: ["/early-discover"] },
    { icon: BrainCircuit, label: "Explore", path: "/early-explore", match: ["/early-explore", "/early-videos"] },
    { icon: Gift, label: "Rewards", path: "/store", match: ["/store"] },
  ];
  const upperItems = [
    { icon: Home, label: "Studio", path: "/", match: ["/"] },
    { icon: Route, label: "Path", path: "/academic/topics", match: ["/academic/topics"] },
    { icon: Timer, label: "Focus", path: "/study-mode", match: ["/study-mode", "/revision"] },
    { icon: Swords, label: "Arena", path: "/multiplayer", match: ["/multiplayer", "/lobby", "/tournaments"] },
  ].map(i => i.label === "Focus" ? { ...i, label: "Study" } : i);
  const otherItems = [
    { icon: Home, label: "Home", path: "/", match: ["/"] },
    { icon: BookOpen, label: "Study", path: "/academic", match: ["/quiz", "/quiz/filter", "/library", "/ai-tutor", "/academic", "/revision", "/learning-dna"] },
    { icon: Timer, label: "Focus", path: "/study-mode", match: ["/study-mode"] },
    { icon: Swords, label: "Play", path: "/lobby", match: ["/lobby", "/multiplayer", "/tournaments", "/leaderboard", "/store"] },
    { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat", "/notifications"] },
  ];
  const items = early ? earlyItems : upper ? upperItems : otherItems;
  const active = (paths: string[]) => paths.some(p => p === "/" ? location.pathname === "/" : location.pathname.startsWith(p));
  const moreItems = [
    { icon: Timer, label: "Study Mode", path: "/study-mode" },
    { icon: GraduationCap, label: "Academic Preparation", path: "/academic" },
    { icon: Swords, label: "Play with a friend", path: "/multiplayer" },
    { icon: BrainCircuit, label: "Learning DNA", path: "/learning-dna" },
    { icon: Trophy, label: "Tournaments", path: "/tournaments" },
    { icon: Users, label: "Friends", path: "/friends" },
    { icon: Trophy, label: "Leaderboard", path: "/leaderboard" },
    { icon: BookOpen, label: "Topic Coverage", path: "/academic/topics" },
    { icon: Target, label: "Exam Mode", path: "/academic/exam" },
    { icon: CalendarDays, label: "Study Planner", path: "/academic/planner" },
    { icon: BrainCircuit, label: "Flashcards", path: "/academic/flashcards" },
    { icon: BarChart3, label: "Academic Insights", path: "/academic/insights" },
    { icon: Library, label: "Library", path: "/library" },
    { icon: Bot, label: "AI Tutor", path: "/ai-tutor" },
    { icon: MessageCircle, label: "Social & chat", path: "/social" },
    { icon: Bell, label: "Notifications", path: "/notifications" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];
  const moreActive = !active(items.flatMap(i => i.match)) && moreItems.some(item => location.pathname === item.path || location.pathname.startsWith(item.path + "/"));

  return <div data-guide="bottom-nav" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
    {upper && moreOpen && <div className="mx-auto max-w-lg px-3 pb-2">
      <div className="grid max-h-[min(52vh,420px)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-2 shadow-xl sm:grid-cols-3" aria-label="More destinations">
        {moreItems.map(item => { const Icon = item.icon; const is = location.pathname === item.path || location.pathname.startsWith(item.path + "/"); return <button key={item.path} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} aria-current={is ? "page" : undefined} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-foreground"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{item.label}</span></button>; })}
      </div>
    </div>}
    <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around gap-1 px-1 sm:h-[68px] sm:px-2">
      {items.map(item => { const Icon = item.icon; const is = active(item.match); return <motion.button key={item.label} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} whileTap={{ scale: 0.97 }} className={`flex min-h-11 min-w-0 flex-1 max-w-32 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`} aria-label={`Go to ${item.label}`} aria-current={is ? "page" : undefined}><Icon className={`h-5 w-5 ${is ? "stroke-[2.5]" : ""}`} aria-hidden="true"/><span className="text-[11px] font-semibold">{item.label}</span></motion.button>; })}
      {upper && <motion.button type="button" onClick={() => setMoreOpen(o => !o)} whileTap={{ scale: 0.97 }} aria-expanded={moreOpen} aria-label="More destinations" className={`flex min-h-11 min-w-0 flex-1 max-w-32 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${moreOpen || moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>{moreOpen ? <X className="h-5 w-5" aria-hidden="true"/> : <MoreHorizontal className="h-5 w-5" aria-hidden="true"/>}<span className="text-[11px] font-semibold">More</span></motion.button>}
    </nav>
  </div>;
};

export default StudentBottomNav;
