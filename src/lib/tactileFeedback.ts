export type TactilePattern = 'light' | 'success' | 'error';

const patterns: Record<TactilePattern, number | number[]> = {
  light: 8,
  success: [16, 28, 24],
  error: [24, 42, 24],
};

export const triggerTactileFeedback = (pattern: TactilePattern = 'light') => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;

  try {
    navigator.vibrate(patterns[pattern]);
  } catch {
    // Vibration is an optional device capability. Never let it affect the action.
  }
};
