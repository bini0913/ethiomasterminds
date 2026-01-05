import React from 'react';
import { Achievement, useAchievements } from '@/context/AchievementsContext';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Circle } from 'lucide-react';

const AchievementList: React.FC = () => {
  const { achievements } = useAchievements();

  const getAchievementIcon = (type: Achievement['type']) => {
    const icons = {
      quiz_streak: '🎯',
      multiplayer_wins: '⚔️',
      perfect_score: '🎖️',
      speed_demon: '⚡',
      social: '👥',
      learning: '📚'
    };
    return icons[type] || '🏆';
  };

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-bold">Achievements</h3>
      
      <div className="grid gap-3">
        {achievements.map(achievement => {
          const progress = (achievement.condition.current / achievement.condition.target) * 100;
          
          return (
            <Card key={achievement.id} className="p-4">
              <div className="flex items-start space-x-3">
                <div className="text-2xl">
                  {getAchievementIcon(achievement.type)}
                </div>
                
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{achievement.name}</h4>
                    {achievement.completed ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground">
                    {achievement.description}
                  </p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{achievement.condition.current}/{achievement.condition.target}</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      {achievement.type.replace('_', ' ').toUpperCase()}
                    </Badge>
                    
                    {achievement.reward.coins && (
                      <Badge variant="outline" className="text-xs">
                        🪙 {achievement.reward.coins}
                      </Badge>
                    )}
                    
                    {achievement.reward.xp && (
                      <Badge variant="outline" className="text-xs">
                        ⚡ {achievement.reward.xp} XP
                      </Badge>
                    )}
                  </div>
                  
                  {achievement.completed && achievement.completedAt && (
                    <p className="text-xs text-green-600">
                      Completed on {achievement.completedAt.toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementList;