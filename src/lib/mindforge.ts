export const MINDFORGE_SETTINGS_KEY = "mindforge-settings";

export type MindForgeReactionType =
  | "correct_basic"
  | "correct_combo"
  | "correct_power"
  | "wrong_growth"
  | "level_up"
  | "focus_boost";

export interface MindForgeSettings {
  reactionsEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
}

export const defaultMindForgeSettings: MindForgeSettings = {
  reactionsEnabled: true,
  soundEnabled: true,
  reducedMotion: false,
};

export const getMindForgeSettings = (): MindForgeSettings => {
  if (typeof window === "undefined") return defaultMindForgeSettings;

  const raw = window.localStorage.getItem(MINDFORGE_SETTINGS_KEY);
  if (!raw) return defaultMindForgeSettings;

  try {
    const parsed = JSON.parse(raw) as Partial<MindForgeSettings>;
    return {
      ...defaultMindForgeSettings,
      ...parsed,
    };
  } catch {
    return defaultMindForgeSettings;
  }
};

export const saveMindForgeSettings = (settings: MindForgeSettings) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MINDFORGE_SETTINGS_KEY, JSON.stringify(settings));
};
