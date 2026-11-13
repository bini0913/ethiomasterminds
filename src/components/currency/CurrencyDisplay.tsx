import React from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { Card } from '@/components/ui/card';
import { Coins, Gem } from 'lucide-react';

interface CurrencyDisplayProps {
  variant?: 'compact' | 'full';
  showBoth?: boolean;
}

const CurrencyDisplay: React.FC<CurrencyDisplayProps> = ({ variant = 'compact', showBoth = false }) => {
  const { coins, gems } = useCurrency();

  // If showBoth is true, force full variant
  const displayVariant = showBoth ? 'full' : variant;

  if (displayVariant === 'compact') {
    return (
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-1 px-2 py-1 bg-yellow-500/20 rounded-lg">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">{coins.toLocaleString()}</span>
        </div>
        
        <div className="flex items-center space-x-1 px-2 py-1 bg-primary/20 rounded-lg">
          <Gem className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{gems.toLocaleString()}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <Coins className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Coins</p>
            <p className="text-2xl font-bold text-yellow-600">{coins.toLocaleString()}</p>
          </div>
        </div>
      </Card>

      <Card className="p-4 bg-gradient-to-br from-primary/10 to-pink-500/10 border-primary/20">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Gem className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Gems</p>
            <p className="text-2xl font-bold text-primary">{gems.toLocaleString()}</p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default CurrencyDisplay;