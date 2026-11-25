import { describe, expect, it } from 'vitest';

import { buildCapital, buildStation, fleetPayload, placeFleet } from './build.js';
import { clipToGrid, FORMS } from './forms.js';
import { CAPITAL_CLASSES, STATION_KINDS } from './classes.js';
import { stencil } from './structures.js';
import { ROLES } from './language.js';
import { readKibble, hullKibbleScript } from '../scene/channels/hull-kibble.js';

// ── the fleet's forms (fleet/forms.js): a ship read as one shape (a wedge, a concept solid, blobs on an anchor), its
// volume cut into blocks, its surface clipped to them, held by its welds to a reactor a pilot can reach ─────────────
const overlap = (a, b) => [0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 1e-3);
// (rupa-space's weld: two blocks flush on one axis, overlapping on the other two)
const touch = (a, b) => { let flush = 0; for (let k = 0; k < 3; k++) { const o = Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]); if (o < -0.05) return false; if (o <= 0.05) flush++; } return flush === 1; };
const heldAll = (B) => {
  const held = new Set(B.pieces.filter((p) => B.anchor.includes(p.id))), q = [...held];
  while (q.length) { const a = q.pop(); for (const b of B.pieces) if (!held.has(b) && touch(a, b)) { held.add(b); q.push(b); } }
  return B.pieces.filter((p) => !held.has(p)).map((p) => p.id);
};
// (one class of each family, and of the concept solids each shape: each its own procedure)
const pick = (pred) => Object.keys(CAPITAL_CLASSES).find((c) => pred(CAPITAL_CLASSES[c]));
const CASES = [pick((C) => C.form === 'wedge'), pick((C) => C.shape === 'cube'), pick((C) => C.shape === 'sphere'), pick((C) => C.shape === 'octahedron'), pick((C) => C.form === 'globform' && C.anchor)];

describe('the fleet\'s forms', () => {
  it('cuts a convex polygon by a grid: every piece in one cell, the area kept', () => {
    const G = { min: [0, 0, -1], size: [10, 10, 2], n: [3, 3, 1] };
    const sq = [[2, 2, 0], [27, 2, 0], [27, 18, 0], [2, 18, 0]];
    const P = clipToGrid(sq, G);
    const area = (a) => { let s = 0; for (let i = 0; i < a.length; i++) { const p = a[i], q = a[(i + 1) % a.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; };
    expect(P.length).toBe(6);
    expect(P.reduce((s, q) => s + area(q.poly), 0)).toBeCloseTo(area(sq), 6);
    for (const { poly, cell } of P) for (const p of poly) for (const k of [0, 1]) { expect(p[k]).toBeGreaterThanOrEqual(G.min[k] + cell[k] * G.size[k] - 1e-9); expect(p[k]).toBeLessThanOrEqual(G.min[k] + (cell[k] + 1) * G.size[k] + 1e-9); }
  });

  it('builds each family as blocks that never overlap, every one welded back to its reactor, every face on a block', () => {
    expect(CASES.every(Boolean)).toBe(true);
    expect(Object.keys(FORMS).sort()).toEqual(['concept', 'cylinder', 'globform', 'ringship', 'torus', 'wedge']);
    for (const c of CASES) {
      const B = buildCapital(c), ids = new Set(B.pieces.map((p) => p.id));
      for (let i = 0; i < B.pieces.length; i++) for (let j = i + 1; j < B.pieces.length; j++) expect(overlap(B.pieces[i], B.pieces[j]), `${c} ${B.pieces[i].id} ${B.pieces[j].id}`).toBe(false);
      expect(heldAll(B), c).toEqual([]);
      expect(B.faces.every((f) => ids.has(f.piece)), c).toBe(true);
      expect(B.hardpoints.length, c).toBeGreaterThan(0);
      expect(B.hardpoints.every((h) => ids.has(h.id)), c).toBe(true);
    }
  });

  it('puts its reactor where a pilot can reach it: a casing block open to space', () => {
    for (const c of CASES) {
      const B = buildCapital(c), core = B.pieces.filter((p) => B.core.includes(p.id));
      expect(core.length, c).toBe(CAPITAL_CLASSES[c].coreCells ?? 2);
      expect(core.every((p) => p.role === 'core'), c).toBe(true);
      const open = core.some((p) => [0, 1, 2].some((k) => [-1, 1].some((s) => {
        const q = [0, 1, 2].map((j) => (p.min[j] + p.max[j]) / 2); q[k] = (s > 0 ? p.max[k] : p.min[k]) + s;
        return !B.pieces.some((o) => o !== p && [0, 1, 2].every((j) => q[j] >= o.min[j] && q[j] <= o.max[j]));
      })));
      expect(open, c).toBe(true);
    }
  });

  it('reads as its family: a wedge to a point at the bow, a concept solid as wide as long, a globform\'s anchor its line', () => {
    const W = buildCapital(CASES[0]), C = CAPITAL_CLASSES[CASES[0]];
    const span = (B, k) => Math.max(...B.pieces.map((p) => p.max[k])) - Math.min(...B.pieces.map((p) => p.min[k]));
    // (as long as its class, near enough: the bow's last metres too thin for a block, the bells proud of the stern)
    expect(Math.abs(span(W, 0) / C.length - 1)).toBeLessThan(0.06);
    // (the plan narrows to the bow: the blocks in its fore tenth no wider than a tenth of the beam)
    const fore = W.pieces.filter((p) => p.min[0] > C.length * 0.4);
    expect(Math.max(...fore.map((p) => Math.max(Math.abs(p.min[1]), Math.abs(p.max[1]))))).toBeLessThan(C.beam * 0.15);
    const K = buildCapital(CASES[1]);
    expect(span(K, 0) / span(K, 1)).toBeCloseTo(1, 1);
    const G = buildCapital(CASES[4]);
    expect(G.pieces.some((p) => p.role === 'deck')).toBe(true);    // (the anchor's blocks: dense with kit)
  });

  it('carries its detail as kibble by role, its own levels over the language\'s, onto the page\'s channel', () => {
    const c = CASES[0], C = CAPITAL_CLASSES[c], P = placeFleet(buildCapital(c), { id: 'w' });
    const D = fleetPayload([P]);
    const deck = P.blocks.find((b) => b.role === 'deck');
    expect(D.kibble.blocks[deck.id]).toBe(C.kibble.deck);
    // (a modular ship's from the language's roles; a truss none)
    const M = fleetPayload([placeFleet(buildCapital('frigate'), { id: 'f' })]);
    expect(M.kibble.blocks['f/hull3.0']).toBe(ROLES.hull.kibble);
    expect(M.kibble.blocks['f/spine']).toBeUndefined();
    const K = readKibble(D.kibble);
    expect(K.scale).toBeGreaterThan(0);
    expect(readKibble({ blocks: { a: 0 } })).toBeNull();
    const js = hullKibbleScript(K);
    expect(js).toContain(`meshes['break:' + id]`);
    expect(js).toContain(deck.id);
    expect(() => new Function('meshes', js)).not.toThrow();
  });

  it('is deterministic: the same class and seed, the same ship', () => {
    const c = CASES[4];
    expect(JSON.stringify(buildCapital(c, { seed: 3 }))).toBe(JSON.stringify(buildCapital(c, { seed: 3 })));
  });

  it('holds a yard\'s berth in its cradle: the ship half built in the frame is anchored, nothing drifts', () => {
    const B = buildStation('shipyard');
    expect(B.anchor.some((id) => id.startsWith('berth:'))).toBe(true);
    expect(heldAll(B)).toEqual([]);
  });
  describe('its structures (fleet/structures.js), civil or military', () => {
    // (each structure form once, in each dress: the dress is its own procedure)
    const pickS = (form) => Object.keys(STATION_KINDS).find((k) => STATION_KINDS[k].form === form);
    const S = [['station', pickS('cylinder')], ['station', pickS('torus')], ['capital', Object.keys(CAPITAL_CLASSES).find((c) => CAPITAL_CLASSES[c].form === 'ringship')]];
    const build = (kind, k, use) => (kind === 'station' ? buildStation(k, { use }) : buildCapital(k, { use }));
    const row = (kind, k) => (kind === 'station' ? STATION_KINDS[k] : CAPITAL_CLASSES[k]);
    it('stands as blocks that never overlap, all welded to its reactor, its systems by its use on it', () => {
      for (const [kind, k] of S) for (const use of ['civil', 'military']) {
        const B = build(kind, k, use), tag = `${k} ${use}`, ids = new Set(B.pieces.map((p) => p.id));
        for (let i = 0; i < B.pieces.length; i++) for (let j = i + 1; j < B.pieces.length; j++) expect(overlap(B.pieces[i], B.pieces[j]), tag).toBe(false);
        expect(heldAll(B), tag).toEqual([]);
        expect(B.faces.every((f) => ids.has(f.piece)), tag).toBe(true);
        expect(B.systems.map((y) => y.kind), tag).toEqual(row(kind, k).systems[use].map((y) => y.kind));
      }
    });
    it('dresses by its use: civil glazed and lit, no guns; military armoured, gunned, numbered, no glazing', () => {
      for (const [kind, k] of S) {
        const C = build(kind, k, 'civil'), M = build(kind, k, 'military');
        const glazed = (B) => B.faces.filter((f) => f.lit && f.color === '#5c7e9e').length;
        expect(glazed(C), k).toBeGreaterThan(0);
        expect(glazed(M), k).toBe(0);
        expect(C.hardpoints.length, k).toBe(0);
        expect(M.hardpoints.length, k).toBeGreaterThan(0);
        // (its number: a stencil's bars in its paint, dark on its light hull)
        expect(M.faces.some((f) => /^#1[d-f]/.test(f.color)), k).toBe(true);
        expect(M.pieces.some((p) => p.role === 'armour') || M.faces.length > C.faces.length * 0.5, k).toBe(true);
      }
    });
    it('paints a hull number seven-segment, a bar a segment', () => {
      const bars = (t) => stencil(t, [0, 0, 0], [1, 0, 0], [0, 0, 1], 10).length;
      expect(bars('8')).toBe(7);
      expect(bars('1')).toBe(2);
      expect(bars('07')).toBe(6 + 3);
    });
  });
});
