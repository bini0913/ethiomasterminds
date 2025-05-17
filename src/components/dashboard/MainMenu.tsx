
import React from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { Link } from "react-router-dom";
import UserLevel from "../profile/UserLevel";
import { motion } from "framer-motion";
import DailyChallenge from "../challenges/DailyChallenge";
import { useAIHelper } from "@/context/AIHelperContext";
import { Bot, BookOpen, User } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { avatarToEmoji } from "@/utils/avatarUtils";
import LevelUpModal from "../profile/LevelUpModal";
import GainXPButton from "../profile/GainXPButton";

const MainMenu: React.FC = () => {
  const { user, logout, showLevelUp, setShowLevelUp, previousLevel } = useUser();
  const { openHelper } = useAIHelper();
  const { t } = useLanguage();

  const commonMenuItems = [
    { 
      title: t("quiz"), 
      icon: "🎯", 
      path: "/quiz",
      color: "bg-gradient-to-r from-indigo-500 to-purple-600" 
    },
    { 
      title: t("multiplayer"), 
      icon: "👥", 
      path: "/multiplayer",
      color: "bg-gradient-to-r from-blue-500 to-cyan-600" 
    },
    { 
      title: t("leaderboard"), 
      icon: "🏆", 
      path: "/leaderboard",
      color: "bg-gradient-to-r from-green-500 to-teal-600" 
    },
    { 
      title: t("friends"), 
      icon: "👋", 
      path: "/friends",
      color: "bg-gradient-to-r from-yellow-500 to-amber-600" 
    },
    { 
      title: t("settings"), 
      icon: "⚙️", 
      path: "/settings",
      color: "bg-gradient-to-r from-pink-500 to-rose-600" 
    },
  ];

  // Add role-specific menu items
  const menuItems = React.useMemo(() => {
    if (!user) return commonMenuItems;

    let items = [...commonMenuItems];
    
    if (user.role === "teacher") {
      items.push({
        title: "Teacher Dashboard",
        icon: "📚",
        path: "/teacher",
        color: "bg-gradient-to-r from-purple-500 to-indigo-600"
      });
    } 
    
    if (user.role === "admin") {
      items.push({
        title: "Admin Dashboard",
        icon: "🔑",
        path: "/admin",
        color: "bg-gradient-to-r from-red-500 to-orange-600"
      });
    }
    
    return items;
  }, [user, commonMenuItems]);

  // Define the container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  // Define the item animation variants
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-primary px-4 py-3 shadow-md">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Master Minds</h1>
          {user && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={openHelper}
                className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
              >
                <Bot className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={logout}
                className="bg-transparent border-white text-white hover:bg-white hover:text-primary"
              >
                {t("logout")}
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* User Profile Summary */}
      <div className="px-4 py-6 bg-white shadow-md">
        {user && (
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 flex items-center justify-center text-3xl bg-primary-light rounded-full">
              {user.avatar.startsWith("avatar") ? avatarToEmoji(user.avatar) : "👤"}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{user.name}</h2>
              <div className="text-sm text-gray-500 capitalize">{user.role}</div>
            </div>
            <UserLevel level={user.level} xp={user.xp} />
          </div>
        )}
      </div>

      {/* Daily Challenge */}
      <div className="px-4 py-6">
        <DailyChallenge />
        {/* For testing, we'll add the XP button here */}
        {user && <GainXPButton className="mt-4 mx-auto" />}
      </div>

      {/* Menu Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 px-4 py-6 grid grid-cols-2 gap-4"
      >
        {menuItems.map((item) => (
          <motion.div key={item.path} variants={itemVariants}>
            <Link to={item.path} className="block">
              <div 
                className={`${item.color} h-32 rounded-xl shadow-md flex flex-col items-center justify-center text-white transition-transform hover:scale-105`}
              >
                <div className="text-3xl mb-2">{item.icon}</div>
                <div className="font-medium">{item.title}</div>
              </div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
      
      <div className="p-4 text-center text-xs text-gray-500">
        <p>Master Minds v1.0 - Created by Biniam Bogale, 14 years old, Ethiopia</p>
      </div>

      {/* Level Up Modal */}
      {showLevelUp && user && (
        <LevelUpModal 
          previousLevel={previousLevel} 
          newLevel={user.level}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </div>
  );
};

export default MainMenu;
