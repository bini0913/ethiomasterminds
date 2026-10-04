import React, { useMemo, useState, useEffect } from 'react';
import { useCurrency } from '@/context/CurrencyContext';
import { useUser } from '@/context/UserContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Coins, Gem, Lock, Check, Loader2, Sparkles, TimerReset, Wallet, Crown, Flame, Zap, Eye, RotateCcw, ZoomIn, Gift } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface StoreItem {
  id: string;
  name: string;
  section: 'featured' | 'avatars' | 'clothes' | 'cars' | 'houses' | 'titles' | 'customization' | 'effects';
  price: number;
  currency: 'coins' | 'gems';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  preview: string;
  description: string;
  owned: boolean;
  equipped: boolean;
}

interface AvatarStoreProps {
  onQuickNavigate?: (tab: 'exchange' | 'wallet') => void;
}

const sectionLabel: Record<StoreItem['section'], string> = {
  featured: 'Featured',
  avatars: 'Avatars',
  clothes: 'Clothes',
  cars: 'Cars',
  houses: 'Houses',
  titles: 'Titles',
  customization: 'Customization',
  effects: 'Premium',
};

const rarityStyle: Record<StoreItem['rarity'], { border: string; glow: string; chip: string; text: string }> = {
  common: {
    border: 'border-slate-500/50',
    glow: 'hover:shadow-[0_0_30px_rgba(148,163,184,0.35)]',
    chip: 'bg-slate-500/20 border-slate-400/40 text-slate-100',
    text: 'Common',
  },
  rare: {
    border: 'border-blue-500/60',
    glow: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.45)]',
    chip: 'bg-blue-500/20 border-blue-400/40 text-blue-100',
    text: 'Rare',
  },
  epic: {
    border: 'border-purple-500/60',
    glow: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.45)]',
    chip: 'bg-purple-500/20 border-purple-400/40 text-purple-100',
    text: 'Epic',
  },
  legendary: {
    border: 'border-amber-500/60',
    glow: 'hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]',
    chip: 'bg-amber-500/20 border-amber-400/40 text-amber-100',
    text: 'Legendary',
  },
};

const getDailyReset = () => {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next;
};

const AvatarStore: React.FC<AvatarStoreProps> = ({ onQuickNavigate }) => {
  const { user } = useUser();
  const { coins, gems, refreshCurrency } = useCurrency();
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [autoEquip, setAutoEquip] = useState(true);
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [resetIn, setResetIn] = useState('24:00:00');
  const [unlockedItem, setUnlockedItem] = useState<StoreItem | null>(null);

  useEffect(() => {
    void fetchStoreItems();
  }, [user?.id]);


  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`store-live-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_inventory', filter: `user_id=eq.${user.id}` }, () => {
        void fetchStoreItems();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'avatar_items' }, () => {
        void fetchStoreItems();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const reset = getDailyReset().getTime();
      const diff = Math.max(0, reset - now);
      const hours = Math.floor(diff / 1000 / 60 / 60);
      const minutes = Math.floor((diff / 1000 / 60) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      setResetIn(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const fetchStoreItems = async () => {
    setLoading(true);
    try {
      const { data: items, error: itemsError } = await (supabase as any)
        .from('avatar_items')
        .select('*')
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      let ownedItemIds = new Set<string>();
      let equippedItemIds = new Set<string>();

      if (user?.id) {
        const { data: inventory } = await (supabase as any)
          .from('user_inventory')
          .select('item_id, equipped')
          .eq('user_id', user.id);

        ownedItemIds = new Set((inventory || []).map((i: any) => i.item_id));
        equippedItemIds = new Set((inventory || []).filter((i: any) => i.equipped).map((i: any) => i.item_id));
      }

      const mappedItems: StoreItem[] = (items || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        section:
          item.category === 'clothing' ? 'clothes' :
          item.category === 'backgrounds' ? 'houses' :
          item.category === 'accessories' ? 'avatars' :
          'effects',
        price: item.price_gems > 0 ? item.price_gems : item.price_coins || 0,
        currency: item.price_gems > 0 ? 'gems' : 'coins',
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

  const todaySeed = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pickRotatingItems = (items: StoreItem[], size: number) => {
    if (!items.length) return [];
    const seed = todaySeed.split('-').join('').split('').reduce((acc, n) => acc + Number(n), 0);
    return [...items]
      .sort((a, b) => (a.id + seed).localeCompare(b.id + seed))
      .slice(0, Math.min(size, items.length));
  };

  const categoryItems = useMemo(() => {
    const avatars = storeItems.filter((item) => item.section === 'avatars');
    const clothes = storeItems.filter((item) => item.section === 'clothes' || item.section === 'customization');
    const cars = storeItems.filter((item) => item.section === 'cars');
    const houses = storeItems.filter((item) => item.section === 'houses');
    const titles = storeItems.filter((item) => item.section === 'titles');
    const premium = storeItems.filter((item) => item.section === 'effects' || item.rarity === 'legendary' || item.currency === 'gems');
    const featured = pickRotatingItems(
      storeItems.filter((item) => item.section === 'featured' || item.rarity !== 'common'),
      6
    );
    const daily = pickRotatingItems(storeItems, 8);
    const bundles = pickRotatingItems([...clothes, ...titles], 3);
    const featuredDrop = featured.find((i) => i.rarity === 'legendary') || featured[0] || null;

    return { featured, daily, premium, avatars, clothes, cars, houses, titles, bundles, featuredDrop };
  }, [storeItems]);

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

      toast.success('Item Unlocked 🎉');
      await Promise.all([fetchStoreItems(), refreshCurrency()]);
      setUnlockedItem(item);
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

  const openPreview = (item: StoreItem) => {
    setPreviewRotation(0);
    setPreviewZoom(1);
    setSelectedItem(item);
  };

  const renderStoreItem = (item: StoreItem, limited = false, exclusive = false) => {
    const hasEnough = item.currency === 'coins' ? coins >= item.price : gems >= item.price;
    const style = rarityStyle[item.rarity];

    return (
      <Card
        key={item.id}
        className={`relative min-w-[220px] max-w-[220px] rounded-2xl border bg-zinc-950/80 p-4 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] ${style.border} ${style.glow}`}
      >
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
        {limited && <Badge className="absolute left-2 top-2 border-none bg-red-500/90 text-white">Limited Today</Badge>}
        {exclusive && <Badge className="absolute right-2 top-2 border-none bg-fuchsia-500/90 text-white">Top Players</Badge>}

        {item.owned && !item.equipped && (
          <div className="absolute bottom-2 right-2">
            <Check className="h-4 w-4 text-green-400" />
          </div>
        )}

        {item.equipped && (
          <Badge variant="default" className="absolute bottom-2 right-2 bg-green-600 text-white">
            Equipped
          </Badge>
        )}

        <div className="relative z-10 mt-6 space-y-3 text-center">
          <div className="text-6xl leading-none transition-transform duration-300 group-hover:scale-105">{item.preview}</div>
          <div>
            <h4 className="font-semibold text-white">{item.name}</h4>
            <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{item.description}</p>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-sm font-semibold text-white">
            {item.currency === 'coins' ? <Coins className="h-4 w-4 text-yellow-400" /> : <Gem className="h-4 w-4 text-purple-400" />}
            {item.price.toLocaleString()}
          </div>

          <div className="flex flex-wrap justify-center gap-1.5">
            <Badge variant="outline" className={`border ${style.chip}`}>
              {style.text}
            </Badge>
            <Badge variant="outline" className="border-zinc-700 bg-zinc-800/50 text-zinc-300">
              {sectionLabel[item.section]}
            </Badge>
          </div>

          {!item.owned ? (
            <div className="space-y-2">
              <Button size="sm" className="w-full bg-white text-black hover:bg-zinc-200" onClick={() => openPreview(item)}>
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                Preview
              </Button>
              <Button size="sm" className="w-full" onClick={() => handlePurchase(item)} disabled={purchasing === item.id || !hasEnough}>
                {purchasing === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : !hasEnough ? (
                  <>
                    <Lock className="mr-1 h-3.5 w-3.5" />
                    Locked
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    Buy
                  </>
                )}
              </Button>
            </div>
          ) : !item.equipped ? (
            <Button size="sm" variant="outline" className="w-full border-zinc-600 bg-zinc-900 text-zinc-100" onClick={() => handleEquip(item)}>
              Equip
            </Button>
          ) : null}
        </div>
      </Card>
    );
  };

  const renderSection = (title: string, icon: React.ReactNode, items: StoreItem[], meta?: React.ReactNode, limited = false, exclusive = false) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
          {icon}
          {title}
        </h3>
        {meta}
      </div>
      {items.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]">
          {items.map((item) => renderStoreItem(item, limited, exclusive))}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">No items available.</div>
      )}
    </section>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/50 p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950/95 via-zinc-950/80 to-black/95 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Master Minds Item Shop</h2>
          <p className="text-sm text-zinc-400">Explore, collect, and flex your identity. New drops rotate every day.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-100">
            <Coins className="mr-1 h-4 w-4 text-yellow-400" /> {coins.toLocaleString()}
          </Badge>
          <Badge className="border border-zinc-700 bg-zinc-900 px-3 py-1 text-zinc-100">
            <Gem className="mr-1 h-4 w-4 text-purple-400" /> {gems.toLocaleString()}
          </Badge>
          <Button size="sm" variant="secondary" onClick={() => onQuickNavigate?.('exchange')}>
            + Get Coins
          </Button>
          <Button size="sm" variant="outline" onClick={() => onQuickNavigate?.('wallet')}>
            <Wallet className="mr-1 h-4 w-4" /> Wallet
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-4">
          <p className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400"><TimerReset className="h-3.5 w-3.5" /> Daily Rotation</p>
          <p className="text-xl font-bold text-white">Resets in: {resetIn}</p>
        </div>

        <div className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-orange-500/20 p-4">
          <p className="text-xs uppercase tracking-wider text-amber-100">🎰 Featured Drop</p>
          <p className="truncate text-lg font-bold text-white">{categoryItems.featuredDrop?.name ?? 'No drop selected'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900/40 p-3">
        <Checkbox id="auto-equip" checked={autoEquip} onCheckedChange={(checked) => setAutoEquip(Boolean(checked))} />
        <label htmlFor="auto-equip" className="cursor-pointer text-sm text-zinc-300">Equip instantly after purchase</label>
      </div>

      {renderSection('🔥 Featured', <Flame className="h-4 w-4 text-orange-400" />, categoryItems.featured)}
      {renderSection('🛍️ Daily Items', <TimerReset className="h-4 w-4 text-cyan-400" />, categoryItems.daily, <Badge className="bg-red-500/80">Today Only</Badge>, true)}
      {renderSection('💎 Premium', <Crown className="h-4 w-4 text-amber-400" />, categoryItems.premium)}
      {renderSection('👤 Avatars', <Sparkles className="h-4 w-4 text-sky-300" />, categoryItems.avatars)}
      {renderSection('👕 Clothes', <Zap className="h-4 w-4 text-pink-400" />, categoryItems.clothes)}
      {renderSection('🚗 Cars', <Zap className="h-4 w-4 text-cyan-300" />, categoryItems.cars)}
      {renderSection('🏠 Houses', <Crown className="h-4 w-4 text-emerald-300" />, categoryItems.houses)}
      {renderSection('🏷️ Titles', <Badge className="h-4 w-4 rounded-full p-0" />, categoryItems.titles, <Badge className="bg-fuchsia-500/80">Exclusive</Badge>, false, true)}
      {renderSection('🎁 Bundles', <Gift className="h-4 w-4 text-emerald-300" />, categoryItems.bundles)}

      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="border-zinc-700 bg-zinc-950 text-zinc-100 sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-xl text-white">{selectedItem?.name}</DialogTitle>
            <DialogDescription className="text-zinc-400">Preview and decide if this item matches your vibe.</DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4">
              <div className={`rounded-2xl border p-6 text-center ${rarityStyle[selectedItem.rarity].border} bg-zinc-900/70`}>
                <div
                  className="select-none text-8xl transition-transform duration-300"
                  style={{ transform: `rotate(${previewRotation}deg) scale(${previewZoom})` }}
                >
                  {selectedItem.preview}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1"><RotateCcw className="h-3.5 w-3.5" /> Rotate</span>
                  <input type="range" min={-35} max={35} value={previewRotation} onChange={(e) => setPreviewRotation(Number(e.target.value))} className="w-full" />
                </label>
                <label className="space-y-1 text-xs text-zinc-300">
                  <span className="inline-flex items-center gap-1"><ZoomIn className="h-3.5 w-3.5" /> Zoom</span>
                  <input type="range" min={0.8} max={1.8} step={0.1} value={previewZoom} onChange={(e) => setPreviewZoom(Number(e.target.value))} className="w-full" />
                </label>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 text-sm">
                <p className="text-zinc-300">{selectedItem.description}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={`border ${rarityStyle[selectedItem.rarity].chip}`}>{rarityStyle[selectedItem.rarity].text}</Badge>
                  <Badge variant="outline" className="border-zinc-700 text-zinc-300">
                    {selectedItem.currency === 'coins' ? <Coins className="mr-1 h-3.5 w-3.5 text-yellow-400" /> : <Gem className="mr-1 h-3.5 w-3.5 text-purple-400" />} {selectedItem.price}
                  </Badge>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedItem(null)}>Cancel</Button>
            <Button variant="secondary" onClick={() => selectedItem && toast.info(`Previewed on profile: ${selectedItem.name}`)}>
              Preview on profile
            </Button>
            <Button
              onClick={async () => {
                if (!selectedItem) return;
                await handlePurchase(selectedItem);
                setSelectedItem(null);
              }}
              disabled={!selectedItem || purchasing === selectedItem.id}
            >
              {purchasing && selectedItem && purchasing === selectedItem.id ? 'Buying...' : 'Buy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(unlockedItem)} onOpenChange={(open) => !open && setUnlockedItem(null)}>
        <DialogContent className="border-green-500/40 bg-zinc-950 text-zinc-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl text-white">Item Unlocked 🎉</DialogTitle>
            <DialogDescription className="text-center text-zinc-400">{unlockedItem?.name} has been added to your locker.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/60 p-5 text-center">
            <div className="animate-bounce text-6xl">{unlockedItem?.preview}</div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlockedItem(null)}>Close</Button>
            <Button
              onClick={async () => {
                if (unlockedItem) await handleEquip(unlockedItem);
                setUnlockedItem(null);
              }}
            >
              Equip Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AvatarStore;
