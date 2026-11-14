import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';
import { toast } from 'sonner';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  category: string;
  requirement_type: string;
  requirement_value: number;
  reward_xp: number;
  reward_coins: number;
  unlockedAt?: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  type: string;
  condition: {
    target: number;
    current: number;
  };
  reward: {
    coins?: number;
    xp?: number;
  };
  completed: boolean;
  completedAt?: Date;
}

interface AchievementsContextType {
  badges: Badge[];
  achievements: Achievement[];
  unlockedBadges: Badge[];
  loading: boolean;
  addBadge: (badge: Badge) => void;
  updateAchievementProgress: (requirementType: string, increment?: number) => Promise<void>;
  checkAchievements: (action: string, value?: number) => Achievement[];
  getRecentBadges: () => Badge[];
  refreshAchievements: () => Promise<void>;
}

const AchievementsContext = createContext<AchievementsContextType | undefined>(undefined);

export const AchievementsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlockedBadges, setUnlockedBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAchievements = useCallback(async () => {
    try {
      // Fetch all available achievements from database
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*');

      if (achievementsError) throw achievementsError;
      
      const mappedBadges: Badge[] = (achievementsData || []).map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        rarity: a.rarity as Badge['rarity'],
        category: a.category,
        requirement_type: a.requirement_type,
        requirement_value: a.requirement_value,
        reward_xp: a.reward_xp || 0,
        reward_coins: a.reward_coins || 0
      }));
      
      setBadges(mappedBadges);

      // If user is logged in, fetch their progress
      if (user?.id) {
        const { data: userAchievementsData, error: userError } = await supabase
          .from('user_achievements')
          .select('*')
          .eq('user_id', user.id);

        if (userError) throw userError;

        // Map user achievements
        const mappedAchievements: Achievement[] = mappedBadges.map(badge => {
          const userProgress = userAchievementsData?.find(ua => ua.achievement_id === badge.id);
          return {
            id: badge.id,
            name: badge.name,
            description: badge.description,
            type: badge.requirement_type,
            condition: {
              target: badge.requirement_value,
              current: userProgress?.progress || 0
            },
            reward: {
              coins: badge.reward_coins,
              xp: badge.reward_xp
            },
            completed: userProgress?.completed || false,
            completedAt: userProgress?.unlocked_at ? new Date(userProgress.unlocked_at) : undefined
          };
        });

        setAchievements(mappedAchievements);

        // Set unlocked badges
        const unlocked = mappedBadges.filter(badge => {
          const userProgress = userAchievementsData?.find(ua => ua.achievement_id === badge.id);
          return userProgress?.completed;
        }).map(badge => {
          const userProgress = userAchievementsData?.find(ua => ua.achievement_id === badge.id);
          return {
            ...badge,
            unlockedAt: userProgress?.unlocked_at ? new Date(userProgress.unlocked_at) : undefined
          };
        });

        setUnlockedBadges(unlocked);
      }
    } catch (err) {
      console.error('Error fetching achievements:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  const addBadge = (badge: Badge) => {
    const newBadge = { ...badge, unlockedAt: new Date() };
    setUnlockedBadges(prev => [...prev, newBadge]);
  };

  const updateAchievementProgress = async (requirementType: string, _increment: number = 1) => {
    if (!user?.id) return;

    const supportedTypes = new Set(['quizzes_completed', 'perfect_scores', 'friends_added']);
    if (!supportedTypes.has(requirementType)) {
      console.warn('Achievement progress is not supported without a trusted server activity source:', requirementType);
      return;
    }

    try {
      const { error } = await (supabase as any).rpc('sync_student_achievement_progress', {
        p_requirement_type: requirementType,
      });
      if (error) throw error;

      await fetchAchievements();
    } catch (err) {
      console.error('Error syncing achievement progress:', err);
    }
  };

  const checkAchievements = (action: string, value: number = 1): Achievement[] => {
    // Map action to requirement_type
    const typeMap: Record<string, string> = {
      'quiz_completed': 'quizzes_completed',
      'multiplayer_win': 'multiplayer_wins',
      'perfect_score': 'perfect_scores',
      'friend_added': 'friends_added'
    };

    const requirementType = typeMap[action];
    if (requirementType) {
      updateAchievementProgress(requirementType, value);
    }

    return [];
  };

  const getRecentBadges = () => {
    return unlockedBadges
      .filter(badge => badge.unlockedAt && 
        (Date.now() - badge.unlockedAt.getTime()) < 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .sort((a, b) => (b.unlockedAt?.getTime() || 0) - (a.unlockedAt?.getTime() || 0));
  };

  const refreshAchievements = async () => {
    await fetchAchievements();
  };

  return (
    <AchievementsContext.Provider value={{
      badges,
      achievements,
      unlockedBadges,
      loading,
      addBadge,
      updateAchievementProgress,
      checkAchievements,
      getRecentBadges,
      refreshAchievements
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
