// EXAGGERATE: the cube's hand. The plan never moves (the bend is nothing at a foot), a wall two buildings share moves
// once (one field over the world, never a tilt per building), the bend folds nothing (its bound under 1 on every hand),
// and the language caricatured stays on its rails with its door and its rhythm kept.
import { describe, it, expect } from 'vitest';
import {
  readExaggerate, exaggerateField, bendFaces, chunkFaces, leanFaces, exaggerateAnchor, exaggerateLaws, exaggerateCard,
  EXAGGERATE_PRESETS, EXAGGERATE_NAMES, skewCorners, skewWarp, offSquare, OFF_SQUARE,
} from './exaggerate.js';
import { readGeocube, GEOCUBE_PRESETS } from './geocube.js';
import { ELEMENT_SETS, ELEMENT_KINDS } from './out-anchor-elements.js';
import { townLanguage } from './out-town.js';
import { structureStyle } from './out-structures.js';
import { kitTemplates } from '../geocity/kit.js';
import { makeLight } from '../polygonizer/vexar.js';
import { exaggerateCardOf } from '../gameworld/style-guide.js';

const CUBE = Object.keys(GEOCUBE_PRESETS)[0];
const crooked = readExaggerate('crooked');
// a wall quad from (x0, y0) to (x1, y1), z0..z1
const wall = (x0, y0, x1, y1, z0, z1) => ({ corners: [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]], normal: [y1 - y0 ? 1 : 0, x1 - x0 ? -1 : 0, 0], fill: '#808080' });

describe('the term: a name, { from, …changes } or the terms, on the cube as a style word', () => {
  it('reads a name to its terms, a variant over its name, and refuses what is off its rails by name', () => {
    expect(readExaggerate('storybook')).toMatchObject({ name: 'storybook', ...EXAGGERATE_PRESETS.storybook });
    expect(readExaggerate({ from: 'street', lean: 3, kit: { lean: 1 } })).toMatchObject({ name: 'street', lean: 3, kit: { chunk: EXAGGERATE_PRESETS.street.kit.chunk, lean: 1 } });
    expect(readExaggerate({ lean: 2 })).toMatchObject({ lean: 2, elements: 0, kit: { chunk: 1, lean: 0 } });
    expect(readExaggerate(false)).toBe(null);
    expect(() => readExaggerate('wonky')).toThrow(/not a hand/);
    expect(() => readExaggerate({ lean: 20 })).toThrow(/lean is a number from 0 to 8/);
    expect(() => readExaggerate({ tilt: 2 })).toThrow(/tilt is not a term/);
  });

  it('rides the cube, reads again to itself, and no domain may change it', () => {
    const c = readGeocube({ from: CUBE, exaggerate: 'crooked' });
    expect(c.exaggerate).toEqual(crooked);
    expect(readGeocube(c).exaggerate).toEqual(crooked);
    expect(readGeocube(CUBE).exaggerate).toBeUndefined();
    expect(() => readGeocube({ from: CUBE, exaggerate: { lean: 99 } })).toThrow(/geocube: exaggerate\.lean/);
    expect(() => readGeocube({ from: CUBE, domains: { a: { exaggerate: 'crooked' } } })).toThrow(/a different exaggerate is a different cube/);
  });

  it('carries its card into the style guide; a plumb cube has none', () => {
    const card = exaggerateCardOf(readGeocube({ from: CUBE, exaggerate: 'street' }));
    expect(card).toMatchObject({ kind: 'exaggerate', id: 'street' });
    expect(card.laws.map((l) => l.law)).toEqual(['foot', 'fold', 'plumb']);
    expect(exaggerateCardOf(readGeocube(CUBE))).toBe(null);
    expect(exaggerateCard(null)).toBe(null);
  });
});

describe('the bend: one field over the world, nothing at a foot', () => {
  it('moves nothing at or under a foot, grows with height, and saturates past its reach', () => {
    const F = exaggerateField(crooked);
    for (const [x, y] of [[0, 0], [37.5, -12], [400, 900]]) {
      expect(F.at(x, y, 5, 5)).toEqual([0, 0, 0]);
      expect(F.at(x, y, 3, 5)).toEqual([0, 0, 0]);
    }
    // (find a place where it leans, then read it up the wall)
    const p = [[3, 4], [11, 2], [20, 30]].find(([x, y]) => Math.hypot(...F.at(x, y, 10, 0).slice(0, 2)) > 0.05);
    const up = [1, 5, 20, 200].map((z) => Math.hypot(...F.at(p[0], p[1], z, 0)));
    for (let i = 1; i < up.length; i++) expect(up[i]).toBeGreaterThan(up[i - 1]);
    expect(up[3]).toBeLessThan(crooked.reach * Math.tan((crooked.lean * Math.PI) / 180) * 1.5);
  });

  it('is the same bend from the same terms, and another from another seed', () => {
    const a = exaggerateField(crooked).at(12.3, 45.6, 9, 1), b = exaggerateField({ ...crooked }).at(12.3, 45.6, 9, 1);
    expect(a).toEqual(b);
    expect(exaggerateField({ ...crooked, seed: 7 }).at(12.3, 45.6, 9, 1)).not.toEqual(a);
  });

  it('folds nothing on any hand: a gap stays at least (1 − fold) of itself', () => {
    for (const name of EXAGGERATE_NAMES) {
      const E = readExaggerate(name), F = exaggerateField(E);
      expect(F.fold).toBeLessThan(1);
      expect(exaggerateLaws(E).find((l) => l.law === 'fold').ok).toBe(true);
      // two points a little apart anywhere up a wall: the bend never brings them nearer than its bound allows
      for (let k = 0; k < 40; k++) {
        const p = [k * 7.3, k * 3.1, 2 + (k % 9) * 4], q = [p[0] + 0.6, p[1] - 0.4, p[2] + 0.5], g = Math.hypot(0.6, 0.4, 0.5);
        const P = p.map((v, i) => v + F.at(...p, 0)[i]), Q = q.map((v, i) => v + F.at(...q, 0)[i]);
        expect(Math.hypot(P[0] - Q[0], P[1] - Q[1], P[2] - Q[2])).toBeGreaterThanOrEqual((1 - F.fold) * g - 1e-9);
      }
    }
  });

  it('moves a wall two buildings share once: the two halves still meet along it', () => {
    // a semi pair: two masses on one pad, their party wall at x = 10, each a face along it
    const faces = [wall(0, 0, 10, 0, 2, 9), wall(10, 0, 10, 8, 2, 9), wall(10, 8, 10, 0, 2, 9), wall(10, 0, 20, 0, 2, 9)];
    bendFaces(faces, [[0, 2, 2], [2, 4, 2]], crooked);
    const key = (p) => p.map((v) => v.toFixed(4)).join(',');
    const left = new Set(faces[1].corners.map(key));
    expect(faces[2].corners.every((p) => left.has(key(p)))).toBe(true);
    expect(key(faces[0].corners[1])).toBe(key(faces[3].corners[0]));
    // (and their feet stand where they stood)
    for (const f of faces) for (const p of f.corners.filter((c) => c[2] === 2)) expect(p[2]).toBe(2);
  });

  it('re-lights a bent face by the light on its bent normal, and leaves an unlit one its own', () => {
    const L = makeLight({ direction: [0.3, 0.5, -0.8], ambient: 0.4, diffuse: 0.6 });
    const lit = (n) => L.ambient + L.diffuse * Math.max(0, n[0] * L.toLight[0] + n[1] * L.toLight[1] + n[2] * L.toLight[2]);
    const strong = { ...crooked, lean: 8, sag: 0 }, F = exaggerateField(strong);
    const at = [[0, 0], [5, 9], [14, 3], [30, 22]].find(([x, y]) => Math.hypot(...F.at(x, y, 10, 0).slice(0, 2)) > 0.3);
    const a = [wall(at[0], at[1], at[0] + 1, at[1], 0, 10)], b = [wall(at[0], at[1], at[0] + 1, at[1], 0, 10)];
    bendFaces(a, [[0, 1, 0]], strong, { lit });
    bendFaces(b, [[0, 1, 0]], strong, { lit: () => null });
    expect(a[0].normal).not.toEqual([0, -1, 0]);
    expect(a[0].fill).not.toBe('#808080');
    expect(b[0].fill).toBe('#808080');
  });

  it('leans the street\'s furniture straight, its foot where it stood', () => {
    const post = [wall(0, 0, 0.2, 0, 0.15, 4)];
    bendFaces(post, [[0, 1, () => 0.15]], crooked, { kit: true });
    const [p0, , p2] = post[0].corners, t = Math.tan((crooked.kit.lean * Math.PI) / 180);
    expect(p0).toEqual([0, 0, 0.15]);
    expect(Math.hypot(p2[0] - 0.2, p2[1])).toBeCloseTo(3.85 * t, 4);
  });
});

describe('the pieces: chunked about their middle, leant over their reach', () => {
  it('thickens a piece\'s two thin dimensions and keeps its length and its foot', () => {
    const arm = [wall(0, 0, 3, 0, 5, 5.2), wall(0, 0.1, 3, 0.1, 5, 5.2)], post = [wall(0, 0, 0.2, 0, 0, 4), wall(0, 0.2, 0.2, 0.2, 0, 4)];
    const span = (fs, i) => { const v = fs.flatMap((f) => f.corners.map((c) => c[i])); return Math.max(...v) - Math.min(...v); };
    const A = chunkFaces(arm, 1.5), P = chunkFaces(post, 1.5);
    expect(span(A, 0)).toBeCloseTo(3, 6);
    expect(span(A, 2)).toBeCloseTo(0.3, 6);
    expect(span(P, 2)).toBeCloseTo(4, 6);
    expect(span(P, 0)).toBeCloseTo(0.3, 6);
    expect(Math.min(...P.flatMap((f) => f.corners.map((c) => c[2])))).toBe(0);
    expect(chunkFaces(arm, 1)).toBe(arm);
  });

  it('chunks the geocity kit and leans its lamps over the road; the works\' pieces and the paint as they were, its cars toys', () => {
    const L = makeLight({ direction: [0.3, 0.5, -0.8], ambient: 0.4, diffuse: 0.6 }), A = kitTemplates(L), B = kitTemplates(L, { exaggerate: crooked });
    const top = (fs) => fs.flatMap((f) => f.corners).reduce((a, c) => (c[2] > a[2] ? c : a));
    expect(top(B.lamp.e)[0]).toBeGreaterThan(top(A.lamp.e)[0]);   // (an east lamp leans east, over its road)
    expect(JSON.stringify(B.bin)).not.toBe(JSON.stringify(A.bin));
    for (const k of ['scaffold', 'dash', 'rail', 'fence']) expect(JSON.stringify(B[k])).toBe(JSON.stringify(A[k]));
    // (an exaggerated street's parked cars are toy cars, its paint as it was where the hand has no `streets`)
    expect(JSON.stringify(B.car)).not.toBe(JSON.stringify(A.car));
    expect(JSON.stringify(kitTemplates(L, { exaggerate: null }))).toBe(JSON.stringify(A));
    expect(leanFaces(A.bin, [1, 0], 0)).toBe(A.bin);
  });
});

describe('the language caricatured: more itself, on its rails, its door and its rhythm kept', () => {
  // (one anchor whose cap is pitched: the case the push reads most)
  const id = Object.keys(ELEMENT_SETS).find((k) => Object.values(ELEMENT_SETS[k].elements).some((e) => e.kind === 'cap' && typeof e.pitch === 'number'));
  const E = readExaggerate('street'), raw = ELEMENT_SETS[id], X = exaggerateAnchor(id, E);

  it('pushes each building element\'s number away from its rail\'s middle, inside the rail', () => {
    for (const [name, el] of Object.entries(raw.elements)) {
      const K = ELEMENT_KINDS[el.kind];
      if (!K || K.family !== 'building') { expect(X.elements[name]).toBe(el); continue; }
      for (const [p, def] of Object.entries(K.params)) {
        if (!(Array.isArray(def.rail) && typeof def.rail[0] === 'number' && typeof el[p] === 'number')) continue;
        const [lo, hi] = def.rail, mid = (lo + hi) / 2, v = el[p], w = X.elements[name][p];
        expect(w).toBeGreaterThanOrEqual(lo - 1e-9);
        expect(w).toBeLessThanOrEqual(hi + 1e-9);
        if (el.kind === 'door' || typeof def.hold === 'object') expect(w).toBe(v);
        else expect(Math.abs(w - mid)).toBeGreaterThanOrEqual(Math.abs(v - mid) - 1e-3);
      }
    }
  });

  it('keeps its id (its dice keep the town) and still composes; nothing to push is the anchor itself', () => {
    expect(X.id).toBe(id);
    const L = townLanguage(structureStyle('isekai-meadow', 1), X);
    expect(L.id).toBe(id);
    expect(exaggerateAnchor(id, null)).toBe(id);
    expect(exaggerateAnchor(id, { ...E, elements: 0 })).toBe(id);
  });
});

describe('the loud front\'s principles: no window square, no two neighbours one height', () => {
  it('reads a front over its hand, and refuses one off its rails by name', () => {
    expect(readExaggerate('street').front).toMatchObject(EXAGGERATE_PRESETS.street.front);
    expect(readExaggerate({ from: 'street', front: { skew: 0.25 } }).front).toMatchObject({ ...EXAGGERATE_PRESETS.street.front, skew: 0.25 });
    expect(readExaggerate({ from: 'street', front: false }).front).toBeUndefined();
    expect(readExaggerate('crooked').front).toBeUndefined();
    expect(() => readExaggerate({ front: { skew: 0.9 } })).toThrow(/front\.skew is a number from 0 to 0\.3/);
    expect(() => readExaggerate({ front: { stripes: 2 } })).toThrow(/stripes is 0 \(none\) or 3 to 16/);
    expect(readExaggerate('street').streets).toMatchObject(EXAGGERATE_PRESETS.street.streets);
    expect(readExaggerate({ from: 'street', streets: false }).streets).toBeUndefined();
    expect(() => readExaggerate({ streets: { paint: 9 } })).toThrow(/streets\.paint is a number from 1 to 3/);
  });

  it('turns every window at least three corners off square, drawn inward, the same from the same seed', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const w = 0.8 + (seed % 7) * 0.2, h = 1 + (seed % 5) * 0.25, off = skewCorners(seed, w, h, 0.05 + (seed % 6) * 0.05);
      const pts = [[0, 0], [w, 0], [w, h], [0, h]].map((p, i) => [p[0] + off[i][0], p[1] + off[i][1]]);
      expect(offSquare(pts)).toBeGreaterThanOrEqual(OFF_SQUARE);
      for (const [x, z] of pts) { expect(x).toBeGreaterThanOrEqual(-1e-9); expect(x).toBeLessThanOrEqual(w + 1e-9); expect(z).toBeGreaterThanOrEqual(-1e-9); expect(z).toBeLessThanOrEqual(h + 1e-9); }
    }
    expect(skewCorners(9, 1, 1.4, 0.2)).toEqual(skewCorners(9, 1, 1.4, 0.2));
    expect(offSquare([[0, 0], [1, 0], [1, 1], [0, 1]])).toBe(0);
  });

  it('carries a window\'s frame with the edge nearest it', () => {
    const off = skewCorners(4, 1, 1.5, 0.2), warp = skewWarp(off, 2, 1, 1, 1.5);
    expect(warp(2, 1)).toEqual([2 + off[0][0], 1 + off[0][1]]);
    expect(warp(1.8, 0.9)).toEqual([1.8 + off[0][0], 0.9 + off[0][1]]);   // (the sill's corner past the glass's)
  });
});
