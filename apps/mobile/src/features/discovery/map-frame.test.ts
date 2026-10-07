// @ts-ignore node types are not installed; this runs under vitest only
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAP_FRAME_HTML, MAP_SCRIPT, mapFrameUrl } from './map-runtime';

describe('static map page', () => {
  it('matches the generated files (run: node scripts/build-map-frame.mjs)', () => {
    expect(readFileSync('public/map-frame.html', 'utf8')).toBe(MAP_FRAME_HTML);
    expect(readFileSync('public/map-frame.js', 'utf8')).toBe(MAP_SCRIPT);
  });
  it('has no inline script and keeps config in the fragment', () => {
    expect(MAP_FRAME_HTML).not.toMatch(/<script>/);
    expect(mapFrameUrl({ token: 't', styleUrl: 's', theme: {} as never })).toMatch(/^\/map-frame\.html#/);
  });
});
