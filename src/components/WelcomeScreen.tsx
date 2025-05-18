import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { BookOpen, Users, Trophy } from "lucide-react"; // Import icons we'll use

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { t } = useLanguage();
  
  const welcomeTexts = [
    t("welcome"),
    "Master Minds",
    "A quiz game and learning world created by Biniam Bogale, 14-year-old student from Ethiopia.",
    "Compete, learn, and level up your mind!",
    "Created with passion to help students learn and grow"
  ];

  // Particle animation setup
  const [particles, setParticles] = useState<Array<{
    id: number;
    x: number;
    y: number;
    size: number;
    speed: number;
    opacity: number;
  }>>([]);

  useEffect(() => {
    // Create particles for background animation
    const particleCount = 20;
    const newParticles = [];
    
    for (let i = 0; i < particleCount; i++) {
      newParticles.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 5 + 1,
        speed: Math.random() * 0.3 + 0.1,
        opacity: Math.random() * 0.5 + 0.1
      });
    }
    
    setParticles(newParticles);
    
    // Timer for welcome text animation
    const timer = setTimeout(() => {
      if (activeIndex < welcomeTexts.length - 1) {
        setActiveIndex(prev => prev + 1);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeIndex, welcomeTexts.length]);

  // Animate particles
  useEffect(() => {
    const animateParticles = () => {
      setParticles(prevParticles =>
        prevParticles.map(particle => {
          // Fix: The duplicate property 'y' is causing the error
          // First calculate the new y position
          const newY = particle.y - particle.speed;
          // Then return the updated particle with the correct y value
          return {
            ...particle,
            y: newY <= 0 ? 100 : newY,
            opacity: newY <= 0 ? Math.random() * 0.5 + 0.1 : particle.opacity
          };
        })
      );
    };

    const animationFrame = requestAnimationFrame(() => {
      const interval = setInterval(animateParticles, 50);
      return () => clearInterval(interval);
    });

    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Role selection cards data
  const roleCards = [
    {
      role: "Student",
      icon: <BookOpen className="h-8 w-8 mb-2" />,
      description: "Take quizzes, compete with friends, and level up",
      gradient: "from-blue-500 to-purple-600"
    },
    {
      role: "Teacher", 
      icon: <Users className="h-8 w-8 mb-2" />,
      description: "Create quizzes, track student progress",
      gradient: "from-green-500 to-teal-600"
    },
    {
      role: "Admin",
      icon: <Trophy className="h-8 w-8 mb-2" />,
      description: "Full control over users, quizzes, and content",
      gradient: "from-yellow-500 to-amber-600"
    }
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background gradient and particles */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500 to-purple-600 z-0">
        {particles.map(particle => (
          <motion.div
            key={particle.id}
            className="absolute rounded-full bg-white"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              opacity: particle.opacity
            }}
            animate={{
              y: ["0%", "-100%"],
              opacity: [particle.opacity, 0]
            }}
            transition={{
              duration: 10 / particle.speed,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>
      
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black opacity-30 z-10"></div>
      
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6 text-white">
        {/* App Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          className="flex flex-col items-center mb-8"
        >
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
            <motion.div
              animate={{ rotateY: [0, 360] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="text-4xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent font-bold"
            >
              MM
            </motion.div>
          </div>
        </motion.div>
        
        {/* Welcome Text Animation */}
        <div className="max-w-md w-full space-y-4 text-center mb-8">
          {welcomeTexts.map((text, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ 
                opacity: index <= activeIndex ? 1 : 0,
                y: index <= activeIndex ? 0 : 20
              }}
              transition={{ duration: 0.7 }}
              className={`${
                index === 0 ? "text-xl font-light" :
                index === 1 ? "text-5xl font-bold text-white" :
                index === 4 ? "text-sm italic mt-4" :
                "text-lg"
              }`}
            >
              {text}
            </motion.div>
          ))}
        </div>
        
        {/* Role Selection Cards */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: activeIndex >= 2 ? 1 : 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mb-8"
        >
          {roleCards.map((card, index) => (
            <motion.div
              key={card.role}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 + index * 0.2, duration: 0.5 }}
              whileHover={{ scale: 1.05 }}
              className={`bg-gradient-to-r ${card.gradient} p-6 rounded-xl shadow-lg text-center cursor-pointer`}
              onClick={() => {
                // In a real app, we'd route to specific login pages here
                onContinue();
              }}
            >
              <div className="flex flex-col items-center">
                {card.icon}
                <h3 className="text-xl font-bold mb-2">Login as {card.role}</h3>
                <p className="text-sm opacity-90">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
        
        {/* Get Started Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: activeIndex === welcomeTexts.length - 1 ? 1 : 0 }}
          transition={{ delay: 1, duration: 0.5 }}
        >
          <Button 
            onClick={onContinue}
            className="bg-white text-primary hover:bg-primary-light hover:text-primary transition-all duration-300 px-8 py-6 rounded-xl text-lg font-semibold animate-bounce-subtle"
            size="lg"
          >
            {t("get-started")}
          </Button>
        </motion.div>
        
        {/* Tap to continue text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 3, duration: 1 }}
          className="absolute bottom-8 left-0 right-0 flex justify-center"
        >
          <div className="text-center text-sm opacity-70">
            {t("tap-to-continue")}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
