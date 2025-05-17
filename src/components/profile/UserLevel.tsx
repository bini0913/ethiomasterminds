
import React from "react";
import XPProgressBar from "./XPProgressBar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

interface UserLevelProps {
  level: number;
  xp: number;
  className?: string;
  showBadge?: boolean;
}

const UserLevel: React.FC<UserLevelProps> = ({ 
  level, 
  xp, 
  className,
  showBadge = false
}) => {
  // Calculate rank based on level
  const getRank = () => {
    if (level < 3) return { name: "Rookie", color: "bg-blue-500 text-white" };
    if (level < 6) return { name: "Thinker", color: "bg-green-500 text-white" };
    if (level < 10) return { name: "Challenger", color: "bg-yellow-500 text-black" };
    if (level < 15) return { name: "Genius", color: "bg-orange-500 text-white" };
    return { name: "Master Mind", color: "bg-purple-500 text-white" };
  };
  
  const rank = getRank();
  
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 mb-1">
        {showBadge && (
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: [0.9, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity, repeatType: "reverse" }}
          >
            <Badge className={`${rank.color} font-semibold`}>
              {level >= 10 && <Star className="h-3 w-3 mr-1" />}
              {rank.name}
            </Badge>
          </motion.div>
        )}
      </div>
      <XPProgressBar level={level} xp={xp} />
    </div>
  );
};

export default UserLevel;
