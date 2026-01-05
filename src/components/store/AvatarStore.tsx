import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gem, Lock, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StoreItem {
  id: string;
  name: string;
  category: 'clothing' | 'accessories' | 'backgrounds' | 'effects';
  price_coins: number;
  price_gems: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  preview: string;
  description: string;
  owned: boolean;
  equipped: boolean;
}

const AvatarStore: React.FC = () => {
  const { user } = useUser();
  const { coins, gems, spendCoins, spendGems, refreshCurrency } = useCurrency();
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    fetchStoreItems();
  }, [user?.id]);

  const fetchStoreItems = async () => {
    try {
      // Fetch all avatar items
      const { data: items, error: itemsError } = await supabase
        .from('avatar_items')
        .select('*');

      if (itemsError) throw itemsError;

      // Fetch user's inventory if logged in
      let ownedItemIds: string[] = [];
      let equippedItemIds: string[] = [];
      
      if (user?.id) {
        const { data: inventory } = await supabase
          .from('user_inventory')
          .select('item_id, equipped')
          .eq('user_id', user.id);

        ownedItemIds = (inventory || []).map(i => i.item_id);
        equippedItemIds = (inventory || []).filter(i => i.equipped).map(i => i.item_id);
      }

      const mappedItems: StoreItem[] = (items || []).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category as StoreItem['category'],
        price_coins: item.price_coins || 0,
        price_gems: item.price_gems || 0,
        rarity: item.rarity as StoreItem['rarity'],
        preview: item.preview,
        description: item.description || '',
        owned: ownedItemIds.includes(item.id),
        equipped: equippedItemIds.includes(item.id)
      }));

      setStoreItems(mappedItems);
    } catch (err) {
      console.error('Error fetching store items:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handlePurchase = async (item: StoreItem) => {
    if (!user?.id) {
      toast.error('Please log in to purchase items');
      return;
    }

    if (item.owned) {
      toast.info('You already own this item!');
      return;
    }

    setPurchasing(item.id);

    try {
      let canPurchase = false;
      
      if (item.price_gems > 0) {
        canPurchase = await spendGems(item.price_gems);
      } else if (item.price_coins > 0) {
        canPurchase = await spendCoins(item.price_coins);
      } else {
        // Free item
        canPurchase = true;
      }

      if (canPurchase) {
        // Add to inventory
        const { error } = await supabase
          .from('user_inventory')
          .insert({
            user_id: user.id,
            item_id: item.id,
            equipped: false
          });

        if (error) throw error;

        toast.success(`Purchased ${item.name}!`);
        await fetchStoreItems();
        await refreshCurrency();
      } else {
        toast.error('Insufficient funds!');
      }
    } catch (err) {
      console.error('Error purchasing item:', err);
      toast.error('Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };

  const handleEquip = async (item: StoreItem) => {
    if (!user?.id) return;

    try {
      // Unequip all items in the same category
      const { data: categoryInventory } = await supabase
        .from('user_inventory')
        .select('id, item_id')
        .eq('user_id', user.id);

      const sameCategoryItems = storeItems.filter(si => si.category === item.category);
      const sameCategoryInventory = (categoryInventory || []).filter(inv => 
        sameCategoryItems.some(sci => sci.id === inv.item_id)
      );

      for (const inv of sameCategoryInventory) {
        await supabase
          .from('user_inventory')
          .update({ equipped: false })
          .eq('id', inv.id);
      }

      // Equip this item
      await supabase
        .from('user_inventory')
        .update({ equipped: true })
        .eq('user_id', user.id)
        .eq('item_id', item.id);

      toast.success(`Equipped ${item.name}!`);
      await fetchStoreItems();
    } catch (err) {
      console.error('Error equipping item:', err);
      toast.error('Failed to equip item');
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
              {item.price_coins > 0 && (
                <div className="flex items-center space-x-1">
                  <Coins className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">{item.price_coins}</span>
                </div>
              )}
              {item.price_gems > 0 && (
                <div className="flex items-center space-x-1">
                  <Gem className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">{item.price_gems}</span>
                </div>
              )}
              {item.price_coins === 0 && item.price_gems === 0 && (
                <span className="text-sm text-green-500">Free</span>
              )}
            </div>
            
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => handlePurchase(item)}
              disabled={
                purchasing === item.id ||
                (item.price_coins > 0 && coins < item.price_coins) ||
                (item.price_gems > 0 && gems < item.price_gems)
              }
            >
              {purchasing === item.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (item.price_coins > 0 && coins < item.price_coins) ||
                 (item.price_gems > 0 && gems < item.price_gems) ? (
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
          <Button size="sm" variant="outline" className="w-full" onClick={() => handleEquip(item)}>
            Equip
          </Button>
        )}
      </div>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            {items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map(renderStoreItem)}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No items available in this category
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AvatarStore;
