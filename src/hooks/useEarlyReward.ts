import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export const EARLY_REWARDS = {
  gameCorrect: { xp: 5, coins: 2 },
  quizAnswer: { xp: 8, coins: 3 },
  discoverCorrect: { xp: 5, coins: 2 },
} as const;

type RewardKind = keyof typeof EARLY_REWARDS;

type EarlyRewardOptions = {
  activityId?: string;
  skill?: string;
  completed?: boolean;
  attemptId?: string;
  questionId?: string;
  answer?: string;
};

export function useEarlyReward() {
  return useCallback(async (kind: RewardKind, options?: EarlyRewardOptions) => {
    try {
      // Only the fixed quiz bank currently has a server-owned answer key.
      // Client-generated game rounds and generated math prompts cannot mint rewards.
      if (kind !== "quizAnswer" || !options?.questionId || options.answer === undefined) {
        return false;
      }
      if (options.questionId.startsWith("math-")) return false;

      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user?.id) return false;

      const attemptId = options.attemptId ?? (
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
              const random = Math.floor(Math.random() * 16);
              const value = character === "x" ? random : (random & 0x3) | 0x8;
              return value.toString(16);
            })
      );

      const { data, error } = await (supabase as any).rpc("submit_early_quiz_answer", {
        p_attempt_id: attemptId,
        p_question_id: options.questionId,
        p_answer: options.answer,
      });

      if (error) {
        console.error("Verified early quiz submission failed:", error);
        return false;
      }

      return data?.processed === true || data?.duplicate === true;
    } catch (error) {
      console.error("Verified early quiz submission failed:", error);
      return false;
    }
  }, []);
}
