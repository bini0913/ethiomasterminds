/**
 * Best-effort browser storage helpers.
 *
 * Storage can be disabled or throw in private/restricted WebViews. App state
 * must continue to work for the current session when persistence is unavailable.
 */
export const safeStorage = {
  getItem(key: string): string | null {
    try {
      return typeof window === "undefined" ? null : window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },

  setItem(key: string, value: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  },

  removeItem(key: string): boolean {
    try {
      if (typeof window === "undefined") return false;
      window.localStorage.removeItem(key);
      return true;
    } catch {
      return false;
    }
  },
};
