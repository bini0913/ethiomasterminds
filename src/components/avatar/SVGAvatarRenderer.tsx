import React from 'react';
import { cn } from '@/lib/utils';

export interface SVGAvatarConfig {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeStyle: string;
  eyeColor: string;
  mouthStyle: string;
  outfit: string;
  outfitColor: string;
  accessory: string;
  background: string;
  faceShape: string;
}

interface SVGAvatarRendererProps {
  config: Partial<SVGAvatarConfig>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showBorder?: boolean;
}

const skinTones: Record<string, string> = {
  light: '#FFDBB4',
  fair: '#F5D0C5',
  medium: '#D4A574',
  tan: '#C68642',
  brown: '#8D5524',
  dark: '#5C3317'
};

const hairColors: Record<string, string> = {
  black: '#1C1C1C',
  brown: '#4A3728',
  blonde: '#D4A574',
  red: '#8B4513',
  gray: '#808080',
  blue: '#4169E1',
  pink: '#FF69B4',
  purple: '#8B5CF6'
};

const eyeColors: Record<string, string> = {
  brown: '#4A3728',
  blue: '#4169E1',
  green: '#228B22',
  gray: '#696969',
  hazel: '#8B7355'
};

const outfitColors: Record<string, string> = {
  blue: '#3B82F6',
  red: '#EF4444',
  green: '#22C55E',
  purple: '#8B5CF6',
  orange: '#F97316',
  pink: '#EC4899',
  teal: '#14B8A6',
  yellow: '#EAB308'
};

const backgrounds: Record<string, string> = {
  sky: 'linear-gradient(135deg, #87CEEB 0%, #4169E1 100%)',
  sunset: 'linear-gradient(135deg, #FF6B6B 0%, #FFE66D 100%)',
  forest: 'linear-gradient(135deg, #22C55E 0%, #15803D 100%)',
  ocean: 'linear-gradient(135deg, #0EA5E9 0%, #1E3A8A 100%)',
  galaxy: 'linear-gradient(135deg, #8B5CF6 0%, #1E1B4B 100%)',
  fire: 'linear-gradient(135deg, #EF4444 0%, #F97316 100%)',
  mint: 'linear-gradient(135deg, #A7F3D0 0%, #34D399 100%)',
  rose: 'linear-gradient(135deg, #FBC2EB 0%, #EC4899 100%)'
};

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24'
};

const SVGAvatarRenderer: React.FC<SVGAvatarRendererProps> = ({
  config,
  size = 'md',
  className,
  showBorder = true
}) => {
  const skin = skinTones[config.skinTone || 'medium'] || skinTones.medium;
  const hair = hairColors[config.hairColor || 'brown'] || hairColors.brown;
  const eyes = eyeColors[config.eyeColor || 'brown'] || eyeColors.brown;
  const outfit = outfitColors[config.outfitColor || 'blue'] || outfitColors.blue;
  const bg = backgrounds[config.background || 'sky'] || backgrounds.sky;

  const renderHair = () => {
    switch (config.hairStyle) {
      case 'short':
        return (
          <path
            d="M25 15 C25 8, 35 5, 50 5 C65 5, 75 8, 75 15 C75 20, 70 22, 65 20 C55 18, 45 18, 35 20 C30 22, 25 20, 25 15"
            fill={hair}
          />
        );
      case 'long':
        return (
          <>
            <path
              d="M20 20 C20 8, 35 0, 50 0 C65 0, 80 8, 80 20 C80 35, 75 50, 75 65 C75 70, 70 72, 68 68 C65 60, 65 45, 65 35 C65 30, 50 28, 50 28 C50 28, 35 30, 35 35 C35 45, 35 60, 32 68 C30 72, 25 70, 25 65 C25 50, 20 35, 20 20"
              fill={hair}
            />
          </>
        );
      case 'spiky':
        return (
          <g fill={hair}>
            <path d="M30 20 L25 5 L35 15 Z" />
            <path d="M40 18 L38 0 L45 12 Z" />
            <path d="M50 16 L50 -2 L55 12 Z" />
            <path d="M60 18 L62 0 L65 15 Z" />
            <path d="M70 20 L75 5 L72 18 Z" />
            <ellipse cx="50" cy="18" rx="22" ry="8" />
          </g>
        );
      case 'curly':
        return (
          <g fill={hair}>
            <circle cx="30" cy="18" r="8" />
            <circle cx="40" cy="12" r="8" />
            <circle cx="50" cy="10" r="8" />
            <circle cx="60" cy="12" r="8" />
            <circle cx="70" cy="18" r="8" />
            <circle cx="25" cy="28" r="6" />
            <circle cx="75" cy="28" r="6" />
          </g>
        );
      case 'mohawk':
        return (
          <g fill={hair}>
            <path d="M42 25 L45 0 L50 25 L55 0 L58 25 Z" />
            <ellipse cx="50" cy="25" rx="10" ry="5" />
          </g>
        );
      case 'bald':
        return null;
      case 'ponytail':
        return (
          <>
            <path
              d="M25 15 C25 8, 35 5, 50 5 C65 5, 75 8, 75 15 C75 22, 70 25, 60 23 C50 21, 40 21, 30 23 C25 25, 25 22, 25 15"
              fill={hair}
            />
            <path
              d="M70 20 C75 22, 80 25, 82 35 C84 50, 78 65, 75 75 C73 80, 70 82, 68 78 C65 70, 68 55, 70 40 C71 30, 70 25, 70 20"
              fill={hair}
            />
          </>
        );
      case 'braids':
        return (
          <>
            <path
              d="M25 15 C25 8, 35 5, 50 5 C65 5, 75 8, 75 15 C75 22, 70 25, 60 23 C50 21, 40 21, 30 23 C25 25, 25 22, 25 15"
              fill={hair}
            />
            <path d="M22 25 Q18 35, 20 45 Q22 55, 18 65 Q16 75, 20 80" stroke={hair} strokeWidth="6" fill="none" />
            <path d="M78 25 Q82 35, 80 45 Q78 55, 82 65 Q84 75, 80 80" stroke={hair} strokeWidth="6" fill="none" />
          </>
        );
      default:
        return (
          <path
            d="M25 15 C25 8, 35 5, 50 5 C65 5, 75 8, 75 15 C75 20, 70 22, 65 20 C55 18, 45 18, 35 20 C30 22, 25 20, 25 15"
            fill={hair}
          />
        );
    }
  };

  const renderEyes = () => {
    switch (config.eyeStyle) {
      case 'round':
        return (
          <g>
            <circle cx="38" cy="42" r="5" fill="white" />
            <circle cx="62" cy="42" r="5" fill="white" />
            <circle cx="38" cy="42" r="3" fill={eyes} />
            <circle cx="62" cy="42" r="3" fill={eyes} />
            <circle cx="39" cy="41" r="1" fill="white" />
            <circle cx="63" cy="41" r="1" fill="white" />
          </g>
        );
      case 'almond':
        return (
          <g>
            <ellipse cx="38" cy="42" rx="6" ry="4" fill="white" />
            <ellipse cx="62" cy="42" rx="6" ry="4" fill="white" />
            <circle cx="38" cy="42" r="2.5" fill={eyes} />
            <circle cx="62" cy="42" r="2.5" fill={eyes} />
          </g>
        );
      case 'sleepy':
        return (
          <g>
            <path d="M32 42 Q38 40, 44 42" stroke={eyes} strokeWidth="2" fill="none" />
            <path d="M56 42 Q62 40, 68 42" stroke={eyes} strokeWidth="2" fill="none" />
          </g>
        );
      case 'wink':
        return (
          <g>
            <circle cx="38" cy="42" r="5" fill="white" />
            <circle cx="38" cy="42" r="3" fill={eyes} />
            <path d="M56 42 Q62 40, 68 42" stroke={eyes} strokeWidth="2" fill="none" />
          </g>
        );
      case 'surprised':
        return (
          <g>
            <circle cx="38" cy="42" r="7" fill="white" />
            <circle cx="62" cy="42" r="7" fill="white" />
            <circle cx="38" cy="42" r="4" fill={eyes} />
            <circle cx="62" cy="42" r="4" fill={eyes} />
            <circle cx="39" cy="40" r="2" fill="white" />
            <circle cx="63" cy="40" r="2" fill="white" />
          </g>
        );
      default:
        return (
          <g>
            <circle cx="38" cy="42" r="5" fill="white" />
            <circle cx="62" cy="42" r="5" fill="white" />
            <circle cx="38" cy="42" r="3" fill={eyes} />
            <circle cx="62" cy="42" r="3" fill={eyes} />
          </g>
        );
    }
  };

  const renderMouth = () => {
    switch (config.mouthStyle) {
      case 'smile':
        return <path d="M40 58 Q50 65, 60 58" stroke="#333" strokeWidth="2" fill="none" />;
      case 'grin':
        return (
          <g>
            <path d="M38 55 Q50 68, 62 55" stroke="#333" strokeWidth="2" fill="#FFF" />
            <path d="M40 58 L60 58" stroke="#333" strokeWidth="1" />
          </g>
        );
      case 'neutral':
        return <line x1="42" y1="58" x2="58" y2="58" stroke="#333" strokeWidth="2" />;
      case 'open':
        return <ellipse cx="50" cy="58" rx="6" ry="4" fill="#333" />;
      case 'smirk':
        return <path d="M42 58 Q55 62, 60 55" stroke="#333" strokeWidth="2" fill="none" />;
      default:
        return <path d="M40 58 Q50 65, 60 58" stroke="#333" strokeWidth="2" fill="none" />;
    }
  };

  const renderAccessory = () => {
    switch (config.accessory) {
      case 'glasses':
        return (
          <g stroke="#333" strokeWidth="2" fill="none">
            <circle cx="38" cy="42" r="8" />
            <circle cx="62" cy="42" r="8" />
            <line x1="46" y1="42" x2="54" y2="42" />
            <line x1="30" y1="40" x2="25" y2="38" />
            <line x1="70" y1="40" x2="75" y2="38" />
          </g>
        );
      case 'sunglasses':
        return (
          <g>
            <rect x="28" y="36" width="18" height="12" rx="2" fill="#1C1C1C" />
            <rect x="54" y="36" width="18" height="12" rx="2" fill="#1C1C1C" />
            <line x1="46" y1="42" x2="54" y2="42" stroke="#1C1C1C" strokeWidth="2" />
            <line x1="28" y1="40" x2="22" y2="38" stroke="#1C1C1C" strokeWidth="2" />
            <line x1="72" y1="40" x2="78" y2="38" stroke="#1C1C1C" strokeWidth="2" />
          </g>
        );
      case 'headphones':
        return (
          <g>
            <path d="M20 45 C15 25, 35 10, 50 10 C65 10, 85 25, 80 45" stroke="#333" strokeWidth="4" fill="none" />
            <ellipse cx="20" cy="48" rx="6" ry="8" fill="#333" />
            <ellipse cx="80" cy="48" rx="6" ry="8" fill="#333" />
          </g>
        );
      case 'cap':
        return (
          <g>
            <ellipse cx="50" cy="15" rx="30" ry="10" fill={outfit} />
            <path d="M20 15 C20 5, 35 0, 50 0 C65 0, 80 5, 80 15" fill={outfit} />
            <rect x="75" y="12" width="15" height="6" rx="2" fill={outfit} />
          </g>
        );
      case 'crown':
        return (
          <g fill="#FFD700">
            <path d="M30 15 L35 5 L40 12 L45 0 L50 12 L55 0 L60 12 L65 5 L70 15 L68 20 L32 20 Z" />
            <circle cx="35" cy="8" r="2" fill="#E11D48" />
            <circle cx="50" cy="5" r="2" fill="#3B82F6" />
            <circle cx="65" cy="8" r="2" fill="#22C55E" />
          </g>
        );
      case 'earrings':
        return (
          <g>
            <circle cx="22" cy="50" r="3" fill="#FFD700" />
            <circle cx="78" cy="50" r="3" fill="#FFD700" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderOutfit = () => {
    switch (config.outfit) {
      case 'tshirt':
        return (
          <path
            d="M30 75 L30 100 L70 100 L70 75 C70 72, 65 70, 60 70 L55 70 C55 73, 50 76, 50 76 C50 76, 45 73, 45 70 L40 70 C35 70, 30 72, 30 75"
            fill={outfit}
          />
        );
      case 'hoodie':
        return (
          <g>
            <path
              d="M25 75 L25 100 L75 100 L75 75 C75 70, 70 68, 65 68 L60 68 C60 72, 55 75, 50 78 C45 75, 40 72, 40 68 L35 68 C30 68, 25 70, 25 75"
              fill={outfit}
            />
            <ellipse cx="50" cy="72" rx="12" ry="8" fill={outfit} stroke="#00000020" strokeWidth="1" />
          </g>
        );
      case 'suit':
        return (
          <g>
            <path d="M28 75 L28 100 L72 100 L72 75 C72 70, 67 68, 62 68 L55 68 L50 80 L45 68 L38 68 C33 68, 28 70, 28 75" fill="#1C1C1C" />
            <path d="M45 68 L50 80 L55 68 L52 68 L50 72 L48 68 Z" fill="white" />
            <circle cx="50" cy="85" r="2" fill="#E11D48" />
          </g>
        );
      case 'dress':
        return (
          <path
            d="M35 68 L35 72 L25 100 L75 100 L65 72 L65 68 C65 68, 58 70, 50 70 C42 70, 35 68, 35 68"
            fill={outfit}
          />
        );
      case 'sporty':
        return (
          <g>
            <path d="M30 75 L30 100 L70 100 L70 75 C70 72, 65 70, 60 70 L40 70 C35 70, 30 72, 30 75" fill={outfit} />
            <line x1="50" y1="70" x2="50" y2="100" stroke="white" strokeWidth="3" />
            <line x1="30" y1="85" x2="70" y2="85" stroke="white" strokeWidth="3" />
          </g>
        );
      default:
        return (
          <path
            d="M30 75 L30 100 L70 100 L70 75 C70 72, 65 70, 60 70 L40 70 C35 70, 30 72, 30 75"
            fill={outfit}
          />
        );
    }
  };

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden',
        sizeClasses[size],
        showBorder && 'ring-2 ring-background shadow-lg',
        className
      )}
      style={{ background: bg }}
    >
      <svg viewBox="0 0 100 100" className="w-full h-full">
        {/* Face */}
        <ellipse cx="50" cy="45" rx="28" ry="32" fill={skin} />
        
        {/* Ears */}
        <ellipse cx="22" cy="45" rx="5" ry="7" fill={skin} />
        <ellipse cx="78" cy="45" rx="5" ry="7" fill={skin} />
        
        {/* Neck */}
        <rect x="42" y="70" width="16" height="10" fill={skin} />
        
        {/* Outfit */}
        {renderOutfit()}
        
        {/* Hair (back layer for long hair) */}
        {config.hairStyle === 'long' && (
          <path
            d="M25 50 C25 60, 28 75, 30 85 C32 90, 25 92, 22 85 C18 75, 18 60, 20 45"
            fill={hair}
          />
        )}
        
        {/* Eyes */}
        {renderEyes()}
        
        {/* Eyebrows */}
        <path d="M32 35 Q38 33, 44 35" stroke={hair} strokeWidth="2" fill="none" />
        <path d="M56 35 Q62 33, 68 35" stroke={hair} strokeWidth="2" fill="none" />
        
        {/* Nose */}
        <path d="M50 45 L48 52 L52 52" stroke={skin} strokeWidth="2" fill="none" filter="brightness(0.9)" />
        
        {/* Mouth */}
        {renderMouth()}
        
        {/* Hair (front layer) */}
        {renderHair()}
        
        {/* Accessory */}
        {renderAccessory()}
      </svg>
    </div>
  );
};

export default SVGAvatarRenderer;
