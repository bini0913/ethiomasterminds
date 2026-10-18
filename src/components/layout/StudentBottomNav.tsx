import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, Gamepad2, Globe2, Trophy, Gift, BookOpen, User, Swords, MessageCircle } from "lucide-react";
import { useUser } from "@/context/UserContext";
import { getUserTier } from "@/lib/getUserTier";

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const profilePath = user?.id ? "/profile/" + user.id : "/settings";
  const tier = getUserTier(user?.grade);

  const early = tier === "early";
  const middle = tier === "middle";

  // Navigation adapts to each learner tier while sharing the same accessible component.
  // Early learners get discovery and rewards; middle learners get social-first navigation;
  // high-school learners get a quieter four-destination navigation bar.
  const items = early
    ? [
        { icon: Home, label: "Home", path: "/", match: ["/"] },
        { icon: Gamepad2, label: "Play", path: "/early-games", match: ["/early-games", "/early-quiz"] },
        { icon: Globe2, label: "Discover", path: "/early-discover", match: ["/early-discover", "/early-videos", "/early-explore"] },
        { icon: Trophy, label: "Ranks", path: "/early-ranks", match: ["/early-ranks", "/early-progress"] },
        { icon: Gift, label: "Rewards", path: "/store", match: ["/store"] },
      ]
    : middle
      ? [
          { icon: Home, label: "Home", path: "/", match: ["/"] },
          { icon: BookOpen, label: "Study", path: "/academic", match: ["/quiz", "/study-mode", "/library", "/ai-tutor", "/academic", "/revision", "/learning-dna"] },
          { icon: Swords, label: "Play", path: "/lobby", match: ["/lobby", "/multiplayer", "/tournaments"] },
          { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat"] },
          { icon: User, label: "Profile", path: profilePath, match: ["/profile/", "/settings", "/enhanced-settings", "/avatar-creator"] },
        ]
      : [
          { icon: Home, label: "Home", path: "/", match: ["/"] },
          { icon: BookOpen, label: "Study", path: "/academic", match: ["/quiz", "/quiz/filter", "/study-mode", "/library", "/ai-tutor", "/academic", "/revision", "/learning-dna", "/academic/setup", "/academic/flashcards", "/academic/topics", "/academic/exam", "/academic/planner", "/academic/insights"] },
          { icon: Swords, label: "Play", path: "/lobby", match: ["/lobby", "/multiplayer", "/tournaments"] },
          { icon: MessageCircle, label: "Social", path: "/social", match: ["/social", "/friends", "/chat"] },
        ];

  const active = (paths: string[]) =>
    paths.some((p) => (p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)));

  return (
    <div
      data-guide="bottom-nav"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
    >
      <nav aria-label="Primary" className="mx-auto flex h-16 max-w-lg items-center justify-around px-1 sm:h-[68px]">
        {items.map((item) => {
          const Icon = item.icon;
          const is = active(item.match);
          return (
            <motion.button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.97 }}
              className={`flex min-h-11 min-w-0 flex-1 max-w-28 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${is ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
              aria-label={`Go to ${item.label}`}
              aria-current={is ? "page" : undefined}
            >
              <Icon className={`h-5 w-5 ${is ? "stroke-[2.5]" : ""}`} aria-hidden="true" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default StudentBottomNav;
