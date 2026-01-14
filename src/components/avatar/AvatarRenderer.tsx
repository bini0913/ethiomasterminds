import React from 'react';
import { cn } from '@/lib/utils';
import { AvatarConfig } from '@/context/UserContext';

interface AvatarRendererProps {
  avatar?: string; // Simple avatar ID like 'avatar-1'
  avatarConfig?: AvatarConfig | null; // Complex avatar config
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

// Map simple avatar IDs to emojis
const avatarToEmoji = (avatarId: string): string => {
  const map: {[key: string]: string} = {
    "avatar-1": "👦",
    "avatar-2": "👧",
    "avatar-3": "🧑",
    "avatar-4": "👩‍🎓",
    "avatar-5": "🧠",
    "avatar-6": "🦸",
  };
  return map[avatarId] || "👤";
};

// Size configurations
const sizeClasses = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-sm',
  md: 'w-12 h-12 text-xl',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl'
};

// Background colors
const backgroundColors: Record<string, string> = {
  sky: 'bg-gradient-to-br from-sky-400 to-blue-500',
  sunset: 'bg-gradient-to-br from-orange-400 to-pink-500',
  forest: 'bg-gradient-to-br from-green-400 to-emerald-600',
  ocean: 'bg-gradient-to-br from-cyan-400 to-blue-600',
  galaxy: 'bg-gradient-to-br from-purple-500 to-indigo-700',
  fire: 'bg-gradient-to-br from-red-500 to-orange-500',
  mint: 'bg-gradient-to-br from-green-300 to-teal-400',
  rose: 'bg-gradient-to-br from-pink-400 to-rose-500'
};

// Expression emojis
const expressionEmojis: Record<string, string> = {
  happy: '😊',
  cool: '😎',
  excited: '🤩',
  thinking: '🤔',
  wink: '😉',
  confident: '😏',
  surprised: '😲',
  determined: '😤'
};

// Hairstyle emojis
const hairstyleEmojis: Record<string, string> = {
  short: '👦',
  long: '👧',
  spiky: '🧑',
  curly: '👩‍🦱',
  mohawk: '🧑‍🎤',
  bald: '👨‍🦲',
  ponytail: '👩',
  braids: '👩‍🦱'
};

// Accessory emojis
const accessoryEmojis: Record<string, string> = {
  none: '',
  glasses: '👓',
  sunglasses: '🕶️',
  headphones: '🎧',
  cap: '🧢',
  crown: '👑',
  mask: '😷',
  earrings: '💎'
};

const AvatarRenderer: React.FC<AvatarRendererProps> = ({
  avatar,
  avatarConfig,
  size = 'md',
  className,
  showBorder = true
}) => {
  const sizeClass = sizeClasses[size];

  // If we have a complex avatar config, render it
  if (avatarConfig && typeof avatarConfig === 'object' && Object.keys(avatarConfig).length > 0) {
    const bgClass = backgroundColors[avatarConfig.background || 'sky'] || backgroundColors.sky;
    const expression = expressionEmojis[avatarConfig.expression || 'happy'] || '😊';
    const accessory = accessoryEmojis[avatarConfig.accessory || 'none'] || '';

    return (
      <div
        className={cn(
          'rounded-full flex items-center justify-center relative overflow-hidden',
          sizeClass,
          bgClass,
          showBorder && 'ring-2 ring-background shadow-md',
          className
        )}
      >
        <span className="relative z-10">{expression}</span>
        {accessory && (
          <span className="absolute top-0 right-0 text-xs transform translate-x-1 -translate-y-1">
            {accessory}
          </span>
        )}
      </div>
    );
  }

  // Fallback to simple emoji avatar
  const emoji = avatarToEmoji(avatar || 'avatar-1');

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20',
        sizeClass,
        showBorder && 'ring-2 ring-background shadow-md',
        className
      )}
    >
      <span>{emoji}</span>
    </div>
  );
};

export default AvatarRenderer;

// Export the utility function for backward compatibility
export { avatarToEmoji };
