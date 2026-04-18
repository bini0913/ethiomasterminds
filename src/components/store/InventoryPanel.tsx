import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUser } from '@/context/UserContext';
import { toast } from 'sonner';
import { Check, Shirt, Car, House, Crown, UserRound, Star } from 'lucide-react';

type InventoryItem = {
  id: string;
  item_id: string;
  equipped: boolean;
  acquired_at: string;
  store_items: {
    id: string;
    name: string;
    section: string;
    rarity: string;
    preview: string | null;
    description: string | null;
  } | null;
};

const sectionOrder = ['avatars', 'clothes', 'cars', 'houses', 'titles', 'featured', 'customization', 'effects'];

const sectionMeta: Record<string, { label: string; icon: React.ReactNode }> = {
  featured: { label: 'Featured', icon: <Star className="h-4 w-4" /> },
  avatars: { label: 'Avatars', icon: <UserRound className="h-4 w-4" /> },
  clothes: { label: 'Clothes', icon: <Shirt className="h-4 w-4" /> },
  cars: { label: 'Cars', icon: <Car className="h-4 w-4" /> },
  houses: { label: 'Houses', icon: <House className="h-4 w-4" /> },
  titles: { label: 'Titles', icon: <Crown className="h-4 w-4" /> },
  customization: { label: 'Customization', icon: <Shirt className="h-4 w-4" /> },
  effects: { label: 'Effects', icon: <Star className="h-4 w-4" /> },
};

const InventoryPanel: React.FC = () => {
  const { user } = useUser();
  const [items, setItems] = React.useState<InventoryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [equippingId, setEquippingId] = React.useState<string | null>(null);

  const loadInventory = React.useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data, error } = await (supabase as any)
      .from('user_items')
      .select('item_id, equipped, acquired_at, store_items(id, name, section, rarity, preview, description)')
      .eq('user_id', user.id)
      .order('acquired_at', { ascending: false });

    if (error) {
      toast.error('Failed to load inventory');
      setLoading(false);
      return;
    }

    const mapped: InventoryItem[] = (data || []).map((entry: any) => ({
      id: `${entry.item_id}`,
      item_id: entry.item_id,
      equipped: Boolean(entry.equipped),
      acquired_at: entry.acquired_at,
      store_items: entry.store_items,
    }));

    setItems(mapped);
    setLoading(false);
  }, [user?.id]);

  React.useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  React.useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`inventory-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_items', filter: `user_id=eq.${user.id}` },
        () => void loadInventory()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, loadInventory]);

  const handleEquip = async (itemId: string) => {
    setEquippingId(itemId);
    const { error } = await (supabase as any).rpc('equip_store_item', { p_item_id: itemId });
    if (error) {
      toast.error(error.message || 'Failed to equip item');
      setEquippingId(null);
      return;
    }

    toast.success('Item equipped');
    await loadInventory();
    setEquippingId(null);
  };

  const grouped = React.useMemo(() => {
    const groupMap = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const section = item.store_items?.section || 'featured';
      if (!groupMap.has(section)) {
        groupMap.set(section, []);
      }
      groupMap.get(section)?.push(item);
    }

    const sortedSections = [...groupMap.keys()].sort((a, b) => sectionOrder.indexOf(a) - sectionOrder.indexOf(b));
    return sortedSections.map((key) => ({ section: key, items: groupMap.get(key) || [] }));
  }, [items]);

  if (!user) return null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inventory Locker</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading inventory...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No owned items yet. Buy something from the shop first.</p>
          ) : (
            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={group.section} className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    {sectionMeta[group.section]?.icon ?? <Star className="h-4 w-4" />}
                    {sectionMeta[group.section]?.label ?? group.section}
                  </h3>

                  <ScrollArea className="w-full whitespace-nowrap rounded-md border">
                    <div className="flex w-max gap-3 p-3">
                      {group.items.map((item) => (
                        <Card key={item.id} className="min-w-[220px] max-w-[220px]">
                          <CardContent className="pt-4 space-y-3">
                            <div className="text-4xl text-center">{item.store_items?.preview || '🎁'}</div>
                            <div>
                              <p className="font-medium">{item.store_items?.name || 'Unknown Item'}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{item.store_items?.description || 'No description'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize">{item.store_items?.rarity || 'common'}</Badge>
                              {item.equipped ? (
                                <Badge className="bg-green-600 text-white">
                                  <Check className="h-3 w-3 mr-1" /> Equipped
                                </Badge>
                              ) : (
                                <Badge variant="secondary">Owned</Badge>
                              )}
                            </div>
                            {!item.equipped && (
                              <Button
                                size="sm"
                                className="w-full"
                                onClick={() => handleEquip(item.item_id)}
                                disabled={equippingId === item.item_id}
                              >
                                {equippingId === item.item_id ? 'Equipping...' : 'Equip'}
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InventoryPanel;
