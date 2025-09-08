import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { Crown, Users, ShieldCheck, GraduationCap, Sparkles, BookOpen, Trophy, Zap } from "lucide-react";
import LanguageSelector from "@/components/common/LanguageSelector";

interface EnhancedWelcomeScreenProps {
  onContinue: (userType?: "student" | "teacher" | "admin" | "manager") => void;
}

const EnhancedWelcomeScreen: React.FC<EnhancedWelcomeScreenProps> = ({ onContinue }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { t } = useLanguage();

  // Enhanced intro slides
  const introSlides = [
    {
      title: "Master Minds",
      subtitle: "Where Learning Meets Adventure",
      description: "Join millions of students worldwide in the ultimate learning experience",
      icon: <Sparkles className="w-16 h-16" />,
      gradient: "from-purple-600 via-blue-600 to-teal-500"
    },
    {
      title: "Battle & Learn",
      subtitle: "Multiplayer Quiz Battles",
      description: "Challenge friends in real-time quiz duels across all subjects",
      icon: <Trophy className="w-16 h-16" />,
      gradient: "from-orange-500 via-red-500 to-pink-600"
    },
    {
      title: "AI-Powered Growth", 
      subtitle: "Smart Learning Assistant",
      description: "Get personalized help and adaptive difficulty that grows with you",
      icon: <Zap className="w-16 h-16" />,
      gradient: "from-green-500 via-emerald-500 to-teal-600"
    },
    {
      title: "Global Leaderboards",
      subtitle: "Compete Worldwide",
      description: "Climb the ranks from local classroom to international champion",
      icon: <Crown className="w-16 h-16" />,
      gradient: "from-yellow-500 via-amber-500 to-orange-600"
    }
  ];

  // Auto-advance slides
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % introSlides.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  // 3D floating particles
  const [particles] = useState(() => 
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 8 + 4,
      speed: Math.random() * 2 + 1,
      color: ['#9b87f5', '#1EAEDB', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)]
    }))
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Language Selector - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <LanguageSelector />
      </div>

      {/* Animated Background */}
      <div className="absolute inset-0">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full opacity-20"
            style={{
              backgroundColor: particle.color,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
            }}
            animate={{
              x: [particle.x + '%', (particle.x + 20) % 100 + '%'],
              y: [particle.y + '%', (particle.y - 30) % 100 + '%'],
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{
              duration: particle.speed * 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6">
        
        {/* Creator Credit */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-8"
        >
          <div className="text-center bg-black/20 backdrop-blur-sm p-4 rounded-2xl border border-white/10">
            <h4 className="text-lg font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Master Minds
            </h4>
            <p className="text-sm text-white/80">
              Created by Biniam Bogale, 14 years old, Ethiopia
            </p>
            <p className="text-xs text-white/60 mt-1">
              "Turning Learning Into Adventure"
            </p>
          </div>
        </motion.div>

        {/* Main Logo */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 1, type: "spring", bounce: 0.3 }}
          className="mb-12"
        >
          <div className="relative">
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-1">
              <div className="w-full h-full rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center">
                <motion.div
                  animate={{ rotateY: 360 }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  className="text-6xl font-black text-white"
                >
                  MM
                </motion.div>
              </div>
            </div>
            
            {/* Floating icons around logo */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0"
            >
              <BookOpen className="absolute -top-4 left-1/2 transform -translate-x-1/2 w-6 h-6 text-yellow-400" />
              <Trophy className="absolute top-1/2 -right-4 transform -translate-y-1/2 w-6 h-6 text-green-400" />
              <Sparkles className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-6 h-6 text-purple-400" />
              <Zap className="absolute top-1/2 -left-4 transform -translate-y-1/2 w-6 h-6 text-blue-400" />
            </motion.div>
          </div>
        </motion.div>

        {/* Slide Content */}
        <div className="w-full max-w-lg mb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="text-center"
            >
              <div className={`inline-flex p-4 rounded-full bg-gradient-to-r ${introSlides[currentSlide].gradient} mb-6`}>
                {introSlides[currentSlide].icon}
              </div>
              
              <h2 className="text-4xl font-bold text-white mb-2">
                {introSlides[currentSlide].title}
              </h2>
              
              <h3 className="text-xl text-purple-200 mb-4">
                {introSlides[currentSlide].subtitle}
              </h3>
              
              <p className="text-white/80 text-lg leading-relaxed">
                {introSlides[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Slide Indicators */}
          <div className="flex justify-center space-x-2 mt-8">
            {introSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentSlide ? 'bg-white scale-125' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Login Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1, duration: 0.8 }}
          className="w-full max-w-md space-y-4"
        >
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={() => onContinue("student")}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white border-0 py-6 rounded-2xl text-lg font-semibold shadow-2xl"
              size="lg"
            >
              <GraduationCap className="mr-3 h-6 w-6" />
              Student Login
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={() => onContinue("teacher")}
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white border-0 py-6 rounded-2xl text-lg font-semibold shadow-2xl"
              size="lg"
            >
              <Users className="mr-3 h-6 w-6" />
              Teacher Login
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={() => onContinue("admin")}
              className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white border-0 py-6 rounded-2xl text-lg font-semibold shadow-2xl"
              size="lg"
            >
              <ShieldCheck className="mr-3 h-6 w-6" />
              Admin Login
            </Button>
          </motion.div>
          
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              onClick={() => onContinue("manager")}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 py-6 rounded-2xl text-lg font-semibold shadow-2xl"
              size="lg"
            >
              <Crown className="mr-3 h-6 w-6" />
              Manager Login
            </Button>
          </motion.div>
        </motion.div>

        {/* Bottom Credit */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-8 text-center text-white/60 text-sm"
        >
          <p>🇪🇹 Made with ❤️ in Ethiopia • Master Minds v2.0</p>
        </motion.div>
      </div>
    </div>
  );
};

export default EnhancedWelcomeScreen;