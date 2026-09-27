export type UserTier = 'early' | 'middle' | 'upper';

/** Unknown or unset grades remain unassigned until the student chooses one. */
export function getUserTier(grade: string | null | undefined): UserTier | null {
  if (!grade) return null;
  const normalized = grade.trim().toLowerCase();
  if (/^(k|kindergarten|pre-?k)$/.test(normalized)) return 'early';
  const match = /^(?:grade\s*)?(\d{1,2})\+?$/.exec(normalized);
  if (!match) return null;
  const value = Number(match[1]);
  if (value <= 3) return 'early';
  if (value <= 8) return 'middle';
  return 'upper';
}
