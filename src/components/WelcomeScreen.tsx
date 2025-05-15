
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface WelcomeScreenProps {
  onContinue: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const welcomeTexts = [
    "Welcome to",
    "Master Minds",
    "An educational quiz app to challenge your knowledge",
    "Created by Biniam Bogale, 14 years old, from Ethiopia"
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeIndex < welcomeTexts.length - 1) {
        setActiveIndex(prev => prev + 1);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [activeIndex]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-secondary-dark to-primary-dark p-4 text-white">
      <div className="max-w-md w-full space-y-8 text-center">
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
              index === 1 ? "text-4xl font-bold text-primary" :
              index === 3 ? "text-sm italic mt-8" :
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
            onClick={onContinue}
            className="bg-primary hover:bg-primary-dark transition-all duration-300 px-8 py-6 rounded-xl text-lg font-semibold animate-bounce-subtle"
          >
            Get Started
          </Button>
        </motion.div>
      </div>
      
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 3, duration: 1 }}
        className="absolute bottom-8 left-0 right-0 flex justify-center"
      >
        <div className="text-center text-sm opacity-70">
          Tap anywhere to continue
        </div>
      </motion.div>
    </div>
  );
};

export default WelcomeScreen;
