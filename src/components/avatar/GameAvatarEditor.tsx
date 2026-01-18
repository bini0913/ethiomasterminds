import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, Palette, Shirt, Sparkles, Crown, 
  RotateCcw, Save, Lock, Check, Star,
  Brain, Trophy, ChevronLeft, ChevronRight,
  Smile, Eye, Glasses, Headphones
} from 'lucide-react';
import { cn } from '@/lib/utils';
import GameAvatarRenderer, { GameAvatarConfig } from './GameAvatarRenderer';

interface GameAvatarEditorProps {
  initialConfig?: Partial<GameAvatarConfig>;
  userLevel?: number;
  userXP?: number;
  unlockedItems?: string[];
  onSave: (config: GameAvatarConfig) => void;
  onClose?: () => void;
}

const defaultConfig: GameAvatarConfig = {
  gender: 'neutral',
  bodyType: 'regular',
  skinTone: 'medium',
  faceShape: 'oval',
  eyeStyle: 'round',
  eyeColor: 'brown',
  eyebrowStyle: 'normal',
  noseStyle: 'normal',
  mouthStyle: 'smile',
  hairStyle: 'short',
  hairColor: 'brown',
  outfit: 'tshirt',
  outfitColor: 'blue',
  glasses: 'none',
  headwear: 'none',
  earrings: 'none',
  necklace: 'none',
  backpack: 'none',
  expression: 'happy',
  background: 'sky',
};

// Comprehensive options with level requirements and rarity
const customizationOptions = {
  skinTone: [
    { id: 'porcelain', label: 'Porcelain', level: 1, rarity: 'common' },
    { id: 'ivory', label: 'Ivory', level: 1, rarity: 'common' },
    { id: 'fair', label: 'Fair', level: 1, rarity: 'common' },
    { id: 'light', label: 'Light', level: 1, rarity: 'common' },
    { id: 'medium', label: 'Medium', level: 1, rarity: 'common' },
    { id: 'olive', label: 'Olive', level: 1, rarity: 'common' },
    { id: 'tan', label: 'Tan', level: 1, rarity: 'common' },
    { id: 'caramel', label: 'Caramel', level: 1, rarity: 'common' },
    { id: 'brown', label: 'Brown', level: 1, rarity: 'common' },
    { id: 'chocolate', label: 'Chocolate', level: 1, rarity: 'common' },
    { id: 'dark', label: 'Dark', level: 1, rarity: 'common' },
    { id: 'ebony', label: 'Ebony', level: 1, rarity: 'common' },
  ],
  hairStyle: [
    { id: 'short', label: 'Short', level: 1, rarity: 'common', emoji: '💇' },
    { id: 'medium', label: 'Medium', level: 1, rarity: 'common', emoji: '💇‍♀️' },
    { id: 'long', label: 'Long', level: 2, rarity: 'common', emoji: '👩‍🦰' },
    { id: 'curly', label: 'Curly', level: 3, rarity: 'rare', emoji: '👨‍🦱' },
    { id: 'afro', label: 'Afro', level: 4, rarity: 'rare', emoji: '🧑‍🦱' },
    { id: 'braids', label: 'Braids', level: 5, rarity: 'rare', emoji: '🧑‍🎤' },
    { id: 'ponytail', label: 'Ponytail', level: 4, rarity: 'rare', emoji: '🙍‍♀️' },
    { id: 'bun', label: 'Bun', level: 5, rarity: 'rare', emoji: '👩‍🎤' },
    { id: 'hijab', label: 'Hijab', level: 1, rarity: 'common', emoji: '🧕' },
    { id: 'spiky', label: 'Spiky', level: 6, rarity: 'epic', emoji: '🦔' },
    { id: 'mohawk', label: 'Mohawk', level: 10, rarity: 'legendary', emoji: '🎸' },
    { id: 'buzzcut', label: 'Buzzcut', level: 3, rarity: 'common', emoji: '👨‍🦲' },
    { id: 'bald', label: 'Bald', level: 1, rarity: 'common', emoji: '🧑‍🦲' },
  ],
  hairColor: [
    { id: 'black', label: 'Black', level: 1, rarity: 'common', color: '#1C1C1C' },
    { id: 'darkBrown', label: 'Dark Brown', level: 1, rarity: 'common', color: '#3D2314' },
    { id: 'brown', label: 'Brown', level: 1, rarity: 'common', color: '#6B4423' },
    { id: 'auburn', label: 'Auburn', level: 2, rarity: 'common', color: '#8B4513' },
    { id: 'ginger', label: 'Ginger', level: 3, rarity: 'rare', color: '#C04000' },
    { id: 'blonde', label: 'Blonde', level: 2, rarity: 'common', color: '#D4A574' },
    { id: 'platinum', label: 'Platinum', level: 5, rarity: 'rare', color: '#E8E4E1' },
    { id: 'gray', label: 'Gray', level: 4, rarity: 'rare', color: '#808080' },
    { id: 'white', label: 'White', level: 6, rarity: 'epic', color: '#F5F5F5' },
    { id: 'blue', label: 'Blue', level: 8, rarity: 'epic', color: '#4169E1' },
    { id: 'purple', label: 'Purple', level: 10, rarity: 'legendary', color: '#8B5CF6' },
    { id: 'pink', label: 'Pink', level: 12, rarity: 'legendary', color: '#FF69B4' },
    { id: 'teal', label: 'Teal', level: 9, rarity: 'epic', color: '#14B8A6' },
    { id: 'green', label: 'Green', level: 11, rarity: 'legendary', color: '#22C55E' },
    { id: 'red', label: 'Red', level: 7, rarity: 'epic', color: '#EF4444' },
  ],
  eyeStyle: [
    { id: 'round', label: 'Round', level: 1, rarity: 'common' },
    { id: 'almond', label: 'Almond', level: 1, rarity: 'common' },
    { id: 'big', label: 'Big & Cute', level: 2, rarity: 'common' },
    { id: 'narrow', label: 'Narrow', level: 2, rarity: 'common' },
  ],
  eyeColor: [
    { id: 'brown', label: 'Brown', level: 1, rarity: 'common', color: '#6B4423' },
    { id: 'darkBrown', label: 'Dark Brown', level: 1, rarity: 'common', color: '#3D2314' },
    { id: 'hazel', label: 'Hazel', level: 2, rarity: 'common', color: '#8B7355' },
    { id: 'amber', label: 'Amber', level: 3, rarity: 'rare', color: '#FFBF00' },
    { id: 'green', label: 'Green', level: 2, rarity: 'common', color: '#228B22' },
    { id: 'blue', label: 'Blue', level: 2, rarity: 'common', color: '#4169E1' },
    { id: 'gray', label: 'Gray', level: 3, rarity: 'rare', color: '#708090' },
    { id: 'violet', label: 'Violet', level: 8, rarity: 'legendary', color: '#8B5CF6' },
  ],
  outfit: [
    { id: 'tshirt', label: 'T-Shirt', level: 1, rarity: 'common', emoji: '👕' },
    { id: 'hoodie', label: 'Hoodie', level: 3, rarity: 'rare', emoji: '🧥' },
    { id: 'jacket', label: 'Jacket', level: 5, rarity: 'rare', emoji: '🧥' },
    { id: 'uniform', label: 'School Uniform', level: 4, rarity: 'rare', emoji: '👔' },
    { id: 'dress', label: 'Dress', level: 4, rarity: 'rare', emoji: '👗' },
    { id: 'traditional', label: 'Traditional', level: 6, rarity: 'epic', emoji: '👘' },
    { id: 'sporty', label: 'Sporty', level: 5, rarity: 'rare', emoji: '🎽' },
  ],
  outfitColor: [
    { id: 'blue', label: 'Blue', level: 1, rarity: 'common', color: '#3B82F6' },
    { id: 'red', label: 'Red', level: 1, rarity: 'common', color: '#EF4444' },
    { id: 'green', label: 'Green', level: 1, rarity: 'common', color: '#22C55E' },
    { id: 'purple', label: 'Purple', level: 2, rarity: 'common', color: '#8B5CF6' },
    { id: 'orange', label: 'Orange', level: 2, rarity: 'common', color: '#F97316' },
    { id: 'pink', label: 'Pink', level: 3, rarity: 'rare', color: '#EC4899' },
    { id: 'teal', label: 'Teal', level: 4, rarity: 'rare', color: '#14B8A6' },
    { id: 'yellow', label: 'Yellow', level: 5, rarity: 'rare', color: '#EAB308' },
    { id: 'navy', label: 'Navy', level: 3, rarity: 'rare', color: '#1E3A5F' },
    { id: 'black', label: 'Black', level: 2, rarity: 'common', color: '#1C1C1C' },
    { id: 'white', label: 'White', level: 2, rarity: 'common', color: '#FFFFFF' },
    { id: 'gray', label: 'Gray', level: 1, rarity: 'common', color: '#6B7280' },
  ],
  glasses: [
    { id: 'none', label: 'None', level: 1, rarity: 'common', emoji: '❌' },
    { id: 'round', label: 'Round', level: 2, rarity: 'common', emoji: '👓' },
    { id: 'square', label: 'Square', level: 3, rarity: 'rare', emoji: '🤓' },
    { id: 'sunglasses', label: 'Sunglasses', level: 5, rarity: 'rare', emoji: '😎' },
    { id: 'aviator', label: 'Aviator', level: 8, rarity: 'epic', emoji: '🕶️' },
  ],
  headwear: [
    { id: 'none', label: 'None', level: 1, rarity: 'common', emoji: '❌' },
    { id: 'cap', label: 'Cap', level: 3, rarity: 'rare', emoji: '🧢' },
    { id: 'beanie', label: 'Beanie', level: 4, rarity: 'rare', emoji: '🎿' },
    { id: 'headband', label: 'Headband', level: 5, rarity: 'rare', emoji: '🎾' },
    { id: 'headphones', label: 'Headphones', level: 6, rarity: 'epic', emoji: '🎧' },
    { id: 'crown', label: 'Crown', level: 15, rarity: 'legendary', emoji: '👑' },
  ],
  earrings: [
    { id: 'none', label: 'None', level: 1, rarity: 'common', emoji: '❌' },
    { id: 'studs', label: 'Studs', level: 4, rarity: 'rare', emoji: '💎' },
    { id: 'hoops', label: 'Hoops', level: 6, rarity: 'epic', emoji: '⭕' },
    { id: 'drops', label: 'Drops', level: 8, rarity: 'epic', emoji: '💧' },
  ],
  necklace: [
    { id: 'none', label: 'None', level: 1, rarity: 'common', emoji: '❌' },
    { id: 'chain', label: 'Chain', level: 5, rarity: 'rare', emoji: '⛓️' },
    { id: 'pendant', label: 'Pendant', level: 7, rarity: 'epic', emoji: '📿' },
  ],
  expression: [
    { id: 'happy', label: 'Happy', level: 1, rarity: 'common', emoji: '😊' },
    { id: 'excited', label: 'Excited', level: 2, rarity: 'common', emoji: '🤩' },
    { id: 'confident', label: 'Confident', level: 3, rarity: 'rare', emoji: '😏' },
    { id: 'thinking', label: 'Thinking', level: 4, rarity: 'rare', emoji: '🤔' },
    { id: 'surprised', label: 'Surprised', level: 5, rarity: 'rare', emoji: '😲' },
    { id: 'victory', label: 'Victory', level: 8, rarity: 'epic', emoji: '😤' },
  ],
  background: [
    { id: 'sky', label: 'Sky', level: 1, rarity: 'common' },
    { id: 'sunset', label: 'Sunset', level: 2, rarity: 'common' },
    { id: 'forest', label: 'Forest', level: 3, rarity: 'rare' },
    { id: 'ocean', label: 'Ocean', level: 4, rarity: 'rare' },
    { id: 'mint', label: 'Mint', level: 5, rarity: 'rare' },
    { id: 'rose', label: 'Rose', level: 6, rarity: 'epic' },
    { id: 'fire', label: 'Fire', level: 7, rarity: 'epic' },
    { id: 'galaxy', label: 'Galaxy', level: 10, rarity: 'legendary' },
    { id: 'night', label: 'Night', level: 8, rarity: 'epic' },
    { id: 'aurora', label: 'Aurora', level: 12, rarity: 'legendary' },
    { id: 'gold', label: 'Gold', level: 15, rarity: 'legendary' },
    { id: 'cosmic', label: 'Cosmic', level: 20, rarity: 'legendary' },
  ],
};

const skinColors: Record<string, string> = {
  porcelain: '#FFE4D4', ivory: '#FFECD1', fair: '#F5D0C5', light: '#FFDBB4',
  medium: '#D4A574', olive: '#C9A86C', tan: '#C68642', caramel: '#A67B5B',
  brown: '#8D5524', chocolate: '#6F4E37', dark: '#5C3317', ebony: '#3D2314',
};

const rarityColors: Record<string, { bg: string; text: string; border: string }> = {
  common: { bg: 'bg-gray-500/20', text: 'text-gray-300', border: 'border-gray-500' },
  rare: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500' },
  epic: { bg: 'bg-purple-500/20', text: 'text-purple-300', border: 'border-purple-500' },
  legendary: { bg: 'bg-yellow-500/20', text: 'text-yellow-300', border: 'border-yellow-500' },
};

const categories = [
  { id: 'face', label: 'Face', icon: User, subcategories: ['skinTone', 'eyeStyle', 'eyeColor'] },
  { id: 'hair', label: 'Hair', icon: Palette, subcategories: ['hairStyle', 'hairColor'] },
  { id: 'outfit', label: 'Outfit', icon: Shirt, subcategories: ['outfit', 'outfitColor'] },
  { id: 'accessories', label: 'Accessories', icon: Sparkles, subcategories: ['glasses', 'headwear', 'earrings', 'necklace'] },
  { id: 'expression', label: 'Emotes', icon: Smile, subcategories: ['expression'] },
  { id: 'background', label: 'Background', icon: Crown, subcategories: ['background'] },
];

const GameAvatarEditor: React.FC<GameAvatarEditorProps> = ({
  initialConfig,
  userLevel = 1,
  userXP = 0,
  unlockedItems = [],
  onSave,
  onClose,
}) => {
  const [config, setConfig] = useState<GameAvatarConfig>({ ...defaultConfig, ...initialConfig });
  const [activeCategory, setActiveCategory] = useState('face');
  const [activeSubcategory, setActiveSubcategory] = useState('skinTone');
  const [isRotating, setIsRotating] = useState(false);

  const updateConfig = useCallback((key: keyof GameAvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const isUnlocked = useCallback((optionId: string, requiredLevel: number) => {
    return userLevel >= requiredLevel || unlockedItems.includes(optionId);
  }, [userLevel, unlockedItems]);

  const handleReset = () => {
    setConfig(defaultConfig);
  };

  const handleRandomize = () => {
    const randomConfig: Partial<GameAvatarConfig> = {};
    
    Object.entries(customizationOptions).forEach(([key, options]) => {
      const unlockedOptions = options.filter(opt => isUnlocked(opt.id, opt.level));
      if (unlockedOptions.length > 0) {
        const randomOption = unlockedOptions[Math.floor(Math.random() * unlockedOptions.length)];
        (randomConfig as any)[key] = randomOption.id;
      }
    });

    setConfig(prev => ({ ...prev, ...randomConfig }));
  };

  const handleSave = () => {
    onSave(config);
  };

  const currentCategory = categories.find(c => c.id === activeCategory);

  const renderOptionButton = (
    option: { id: string; label: string; level: number; rarity: string; emoji?: string; color?: string },
    configKey: keyof GameAvatarConfig
  ) => {
    const unlocked = isUnlocked(option.id, option.level);
    const selected = config[configKey] === option.id;
    const rarity = rarityColors[option.rarity];

    return (
      <motion.button
        key={option.id}
        onClick={() => unlocked && updateConfig(configKey, option.id)}
        disabled={!unlocked}
        className={cn(
          'relative p-3 rounded-xl border-2 transition-all text-sm font-medium min-h-[70px]',
          'flex flex-col items-center justify-center gap-1',
          selected
            ? `border-primary bg-primary/20 ${rarity.text} ring-2 ring-primary/50`
            : unlocked
            ? `${rarity.border} ${rarity.bg} hover:border-primary/50`
            : 'border-border/30 bg-muted/20 opacity-50 cursor-not-allowed'
        )}
        whileHover={unlocked ? { scale: 1.05 } : undefined}
        whileTap={unlocked ? { scale: 0.95 } : undefined}
      >
        {/* Color preview or emoji */}
        {option.color ? (
          <div
            className="w-8 h-8 rounded-full border-2 border-white/30 shadow-inner"
            style={{ backgroundColor: option.color }}
          />
        ) : option.emoji ? (
          <span className="text-2xl">{option.emoji}</span>
        ) : (
          configKey === 'skinTone' && skinColors[option.id] ? (
            <div
              className="w-8 h-8 rounded-full border-2 border-white/30"
              style={{ backgroundColor: skinColors[option.id] }}
            />
          ) : null
        )}
        
        <span className="text-xs truncate max-w-full">{option.label}</span>
        
        {/* Selected indicator */}
        {selected && (
          <motion.div
            className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
          >
            <Check className="w-3 h-3 text-primary-foreground" />
          </motion.div>
        )}
        
        {/* Locked overlay */}
        {!unlocked && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl backdrop-blur-sm">
            <div className="text-center">
              <Lock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
              <span className="text-[10px] text-muted-foreground">Lv.{option.level}</span>
            </div>
          </div>
        )}

        {/* Rarity indicator */}
        {option.rarity !== 'common' && unlocked && (
          <div className={cn(
            'absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] uppercase font-bold',
            rarity.bg, rarity.text
          )}>
            {option.rarity}
          </div>
        )}
      </motion.button>
    );
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 p-4 bg-gradient-to-br from-background via-background to-primary/5">
      {/* Left Panel - Category Selection */}
      <div className="lg:w-20 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          
          return (
            <motion.button
              key={category.id}
              onClick={() => {
                setActiveCategory(category.id);
                setActiveSubcategory(category.subcategories[0]);
              }}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-xl transition-all min-w-[70px]',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-card/50 hover:bg-card text-muted-foreground hover:text-foreground'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-medium">{category.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Center - Avatar Preview */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] lg:min-h-0">
        <div className="relative">
          {/* Glow effect */}
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-150" />
          
          {/* Avatar */}
          <motion.div
            className="relative"
            animate={isRotating ? { rotateY: 360 } : undefined}
            transition={{ duration: 1, ease: "easeInOut" }}
            onAnimationComplete={() => setIsRotating(false)}
          >
            <GameAvatarRenderer
              config={config}
              size="full"
              className="w-48 h-64 lg:w-64 lg:h-80"
              animate={true}
              showGlow={true}
              showPlatform={true}
            />
          </motion.div>

          {/* Floating XP/Level indicators */}
          <motion.div
            className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Badge className="bg-primary/80 text-primary-foreground gap-1">
              <Star className="w-3 h-3" />
              Level {userLevel}
            </Badge>
          </motion.div>

          <motion.div
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2"
            animate={{ y: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
          >
            <Badge variant="outline" className="gap-1 bg-background/80">
              <Brain className="w-3 h-3 text-purple-400" />
              {userXP.toLocaleString()} XP
            </Badge>
          </motion.div>

          {/* Floating educational elements */}
          <motion.div
            className="absolute top-4 -left-8"
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          >
            <Trophy className="w-6 h-6 text-yellow-400" />
          </motion.div>
          
          <motion.div
            className="absolute top-4 -right-8"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className="w-6 h-6 text-purple-400" />
          </motion.div>
        </div>

        {/* Action buttons under avatar */}
        <div className="flex gap-2 mt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRotating(true)}
            className="gap-1"
          >
            <RotateCcw className="w-4 h-4" />
            Spin
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRandomize}
            className="gap-1"
          >
            <Sparkles className="w-4 h-4" />
            Random
          </Button>
        </div>
      </div>

      {/* Right Panel - Options */}
      <Card className="lg:w-80 xl:w-96 flex flex-col glass border-border/30">
        {/* Subcategory tabs */}
        {currentCategory && currentCategory.subcategories.length > 1 && (
          <div className="p-3 border-b border-border/30">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {currentCategory.subcategories.map((sub) => (
                <Button
                  key={sub}
                  variant={activeSubcategory === sub ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveSubcategory(sub)}
                  className="text-xs whitespace-nowrap"
                >
                  {sub.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Options grid */}
        <ScrollArea className="flex-1 p-4">
          <div className="grid grid-cols-3 gap-2">
            <AnimatePresence mode="wait">
              {customizationOptions[activeSubcategory as keyof typeof customizationOptions]?.map((option) => (
                <motion.div
                  key={option.id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                >
                  {renderOptionButton(option, activeSubcategory as keyof GameAvatarConfig)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </ScrollArea>

        {/* Save/Reset buttons */}
        <div className="p-4 border-t border-border/30 flex gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1 gap-2">
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-2 bg-gradient-to-r from-primary to-accent">
            <Save className="w-4 h-4" />
            Save Avatar
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GameAvatarEditor;
