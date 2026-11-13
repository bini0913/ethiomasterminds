import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { safeStorage } from "@/lib/safeStorage";

export type Theme = "light" | "dark" | "pink" | "blue";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const THEME_STORAGE_KEY = "masterminds-theme";
const THEMES: Theme[] = ["light", "dark", "pink", "blue"];

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const getInitialTheme = (): Theme => {
  try {
    const savedTheme = safeStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme && (THEMES as string[]).includes(savedTheme)) return savedTheme as Theme;
  } catch (error) {
    // Storage can be unavailable in restricted browser/WebView contexts.
    console.warn("Could not read saved theme preference; using system preference.", error);
  }

  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark", "pink", "blue");
    if (theme !== "light") root.classList.add(theme);
    try {
      safeStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
      // Theme still applies for this session even when persistence is blocked.
      console.warn("Could not persist theme preference.", error);
    }
  }, [theme]);

  const setTheme = (next: Theme) => setThemeState(next);
  const toggleTheme = () => setThemeState((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
