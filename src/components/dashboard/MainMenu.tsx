
import React from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { Link } from "react-router-dom";
import UserLevel from "../profile/UserLevel";
import { motion } from "framer-motion";
import DailyChallenge from "../challenges/DailyChallenge";
import { useAIHelper } from "@/context/AIHelperContext";
import { Bot } from "lucide-react";

const MainMenu: React.FC = () => {
  const { user, logout } = useUser();
  const { openHelper } = useAIHelper();

  const menuItems = [
    { 
      title: "Play Quiz", 
      icon: "🎯", 
      path: "/quiz",
      color: "bg-gradient-to-r from-indigo-500 to-purple-600" 
    },
    { 
      title: "Multiplayer", 
      icon: "👥", 
      path: "/multiplayer",
      color: "bg-gradient-to-r from-blue-500 to-cyan-600" 
    },
    { 
      title: "Leaderboard", 
      icon: "🏆", 
      path: "/leaderboard",
      color: "bg-gradient-to-r from-green-500 to-teal-600" 
    },
    { 
      title: "Friends", 
      icon: "👋", 
      path: "/friends",
      color: "bg-gradient-to-r from-yellow-500 to-amber-600" 
    },
    { 
      title: "Settings", 
      icon: "⚙️", 
      path: "/settings",
      color: "bg-gradient-to-r from-pink-500 to-rose-600" 
    },
  ];

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
                Logout
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
    </div>
  );
};

// Helper function to convert avatar ids to emojis
function avatarToEmoji(avatarId: string): string {
  const map: {[key: string]: string} = {
    "avatar-1": "👦",
    "avatar-2": "👧",
    "avatar-3": "🧑",
    "avatar-4": "👩‍🎓",
    "avatar-5": "🧠",
    "avatar-6": "🦸",
  };
  return map[avatarId] || "👤";
}

export default MainMenu;
