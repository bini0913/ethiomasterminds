import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Award, Star } from "lucide-react";
import { motion } from "framer-motion";

interface GainXPButtonProps {
  amount?: number;
  className?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  label?: string;
  onClick?: () => void | Promise<void>;
}

const GainXPButton: React.FC<GainXPButtonProps> = ({
  amount = 25,
  className = "",
  variant = "outline",
  size = "sm",
  label,
  onClick,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = async () => {
    if (isAnimating) return;
    setIsAnimating(true);

    try {
      // This component is a presentation/claim control. It must never award
      // XP directly. Rewards are granted by the authoritative activity RPC.
      await onClick?.();
    } finally {
      window.setTimeout(() => setIsAnimating(false), 700);
    }
  };

  return (
    <motion.div
      animate={isAnimating ? { scale: [1, 1.1, 1] } : {}}
      transition={{ duration: 0.5 }}
    >
      <Button
        onClick={() => void handleClick()}
        variant={variant}
        size={size}
        className={`flex items-center gap-2 ${className}`}
        disabled={isAnimating}
      >
        {isAnimating ? (
          <Star className="h-4 w-4 animate-spin" />
        ) : (
          <Award className="h-4 w-4" />
        )}
        <span>{label || `Claim ${amount} XP`}</span>
      </Button>
    </motion.div>
  );
};

export default GainXPButton;
