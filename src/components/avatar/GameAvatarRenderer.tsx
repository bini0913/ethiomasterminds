import React from 'react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export interface GameAvatarConfig {
  // Base
  gender: 'male' | 'female' | 'neutral';
  bodyType: 'slim' | 'regular' | 'athletic';
  
  // Skin
  skinTone: string;
  
  // Face
  faceShape: string;
  eyeStyle: string;
  eyeColor: string;
  eyebrowStyle: string;
  noseStyle: string;
  mouthStyle: string;
  
  // Hair
  hairStyle: string;
  hairColor: string;
  
  // Outfit
  outfit: string;
  outfitColor: string;
  
  // Accessories
  glasses: string;
  headwear: string;
  earrings: string;
  necklace: string;
  backpack: string;
  
  // Expression/Emote
  expression: string;
  
  // Background
  background: string;
}

interface GameAvatarRendererProps {
  config: Partial<GameAvatarConfig>;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  animate?: boolean;
  showGlow?: boolean;
  showPlatform?: boolean;
}

// Comprehensive color palettes for inclusive representation
const skinTones: Record<string, { main: string; shadow: string; highlight: string }> = {
  porcelain: { main: '#FFE4D4', shadow: '#E8C4B8', highlight: '#FFF5EF' },
  ivory: { main: '#FFECD1', shadow: '#E8D4BA', highlight: '#FFF8ED' },
  fair: { main: '#F5D0C5', shadow: '#DEB8AC', highlight: '#FDE8E1' },
  light: { main: '#FFDBB4', shadow: '#E8C49D', highlight: '#FFEAD0' },
  medium: { main: '#D4A574', shadow: '#BC8D5C', highlight: '#E6BB8A' },
  olive: { main: '#C9A86C', shadow: '#B19054', highlight: '#DBC080' },
  tan: { main: '#C68642', shadow: '#AE6E2A', highlight: '#DA9C58' },
  caramel: { main: '#A67B5B', shadow: '#8E6343', highlight: '#BC9171' },
  brown: { main: '#8D5524', shadow: '#75430C', highlight: '#A36B3A' },
  chocolate: { main: '#6F4E37', shadow: '#57361F', highlight: '#87664D' },
  dark: { main: '#5C3317', shadow: '#441B00', highlight: '#74492D' },
  ebony: { main: '#3D2314', shadow: '#250B00', highlight: '#553B2A' },
};

const hairColors: Record<string, { main: string; shadow: string; highlight: string }> = {
  black: { main: '#1C1C1C', shadow: '#0A0A0A', highlight: '#3D3D3D' },
  darkBrown: { main: '#3D2314', shadow: '#250B00', highlight: '#553B2A' },
  brown: { main: '#6B4423', shadow: '#533015', highlight: '#835C3B' },
  auburn: { main: '#8B4513', shadow: '#733100', highlight: '#A35D2B' },
  ginger: { main: '#C04000', shadow: '#982800', highlight: '#D85818' },
  blonde: { main: '#D4A574', shadow: '#BC8D5C', highlight: '#ECB98A' },
  platinum: { main: '#E8E4E1', shadow: '#D0CCC9', highlight: '#FFFFFF' },
  gray: { main: '#808080', shadow: '#686868', highlight: '#989898' },
  white: { main: '#F5F5F5', shadow: '#DDDDDD', highlight: '#FFFFFF' },
  // Fun colors
  blue: { main: '#4169E1', shadow: '#2951C9', highlight: '#5981F9' },
  purple: { main: '#8B5CF6', shadow: '#7344DE', highlight: '#A374FF' },
  pink: { main: '#FF69B4', shadow: '#E7519C', highlight: '#FF81CC' },
  teal: { main: '#14B8A6', shadow: '#00A08E', highlight: '#2CD0BE' },
  green: { main: '#22C55E', shadow: '#0AAD46', highlight: '#3ADD76' },
  red: { main: '#EF4444', shadow: '#D72C2C', highlight: '#FF5C5C' },
};

const eyeColors: Record<string, { iris: string; pupil: string; highlight: string }> = {
  brown: { iris: '#6B4423', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  darkBrown: { iris: '#3D2314', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  hazel: { iris: '#8B7355', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  amber: { iris: '#FFBF00', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  green: { iris: '#228B22', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  blue: { iris: '#4169E1', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  gray: { iris: '#708090', pupil: '#1C1C1C', highlight: '#FFFFFF' },
  violet: { iris: '#8B5CF6', pupil: '#1C1C1C', highlight: '#FFFFFF' },
};

const outfitColors: Record<string, { main: string; shadow: string; accent: string }> = {
  blue: { main: '#3B82F6', shadow: '#2563EB', accent: '#60A5FA' },
  red: { main: '#EF4444', shadow: '#DC2626', accent: '#F87171' },
  green: { main: '#22C55E', shadow: '#16A34A', accent: '#4ADE80' },
  purple: { main: '#8B5CF6', shadow: '#7C3AED', accent: '#A78BFA' },
  orange: { main: '#F97316', shadow: '#EA580C', accent: '#FB923C' },
  pink: { main: '#EC4899', shadow: '#DB2777', accent: '#F472B6' },
  teal: { main: '#14B8A6', shadow: '#0D9488', accent: '#2DD4BF' },
  yellow: { main: '#EAB308', shadow: '#CA8A04', accent: '#FACC15' },
  navy: { main: '#1E3A5F', shadow: '#0F2A4A', accent: '#2E5A8F' },
  black: { main: '#1C1C1C', shadow: '#0A0A0A', accent: '#3D3D3D' },
  white: { main: '#FFFFFF', shadow: '#E5E5E5', accent: '#F5F5F5' },
  gray: { main: '#6B7280', shadow: '#4B5563', accent: '#9CA3AF' },
};

const backgrounds: Record<string, { gradient: string; glow: string }> = {
  sky: { gradient: 'linear-gradient(180deg, #87CEEB 0%, #4169E1 100%)', glow: '#4169E1' },
  sunset: { gradient: 'linear-gradient(180deg, #FF6B6B 0%, #FFE66D 100%)', glow: '#FF6B6B' },
  forest: { gradient: 'linear-gradient(180deg, #22C55E 0%, #15803D 100%)', glow: '#22C55E' },
  ocean: { gradient: 'linear-gradient(180deg, #0EA5E9 0%, #1E3A8A 100%)', glow: '#0EA5E9' },
  galaxy: { gradient: 'linear-gradient(180deg, #8B5CF6 0%, #1E1B4B 100%)', glow: '#8B5CF6' },
  fire: { gradient: 'linear-gradient(180deg, #EF4444 0%, #F97316 100%)', glow: '#EF4444' },
  mint: { gradient: 'linear-gradient(180deg, #A7F3D0 0%, #34D399 100%)', glow: '#34D399' },
  rose: { gradient: 'linear-gradient(180deg, #FBC2EB 0%, #EC4899 100%)', glow: '#EC4899' },
  night: { gradient: 'linear-gradient(180deg, #0F172A 0%, #1E293B 100%)', glow: '#3B82F6' },
  aurora: { gradient: 'linear-gradient(180deg, #4ADE80 0%, #8B5CF6 50%, #EC4899 100%)', glow: '#8B5CF6' },
  gold: { gradient: 'linear-gradient(180deg, #F59E0B 0%, #B45309 100%)', glow: '#F59E0B' },
  cosmic: { gradient: 'linear-gradient(180deg, #1E1B4B 0%, #312E81 50%, #4C1D95 100%)', glow: '#7C3AED' },
};

const sizeClasses: Record<string, { container: string; svg: string }> = {
  xs: { container: 'w-12 h-12', svg: '48' },
  sm: { container: 'w-16 h-16', svg: '64' },
  md: { container: 'w-24 h-24', svg: '96' },
  lg: { container: 'w-32 h-32', svg: '128' },
  xl: { container: 'w-48 h-48', svg: '192' },
  full: { container: 'w-full h-full', svg: '300' },
};

const GameAvatarRenderer: React.FC<GameAvatarRendererProps> = ({
  config,
  size = 'md',
  className,
  animate = true,
  showGlow = true,
  showPlatform = false,
}) => {
  const skin = skinTones[config.skinTone || 'medium'] || skinTones.medium;
  const hair = hairColors[config.hairColor || 'brown'] || hairColors.brown;
  const eyes = eyeColors[config.eyeColor || 'brown'] || eyeColors.brown;
  const outfitClr = outfitColors[config.outfitColor || 'blue'] || outfitColors.blue;
  const bg = backgrounds[config.background || 'sky'] || backgrounds.sky;
  const { container, svg } = sizeClasses[size];

  // Expression modifiers
  const getExpressionMouth = () => {
    switch (config.expression) {
      case 'happy': return 'M36 62 Q50 72, 64 62';
      case 'excited': return 'M38 60 Q50 75, 62 60 Q50 65, 38 60';
      case 'thinking': return 'M42 62 Q48 60, 58 64';
      case 'confident': return 'M38 62 Q50 68, 62 60';
      case 'surprised': return 'M44 60 Q50 68, 56 60 Q50 66, 44 60';
      case 'victory': return 'M34 60 Q50 75, 66 60';
      default: return 'M40 62 Q50 68, 60 62';
    }
  };

  const getExpressionEyes = () => {
    switch (config.expression) {
      case 'happy':
      case 'excited':
        return { shape: 'arc', modifier: 1 };
      case 'thinking':
        return { shape: 'narrow', modifier: 0.7 };
      case 'surprised':
        return { shape: 'wide', modifier: 1.3 };
      case 'victory':
        return { shape: 'arc', modifier: 0.8 };
      default:
        return { shape: 'normal', modifier: 1 };
    }
  };

  const renderHair = () => {
    const style = config.hairStyle || 'short';
    
    switch (style) {
      case 'short':
        return (
          <g>
            <path
              d="M24 28 C24 16, 36 8, 50 8 C64 8, 76 16, 76 28 C76 34, 72 38, 66 36 C56 34, 44 34, 34 36 C28 38, 24 34, 24 28"
              fill={hair.main}
            />
            <path
              d="M28 28 C28 20, 38 14, 50 14 C62 14, 72 20, 72 28"
              fill={hair.highlight}
              opacity="0.3"
            />
          </g>
        );
      case 'medium':
        return (
          <g>
            <path
              d="M22 28 C22 14, 35 5, 50 5 C65 5, 78 14, 78 28 C78 38, 74 45, 70 42 C62 38, 38 38, 30 42 C26 45, 22 38, 22 28"
              fill={hair.main}
            />
            <path d="M20 40 C18 50, 22 58, 24 55 C26 52, 22 45, 20 40" fill={hair.main} />
            <path d="M80 40 C82 50, 78 58, 76 55 C74 52, 78 45, 80 40" fill={hair.main} />
          </g>
        );
      case 'long':
        return (
          <g>
            <path
              d="M18 30 C18 12, 34 2, 50 2 C66 2, 82 12, 82 30 C82 50, 78 70, 76 85 C74 92, 68 94, 66 88 C64 78, 66 55, 66 40 C66 36, 50 34, 50 34 C50 34, 34 36, 34 40 C34 55, 36 78, 34 88 C32 94, 26 92, 24 85 C22 70, 18 50, 18 30"
              fill={hair.main}
            />
            <path
              d="M22 30 C22 16, 36 8, 50 8 C64 8, 78 16, 78 30"
              fill={hair.highlight}
              opacity="0.3"
            />
          </g>
        );
      case 'curly':
        return (
          <g fill={hair.main}>
            <circle cx="28" cy="22" r="10" />
            <circle cx="42" cy="16" r="10" />
            <circle cx="58" cy="16" r="10" />
            <circle cx="72" cy="22" r="10" />
            <circle cx="22" cy="34" r="8" />
            <circle cx="78" cy="34" r="8" />
            <circle cx="35" cy="12" r="7" fill={hair.highlight} opacity="0.3" />
          </g>
        );
      case 'afro':
        return (
          <g>
            <ellipse cx="50" cy="30" rx="38" ry="32" fill={hair.main} />
            <ellipse cx="50" cy="28" rx="32" ry="26" fill={hair.highlight} opacity="0.15" />
            {[...Array(12)].map((_, i) => (
              <circle
                key={i}
                cx={26 + (i % 4) * 16}
                cy={10 + Math.floor(i / 4) * 12}
                r={4 + Math.random() * 3}
                fill={hair.shadow}
                opacity="0.3"
              />
            ))}
          </g>
        );
      case 'braids':
        return (
          <g fill={hair.main}>
            <path d="M24 26 C24 16, 36 8, 50 8 C64 8, 76 16, 76 26 C76 32, 72 36, 66 34 C56 32, 44 32, 34 34 C28 36, 24 32, 24 26" />
            <path d="M18 34 Q14 50, 16 65 Q18 80, 14 95" stroke={hair.main} strokeWidth="8" fill="none" strokeLinecap="round" />
            <path d="M82 34 Q86 50, 84 65 Q82 80, 86 95" stroke={hair.main} strokeWidth="8" fill="none" strokeLinecap="round" />
            {/* Braid details */}
            <path d="M14 40 L18 42 M14 50 L18 52 M14 60 L18 62 M14 70 L18 72 M14 80 L18 82" stroke={hair.shadow} strokeWidth="2" />
            <path d="M86 40 L82 42 M86 50 L82 52 M86 60 L82 62 M86 70 L82 72 M86 80 L82 82" stroke={hair.shadow} strokeWidth="2" />
          </g>
        );
      case 'hijab':
        return (
          <g>
            <path
              d="M20 35 C20 18, 34 8, 50 8 C66 8, 80 18, 80 35 C82 55, 78 75, 70 90 C65 98, 55 100, 50 100 C45 100, 35 98, 30 90 C22 75, 18 55, 20 35"
              fill={outfitClr.main}
            />
            <path
              d="M24 35 C24 22, 36 14, 50 14 C64 14, 76 22, 76 35"
              fill={outfitClr.accent}
              opacity="0.3"
            />
            <path d="M30 50 C35 55, 45 58, 50 58 C55 58, 65 55, 70 50" stroke={outfitClr.shadow} strokeWidth="1" fill="none" />
          </g>
        );
      case 'ponytail':
        return (
          <g fill={hair.main}>
            <path d="M24 26 C24 16, 36 8, 50 8 C64 8, 76 16, 76 26 C76 32, 72 36, 66 34 C56 32, 44 32, 34 34 C28 36, 24 32, 24 26" />
            <path d="M70 28 Q85 32, 88 45 Q92 65, 85 85 Q82 92, 78 88 Q75 75, 78 55 Q80 40, 70 28" />
          </g>
        );
      case 'bun':
        return (
          <g fill={hair.main}>
            <path d="M24 26 C24 16, 36 8, 50 8 C64 8, 76 16, 76 26 C76 32, 72 36, 66 34 C56 32, 44 32, 34 34 C28 36, 24 32, 24 26" />
            <circle cx="50" cy="8" r="12" />
            <circle cx="50" cy="8" r="8" fill={hair.highlight} opacity="0.3" />
          </g>
        );
      case 'spiky':
        return (
          <g fill={hair.main}>
            <path d="M28 26 L22 4 L36 18 Z" />
            <path d="M38 22 L35 0 L48 14 Z" />
            <path d="M50 20 L50 -4 L58 14 Z" />
            <path d="M62 22 L65 0 L70 18 Z" />
            <path d="M72 26 L78 4 L74 20 Z" />
            <ellipse cx="50" cy="26" rx="26" ry="10" />
          </g>
        );
      case 'buzzcut':
        return (
          <g>
            <path
              d="M26 32 C26 20, 37 12, 50 12 C63 12, 74 20, 74 32 C74 36, 72 38, 68 36 C58 34, 42 34, 32 36 C28 38, 26 36, 26 32"
              fill={hair.main}
            />
          </g>
        );
      case 'mohawk':
        return (
          <g fill={hair.main}>
            <path d="M40 30 L42 -2 L50 25 L58 -2 L60 30 Z" />
            <ellipse cx="50" cy="30" rx="12" ry="6" />
            <path d="M44 10 L50 20 L56 10" fill={hair.highlight} opacity="0.3" />
          </g>
        );
      case 'bald':
        return null;
      default:
        return (
          <path
            d="M24 28 C24 16, 36 8, 50 8 C64 8, 76 16, 76 28 C76 34, 72 38, 66 36 C56 34, 44 34, 34 36 C28 38, 24 34, 24 28"
            fill={hair.main}
          />
        );
    }
  };

  const renderEyes = () => {
    const eyeExpr = getExpressionEyes();
    const eyeStyle = config.eyeStyle || 'round';
    
    if (eyeExpr.shape === 'arc') {
      return (
        <g>
          <path d="M32 44 Q38 40, 44 44" stroke={eyes.iris} strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M56 44 Q62 40, 68 44" stroke={eyes.iris} strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      );
    }

    const eyeRadius = eyeStyle === 'big' ? 8 : eyeStyle === 'narrow' ? 4 : 6;
    const irisRadius = eyeRadius * 0.6;
    const pupilRadius = irisRadius * 0.5;

    return (
      <g>
        {/* Left eye */}
        <ellipse cx="38" cy="44" rx={eyeRadius} ry={eyeRadius * eyeExpr.modifier} fill="white" />
        <circle cx="38" cy="44" r={irisRadius * eyeExpr.modifier} fill={eyes.iris} />
        <circle cx="38" cy="44" r={pupilRadius * eyeExpr.modifier} fill={eyes.pupil} />
        <circle cx="40" cy="42" r={pupilRadius * 0.5} fill={eyes.highlight} />
        
        {/* Right eye */}
        <ellipse cx="62" cy="44" rx={eyeRadius} ry={eyeRadius * eyeExpr.modifier} fill="white" />
        <circle cx="62" cy="44" r={irisRadius * eyeExpr.modifier} fill={eyes.iris} />
        <circle cx="62" cy="44" r={pupilRadius * eyeExpr.modifier} fill={eyes.pupil} />
        <circle cx="64" cy="42" r={pupilRadius * 0.5} fill={eyes.highlight} />
      </g>
    );
  };

  const renderGlasses = () => {
    switch (config.glasses) {
      case 'round':
        return (
          <g stroke="#333" strokeWidth="2" fill="none">
            <circle cx="38" cy="44" r="10" />
            <circle cx="62" cy="44" r="10" />
            <line x1="48" y1="44" x2="52" y2="44" />
            <line x1="28" y1="42" x2="22" y2="40" />
            <line x1="72" y1="42" x2="78" y2="40" />
          </g>
        );
      case 'square':
        return (
          <g stroke="#333" strokeWidth="2" fill="none">
            <rect x="28" y="36" width="18" height="14" rx="2" />
            <rect x="54" y="36" width="18" height="14" rx="2" />
            <line x1="46" y1="43" x2="54" y2="43" />
            <line x1="28" y1="40" x2="22" y2="38" />
            <line x1="72" y1="40" x2="78" y2="38" />
          </g>
        );
      case 'sunglasses':
        return (
          <g>
            <rect x="28" y="38" width="18" height="12" rx="3" fill="#1C1C1C" />
            <rect x="54" y="38" width="18" height="12" rx="3" fill="#1C1C1C" />
            <line x1="46" y1="44" x2="54" y2="44" stroke="#1C1C1C" strokeWidth="3" />
            <line x1="28" y1="42" x2="20" y2="40" stroke="#1C1C1C" strokeWidth="3" />
            <line x1="72" y1="42" x2="80" y2="40" stroke="#1C1C1C" strokeWidth="3" />
            {/* Lens shine */}
            <path d="M30 40 L34 40 L30 44 Z" fill="white" opacity="0.3" />
            <path d="M56 40 L60 40 L56 44 Z" fill="white" opacity="0.3" />
          </g>
        );
      case 'aviator':
        return (
          <g>
            <path d="M26 38 Q26 52, 38 52 Q50 52, 48 44 Q46 36, 38 36 Q30 36, 26 38" fill="#1C1C1C" opacity="0.8" />
            <path d="M74 38 Q74 52, 62 52 Q50 52, 52 44 Q54 36, 62 36 Q70 36, 74 38" fill="#1C1C1C" opacity="0.8" />
            <line x1="48" y1="44" x2="52" y2="44" stroke="#D4AF37" strokeWidth="2" />
            <line x1="26" y1="40" x2="18" y2="38" stroke="#D4AF37" strokeWidth="2" />
            <line x1="74" y1="40" x2="82" y2="38" stroke="#D4AF37" strokeWidth="2" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderHeadwear = () => {
    switch (config.headwear) {
      case 'cap':
        return (
          <g>
            <ellipse cx="50" cy="18" rx="32" ry="12" fill={outfitClr.main} />
            <path d="M18 18 C18 6, 34 -2, 50 -2 C66 -2, 82 6, 82 18" fill={outfitClr.main} />
            <rect x="76" y="14" width="18" height="8" rx="2" fill={outfitClr.shadow} />
          </g>
        );
      case 'beanie':
        return (
          <g>
            <path d="M22 32 C22 12, 36 2, 50 2 C64 2, 78 12, 78 32" fill={outfitClr.main} />
            <rect x="22" y="28" width="56" height="8" rx="2" fill={outfitClr.shadow} />
            <circle cx="50" cy="4" r="6" fill={outfitClr.accent} />
          </g>
        );
      case 'crown':
        return (
          <g fill="#FFD700">
            <path d="M26 22 L32 4 L40 16 L50 0 L60 16 L68 4 L74 22 L72 28 L28 28 Z" />
            <circle cx="32" cy="10" r="3" fill="#E11D48" />
            <circle cx="50" cy="6" r="3" fill="#3B82F6" />
            <circle cx="68" cy="10" r="3" fill="#22C55E" />
            <path d="M28 22 L72 22 L70 26 L30 26 Z" fill="#B8860B" />
          </g>
        );
      case 'headband':
        return (
          <g>
            <rect x="20" y="26" width="60" height="8" rx="2" fill={outfitClr.main} />
            <circle cx="50" cy="30" r="6" fill={outfitClr.accent} />
          </g>
        );
      case 'headphones':
        return (
          <g>
            <path d="M18 48 C12 28, 32 10, 50 10 C68 10, 88 28, 82 48" stroke="#333" strokeWidth="6" fill="none" />
            <ellipse cx="18" cy="50" rx="8" ry="12" fill="#333" />
            <ellipse cx="82" cy="50" rx="8" ry="12" fill="#333" />
            <ellipse cx="18" cy="50" rx="5" ry="8" fill="#555" />
            <ellipse cx="82" cy="50" rx="5" ry="8" fill="#555" />
          </g>
        );
      default:
        return null;
    }
  };

  const renderOutfit = () => {
    const outfitType = config.outfit || 'tshirt';
    
    switch (outfitType) {
      case 'tshirt':
        return (
          <g>
            <path
              d="M28 78 L28 120 L72 120 L72 78 C72 74, 66 72, 60 72 L56 72 C56 76, 52 80, 50 80 C48 80, 44 76, 44 72 L40 72 C34 72, 28 74, 28 78"
              fill={outfitClr.main}
            />
            <path d="M28 78 C24 80, 18 84, 14 88 L18 96 C22 92, 28 88, 28 86" fill={outfitClr.main} />
            <path d="M72 78 C76 80, 82 84, 86 88 L82 96 C78 92, 72 88, 72 86" fill={outfitClr.main} />
            <path d="M44 72 Q50 78, 56 72" fill={outfitClr.shadow} />
          </g>
        );
      case 'hoodie':
        return (
          <g>
            <path
              d="M24 78 L24 120 L76 120 L76 78 C76 72, 70 70, 64 70 L60 70 C60 76, 54 82, 50 84 C46 82, 40 76, 40 70 L36 70 C30 70, 24 72, 24 78"
              fill={outfitClr.main}
            />
            <path d="M24 78 C18 82, 10 88, 6 94 L12 104 C16 98, 24 92, 24 88" fill={outfitClr.main} />
            <path d="M76 78 C82 82, 90 88, 94 94 L88 104 C84 98, 76 92, 76 88" fill={outfitClr.main} />
            {/* Hood */}
            <ellipse cx="50" cy="76" rx="16" ry="12" fill={outfitClr.shadow} />
            {/* Strings */}
            <line x1="44" y1="84" x2="44" y2="100" stroke={outfitClr.accent} strokeWidth="2" />
            <line x1="56" y1="84" x2="56" y2="100" stroke={outfitClr.accent} strokeWidth="2" />
          </g>
        );
      case 'jacket':
        return (
          <g>
            <path d="M26 78 L26 120 L74 120 L74 78 C74 72, 68 70, 62 70 L56 70 L50 78 L44 70 L38 70 C32 70, 26 72, 26 78" fill={outfitClr.main} />
            <path d="M26 78 C20 82, 12 88, 8 94 L14 104 C18 98, 26 92, 26 88" fill={outfitClr.main} />
            <path d="M74 78 C80 82, 88 88, 92 94 L86 104 C82 98, 74 92, 74 88" fill={outfitClr.main} />
            {/* Zipper */}
            <line x1="50" y1="78" x2="50" y2="120" stroke="#888" strokeWidth="3" />
            <line x1="50" y1="78" x2="50" y2="120" stroke="#666" strokeWidth="1" />
            {/* Collar */}
            <path d="M38 70 L50 82 L62 70" fill={outfitClr.shadow} />
          </g>
        );
      case 'uniform':
        return (
          <g>
            <path d="M28 78 L28 120 L72 120 L72 78 C72 74, 66 72, 60 72 L56 72 L50 80 L44 72 L40 72 C34 72, 28 74, 28 78" fill={outfitClr.main} />
            <path d="M28 78 C24 80, 18 84, 14 88 L18 96 C22 92, 28 88, 28 86" fill={outfitClr.main} />
            <path d="M72 78 C76 80, 82 84, 86 88 L82 96 C78 92, 72 88, 72 86" fill={outfitClr.main} />
            {/* Collar */}
            <path d="M44 72 L50 80 L56 72 L52 72 L50 76 L48 72 Z" fill="white" />
            {/* Tie */}
            <path d="M48 76 L50 82 L52 76 L54 120 L46 120 Z" fill="#1E3A5F" />
            {/* Buttons */}
            <circle cx="42" cy="90" r="2" fill={outfitClr.shadow} />
            <circle cx="42" cy="100" r="2" fill={outfitClr.shadow} />
          </g>
        );
      case 'dress':
        return (
          <g>
            <path
              d="M34 72 L34 78 L20 120 L80 120 L66 78 L66 72 C66 72, 58 74, 50 74 C42 74, 34 72, 34 72"
              fill={outfitClr.main}
            />
            <path d="M34 72 Q50 78, 66 72" fill={outfitClr.shadow} />
            {/* Sleeves */}
            <path d="M34 74 C28 78, 20 84, 16 90 L22 98 C26 92, 34 86, 34 82" fill={outfitClr.main} />
            <path d="M66 74 C72 78, 80 84, 84 90 L78 98 C74 92, 66 86, 66 82" fill={outfitClr.main} />
          </g>
        );
      case 'traditional':
        return (
          <g>
            <path d="M26 72 L26 120 L74 120 L74 72 C74 72, 62 76, 50 76 C38 76, 26 72, 26 72" fill={outfitClr.main} />
            {/* Decorative collar */}
            <path d="M30 74 Q50 82, 70 74" fill={outfitClr.accent} />
            {/* Pattern */}
            <path d="M30 90 L70 90" stroke={outfitClr.accent} strokeWidth="3" />
            <path d="M30 100 L70 100" stroke={outfitClr.accent} strokeWidth="3" />
            <path d="M30 110 L70 110" stroke={outfitClr.accent} strokeWidth="3" />
          </g>
        );
      case 'sporty':
        return (
          <g>
            <path d="M28 78 L28 120 L72 120 L72 78 C72 74, 66 72, 60 72 L40 72 C34 72, 28 74, 28 78" fill={outfitClr.main} />
            <path d="M28 78 C24 80, 18 84, 14 88 L18 96 C22 92, 28 88, 28 86" fill={outfitClr.main} />
            <path d="M72 78 C76 80, 82 84, 86 88 L82 96 C78 92, 72 88, 72 86" fill={outfitClr.main} />
            {/* Stripes */}
            <line x1="50" y1="72" x2="50" y2="120" stroke="white" strokeWidth="4" />
            <line x1="28" y1="90" x2="72" y2="90" stroke="white" strokeWidth="4" />
            {/* Number */}
            <text x="50" y="108" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">7</text>
          </g>
        );
      default:
        return (
          <path
            d="M28 78 L28 120 L72 120 L72 78 C72 74, 66 72, 60 72 L40 72 C34 72, 28 74, 28 78"
            fill={outfitClr.main}
          />
        );
    }
  };

  const renderAccessories = () => {
    const accessories = [];
    
    if (config.earrings && config.earrings !== 'none') {
      switch (config.earrings) {
        case 'studs':
          accessories.push(
            <g key="earrings">
              <circle cx="20" cy="52" r="3" fill="#FFD700" />
              <circle cx="80" cy="52" r="3" fill="#FFD700" />
            </g>
          );
          break;
        case 'hoops':
          accessories.push(
            <g key="earrings">
              <circle cx="18" cy="54" r="6" stroke="#FFD700" strokeWidth="2" fill="none" />
              <circle cx="82" cy="54" r="6" stroke="#FFD700" strokeWidth="2" fill="none" />
            </g>
          );
          break;
        case 'drops':
          accessories.push(
            <g key="earrings">
              <line x1="20" y1="52" x2="20" y2="62" stroke="#FFD700" strokeWidth="2" />
              <circle cx="20" cy="64" r="4" fill="#3B82F6" />
              <line x1="80" y1="52" x2="80" y2="62" stroke="#FFD700" strokeWidth="2" />
              <circle cx="80" cy="64" r="4" fill="#3B82F6" />
            </g>
          );
          break;
      }
    }

    if (config.necklace && config.necklace !== 'none') {
      switch (config.necklace) {
        case 'chain':
          accessories.push(
            <path key="necklace" d="M36 72 Q50 78, 64 72" stroke="#FFD700" strokeWidth="2" fill="none" />
          );
          break;
        case 'pendant':
          accessories.push(
            <g key="necklace">
              <path d="M36 72 Q50 80, 64 72" stroke="#FFD700" strokeWidth="2" fill="none" />
              <circle cx="50" cy="82" r="5" fill="#EC4899" />
            </g>
          );
          break;
      }
    }

    return accessories;
  };

  return (
    <motion.div
      className={cn(
        'relative rounded-2xl overflow-hidden',
        container,
        showGlow && 'shadow-lg',
        className
      )}
      style={{ 
        background: bg.gradient,
        boxShadow: showGlow ? `0 0 40px ${bg.glow}40` : undefined
      }}
      animate={animate ? { 
        scale: [1, 1.02, 1],
      } : undefined}
      transition={{ 
        duration: 3, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }}
    >
      {/* Background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full bg-white/30"
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + i * 10}%`,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 2 + i * 0.5,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </div>

      <svg viewBox="0 0 100 130" className="w-full h-full relative z-10">
        {/* Platform/Shadow */}
        {showPlatform && (
          <ellipse cx="50" cy="125" rx="30" ry="5" fill="black" opacity="0.2" />
        )}

        {/* Body/Neck */}
        <rect x="42" y="68" width="16" height="12" fill={skin.main} rx="4" />

        {/* Outfit */}
        {renderOutfit()}

        {/* Face base */}
        <ellipse cx="50" cy="46" rx="28" ry="30" fill={skin.main} />
        
        {/* Face shadows */}
        <ellipse cx="50" cy="48" rx="26" ry="28" fill={skin.shadow} opacity="0.1" />
        
        {/* Face highlight */}
        <ellipse cx="44" cy="38" rx="12" ry="14" fill={skin.highlight} opacity="0.3" />

        {/* Ears */}
        <ellipse cx="22" cy="46" rx="5" ry="8" fill={skin.main} />
        <ellipse cx="22" cy="46" rx="3" ry="5" fill={skin.shadow} opacity="0.2" />
        <ellipse cx="78" cy="46" rx="5" ry="8" fill={skin.main} />
        <ellipse cx="78" cy="46" rx="3" ry="5" fill={skin.shadow} opacity="0.2" />

        {/* Eyebrows */}
        <path d="M30 36 Q38 32, 44 36" stroke={hair.main} strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M56 36 Q62 32, 70 36" stroke={hair.main} strokeWidth="2.5" fill="none" strokeLinecap="round" />

        {/* Eyes */}
        {renderEyes()}

        {/* Nose */}
        <path d="M50 48 Q48 54, 50 56 Q52 54, 50 48" stroke={skin.shadow} strokeWidth="1.5" fill="none" />

        {/* Mouth */}
        <path d={getExpressionMouth()} stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        
        {/* Cheek blush for friendly look */}
        <ellipse cx="30" cy="54" rx="6" ry="4" fill="#FF6B6B" opacity="0.2" />
        <ellipse cx="70" cy="54" rx="6" ry="4" fill="#FF6B6B" opacity="0.2" />

        {/* Hair */}
        {renderHair()}

        {/* Glasses */}
        {renderGlasses()}

        {/* Headwear */}
        {renderHeadwear()}

        {/* Other accessories */}
        {renderAccessories()}
      </svg>

      {/* XP Stars and badges floating effect */}
      {showGlow && (
        <>
          <motion.div
            className="absolute top-2 right-2 text-yellow-400"
            animate={{ rotate: 360, scale: [1, 1.2, 1] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            ⭐
          </motion.div>
          <motion.div
            className="absolute bottom-4 left-2 text-purple-400"
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🧠
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default GameAvatarRenderer;
