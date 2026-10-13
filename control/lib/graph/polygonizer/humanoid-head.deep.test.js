/** The fitted landmark head's exhaustive sweep (humanoid-head.test.js keeps the laws as fit, at every move and at both
 * combined extremes). Every face control at each of its own range ends, the head alternating: symmetric, finite, closed
 * with the jaw shut and open, the eyes still read. A full head and an exposure render per case, so it runs in the deep
 * tier (`npm run test:deep`, and in CI), not on every `npm test`. */
import { describe, it, expect } from 'vitest';
import { humanoidHead, FACE_KEYS, FACE_RANGES } from './humanoid-head.js';
import { compileLayered, auditLayered } from './station-loft.js';
import { layeredExposure } from './station-loft-exposure.js';

const PRESETS = ['male', 'female'];
const closed = (recipe, dials = {}) => Object.entries(auditLayered(compileLayered(recipe, dials))).filter(([, r]) => !r.pass).map(([n]) => n);
const pts = (h, part) => h.parts[part].stations.flatMap((st) => Object.entries(st.points));

describe('every face control at its range ends', () => {
  // the head alternates by (control, end), so each head meets both ends of the range across the controls
  FACE_KEYS.forEach((k, i) => FACE_RANGES[k].forEach((v, j) => {
    const preset = PRESETS[(i + j) % 2];
    it(`${preset} · ${k} ${v}`, () => {
      const h = humanoidHead({ preset, shape: { [k]: v }, hair: 'none' });
      for (const part of ['cranium', 'jaw']) for (const [slot, p] of pts(h, part)) {
        expect(p.every(Number.isFinite)).toBe(true);
        if (slot.endsWith('L')) { const q = h.parts[part].stations.find((st) => st.points[slot] === p).points[slot.replace(/L$/, 'R')]; expect(p).toEqual([-q[0], q[1], q[2]]); }
        if (slot === 'front' || slot === 'back') expect(p[0]).toBe(0);
      }
      expect(closed(h)).toEqual([]); expect(closed(h, { jawOpen: 25 })).toEqual([]);
      const ex = layeredExposure(compileLayered(h), { res: 256 });
      for (const eye of ['eyeR', 'eyeL']) expect(ex.parts[eye].flag).toBe('reads');
    });
  }));
});
