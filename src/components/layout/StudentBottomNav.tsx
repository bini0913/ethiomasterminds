import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import {
  Home,
  BookOpen,
  Trophy,
  User,
  Swords,
} from "lucide-react";

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  const navItems = [
    {
      icon: Home,
      label: "Home",
      path: "/",
      matchPaths: ["/"],
    },
    {
      icon: BookOpen,
      label: "Study",
      path: "/quiz",
      matchPaths: ["/quiz", "/study-mode", "/library", "/ai-tutor", "/academic", "/revision"],
    },
    {
      icon: Swords,
      label: "Play",
      path: "/lobby",
      matchPaths: ["/lobby", "/multiplayer", "/tournaments"],
    },
    {
      icon: Trophy,
      label: "Ranks",
      path: "/leaderboard",
      matchPaths: ["/leaderboard"],
    },
    {
      icon: User,
      label: "Profile",
      path: profilePath,
      matchPaths: ["/profile/", "/friends", "/store", "/settings", "/enhanced-settings", "/avatar-creator"],
    },
  ];

  const isActive = (matchPaths: string[]) =>
    matchPaths.some((path) =>
      path === "/" ? location.pathname === "/" : location.pathname.startsWith(path)
    );

  return (
    <div
      data-guide="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-safe"
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 max-w-lg items-center justify-around px-2 sm:h-[68px]"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.matchPaths);

          return (
            <motion.button
              key={item.label}
              type="button"
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.94 }}
              className={`flex min-w-14 flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                {active && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </nav>
    </div>
  );
};

export default StudentBottomNav;
