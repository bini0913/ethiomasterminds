
import React, { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { motion, useAnimation } from "framer-motion";
import { BadgeCheck, Star } from "lucide-react";

interface XPProgressBarProps {
  xp: number;
  level: number;
  showAnimation?: boolean;
  className?: string;
}

const XPProgressBar: React.FC<XPProgressBarProps> = ({ 
  xp, 
  level, 
  showAnimation = false,
  className = "" 
}) => {
  // Calculate XP needed for the next level
  const xpForCurrentLevel = (level - 1) * 100;
  const xpForNextLevel = level * 100;
  const currentLevelXP = xp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.min(100, (currentLevelXP / xpNeededForNextLevel) * 100);
  
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const controls = useAnimation();
  
  useEffect(() => {
    if (showAnimation) {
      setAnimatedProgress(0);
      setTimeout(() => {
        setAnimatedProgress(progressPercentage);
        controls.start({
          scale: [1, 1.1, 1],
          transition: { duration: 0.5 }
        });
      }, 300);
    } else {
      setAnimatedProgress(progressPercentage);
    }
  }, [xp, level, progressPercentage, showAnimation, controls]);
  
  // Determine user rank based on level
  const getRank = () => {
    if (level < 3) return { name: "Rookie", color: "text-blue-500" };
    if (level < 6) return { name: "Thinker", color: "text-green-500" };
    if (level < 10) return { name: "Challenger", color: "text-yellow-500" };
    if (level < 15) return { name: "Genius", color: "text-orange-500" };
    return { name: "Master Mind", color: "text-purple-500" };
  };
  
  const rank = getRank();
  
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <motion.div 
          animate={controls}
          className="flex items-center"
        >
          <span className="text-sm font-medium mr-1">Level {level}</span>
          <span className={`text-xs font-semibold ${rank.color}`}>
            • {rank.name}
          </span>
          {level >= 10 && (
            <BadgeCheck className="h-4 w-4 ml-1 text-yellow-500" />
          )}
        </motion.div>
        <div className="text-xs text-gray-500">
          {currentLevelXP}/{xpNeededForNextLevel} XP
        </div>
      </div>
      
      <div className="relative">
        <Progress 
          value={animatedProgress} 
          className="h-2.5 bg-gray-100"
        />
        
        {/* XP Milestones */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
          {[25, 50, 75].map(milestone => (
            <div 
              key={milestone}
              className="absolute top-0 w-0.5 h-full bg-white opacity-70"
              style={{ left: `${milestone}%` }}
            />
          ))}
        </div>
        
        {/* Level up indicator if close to next level */}
        {progressPercentage > 90 && (
          <motion.div 
            className="absolute -right-1 -top-1"
            animate={{ scale: [0.9, 1.1, 0.9] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <Star className="h-4 w-4 text-yellow-400 fill-yellow-400" />
          </motion.div>
        )}
      </div>
      
      {/* Level up description */}
      <div className="mt-1 text-xs text-gray-500">
        {progressPercentage >= 90 ? (
          <span className="text-yellow-500 font-semibold animate-pulse">Almost to next level!</span>
        ) : (
          <span>Next rank at level {level < 3 ? 3 : level < 6 ? 6 : level < 10 ? 10 : level < 15 ? 15 : "∞"}</span>
        )}
      </div>
    </div>
  );
};

export default XPProgressBar;
