import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const EARLY_REWARDS = {
  gameCorrect: { xp: 5, coins: 2 },
  quizCorrect: { xp: 8, coins: 3 },
  discoverCorrect: { xp: 5, coins: 2 },
} as const;

type RewardKind = keyof typeof EARLY_REWARDS;

type EarlyRewardOptions = {
  activityId: string;
  skill: string;
  completed?: boolean;
  xpOverride?: number;
  coinsOverride?: number;
};

export function useEarlyReward() {
  return useCallback(async (kind: RewardKind, options?: EarlyRewardOptions) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user?.id) return false;

    const reward = EARLY_REWARDS[kind];
    const xp = options?.xpOverride ?? reward.xp;
    const coins = options?.coinsOverride ?? reward.coins;
    const activityId = options?.activityId ?? `early-${kind}`;
    const skill = options?.skill ?? "general";
    const attemptId = crypto.randomUUID();

    try {
      const { error } = await (supabase as any).rpc("complete_early_activity", {
        p_attempt_id: attemptId,
        p_activity_id: activityId,
        p_skill: skill,
        p_correct: true,
        p_xp: xp,
        p_coins: coins,
        p_completed: options?.completed ?? false,
      });

      if (error) {
        console.error("Early reward failed:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Early reward failed:", error);
      return false;
    }
  }, []);
}
