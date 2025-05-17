
import React from "react";
import XPProgressBar from "./XPProgressBar";
import { cn } from "@/lib/utils";

interface UserLevelProps {
  level: number;
  xp: number;
  className?: string;
}

const UserLevel: React.FC<UserLevelProps> = ({ level, xp, className }) => {
  return (
    <div className={cn("w-full", className)}>
      <XPProgressBar level={level} xp={xp} />
    </div>
  );
};

export default UserLevel;
