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

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [xp, setXp] = useState(0);
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
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
      const { data: ensured, error: ensureError } = await (supabase as any).rpc('ensure_wallet', { p_user_id: user.id });
      if (ensureError) throw ensureError;

      const wallet = ensured;
      setXp(wallet?.xp ?? 0);
      setCoins(wallet?.coins ?? 0);
      setGems(wallet?.gems ?? 0);
      setDailyStreak(wallet?.daily_streak ?? 0);
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCurrency();
  }, [fetchCurrency]);


  useEffect(() => {
    if (!user?.id) return;

    const walletChannel = supabase
      .channel(`wallet-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'wallets', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;
          setCoins(next.coins ?? 0);
          setXp(next.xp ?? 0);
          setGems(next.gems ?? 0);
          setDailyStreak(next.daily_streak ?? 0);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(walletChannel);
    };
  }, [user?.id]);

  const addCoins = async (amount: number, source = 'manual_reward'): Promise<boolean> => {
    if (!user?.id || amount <= 0) return false;

    try {
      const { data, error } = await (supabase as any)
        .from('wallets')
        .update({ coins: coins + amount })
        .eq('user_id', user.id)
        .select('coins, gems, daily_streak')
        .single();

      if (error) throw error;

      await (supabase as any).from('transactions').insert({
        sender_id: null,
        receiver_id: user.id,
        amount,
        type: 'earn',
        source,
      });

      setCoins(data?.coins ?? coins + amount);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error adding coins:', err);
      return false;
    }
  };

  const spendCoins = async (amount: number, source = 'manual_spend'): Promise<boolean> => {
    if (!user?.id || coins < amount || amount <= 0) return false;

    try {
      const newAmount = coins - amount;
      const { data, error } = await (supabase as any)
        .from('wallets')
        .update({ coins: newAmount })
        .eq('user_id', user.id)
        .select('coins, gems, daily_streak')
        .single();

      if (error) throw error;

      await (supabase as any).from('transactions').insert({
        sender_id: user.id,
        receiver_id: null,
        amount,
        type: 'spend',
        source,
      });

      setCoins(data?.coins ?? newAmount);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error spending coins:', err);
      return false;
    }
  };

  const addGems = async (amount: number): Promise<boolean> => {
    if (!user?.id || amount <= 0) return false;

    try {
      const { data, error } = await (supabase as any)
        .from('wallets')
        .update({ gems: gems + amount })
        .eq('user_id', user.id)
        .select('coins, gems, daily_streak')
        .single();

      if (error) throw error;

      setCoins(data?.coins ?? coins);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems + amount);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error adding gems:', err);
      return false;
    }
  };

  const spendGems = async (amount: number): Promise<boolean> => {
    if (!user?.id || gems < amount || amount <= 0) return false;

    try {
      const { data, error } = await (supabase as any)
        .from('wallets')
        .update({ gems: gems - amount })
        .eq('user_id', user.id)
        .select('coins, gems, daily_streak')
        .single();

      if (error) throw error;

      setCoins(data?.coins ?? coins);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems - amount);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error spending gems:', err);
      return false;
    }
  };

  const convertXpToCoins = async (xpAmount: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await (supabase as any).rpc('convert_xp_to_coins', { p_xp: xpAmount });
      if (error) throw error;

      setXp(data?.xp ?? xp);
      setCoins(data?.coins ?? coins);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error converting XP:', err);
      return false;
    }
  };

  const convertCoinsToGems = async (coinAmount: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await (supabase as any).rpc('convert_coins_to_gems', { p_coins: coinAmount });
      if (error) throw error;

      setXp(data?.xp ?? xp);
      setCoins(data?.coins ?? coins);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error converting coins to gems:', err);
      return false;
    }
  };


  const convertCoinsToXp = async (coinAmount: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await (supabase as any).rpc('convert_coins_to_xp', { p_coins: coinAmount });
      if (error) throw error;

      setXp(data?.xp ?? xp);
      setCoins(data?.coins ?? coins);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error converting coins to XP:', err);
      return false;
    }
  };

  const transferCoins = async (receiverId: string, amount: number): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await (supabase as any).rpc('transfer_coins', {
        p_receiver_id: receiverId,
        p_amount: amount,
      });

      if (error) throw error;

      setCoins(data?.coins ?? coins);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error transferring coins:', err);
      return false;
    }
  };

  const claimDailyReward = async (): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      const { data, error } = await (supabase as any).rpc('claim_daily_reward');
      if (error) throw error;

      setCoins(data?.coins ?? coins);
      setXp(data?.xp ?? xp);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return true;
    } catch (err) {
      console.error('Error claiming daily reward:', err);
      return false;
    }
  };

  const luckySpin = async (): Promise<{ success: boolean; message?: string }> => {
    if (!user?.id) return { success: false, message: 'Not authenticated' };

    try {
      const { data, error } = await (supabase as any).rpc('perform_lucky_spin');
      if (error) throw error;

      setXp(data?.xp ?? xp);
      setCoins(data?.coins ?? coins);
      setGems(data?.gems ?? gems);
      setDailyStreak(data?.daily_streak ?? dailyStreak);
      return { success: true };
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
