import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { User, Palette, Shirt, Sparkles, Crown, Check, RotateCcw, Save, Lock } from 'lucide-react';

export interface SimpleAvatarConfig {
  skinTone: string;
  expression: string;
  outfit: string;
  accessory: string;
  background: string;
}

interface SimpleAvatarEditorProps {
  initialConfig?: Partial<SimpleAvatarConfig>;
  userLevel?: number;
  onSave: (config: SimpleAvatarConfig) => void;
  onCancel?: () => void;
}

const skinTones = [
  { id: 'fair', color: '#FFE4D4', label: 'Fair' },
  { id: 'light', color: '#FFDBB4', label: 'Light' },
  { id: 'medium', color: '#D4A574', label: 'Medium' },
  { id: 'tan', color: '#C68642', label: 'Tan' },
  { id: 'brown', color: '#8D5524', label: 'Brown' },
  { id: 'dark', color: '#5C3317', label: 'Dark' },
];

const expressions = [
  { id: 'happy', emoji: '😊', label: 'Happy', level: 1 },
  { id: 'cool', emoji: '😎', label: 'Cool', level: 1 },
  { id: 'excited', emoji: '🤩', label: 'Excited', level: 2 },
  { id: 'thinking', emoji: '🤔', label: 'Thinking', level: 2 },
  { id: 'wink', emoji: '😉', label: 'Wink', level: 3 },
  { id: 'confident', emoji: '😏', label: 'Confident', level: 3 },
  { id: 'surprised', emoji: '😲', label: 'Surprised', level: 4 },
  { id: 'determined', emoji: '😤', label: 'Determined', level: 5 },
  { id: 'party', emoji: '🥳', label: 'Party', level: 6 },
  { id: 'genius', emoji: '🧠', label: 'Genius', level: 8 },
  { id: 'legend', emoji: '🌟', label: 'Legend', level: 10 },
];

const outfits = [
  { id: 'casual', emoji: '👕', label: 'Casual', color: '#3B82F6', level: 1 },
  { id: 'sporty', emoji: '🏃', label: 'Sporty', color: '#22C55E', level: 1 },
  { id: 'student', emoji: '📚', label: 'Student', color: '#8B5CF6', level: 2 },
  { id: 'formal', emoji: '👔', label: 'Formal', color: '#1E3A5F', level: 3 },
  { id: 'hoodie', emoji: '🧥', label: 'Hoodie', color: '#6B7280', level: 3 },
  { id: 'scientist', emoji: '🔬', label: 'Scientist', color: '#06B6D4', level: 5 },
  { id: 'superhero', emoji: '🦸', label: 'Superhero', color: '#EF4444', level: 7 },
  { id: 'royal', emoji: '👑', label: 'Royal', color: '#F59E0B', level: 10 },
];

const accessories = [
  { id: 'none', emoji: '❌', label: 'None', level: 1 },
  { id: 'glasses', emoji: '👓', label: 'Glasses', level: 1 },
  { id: 'sunglasses', emoji: '🕶️', label: 'Sunglasses', level: 2 },
  { id: 'cap', emoji: '🧢', label: 'Cap', level: 2 },
  { id: 'headphones', emoji: '🎧', label: 'Headphones', level: 3 },
  { id: 'trophy', emoji: '🏆', label: 'Trophy', level: 5 },
  { id: 'crown', emoji: '👑', label: 'Crown', level: 8 },
  { id: 'halo', emoji: '😇', label: 'Halo', level: 10 },
];

const backgrounds = [
  { id: 'sky', gradient: 'from-sky-400 to-blue-500', label: 'Sky', level: 1 },
  { id: 'sunset', gradient: 'from-orange-400 to-pink-500', label: 'Sunset', level: 1 },
  { id: 'forest', gradient: 'from-green-400 to-emerald-600', label: 'Forest', level: 2 },
  { id: 'ocean', gradient: 'from-cyan-400 to-blue-600', label: 'Ocean', level: 2 },
  { id: 'rose', gradient: 'from-pink-400 to-rose-500', label: 'Rose', level: 3 },
  { id: 'galaxy', gradient: 'from-purple-500 to-indigo-700', label: 'Galaxy', level: 5 },
  { id: 'fire', gradient: 'from-red-500 to-orange-500', label: 'Fire', level: 6 },
  { id: 'aurora', gradient: 'from-green-400 via-purple-500 to-pink-500', label: 'Aurora', level: 8 },
  { id: 'gold', gradient: 'from-yellow-400 to-amber-600', label: 'Gold', level: 10 },
];

const categories = [
  { id: 'skin', label: 'Skin', icon: User },
  { id: 'expression', label: 'Expression', icon: Sparkles },
  { id: 'outfit', label: 'Outfit', icon: Shirt },
  { id: 'accessory', label: 'Accessory', icon: Crown },
  { id: 'background', label: 'Background', icon: Palette },
];

const defaultConfig: SimpleAvatarConfig = {
  skinTone: 'medium',
  expression: 'happy',
  outfit: 'casual',
  accessory: 'none',
  background: 'sky',
};

const SimpleAvatarEditor: React.FC<SimpleAvatarEditorProps> = ({
  initialConfig = {},
  userLevel = 1,
  onSave,
  onCancel,
}) => {
  const [config, setConfig] = useState<SimpleAvatarConfig>({ ...defaultConfig, ...initialConfig });
  const [activeCategory, setActiveCategory] = useState('skin');

  const isLocked = (level: number) => userLevel < level;

  const handleReset = () => setConfig(defaultConfig);

  const getCurrentExpression = () => expressions.find(e => e.id === config.expression);
  const getCurrentOutfit = () => outfits.find(o => o.id === config.outfit);
  const getCurrentAccessory = () => accessories.find(a => a.id === config.accessory);
  const getCurrentBackground = () => backgrounds.find(b => b.id === config.background);
  const getCurrentSkin = () => skinTones.find(s => s.id === config.skinTone);

  const renderOptionButton = (
    item: { id: string; label: string; emoji?: string; color?: string; gradient?: string; level?: number },
    configKey: keyof SimpleAvatarConfig,
    isSkinTone = false
  ) => {
    const isSelected = config[configKey] === item.id;
    const locked = item.level ? isLocked(item.level) : false;

    return (
      <motion.button
        key={item.id}
        onClick={() => !locked && setConfig(prev => ({ ...prev, [configKey]: item.id }))}
        disabled={locked}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all min-h-[80px]',
          isSelected
            ? 'border-primary bg-primary/20 ring-2 ring-primary/50'
            : locked
            ? 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed'
            : 'border-border hover:border-primary/50 hover:bg-accent/10'
        )}
        whileHover={!locked ? { scale: 1.05 } : undefined}
        whileTap={!locked ? { scale: 0.95 } : undefined}
      >
        {isSkinTone ? (
          <div
            className="w-10 h-10 rounded-full border-2 border-white/50 shadow-inner"
            style={{ backgroundColor: item.color }}
          />
        ) : item.gradient ? (
          <div className={cn('w-10 h-10 rounded-full bg-gradient-to-br', item.gradient)} />
        ) : (
          <span className="text-3xl">{item.emoji}</span>
        )}
        <span className="text-xs font-medium">{item.label}</span>

        {isSelected && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Check className="w-3 h-3 text-primary-foreground" />
          </motion.div>
        )}

        {locked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl backdrop-blur-sm">
            <div className="text-center">
              <Lock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground">Lv.{item.level}</span>
            </div>
          </div>
        )}
      </motion.button>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full p-4">
      {/* Category Tabs */}
      <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:w-20">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl transition-all min-w-[70px]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg'
                  : 'bg-card hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{cat.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Avatar Preview */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="relative mb-6">
          {/* Glow */}
          <div className="absolute inset-0 bg-primary/30 rounded-full blur-3xl scale-150" />
          
          {/* Avatar Display */}
          <motion.div
            className={cn(
              'relative w-40 h-40 rounded-full flex items-center justify-center bg-gradient-to-br shadow-2xl border-4 border-white/20',
              getCurrentBackground()?.gradient
            )}
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            {/* Skin tone ring */}
            <div
              className="absolute inset-2 rounded-full opacity-50"
              style={{ backgroundColor: getCurrentSkin()?.color }}
            />
            
            {/* Expression */}
            <span className="text-6xl relative z-10">{getCurrentExpression()?.emoji}</span>
            
            {/* Accessory badge */}
            {config.accessory !== 'none' && (
              <motion.span
                className="absolute -top-2 -right-2 text-3xl"
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {getCurrentAccessory()?.emoji}
              </motion.span>
            )}
            
            {/* Outfit indicator */}
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <span className="text-lg">{getCurrentOutfit()?.emoji}</span>
              <span className="text-xs font-medium">{getCurrentOutfit()?.label}</span>
            </motion.div>
          </motion.div>
        </div>

        {/* Level Badge */}
        <Badge className="bg-gradient-to-r from-primary to-accent text-white mb-4">
          Level {userLevel}
        </Badge>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleReset} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button onClick={() => onSave(config)} className="gap-2 bg-gradient-to-r from-primary to-accent">
            <Save className="w-4 h-4" />
            Save Avatar
          </Button>
        </div>
      </div>

      {/* Options Panel */}
      <Card className="flex-1 lg:max-w-xs">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-4 capitalize">{activeCategory}</h3>
          <ScrollArea className="h-[300px] lg:h-[400px]">
            <div className="grid grid-cols-3 gap-3">
              {activeCategory === 'skin' && skinTones.map(item =>
                renderOptionButton({ ...item, level: 1 }, 'skinTone', true)
              )}
              {activeCategory === 'expression' && expressions.map(item =>
                renderOptionButton(item, 'expression')
              )}
              {activeCategory === 'outfit' && outfits.map(item =>
                renderOptionButton(item, 'outfit')
              )}
              {activeCategory === 'accessory' && accessories.map(item =>
                renderOptionButton(item, 'accessory')
              )}
              {activeCategory === 'background' && backgrounds.map(item =>
                renderOptionButton(item, 'background')
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimpleAvatarEditor;
