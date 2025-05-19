
import React from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { Link } from "react-router-dom";
import UserLevel from "../profile/UserLevel";
import { motion } from "framer-motion";
import DailyChallenge from "../challenges/DailyChallenge";
import { useAIHelper } from "@/context/AIHelperContext";
import { 
  Bot, 
  BookOpen, 
  Calculator, 
  Atom, 
  Trophy, 
  Users, 
  Settings, 
  GraduationCap,
  School,
  MessageSquare,
  Gamepad
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { avatarToEmoji } from "@/utils/avatarUtils";
import LevelUpModal from "../profile/LevelUpModal";
import GainXPButton from "../profile/GainXPButton";

const MainMenu: React.FC = () => {
  const { user, logout, showLevelUp, setShowLevelUp, previousLevel } = useUser();
  const { openHelper } = useAIHelper();
  const { t } = useLanguage();
  const [activeCategory, setActiveCategory] = React.useState("all");

  // Define subject categories
  const categories = [
    { id: "all", name: "All" },
    { id: "math", name: "Mathematics" },
    { id: "science", name: "Science" },
    { id: "english", name: "English" },
    { id: "gk", name: "General Knowledge" }
  ];

  // Common menu items with enhanced visual elements
  const commonMenuItems = [
    { 
      title: t("quiz"), 
      icon: <GraduationCap className="h-6 w-6 text-white" />,
      emoji: "🎯", 
      path: "/quiz",
      category: "all",
      color: "bg-gradient-to-r from-indigo-500 to-purple-600",
      description: "Test your knowledge across subjects"
    },
    { 
      title: t("multiplayer"), 
      icon: <Users className="h-6 w-6 text-white" />,
      emoji: "👥", 
      path: "/multiplayer",
      category: "all",
      color: "bg-gradient-to-r from-blue-500 to-cyan-600",
      description: "Compete with friends in real-time"
    },
    { 
      title: "Multiplayer Lobby", 
      icon: <Gamepad className="h-6 w-6 text-white" />,
      emoji: "🎮", 
      path: "/lobby",
      category: "all",
      color: "bg-gradient-to-r from-green-400 to-emerald-500",
      description: "Join the lobby to find matches and chat"
    },
    { 
      title: t("leaderboard"), 
      icon: <Trophy className="h-6 w-6 text-white" />,
      emoji: "🏆", 
      path: "/leaderboard",
      category: "all",
      color: "bg-gradient-to-r from-green-500 to-teal-600",
      description: "See who's on top"
    },
    { 
      title: "Mathematics",
      icon: <Calculator className="h-6 w-6 text-white" />,
      emoji: "🧮",
      path: "/quiz/math",
      category: "math",
      color: "bg-gradient-to-r from-red-500 to-pink-600",
      description: "Numbers, algebra, geometry and more"
    },
    { 
      title: "Science",
      icon: <Atom className="h-6 w-6 text-white" />,
      emoji: "🔬",
      path: "/quiz/science",
      category: "science",
      color: "bg-gradient-to-r from-green-500 to-emerald-600",
      description: "Physics, chemistry, biology and more"
    },
    { 
      title: "English",
      icon: <BookOpen className="h-6 w-6 text-white" />,
      emoji: "📚",
      path: "/quiz/english",
      category: "english",
      color: "bg-gradient-to-r from-blue-500 to-indigo-600",
      description: "Grammar, vocabulary, reading and more"
    },
    { 
      title: "General Knowledge",
      icon: <School className="h-6 w-6 text-white" />,
      emoji: "🌍",
      path: "/quiz/gk",
      category: "gk",
      color: "bg-gradient-to-r from-amber-500 to-orange-600",
      description: "History, geography, current affairs and more"
    },
    { 
      title: t("friends"), 
      icon: <Users className="h-6 w-6 text-white" />,
      emoji: "👋", 
      path: "/friends",
      category: "all",
      color: "bg-gradient-to-r from-yellow-500 to-amber-600",
      description: "Connect with friends and classmates"
    },
    { 
      title: t("settings"), 
      icon: <Settings className="h-6 w-6 text-white" />,
      emoji: "⚙️", 
      path: "/settings",
      category: "all",
      color: "bg-gradient-to-r from-pink-500 to-rose-600",
      description: "Customize your experience"
    },
  ];

  // Add role-specific menu items
  const menuItems = React.useMemo(() => {
    if (!user) return commonMenuItems;

    let items = [...commonMenuItems];
    
    if (user.role === "teacher") {
      items.push({
        title: "Teacher Dashboard",
        icon: <School className="h-6 w-6 text-white" />,
        emoji: "📚",
        path: "/teacher",
        category: "all",
        color: "bg-gradient-to-r from-purple-500 to-indigo-600",
        description: "Manage your classes and create quizzes"
      });
    } 
    
    if (user.role === "admin") {
      items.push({
        title: "Admin Dashboard",
        icon: <Settings className="h-6 w-6 text-white" />,
        emoji: "🔑",
        path: "/admin",
        category: "all",
        color: "bg-gradient-to-r from-red-500 to-orange-600",
        description: "Full system management"
      });
    }
    
    return items;
  }, [user, commonMenuItems]);

  // Filter items by active category
  const filteredItems = menuItems.filter(item => 
    activeCategory === "all" || item.category === activeCategory || item.category === "all"
  );

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
      {/* Header with gradient */}
      <header className="bg-gradient-to-r from-primary to-indigo-600 px-4 py-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <motion.div 
              className="bg-white rounded-full p-2 mr-2"
              whileHover={{ rotate: 360 }}
              transition={{ duration: 1 }}
            >
              <span className="text-2xl">🧠</span>
            </motion.div>
            <h1 className="text-2xl font-bold text-white">Master Minds</h1>
          </div>
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

      {/* User Profile Summary with Card Design */}
      <div className="px-4 py-6">
        {user && (
          <motion.div 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex items-center space-x-4 bg-white rounded-xl p-4 shadow-md"
          >
            <div className="h-16 w-16 flex items-center justify-center text-3xl bg-primary-light rounded-full shadow-inner">
              {user.avatar.startsWith("avatar") ? avatarToEmoji(user.avatar) : "👤"}
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{user.name}</h2>
              <div className="text-sm text-gray-500 capitalize">{user.role}</div>
            </div>
            <UserLevel level={user.level} xp={user.xp} showBadge={true} />
          </motion.div>
        )}
      </div>

      {/* Daily Challenge */}
      <div className="px-4 py-2">
        <DailyChallenge />
        {/* For testing, we'll add the XP button here */}
        {user && <GainXPButton className="mt-4 mx-auto" variant="secondary" />}
      </div>

      {/* Category filters */}
      <div className="px-4 py-3">
        <div className="flex overflow-x-auto scrollbar-none gap-2 pb-2">
          {categories.map(category => (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category.id)}
              className={`${activeCategory === category.id ? "bg-primary text-white" : ""} whitespace-nowrap`}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Subject and Menu Grid with Enhanced Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex-1 px-4 py-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      >
        {filteredItems.map((item) => (
          <motion.div key={item.path} variants={itemVariants}>
            <Link to={item.path} className="block">
              <motion.div 
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)"
                }}
                className={`${item.color} rounded-xl shadow-md overflow-hidden relative`}
              >
                <div className="absolute top-0 left-0 w-full h-full bg-black opacity-10"></div>
                <div className="relative p-6 flex flex-col items-center text-white">
                  <div className="mb-3 flex items-center justify-center">
                    {item.icon}
                  </div>
                  <h3 className="font-bold text-lg mb-1">{item.title}</h3>
                  <p className="text-xs opacity-90 text-center">{item.description}</p>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        ))}
      </motion.div>
      
      <div className="p-4 text-center text-xs text-gray-500">
        <p>Master Minds v1.0 - Created by Biniam Bogale, 14 years old, Ethiopia</p>
        <p>Contact: +251713445505</p>
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
