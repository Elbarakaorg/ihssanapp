import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useLayoutEffect, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { applyScheme, notifySchemeChange } from '@/ui/palette';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedScheme = 'light' | 'dark';

type ThemeContextValue = {
  mode: ThemeMode;
  scheme: ResolvedScheme;
  setMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = 'ihssan.theme-mode';
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') setModeState(stored);
    });
  }, []);

  const setMode = (nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(STORAGE_KEY, nextMode);
  };

  const scheme: ResolvedScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  // Palette is updated before children render; subscribers are told once the commit lands.
  applyScheme(scheme);
  useLayoutEffect(() => {
    notifySchemeChange();
  }, [scheme]);

  return (
    <ThemeContext.Provider value={{ mode, scheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used within ThemeProvider.');
  return context;
}
