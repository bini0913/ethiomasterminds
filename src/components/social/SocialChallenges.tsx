import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import { Target, Flame, Trophy, Zap, CheckCircle2, Swords, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Mission {
  id: string;
  title: string;
  description: string;
  icon: string;
  targetValue: number;
  rewardXp: number;
  rewardCoins: number;
  progress: number;
  completed: boolean;
}

const iconMap: Record<string, React.ReactNode> = {
  '🎯': <Target className="h-5 w-5" />,
  '🔥': <Flame className="h-5 w-5" />,
  '🏆': <Trophy className="h-5 w-5" />,
  '⚡': <Zap className="h-5 w-5" />,
};

const SocialChallenges: React.FC = () => {
  const { user } = useUser();
  const navigate = useNavigate();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadMissions = useCallback(async () => {
    setLoadError(false);
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_missions')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setMissions((data || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description,
        icon: m.icon || '🎯',
        targetValue: m.target_value,
        rewardXp: m.reward_xp || 0,
        rewardCoins: m.reward_coins || 0,
        progress: 0, // Would come from user_mission_progress table
        completed: false,
      })));
    } catch (err) {
      console.error('Error loading missions:', err);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadMissions(); }, [loadMissions]);

  if (isLoading) {
    return (
      <div className="px-4 py-6 space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="text-sm font-semibold">Daily challenges are unavailable right now.</p>
        <p className="mt-1 text-xs text-muted-foreground">We could not verify the live challenge list.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => void loadMissions()}><RefreshCw className="mr-2 h-4 w-4" /> Try again</Button>
      </div>
    );
  }

  if (missions.length === 0) {
    return (
      <div className="px-4 py-16 text-center">
        <Target className="mx-auto h-9 w-9 text-muted-foreground/60" />
        <p className="mt-3 text-sm font-semibold">No active challenges yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">Check back when a new community challenge is published.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="text-center space-y-1">
        <h2 className="text-lg font-bold text-foreground flex items-center justify-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Daily Challenges
        </h2>
        <p className="text-xs text-muted-foreground">Complete challenges to earn XP and coins</p>
      </div>

      {/* Challenge Cards */}
      <div className="space-y-3">
        {missions.map((mission) => {
          const progressPercent = Math.min(100, (mission.progress / mission.targetValue) * 100);
          return (
            <div
              key={mission.id}
              className={`rounded-xl border px-4 py-3.5 transition-all ${
                mission.completed
                  ? 'border-emerald-500/30 bg-emerald-500/5'
                  : 'border-border/50 bg-card/50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg ${
                  mission.completed ? 'bg-emerald-500/20' : 'bg-muted/60'
                }`}>
                  {mission.completed ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : (iconMap[mission.icon] || mission.icon)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{mission.title}</span>
                    {mission.completed && (
                      <Badge variant="secondary" className="text-[10px] h-4 bg-emerald-500/20 text-emerald-400">Done</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{mission.description}</p>

                  {/* Progress bar */}
                  {!mission.completed && (
                    <div className="mt-1.5 h-1.5 w-full bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-primary">+{mission.rewardXp} XP</p>
                  <p className="text-[10px] text-amber-400">+{mission.rewardCoins} 🪙</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Challenge a Friend */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center space-y-3">
        <div className="flex items-center justify-center gap-2">
          <Swords className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Challenge a Friend</h3>
        </div>
        <p className="text-xs text-muted-foreground">Start a multiplayer quiz battle and earn bonus XP!</p>
        <Button onClick={() => navigate('/multiplayer')} className="rounded-full px-6">
          <Swords className="h-4 w-4 mr-2" />
          Start Challenge
        </Button>
      </div>
    </div>
  );
};

export default SocialChallenges;
