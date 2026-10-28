// The relational creature head (creature-heads/relational.js): the laws its construction keeps, on the two skulls of its
// first phase. A relation moves what it names (the muzzle's length the nose's tip, the vault's breadth its sides); the
// skin is one closed surface (inside negative, the bounds' corners outside); the eyes and the nose are SEATED on it (a
// globe breaks the skin, the nose's pad stands proud of the muzzle); the soft union never swells the face past its
// beads; the skulls are told apart by their relations; the same words, the same field.
import { describe, it, expect } from 'vitest';
import { relationalCreatureHead, CREATURE_HEADS, CREATURE_RELATIONS } from './relational.js';
import { HEAD_V } from '../polygonizer/head-relational.js';

const V = HEAD_V;
// the skin's front on the midline at a height (V): where the field first goes negative coming back along y
const frontAt = (H, z, x = 0) => { for (let y = 2; y > -1; y -= 0.002) if (H.field({ x: x * V, y: y * V, z: z * V }) < 0) return y; return null; };
const sideAt = (H, y, z) => { for (let x = 1.5; x > 0; x -= 0.002) if (H.field({ x: x * V, y: y * V, z: z * V }) < 0) return x; return null; };

describe('the relational creature head', () => {
  it('is one closed skin: inside the vault negative, every corner of its bounds outside', () => {
    for (const preset of Object.keys(CREATURE_HEADS)) {
      const H = relationalCreatureHead({ preset }), B = H.bounds;
      expect(H.field({ x: 0, y: 0, z: 0.6 * V }), preset).toBeLessThan(0);
      for (const x of [B.min.x, B.max.x]) for (const y of [B.min.y, B.max.y]) for (const z of [B.min.z, B.max.z]) expect(H.field({ x, y, z })).toBeGreaterThan(0);
    }
  });

  it('a relation moves what it names: a longer muzzle puts the nose further forward; a broader vault widens it', () => {
    const base = relationalCreatureHead({ preset: 'wolf' }), long = relationalCreatureHead({ preset: 'wolf', relations: { muzzle: 1.0 } });
    expect(frontAt(long, 0.45)).toBeGreaterThan(frontAt(base, 0.45) + 0.12);
    const broad = relationalCreatureHead({ preset: 'wolf', relations: { cephalic: 0.85 } });
    expect(sideAt(broad, -0.2, 0.65)).toBeGreaterThan(sideAt(base, -0.2, 0.65) + 0.04);
  });

  it('never swells the face past its beads: the muzzle\'s front, at its middle under the nose, within a blend of its tip', () => {
    for (const preset of Object.keys(CREATURE_HEADS)) {
      const H = relationalCreatureHead({ preset }), M = H.vajras.find((w) => w.name === 'muzzle'), tip = M.b.y + M.r[2];
      expect(Math.abs(frontAt(H, M.b.z, M.b.x) - tip), preset).toBeLessThan(0.06);
    }
  });

  it('seats the eyes and the nose on the skin: a globe breaks it, the nose\'s pad stands proud and paints', () => {
    for (const preset of Object.keys(CREATURE_HEADS)) {
      const H = relationalCreatureHead({ preset }), R = H.relations, e = H.points.eye;
      // (a point a little ahead of the eye's place along its gaze, then onward until the skin: a globe's paint there)
      let hit = null; for (let t = 0; t < 1.2 && !hit; t += 0.005) { const p = { x: e.x + Math.sin((70 * (1 - R.eyeSet) * Math.PI) / 180) * t * V, y: e.y + Math.cos((70 * (1 - R.eyeSet) * Math.PI) / 180) * t * V, z: e.z }; if (H.field(p) >= 0) hit = p; }
      expect(['iris', 'pupil', 'sclera']).toContain(H.paint(hit));
      const nose = H.vajras.find((w) => w.name === 'nose');
      const ahead = frontAt(H, nose.c.z);
      expect(ahead, preset).toBeGreaterThan(nose.c.y + nose.r[1] * 0.85);
      expect(H.paint({ x: 0, y: ahead * V, z: nose.c.z * V })).toBe('nose');
    }
  });

  it('tells its skulls apart by their relations, and is deterministic', () => {
    const W = relationalCreatureHead({ preset: 'wolf' }), C = relationalCreatureHead({ preset: 'felid' });
    expect(frontAt(W, 0.45) - frontAt(C, 0.45)).toBeGreaterThan(0.4);   // (the wolf's muzzle the long one)
    expect(sideAt(C, -0.2, 0.65)).toBeGreaterThan(sideAt(W, -0.2, 0.65));   // (the cat's vault the round one)
    expect(C.relations.pupil).toBe('slit'); expect(W.relations.pupil).toBe(CREATURE_RELATIONS.pupil);
    const again = relationalCreatureHead({ preset: 'felid' }), p = { x: 0.01, y: 0.02, z: 0.07 };
    expect(again.field(p)).toBe(C.field(p));
  });
});
