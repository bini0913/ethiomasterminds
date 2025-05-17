
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { Award, Star } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface GainXPButtonProps {
  amount?: number;
  className?: string;
  variant?: "default" | "outline" | "primary" | "quiz";
  size?: "sm" | "md" | "lg";
  label?: string;
}

const GainXPButton: React.FC<GainXPButtonProps> = ({ 
  amount = 25, 
  className = "",
  variant = "outline",
  size = "sm",
  label,
}) => {
  const { addXP } = useUser();
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleClick = () => {
    setIsAnimating(true);
    addXP(amount);
    
    const message = amount >= 50 
      ? "Great work!" 
      : "Keep learning!";
    
    toast.success(`+${amount} XP gained!`, {
      description: message,
    });
    
    setTimeout(() => setIsAnimating(false), 700);
  };
  
  const getVariantClasses = () => {
    switch(variant) {
      case "primary":
        return "bg-primary text-white hover:bg-primary/90";
      case "quiz":
        return "bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:opacity-90";
      default:
        return "";
    }
  };
  
  const getSizeClasses = () => {
    switch(size) {
      case "md":
        return "px-4 py-2";
      case "lg":
        return "px-6 py-3 text-lg";
      default:
        return "";
    }
  };
  
  return (
    <motion.div
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      <Button 
        onClick={handleClick}
        variant={variant !== "quiz" ? variant : "default"}
        size={size}
        className={`flex items-center gap-2 ${getVariantClasses()} ${getSizeClasses()} ${className}`}
        disabled={isAnimating}
      >
        {isAnimating ? (
          <Star className="h-4 w-4 text-yellow-300 animate-spin" />
        ) : (
          <Award className="h-4 w-4" />
        )}
        <span>{label || `Gain ${amount} XP`}</span>
      </Button>
    </motion.div>
  );
};

export default GainXPButton;
