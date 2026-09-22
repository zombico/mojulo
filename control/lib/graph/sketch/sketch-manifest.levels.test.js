import { describe, expect, it } from 'vitest';

import { validateSketchManifest } from './sketch-manifest.js';

// A floorplan STACK (paris-t4-stack): `levels[]` stands in for the seed / rooms[] form.
describe('validateSketchManifest — floorplan levels[]', () => {
  const level = { index: 0, height: 10, rooms: [{ x: 0, y: 0, w: 20, h: 20, glyph: 'L' }] };

  it('accepts a floorplan with levels[] and no seed or rooms', () => {
    const v = validateSketchManifest({ kind: 'floorplan', title: 'stack', levels: [level] });
    expect(v).toEqual({ ok: true, errors: [] });
  });

  it('still rejects a floorplan with none of seed / rooms / levels', () => {
    const v = validateSketchManifest({ kind: 'floorplan', title: 'bare', levels: [] });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/needs a seed/);
  });

  it('levels[] does not unlock the restaurant kind (it has no stack arm)', () => {
    const v = validateSketchManifest({ kind: 'restaurant', title: 'r', levels: [level] });
    expect(v.ok).toBe(false);
  });
});

// `storeys: N` (alias `floors`) — the one-field shorthand for the stack (house-compose-language).
describe('validateSketchManifest — floorplan storeys shorthand', () => {
  it('accepts storeys / floors as a positive integer beside a seed', () => {
    expect(validateSketchManifest({ kind: 'floorplan', title: 'h', seed: 7, storeys: 2 })).toEqual({ ok: true, errors: [] });
    expect(validateSketchManifest({ kind: 'floorplan', title: 'h', seed: 7, floors: 3 })).toEqual({ ok: true, errors: [] });
  });

  it('refuses a non-integer or < 1 storey count and points at the card', () => {
    for (const bad of [0, 1.5, '2', -1]) {
      const v = validateSketchManifest({ kind: 'floorplan', title: 'h', seed: 7, storeys: bad });
      expect(v.ok, `storeys ${JSON.stringify(bad)}`).toBe(false);
      expect(v.errors.join('\n')).toMatch(/storeys must be an integer >= 1/);
      expect(v.errors.join('\n')).toMatch(/floor-plan/);
    }
  });

  it('storeys still needs a seed or rooms[] (the levels are generated from the seed)', () => {
    const v = validateSketchManifest({ kind: 'floorplan', title: 'h', storeys: 2 });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/needs a seed/);
  });

  it('the restaurant kind has no stack arm, so storeys refuses there too', () => {
    const v = validateSketchManifest({ kind: 'restaurant', title: 'r', seed: 1, storeys: 2 });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toMatch(/no storeys/);
  });
});
