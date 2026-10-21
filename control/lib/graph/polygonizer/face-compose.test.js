import { describe, it, expect } from 'vitest';

import { RELATION_POLES } from './head-relational.js';
import { composeFace, FACE_SHAPES, FACE_FEATURES, FACE_BUCKETS } from './face-compose.js';

describe('the face composer', () => {
  it('is deterministic: the same seed composes the same face', () => {
    expect(composeFace({ seed: 7 })).toEqual(composeFace({ seed: 7 }));
  });
  it('composes different faces from different seeds, every one over the pole', () => {
    const faces = Array.from({ length: 24 }, (_, i) => composeFace({ seed: i + 1 }));
    const kinds = new Set(faces.map((f) => JSON.stringify(f.picks)));
    expect(kinds.size).toBeGreaterThan(12);
    for (const f of faces) for (const k of Object.keys(RELATION_POLES.female)) expect(Number.isFinite(f.relations[k])).toBe(true);
  });
  it('takes the shapes nearest its character, and an accent from far off', () => {
    // (each feature's shape nearest a corner of the plane, taken from the table: the composer must favour it there)
    const corner = [1, -1];
    const nearest = (f) => Object.entries(FACE_SHAPES[f]).sort(([, a], [, b]) => Math.hypot(a.at[0] - corner[0], a.at[1] - corner[1]) - Math.hypot(b.at[0] - corner[0], b.at[1] - corner[1]))[0][0];
    const hits = Object.fromEntries(FACE_FEATURES.map((f) => [f, 0]));
    for (let s = 1; s <= 40; s++) { const face = composeFace({ seed: s, character: corner, accent: false }); for (const f of FACE_FEATURES) hits[f] += face.picks[f] === nearest(f) ? 1 : 0; }
    for (const f of FACE_FEATURES) expect(hits[f]).toBeGreaterThan(20);
    const accented = composeFace({ seed: 3, character: corner, accent: 'chin' }), at = FACE_SHAPES.chin[accented.picks.chin].at;
    expect(Math.hypot(at[0] - corner[0], at[1] - corner[1])).toBeGreaterThanOrEqual(1);
  });
  it('rolls its tone and hair from its bucket\'s ancestries, and refuses what it does not know', () => {
    expect(FACE_BUCKETS.western.ancestry).toContain(composeFace({ seed: 2 }).ancestry);
    expect(() => composeFace({ bucket: 'nowhere' })).toThrow(/bucket/);
    expect(() => composeFace({ accent: 'ears' })).toThrow(/accent/);
  });
});
