import { describe, expect, it } from 'vitest';

import { GUIDE_STEPS, splitEmphasis } from './order-guide-steps';

describe('order guide steps', () => {
  it('splits emphasised words', () => {
    expect(splitEmphasis('Tap **any row** now')).toEqual([
      { text: 'Tap ', strong: false },
      { text: 'any row', strong: true },
      { text: ' now', strong: false },
    ]);
    expect(splitEmphasis('plain')).toEqual([{ text: 'plain', strong: false }]);
  });

  it('has unique keys and balanced emphasis markers', () => {
    expect(new Set(GUIDE_STEPS.map((step) => step.key)).size).toBe(GUIDE_STEPS.length);
    for (const step of GUIDE_STEPS) expect((step.body.match(/\*\*/g) ?? []).length % 2).toBe(0);
  });
});
