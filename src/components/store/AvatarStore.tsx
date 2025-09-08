import React, { useState } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gem, Lock, Check } from 'lucide-react';
import { toast } from 'sonner';

interface StoreItem {
  id: string;
  name: string;
  category: 'clothing' | 'accessories' | 'backgrounds' | 'effects';
  price: { coins?: number; gems?: number };
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  preview: string;
  owned: boolean;
  equipped: boolean;
}

const AvatarStore: React.FC = () => {
  const { coins, gems, spendCoins, spendGems } = useCurrency();
  const [ownedItems, setOwnedItems] = useState<string[]>(['basic_outfit']);

  const storeItems: StoreItem[] = [
    // Clothing
    {
      id: 'basic_outfit',
      name: 'Basic Outfit',
      category: 'clothing' as const,
      price: {},
      rarity: 'common' as const,
      preview: '👕',
      owned: true,
      equipped: true
    },
    {
      id: 'smart_uniform',
      name: 'Smart Uniform',
      category: 'clothing' as const,
      price: { coins: 50 },
      rarity: 'common' as const,
      preview: '🎓',
      owned: false,
      equipped: false
    },
    {
      id: 'lab_coat',
      name: 'Lab Coat',
      category: 'clothing' as const,
      price: { coins: 150 },
      rarity: 'rare' as const,
      preview: '🥼',
      owned: false,
      equipped: false
    },
    {
      id: 'royal_robe',
      name: 'Royal Robe',
      category: 'clothing' as const,
      price: { gems: 25 },
      rarity: 'legendary' as const,
      preview: '👑',
      owned: false,
      equipped: false
    },
    
    // Accessories
    {
      id: 'glasses',
      name: 'Smart Glasses',
      category: 'accessories' as const,
      price: { coins: 75 },
      rarity: 'common' as const,
      preview: '👓',
      owned: false,
      equipped: false
    },
    {
      id: 'crown',
      name: 'Champion Crown',
      category: 'accessories' as const,
      price: { gems: 50 },
      rarity: 'legendary' as const,
      preview: '👑',
      owned: false,
      equipped: false
    },
    
    // Backgrounds
    {
      id: 'library',
      name: 'Grand Library',
      category: 'backgrounds' as const,
      price: { coins: 200 },
      rarity: 'rare' as const,
      preview: '📚',
      owned: false,
      equipped: false
    },
    {
      id: 'space',
      name: 'Space Station',
      category: 'backgrounds' as const,
      price: { gems: 30 },
      rarity: 'epic' as const,
      preview: '🚀',
      owned: false,
      equipped: false
    },
    
    // Effects
    {
      id: 'sparkles',
      name: 'Sparkle Effect',
      category: 'effects' as const,
      price: { gems: 15 },
      rarity: 'rare' as const,
      preview: '✨',
      owned: false,
      equipped: false
    },
    {
      id: 'glow',
      name: 'Master Glow',
      category: 'effects' as const,
      price: { gems: 40 },
      rarity: 'legendary' as const,
      preview: '🌟',
      owned: false,
      equipped: false
    }
  ].map(item => ({
    ...item,
    owned: ownedItems.includes(item.id) || item.owned,
    equipped: item.id === 'basic_outfit' // Default equipped item
  }));

  const rarityColors = {
    common: 'bg-gray-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-yellow-500'
  };

  const categoryItems = {
    clothing: storeItems.filter(item => item.category === 'clothing'),
    accessories: storeItems.filter(item => item.category === 'accessories'),
    backgrounds: storeItems.filter(item => item.category === 'backgrounds'),
    effects: storeItems.filter(item => item.category === 'effects')
  };

  const handlePurchase = (item: StoreItem) => {
    if (item.owned) {
      toast.info('You already own this item!');
      return;
    }

    let canPurchase = false;
    
    if (item.price.coins && item.price.gems) {
      // Both currencies required
      if (coins >= item.price.coins && gems >= item.price.gems) {
        spendCoins(item.price.coins);
        spendGems(item.price.gems);
        canPurchase = true;
      }
    } else if (item.price.coins) {
      canPurchase = spendCoins(item.price.coins);
    } else if (item.price.gems) {
      canPurchase = spendGems(item.price.gems);
    }

    if (canPurchase) {
      setOwnedItems(prev => [...prev, item.id]);
      toast.success(`Purchased ${item.name}!`);
    } else {
      toast.error('Insufficient funds!');
    }
  };

  const renderStoreItem = (item: StoreItem) => (
    <Card key={item.id} className="p-4 relative">
      {item.owned && !item.equipped && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-green-500" />
        </div>
      )}
      
      {item.equipped && (
        <div className="absolute top-2 right-2">
          <Badge variant="default" className="text-xs">Equipped</Badge>
        </div>
      )}

      <div className="text-center space-y-3">
        <div className="text-4xl">{item.preview}</div>
        
        <div>
          <h4 className="font-semibold">{item.name}</h4>
          <Badge 
            variant="secondary" 
            className={`text-xs text-white ${rarityColors[item.rarity]}`}
          >
            {item.rarity}
          </Badge>
        </div>

        {!item.owned && (
          <div className="space-y-2">
            <div className="flex items-center justify-center space-x-2">
              {item.price.coins && (
                <div className="flex items-center space-x-1">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">{item.price.coins}</span>
                </div>
              )}
              {item.price.gems && (
                <div className="flex items-center space-x-1">
                  <Gem className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">{item.price.gems}</span>
                </div>
              )}
            </div>
            
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => handlePurchase(item)}
              disabled={
                (item.price.coins && coins < item.price.coins) ||
                (item.price.gems && gems < item.price.gems)
              }
            >
              {(item.price.coins && coins < item.price.coins) ||
               (item.price.gems && gems < item.price.gems) ? (
                <>
                  <Lock className="w-3 h-3 mr-1" />
                  Locked
                </>
              ) : (
                'Purchase'
              )}
            </Button>
          </div>
        )}

        {item.owned && !item.equipped && (
          <Button size="sm" variant="outline" className="w-full">
            Equip
          </Button>
        )}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Avatar Store</h2>
          <p className="text-muted-foreground">Customize your avatar with amazing items</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-medium">{coins.toLocaleString()}</span>
          </div>
          <div className="flex items-center space-x-1">
            <Gem className="w-5 h-5 text-purple-500" />
            <span className="font-medium">{gems.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="clothing" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="clothing">Clothing</TabsTrigger>
          <TabsTrigger value="accessories">Accessories</TabsTrigger>
          <TabsTrigger value="backgrounds">Backgrounds</TabsTrigger>
          <TabsTrigger value="effects">Effects</TabsTrigger>
        </TabsList>

        {Object.entries(categoryItems).map(([category, items]) => (
          <TabsContent key={category} value={category}>
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {items.map(renderStoreItem)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AvatarStore;