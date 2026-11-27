export type UserTier = 'early' | 'middle' | 'upper';

/** Unknown or unset grades remain unassigned until the student chooses one. */
export function getUserTier(grade: string | null | undefined): UserTier | null {
  if (!grade) return null;
  const normalized = grade.trim().toLowerCase();
  if (/^(k|kg|kindergarten|pre-?k|grade\s*0|0)$/.test(normalized)) return 'early';
  const match = /^(?:grade\s*)?(\d{1,2})\+?$/.exec(normalized);
  if (!match) return null;
  const value = Number(match[1]);
  if (value < 1) return null;
  if (value <= 4) return 'early';
  if (value <= 8) return 'middle';
  return 'upper';
}
