import { useSyncExternalStore } from 'react';

export type PaletteColors = {
  paper: string;
  white: string;
  ink: string;
  forest: string;
  leaf: string;
  leafDeep: string;
  coral: string;
  sky: string;
  muted: string;
  line: string;
  gold: string;
  dangerBg: string;
  dangerText: string;
  successBg: string;
};

export const lightPalette: PaletteColors = {
  paper: '#F4F6F5',
  white: '#FFFFFF',
  ink: '#151917',
  forest: '#087657',
  leaf: '#E8EEEB',
  leafDeep: '#D1DCD6',
  coral: '#A94B3B',
  sky: '#E9EDEC',
  muted: '#707875',
  line: '#E1E6E3',
  gold: '#B89043',
  dangerBg: '#F9EEE8',
  dangerText: '#754334',
  successBg: '#EAF1E8',
};

// In dark mode "white" is the raised surface and "ink" the primary text, so contrast pairings invert together.
export const darkPalette: PaletteColors = {
  paper: '#0D100F',
  white: '#171B1A',
  ink: '#EDF1EF',
  forest: '#3FD6A2',
  leaf: '#16251F',
  leafDeep: '#223A31',
  coral: '#E8826E',
  sky: '#1C2220',
  muted: '#98A39E',
  line: '#272D2B',
  gold: '#D8B25F',
  dangerBg: '#2B1B17',
  dangerText: '#F0A898',
  successBg: '#15251E',
};

// Mutated in place so existing `palette.x` reads follow the active scheme.
export const palette: PaletteColors = { ...lightPalette };

let activeScheme: 'light' | 'dark' = 'light';
const listeners = new Set<() => void>();

export function getActiveScheme() {
  return activeScheme;
}

export function applyScheme(scheme: 'light' | 'dark') {
  if (scheme === activeScheme) return;
  activeScheme = scheme;
  Object.assign(palette, scheme === 'dark' ? darkPalette : lightPalette);
}

export function notifySchemeChange() {
  listeners.forEach((listener) => listener());
}

export function subscribeScheme(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useScheme() {
  return useSyncExternalStore(subscribeScheme, getActiveScheme, getActiveScheme);
}

type StyleMap = Record<string, unknown>;

// Builds styles once per scheme and serves the set matching the active scheme.
export function themedStyles<T extends StyleMap>(factory: () => T): T {
  const cache: Partial<Record<'light' | 'dark', T>> = {};
  const resolve = () => (cache[activeScheme] ??= factory());
  return new Proxy({} as T, {
    get: (_target, key) => resolve()[key as keyof T],
    has: (_target, key) => key in resolve(),
    ownKeys: () => Reflect.ownKeys(resolve()),
    getOwnPropertyDescriptor: (_target, key) => ({ configurable: true, enumerable: true, value: resolve()[key as keyof T] }),
  });
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radii = {
  small: 8,
  medium: 14,
  large: 20,
  full: 9999,
} as const;
