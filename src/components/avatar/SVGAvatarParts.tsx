import React from 'react';

// ============ SKIN TONES ============
export const SKIN_TONES = [
  { id: 'porcelain', color: '#FFF0E0', label: 'Porcelain' },
  { id: 'fair', color: '#FDEBD0', label: 'Fair' },
  { id: 'light', color: '#F5CBA7', label: 'Light' },
  { id: 'medium', color: '#D4A574', label: 'Medium' },
  { id: 'olive', color: '#C4A882', label: 'Olive' },
  { id: 'tan', color: '#C68642', label: 'Tan' },
  { id: 'brown', color: '#8D5524', label: 'Brown' },
  { id: 'dark', color: '#5C3317', label: 'Dark' },
  { id: 'deep', color: '#3B1F0B', label: 'Deep' },
  { id: 'ebony', color: '#2C1608', label: 'Ebony' },
];

// ============ FACE SHAPES ============
export const FACE_SHAPES = [
  { id: 'oval', label: 'Oval', emoji: '🥚' },
  { id: 'round', label: 'Round', emoji: '🟠' },
  { id: 'square', label: 'Square', emoji: '⬜' },
  { id: 'heart', label: 'Heart', emoji: '💛' },
  { id: 'long', label: 'Long', emoji: '📏' },
];

// ============ HAIR STYLES ============
export const HAIR_STYLES = [
  { id: 'none', label: 'Bald', emoji: '👨‍🦲', level: 1 },
  { id: 'buzz', label: 'Buzz Cut', emoji: '💇', level: 1 },
  { id: 'short', label: 'Short', emoji: '👦', level: 1 },
  { id: 'medium', label: 'Medium', emoji: '🧑', level: 1 },
  { id: 'long', label: 'Long', emoji: '👩', level: 1 },
  { id: 'curly', label: 'Curly', emoji: '🌀', level: 2 },
  { id: 'wavy', label: 'Wavy', emoji: '〰️', level: 2 },
  { id: 'afro', label: 'Afro', emoji: '🧑‍🦱', level: 3 },
  { id: 'braids', label: 'Braids', emoji: '🪢', level: 4 },
  { id: 'ponytail', label: 'Ponytail', emoji: '🐴', level: 2 },
  { id: 'mohawk', label: 'Mohawk', emoji: '🦅', level: 5 },
  { id: 'spiky', label: 'Spiky', emoji: '⚡', level: 6 },
  { id: 'bun', label: 'Bun', emoji: '🍡', level: 3 },
  { id: 'sidepart', label: 'Side Part', emoji: '↗️', level: 1 },
];

export const HAIR_COLORS = [
  { id: 'black', color: '#1a1a1a', label: 'Black' },
  { id: 'darkbrown', color: '#3D2314', label: 'Dark Brown' },
  { id: 'brown', color: '#6B3A2A', label: 'Brown' },
  { id: 'auburn', color: '#8B4513', label: 'Auburn' },
  { id: 'blonde', color: '#D4A017', label: 'Blonde' },
  { id: 'lightblonde', color: '#F0D58C', label: 'Light Blonde' },
  { id: 'red', color: '#C0392B', label: 'Red' },
  { id: 'ginger', color: '#E67E22', label: 'Ginger' },
  { id: 'gray', color: '#95A5A6', label: 'Gray' },
  { id: 'blue', color: '#3498DB', label: 'Blue', level: 5 },
  { id: 'purple', color: '#9B59B6', label: 'Purple', level: 7 },
  { id: 'pink', color: '#E91E8C', label: 'Pink', level: 8 },
  { id: 'green', color: '#27AE60', label: 'Green', level: 10 },
  { id: 'silver', color: '#C0C0C0', label: 'Silver', level: 12 },
];

// ============ EYE TYPES ============
export const EYE_TYPES = [
  { id: 'normal', label: 'Normal', emoji: '👁️', level: 1 },
  { id: 'round', label: 'Round', emoji: '⭕', level: 1 },
  { id: 'almond', label: 'Almond', emoji: '🥜', level: 1 },
  { id: 'narrow', label: 'Narrow', emoji: '➖', level: 1 },
  { id: 'wink', label: 'Wink', emoji: '😉', level: 3 },
  { id: 'happy', label: 'Happy', emoji: '😊', level: 2 },
  { id: 'sleepy', label: 'Sleepy', emoji: '😴', level: 3 },
  { id: 'star', label: 'Star', emoji: '⭐', level: 8 },
  { id: 'heart', label: 'Heart', emoji: '❤️', level: 10 },
];

export const EYE_COLORS = [
  { id: 'brown', color: '#5D4037', label: 'Brown' },
  { id: 'darkbrown', color: '#3E2723', label: 'Dark Brown' },
  { id: 'blue', color: '#1976D2', label: 'Blue' },
  { id: 'lightblue', color: '#42A5F5', label: 'Light Blue' },
  { id: 'green', color: '#388E3C', label: 'Green' },
  { id: 'hazel', color: '#8D6E63', label: 'Hazel' },
  { id: 'gray', color: '#78909C', label: 'Gray' },
  { id: 'amber', color: '#FF8F00', label: 'Amber', level: 5 },
  { id: 'violet', color: '#7B1FA2', label: 'Violet', level: 8 },
];

// ============ EYEBROW TYPES ============
export const EYEBROW_TYPES = [
  { id: 'normal', label: 'Normal', emoji: '〰️', level: 1 },
  { id: 'thick', label: 'Thick', emoji: '▬', level: 1 },
  { id: 'thin', label: 'Thin', emoji: '—', level: 1 },
  { id: 'arched', label: 'Arched', emoji: '⌒', level: 2 },
  { id: 'angry', label: 'Angry', emoji: '😠', level: 3 },
  { id: 'raised', label: 'Raised', emoji: '🤨', level: 2 },
  { id: 'unibrow', label: 'Unibrow', emoji: '🔗', level: 4 },
];

// ============ NOSE TYPES ============
export const NOSE_TYPES = [
  { id: 'small', label: 'Small', emoji: '·', level: 1 },
  { id: 'medium', label: 'Medium', emoji: '▵', level: 1 },
  { id: 'round', label: 'Round', emoji: '●', level: 1 },
  { id: 'pointed', label: 'Pointed', emoji: '▲', level: 2 },
  { id: 'button', label: 'Button', emoji: '◉', level: 1 },
  { id: 'wide', label: 'Wide', emoji: '◇', level: 2 },
];

// ============ MOUTH TYPES ============
export const MOUTH_TYPES = [
  { id: 'smile', label: 'Smile', emoji: '😊', level: 1 },
  { id: 'grin', label: 'Grin', emoji: '😁', level: 1 },
  { id: 'neutral', label: 'Neutral', emoji: '😐', level: 1 },
  { id: 'smirk', label: 'Smirk', emoji: '😏', level: 2 },
  { id: 'open', label: 'Open', emoji: '😮', level: 2 },
  { id: 'tongue', label: 'Tongue', emoji: '😛', level: 4 },
  { id: 'teeth', label: 'Teeth', emoji: '😬', level: 3 },
  { id: 'kiss', label: 'Kiss', emoji: '😘', level: 5 },
];

// ============ FACIAL HAIR ============
export const FACIAL_HAIR_TYPES = [
  { id: 'none', label: 'None', emoji: '❌', level: 1 },
  { id: 'stubble', label: 'Stubble', emoji: '🧔', level: 2 },
  { id: 'mustache', label: 'Mustache', emoji: '👨', level: 3 },
  { id: 'goatee', label: 'Goatee', emoji: '🐐', level: 4 },
  { id: 'beard', label: 'Full Beard', emoji: '🧔‍♂️', level: 5 },
];

// ============ ACCESSORIES ============
export const ACCESSORIES = [
  { id: 'none', label: 'None', emoji: '❌', level: 1 },
  { id: 'glasses', label: 'Glasses', emoji: '👓', level: 1 },
  { id: 'roundglasses', label: 'Round Glasses', emoji: '🤓', level: 2 },
  { id: 'sunglasses', label: 'Sunglasses', emoji: '🕶️', level: 2 },
  { id: 'cap', label: 'Cap', emoji: '🧢', level: 2 },
  { id: 'beanie', label: 'Beanie', emoji: '🎿', level: 3 },
  { id: 'headphones', label: 'Headphones', emoji: '🎧', level: 3 },
  { id: 'earrings', label: 'Earrings', emoji: '💎', level: 4 },
  { id: 'bandana', label: 'Bandana', emoji: '🎀', level: 3 },
  { id: 'crown', label: 'Crown', emoji: '👑', level: 10 },
  { id: 'halo', label: 'Halo', emoji: '😇', level: 15 },
  { id: 'horns', label: 'Horns', emoji: '😈', level: 12 },
  { id: 'tiara', label: 'Tiara', emoji: '👸', level: 8 },
];

// ============ OUTFITS ============
export const OUTFITS = [
  { id: 'tshirt', label: 'T-Shirt', emoji: '👕', level: 1 },
  { id: 'polo', label: 'Polo', emoji: '👕', level: 1 },
  { id: 'hoodie', label: 'Hoodie', emoji: '🧥', level: 3 },
  { id: 'jacket', label: 'Jacket', emoji: '🧥', level: 5 },
  { id: 'blazer', label: 'Blazer', emoji: '👔', level: 5 },
  { id: 'dress', label: 'Dress', emoji: '👗', level: 3 },
  { id: 'labcoat', label: 'Lab Coat', emoji: '🔬', level: 7 },
  { id: 'superhero', label: 'Superhero', emoji: '🦸', level: 10 },
  { id: 'golden', label: 'Golden', emoji: '✨', level: 15 },
  { id: 'cape', label: 'Cape', emoji: '🧙', level: 20 },
  { id: 'legendary', label: 'Legendary', emoji: '🌟', level: 50 },
];

export const OUTFIT_COLORS = [
  { id: 'blue', color: '#3B82F6', label: 'Blue' },
  { id: 'red', color: '#EF4444', label: 'Red' },
  { id: 'green', color: '#22C55E', label: 'Green' },
  { id: 'purple', color: '#8B5CF6', label: 'Purple' },
  { id: 'black', color: '#1F2937', label: 'Black' },
  { id: 'white', color: '#F9FAFB', label: 'White' },
  { id: 'orange', color: '#F97316', label: 'Orange' },
  { id: 'pink', color: '#EC4899', label: 'Pink' },
  { id: 'teal', color: '#14B8A6', label: 'Teal' },
  { id: 'navy', color: '#1E3A5F', label: 'Navy' },
  { id: 'gold', color: '#EAB308', label: 'Gold', level: 10 },
  { id: 'rainbow', color: '#FF6B6B', label: 'Rainbow', level: 15 },
];

// ============ BACKGROUNDS ============
export const BACKGROUNDS = [
  { id: 'sky', gradient: ['#87CEEB', '#3B82F6'], label: 'Sky', level: 1 },
  { id: 'sunset', gradient: ['#F97316', '#EC4899'], label: 'Sunset', level: 1 },
  { id: 'forest', gradient: ['#22C55E', '#059669'], label: 'Forest', level: 2 },
  { id: 'ocean', gradient: ['#06B6D4', '#2563EB'], label: 'Ocean', level: 2 },
  { id: 'rose', gradient: ['#F472B6', '#E11D48'], label: 'Rose', level: 3 },
  { id: 'lavender', gradient: ['#C4B5FD', '#7C3AED'], label: 'Lavender', level: 3 },
  { id: 'galaxy', gradient: ['#7C3AED', '#312E81'], label: 'Galaxy', level: 5 },
  { id: 'fire', gradient: ['#EF4444', '#F97316'], label: 'Fire', level: 6 },
  { id: 'aurora', gradient: ['#22C55E', '#7C3AED'], label: 'Aurora', level: 8 },
  { id: 'gold', gradient: ['#EAB308', '#D97706'], label: 'Gold', level: 10 },
  { id: 'cosmic', gradient: ['#EC4899', '#3B82F6'], label: 'Cosmic', level: 15 },
  { id: 'midnight', gradient: ['#0F172A', '#1E3A5F'], label: 'Midnight', level: 4 },
];

// ============ FULL CONFIG ============
export interface FullAvatarConfig {
  skinTone: string;
  faceShape: string;
  hairStyle: string;
  hairColor: string;
  eyeType: string;
  eyeColor: string;
  eyebrowType: string;
  noseType: string;
  mouthType: string;
  facialHair: string;
  accessory: string;
  outfit: string;
  outfitColor: string;
  background: string;
}

export const DEFAULT_AVATAR_CONFIG: FullAvatarConfig = {
  skinTone: 'medium',
  faceShape: 'oval',
  hairStyle: 'short',
  hairColor: 'brown',
  eyeType: 'normal',
  eyeColor: 'brown',
  eyebrowType: 'normal',
  noseType: 'small',
  mouthType: 'smile',
  facialHair: 'none',
  accessory: 'none',
  outfit: 'tshirt',
  outfitColor: 'blue',
  background: 'sky',
};

// ============ COLOR HELPERS ============
const getSkinColor = (id: string) => SKIN_TONES.find(s => s.id === id)?.color || '#D4A574';
const getHairColor = (id: string) => HAIR_COLORS.find(h => h.id === id)?.color || '#6B3A2A';
const getEyeColor = (id: string) => EYE_COLORS.find(e => e.id === id)?.color || '#5D4037';
const getOutfitColor = (id: string) => OUTFIT_COLORS.find(o => o.id === id)?.color || '#3B82F6';
const getBackground = (id: string) => BACKGROUNDS.find(b => b.id === id)?.gradient || ['#87CEEB', '#3B82F6'];

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0x00FF) - amount);
  const b = Math.max(0, (num & 0x0000FF) - amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

function lighten(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
  const b = Math.min(255, (num & 0x0000FF) + amount);
  return `#${(r << 16 | g << 8 | b).toString(16).padStart(6, '0')}`;
}

// ============ FACE SHAPE PATHS ============
function getFaceShape(shape: string): { head: string; jawY: number } {
  switch (shape) {
    case 'round':
      return { head: 'M26 58 C26 30 74 30 74 58 C74 82 65 90 50 90 C35 90 26 82 26 58Z', jawY: 90 };
    case 'square':
      return { head: 'M28 55 C28 32 72 32 72 55 L72 78 C72 86 62 90 50 90 C38 90 28 86 28 78Z', jawY: 90 };
    case 'heart':
      return { head: 'M26 56 C26 30 74 30 74 56 C74 80 62 92 50 92 C38 92 26 80 26 56Z', jawY: 92 };
    case 'long':
      return { head: 'M28 55 C28 28 72 28 72 55 C72 84 64 96 50 96 C36 96 28 84 28 55Z', jawY: 96 };
    default: // oval
      return { head: 'M26 58 C26 32 74 32 74 58 C74 80 64 92 50 92 C36 92 26 80 26 58Z', jawY: 92 };
  }
}

// ============ RENDER FUNCTIONS ============

function renderHair(style: string, color: string, faceShape: string) {
  const darker = darken(color, 25);
  switch (style) {
    case 'buzz':
      return <path d="M30 52 C30 36 70 36 70 52 C70 40 62 33 50 33 C38 33 30 40 30 52Z" fill={color} opacity="0.75" />;
    case 'short':
      return <><path d="M28 55 C28 32 72 32 72 55 C72 38 62 28 50 28 C38 28 28 38 28 55Z" fill={color} /><path d="M32 50 C32 35 68 35 68 50" fill={darker} opacity="0.3" /></>;
    case 'medium':
      return <><path d="M24 55 C24 28 76 28 76 55 C76 32 64 22 50 22 C36 22 24 32 24 55Z" fill={color} /><path d="M24 55 C20 68 20 78 24 82" stroke={color} strokeWidth="5" fill="none" /><path d="M76 55 C80 68 80 78 76 82" stroke={color} strokeWidth="5" fill="none" /><path d="M28 48 C28 32 72 32 72 48" fill={darker} opacity="0.2" /></>;
    case 'long':
      return <><path d="M20 55 C20 24 80 24 80 55 C80 28 66 18 50 18 C34 18 20 28 20 55Z" fill={color} /><path d="M20 55 C16 72 16 90 20 100" stroke={color} strokeWidth="6" fill="none" /><path d="M80 55 C84 72 84 90 80 100" stroke={color} strokeWidth="6" fill="none" /><path d="M22 52 Q50 25 78 52" fill={darker} opacity="0.15" /></>;
    case 'curly':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 36 62 26 50 26 C38 26 26 36 26 55Z" fill={color} />{[28,38,48,58,68].map(x => <circle key={x} cx={x} cy={35+Math.sin(x)*3} r={6+Math.sin(x*2)} fill={color} />)}<circle cx="24" cy="50" r="5" fill={color} /><circle cx="76" cy="50" r="5" fill={color} /></>;
    case 'wavy':
      return <><path d="M24 55 C24 28 76 28 76 55 C76 32 64 22 50 22 C36 22 24 32 24 55Z" fill={color} /><path d="M24 55 Q18 68 24 78 Q30 88 24 98" stroke={color} strokeWidth="5" fill="none" /><path d="M76 55 Q82 68 76 78 Q70 88 76 98" stroke={color} strokeWidth="5" fill="none" /></>;
    case 'afro':
      return <><circle cx="50" cy="42" r="28" fill={color} /><circle cx="50" cy="42" r="24" fill={darker} opacity="0.15" /></>;
    case 'braids':
      return <><path d="M24 55 C24 28 76 28 76 55 C76 32 64 22 50 22 C36 22 24 32 24 55Z" fill={color} /><path d="M28 55 L26 100" stroke={color} strokeWidth="5" /><path d="M72 55 L74 100" stroke={color} strokeWidth="5" /><circle cx="26" cy="102" r="4" fill={darker} /><circle cx="74" cy="102" r="4" fill={darker} /><path d="M28 60 L28 95" stroke={darker} strokeWidth="1" strokeDasharray="3,3" /><path d="M72 60 L72 95" stroke={darker} strokeWidth="1" strokeDasharray="3,3" /></>;
    case 'ponytail':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 36 62 26 50 26 C38 26 26 36 26 55Z" fill={color} /><path d="M56 28 C68 26 74 34 72 50 C74 64 70 80 62 88" stroke={color} strokeWidth="6" fill="none" /><circle cx="62" cy="90" r="4" fill={darker} /></>;
    case 'mohawk':
      return <><path d="M42 55 C42 15 58 15 58 55 C58 18 54 6 50 6 C46 6 42 18 42 55Z" fill={color} /><path d="M44 50 C44 18 56 18 56 50" fill={darker} opacity="0.2" /></>;
    case 'spiky':
      return <><path d="M28 55 C28 36 72 36 72 55" fill={color} /><polygon points="33,36 37,10 41,36" fill={color} /><polygon points="43,33 48,5 53,33" fill={color} /><polygon points="55,36 59,10 63,36" fill={color} /><polygon points="38,34 42,16 46,34" fill={darker} opacity="0.2" /><polygon points="50,32 54,12 58,34" fill={darker} opacity="0.2" /></>;
    case 'bun':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 36 62 26 50 26 C38 26 26 36 26 55Z" fill={color} /><circle cx="50" cy="22" r="10" fill={color} /><circle cx="50" cy="22" r="7" fill={darker} opacity="0.15" /></>;
    case 'sidepart':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 36 62 26 50 26 C38 26 26 36 26 55Z" fill={color} /><path d="M36 30 C32 35 28 50 28 55" fill={darker} opacity="0.3" /></>;
    default:
      return null;
  }
}

function renderEyes(type: string, eyeColor: string) {
  const lx = 40, rx = 60, y = 62;
  const white = '#FFFFFF';
  const highlight = '#FFFFFF';
  switch (type) {
    case 'round':
      return <>{[lx,rx].map(cx => <g key={cx}><ellipse cx={cx} cy={y} rx="6" ry="6" fill={white} /><ellipse cx={cx} cy={y} rx="6" ry="6" fill="none" stroke="#00000015" strokeWidth="0.5" /><circle cx={cx} cy={y} r="3.5" fill={eyeColor} /><circle cx={cx+0.5} cy={y+0.5} r="2" fill="#111" /><circle cx={cx-1.5} cy={y-1.5} r="1.2" fill={highlight} /></g>)}</>;
    case 'almond':
      return <>{[lx,rx].map(cx => <g key={cx}><ellipse cx={cx} cy={y} rx="7" ry="4.5" fill={white} /><circle cx={cx} cy={y} r="3" fill={eyeColor} /><circle cx={cx+0.3} cy={y+0.3} r="1.8" fill="#111" /><circle cx={cx-1} cy={y-1} r="1" fill={highlight} /></g>)}</>;
    case 'narrow':
      return <>{[lx,rx].map(cx => <g key={cx}><ellipse cx={cx} cy={y} rx="7" ry="3" fill={white} /><circle cx={cx} cy={y} r="2.2" fill={eyeColor} /><circle cx={cx} cy={y} r="1.3" fill="#111" /><circle cx={cx-0.8} cy={y-0.5} r="0.6" fill={highlight} /></g>)}</>;
    case 'wink':
      return <><g><ellipse cx={lx} cy={y} rx="5.5" ry="5.5" fill={white} /><circle cx={lx} cy={y} r="3" fill={eyeColor} /><circle cx={lx+0.3} cy={y+0.3} r="1.8" fill="#111" /><circle cx={lx-1.2} cy={y-1.2} r="1" fill={highlight} /></g><path d={`M${rx-6} ${y} Q${rx} ${y-5} ${rx+6} ${y}`} stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" /></>;
    case 'happy':
      return <>{[lx,rx].map(cx => <path key={cx} d={`M${cx-6} ${y} Q${cx} ${y+5} ${cx+6} ${y}`} stroke="#333" strokeWidth="2.5" fill="none" strokeLinecap="round" />)}</>;
    case 'sleepy':
      return <>{[lx,rx].map(cx => <g key={cx}><ellipse cx={cx} cy={y} rx="6" ry="3" fill={white} /><circle cx={cx} cy={y+0.5} r="2" fill={eyeColor} /><circle cx={cx} cy={y+0.5} r="1.2" fill="#111" /><line x1={cx-6} y1={y-3} x2={cx+6} y2={y-3} stroke="#333" strokeWidth="1" /></g>)}</>;
    case 'star':
      return <>{[lx,rx].map(cx => <text key={cx} x={cx} y={y+5} textAnchor="middle" fontSize="12" fill={eyeColor}>★</text>)}</>;
    case 'heart':
      return <>{[lx,rx].map(cx => <text key={cx} x={cx} y={y+5} textAnchor="middle" fontSize="12" fill="#E11D48">♥</text>)}</>;
    default: // normal
      return <>{[lx,rx].map(cx => <g key={cx}><ellipse cx={cx} cy={y} rx="5.5" ry="5.5" fill={white} /><ellipse cx={cx} cy={y} rx="5.5" ry="5.5" fill="none" stroke="#00000010" strokeWidth="0.5" /><circle cx={cx} cy={y} r="3" fill={eyeColor} /><circle cx={cx+0.3} cy={y+0.3} r="1.8" fill="#111" /><circle cx={cx-1.2} cy={y-1.2} r="1" fill={highlight} /></g>)}</>;
  }
}

function renderEyebrows(type: string, color: string) {
  const ly = 52, ry = 52;
  switch (type) {
    case 'thick':
      return <><path d="M32 52 Q40 47 47 52" stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" /><path d="M53 52 Q60 47 68 52" stroke={color} strokeWidth="3.5" fill="none" strokeLinecap="round" /></>;
    case 'thin':
      return <><path d="M34 52 Q40 50 46 52" stroke={color} strokeWidth="1.2" fill="none" /><path d="M54 52 Q60 50 66 52" stroke={color} strokeWidth="1.2" fill="none" /></>;
    case 'arched':
      return <><path d="M32 54 Q40 44 47 52" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M53 52 Q60 44 68 54" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>;
    case 'angry':
      return <><path d="M32 50 L47 54" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M53 54 L68 50" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>;
    case 'raised':
      return <><path d="M33 50 Q40 42 47 50" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /><path d="M53 50 Q60 42 67 50" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" /></>;
    case 'unibrow':
      return <path d="M32 52 Q40 47 50 50 Q60 47 68 52" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    default:
      return <><path d="M33 52 Q40 49 46 52" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" /><path d="M54 52 Q60 49 67 52" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" /></>;
  }
}

function renderNose(type: string) {
  switch (type) {
    case 'medium':
      return <path d="M48 68 C47 72 50 74 53 72" stroke="#00000028" strokeWidth="1.5" fill="none" strokeLinecap="round" />;
    case 'round':
      return <><circle cx="50" cy="71" r="3.5" fill="#00000008" /><path d="M47 72 C48 74 52 74 53 72" stroke="#00000025" strokeWidth="1" fill="none" /></>;
    case 'pointed':
      return <path d="M50 66 L47 73 C48 74 52 74 53 73 Z" fill="#00000008" stroke="#00000020" strokeWidth="0.8" />;
    case 'button':
      return <circle cx="50" cy="70" r="2.5" fill="#00000012" stroke="#00000018" strokeWidth="0.5" />;
    case 'wide':
      return <path d="M46 71 C46 74 54 74 54 71" stroke="#00000025" strokeWidth="1.5" fill="#00000008" />;
    default:
      return <path d="M49 68 C49 72 51 72 51 68" stroke="#00000022" strokeWidth="1.2" fill="none" strokeLinecap="round" />;
  }
}

function renderMouth(type: string) {
  switch (type) {
    case 'grin':
      return <><path d="M38 78 Q50 88 62 78" stroke="#B03A2E" strokeWidth="2" fill="#E74C3C" /><path d="M42 78 L58 78" stroke="white" strokeWidth="1" opacity="0.5" /></>;
    case 'neutral':
      return <line x1="42" y1="79" x2="58" y2="79" stroke="#B03A2E" strokeWidth="2" strokeLinecap="round" />;
    case 'smirk':
      return <path d="M42 79 Q52 83 60 77" stroke="#B03A2E" strokeWidth="2" fill="none" strokeLinecap="round" />;
    case 'open':
      return <><ellipse cx="50" cy="79" rx="8" ry="5.5" fill="#B03A2E" /><ellipse cx="50" cy="81" rx="5" ry="2.5" fill="#8B2020" /></>;
    case 'tongue':
      return <><path d="M38 78 Q50 85 62 78" stroke="#B03A2E" strokeWidth="2" fill="none" /><ellipse cx="50" cy="83" rx="5" ry="3.5" fill="#E74C3C" /></>;
    case 'teeth':
      return <><path d="M38 77 Q50 85 62 77" stroke="#B03A2E" strokeWidth="2" fill="white" /><line x1="47" y1="77" x2="47" y2="82" stroke="#E5E7EB" strokeWidth="0.5" /><line x1="53" y1="77" x2="53" y2="82" stroke="#E5E7EB" strokeWidth="0.5" /></>;
    case 'kiss':
      return <circle cx="50" cy="79" r="3.5" fill="#E74C3C" stroke="#B03A2E" strokeWidth="1" />;
    default: // smile
      return <path d="M38 77 Q50 85 62 77" stroke="#B03A2E" strokeWidth="2" fill="none" strokeLinecap="round" />;
  }
}

function renderFacialHair(type: string, color: string) {
  switch (type) {
    case 'stubble':
      return <><circle cx="42" cy="80" r="0.5" fill={color} opacity="0.3" /><circle cx="45" cy="82" r="0.5" fill={color} opacity="0.3" /><circle cx="48" cy="84" r="0.5" fill={color} opacity="0.3" /><circle cx="52" cy="84" r="0.5" fill={color} opacity="0.3" /><circle cx="55" cy="82" r="0.5" fill={color} opacity="0.3" /><circle cx="58" cy="80" r="0.5" fill={color} opacity="0.3" /><circle cx="50" cy="86" r="0.5" fill={color} opacity="0.3" /></>;
    case 'mustache':
      return <path d="M40 75 Q45 78 50 76 Q55 78 60 75" stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round" />;
    case 'goatee':
      return <><path d="M45 83 Q50 90 55 83" stroke={color} strokeWidth="2" fill={color} opacity="0.6" /></>;
    case 'beard':
      return <><path d="M32 72 C32 92 42 98 50 98 C58 98 68 92 68 72" fill={color} opacity="0.5" /><path d="M34 74 C34 90 43 95 50 95 C57 95 66 90 66 74" fill={color} opacity="0.3" /></>;
    default:
      return null;
  }
}

function renderAccessory(type: string) {
  switch (type) {
    case 'glasses':
      return <><circle cx="40" cy="62" r="8" fill="none" stroke="#374151" strokeWidth="1.8" /><circle cx="60" cy="62" r="8" fill="none" stroke="#374151" strokeWidth="1.8" /><line x1="48" y1="62" x2="52" y2="62" stroke="#374151" strokeWidth="1.8" /><line x1="32" y1="60" x2="26" y2="58" stroke="#374151" strokeWidth="1.5" /><line x1="68" y1="60" x2="74" y2="58" stroke="#374151" strokeWidth="1.5" /></>;
    case 'roundglasses':
      return <><circle cx="40" cy="62" r="7" fill="none" stroke="#D97706" strokeWidth="1.5" /><circle cx="60" cy="62" r="7" fill="none" stroke="#D97706" strokeWidth="1.5" /><path d="M47 62 Q50 60 53 62" stroke="#D97706" strokeWidth="1.5" fill="none" /><line x1="33" y1="60" x2="27" y2="58" stroke="#D97706" strokeWidth="1.2" /><line x1="67" y1="60" x2="73" y2="58" stroke="#D97706" strokeWidth="1.2" /></>;
    case 'sunglasses':
      return <><rect x="32" y="57" width="16" height="11" rx="3" fill="#1F2937" opacity="0.85" /><rect x="52" y="57" width="16" height="11" rx="3" fill="#1F2937" opacity="0.85" /><line x1="48" y1="62" x2="52" y2="62" stroke="#1F2937" strokeWidth="2" /><line x1="32" y1="60" x2="26" y2="58" stroke="#1F2937" strokeWidth="1.5" /><line x1="68" y1="60" x2="74" y2="58" stroke="#1F2937" strokeWidth="1.5" /><rect x="34" y="58" width="12" height="4" rx="1" fill="white" opacity="0.1" /></>;
    case 'cap':
      return <><ellipse cx="50" cy="42" rx="24" ry="9" fill="#3B82F6" /><path d="M26 42 C26 30 74 30 74 42" fill="#3B82F6" /><rect x="70" y="39" width="14" height="5" rx="2" fill="#2563EB" /><ellipse cx="50" cy="42" rx="22" ry="6" fill="#2563EB" opacity="0.3" /></>;
    case 'beanie':
      return <><path d="M26 50 C26 30 74 30 74 50" fill="#EF4444" /><rect x="26" y="47" width="48" height="6" fill={darken('#EF4444', 20)} rx="1" /><circle cx="50" cy="24" r="4" fill="#EF4444" /></>;
    case 'headphones':
      return <><path d="M26 58 C26 38 74 38 74 58" stroke="#374151" strokeWidth="3.5" fill="none" /><rect x="22" y="54" width="9" height="14" rx="4.5" fill="#374151" /><rect x="69" y="54" width="9" height="14" rx="4.5" fill="#374151" /><rect x="24" y="57" width="5" height="8" rx="2" fill="#555" /></>;
    case 'earrings':
      return <><circle cx="26" cy="70" r="3.5" fill="#EAB308" /><circle cx="26" cy="70" r="1.5" fill="#FDE68A" /><circle cx="74" cy="70" r="3.5" fill="#EAB308" /><circle cx="74" cy="70" r="1.5" fill="#FDE68A" /></>;
    case 'bandana':
      return <><path d="M26 50 C26 42 74 42 74 50" fill="#EF4444" /><path d="M26 50 L22 58 L18 56" stroke="#EF4444" strokeWidth="3.5" fill="none" strokeLinecap="round" /><circle cx="50" cy="46" r="2" fill="#FBBF24" /></>;
    case 'crown':
      return <><defs><linearGradient id="crown-grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FDE68A" /><stop offset="100%" stopColor="#D97706" /></linearGradient></defs><polygon points="32,40 36,22 42,36 48,18 54,36 60,22 64,40" fill="url(#crown-grad)" stroke="#B45309" strokeWidth="0.8" /><rect x="32" y="40" width="32" height="6" rx="1" fill="url(#crown-grad)" stroke="#B45309" strokeWidth="0.5" /><circle cx="42" cy="30" r="2" fill="#E11D48" /><circle cx="50" cy="24" r="2.5" fill="#3B82F6" /><circle cx="58" cy="30" r="2" fill="#22C55E" /></>;
    case 'halo':
      return <><ellipse cx="50" cy="30" rx="20" ry="6" fill="none" stroke="#EAB308" strokeWidth="3.5" opacity="0.7" /><ellipse cx="50" cy="30" rx="18" ry="5" fill="none" stroke="#FDE68A" strokeWidth="1.5" opacity="0.5" /></>;
    case 'horns':
      return <><path d="M30 44 C26 30 22 18 28 12" stroke="#EF4444" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M70 44 C74 30 78 18 72 12" stroke="#EF4444" strokeWidth="5" fill="none" strokeLinecap="round" /><path d="M30 44 C27 32 24 22 28 14" stroke="#B91C1C" strokeWidth="2" fill="none" opacity="0.3" /></>;
    case 'tiara':
      return <><path d="M34 42 L38 30 L44 38 L50 26 L56 38 L62 30 L66 42" fill="none" stroke="#EC4899" strokeWidth="2" /><circle cx="50" cy="28" r="3" fill="#EC4899" /><circle cx="50" cy="28" r="1.5" fill="#FDE68A" /></>;
    default:
      return null;
  }
}

function renderOutfit(type: string, color: string, uid: string) {
  const darker = darken(color, 30);
  const lighter = lighten(color, 40);
  switch (type) {
    case 'polo':
      return <><path d="M28 98 C28 90 72 90 72 98 L76 135 L24 135 Z" fill={color} /><path d="M28 98 L18 105 L18 115 L28 110 Z" fill={color} /><path d="M72 98 L82 105 L82 115 L72 110 Z" fill={color} /><path d="M43 90 Q50 97 57 90" fill={lighter} opacity="0.4" /><line x1="50" y1="90" x2="50" y2="102" stroke={darker} strokeWidth="0.8" opacity="0.3" /></>;
    case 'hoodie':
      return <><path d="M24 96 C24 88 76 88 76 96 L80 135 L20 135 Z" fill={color} /><path d="M24 96 L14 104 L14 118 L24 112 Z" fill={color} /><path d="M76 96 L86 104 L86 118 L76 112 Z" fill={color} /><path d="M40 88 Q50 96 60 88" fill={color} stroke={darker} strokeWidth="1" opacity="0.5" /><ellipse cx="50" cy="112" rx="6" ry="3.5" fill={darker} opacity="0.15" /><path d="M44 88 L42 106" stroke={darker} strokeWidth="1.5" opacity="0.15" /><path d="M56 88 L58 106" stroke={darker} strokeWidth="1.5" opacity="0.15" /></>;
    case 'jacket':
      return <><path d="M26 96 C26 88 74 88 74 96 L78 135 L22 135 Z" fill={color} /><path d="M26 96 L16 104 L16 118 L26 112 Z" fill={color} /><path d="M74 96 L84 104 L84 118 L74 112 Z" fill={color} /><line x1="50" y1="90" x2="50" y2="135" stroke={darker} strokeWidth="1.5" /><rect x="44" y="108" width="4" height="4" rx="1" fill={darker} opacity="0.3" /><rect x="52" y="108" width="4" height="4" rx="1" fill={darker} opacity="0.3" /><path d="M38 90 L26 96" stroke={darker} strokeWidth="1" opacity="0.2" /><path d="M62 90 L74 96" stroke={darker} strokeWidth="1" opacity="0.2" /></>;
    case 'blazer':
      return <><path d="M26 96 C26 88 74 88 74 96 L78 135 L22 135 Z" fill={color} /><path d="M26 96 L16 104 L16 118 L26 112 Z" fill={color} /><path d="M74 96 L84 104 L84 118 L74 112 Z" fill={color} /><path d="M50 90 L44 135" stroke={darker} strokeWidth="1" opacity="0.3" /><path d="M50 90 L56 135" stroke={darker} strokeWidth="1" opacity="0.3" /><path d="M42 90 Q50 96 58 90" fill="white" /><rect x="48" y="104" width="4" height="2.5" rx="1" fill={darker} opacity="0.4" /></>;
    case 'dress':
      return <><path d="M30 96 C30 88 70 88 70 96 L78 135 L22 135 Z" fill={color} /><path d="M30 96 L22 104 L22 110 L30 106 Z" fill={color} /><path d="M70 96 L78 104 L78 110 L70 106 Z" fill={color} /><path d="M22 125 Q50 130 78 125" stroke={lighter} strokeWidth="1" opacity="0.3" /><path d="M22 120 Q50 125 78 120" stroke={lighter} strokeWidth="1" opacity="0.2" /></>;
    case 'labcoat':
      return <><path d="M22 96 C22 86 78 86 78 96 L82 135 L18 135 Z" fill="white" stroke="#E5E7EB" strokeWidth="1" /><path d="M22 96 L12 104 L12 118 L22 112 Z" fill="white" stroke="#E5E7EB" strokeWidth="0.5" /><path d="M78 96 L88 104 L88 118 L78 112 Z" fill="white" stroke="#E5E7EB" strokeWidth="0.5" /><rect x="30" y="108" width="9" height="10" rx="1" fill="none" stroke="#E5E7EB" strokeWidth="0.8" /><circle cx="36" cy="98" r="2.5" fill="#3B82F6" /><line x1="50" y1="90" x2="50" y2="135" stroke="#E5E7EB" strokeWidth="0.8" /></>;
    case 'superhero':
      return <><path d="M28 96 C28 88 72 88 72 96 L76 135 L24 135 Z" fill={color} /><path d="M28 96 L18 104 L18 118 L28 112 Z" fill={color} /><path d="M72 96 L82 104 L82 118 L72 112 Z" fill={color} /><path d="M40 100 L50 112 L60 100 L55 100 L50 106 L45 100 Z" fill="#EAB308" /><path d="M26 96 C18 108 16 125 24 135 L22 135" fill={color} opacity="0.5" /><path d="M74 96 C82 108 84 125 76 135 L78 135" fill={color} opacity="0.5" /></>;
    case 'golden':
      return <><defs><linearGradient id={`gold-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EAB308" /><stop offset="50%" stopColor="#FDE68A" /><stop offset="100%" stopColor="#D97706" /></linearGradient></defs><path d="M28 96 C28 88 72 88 72 96 L76 135 L24 135 Z" fill={`url(#gold-${uid})`} /><path d="M28 96 L18 104 L18 118 L28 112 Z" fill={`url(#gold-${uid})`} /><path d="M72 96 L82 104 L82 118 L72 112 Z" fill={`url(#gold-${uid})`} /><text x="50" y="115" textAnchor="middle" fontSize="14" fill="#92400E" opacity="0.6">★</text></>;
    case 'cape':
      return <><path d="M28 96 C28 88 72 88 72 96 L76 135 L24 135 Z" fill={color} /><path d="M28 96 L18 104 L18 118 L28 112 Z" fill={color} /><path d="M72 96 L82 104 L82 118 L72 112 Z" fill={color} /><path d="M26 96 C16 112 12 130 22 135 L20 135" fill={color} opacity="0.55" /><path d="M74 96 C84 112 88 130 78 135 L80 135" fill={color} opacity="0.55" /><path d="M26 96 C18 110 15 128 22 135" stroke={lighter} strokeWidth="0.5" fill="none" opacity="0.3" /></>;
    case 'legendary':
      return <><defs><linearGradient id={`legend-${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC4899" /><stop offset="50%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#3B82F6" /></linearGradient></defs><path d="M28 96 C28 88 72 88 72 96 L76 135 L24 135 Z" fill={`url(#legend-${uid})`} /><path d="M28 96 L18 104 L18 118 L28 112 Z" fill={`url(#legend-${uid})`} /><path d="M72 96 L82 104 L82 118 L72 112 Z" fill={`url(#legend-${uid})`} /><text x="50" y="115" textAnchor="middle" fontSize="16" fill="white" opacity="0.7">✦</text></>;
    default: // tshirt
      return <><path d="M28 96 C28 88 72 88 72 96 L74 135 L26 135 Z" fill={color} /><path d="M28 96 L18 104 L18 118 L28 112 Z" fill={color} /><path d="M72 96 L82 104 L82 118 L72 112 Z" fill={color} /><path d="M34 96 Q50 100 66 96" stroke={darker} strokeWidth="0.5" opacity="0.2" /></>;
  }
}

// ============ MAIN FULL-BODY COMPONENT ============
interface AvatarSVGProps {
  config: FullAvatarConfig;
  size?: number;
  className?: string;
  bustOnly?: boolean;
}

export const AvatarSVG: React.FC<AvatarSVGProps> = ({ config, size = 100, className, bustOnly = false }) => {
  const skinColor = getSkinColor(config.skinTone);
  const skinShadow = darken(skinColor, 20);
  const skinHighlight = lighten(skinColor, 25);
  const hairCol = getHairColor(config.hairColor);
  const eyeCol = getEyeColor(config.eyeColor);
  const outfitCol = getOutfitColor(config.outfitColor);
  const bg = getBackground(config.background);
  const face = getFaceShape(config.faceShape || 'oval');
  const uid = `av-${config.skinTone}-${config.background}`;

  const viewBox = bustOnly ? '10 20 80 80' : '0 0 100 140';

  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      className={className}
      style={{ borderRadius: '50%', overflow: 'hidden' }}
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor={bg[0]} />
          <stop offset="100%" stopColor={bg[1]} />
        </linearGradient>
        <radialGradient id={`skin-${uid}`} cx="0.4" cy="0.35" r="0.65">
          <stop offset="0%" stopColor={skinHighlight} />
          <stop offset="70%" stopColor={skinColor} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        <filter id={`shadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" />
        </filter>
      </defs>

      {/* Background */}
      <rect x="-10" y="-10" width="120" height="160" fill={`url(#bg-${uid})`} />

      {/* Body / Outfit */}
      <g filter={`url(#shadow-${uid})`}>
        {renderOutfit(config.outfit, outfitCol, uid)}
      </g>

      {/* Neck with shadow */}
      <rect x="43" y="86" width="14" height="12" rx="3" fill={skinColor} />
      <rect x="43" y="86" width="14" height="4" rx="2" fill={skinShadow} opacity="0.15" />

      {/* Head with gradient for 3D depth */}
      <g filter={`url(#shadow-${uid})`}>
        <path d={face.head} fill={`url(#skin-${uid})`} />
        {/* Cheek blush */}
        <ellipse cx="34" cy="72" rx="5" ry="3" fill="#FF9999" opacity="0.12" />
        <ellipse cx="66" cy="72" rx="5" ry="3" fill="#FF9999" opacity="0.12" />
      </g>

      {/* Ears with shadow */}
      <ellipse cx="25" cy="64" rx="4.5" ry="6.5" fill={skinColor} />
      <ellipse cx="25" cy="64" rx="2.5" ry="4" fill={skinShadow} opacity="0.1" />
      <ellipse cx="75" cy="64" rx="4.5" ry="6.5" fill={skinColor} />
      <ellipse cx="75" cy="64" rx="2.5" ry="4" fill={skinShadow} opacity="0.1" />

      {/* Hair */}
      {config.hairStyle !== 'none' && renderHair(config.hairStyle, hairCol, config.faceShape || 'oval')}

      {/* Eyebrows */}
      {renderEyebrows(config.eyebrowType, hairCol)}

      {/* Eyes */}
      {renderEyes(config.eyeType, eyeCol)}

      {/* Nose */}
      {renderNose(config.noseType)}

      {/* Mouth */}
      {renderMouth(config.mouthType)}

      {/* Facial Hair */}
      {renderFacialHair(config.facialHair || 'none', hairCol)}

      {/* Accessory */}
      {renderAccessory(config.accessory)}

      {/* Subtle face highlight for 3D effect */}
      <ellipse cx="42" cy="55" rx="8" ry="12" fill="white" opacity="0.04" />
    </svg>
  );
};

// ============ COMPACT BUBBLE ============
export const AvatarBubble: React.FC<{
  config: FullAvatarConfig;
  size?: number;
  className?: string;
  showRing?: boolean;
  ringColor?: string;
}> = ({ config, size = 40, className, showRing = false, ringColor }) => (
  <div
    className={className}
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      overflow: 'hidden',
      flexShrink: 0,
      border: showRing ? `2px solid ${ringColor || 'hsl(var(--primary))'}` : undefined,
      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    }}
  >
    <AvatarSVG config={config} size={size} bustOnly />
  </div>
);
