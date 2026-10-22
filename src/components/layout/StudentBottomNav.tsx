import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Gamepad2, Globe2, Gift, BookOpen, Swords, MessageCircle, Brain, Trophy, MoreHorizontal, Users, GraduationCap } from "lucide-react";
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

  const items = early
    ? [
        { icon: Home, label: "Home", path: "/", match: ["/"] },
        { icon: Gamepad2, label: "Play", path: "/early-games", match: ["/early-games", "/early-quiz"] },
        { icon: Globe2, label: "Discover", path: "/early-discover", match: ["/early-discover", "/early-videos", "/early-explore"] },
        { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat"] },
        { icon: Gift, label: "Rewards", path: "/store", match: ["/store"] },
      ]
    : upper
    ? [
        { icon: Home, label: "Home", path: "/", match: ["/"] },
        { icon: BookOpen, label: "Study", path: "/study-mode", match: ["/study-mode", "/academic", "/quiz", "/quiz/filter", "/library", "/revision", "/academic/setup", "/academic/flashcards", "/academic/topics", "/academic/exam", "/academic/planner", "/academic/insights"] },
        { icon: Swords, label: "Compete", path: "/multiplayer", match: ["/multiplayer", "/lobby"] },
        { icon: GraduationCap, label: "Prep", path: "/academic", match: ["/academic", "/library"] },
      ]
    : [
        { icon: Home, label: "Home", path: "/", match: ["/"] },
        { icon: BookOpen, label: "Study", path: "/academic", match: ["/quiz", "/quiz/filter", "/study-mode", "/library", "/ai-tutor", "/academic", "/revision", "/learning-dna", "/academic/setup", "/academic/flashcards", "/academic/topics", "/academic/exam", "/academic/planner", "/academic/insights"] },
        { icon: Swords, label: "Play", path: "/lobby", match: ["/lobby", "/multiplayer", "/tournaments", "/leaderboard", "/store"] },
        { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat", "/notifications"] },
      ];

  const active = (paths: string[]) => paths.some((p) => (p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)));
  const moreItems = [
    { icon: Brain, label: "Learning DNA", path: "/learning-dna" },
    { icon: Swords, label: "Play with a friend", path: "/multiplayer" },
    { icon: Trophy, label: "Tournaments", path: "/tournaments" },
    { icon: Users, label: "Friends", path: "/friends" },
    { icon: MessageCircle, label: "Social & chat", path: "/social" },
    { icon: Gift, label: "Rewards store", path: "/store" },
  ];
  const moreActive = moreItems.some((item) => location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path)));

  return (
    <div data-guide="bottom-nav" className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      {upper && moreOpen && (
        <div className="mx-auto max-w-lg px-3 pb-2">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card p-2 shadow-xl sm:grid-cols-3" aria-label="More destinations">
            {moreItems.map((item) => {
              const Icon = item.icon;
              const is = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
              return <button key={item.path} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} aria-current={is ? "page" : undefined} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-foreground"}`}><Icon className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">{item.label}</span></button>;
            })}
          </div>
        </div>
      )}
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around px-1 sm:h-[68px]">
        {items.map((item) => {
          const Icon = item.icon;
          const is = active(item.match);
          return <motion.button key={item.label} type="button" onClick={() => { setMoreOpen(false); navigate(item.path); }} whileTap={{ scale: 0.97 }} className={`flex min-h-11 min-w-0 flex-1 max-w-32 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`} aria-label={`Go to ${item.label}`} aria-current={is ? "page" : undefined}><Icon className={`h-5 w-5 ${is ? "stroke-[2.5]" : ""}`} aria-hidden="true"/><span className="text-[11px] font-semibold">{item.label}</span></motion.button>;
        })}
        {upper && <motion.button type="button" onClick={() => setMoreOpen((open) => !open)} whileTap={{ scale: 0.97 }} aria-expanded={moreOpen} aria-label="More navigation" className={`flex min-h-11 min-w-0 flex-1 max-w-32 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${moreOpen || moreActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}><MoreHorizontal className="h-5 w-5" aria-hidden="true"/><span className="text-[11px] font-semibold">More</span></motion.button>}
      </nav>
    </div>
  );
};

export default StudentBottomNav;
