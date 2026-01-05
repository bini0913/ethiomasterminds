import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from './UserContext';

interface CurrencyContextType {
  coins: number;
  gems: number;
  loading: boolean;
  addCoins: (amount: number) => Promise<boolean>;
  spendCoins: (amount: number) => Promise<boolean>;
  addGems: (amount: number) => Promise<boolean>;
  spendGems: (amount: number) => Promise<boolean>;
  refreshCurrency: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useUser();
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCurrency = useCallback(async () => {
    if (!user?.id) {
      setCoins(0);
      setGems(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_currency')
        .select('coins, gems')
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If no currency record exists, create one
        if (error.code === 'PGRST116') {
          const { data: newData, error: insertError } = await supabase
            .from('user_currency')
            .insert({ user_id: user.id, coins: 100, gems: 10 })
            .select('coins, gems')
            .single();
          
          if (!insertError && newData) {
            setCoins(newData.coins);
            setGems(newData.gems);
          }
        }
      } else if (data) {
        setCoins(data.coins);
        setGems(data.gems);
      }
    } catch (err) {
      console.error('Error fetching currency:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCurrency();
  }, [fetchCurrency]);

  const addCoins = async (amount: number): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const newAmount = coins + amount;
      const { error } = await supabase
        .from('user_currency')
        .update({ coins: newAmount, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setCoins(newAmount);
      return true;
    } catch (err) {
      console.error('Error adding coins:', err);
      return false;
    }
  };

  const spendCoins = async (amount: number): Promise<boolean> => {
    if (!user?.id || coins < amount) return false;
    
    try {
      const newAmount = coins - amount;
      const { error } = await supabase
        .from('user_currency')
        .update({ coins: newAmount, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setCoins(newAmount);
      return true;
    } catch (err) {
      console.error('Error spending coins:', err);
      return false;
    }
  };

  const addGems = async (amount: number): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const newAmount = gems + amount;
      const { error } = await supabase
        .from('user_currency')
        .update({ gems: newAmount, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setGems(newAmount);
      return true;
    } catch (err) {
      console.error('Error adding gems:', err);
      return false;
    }
  };

  const spendGems = async (amount: number): Promise<boolean> => {
    if (!user?.id || gems < amount) return false;
    
    try {
      const newAmount = gems - amount;
      const { error } = await supabase
        .from('user_currency')
        .update({ gems: newAmount, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setGems(newAmount);
      return true;
    } catch (err) {
      console.error('Error spending gems:', err);
      return false;
    }
  };

  const refreshCurrency = async () => {
    await fetchCurrency();
  };

  return (
    <CurrencyContext.Provider value={{
      coins,
      gems,
      loading,
      addCoins,
      spendCoins,
      addGems,
      spendGems,
      refreshCurrency
    }}>
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
