
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award, Star } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

interface GainXPButtonProps {
  amount?: number;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  onClick?: () => void; // Added onClick handler support
}

const GainXPButton: React.FC<GainXPButtonProps> = ({ 
  amount = 25, 
  className = "",
  variant = "outline",
  size = "sm",
  label,
  onClick, // Added onClick handler
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  
  const handleClick = () => {
    if (!onClick) {
      toast.info("XP is awarded automatically when you complete a verified activity.");
      return;
    }

    setIsAnimating(true);
    onClick();
    setTimeout(() => setIsAnimating(false), 700);
  };
  
  const getVariantClasses = () => {
    // Using custom classes for the quiz style that's not in the button variants
    if (variant === "secondary") {
      return "bg-secondary text-secondary-foreground hover:bg-secondary/80";
    }
    return "";
  };
  
  const getSizeClasses = () => {
    switch(size) {
      case "default":
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
        variant={variant}
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
