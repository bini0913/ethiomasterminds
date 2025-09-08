import React, { createContext, useContext, useState, ReactNode } from 'react';

interface CurrencyContextType {
  coins: number;
  gems: number;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  addGems: (amount: number) => void;
  spendGems: (amount: number) => boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [coins, setCoins] = useState(100); // Starting coins
  const [gems, setGems] = useState(10); // Premium currency

  const addCoins = (amount: number) => {
    setCoins(prev => prev + amount);
  };

  const spendCoins = (amount: number): boolean => {
    if (coins >= amount) {
      setCoins(prev => prev - amount);
      return true;
    }
    return false;
  };

  const addGems = (amount: number) => {
    setGems(prev => prev + amount);
  };

  const spendGems = (amount: number): boolean => {
    if (gems >= amount) {
      setGems(prev => prev - amount);
      return true;
    }
    return false;
  };

  return (
    <CurrencyContext.Provider value={{
      coins,
      gems,
      addCoins,
      spendCoins,
      addGems,
      spendGems
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