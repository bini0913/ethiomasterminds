
import React from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/context/UserContext";
import { Award } from "lucide-react";

interface GainXPButtonProps {
  amount?: number;
  className?: string;
}

const GainXPButton: React.FC<GainXPButtonProps> = ({ 
  amount = 25, 
  className = "" 
}) => {
  const { addXP } = useUser();
  
  const handleClick = () => {
    addXP(amount);
  };
  
  return (
    <Button 
      onClick={handleClick}
      variant="outline" 
      size="sm"
      className={`flex items-center gap-2 ${className}`}
    >
      <Award className="h-4 w-4" />
      <span>Gain {amount} XP</span>
    </Button>
  );
};

export default GainXPButton;
