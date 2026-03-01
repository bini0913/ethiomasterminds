import React from 'react';
import { cn } from '@/lib/utils';
import { AvatarConfig } from '@/context/UserContext';

interface AvatarRendererProps {
  avatar?: string;
  avatarConfig?: AvatarConfig | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

const avatarToEmoji = (avatarId: string): string => {
  const map: { [key: string]: string } = {
    'avatar-1': '👦',
    'avatar-2': '👧',
    'avatar-3': '🧑',
    'avatar-4': '👩‍🎓',
    'avatar-5': '🧠',
    'avatar-6': '🦸',
  };
  return map[avatarId] || '👤';
};

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

const expressionEmojis: Record<string, string> = {
  smile: '😊',
  happy: '😊',
  focused: '🧐',
  cool: '😎',
  determined: '😤',
  genius: '🧠',
};

const bgClassFor = (background?: string) => {
  if (background === 'library') return 'from-amber-100 to-orange-300';
  if (background === 'galaxy') return 'from-purple-500 to-indigo-800';
  if (background === 'ocean') return 'from-cyan-400 to-blue-600';
  return 'from-sky-200 to-blue-400';
};

const AvatarRenderer: React.FC<AvatarRendererProps> = ({ avatar, avatarConfig, size = 'md', className, showBorder = true }) => {
  const sizeClass = sizeClasses[size];

  if (avatarConfig && typeof avatarConfig === 'object' && Object.keys(avatarConfig).length > 0) {
    const skinTone = avatarConfig.skinTone || '#D4A574';
    const expression = expressionEmojis[avatarConfig.mouth || avatarConfig.expression || 'smile'] || '😊';
    const hairColor = avatarConfig.hairColor || '#2B1D0E';

    return (
      <div
        className={cn(
          'rounded-full relative overflow-hidden bg-gradient-to-br flex items-center justify-center',
          sizeClass,
          bgClassFor(avatarConfig.background),
          showBorder && 'ring-2 ring-background shadow-md',
          className
        )}
      >
        {avatarConfig.aura && avatarConfig.aura !== 'none' && <div className="absolute inset-0 animate-pulse bg-primary/20" />}
        <div className="absolute inset-[20%] rounded-full" style={{ backgroundColor: skinTone }} />
        <div className="absolute top-[18%] left-[24%] right-[24%] h-[22%] rounded-t-full" style={{ backgroundColor: hairColor }} />
        <span className="relative z-10 text-[55%]">{expression}</span>
        {avatarConfig.glasses && avatarConfig.glasses !== 'none' && <span className="absolute z-20 text-[35%]">👓</span>}
        {avatarConfig.accessories === 'backpack' && <span className="absolute -right-1 bottom-0 text-[35%]">🎒</span>}
        {avatarConfig.clothes === 'golden-hoodie' && <span className="absolute bottom-0 text-[30%]">✨</span>}
        {avatarConfig.clothes === 'education-cape' && <span className="absolute -left-1 bottom-0 text-[35%]">🎓</span>}
      </div>
    );
  }

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
      <span className="text-[55%]">{emoji}</span>
    </div>
  );
};

export default AvatarRenderer;
export { avatarToEmoji };
