import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { useUser } from "@/context/UserContext";
import { 
  Home, 
  Gamepad2, 
  Trophy, 
  Users, 
  Settings,
  Swords,
  User
} from "lucide-react";

const StudentBottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();

  const profilePath = user?.id ? `/profile/${user.id}` : "/settings";

  const navItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: Gamepad2, label: "Quiz", path: "/quiz" },
    { icon: Swords, label: "Lobby", path: "/lobby" },
    { icon: Trophy, label: "Ranks", path: "/leaderboard" },
    { icon: User, label: "Profile", path: profilePath, matchPath: "/profile/" },
    { icon: Users, label: "Friends", path: "/friends" },
    { icon: Settings, label: "Settings", path: "/settings" },
  ];

  const isActive = (path: string, matchPath?: string) => {
    if (matchPath) return location.pathname.startsWith(matchPath);
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div data-guide="bottom-nav" className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 pb-safe">
      <nav className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, item.matchPath);

          return (
            <motion.button
              key={item.path}
              onClick={() => navigate(item.path)}
              whileTap={{ scale: 0.9 }}
              className={`flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all ${
                active 
                  ? "text-primary drop-shadow-[0_0_10px_hsl(var(--primary)/0.55)]" 
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
                {active && (
                  <motion.div
                    layoutId="navIndicator"
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary"
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
