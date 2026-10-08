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
  glass: string;
  glassEdge: string;
  washSage: string;
  washClay: string;
};

export const lightPalette: PaletteColors = {
  paper: '#F7F7F2',
  white: '#FDFDFA',
  ink: '#2A2622',
  forest: '#4A6741',
  leaf: '#E9EFE1',
  leafDeep: '#D4DEC7',
  coral: '#A4502F',
  sky: '#EDF1E8',
  muted: '#6B6358',
  line: '#DEE0D3',
  gold: '#A9822F',
  dangerBg: '#F3E1D6',
  dangerText: '#7A3F29',
  successBg: '#E1ECD6',
  glass: 'rgba(253,253,250,0.70)',
  glassEdge: 'rgba(255,255,255,0.7)',
  washSage: 'rgba(104,152,98,0.26)',
  washClay: 'rgba(120,170,120,0.12)',
};

// In dark mode "white" is the raised surface and "ink" the primary text, so contrast pairings invert together.
export const darkPalette: PaletteColors = {
  paper: '#14110E',
  white: '#1E1A16',
  ink: '#EDE5D6',
  forest: '#A5BD8F',
  leaf: '#25241B',
  leafDeep: '#38362A',
  coral: '#E08A66',
  sky: '#221E19',
  muted: '#A39A8B',
  line: '#322C25',
  gold: '#D3AE62',
  dangerBg: '#2E1D16',
  dangerText: '#EFA98E',
  successBg: '#1F2619',
  glass: 'rgba(38,33,28,0.62)',
  glassEdge: 'rgba(255,240,215,0.09)',
  washSage: 'rgba(120,150,100,0.16)',
  washClay: 'rgba(200,120,80,0.10)',
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

/** Victorian-leaning serif for headings; body copy stays on the system font for legibility. */
export const display = { fontFamily: 'EBGaramond_600SemiBold' } as const;
export const displayRegular = { fontFamily: 'EBGaramond_500Medium' } as const;

/** Hand-cut, slightly uneven corners (wabi-sabi). */
export const wobble = {
  borderTopLeftRadius: 16,
  borderTopRightRadius: 12,
  borderBottomRightRadius: 15,
  borderBottomLeftRadius: 11,
} as const;


/** Frosted-glass card surface; call inside themedStyles so it follows the active scheme. */
export function glassSurface(): Record<string, unknown> {
  const web = typeof document !== 'undefined';
  return web
    ? { backgroundColor: palette.glass, borderColor: palette.glassEdge, backdropFilter: 'blur(14px) saturate(1.15)', WebkitBackdropFilter: 'blur(14px) saturate(1.15)', boxShadow: '0 1px 0 rgba(255,255,255,.5) inset, 0 8px 24px -12px rgba(60,45,25,.28)' }
    : { backgroundColor: palette.glass, borderColor: palette.glassEdge, shadowColor: '#3C2D19', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 2 };
}
