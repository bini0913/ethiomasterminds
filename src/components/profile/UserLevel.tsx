
import React from "react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface UserLevelProps {
  level: number;
  xp: number;
  className?: string;
}

const UserLevel: React.FC<UserLevelProps> = ({ level, xp, className }) => {
  // Calculate XP needed for the next level
  const xpForCurrentLevel = (level - 1) * 100;
  const xpForNextLevel = level * 100;
  const currentLevelXP = xp - xpForCurrentLevel;
  const xpNeededForNextLevel = xpForNextLevel - xpForCurrentLevel;
  const progressPercentage = Math.min(100, (currentLevelXP / xpNeededForNextLevel) * 100);
  
  // Determine user rank based on level
  const userRank = () => {
    if (level < 3) return "Rookie";
    if (level < 5) return "Apprentice";
    if (level < 8) return "Explorer";
    if (level < 12) return "Scholar";
    if (level < 15) return "Expert";
    return "Master Mind";
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium">
          Level {level} <span className="text-gray-500">• {userRank()}</span>
        </div>
        <div className="text-xs text-gray-500">
          {currentLevelXP}/{xpNeededForNextLevel} XP
        </div>
      </div>
      <Progress value={progressPercentage} className="h-2 bg-gray-200" />
    </div>
  );
};

export default UserLevel;
