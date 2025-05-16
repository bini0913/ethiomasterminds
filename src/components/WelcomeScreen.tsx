
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLanguage } from "@/context/LanguageContext";

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

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeIndex < welcomeTexts.length - 1) {
        setActiveIndex(prev => prev + 1);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeIndex, welcomeTexts.length]);

  return (
    <div 
      className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-500 to-purple-600 p-4 text-white"
      onClick={onContinue}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1 }}
        className="absolute inset-0 z-0"
      >
        <div className="absolute inset-0 bg-black opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-50"></div>
      </motion.div>

      <div className="relative z-10 max-w-md w-full space-y-8 text-center">
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
              index === 4 ? "text-sm italic mt-8" :
              "text-lg"
            }`}
          >
            {text}
          </motion.div>
        ))}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: activeIndex === welcomeTexts.length - 1 ? 1 : 0 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="pt-8"
        >
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              onContinue();
            }}
            className="bg-white text-primary hover:bg-primary-light hover:text-primary transition-all duration-300 px-8 py-6 rounded-xl text-lg font-semibold animate-bounce-subtle"
          >
            {t("get-started")}
          </Button>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-8 left-0 right-0 flex justify-center z-10"
      >
        <div className="text-center text-sm opacity-70">
          {t("tap-to-continue")}
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
