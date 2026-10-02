import { describe, expect, it } from 'vitest';

import { applyScheme, darkPalette, lightPalette, palette, themedStyles } from './palette';

describe('palette scheme switching', () => {
  it('serves styles and colors for the active scheme', () => {
    const styles = themedStyles(() => ({ card: { backgroundColor: palette.white } }));
    applyScheme('light');
    expect(styles.card.backgroundColor).toBe(lightPalette.white);
    applyScheme('dark');
    expect(palette.paper).toBe(darkPalette.paper);
    expect(styles.card.backgroundColor).toBe(darkPalette.white);
    applyScheme('light');
    expect(styles.card.backgroundColor).toBe(lightPalette.white);
  });
});
