/**
 * Best-effort browser storage helpers.
 *
 * Browser storage can be unavailable in private or restricted WebViews. App
 * features should keep working for the current session when persistence fails.
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
