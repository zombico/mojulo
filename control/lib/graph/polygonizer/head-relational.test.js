/**
 * head-relational — the orbit's frame in depth: the cornea hangs off the nasion by the radix; the brow hoods the eye
 * and the lateral rim sits behind it, skin and bone, in the clinic's ranges, so the globe shows from ¾ and in a
 * profile; the skull's orbit holds the globe clear of bone. The ear stands upright, in its place.
 */
import { describe, expect, it } from 'vitest';

import { relationalHead, RELATIONS, raisedEar } from './head-relational.js';
import { GLOBE, SEAT } from './head-relational-eye.js';
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
  it('the ear RAISED to the canon (realistic laws 10): its top at the brow line, never under it; the old ear lower', () => {
    for (const sex of ['male', 'female']) {
      const was = relationalHead({ sex }).landmarks, now = relationalHead({ sex, relations: raisedEar(null, sex) }).landmarks;
      // (raised at least 3 mm, its top within ~4 mm of the glabella's level, the brows' own height; V × 1.8 m)
      expect((now.earTopR.z - was.earTopR.z) * 1.8 * 1000).toBeGreaterThan(3);
      expect(Math.abs(now.earTopR.z - now.g.z) * 1.8 * 1000).toBeLessThan(4.5);
    }
  });
});

describe('the lids\' seat', () => {
  // how far the skin stands ahead of the globe just outside a margin (head heights): a lid's thickness when it rests on
  // the globe, a tunnel's depth when the face stands proud of it
  const proud = (h, which, t, dz) => {
    const g = h.globes.find((q) => q.side === 'R'), c = h.relational.eyeRigs.find((e) => e.side === 'R').margins[which](t).c, x = c.x * sc, z = (c.z + dz) * sc;
    const front = (f) => { let y = (c.y + 0.15) * sc; while (f({ x, y, z }) > 0 && y > (c.y - 0.2) * sc) y -= 0.0001; return y; };
    return (front(h.field) - front(g.field)) / sc;
  };
  const loose = relationalHead({ sex: 'male', ears: false, globes: false }), seated = relationalHead({ sex: 'male', ears: false, globes: false, seat: true });
  it('rests the lower lid on the globe, as the upper lies, where the cheek stood proud of it', () => {
    for (const t of [0.2, 0.5, 0.8]) {
      expect(proud(loose, 'lower', t, -0.005)).toBeGreaterThan(0.05);
      expect(proud(seated, 'lower', t, -0.005)).toBeLessThan(0.03);
    }
    // (the upper lid lay on the globe already: the seat leaves its middle as it was, within its blend)
    expect(proud(seated, 'upper', 0.5, 0.004)).toBeCloseTo(proud(loose, 'upper', 0.5, 0.004), 2);
    expect(proud(seated, 'lower', 0.5, -0.005)).toBeLessThan(proud(seated, 'upper', 0.5, 0.004) + 0.01);
  });
  it('brings the eye forward, short of the glabella, and hangs the brow\'s arc and ties lower', () => {
    const P0 = seated.relational.points, cornea = (h) => h.globes.find((g) => g.side === 'R').centre.y / sc + GLOBE.back;
    const [share, behind] = SEAT.forward, room = P0.g.y - behind - P0.eyeR.y;
    // (a share of the way to the nose's tip, never nearer the glabella than `behind`)
    const dy = cornea(seated) - cornea(loose);
    expect(dy).toBeGreaterThan(0);
    expect(dy).toBeCloseTo(Math.min(share * (P0.prn.y - P0.eyeR.y), room), 9);
    expect(P0.g.y - cornea(seated)).toBeGreaterThan(behind - 1e-9);
    // (the skin about it stays: the bare wave is the same)
    const q = { x: P0.eyeR.x * sc, y: P0.eyeR.y * sc, z: (P0.eyeR.z + 0.1) * sc };
    expect(seated.bare(q)).toBe(loose.bare(q));
    const [A, B] = [loose, seated].map((h) => h.relational.bridge);
    expect(A.arcs.R.K.z - B.arcs.R.K.z).toBeCloseTo(SEAT.brow[0], 9);
    expect(A.sides.R.head.z - B.sides.R.head.z).toBeCloseTo(SEAT.brow[1], 9);
    expect(A.sides.R.tail.z - B.sides.R.tail.z).toBeCloseTo(SEAT.brow[1], 9);
  });
});

describe('the face\'s muscles (FACS action units: face-acting/facs.js)', () => {
  const rest = relationalHead({ sex: 'male', ears: false, globes: false }).relational.rest;
  const moved = (actions) => relationalHead({ sex: 'male', ears: false, globes: false, actions }).relational.moved;
  const d = (A, name, k, ax) => (A[name][k][ax] - rest[name][k][ax]) * MM;
  it('pull the mouth\'s corner by its muscle, one side alone by the side\'s own, and leave the brows', () => {
    const f = moved({ frown: 1 }), fl = moved({ frownL: 1 }), s = moved({ stretch: 1 });
    // (the corner is each lower lip's first bead: down for the depressor, out for the risorius)
    expect(d(f, 'lowerLipL', 'a', 'z')).toBeLessThan(-3); expect(d(f, 'lowerLipR', 'a', 'z')).toBeLessThan(-3);
    expect(d(fl, 'lowerLipL', 'a', 'z')).toBeLessThan(-3); expect(d(fl, 'lowerLipR', 'a', 'z')).toBeCloseTo(0, 9);
    expect(Math.abs(s.lowerLipR.a.x) - Math.abs(rest.lowerLipR.a.x)).toBeGreaterThan(3 / MM);
    expect(d(f, 'browPad', 'a', 'z')).toBe(0);
  });
  it('draw the nose\'s wings up for the sneer, and push the lower lip up from the chin for the mentalis', () => {
    expect(d(moved({ sneer: 1 }), 'nostrilR', 'c', 'z')).toBeGreaterThan(3);
    const c = moved({ chinRaise: 1 });
    expect(d(c, 'lowerLipBodyR', 'c', 'z')).toBeGreaterThan(2);
    // (the chin itself is bone: the mentalis moves the soft tissue over it)
    expect(d(c, 'chin', 'c', 'z')).toBe(0);
  });
  it('shape the lips for speech: rounded forward and in, turned out, the lower under the teeth, parted, the bone still', () => {
    // (each lip's middle is its vajras' last bead, its corner the first)
    const pk = moved({ pucker: 1 }), fn = moved({ funnel: 1 }), rl = moved({ rollLower: 1 }), lp = moved({ lipsPart: 1 });
    expect(d(pk, 'upperLipR', 'c', 'y')).toBeGreaterThan(5); expect(d(pk, 'lowerLipR', 'c', 'y')).toBeGreaterThan(5);
    expect(Math.abs(rest.lowerLipR.a.x) - Math.abs(pk.lowerLipR.a.x)).toBeGreaterThan(5 / MM);
    expect(d(fn, 'upperLipR', 'c', 'z')).toBeGreaterThan(2); expect(d(fn, 'lowerLipR', 'c', 'z')).toBeLessThan(-2);
    expect(d(rl, 'lowerLipR', 'c', 'y')).toBeLessThan(-3); expect(d(rl, 'lowerLipR', 'c', 'z')).toBeGreaterThan(2); expect(d(rl, 'upperLipR', 'c', 'y')).toBe(0);
    expect(d(lp, 'upperLipR', 'c', 'z')).toBeGreaterThan(2); expect(d(lp, 'lowerLipR', 'c', 'z')).toBeLessThan(-2); expect(d(lp, 'lowerLipR', 'a', 'z')).toBe(0);
    for (const A of [pk, fn, rl, lp]) { expect(d(A, 'chin', 'c', 'z')).toBe(0); expect(d(A, 'browPad', 'a', 'z')).toBe(0); }
  });
});
