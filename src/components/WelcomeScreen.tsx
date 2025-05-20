
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";
import { BookOpen, Users, ShieldCheck, GraduationCap } from "lucide-react";

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const { t } = useLanguage();
  
  // Animation text content
  const welcomeTexts = [
    t("welcome"),
    "Master Minds",
    "Learn. Play. Grow.",
    "A powerful and interactive learning app where students explore subjects, challenge friends, and grow smarter every day.",
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

  // Setup initial particles and text animation
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
          const newY = particle.y - particle.speed;
          return {
            ...particle,
            y: newY <= 0 ? 100 : newY,
            opacity: newY <= 0 ? Math.random() * 0.5 + 0.1 : particle.opacity
          };
        })
      );
    };

    const interval = setInterval(animateParticles, 50);
    return () => clearInterval(interval);
  }, []);

  // Subject icons for background
  const subjectIcons = [
    { name: "Math", emoji: "🧮", color: "bg-blue-500" },
    { name: "Science", emoji: "🔬", color: "bg-green-500" },
    { name: "English", emoji: "📚", color: "bg-purple-500" },
    { name: "History", emoji: "🏛️", color: "bg-amber-500" },
    { name: "Geography", emoji: "🌍", color: "bg-teal-500" },
    { name: "Art", emoji: "🎨", color: "bg-pink-500" },
    { name: "Music", emoji: "🎵", color: "bg-indigo-500" },
    { name: "Sports", emoji: "⚽", color: "bg-red-500" },
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
        
        {/* Floating subject icons */}
        {subjectIcons.map((icon, index) => (
          <motion.div
            key={index}
            className={`absolute rounded-full ${icon.color} flex items-center justify-center w-12 h-12 text-white shadow-lg`}
            initial={{ 
              x: Math.random() * 100 + "%", 
              y: Math.random() * 100 + "%", 
              opacity: 0.5 
            }}
            animate={{
              x: [
                Math.random() * 80 + 10 + "%", 
                Math.random() * 80 + 10 + "%"
              ],
              y: [
                Math.random() * 80 + 10 + "%", 
                Math.random() * 80 + 10 + "%"
              ],
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.2, 1]
            }}
            transition={{
              duration: Math.random() * 10 + 20,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
          >
            <span className="text-2xl">{icon.emoji}</span>
          </motion.div>
        ))}
      </div>
      
      {/* Dark overlay for better readability */}
      <div className="absolute inset-0 bg-black opacity-30 z-10"></div>
      
      <div className="relative z-20 flex flex-col items-center justify-center min-h-screen p-6 text-white">
        {/* About Creator - moved to top */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 1 }}
          className="mb-8 px-6"
        >
          <div className="text-center max-w-md mx-auto bg-black bg-opacity-30 p-4 rounded-lg">
            <p className="text-sm text-white">
              Created by Biniam Bogale, a passionate student from Ethiopia who envisions a smarter world where learning is engaging, challenging, and accessible to all.
            </p>
            <p className="text-xs mt-2 text-white opacity-70">
              Contact: +251713445505
            </p>
          </div>
        </motion.div>
        
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
        <div className="max-w-md w-full space-y-4 text-center mb-12">
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
                index === 2 ? "text-2xl font-semibold" :
                "text-lg"
              }`}
            >
              {text}
            </motion.div>
          ))}
        </div>
        
        {/* Login Option Buttons - shown after text animation completes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: activeIndex >= 3 ? 1 : 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="flex flex-col space-y-4 w-full max-w-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.5, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
          >
            <Button 
              onClick={onContinue}
              className="w-full bg-white text-primary hover:bg-blue-100 transition-all duration-300 py-6 rounded-xl text-lg font-semibold"
              size="lg"
            >
              <GraduationCap className="mr-2 h-5 w-5" />
              Log In as Student
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.7, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
          >
            <Button 
              onClick={onContinue}
              className="w-full bg-green-500 text-white hover:bg-green-600 transition-all duration-300 py-6 rounded-xl text-lg font-semibold"
              size="lg"
            >
              <Users className="mr-2 h-5 w-5" />
              Log In as Teacher
            </Button>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.9, duration: 0.5 }}
            whileHover={{ scale: 1.05 }}
          >
            <Button 
              onClick={onContinue}
              className="w-full bg-amber-500 text-white hover:bg-amber-600 transition-all duration-300 py-6 rounded-xl text-lg font-semibold"
              size="lg"
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              Log In as Admin
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
