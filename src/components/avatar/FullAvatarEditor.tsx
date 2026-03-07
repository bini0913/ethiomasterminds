import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  User, Palette, Shirt, Sparkles, Crown, Check, RotateCcw, Save, Lock,
  Eye, Scissors, CircleDot, SmilePlus, Glasses, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  FullAvatarConfig, DEFAULT_AVATAR_CONFIG, AvatarSVG,
  SKIN_TONES, FACE_SHAPES, HAIR_STYLES, HAIR_COLORS, EYE_TYPES, EYE_COLORS,
  EYEBROW_TYPES, NOSE_TYPES, MOUTH_TYPES, FACIAL_HAIR_TYPES, ACCESSORIES,
  OUTFITS, OUTFIT_COLORS, BACKGROUNDS,
} from './SVGAvatarParts';

interface FullAvatarEditorProps {
  initialConfig?: Partial<FullAvatarConfig>;
  userLevel?: number;
  onSave: (config: FullAvatarConfig) => void;
  onCancel?: () => void;
}

type CategoryId = 'skin' | 'face' | 'hair' | 'eyes' | 'brows' | 'nose' | 'mouth' | 'facial' | 'accessory' | 'outfit' | 'background';

const categories: { id: CategoryId; label: string; icon: React.ElementType }[] = [
  { id: 'skin', label: 'Skin', icon: User },
  { id: 'face', label: 'Face', icon: CircleDot },
  { id: 'hair', label: 'Hair', icon: Scissors },
  { id: 'eyes', label: 'Eyes', icon: Eye },
  { id: 'brows', label: 'Brows', icon: CircleDot },
  { id: 'nose', label: 'Nose', icon: CircleDot },
  { id: 'mouth', label: 'Mouth', icon: SmilePlus },
  { id: 'facial', label: 'Facial', icon: User },
  { id: 'accessory', label: 'Gear', icon: Glasses },
  { id: 'outfit', label: 'Outfit', icon: Shirt },
  { id: 'background', label: 'BG', icon: Palette },
];

// Horizontal scrollable option selector
const OptionSlider: React.FC<{
  items: { id: string; label: string; color?: string; emoji?: string; gradient?: string[]; level?: number }[];
  selected: string;
  onSelect: (id: string) => void;
  userLevel: number;
  type: 'color' | 'label' | 'gradient';
}> = ({ items, selected, onSelect, userLevel, type }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir * 160, behavior: 'smooth' });
  };

  return (
    <div className="relative group">
      <button
        onClick={() => scroll(-1)}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <div
        ref={scrollRef}
        className="flex gap-2.5 overflow-x-auto pb-2 px-1 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item) => {
          const locked = item.level ? userLevel < item.level : false;
          const isSelected = selected === item.id;

          return (
            <motion.button
              key={item.id}
              onClick={() => !locked && onSelect(item.id)}
              disabled={locked}
              className={cn(
                'relative flex flex-col items-center justify-center gap-1.5 shrink-0 rounded-2xl border-2 transition-all',
                type === 'color' ? 'w-16 h-16' : 'w-20 h-20',
                isSelected
                  ? 'border-primary bg-primary/15 shadow-lg shadow-primary/20 scale-105'
                  : locked
                  ? 'border-border/30 opacity-40 cursor-not-allowed'
                  : 'border-border/60 hover:border-primary/40 hover:bg-accent/30'
              )}
              whileHover={!locked ? { y: -2 } : undefined}
              whileTap={!locked ? { scale: 0.93 } : undefined}
            >
              {type === 'color' && item.color && (
                <div
                  className="w-9 h-9 rounded-full shadow-inner"
                  style={{
                    backgroundColor: item.color,
                    boxShadow: `inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)`,
                  }}
                />
              )}
              {type === 'gradient' && item.gradient && (
                <div
                  className="w-10 h-10 rounded-full shadow-inner"
                  style={{
                    background: `linear-gradient(135deg, ${item.gradient[0]}, ${item.gradient[1]})`,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                  }}
                />
              )}
              {type === 'label' && (
                <>
                  {item.emoji && <span className="text-xl leading-none">{item.emoji}</span>}
                  <span className="text-[10px] font-medium leading-tight text-center px-0.5">{item.label}</span>
                </>
              )}
              {type === 'color' && <span className="text-[9px] font-medium">{item.label}</span>}
              {isSelected && (
                <motion.div
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-md"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  <Check className="w-3 h-3 text-primary-foreground" />
                </motion.div>
              )}
              {locked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/85 rounded-2xl backdrop-blur-sm">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground mb-0.5" />
                  <span className="text-[8px] text-muted-foreground font-medium">Lv.{item.level}</span>
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
      <button
        onClick={() => scroll(1)}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-background/90 border border-border shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// Section header
const SectionTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4 first:mt-0">{children}</h4>
);

const FullAvatarEditor: React.FC<FullAvatarEditorProps> = ({
  initialConfig = {},
  userLevel = 1,
  onSave,
  onCancel,
}) => {
  const [config, setConfig] = useState<FullAvatarConfig>({ ...DEFAULT_AVATAR_CONFIG, ...initialConfig });
  const [activeCategory, setActiveCategory] = useState<CategoryId>('skin');

  const updateConfig = useCallback((key: keyof FullAvatarConfig, value: string) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const catScrollRef = useRef<HTMLDivElement>(null);

  const renderCategoryContent = () => {
    switch (activeCategory) {
      case 'skin':
        return (
          <>
            <SectionTitle>Skin Tone</SectionTitle>
            <OptionSlider items={SKIN_TONES} selected={config.skinTone} onSelect={v => updateConfig('skinTone', v)} userLevel={userLevel} type="color" />
          </>
        );
      case 'face':
        return (
          <>
            <SectionTitle>Face Shape</SectionTitle>
            <OptionSlider items={FACE_SHAPES} selected={config.faceShape} onSelect={v => updateConfig('faceShape', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'hair':
        return (
          <>
            <SectionTitle>Style</SectionTitle>
            <OptionSlider items={HAIR_STYLES} selected={config.hairStyle} onSelect={v => updateConfig('hairStyle', v)} userLevel={userLevel} type="label" />
            <SectionTitle>Color</SectionTitle>
            <OptionSlider items={HAIR_COLORS} selected={config.hairColor} onSelect={v => updateConfig('hairColor', v)} userLevel={userLevel} type="color" />
          </>
        );
      case 'eyes':
        return (
          <>
            <SectionTitle>Shape</SectionTitle>
            <OptionSlider items={EYE_TYPES} selected={config.eyeType} onSelect={v => updateConfig('eyeType', v)} userLevel={userLevel} type="label" />
            <SectionTitle>Color</SectionTitle>
            <OptionSlider items={EYE_COLORS} selected={config.eyeColor} onSelect={v => updateConfig('eyeColor', v)} userLevel={userLevel} type="color" />
          </>
        );
      case 'brows':
        return (
          <>
            <SectionTitle>Eyebrow Style</SectionTitle>
            <OptionSlider items={EYEBROW_TYPES} selected={config.eyebrowType} onSelect={v => updateConfig('eyebrowType', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'nose':
        return (
          <>
            <SectionTitle>Nose Shape</SectionTitle>
            <OptionSlider items={NOSE_TYPES} selected={config.noseType} onSelect={v => updateConfig('noseType', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'mouth':
        return (
          <>
            <SectionTitle>Mouth Style</SectionTitle>
            <OptionSlider items={MOUTH_TYPES} selected={config.mouthType} onSelect={v => updateConfig('mouthType', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'facial':
        return (
          <>
            <SectionTitle>Facial Hair</SectionTitle>
            <OptionSlider items={FACIAL_HAIR_TYPES} selected={config.facialHair} onSelect={v => updateConfig('facialHair', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'accessory':
        return (
          <>
            <SectionTitle>Accessories</SectionTitle>
            <OptionSlider items={ACCESSORIES} selected={config.accessory} onSelect={v => updateConfig('accessory', v)} userLevel={userLevel} type="label" />
          </>
        );
      case 'outfit':
        return (
          <>
            <SectionTitle>Style</SectionTitle>
            <OptionSlider items={OUTFITS} selected={config.outfit} onSelect={v => updateConfig('outfit', v)} userLevel={userLevel} type="label" />
            <SectionTitle>Color</SectionTitle>
            <OptionSlider items={OUTFIT_COLORS} selected={config.outfitColor} onSelect={v => updateConfig('outfitColor', v)} userLevel={userLevel} type="color" />
          </>
        );
      case 'background':
        return (
          <>
            <SectionTitle>Background</SectionTitle>
            <OptionSlider items={BACKGROUNDS} selected={config.background} onSelect={v => updateConfig('background', v)} userLevel={userLevel} type="gradient" />
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
      {/* Avatar Preview - Large */}
      <div className="flex flex-col items-center py-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-3xl scale-150 -z-10" />
          <motion.div
            className="relative"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.15))',
            }}
          >
            <AvatarSVG config={config} size={180} />
          </motion.div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          <Badge className="bg-gradient-to-r from-primary to-accent text-white border-0 shadow-md">
            <Sparkles className="w-3 h-3 mr-1" />
            Level {userLevel}
          </Badge>
        </div>
      </div>

      {/* Category Navigation - Horizontal Scrolling Tabs */}
      <div className="relative border-b border-border/30">
        <div
          ref={catScrollRef}
          className="flex gap-1 overflow-x-auto pb-2 px-1 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all whitespace-nowrap shrink-0',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
                whileTap={{ scale: 0.95 }}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">{cat.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Options Panel */}
      <div className="min-h-[200px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="px-1"
          >
            {renderCategoryContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2 border-t border-border/30">
        <Button
          variant="outline"
          onClick={() => setConfig(DEFAULT_AVATAR_CONFIG)}
          className="flex-1 gap-2 rounded-xl h-11"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} className="rounded-xl h-11">
            Cancel
          </Button>
        )}
        <Button
          onClick={() => onSave(config)}
          className="flex-1 gap-2 rounded-xl h-11 bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        >
          <Save className="w-4 h-4" />
          Save Avatar
        </Button>
      </div>
    </div>
  );
};

export default FullAvatarEditor;
