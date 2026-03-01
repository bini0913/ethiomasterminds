import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { 
  User, Palette, Shirt, Sparkles, Crown, Check, RotateCcw, Save, Lock,
  Eye, Scissors, CircleDot, SmilePlus, Glasses
} from 'lucide-react';
import {
  FullAvatarConfig, DEFAULT_AVATAR_CONFIG, AvatarSVG,
  SKIN_TONES, HAIR_STYLES, HAIR_COLORS, EYE_TYPES, EYE_COLORS,
  EYEBROW_TYPES, NOSE_TYPES, MOUTH_TYPES, ACCESSORIES, OUTFITS,
  OUTFIT_COLORS, BACKGROUNDS,
} from './SVGAvatarParts';

interface FullAvatarEditorProps {
  initialConfig?: Partial<FullAvatarConfig>;
  userLevel?: number;
  onSave: (config: FullAvatarConfig) => void;
  onCancel?: () => void;
}

const categories = [
  { id: 'skin', label: 'Skin', icon: User },
  { id: 'hair', label: 'Hair', icon: Scissors },
  { id: 'eyes', label: 'Eyes', icon: Eye },
  { id: 'eyebrows', label: 'Brows', icon: CircleDot },
  { id: 'nose', label: 'Nose', icon: CircleDot },
  { id: 'mouth', label: 'Mouth', icon: SmilePlus },
  { id: 'accessory', label: 'Gear', icon: Glasses },
  { id: 'outfit', label: 'Outfit', icon: Shirt },
  { id: 'background', label: 'BG', icon: Palette },
];

const FullAvatarEditor: React.FC<FullAvatarEditorProps> = ({
  initialConfig = {},
  userLevel = 1,
  onSave,
  onCancel,
}) => {
  const [config, setConfig] = useState<FullAvatarConfig>({ ...DEFAULT_AVATAR_CONFIG, ...initialConfig });
  const [activeCategory, setActiveCategory] = useState('skin');

  const isLocked = (level?: number) => level ? userLevel < level : false;

  const updateConfig = (key: keyof FullAvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const renderColorOption = (
    item: { id: string; color?: string; label: string; level?: number },
    configKey: keyof FullAvatarConfig,
  ) => {
    const isSelected = config[configKey] === item.id;
    const locked = isLocked(item.level);
    return (
      <motion.button
        key={item.id}
        onClick={() => !locked && updateConfig(configKey, item.id)}
        disabled={locked}
        className={cn(
          'relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all',
          isSelected ? 'border-primary bg-primary/20 ring-2 ring-primary/50' :
          locked ? 'border-border/30 opacity-40 cursor-not-allowed' :
          'border-border hover:border-primary/50'
        )}
        whileHover={!locked ? { scale: 1.08 } : undefined}
        whileTap={!locked ? { scale: 0.92 } : undefined}
      >
        <div className="w-8 h-8 rounded-full border-2 border-white/50 shadow-inner" style={{ backgroundColor: item.color }} />
        <span className="text-[10px] font-medium">{item.label}</span>
        {isSelected && <motion.div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-2.5 h-2.5 text-primary-foreground" /></motion.div>}
        {locked && <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl backdrop-blur-sm"><Lock className="w-3 h-3 text-muted-foreground" /><span className="text-[8px] ml-0.5">Lv.{item.level}</span></div>}
      </motion.button>
    );
  };

  const renderLabelOption = (
    item: { id: string; label: string; emoji?: string; level?: number },
    configKey: keyof FullAvatarConfig,
  ) => {
    const isSelected = config[configKey] === item.id;
    const locked = isLocked(item.level);
    return (
      <motion.button
        key={item.id}
        onClick={() => !locked && updateConfig(configKey, item.id)}
        disabled={locked}
        className={cn(
          'relative flex flex-col items-center justify-center gap-1 p-3 rounded-xl border-2 transition-all min-h-[64px]',
          isSelected ? 'border-primary bg-primary/20 ring-2 ring-primary/50' :
          locked ? 'border-border/30 opacity-40 cursor-not-allowed' :
          'border-border hover:border-primary/50'
        )}
        whileHover={!locked ? { scale: 1.08 } : undefined}
        whileTap={!locked ? { scale: 0.92 } : undefined}
      >
        {item.emoji && <span className="text-xl">{item.emoji}</span>}
        <span className="text-[10px] font-medium">{item.label}</span>
        {isSelected && <motion.div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-2.5 h-2.5 text-primary-foreground" /></motion.div>}
        {locked && <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl backdrop-blur-sm"><Lock className="w-3 h-3 text-muted-foreground" /><span className="text-[8px] ml-0.5">Lv.{item.level}</span></div>}
      </motion.button>
    );
  };

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'skin':
        return <div className="grid grid-cols-4 gap-2">{SKIN_TONES.map(s => renderColorOption(s, 'skinTone'))}</div>;
      case 'hair':
        return (
          <div className="space-y-4">
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Style</h4><div className="grid grid-cols-3 gap-2">{HAIR_STYLES.map(h => renderLabelOption(h, 'hairStyle'))}</div></div>
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Color</h4><div className="grid grid-cols-5 gap-2">{HAIR_COLORS.map(h => renderColorOption(h, 'hairColor'))}</div></div>
          </div>
        );
      case 'eyes':
        return (
          <div className="space-y-4">
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Shape</h4><div className="grid grid-cols-3 gap-2">{EYE_TYPES.map(e => renderLabelOption(e, 'eyeType'))}</div></div>
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Color</h4><div className="grid grid-cols-4 gap-2">{EYE_COLORS.map(e => renderColorOption(e, 'eyeColor'))}</div></div>
          </div>
        );
      case 'eyebrows':
        return <div className="grid grid-cols-3 gap-2">{EYEBROW_TYPES.map(b => renderLabelOption(b, 'eyebrowType'))}</div>;
      case 'nose':
        return <div className="grid grid-cols-3 gap-2">{NOSE_TYPES.map(n => renderLabelOption(n, 'noseType'))}</div>;
      case 'mouth':
        return <div className="grid grid-cols-3 gap-2">{MOUTH_TYPES.map(m => renderLabelOption(m, 'mouthType'))}</div>;
      case 'accessory':
        return <div className="grid grid-cols-3 gap-2">{ACCESSORIES.map(a => renderLabelOption(a, 'accessory'))}</div>;
      case 'outfit':
        return (
          <div className="space-y-4">
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Style</h4><div className="grid grid-cols-3 gap-2">{OUTFITS.map(o => renderLabelOption(o, 'outfit'))}</div></div>
            <div><h4 className="text-xs font-semibold mb-2 text-muted-foreground uppercase">Color</h4><div className="grid grid-cols-5 gap-2">{OUTFIT_COLORS.map(c => renderColorOption(c, 'outfitColor'))}</div></div>
          </div>
        );
      case 'background':
        return <div className="grid grid-cols-3 gap-2">{BACKGROUNDS.map(b => {
          const isSelected = config.background === b.id;
          const locked = isLocked(b.level);
          return (
            <motion.button
              key={b.id}
              onClick={() => !locked && updateConfig('background', b.id)}
              disabled={locked}
              className={cn(
                'relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all',
                isSelected ? 'border-primary ring-2 ring-primary/50' :
                locked ? 'border-border/30 opacity-40 cursor-not-allowed' :
                'border-border hover:border-primary/50'
              )}
              whileHover={!locked ? { scale: 1.08 } : undefined}
            >
              <div className="w-10 h-10 rounded-full" style={{ background: `linear-gradient(135deg, ${b.gradient[0]}, ${b.gradient[1]})` }} />
              <span className="text-[10px] font-medium">{b.label}</span>
              {isSelected && <motion.div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center" initial={{ scale: 0 }} animate={{ scale: 1 }}><Check className="w-2.5 h-2.5 text-primary-foreground" /></motion.div>}
              {locked && <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-xl backdrop-blur-sm"><Lock className="w-3 h-3" /><span className="text-[8px] ml-0.5">Lv.{b.level}</span></div>}
            </motion.button>
          );
        })}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full">
      {/* Category sidebar - horizontal on mobile */}
      <div className="flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:w-16 shrink-0">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;
          return (
            <motion.button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'flex flex-col items-center justify-center p-2 rounded-xl transition-all min-w-[56px] lg:min-w-0',
                isActive ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-card hover:bg-accent text-muted-foreground'
              )}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[9px] font-medium">{cat.label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Preview */}
      <div className="flex flex-col items-center justify-center lg:flex-1">
        <div className="relative mb-4">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl scale-150" />
          <motion.div
            className="relative"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <AvatarSVG config={config} size={160} />
          </motion.div>
        </div>
        <Badge className="bg-gradient-to-r from-primary to-accent text-white mb-3">
          Level {userLevel}
        </Badge>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setConfig(DEFAULT_AVATAR_CONFIG)} className="gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
          <Button size="sm" onClick={() => onSave(config)} className="gap-1 bg-gradient-to-r from-primary to-accent">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      {/* Options panel */}
      <Card className="flex-1 lg:max-w-sm">
        <CardContent className="p-4">
          <h3 className="font-semibold mb-3 capitalize text-sm">{activeCategory}</h3>
          <ScrollArea className="h-[280px] lg:h-[380px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeCategory}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.15 }}
              >
                {renderCategoryContent()}
              </motion.div>
            </AnimatePresence>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default FullAvatarEditor;
