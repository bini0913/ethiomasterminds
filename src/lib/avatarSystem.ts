export type AvatarCategory =
  | 'face'
  | 'hair'
  | 'eyes'
  | 'eyebrows'
  | 'nose'
  | 'mouth'
  | 'skin'
  | 'glasses'
  | 'accessories'
  | 'clothes'
  | 'background'
  | 'aura';

export interface AvatarItem {
  id: string;
  category: AvatarCategory;
  name: string;
  assetUrl?: string | null;
  requiredXp: number;
  rarityLevel: string;
  value: string;
  color?: string;
}

export interface UltimateAvatarConfig {
  skinTone: string;
  face: string;
  hair: string;
  hairColor: string;
  eyes: string;
  eyebrows: string;
  nose: string;
  mouth: string;
  glasses: string;
  accessories: string;
  clothes: string;
  background: string;
  aura: string;
}

export const DEFAULT_AVATAR_CONFIG: UltimateAvatarConfig = {
  skinTone: '#D4A574',
  face: 'round',
  hair: 'short',
  hairColor: '#2B1D0E',
  eyes: 'friendly',
  eyebrows: 'soft',
  nose: 'button',
  mouth: 'smile',
  glasses: 'none',
  accessories: 'none',
  clothes: 'basic-tee',
  background: 'classroom',
  aura: 'none',
};

export const CATEGORY_ORDER: AvatarCategory[] = [
  'face',
  'hair',
  'eyes',
  'eyebrows',
  'nose',
  'mouth',
  'skin',
  'glasses',
  'accessories',
  'clothes',
  'background',
  'aura',
];

export const XP_LEVELS = [1, 5, 10, 20, 50];

export const xpToLevel = (xp: number) => Math.floor(xp / 100) + 1;

export const estimateSelfieAvatar = async (file: File): Promise<Partial<UltimateAvatarConfig>> => {
  const image = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = Math.max(64, Math.floor(image.width / 8));
  canvas.height = Math.max(64, Math.floor(image.height / 8));

  if (!ctx) {
    return {};
  }

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha > 32) {
      totalR += data[i];
      totalG += data[i + 1];
      totalB += data[i + 2];
      count += 1;
    }
  }

  if (!count) return {};

  const avgR = Math.round(totalR / count);
  const avgG = Math.round(totalG / count);
  const avgB = Math.round(totalB / count);

  const brightness = (avgR + avgG + avgB) / 3;
  const skinTone = `rgb(${Math.min(avgR + 20, 255)}, ${Math.min(avgG + 8, 255)}, ${Math.min(avgB, 255)})`;
  const hairColor = `rgb(${Math.max(avgR - 45, 20)}, ${Math.max(avgG - 45, 20)}, ${Math.max(avgB - 45, 20)})`;

  return {
    skinTone,
    hairColor,
    hair: brightness > 180 ? 'wavy' : brightness > 130 ? 'short' : 'curly',
    face: brightness > 150 ? 'oval' : 'round',
    eyes: brightness > 145 ? 'focused' : 'friendly',
  };
};
