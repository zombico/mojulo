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
    // (the skin still behind the eye at its outer corner; the realistic head as one skin, realistic laws 2, fills the corner
    // over the rim, 3.3 mm behind the cornea where the separate lids stood 5 and more: the bone below holds Hertel's range)
    expect(most(skin, beside, P.exR.z)).toBeLessThan(-3);
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

describe('the forehead\'s furrows', () => {
  it('cuts three shallow grooves across the forehead where its lines run, and nothing without them', () => {
    const a = relationalHead({ sex: 'male' }), b = relationalHead({ sex: 'male', relations: { furrows: 1 } }), L = a.landmarks, mm = L.H / MM;
    const front = (h, z) => { const q = rayIn(h.field, { x: 0.004, y: L.g.y - 0.1, z }, [0, 1, 0]); return q ? q.y : NaN; };
    const cut = Array.from({ length: 30 }, (_, i) => (front(a, L.g.z + (8 + i) * mm) - front(b, L.g.z + (8 + i) * mm)) / mm);
    expect(Math.max(...cut)).toBeGreaterThan(0.4); expect(Math.max(...cut)).toBeLessThan(1.6);
    // (three: a groove, the skin between, the next)
    const grooves = cut.filter((c, i) => c > 0.3 && !(cut[i - 1] > 0.3)).length;
    expect(grooves).toBe(3);
    expect(front(b, L.g.z - 4 * mm)).toBe(front(a, L.g.z - 4 * mm));
  });
});

describe('the closed mouth\'s seam', () => {
  it('cuts the lip line to one depth along the lips', () => {
    const h = relationalHead({ sex: 'male' }), L = h.landmarks, mm = L.H / MM, sto = L.stomion, ch = Math.abs(L.chR.x) / mm;
    const front = (x, z) => { let y = sto.y + 15 * mm; while (h.field({ x, y, z }) > 0) y -= 0.05 * mm; return y; };
    const depths = [-0.6, -0.3, 0, 0.3, 0.6].map((u) => {
      const x = u * ch * mm, ys = Array.from({ length: 41 }, (_, k) => front(x, sto.z + (k - 20) * 0.15 * mm));
      return (Math.min(Math.max(...ys.slice(0, 8)), Math.max(...ys.slice(33))) - Math.min(...ys.slice(8, 33))) / mm;
    });
    expect(Math.min(...depths)).toBeGreaterThan(0.6);
    expect(Math.max(...depths) - Math.min(...depths)).toBeLessThan(0.7);
  });
});
