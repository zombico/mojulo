import { describe, it, expect } from 'vitest';
import { ELEMENTS, MATERIALS, materialOf, madeColour, kitPaint } from './made-elements.js';
import { BRIDGE_ELEMENTS } from '../playscape/objects/bridge.js';
import { MADE_PARTS, madeStyle } from './out-made.js';
import { accentOf, hexOfRgb, SWATCHES, madeRamp } from './style/swatches.js';
import { resolveObject } from '../playscape/objects/index.js';

// one vocabulary for what built things are made of (era/made-elements.js)
describe('made elements', () => {
  it('names every bridge element and every index part, each a part and a material', () => {
    for (const w of [...BRIDGE_ELEMENTS, 'dentils', ...Object.keys(MADE_PARTS)]) {
      expect(ELEMENTS[w], w).toBeDefined();
      expect(MADE_PARTS[ELEMENTS[w].part], `${w} → ${ELEMENTS[w].part}`).toBeDefined();
      expect(MATERIALS).toContain(ELEMENTS[w].material);
    }
    expect(materialOf('keystone')).toBe('stone');
    expect(materialOf('handropes')).toBe('rope');
  });

  it('a value becomes a stop of its material\'s ramp in the kit; what you use takes the kit\'s accent and nothing else does', () => {
    const st = madeStyle('isekai-meadow', 8), stone = madeRamp('isekai-meadow', 'rock');
    expect(madeColour(st, { material: 'stone', group: 'obj:body', value: 0 })).toBe(hexOfRgb(stone[0]));
    expect(madeColour(st, { material: 'stone', group: 'obj:body', value: 1 })).toBe(hexOfRgb(stone[stone.length - 1]));
    expect(madeColour(st, { material: 'stone', group: 'obj:status', value: 0.5 })).toBe(hexOfRgb(accentOf('isekai-meadow')));
    for (const kit of Object.keys(SWATCHES)) {
      const s = madeStyle(kit, 1), all = new Set(Object.values(s.swatch).flatMap((r) => r.stops.map(hexOfRgb)));
      const faces = kitPaint(resolveObject({ entry: 'bridge', variant: 'deck', from: [0, 0, 0], to: [6, 0, 0], dress: s.tokens }).faces, s);
      expect(faces.every((f) => all.has(f.fill)), kit).toBe(true);
    }
  });
});
