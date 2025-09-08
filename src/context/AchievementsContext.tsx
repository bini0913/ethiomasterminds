import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  unlockedAt?: Date;
  progress?: number;
  maxProgress?: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: 'quiz_streak' | 'multiplayer_wins' | 'perfect_score' | 'speed_demon' | 'social' | 'learning';
  condition: {
    target: number;
    current: number;
  };
  reward: {
    coins?: number;
    gems?: number;
    badge?: string;
  };
  completed: boolean;
  completedAt?: Date;
}

interface AchievementsContextType {
  badges: Badge[];
  achievements: Achievement[];
  unlockedBadges: Badge[];
  addBadge: (badge: Badge) => void;
  updateAchievementProgress: (achievementId: string, progress: number) => void;
  checkAchievements: (action: string, value?: number) => Achievement[];
  getRecentBadges: () => Badge[];
}

const initialBadges: Badge[] = [
  {
    id: 'first_quiz',
    name: 'Quiz Rookie',
    description: 'Complete your first quiz',
    icon: '🎯',
    rarity: 'common'
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Get 10 questions right in a row',
    icon: '🔥',
    rarity: 'rare'
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    description: 'Answer 5 questions in under 10 seconds each',
    icon: '⚡',
    rarity: 'epic'
  },
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    description: 'Complete a quiz every day for a week',
    icon: '👑',
    rarity: 'legendary'
  }
];

const initialAchievements: Achievement[] = [
  {
    id: 'quiz_beginner',
    name: 'Quiz Beginner',
    description: 'Complete 5 quizzes',
    type: 'quiz_streak',
    condition: { target: 5, current: 0 },
    reward: { coins: 50, badge: 'first_quiz' },
    completed: false
  },
  {
    id: 'multiplayer_novice',
    name: 'Multiplayer Novice',
    description: 'Win 3 multiplayer matches',
    type: 'multiplayer_wins',
    condition: { target: 3, current: 0 },
    reward: { coins: 100, gems: 5 },
    completed: false
  }
];

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const [badges, setBadges] = useState<Badge[]>(initialBadges);
  const [achievements, setAchievements] = useState<Achievement[]>(initialAchievements);
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);

  const addBadge = (badge: Badge) => {
    const newBadge = { ...badge, unlockedAt: new Date() };
    setUnlockedBadges(prev => [...prev, newBadge]);
  };

  const updateAchievementProgress = (achievementId: string, progress: number) => {
    setAchievements(prev => 
      prev.map(achievement => {
        if (achievement.id === achievementId && !achievement.completed) {
          const newProgress = Math.min(achievement.condition.current + progress, achievement.condition.target);
          const completed = newProgress >= achievement.condition.target;
          
          return {
            ...achievement,
            condition: { ...achievement.condition, current: newProgress },
            completed,
            completedAt: completed ? new Date() : undefined
          };
        }
        return achievement;
      })
    );
  };

  const checkAchievements = (action: string, value: number = 1): Achievement[] => {
    const completedAchievements: Achievement[] = [];
    
    setAchievements(prev => 
      prev.map(achievement => {
        if (!achievement.completed) {
          let shouldUpdate = false;
          
          switch (action) {
            case 'quiz_completed':
              shouldUpdate = achievement.type === 'quiz_streak';
              break;
            case 'multiplayer_win':
              shouldUpdate = achievement.type === 'multiplayer_wins';
              break;
            case 'perfect_score':
              shouldUpdate = achievement.type === 'perfect_score';
              break;
            case 'speed_answer':
              shouldUpdate = achievement.type === 'speed_demon';
              break;
          }
          
          if (shouldUpdate) {
            const newProgress = Math.min(achievement.condition.current + value, achievement.condition.target);
            const completed = newProgress >= achievement.condition.target;
            
            if (completed) {
              completedAchievements.push(achievement);
              if (achievement.reward.badge) {
                const badge = badges.find(b => b.id === achievement.reward.badge);
                if (badge) addBadge(badge);
              }
            }
            
            return {
              ...achievement,
              condition: { ...achievement.condition, current: newProgress },
              completed,
              completedAt: completed ? new Date() : undefined
            };
          }
        }
        return achievement;
      })
    );
    
    return completedAchievements;
  };

  const getRecentBadges = () => {
    return unlockedBadges
      .filter(badge => badge.unlockedAt && 
        (Date.now() - badge.unlockedAt.getTime()) < 24 * 60 * 60 * 1000) // Last 24 hours
      .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0));
  };

  return (
    <AchievementsContext.Provider value={{
      badges,
      achievements,
      unlockedBadges,
      addBadge,
      updateAchievementProgress,
      checkAchievements,
      getRecentBadges
    }}>
      {children}
    </AchievementsContext.Provider>
  );
};

export const useAchievements = () => {
  const context = useContext(AchievementsContext);
  if (!context) {
    throw new Error('useAchievements must be used within an AchievementsProvider');
  }
  return context;
};