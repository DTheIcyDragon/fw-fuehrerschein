import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredOverride(): Theme | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('fw_theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore storage errors
  }
  return null;
}

function applyThemeToDom(resolved: Theme, isExplicitOverride: boolean): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', isExplicitOverride ? resolved : 'light dark');
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => getStoredOverride() ?? getSystemTheme());

  useEffect(() => {
    applyThemeToDom(theme, getStoredOverride() !== null);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');

    const syncFromSystemOrStorage = () => {
      const override = getStoredOverride();
      const resolved = override ?? getSystemTheme();
      setThemeState(resolved);
      applyThemeToDom(resolved, override !== null);
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === 'fw_theme') {
        syncFromSystemOrStorage();
      }
    };

    const handleMediaChange = () => {
      if (getStoredOverride() === null) {
        syncFromSystemOrStorage();
      }
    };

    window.addEventListener('storage', handleStorage);
    media?.addEventListener?.('change', handleMediaChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      media?.removeEventListener?.('change', handleMediaChange);
    };
  }, []);

  const setTheme = useCallback((next: Theme) => {
    const sys = getSystemTheme();
    try {
      if (next === sys) {
        localStorage.removeItem('fw_theme');
      } else {
        localStorage.setItem('fw_theme', next);
      }
    } catch {
      // ignore storage errors
    }
    setThemeState(next);
    applyThemeToDom(next, next !== sys);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
