import React, { useMemo, useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Gem, Lock, Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';

interface StoreItem {
  id: string;
  name: string;
  section: 'avatars' | 'customization' | 'titles' | 'effects';
  price: number;
  currency: 'coins' | 'gems';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  preview: string;
  description: string;
  owned: boolean;
  equipped: boolean;
}

const sectionLabel: Record<StoreItem['section'], string> = {
  avatars: 'Avatars',
  customization: 'Customization',
  titles: 'Titles',
  effects: 'Effects',
};

const AvatarStore: React.FC = () => {
  const { user } = useUser();
  const { coins, gems, refreshCurrency } = useCurrency();
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [autoEquip, setAutoEquip] = useState(true);

  useEffect(() => {
    void fetchStoreItems();
  }, [user?.id]);

  const fetchStoreItems = async () => {
    setLoading(true);
    try {
      const { data: items, error: itemsError } = await (supabase as any)
        .from('store_items')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });

      if (itemsError) throw itemsError;

      let ownedItemIds = new Set<string>();
      let equippedItemIds = new Set<string>();

      if (user?.id) {
        const { data: inventory } = await (supabase as any)
          .from('user_items')
          .select('item_id, equipped')
          .eq('user_id', user.id);

        ownedItemIds = new Set((inventory || []).map((i: any) => i.item_id));
        equippedItemIds = new Set((inventory || []).filter((i: any) => i.equipped).map((i: any) => i.item_id));
      }

      const mappedItems: StoreItem[] = (items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        section: item.section,
        price: item.price || 0,
        currency: item.currency,
        rarity: item.rarity,
        preview: item.preview || '🛍️',
        description: item.description || '',
        owned: ownedItemIds.has(item.id),
        equipped: equippedItemIds.has(item.id),
      }));

      setStoreItems(mappedItems);
    } catch (err) {
      console.error('Error fetching store items:', err);
      toast.error('Unable to load store items');
    } finally {
      setLoading(false);
    }
  };

  const rarityColors = {
    common: 'bg-slate-500',
    rare: 'bg-blue-500',
    epic: 'bg-purple-500',
    legendary: 'bg-amber-500',
  };

  const categoryItems = useMemo(
    () => ({
      avatars: storeItems.filter((item) => item.section === 'avatars'),
      customization: storeItems.filter((item) => item.section === 'customization'),
      titles: storeItems.filter((item) => item.section === 'titles'),
      effects: storeItems.filter((item) => item.section === 'effects'),
    }),
    [storeItems],
  );

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
      const { error } = await (supabase as any).rpc('purchase_store_item', {
        p_item_id: item.id,
        p_auto_equip: autoEquip,
      });

      if (error) throw error;

      toast.success(`🎉 Item Unlocked! ${item.name} is now yours.`);
      if (autoEquip) {
        toast.success('Auto-equipped successfully.');
      }
      await Promise.all([fetchStoreItems(), refreshCurrency()]);
    } catch (err: any) {
      console.error('Error purchasing item:', err);
      toast.error(err?.message ?? 'Failed to purchase item');
    } finally {
      setPurchasing(null);
    }
  };

  const handleEquip = async (item: StoreItem) => {
    if (!user?.id) return;

    try {
      const { error } = await (supabase as any).rpc('equip_store_item', { p_item_id: item.id });
      if (error) throw error;

      toast.success(`Equipped ${item.name}!`);
      await fetchStoreItems();
    } catch (err) {
      console.error('Error equipping item:', err);
      toast.error('Failed to equip item');
    }
  };

  const renderStoreItem = (item: StoreItem) => {
    const hasEnough = item.currency === 'coins' ? coins >= item.price : gems >= item.price;

    return (
      <Card key={item.id} className="p-4 relative border-border/60">
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
            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
            <div className="mt-2 flex justify-center gap-2">
              <Badge variant="outline" className="text-[10px]">{sectionLabel[item.section]}</Badge>
              <Badge variant="secondary" className={`text-xs text-white ${rarityColors[item.rarity]}`}>
                {item.rarity}
              </Badge>
            </div>
          </div>

          {!item.owned && (
            <div className="space-y-2">
              <div className="flex items-center justify-center space-x-2">
                <div className="flex items-center space-x-1">
                  {item.currency === 'coins' ? (
                    <Coins className="w-4 h-4 text-yellow-500" />
                  ) : (
                    <Gem className="w-4 h-4 text-purple-500" />
                  )}
                  <span className="text-sm">{item.price}</span>
                </div>
              </div>

              <Button size="sm" className="w-full" onClick={() => handlePurchase(item)} disabled={purchasing === item.id || !hasEnough}>
                {purchasing === item.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !hasEnough ? (
                  <>
                    <Lock className="w-3 h-3 mr-1" />
                    Locked
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3 h-3 mr-1" />
                    Purchase
                  </>
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">Master Store</h2>
          <p className="text-muted-foreground">Unlock avatars, profile style, titles, and premium effects.</p>
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

      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 p-3">
        <Checkbox id="auto-equip" checked={autoEquip} onCheckedChange={(checked) => setAutoEquip(Boolean(checked))} />
        <label htmlFor="auto-equip" className="text-sm text-muted-foreground cursor-pointer">Auto-equip purchased items</label>
      </div>

      <Tabs defaultValue="avatars" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="avatars">👤 Avatars</TabsTrigger>
          <TabsTrigger value="customization">👕 Customization</TabsTrigger>
          <TabsTrigger value="titles">🏷️ Titles</TabsTrigger>
          <TabsTrigger value="effects">✨ Effects</TabsTrigger>
        </TabsList>

        {Object.entries(categoryItems).map(([section, items]) => (
          <TabsContent key={section} value={section}>
            {items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {items.map(renderStoreItem)}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">No items available in this section</div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default AvatarStore;
