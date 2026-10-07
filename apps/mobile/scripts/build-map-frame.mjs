// Writes the static map page used by the web iframe. Run after changing map-runtime.ts (a test checks they match).
import { writeFileSync } from 'node:fs';
import { MAP_FRAME_HTML, MAP_SCRIPT } from '../src/features/discovery/map-runtime.ts';

writeFileSync(new URL('../public/map-frame.html', import.meta.url), MAP_FRAME_HTML);
writeFileSync(new URL('../public/map-frame.js', import.meta.url), MAP_SCRIPT);
