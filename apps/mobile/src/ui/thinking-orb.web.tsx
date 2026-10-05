// Web build: the published canvas component, so the web app doesn't need Skia's WASM runtime.
import { ThinkingOrb as WebOrb } from 'thinking-orbs';

import { useScheme } from '@/ui/palette';
import type { OrbProps } from '@/ui/thinking-orb-types';

export function ThinkingOrb({ state = 'working', size = 20, paused = false, label }: OrbProps) {
  const scheme = useScheme();
  return <WebOrb state={state} size={size} theme={scheme} paused={paused} aria-label={label ?? 'Loading'} />;
}
