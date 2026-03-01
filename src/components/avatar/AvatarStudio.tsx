import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Sparkles, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import AvatarRenderer from './AvatarRenderer';
import { supabase } from '@/integrations/supabase/client';
import {
  AvatarCategory,
  AvatarItem,
  CATEGORY_ORDER,
  DEFAULT_AVATAR_CONFIG,
  UltimateAvatarConfig,
  estimateSelfieAvatar,
  xpToLevel,
} from '@/lib/avatarSystem';

interface AvatarStudioProps {
  userId: string;
  userXp: number;
  initialConfig?: Partial<UltimateAvatarConfig>;
  onSave: (config: UltimateAvatarConfig) => void;
}

const labelMap: Record<AvatarCategory, string> = {
  face: 'Face',
  hair: 'Hair',
  eyes: 'Eyes',
  eyebrows: 'Eyebrows',
  nose: 'Nose',
  mouth: 'Mouth',
  skin: 'Skin tone',
  glasses: 'Glasses',
  accessories: 'Accessories',
  clothes: 'Clothes',
  background: 'Background',
  aura: 'Aura',
};

const fallbackItems: AvatarItem[] = [
  { id: 'face-round', category: 'face', name: 'Round', requiredXp: 0, rarityLevel: 'common', value: 'round' },
  { id: 'face-oval', category: 'face', name: 'Oval', requiredXp: 300, rarityLevel: 'rare', value: 'oval' },
  { id: 'hair-short', category: 'hair', name: 'Short', requiredXp: 0, rarityLevel: 'common', value: 'short' },
  { id: 'hair-curly', category: 'hair', name: 'Curly', requiredXp: 100, rarityLevel: 'common', value: 'curly' },
  { id: 'hair-wavy', category: 'hair', name: 'Wavy', requiredXp: 500, rarityLevel: 'rare', value: 'wavy' },
  { id: 'eyes-friendly', category: 'eyes', name: 'Friendly', requiredXp: 0, rarityLevel: 'common', value: 'friendly' },
  { id: 'eyes-focused', category: 'eyes', name: 'Focused', requiredXp: 250, rarityLevel: 'rare', value: 'focused' },
  { id: 'eyebrows-soft', category: 'eyebrows', name: 'Soft', requiredXp: 0, rarityLevel: 'common', value: 'soft' },
  { id: 'nose-button', category: 'nose', name: 'Button', requiredXp: 0, rarityLevel: 'common', value: 'button' },
  { id: 'mouth-smile', category: 'mouth', name: 'Smile', requiredXp: 0, rarityLevel: 'common', value: 'smile' },
  { id: 'skin-medium', category: 'skin', name: 'Medium', requiredXp: 0, rarityLevel: 'common', value: '#D4A574', color: '#D4A574' },
  { id: 'skin-light', category: 'skin', name: 'Light', requiredXp: 0, rarityLevel: 'common', value: '#F4C9A8', color: '#F4C9A8' },
  { id: 'skin-dark', category: 'skin', name: 'Dark', requiredXp: 0, rarityLevel: 'common', value: '#7C4A32', color: '#7C4A32' },
  { id: 'glasses-none', category: 'glasses', name: 'None', requiredXp: 0, rarityLevel: 'common', value: 'none' },
  { id: 'glasses-smart', category: 'glasses', name: 'Smart Glasses', requiredXp: 1000, rarityLevel: 'epic', value: 'smart' },
  { id: 'accessories-none', category: 'accessories', name: 'None', requiredXp: 0, rarityLevel: 'common', value: 'none' },
  { id: 'accessories-backpack', category: 'accessories', name: 'Backpack', requiredXp: 500, rarityLevel: 'rare', value: 'backpack' },
  { id: 'clothes-basic', category: 'clothes', name: 'Basic T-Shirt', requiredXp: 0, rarityLevel: 'common', value: 'basic-tee' },
  { id: 'clothes-hoodie', category: 'clothes', name: 'Hoodie', requiredXp: 500, rarityLevel: 'rare', value: 'hoodie' },
  { id: 'clothes-golden', category: 'clothes', name: 'Golden Hoodie', requiredXp: 2000, rarityLevel: 'legendary', value: 'golden-hoodie' },
  { id: 'clothes-cape', category: 'clothes', name: 'Education Cape', requiredXp: 5000, rarityLevel: 'legendary', value: 'education-cape' },
  { id: 'background-classroom', category: 'background', name: 'Classroom', requiredXp: 0, rarityLevel: 'common', value: 'classroom' },
  { id: 'background-library', category: 'background', name: 'Library', requiredXp: 1000, rarityLevel: 'epic', value: 'library' },
  { id: 'aura-none', category: 'aura', name: 'None', requiredXp: 0, rarityLevel: 'common', value: 'none' },
  { id: 'aura-study', category: 'aura', name: 'Study Aura', requiredXp: 2000, rarityLevel: 'legendary', value: 'study' },
];

const AvatarStudio: React.FC<AvatarStudioProps> = ({ userId, userXp, initialConfig, onSave }) => {
  const [config, setConfig] = useState<UltimateAvatarConfig>({ ...DEFAULT_AVATAR_CONFIG, ...initialConfig });
  const [activeTab, setActiveTab] = useState<AvatarCategory>('face');
  const [items, setItems] = useState<AvatarItem[]>(fallbackItems);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set(fallbackItems.filter((i) => i.requiredXp === 0).map((i) => i.id)));

  const currentLevel = xpToLevel(userXp);
  const currentLevelXp = (currentLevel - 1) * 100;
  const nextLevelXp = currentLevel * 100;

  useEffect(() => {
    const loadItems = async () => {
      try {
        const avatarClient = supabase as any;
        const { data: itemData } = await avatarClient
          .from('avatar_items')
          .select('id, category, name, asset_url, required_xp, rarity_level, preview')
          .order('required_xp', { ascending: true });

        const { data: unlockedData } = await avatarClient
          .from('user_unlocked_items')
          .select('item_id')
          .eq('user_id', userId);

        if (itemData?.length) {
          setItems(
            itemData.map((entry: any) => ({
              id: entry.id,
              category: entry.category,
              name: entry.name,
              assetUrl: entry.asset_url,
              requiredXp: entry.required_xp || 0,
              rarityLevel: entry.rarity_level || 'common',
              value: entry.asset_url || entry.preview || entry.name.toLowerCase().replace(/\s+/g, '-'),
            }))
          );
        }

        if (unlockedData) {
          const unlockedIds = new Set<string>([...fallbackItems.filter((i) => i.requiredXp === 0).map((i) => i.id), ...unlockedData.map((u: any) => u.item_id)]);
          setUnlocked(unlockedIds);
        }
      } catch {
        toast.warning('Using offline avatar catalog.');
      }
    };

    loadItems();
  }, [userId]);

  const tabItems = useMemo(() => items.filter((item) => item.category === activeTab), [items, activeTab]);

  const updateConfig = (category: AvatarCategory, value: string) => {
    const keyMap: Record<AvatarCategory, keyof UltimateAvatarConfig> = {
      face: 'face',
      hair: 'hair',
      eyes: 'eyes',
      eyebrows: 'eyebrows',
      nose: 'nose',
      mouth: 'mouth',
      skin: 'skinTone',
      glasses: 'glasses',
      accessories: 'accessories',
      clothes: 'clothes',
      background: 'background',
      aura: 'aura',
    };

    setConfig((prev) => ({ ...prev, [keyMap[category]]: value }));
  };

  const handleUnlock = async (item: AvatarItem) => {
    if (userXp < item.requiredXp) {
      toast.error(`Unlock at Level ${xpToLevel(item.requiredXp)}.`);
      return;
    }

    setUnlocked((prev) => new Set([...prev, item.id]));
    toast.success(`Unlocked ${item.name}! ✨`);

    try {
      const avatarClient = supabase as any;
      await avatarClient.rpc('unlock_avatar_item', { p_item_id: item.id });
    } catch {
      // local optimistic unlock still works
    }
  };

  const handleSelfie = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const estimate = await estimateSelfieAvatar(file);
    setConfig((prev) => ({ ...prev, ...estimate }));
    toast.success('Selfie analyzed. Base avatar generated.');
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold">Live Preview</h3>
              <p className="text-sm text-muted-foreground">Snapchat-inspired, built for learning goals.</p>
            </div>
            <Badge variant="secondary">Lvl {currentLevel}</Badge>
          </div>

          <AvatarRenderer avatarConfig={config} size="xl" className="mx-auto h-52 w-52" />

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>XP Progress</span>
              <span>{userXp} XP</span>
            </div>
            <Progress value={((userXp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100} />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => onSave(config)}>
              Save Avatar
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" /> Selfie Auto-Generate
                <Input type="file" accept="image/*" className="hidden" onChange={handleSelfie} />
              </label>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AvatarCategory)}>
            <TabsList className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1 h-auto bg-transparent p-0">
              {CATEGORY_ORDER.map((category) => (
                <TabsTrigger key={category} value={category} className="text-xs rounded-lg border bg-muted/50 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {labelMap[category]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <ScrollArea className="h-[360px] pr-2">
            <div className="grid grid-cols-2 gap-2">
              {tabItems.map((item) => {
                const isUnlocked = unlocked.has(item.id) || item.requiredXp <= userXp;
                return (
                  <button
                    key={item.id}
                    onClick={() => (isUnlocked ? updateConfig(activeTab, item.value) : handleUnlock(item))}
                    className="rounded-lg border p-3 text-left hover:border-primary transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{item.rarityLevel}</p>
                      </div>
                      {!isUnlocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <Sparkles className="h-4 w-4 text-primary" />}
                    </div>
                    {!isUnlocked && <p className="mt-2 text-xs text-amber-600">Unlock at Level {xpToLevel(item.requiredXp)}</p>}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AvatarStudio;
export type { UltimateAvatarConfig };
