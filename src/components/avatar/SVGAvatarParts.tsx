import React from 'react';

// ============ SKIN TONES ============
export const SKIN_TONES = [
  { id: 'fair', color: '#FDEBD0', label: 'Fair' },
  { id: 'light', color: '#F5CBA7', label: 'Light' },
  { id: 'medium', color: '#D4A574', label: 'Medium' },
  { id: 'olive', color: '#C4A882', label: 'Olive' },
  { id: 'tan', color: '#C68642', label: 'Tan' },
  { id: 'brown', color: '#8D5524', label: 'Brown' },
  { id: 'dark', color: '#5C3317', label: 'Dark' },
  { id: 'deep', color: '#3B1F0B', label: 'Deep' },
];

// ============ HAIR STYLES ============
export const HAIR_STYLES = [
  { id: 'none', label: 'Bald', level: 1 },
  { id: 'short', label: 'Short', level: 1 },
  { id: 'medium', label: 'Medium', level: 1 },
  { id: 'long', label: 'Long', level: 1 },
  { id: 'curly', label: 'Curly', level: 2 },
  { id: 'wavy', label: 'Wavy', level: 2 },
  { id: 'buzz', label: 'Buzz', level: 1 },
  { id: 'mohawk', label: 'Mohawk', level: 5 },
  { id: 'afro', label: 'Afro', level: 3 },
  { id: 'braids', label: 'Braids', level: 4 },
  { id: 'ponytail', label: 'Ponytail', level: 2 },
  { id: 'spiky', label: 'Spiky', level: 6 },
];

export const HAIR_COLORS = [
  { id: 'black', color: '#1a1a1a', label: 'Black' },
  { id: 'brown', color: '#6B3A2A', label: 'Brown' },
  { id: 'blonde', color: '#D4A017', label: 'Blonde' },
  { id: 'red', color: '#C0392B', label: 'Red' },
  { id: 'auburn', color: '#8B4513', label: 'Auburn' },
  { id: 'gray', color: '#95A5A6', label: 'Gray' },
  { id: 'blue', color: '#3498DB', label: 'Blue', level: 5 },
  { id: 'purple', color: '#9B59B6', label: 'Purple', level: 7 },
  { id: 'pink', color: '#E91E8C', label: 'Pink', level: 8 },
  { id: 'green', color: '#27AE60', label: 'Green', level: 10 },
];

// ============ EYE TYPES ============
export const EYE_TYPES = [
  { id: 'normal', label: 'Normal', level: 1 },
  { id: 'round', label: 'Round', level: 1 },
  { id: 'almond', label: 'Almond', level: 1 },
  { id: 'narrow', label: 'Narrow', level: 1 },
  { id: 'wink', label: 'Wink', level: 3 },
  { id: 'happy', label: 'Happy', level: 2 },
  { id: 'star', label: 'Star', level: 8 },
  { id: 'heart', label: 'Heart', level: 10 },
];

export const EYE_COLORS = [
  { id: 'brown', color: '#5D4037', label: 'Brown' },
  { id: 'blue', color: '#1976D2', label: 'Blue' },
  { id: 'green', color: '#388E3C', label: 'Green' },
  { id: 'hazel', color: '#8D6E63', label: 'Hazel' },
  { id: 'gray', color: '#78909C', label: 'Gray' },
  { id: 'amber', color: '#FF8F00', label: 'Amber', level: 5 },
  { id: 'violet', color: '#7B1FA2', label: 'Violet', level: 8 },
];

// ============ MOUTH TYPES ============
export const MOUTH_TYPES = [
  { id: 'smile', label: 'Smile', level: 1 },
  { id: 'grin', label: 'Grin', level: 1 },
  { id: 'neutral', label: 'Neutral', level: 1 },
  { id: 'smirk', label: 'Smirk', level: 2 },
  { id: 'open', label: 'Open', level: 2 },
  { id: 'tongue', label: 'Tongue', level: 4 },
  { id: 'teeth', label: 'Teeth', level: 3 },
];

// ============ NOSE TYPES ============
export const NOSE_TYPES = [
  { id: 'small', label: 'Small', level: 1 },
  { id: 'medium', label: 'Medium', level: 1 },
  { id: 'round', label: 'Round', level: 1 },
  { id: 'pointed', label: 'Pointed', level: 2 },
  { id: 'button', label: 'Button', level: 1 },
];

// ============ EYEBROW TYPES ============
export const EYEBROW_TYPES = [
  { id: 'normal', label: 'Normal', level: 1 },
  { id: 'thick', label: 'Thick', level: 1 },
  { id: 'thin', label: 'Thin', level: 1 },
  { id: 'arched', label: 'Arched', level: 2 },
  { id: 'angry', label: 'Angry', level: 3 },
  { id: 'raised', label: 'Raised', level: 2 },
];

// ============ ACCESSORIES ============
export const ACCESSORIES = [
  { id: 'none', label: 'None', emoji: '❌', level: 1 },
  { id: 'glasses', label: 'Glasses', emoji: '👓', level: 1 },
  { id: 'sunglasses', label: 'Sunglasses', emoji: '🕶️', level: 2 },
  { id: 'cap', label: 'Cap', emoji: '🧢', level: 2 },
  { id: 'headphones', label: 'Headphones', emoji: '🎧', level: 3 },
  { id: 'earrings', label: 'Earrings', emoji: '💎', level: 4 },
  { id: 'bandana', label: 'Bandana', emoji: '🎀', level: 3 },
  { id: 'crown', label: 'Crown', emoji: '👑', level: 10 },
  { id: 'halo', label: 'Halo', emoji: '😇', level: 15 },
  { id: 'horns', label: 'Horns', emoji: '😈', level: 12 },
];

// ============ OUTFITS ============
export const OUTFITS = [
  { id: 'tshirt', label: 'T-Shirt', emoji: '👕', color: '#3B82F6', level: 1 },
  { id: 'polo', label: 'Polo', emoji: '👕', color: '#22C55E', level: 1 },
  { id: 'hoodie', label: 'Hoodie', emoji: '🧥', color: '#6B7280', level: 3 },
  { id: 'jacket', label: 'Jacket', emoji: '🧥', color: '#1E3A5F', level: 5 },
  { id: 'blazer', label: 'Blazer', emoji: '👔', color: '#1F2937', level: 5 },
  { id: 'labcoat', label: 'Lab Coat', emoji: '🔬', color: '#F3F4F6', level: 7 },
  { id: 'superhero', label: 'Superhero', emoji: '🦸', color: '#EF4444', level: 10 },
  { id: 'golden', label: 'Golden', emoji: '✨', color: '#F59E0B', level: 15 },
  { id: 'cape', label: 'Cape', emoji: '🧙', color: '#7C3AED', level: 20 },
  { id: 'legendary', label: 'Legendary', emoji: '🌟', color: '#EC4899', level: 50 },
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
  { id: 'gold', color: '#EAB308', label: 'Gold', level: 10 },
];

// ============ BACKGROUNDS ============
export const BACKGROUNDS = [
  { id: 'sky', gradient: ['#87CEEB', '#3B82F6'], label: 'Sky', level: 1 },
  { id: 'sunset', gradient: ['#F97316', '#EC4899'], label: 'Sunset', level: 1 },
  { id: 'forest', gradient: ['#22C55E', '#059669'], label: 'Forest', level: 2 },
  { id: 'ocean', gradient: ['#06B6D4', '#2563EB'], label: 'Ocean', level: 2 },
  { id: 'rose', gradient: ['#F472B6', '#E11D48'], label: 'Rose', level: 3 },
  { id: 'galaxy', gradient: ['#7C3AED', '#312E81'], label: 'Galaxy', level: 5 },
  { id: 'fire', gradient: ['#EF4444', '#F97316'], label: 'Fire', level: 6 },
  { id: 'aurora', gradient: ['#22C55E', '#7C3AED'], label: 'Aurora', level: 8 },
  { id: 'gold', gradient: ['#EAB308', '#D97706'], label: 'Gold', level: 10 },
  { id: 'cosmic', gradient: ['#EC4899', '#3B82F6'], label: 'Cosmic', level: 15 },
];

// ============ FULL CONFIG ============
export interface FullAvatarConfig {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  eyeType: string;
  eyeColor: string;
  eyebrowType: string;
  noseType: string;
  mouthType: string;
  accessory: string;
  outfit: string;
  outfitColor: string;
  background: string;
}

export const DEFAULT_AVATAR_CONFIG: FullAvatarConfig = {
  skinTone: 'medium',
  hairStyle: 'short',
  hairColor: 'brown',
  eyeType: 'normal',
  eyeColor: 'brown',
  eyebrowType: 'normal',
  noseType: 'small',
  mouthType: 'smile',
  accessory: 'none',
  outfit: 'tshirt',
  outfitColor: 'blue',
  background: 'sky',
};

// ============ SVG RENDER HELPERS ============

const getSkinColor = (id: string) => SKIN_TONES.find(s => s.id === id)?.color || '#D4A574';
const getHairColor = (id: string) => HAIR_COLORS.find(h => h.id === id)?.color || '#6B3A2A';
const getEyeColor = (id: string) => EYE_COLORS.find(e => e.id === id)?.color || '#5D4037';
const getOutfitColor = (id: string) => OUTFIT_COLORS.find(o => o.id === id)?.color || '#3B82F6';
const getBackground = (id: string) => BACKGROUNDS.find(b => b.id === id)?.gradient || ['#87CEEB', '#3B82F6'];

// Hair SVG paths
function renderHair(style: string, color: string) {
  switch (style) {
    case 'short':
      return <path d="M30 55 C30 35 70 35 70 55 C70 40 60 30 50 30 C40 30 30 40 30 55Z" fill={color} />;
    case 'medium':
      return <><path d="M25 55 C25 30 75 30 75 55 C75 35 65 25 50 25 C35 25 25 35 25 55Z" fill={color} /><path d="M25 55 C22 65 22 75 25 80" stroke={color} strokeWidth="4" fill="none" /><path d="M75 55 C78 65 78 75 75 80" stroke={color} strokeWidth="4" fill="none" /></>;
    case 'long':
      return <><path d="M22 55 C22 28 78 28 78 55 C78 30 65 22 50 22 C35 22 22 30 22 55Z" fill={color} /><path d="M22 55 C18 70 18 85 22 95" stroke={color} strokeWidth="5" fill="none" /><path d="M78 55 C82 70 82 85 78 95" stroke={color} strokeWidth="5" fill="none" /></>;
    case 'curly':
      return <><path d="M28 55 C28 32 72 32 72 55 C72 38 62 28 50 28 C38 28 28 38 28 55Z" fill={color} /><circle cx="30" cy="45" r="6" fill={color} /><circle cx="70" cy="45" r="6" fill={color} /><circle cx="35" cy="35" r="5" fill={color} /><circle cx="65" cy="35" r="5" fill={color} /><circle cx="50" cy="30" r="5" fill={color} /></>;
    case 'wavy':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 35 63 25 50 25 C37 25 26 35 26 55Z" fill={color} /><path d="M26 55 Q20 65 26 75 Q32 85 26 95" stroke={color} strokeWidth="4" fill="none" /><path d="M74 55 Q80 65 74 75 Q68 85 74 95" stroke={color} strokeWidth="4" fill="none" /></>;
    case 'buzz':
      return <path d="M32 52 C32 38 68 38 68 52 C68 42 62 35 50 35 C38 35 32 42 32 52Z" fill={color} opacity="0.7" />;
    case 'mohawk':
      return <path d="M44 55 C44 18 56 18 56 55 C56 20 52 10 50 10 C48 10 44 20 44 55Z" fill={color} />;
    case 'afro':
      return <circle cx="50" cy="42" r="25" fill={color} />;
    case 'braids':
      return <><path d="M26 55 C26 30 74 30 74 55 C74 35 63 25 50 25 C37 25 26 35 26 55Z" fill={color} /><path d="M30 55 L28 95" stroke={color} strokeWidth="4" /><path d="M70 55 L72 95" stroke={color} strokeWidth="4" /><circle cx="28" cy="97" r="3" fill={color} /><circle cx="72" cy="97" r="3" fill={color} /></>;
    case 'ponytail':
      return <><path d="M28 55 C28 32 72 32 72 55 C72 38 62 28 50 28 C38 28 28 38 28 55Z" fill={color} /><path d="M55 30 C65 28 72 35 70 50 C72 60 68 75 60 80" stroke={color} strokeWidth="5" fill="none" /></>;
    case 'spiky':
      return <><path d="M30 55 C30 38 70 38 70 55" fill={color} /><polygon points="35,38 38,15 42,38" fill={color} /><polygon points="45,35 50,8 55,35" fill={color} /><polygon points="58,38 62,15 65,38" fill={color} /></>;
    default:
      return null;
  }
}

// Eye rendering
function renderEyes(type: string, eyeColor: string) {
  const leftX = 40, rightX = 60, y = 58;
  switch (type) {
    case 'round':
      return <><circle cx={leftX} cy={y} r="5" fill="white" /><circle cx={leftX} cy={y} r="3" fill={eyeColor} /><circle cx={leftX-1} cy={y-1} r="1" fill="white" /><circle cx={rightX} cy={y} r="5" fill="white" /><circle cx={rightX} cy={y} r="3" fill={eyeColor} /><circle cx={rightX-1} cy={y-1} r="1" fill="white" /></>;
    case 'almond':
      return <><ellipse cx={leftX} cy={y} rx="6" ry="4" fill="white" /><circle cx={leftX} cy={y} r="2.5" fill={eyeColor} /><circle cx={leftX-0.5} cy={y-0.5} r="0.8" fill="white" /><ellipse cx={rightX} cy={y} rx="6" ry="4" fill="white" /><circle cx={rightX} cy={y} r="2.5" fill={eyeColor} /><circle cx={rightX-0.5} cy={y-0.5} r="0.8" fill="white" /></>;
    case 'narrow':
      return <><ellipse cx={leftX} cy={y} rx="6" ry="2.5" fill="white" /><circle cx={leftX} cy={y} r="2" fill={eyeColor} /><ellipse cx={rightX} cy={y} rx="6" ry="2.5" fill="white" /><circle cx={rightX} cy={y} r="2" fill={eyeColor} /></>;
    case 'wink':
      return <><circle cx={leftX} cy={y} r="4.5" fill="white" /><circle cx={leftX} cy={y} r="2.5" fill={eyeColor} /><circle cx={leftX-0.5} cy={y-0.5} r="0.8" fill="white" /><path d={`M${rightX-5} ${y} Q${rightX} ${y-4} ${rightX+5} ${y}`} stroke={eyeColor} strokeWidth="2" fill="none" /></>;
    case 'happy':
      return <><path d={`M${leftX-5} ${y} Q${leftX} ${y+4} ${leftX+5} ${y}`} stroke={eyeColor} strokeWidth="2" fill="none" /><path d={`M${rightX-5} ${y} Q${rightX} ${y+4} ${rightX+5} ${y}`} stroke={eyeColor} strokeWidth="2" fill="none" /></>;
    case 'star':
      return <><text x={leftX} y={y+4} textAnchor="middle" fontSize="10" fill={eyeColor}>★</text><text x={rightX} y={y+4} textAnchor="middle" fontSize="10" fill={eyeColor}>★</text></>;
    case 'heart':
      return <><text x={leftX} y={y+4} textAnchor="middle" fontSize="10" fill="#E11D48">♥</text><text x={rightX} y={y+4} textAnchor="middle" fontSize="10" fill="#E11D48">♥</text></>;
    default: // normal
      return <><circle cx={leftX} cy={y} r="4.5" fill="white" /><circle cx={leftX} cy={y} r="2.5" fill={eyeColor} /><circle cx={leftX-1} cy={y-1} r="1" fill="white" /><circle cx={rightX} cy={y} r="4.5" fill="white" /><circle cx={rightX} cy={y} r="2.5" fill={eyeColor} /><circle cx={rightX-1} cy={y-1} r="1" fill="white" /></>;
  }
}

// Eyebrow rendering
function renderEyebrows(type: string, hairColor: string) {
  const y = 50;
  switch (type) {
    case 'thick':
      return <><path d="M34 50 Q40 46 46 50" stroke={hairColor} strokeWidth="3" fill="none" /><path d="M54 50 Q60 46 66 50" stroke={hairColor} strokeWidth="3" fill="none" /></>;
    case 'thin':
      return <><path d="M35 50 Q40 48 45 50" stroke={hairColor} strokeWidth="1.2" fill="none" /><path d="M55 50 Q60 48 65 50" stroke={hairColor} strokeWidth="1.2" fill="none" /></>;
    case 'arched':
      return <><path d="M34 52 Q40 44 46 50" stroke={hairColor} strokeWidth="2" fill="none" /><path d="M54 50 Q60 44 66 52" stroke={hairColor} strokeWidth="2" fill="none" /></>;
    case 'angry':
      return <><path d="M34 48 L46 52" stroke={hairColor} strokeWidth="2.5" fill="none" /><path d="M54 52 L66 48" stroke={hairColor} strokeWidth="2.5" fill="none" /></>;
    case 'raised':
      return <><path d="M34 48 Q40 42 46 48" stroke={hairColor} strokeWidth="2" fill="none" /><path d="M54 48 Q60 42 66 48" stroke={hairColor} strokeWidth="2" fill="none" /></>;
    default: // normal
      return <><path d="M35 50 Q40 47 45 50" stroke={hairColor} strokeWidth="2" fill="none" /><path d="M55 50 Q60 47 65 50" stroke={hairColor} strokeWidth="2" fill="none" /></>;
  }
}

// Nose rendering
function renderNose(type: string, skinColor: string) {
  const darkerSkin = skinColor; // We'll just use a line
  switch (type) {
    case 'medium':
      return <path d="M48 63 C48 67 50 69 52 67" stroke="#00000030" strokeWidth="1.5" fill="none" />;
    case 'round':
      return <circle cx="50" cy="66" r="3" fill="#00000015" stroke="#00000025" strokeWidth="1" />;
    case 'pointed':
      return <path d="M50 62 L48 68 L52 68 Z" fill="#00000010" stroke="#00000025" strokeWidth="1" />;
    case 'button':
      return <circle cx="50" cy="66" r="2" fill="#00000015" />;
    default: // small
      return <path d="M49 64 C49 67 51 67 51 64" stroke="#00000025" strokeWidth="1.2" fill="none" />;
  }
}

// Mouth rendering
function renderMouth(type: string) {
  switch (type) {
    case 'grin':
      return <path d="M40 74 Q50 82 60 74" stroke="#C0392B" strokeWidth="2" fill="#E74C3C" />;
    case 'neutral':
      return <line x1="42" y1="75" x2="58" y2="75" stroke="#C0392B" strokeWidth="2" />;
    case 'smirk':
      return <path d="M42 75 Q52 78 58 73" stroke="#C0392B" strokeWidth="2" fill="none" />;
    case 'open':
      return <ellipse cx="50" cy="75" rx="7" ry="5" fill="#C0392B" />;
    case 'tongue':
      return <><path d="M40 74 Q50 80 60 74" stroke="#C0392B" strokeWidth="2" fill="none" /><ellipse cx="50" cy="79" rx="4" ry="3" fill="#E74C3C" /></>;
    case 'teeth':
      return <><path d="M40 73 Q50 80 60 73" stroke="#C0392B" strokeWidth="2" fill="white" /><line x1="50" y1="73" x2="50" y2="78" stroke="#E5E7EB" strokeWidth="0.5" /></>;
    default: // smile
      return <path d="M40 73 Q50 80 60 73" stroke="#C0392B" strokeWidth="2" fill="none" />;
  }
}

// Accessory rendering
function renderAccessory(type: string) {
  switch (type) {
    case 'glasses':
      return <><circle cx="40" cy="58" r="7" fill="none" stroke="#1F2937" strokeWidth="1.5" /><circle cx="60" cy="58" r="7" fill="none" stroke="#1F2937" strokeWidth="1.5" /><line x1="47" y1="58" x2="53" y2="58" stroke="#1F2937" strokeWidth="1.5" /><line x1="33" y1="58" x2="28" y2="56" stroke="#1F2937" strokeWidth="1.5" /><line x1="67" y1="58" x2="72" y2="56" stroke="#1F2937" strokeWidth="1.5" /></>;
    case 'sunglasses':
      return <><rect x="33" y="53" width="14" height="10" rx="2" fill="#1F2937" opacity="0.8" /><rect x="53" y="53" width="14" height="10" rx="2" fill="#1F2937" opacity="0.8" /><line x1="47" y1="58" x2="53" y2="58" stroke="#1F2937" strokeWidth="2" /><line x1="33" y1="56" x2="28" y2="54" stroke="#1F2937" strokeWidth="1.5" /><line x1="67" y1="56" x2="72" y2="54" stroke="#1F2937" strokeWidth="1.5" /></>;
    case 'cap':
      return <><ellipse cx="50" cy="40" rx="22" ry="8" fill="#3B82F6" /><path d="M28 40 C28 30 72 30 72 40" fill="#3B82F6" /><rect x="68" y="37" width="12" height="4" rx="1" fill="#2563EB" /></>;
    case 'headphones':
      return <><path d="M28 55 C28 38 72 38 72 55" stroke="#374151" strokeWidth="3" fill="none" /><rect x="24" y="52" width="8" height="12" rx="4" fill="#374151" /><rect x="68" y="52" width="8" height="12" rx="4" fill="#374151" /></>;
    case 'earrings':
      return <><circle cx="28" cy="65" r="3" fill="#EAB308" /><circle cx="72" cy="65" r="3" fill="#EAB308" /></>;
    case 'bandana':
      return <><path d="M28 48 C28 42 72 42 72 48" fill="#EF4444" /><path d="M28 48 L25 55" stroke="#EF4444" strokeWidth="3" /><path d="M28 48 L22 52" stroke="#EF4444" strokeWidth="3" /></>;
    case 'crown':
      return <><polygon points="35,38 38,25 42,35 46,22 50,35 54,22 58,35 62,25 65,38" fill="#EAB308" stroke="#D97706" strokeWidth="1" /><rect x="35" y="38" width="30" height="5" fill="#EAB308" stroke="#D97706" strokeWidth="0.5" /><circle cx="46" cy="30" r="2" fill="#E11D48" /><circle cx="50" cy="27" r="2" fill="#3B82F6" /><circle cx="54" cy="30" r="2" fill="#22C55E" /></>;
    case 'halo':
      return <ellipse cx="50" cy="28" rx="18" ry="5" fill="none" stroke="#EAB308" strokeWidth="3" opacity="0.8" />;
    case 'horns':
      return <><path d="M32 42 C28 30 25 20 30 15" stroke="#EF4444" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M68 42 C72 30 75 20 70 15" stroke="#EF4444" strokeWidth="4" fill="none" strokeLinecap="round" /></>;
    default:
      return null;
  }
}

// Outfit rendering  
function renderOutfit(type: string, color: string) {
  switch (type) {
    case 'polo':
      return <><path d="M30 88 C30 82 70 82 70 88 L75 120 L25 120 Z" fill={color} /><path d="M45 82 L45 90" stroke={color} strokeWidth="0.5" /><path d="M55 82 L55 90" stroke={color} strokeWidth="0.5" /><path d="M43 82 Q50 88 57 82" fill="white" opacity="0.3" /></>;
    case 'hoodie':
      return <><path d="M28 86 C28 80 72 80 72 86 L78 120 L22 120 Z" fill={color} /><path d="M42 86 Q50 92 58 86" fill={color} stroke="#00000015" strokeWidth="1" /><ellipse cx="50" cy="100" rx="5" ry="3" fill="#00000010" /></>;
    case 'jacket':
      return <><path d="M28 86 C28 80 72 80 72 86 L78 120 L22 120 Z" fill={color} /><line x1="50" y1="86" x2="50" y2="120" stroke="#00000020" strokeWidth="1" /><rect x="44" y="98" width="4" height="4" rx="1" fill="#00000015" /><rect x="52" y="98" width="4" height="4" rx="1" fill="#00000015" /></>;
    case 'blazer':
      return <><path d="M28 86 C28 80 72 80 72 86 L78 120 L22 120 Z" fill={color} /><path d="M50 86 L46 120" stroke="#00000020" strokeWidth="1" /><path d="M50 86 L54 120" stroke="#00000020" strokeWidth="1" /><path d="M44 86 Q50 92 56 86" fill="white" /><rect x="48" y="96" width="4" height="2" rx="1" fill="#00000030" /></>;
    case 'labcoat':
      return <><path d="M26 86 C26 78 74 78 74 86 L80 120 L20 120 Z" fill="white" stroke="#E5E7EB" strokeWidth="1" /><rect x="32" y="98" width="8" height="8" rx="1" fill="none" stroke="#E5E7EB" strokeWidth="0.8" /><circle cx="38" cy="90" r="2" fill="#3B82F6" /></>;
    case 'superhero':
      return <><path d="M30 86 C30 80 70 80 70 86 L75 120 L25 120 Z" fill={color} /><path d="M42 92 L50 100 L58 92 L54 92 L50 96 L46 92 Z" fill="#EAB308" /></>;
    case 'golden':
      return <><defs><linearGradient id="gold-outfit" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EAB308" /><stop offset="50%" stopColor="#FDE68A" /><stop offset="100%" stopColor="#D97706" /></linearGradient></defs><path d="M30 86 C30 80 70 80 70 86 L75 120 L25 120 Z" fill="url(#gold-outfit)" /><text x="50" y="104" textAnchor="middle" fontSize="12" fill="#92400E">★</text></>;
    case 'cape':
      return <><path d="M30 86 C30 80 70 80 70 86 L75 120 L25 120 Z" fill={color} /><path d="M28 86 C20 100 18 115 25 120 L22 120" fill={color} opacity="0.6" /><path d="M72 86 C80 100 82 115 75 120 L78 120" fill={color} opacity="0.6" /></>;
    case 'legendary':
      return <><defs><linearGradient id="legend-outfit" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC4899" /><stop offset="50%" stopColor="#8B5CF6" /><stop offset="100%" stopColor="#3B82F6" /></linearGradient></defs><path d="M30 86 C30 80 70 80 70 86 L75 120 L25 120 Z" fill="url(#legend-outfit)" /><text x="50" y="104" textAnchor="middle" fontSize="14" fill="white" opacity="0.8">✦</text></>;
    default: // tshirt
      return <><path d="M30 86 C30 80 70 80 70 86 L72 120 L28 120 Z" fill={color} /><path d="M20 86 L30 82 L30 98 L20 94 Z" fill={color} /><path d="M80 86 L70 82 L70 98 L80 94 Z" fill={color} /></>;
  }
}

// ============ MAIN RENDER COMPONENT ============
interface AvatarSVGProps {
  config: FullAvatarConfig;
  size?: number;
  className?: string;
  animate?: boolean;
}

export const AvatarSVG: React.FC<AvatarSVGProps> = ({ config, size = 100, className, animate = false }) => {
  const skinColor = getSkinColor(config.skinTone);
  const hairCol = getHairColor(config.hairColor);
  const eyeCol = getEyeColor(config.eyeColor);
  const outfitCol = getOutfitColor(config.outfitColor);
  const bg = getBackground(config.background);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      className={className}
      style={{ borderRadius: '50%', overflow: 'hidden' }}
    >
      {/* Background gradient */}
      <defs>
        <linearGradient id={`bg-${config.background}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg[0]} />
          <stop offset="100%" stopColor={bg[1]} />
        </linearGradient>
      </defs>
      <rect width="100" height="120" fill={`url(#bg-${config.background})`} />

      {/* Outfit (behind head) */}
      {renderOutfit(config.outfit, outfitCol)}

      {/* Neck */}
      <rect x="44" y="78" width="12" height="10" fill={skinColor} rx="2" />

      {/* Head */}
      <ellipse cx="50" cy="58" rx="24" ry="28" fill={skinColor} />

      {/* Hair (behind) */}
      {config.hairStyle !== 'none' && renderHair(config.hairStyle, hairCol)}

      {/* Eyebrows */}
      {renderEyebrows(config.eyebrowType, hairCol)}

      {/* Eyes */}
      {renderEyes(config.eyeType, eyeCol)}

      {/* Nose */}
      {renderNose(config.noseType, skinColor)}

      {/* Mouth */}
      {renderMouth(config.mouthType)}

      {/* Ears */}
      <ellipse cx="26" cy="60" rx="4" ry="6" fill={skinColor} />
      <ellipse cx="74" cy="60" rx="4" ry="6" fill={skinColor} />

      {/* Accessory */}
      {renderAccessory(config.accessory)}
    </svg>
  );
};

// Compact avatar for profile pics, comments, etc.
export const AvatarBubble: React.FC<{ config: FullAvatarConfig; size?: number; className?: string }> = ({
  config, size = 40, className
}) => (
  <div className={className} style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
    <AvatarSVG config={config} size={size} />
  </div>
);
