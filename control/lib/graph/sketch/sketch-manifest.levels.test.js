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
