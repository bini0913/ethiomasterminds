
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, BadgeCheck, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { useLanguage } from "@/context/LanguageContext";
import XPProgressBar from "./XPProgressBar";
import { toast } from "sonner";

interface LevelUpModalProps {
  previousLevel: number;
  newLevel: number;
  onClose: () => void;
}

const LevelUpModal: React.FC<LevelUpModalProps> = ({ 
  previousLevel, 
  newLevel,
  onClose 
}) => {
  const { t } = useLanguage();
  const { user } = useUser();
  const [step, setStep] = useState(0);
  
  useEffect(() => {
    // Auto progress through animation steps
    const timer = setTimeout(() => {
      if (step < 2) {
        setStep(step + 1);
      }
    }, step === 0 ? 1500 : 2500);
    
    return () => clearTimeout(timer);
  }, [step]);

  const handleClose = () => {
    toast.success(`You are now level ${newLevel}!`);
    onClose();
  };

  // Determine new rewards based on level achieved
  const getNewRewards = () => {
    if (newLevel === 3) return "Thinker rank unlocked!";
    if (newLevel === 6) return "Challenger rank unlocked!";
    if (newLevel === 10) return "Genius rank unlocked!";
    if (newLevel === 15) return "Master Mind rank unlocked!";
    if (newLevel % 5 === 0) return "Special badge unlocked!";
    return "New quiz difficulty unlocked!";
  };

  if (!user) return null;
  
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleClose}
      >
        <motion.div
          className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 text-center"
          initial={{ scale: 0.8, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {step === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="py-6"
            >
              <motion.div 
                className="text-4xl mb-4 flex justify-center"
                animate={{ 
                  rotate: [0, 10, -10, 10, 0],
                  scale: [1, 1.2, 1]
                }}
                transition={{ duration: 1 }}
              >
                🎉
              </motion.div>
              <motion.h2 
                className="text-2xl font-bold text-primary mb-2"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                {t("level-up")}
              </motion.h2>
              <p className="text-gray-600">Congratulations on your achievement!</p>
            </motion.div>
          )}
          
          {step === 1 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-4"
            >
              <div className="relative mx-auto w-24 h-24 mb-6">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                  animate={{ 
                    scale: [1, 1.2, 1],
                    boxShadow: [
                      "0 0 0 0 rgba(124, 58, 237, 0.7)",
                      "0 0 0 20px rgba(124, 58, 237, 0)",
                      "0 0 0 0 rgba(124, 58, 237, 0)"
                    ]
                  }}
                  transition={{ repeat: 1, duration: 1.5 }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-white text-2xl font-bold">
                    {newLevel}
                  </div>
                </motion.div>
              </div>
              
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.5 } }}
              >
                <h3 className="text-xl font-bold mb-1">
                  Level {previousLevel} → {newLevel}
                </h3>
                <p className="text-gray-600 mb-4">You've reached a new level!</p>
                <XPProgressBar 
                  xp={user.xp} 
                  level={newLevel}
                  showAnimation={true} 
                  className="mb-4" 
                />
              </motion.div>
            </motion.div>
          )}
          
          {step === 2 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="py-4"
            >
              <motion.div 
                className="flex items-center justify-center mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
              >
                <Award className="h-16 w-16 text-yellow-500" />
              </motion.div>
              
              <h3 className="text-xl font-bold mb-2">New Rewards!</h3>
              <p className="text-gray-600 mb-6">{getNewRewards()}</p>
              
              <div className="grid grid-cols-3 gap-3 mb-6">
                <motion.div 
                  className="flex flex-col items-center justify-center p-3 bg-indigo-50 rounded-lg"
                  whileHover={{ scale: 1.05 }}
                >
                  <BadgeCheck className="h-6 w-6 text-indigo-500 mb-1" />
                  <span className="text-xs text-gray-600">New Quizzes</span>
                </motion.div>
                <motion.div 
                  className="flex flex-col items-center justify-center p-3 bg-purple-50 rounded-lg"
                  whileHover={{ scale: 1.05 }}
                >
                  <Star className="h-6 w-6 text-purple-500 mb-1" />
                  <span className="text-xs text-gray-600">XP Bonus</span>
                </motion.div>
                <motion.div 
                  className="flex flex-col items-center justify-center p-3 bg-blue-50 rounded-lg"
                  whileHover={{ scale: 1.05 }}
                >
                  <Award className="h-6 w-6 text-blue-500 mb-1" />
                  <span className="text-xs text-gray-600">New Rank</span>
                </motion.div>
              </div>
              
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600"
              >
                Continue Learning
              </Button>
            </motion.div>
          )}
          
          {/* Progress dots */}
          <div className="flex justify-center mt-4 space-x-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`h-2 w-2 rounded-full ${
                  step === i ? "bg-primary" : "bg-gray-300"
                }`}
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LevelUpModal;
