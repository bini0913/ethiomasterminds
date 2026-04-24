import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';

interface CurrencyContextType {
  xp: number;
  coins: number;
  gems: number;
  dailyStreak: number;
  loading: boolean;
  addCoins: (amount: number, source?: string) => Promise<boolean>;
  spendCoins: (amount: number, source?: string) => Promise<boolean>;
  addGems: (amount: number) => Promise<boolean>;
  spendGems: (amount: number) => Promise<boolean>;
  convertXpToCoins: (xpAmount: number) => Promise<boolean>;
  convertCoinsToGems: (coinAmount: number) => Promise<boolean>;
  convertCoinsToXp: (coinAmount: number) => Promise<boolean>;
  transferCoins: (receiverId: string, amount: number) => Promise<boolean>;
  claimDailyReward: () => Promise<boolean>;
  luckySpin: () => Promise<{ success: boolean; message?: string }>;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

const COIN_PER_XP = 100; // 1 coin per 100 XP
const COIN_PER_GEM = 50; // 50 coins -> 1 gem

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(100);
  const [gems, setGems] = useState(10);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCurrency = useCallback(async () => {
    if (!user?.id) {
      setXp(0);
      setCoins(0);
      setGems(0);
      setDailyStreak(0);
      setLoading(false);
      return;
    }

    try {
      // Ensure a wallet row exists
      let { data: wallet } = await supabase
        .from('user_currency')
        .select('coins,gems')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!wallet) {
        const { data: created } = await supabase
          .from('user_currency')
          .insert({ user_id: user.id })
          .select('coins,gems')
          .single();
        wallet = created ?? { coins: 100, gems: 10 };
      }

      const [{ data: profile }, { data: streak }] = await Promise.all([
        supabase.from('profiles').select('xp').eq('id', user.id).maybeSingle(),
        supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).maybeSingle(),
      ]);

      setCoins(wallet?.coins ?? 100);
      setGems(wallet?.gems ?? 10);
      setXp(profile?.xp ?? 0);
      setDailyStreak(streak?.current_streak ?? 0);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCurrency();
  }, [fetchCurrency]);

  // Realtime updates: profile (xp) and user_currency (coins/gems)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`wallet-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_currency', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;
          setCoins(next.coins ?? 0);
          setGems(next.gems ?? 0);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;
          setXp(next.xp ?? 0);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;
          setDailyStreak(next.current_streak ?? 0);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const updateWallet = async (patch: { coins?: number; gems?: number }) => {
    if (!user?.id) return null;
    const { data, error } = await supabase
      .from('user_currency')
      .update({ ...patch, updated_at: new Date().toISOString() } as never)
      .eq('user_id', user.id)
      .select('coins,gems')
      .single();
    if (error) throw error;
    return data;
  };

  const addCoins = async (amount: number): Promise<boolean> => {
    if (!user?.id || amount <= 0) return false;
    try {
      const data = await updateWallet({ coins: coins + amount });
      setCoins(data?.coins ?? coins + amount);
      return true;
    } catch (err) {
      console.error('Error adding coins:', err);
      return false;
    }
  };

  const spendCoins = async (amount: number): Promise<boolean> => {
    if (!user?.id || coins < amount || amount <= 0) return false;
    try {
      const data = await updateWallet({ coins: coins - amount });
      setCoins(data?.coins ?? coins - amount);
      return true;
    } catch (err) {
      console.error('Error spending coins:', err);
      return false;
    }
  };

  const addGems = async (amount: number): Promise<boolean> => {
    if (!user?.id || amount <= 0) return false;
    try {
      const data = await updateWallet({ gems: gems + amount });
      setGems(data?.gems ?? gems + amount);
      return true;
    } catch (err) {
      console.error('Error adding gems:', err);
      return false;
    }
  };

  const spendGems = async (amount: number): Promise<boolean> => {
    if (!user?.id || gems < amount || amount <= 0) return false;
    try {
      const data = await updateWallet({ gems: gems - amount });
      setGems(data?.gems ?? gems - amount);
      return true;
    } catch (err) {
      console.error('Error spending gems:', err);
      return false;
    }
  };

  // XP -> coins manual conversion (1 coin per 100 XP)
  const convertXpToCoins = async (xpAmount: number): Promise<boolean> => {
    if (!user?.id || xpAmount < COIN_PER_XP || xp < xpAmount) return false;
    try {
      const coinsToAdd = Math.floor(xpAmount / COIN_PER_XP);
      // Decrement XP via add_xp (negative)
      await (supabase as any).rpc('add_xp', { p_user_id: user.id, p_amount: -xpAmount });
      const data = await updateWallet({ coins: coins + coinsToAdd });
      setCoins(data?.coins ?? coins + coinsToAdd);
      setXp(Math.max(0, xp - xpAmount));
      return true;
    } catch (err) {
      console.error('Error converting XP to coins:', err);
      return false;
    }
  };

  const convertCoinsToGems = async (coinAmount: number): Promise<boolean> => {
    if (!user?.id || coinAmount < COIN_PER_GEM || coins < coinAmount) return false;
    try {
      const gemsToAdd = Math.floor(coinAmount / COIN_PER_GEM);
      const data = await updateWallet({ coins: coins - coinAmount, gems: gems + gemsToAdd });
      setCoins(data?.coins ?? coins - coinAmount);
      setGems(data?.gems ?? gems + gemsToAdd);
      return true;
    } catch (err) {
      console.error('Error converting coins to gems:', err);
      return false;
    }
  };

  const convertCoinsToXp = async (coinAmount: number): Promise<boolean> => {
    if (!user?.id || coinAmount <= 0 || coins < coinAmount) return false;
    try {
      const xpToAdd = coinAmount * COIN_PER_XP;
      const data = await updateWallet({ coins: coins - coinAmount });
      // Add XP without the auto-coin loop: add_xp will credit floor(xpToAdd/100) coins back automatically.
      // To avoid that, just update profile.xp directly.
      const { data: prof } = await supabase
        .from('profiles')
        .update({ xp: xp + xpToAdd } as never)
        .eq('id', user.id)
        .select('xp')
        .single();
      setCoins(data?.coins ?? coins - coinAmount);
      setXp(prof?.xp ?? xp + xpToAdd);
      return true;
    } catch (err) {
      console.error('Error converting coins to XP:', err);
      return false;
    }
  };

  const transferCoins = async (receiverId: string, amount: number): Promise<boolean> => {
    if (!user?.id || amount <= 0 || coins < amount || receiverId === user.id) return false;
    try {
      // Decrement sender
      const data = await updateWallet({ coins: coins - amount });
      // Increment receiver
      const { data: recv } = await supabase
        .from('user_currency')
        .select('coins')
        .eq('user_id', receiverId)
        .maybeSingle();
      if (recv) {
        await supabase
          .from('user_currency')
          .update({ coins: (recv.coins ?? 0) + amount } as never)
          .eq('user_id', receiverId);
      } else {
        await supabase.from('user_currency').insert({ user_id: receiverId, coins: 100 + amount } as never);
      }
      setCoins(data?.coins ?? coins - amount);
      return true;
    } catch (err) {
      console.error('Error transferring coins:', err);
      return false;
    }
  };

  const claimDailyReward = async (): Promise<boolean> => {
    if (!user?.id) return false;
    try {
      const reward = 25 + dailyStreak * 5;
      await (supabase as any).rpc('update_user_streak', { p_user_id: user.id });
      const data = await updateWallet({ coins: coins + reward });
      setCoins(data?.coins ?? coins + reward);
      return true;
    } catch (err) {
      console.error('Error claiming daily reward:', err);
      return false;
    }
  };

  const luckySpin = async (): Promise<{ success: boolean; message?: string }> => {
    if (!user?.id) return { success: false, message: 'Not authenticated' };
    if (coins < 10) return { success: false, message: 'Need at least 10 coins to spin' };
    try {
      const outcome = Math.random();
      let coinDelta = -10;
      if (outcome > 0.9) coinDelta = 200;
      else if (outcome > 0.6) coinDelta = 50;
      else if (outcome > 0.3) coinDelta = 10;
      const data = await updateWallet({ coins: Math.max(0, coins + coinDelta) });
      setCoins(data?.coins ?? coins + coinDelta);
      return { success: true, message: coinDelta > 0 ? `Won ${coinDelta} coins!` : 'Better luck next time' };
    } catch (err: any) {
      console.error('Lucky spin failed:', err);
      return { success: false, message: err?.message ?? 'Spin failed' };
    }
  };

  const refreshCurrency = async () => {
    await fetchCurrency();
  };

  return (
    <CurrencyContext.Provider
      value={{
        coins,
        xp,
        gems,
        dailyStreak,
        loading,
        addCoins,
        spendCoins,
        addGems,
        spendGems,
        convertXpToCoins,
        convertCoinsToGems,
        convertCoinsToXp,
        transferCoins,
        claimDailyReward,
        luckySpin,
        refreshCurrency,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
