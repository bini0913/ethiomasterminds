import React from 'react';
import { Badge } from '@/context/AchievementsContext';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BadgeDisplayProps {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

const BadgeDisplay: React.FC<BadgeDisplayProps> = ({ 
  badge, 
  size = 'md',
  showDetails = false 
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-12 h-12 text-sm',
    lg: 'w-16 h-16 text-base'
  };

  const rarityColors = {
    common: 'bg-gray-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500'
  };

  const rarityGlows = {
    common: 'shadow-gray-500/20',
    rare: 'shadow-blue-500/30',
    epic: 'shadow-purple-500/40',
    legendary: 'shadow-yellow-500/50'
  };

  return (
    <div className="flex flex-col items-center space-y-2">
      <div 
        className={cn(
          "rounded-full flex items-center justify-center",
          "border-2 border-white/20 backdrop-blur-sm",
          "transition-all duration-300 hover:scale-110",
          sizeClasses[size],
          rarityColors[badge.rarity],
          badge.unlockedAt ? rarityGlows[badge.rarity] : 'grayscale opacity-50'
        )}
      >
        <span className="text-white font-bold">
          {badge.icon}
        </span>
      </div>
      
      {showDetails && (
        <Card className="p-3 bg-background/80 backdrop-blur-sm">
          <h4 className="font-semibold text-sm">{badge.name}</h4>
          <p className="text-xs text-muted-foreground mt-1">{badge.description}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={cn(
              "px-2 py-1 rounded text-xs font-medium text-white",
              rarityColors[badge.rarity]
            )}>
              {badge.rarity}
            </span>
            {badge.unlockedAt && (
              <span className="text-xs text-muted-foreground">
                {badge.unlockedAt.toLocaleDateString()}
              </span>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default BadgeDisplay;