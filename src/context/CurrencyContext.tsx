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
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

type WalletAction =
  | 'spend_coins'
  | 'spend_gems'
  | 'convert_xp_to_coins'
  | 'convert_coins_to_gems'
  | 'convert_coins_to_xp'
  | 'transfer_coins'
  | 'claim_daily_reward';

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
      const [{ data: wallet, error: walletError }, { data: profile, error: profileError }, { data: streak, error: streakError }] = await Promise.all([
        (supabase as any).rpc('initialize_user_currency'),
        supabase.from('profiles').select('xp').eq('id', user.id).maybeSingle(),
        supabase.from('user_streaks').select('current_streak').eq('user_id', user.id).maybeSingle(),
      ]);

      if (walletError) throw walletError;
      if (profileError) throw profileError;
      if (streakError) throw streakError;

      setCoins(Math.max(0, Number(wallet?.coins ?? 0)));
      setGems(Math.max(0, Number(wallet?.gems ?? 0)));
      setXp(Math.max(0, Number(profile?.xp ?? 0)));
      setDailyStreak(Math.max(0, Number(streak?.current_streak ?? 0)));
    } catch (err) {
      console.error('Error fetching wallet:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    void fetchCurrency();
  }, [fetchCurrency]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`wallet-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_currency', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        const next = payload?.new;
        if (!next) return;
        setCoins(Math.max(0, Number(next.coins ?? 0)));
        setGems(Math.max(0, Number(next.gems ?? 0)));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload: any) => {
        const next = payload?.new;
        if (next) setXp(Math.max(0, Number(next.xp ?? 0)));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_streaks', filter: `user_id=eq.${user.id}` }, (payload: any) => {
        const next = payload?.new;
        if (next) setDailyStreak(Math.max(0, Number(next.current_streak ?? 0)));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const runAction = useCallback(async (
    action: WalletAction,
    amount?: number,
    receiverId?: string,
  ): Promise<Record<string, unknown> | null> => {
    if (!user?.id) return null;
    try {
      const { data, error } = await (supabase as any).rpc('wallet_action', {
        p_action: action,
        p_amount: amount ?? null,
        p_receiver_id: receiverId ?? null,
      });
      if (error) throw error;
      if (data?.coins !== undefined) setCoins(Math.max(0, Number(data.coins)));
      if (data?.gems !== undefined) setGems(Math.max(0, Number(data.gems)));
      if (data?.streak !== undefined) setDailyStreak(Math.max(0, Number(data.streak)));
      await fetchCurrency();
      return data as Record<string, unknown>;
    } catch (err) {
      console.error(`Wallet action ${action} failed:`, err);
      return null;
    }
  }, [user?.id, fetchCurrency]);

  // Client code cannot mint currency. Rewards are issued only by verified server-side activity RPCs.
  const addCoins = async (_amount: number): Promise<boolean> => false;
  const addGems = async (_amount: number): Promise<boolean> => false;

  const spendCoins = async (amount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    return Boolean(await runAction('spend_coins', amount));
  };

  const spendGems = async (amount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    return Boolean(await runAction('spend_gems', amount));
  };

  const convertXpToCoins = async (xpAmount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(xpAmount) || xpAmount < 100 || xp < xpAmount) return false;
    return Boolean(await runAction('convert_xp_to_coins', xpAmount));
  };

  const convertCoinsToGems = async (coinAmount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(coinAmount) || coinAmount < 100 || coins < coinAmount) return false;
    return Boolean(await runAction('convert_coins_to_gems', coinAmount));
  };

  const convertCoinsToXp = async (coinAmount: number): Promise<boolean> => {
    if (!Number.isSafeInteger(coinAmount) || coinAmount < 10 || coins < coinAmount) return false;
    return Boolean(await runAction('convert_coins_to_xp', coinAmount));
  };

  const transferCoins = async (receiverId: string, amount: number): Promise<boolean> => {
    if (!receiverId || receiverId === user?.id || !Number.isSafeInteger(amount) || amount < 10 || coins < amount) return false;
    const result = await runAction('transfer_coins', amount, receiverId);
    return result?.success === true;
  };

  const claimDailyReward = async (): Promise<boolean> => {
    const result = await runAction('claim_daily_reward');
    return result?.success === true;
  };

  const refreshCurrency = async () => {
    await fetchCurrency();
  };

  return (
    <CurrencyContext.Provider value={{
      coins, xp, gems, dailyStreak, loading,
      addCoins, spendCoins, addGems, spendGems,
      convertXpToCoins, convertCoinsToGems, convertCoinsToXp,
      transferCoins, claimDailyReward, refreshCurrency,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};
