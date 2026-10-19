/**
 * head-relational — the orbit's frame in depth: the cornea hangs off the nasion by the radix; the brow hoods the eye
 * and the lateral rim sits behind it, skin and bone, in the clinic's ranges, so the globe shows from ¾ and in a
 * profile; the skull's orbit holds the globe clear of bone. The ear stands upright, in its place.
 */
import { describe, expect, it } from 'vitest';

import { relationalHead, RELATIONS } from './head-relational.js';
import { GLOBE } from './head-relational-eye.js';
import { rayIn } from './head-field-view.js';

const MM = 230;
const skin = relationalHead({ sex: 'male' }), bone = relationalHead({ sex: 'male', layer: 'skull' });
const sc = skin.relational.V, P = skin.relational.points, E = P.eyeR;
// the field's front at (x, z), in mm ahead of the cornea's apex
const ahead = (h, x, z) => { const q = rayIn(h.field, { x: x * sc, y: 0, z: z * sc }, [0, 1, 0]); return q ? (q.y / sc - E.y) * MM : -Infinity; };
const most = (h, xs, z) => Math.max(...xs.map((x) => ahead(h, x, z)));
const beside = Array.from({ length: 12 }, (_, i) => P.exR.x + (4 + i) / MM);   // 4–15 mm lateral of the outer canthus

describe('the orbit in depth', () => {
  it('hangs the cornea off the nasion by the radix', () => {
    expect((P.n.y - E.y) * MM).toBeCloseTo(RELATIONS.radix * MM, 6);
    expect(RELATIONS.radix * MM).toBeGreaterThan(9);
    expect(RELATIONS.radix * MM).toBeLessThan(14);
  });
  it('sets the lateral rim behind the eye, skin and bone (Hertel: the cornea 12–20 mm ahead of the rim)', () => {
    expect(most(skin, beside, P.exR.z)).toBeLessThan(-5);
    const rim = most(bone, beside, P.exR.z);
    expect(rim).toBeLessThan(-12);
    expect(rim).toBeGreaterThan(-20);
  });
  it('hoods the eye with the brow, without walling it in', () => {
    const brow = Math.max(...Array.from({ length: 18 }, (_, i) => ahead(skin, E.x, E.z + (8 + i) / MM)));
    expect(brow).toBeGreaterThan(5);
    expect(brow).toBeLessThan(16);
  });
  it('holds the globe in the skull\'s orbit, clear of bone', () => {
    const gc = { x: E.x * sc, y: (E.y - GLOBE.back) * sc, z: E.z * sc }, r = GLOBE.r * sc * 0.95;
    for (let i = 0; i < 200; i++) {
      // points spread over the globe's surface (a golden spiral), just inside it
      const t = (i + 0.5) / 200, ph = Math.acos(1 - 2 * t), th = Math.PI * (1 + Math.sqrt(5)) * i;
      const p = { x: gc.x + r * Math.sin(ph) * Math.cos(th), y: gc.y + r * Math.cos(ph), z: gc.z + r * Math.sin(ph) * Math.sin(th) };
      expect(bone.field(p)).toBeGreaterThan(0);
    }
  });
});

describe('the ear', () => {
  it('stands upright: its long axis (helix top to lobule bottom) within a few degrees of the clinic\'s floor', () => {
    const L = skin.landmarks, T = L.tragionR;
    let bot = null, lobeY = null;
    for (let z = T.z; z >= T.z - 0.04; z -= 0.0004) for (let y = T.y - 0.02; y <= T.y + 0.015; y += 0.0006)
      if (skin.field({ x: T.x + 0.004, y, z }) < 0 && (bot === null || z < bot)) { bot = z; lobeY = y; }
    const lean = (Math.atan2(lobeY - L.earTopR.y, L.earTopR.z - bot) * 180) / Math.PI;
    expect(lean).toBeGreaterThan(5);
    expect(lean).toBeLessThan(14);
    // still where it was on the face: the tragion ~76 mm behind the outer canthus
    expect((L.exR.y - T.y) * 1800).toBeGreaterThan(70);
    expect((L.exR.y - T.y) * 1800).toBeLessThan(82);
  });
});
