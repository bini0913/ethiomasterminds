import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Palette, Shirt, Crown, Sparkles, Lock, Check, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AvatarConfig {
  bodyType: string;
  skinTone: string;
  faceShape: string;
  hairstyle: string;
  hairColor: string;
  eyeStyle: string;
  eyebrows: string;
  outfit: string;
  outfitColor: string;
  accessory: string;
  background: string;
}

interface PUBGAvatarEditorProps {
  initialConfig?: Partial<AvatarConfig>;
  unlockedItems?: string[];
  userLevel?: number;
  onSave?: (config: AvatarConfig) => void;
}

const bodyTypes = [
  { id: 'slim', label: 'Slim', emoji: '🧍' },
  { id: 'regular', label: 'Regular', emoji: '🧍' },
  { id: 'athletic', label: 'Athletic', emoji: '💪' },
];

const skinTones = [
  { id: 'fair', color: '#FFE4C4' },
  { id: 'light', color: '#DEB887' },
  { id: 'medium', color: '#C68642' },
  { id: 'tan', color: '#8D5524' },
  { id: 'brown', color: '#6B4423' },
  { id: 'dark', color: '#3D2314' },
];

const faceShapes = [
  { id: 'round', label: 'Round', icon: '🌕' },
  { id: 'oval', label: 'Oval', icon: '🥚' },
  { id: 'square', label: 'Square', icon: '🔲' },
  { id: 'heart', label: 'Heart', icon: '💜' },
];

const hairstyles = [
  { id: 'short', label: 'Short', emoji: '👱', requiredLevel: 1 },
  { id: 'medium', label: 'Medium', emoji: '👩', requiredLevel: 1 },
  { id: 'long', label: 'Long', emoji: '👩‍🦰', requiredLevel: 1 },
  { id: 'curly', label: 'Curly', emoji: '👩‍🦱', requiredLevel: 2 },
  { id: 'mohawk', label: 'Mohawk', emoji: '💇', requiredLevel: 3 },
  { id: 'braids', label: 'Braids', emoji: '🧑‍🦱', requiredLevel: 4 },
  { id: 'bald', label: 'Bald', emoji: '👨‍🦲', requiredLevel: 1 },
  { id: 'afro', label: 'Afro', emoji: '🧑‍🦱', requiredLevel: 5 },
];

const hairColors = [
  { id: 'black', color: '#1a1a1a' },
  { id: 'brown', color: '#4a3728' },
  { id: 'blonde', color: '#d4a574' },
  { id: 'red', color: '#8b2500' },
  { id: 'gray', color: '#808080' },
  { id: 'white', color: '#f5f5f5' },
  { id: 'blue', color: '#4169e1', requiredLevel: 5 },
  { id: 'pink', color: '#ff69b4', requiredLevel: 5 },
  { id: 'green', color: '#32cd32', requiredLevel: 6 },
  { id: 'purple', color: '#9370db', requiredLevel: 6 },
];

const eyeStyles = [
  { id: 'normal', label: 'Normal', emoji: '👁️' },
  { id: 'round', label: 'Round', emoji: '👀' },
  { id: 'almond', label: 'Almond', emoji: '👁️' },
  { id: 'narrow', label: 'Narrow', emoji: '😑' },
];

const outfits = [
  { id: 'casual', label: 'Casual', emoji: '👕', requiredLevel: 1 },
  { id: 'sporty', label: 'Sporty', emoji: '🏃', requiredLevel: 1 },
  { id: 'formal', label: 'Formal', emoji: '👔', requiredLevel: 2 },
  { id: 'hoodie', label: 'Hoodie', emoji: '🧥', requiredLevel: 2 },
  { id: 'uniform', label: 'Uniform', emoji: '👮', requiredLevel: 3 },
  { id: 'superhero', label: 'Superhero', emoji: '🦸', requiredLevel: 5 },
  { id: 'royal', label: 'Royal', emoji: '👑', requiredLevel: 7 },
  { id: 'legendary', label: 'Legendary', emoji: '⭐', requiredLevel: 10 },
];

const accessories = [
  { id: 'none', label: 'None', emoji: '❌', requiredLevel: 1 },
  { id: 'glasses', label: 'Glasses', emoji: '👓', requiredLevel: 1 },
  { id: 'sunglasses', label: 'Sunglasses', emoji: '🕶️', requiredLevel: 2 },
  { id: 'cap', label: 'Cap', emoji: '🧢', requiredLevel: 2 },
  { id: 'headphones', label: 'Headphones', emoji: '🎧', requiredLevel: 3 },
  { id: 'crown', label: 'Crown', emoji: '👑', requiredLevel: 8 },
  { id: 'halo', label: 'Halo', emoji: '😇', requiredLevel: 10 },
];

const backgrounds = [
  { id: 'blue', color: 'from-blue-500 to-blue-700' },
  { id: 'purple', color: 'from-purple-500 to-purple-700' },
  { id: 'green', color: 'from-green-500 to-green-700' },
  { id: 'orange', color: 'from-orange-500 to-orange-700' },
  { id: 'pink', color: 'from-pink-500 to-pink-700' },
  { id: 'rainbow', color: 'from-red-500 via-yellow-500 to-blue-500', requiredLevel: 5 },
];

const defaultConfig: AvatarConfig = {
  bodyType: 'regular',
  skinTone: 'medium',
  faceShape: 'oval',
  hairstyle: 'short',
  hairColor: 'black',
  eyeStyle: 'normal',
  eyebrows: 'normal',
  outfit: 'casual',
  outfitColor: 'blue',
  accessory: 'none',
  background: 'blue',
};

const PUBGAvatarEditor: React.FC<PUBGAvatarEditorProps> = ({
  initialConfig = {},
  unlockedItems = [],
  userLevel = 1,
  onSave,
}) => {
  const [config, setConfig] = useState<AvatarConfig>({ ...defaultConfig, ...initialConfig });
  const [activeTab, setActiveTab] = useState('body');

  const isItemLocked = (requiredLevel?: number) => {
    if (!requiredLevel) return false;
    return userLevel < requiredLevel;
  };

  const updateConfig = (key: keyof AvatarConfig, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const resetConfig = () => {
    setConfig(defaultConfig);
  };

  const renderAvatarPreview = () => {
    const skinTone = skinTones.find((s) => s.id === config.skinTone);
    const hairstyle = hairstyles.find((h) => h.id === config.hairstyle);
    const outfit = outfits.find((o) => o.id === config.outfit);
    const accessory = accessories.find((a) => a.id === config.accessory);
    const bg = backgrounds.find((b) => b.id === config.background);

    return (
      <motion.div
        className={cn(
          'relative w-48 h-48 rounded-full flex items-center justify-center bg-gradient-to-br',
          bg?.color || 'from-primary to-accent'
        )}
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="absolute inset-4 rounded-full flex items-center justify-center flex-col">
            {/* Face */}
            <div
              className="w-20 h-24 rounded-full flex items-center justify-center text-4xl relative"
              style={{ backgroundColor: skinTone?.color }}
            >
              {/* Eyes */}
              <span className="absolute top-6">{eyeStyles.find((e) => e.id === config.eyeStyle)?.emoji || '👀'}</span>
            </div>
            {/* Hair */}
            <span className="absolute top-2 text-3xl">{hairstyle?.emoji}</span>
            {/* Accessory */}
            {accessory?.id !== 'none' && (
              <span className="absolute top-0 text-2xl">{accessory?.emoji}</span>
            )}
            {/* Outfit */}
            <span className="absolute bottom-4 text-3xl">{outfit?.emoji}</span>
          </div>
        </div>
        
        {/* Glow effect */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
      </motion.div>
    );
  };

  const renderItemGrid = (
    items: Array<{ id: string; label?: string; emoji?: string; color?: string; requiredLevel?: number }>,
    selectedId: string,
    onSelect: (id: string) => void,
    type: 'emoji' | 'color' = 'emoji'
  ) => (
    <div className="grid grid-cols-4 gap-2">
      {items.map((item) => {
        const locked = isItemLocked(item.requiredLevel);
        return (
          <motion.button
            key={item.id}
            whileHover={!locked ? { scale: 1.1 } : undefined}
            whileTap={!locked ? { scale: 0.95 } : undefined}
            onClick={() => !locked && onSelect(item.id)}
            className={cn(
              'relative aspect-square rounded-xl flex items-center justify-center border-2 transition-all',
              selectedId === item.id
                ? 'border-primary bg-primary/20 glow-purple'
                : 'border-border hover:border-primary/50',
              locked && 'opacity-50 cursor-not-allowed'
            )}
            style={type === 'color' ? { backgroundColor: item.color } : undefined}
          >
            {type === 'emoji' && (
              <span className="text-2xl">{item.emoji}</span>
            )}
            {selectedId === item.id && (
              <div className="absolute -top-1 -right-1">
                <Check className="h-4 w-4 text-primary bg-background rounded-full p-0.5" />
              </div>
            )}
            {locked && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
            {item.requiredLevel && item.requiredLevel > 1 && (
              <Badge
                variant="secondary"
                className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] px-1"
              >
                Lv.{item.requiredLevel}
              </Badge>
            )}
          </motion.button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Preview Section */}
        <Card className="p-6 glass neon-border flex flex-col items-center justify-center gap-4">
          <h3 className="text-lg font-display font-bold text-foreground">Preview</h3>
          {renderAvatarPreview()}
          <div className="flex gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={resetConfig}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={() => onSave?.(config)} className="bg-primary">
              <Check className="h-4 w-4 mr-2" />
              Save Avatar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Level {userLevel} • Unlock more items by leveling up!
          </p>
        </Card>

        {/* Editor Section */}
        <Card className="p-4 glass">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="body" className="text-xs">
                <User className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="face" className="text-xs">
                👤
              </TabsTrigger>
              <TabsTrigger value="hair" className="text-xs">
                💇
              </TabsTrigger>
              <TabsTrigger value="outfit" className="text-xs">
                <Shirt className="h-4 w-4" />
              </TabsTrigger>
              <TabsTrigger value="extras" className="text-xs">
                <Crown className="h-4 w-4" />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 p-2"
                >
                  <TabsContent value="body" className="m-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Body Type</h4>
                      {renderItemGrid(bodyTypes, config.bodyType, (v) => updateConfig('bodyType', v))}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Skin Tone</h4>
                      {renderItemGrid(skinTones, config.skinTone, (v) => updateConfig('skinTone', v), 'color')}
                    </div>
                  </TabsContent>

                  <TabsContent value="face" className="m-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Face Shape</h4>
                      {renderItemGrid(faceShapes, config.faceShape, (v) => updateConfig('faceShape', v))}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Eye Style</h4>
                      {renderItemGrid(eyeStyles, config.eyeStyle, (v) => updateConfig('eyeStyle', v))}
                    </div>
                  </TabsContent>

                  <TabsContent value="hair" className="m-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Hairstyle</h4>
                      {renderItemGrid(hairstyles, config.hairstyle, (v) => updateConfig('hairstyle', v))}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Hair Color</h4>
                      {renderItemGrid(hairColors, config.hairColor, (v) => updateConfig('hairColor', v), 'color')}
                    </div>
                  </TabsContent>

                  <TabsContent value="outfit" className="m-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Outfit</h4>
                      {renderItemGrid(outfits, config.outfit, (v) => updateConfig('outfit', v))}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Background</h4>
                      <div className="grid grid-cols-6 gap-2">
                        {backgrounds.map((bg) => {
                          const locked = isItemLocked(bg.requiredLevel);
                          return (
                            <motion.button
                              key={bg.id}
                              whileHover={!locked ? { scale: 1.1 } : undefined}
                              onClick={() => !locked && updateConfig('background', bg.id)}
                              className={cn(
                                'aspect-square rounded-lg bg-gradient-to-br border-2',
                                bg.color,
                                config.background === bg.id ? 'border-primary' : 'border-transparent',
                                locked && 'opacity-50'
                              )}
                            >
                              {locked && <Lock className="h-3 w-3 text-white mx-auto" />}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="extras" className="m-0 space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2 text-foreground">Accessories</h4>
                      {renderItemGrid(accessories, config.accessory, (v) => updateConfig('accessory', v))}
                    </div>
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </ScrollArea>
          </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default PUBGAvatarEditor;
