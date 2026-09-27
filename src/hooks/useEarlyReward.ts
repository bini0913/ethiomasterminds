import { useCallback } from "react";
import { useUser } from "@/context/UserContext";
import { useCurrency } from "@/context/CurrencyContext";

export const EARLY_REWARDS = {
  gameCorrect: { xp: 5, coins: 2 },
  quizCorrect: { xp: 8, coins: 3 },
  discoverCorrect: { xp: 5, coins: 2 },
} as const;

export function useEarlyReward() {
  const { user, addXP } = useUser();
  const { addCoins } = useCurrency();

  return useCallback(
    async (kind: keyof typeof EARLY_REWARDS) => {
      if (!user?.id) return false;
      const reward = EARLY_REWARDS[kind];
      try {
        await addXP(reward.xp);
        const coinsAwarded = await addCoins(reward.coins, `early-${kind}`);
        if (!coinsAwarded) return false;
        return true;
      } catch (error) {
        console.error("Early reward failed:", error);
        return false;
      }
    },
    [addCoins, addXP, user?.id],
  );
}
