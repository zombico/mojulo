import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { address, frameAt, refineStation, refineSlot, volumize, strip, stripProfile, sweep, tiles, ringLoft, loftParts, ringAt, pinned, projectOnto, pinToAddress, clone } from './station-loft-detail.js';
import { compileLayered } from './station-loft.js';
import { expandPlan, PLAN_SCHEMA } from './station-loft-plan.js';

// A species-free carrier: one trunk from a ring plan (8 slots, 4 stations), compiled without details.
const carrierRecipe = () => expandPlan({
  schema: PLAN_SCHEMA, frame: { up: '+z', front: '+y' }, joints: {},
  segments: [{ name: 'body', kind: 'trunk', stations: [{ z: 0, r: [0.3, 0.22] }, { z: 0.3, r: [0.34, 0.26], yc: 0.02, e: 2.4 }, { z: 0.6, r: [0.3, 0.24] }, { z: 0.9, r: [0.2, 0.16], yc: -0.01 }], caps: { back: [0, 0, -0.1], tip: [0, 0, 1] }, mirror: 'plane' }],
});
const L1 = (recipe) => compileLayered(recipe, {}, { details: false, creases: false }).parts;
const closed = (mesh) => { const edges = new Map(); let bad = 0; for (const f of Object.values(mesh.faces)) for (let i = 0; i < 3; i++) { const a = f[i], b = f[(i + 1) % 3]; const k = a < b ? `${a}|${b}` : `${b}|${a}`; const e = edges.get(k) || [0, 0]; e[0]++; e[1] += a < b ? 1 : -1; edges.set(k, e); }
  for (const [c, bal] of edges.values()) if (c !== 2 || bal) bad++; return bad === 0; };
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

describe('station-loft-detail — the detail operators, species-free', () => {
  it('names no species', () => {
    const src = readFileSync(fileURLToPath(new URL('./station-loft-detail.js', import.meta.url)), 'utf8');
    for (const word of ['dragon', 'bear', 'horn', 'crest', 'fang', 'raccoon']) expect(new RegExp(`\\b${word}\\b`, 'i').test(src), word).toBe(false);
  });
  it('an address names a point on the bilinear patch; refinement keeps it and converges on it; the mirrored address mirrors', () => {
    const plain = carrierRecipe(), fine = clone(plain);
    refineStation(fine, 'body', 'st1', 'st2', [0.5]); refineStation(fine, 'body', 'st0', 'st1', [0.25, 0.75]); refineSlot(fine, 'body', 'front', 'sideR', 'cheek', 0.5);
    const [A, B] = [plain, fine].map(L1);
    expect(B.body.stations.length).toBe(A.body.stations.length + 3); expect(B.body.slots.length).toBe(A.body.slots.length + 2);
    expect(B.body.stations.map((s) => s.id)).toContain('st1_st2_50'); expect(B.body.slots).toContain('cheekR'); expect(B.body.slots).toContain('cheekL');
    const S = A.body.slots, P = (j, k) => A.body.points[`body/st${j}.${S[k]}`]; const lerp = (a, b, w) => a.map((x, n) => x + (b[n] - x) * w);
    for (const q of [[1.45, 0.55], [0.6, 1.5], [2.3, 2.7]]) {
      const i = Math.floor(q[0]), k = Math.floor(q[1]), u = q[0] - i, v = q[1] - k; const bilinear = lerp(lerp(P(i, k), P(i + 1, k), u), lerp(P(i, k + 1), P(i + 1, k + 1), u), v);
      const coarse = dist(frameAt(A, 'body', q, 'R').origin, bilinear), refined = dist(frameAt(B, 'body', q, 'R').origin, bilinear);
      expect(refined).toBeLessThanOrEqual(coarse + 1e-9);
      const r = frameAt(B, 'body', q, 'R').origin, l = frameAt(B, 'body', q, 'L').origin; expect(l[0]).toBeCloseTo(-r[0], 9); expect(l[1]).toBeCloseTo(r[1], 9); expect(l[2]).toBeCloseTo(r[2], 9);
    }
    expect(() => address(A, 'body', 9, 1)).toThrow(/off body/);
    const pin = address(A, 'body', 1.3, 1.6, 'R'); expect(pinToAddress(A.body, pin).at.map((x) => +x.toFixed(6))).toEqual([1.3, 1.6]);
  });
  it('volumize pushes named slots radially, mirrored by the `*` suffix, only on weighted stations', () => {
    const r = carrierRecipe(); const before = clone(r.parts.body.stations);
    volumize(r, 'body', { 'front*': 1, front: 0.5 }, { st1: 1 }, 0.02);
    const st1 = r.parts.body.stations[1], st0 = r.parts.body.stations[0];
    expect(dist(st1.points.frontR, before[1].points.frontR)).toBeCloseTo(0.02, 9); expect(dist(st1.points.frontL, before[1].points.frontL)).toBeCloseTo(0.02, 9);
    expect(st1.points.frontL[0]).toBeCloseTo(-st1.points.frontR[0], 9); expect(dist(st1.points.front, before[1].points.front)).toBeCloseTo(0.01, 9);
    expect(st0.points).toEqual(before[0].points);
  });
  it('strips, sweeps, tiles and ring lofts are closed, pinned, mirrored by side, and deterministic', () => {
    const A = L1(carrierRecipe());
    const addrs = [[0.5, 0.6], [1.2, 0.8], [1.9, 0.9]];
    const sR = strip(A, 'body', addrs, 'R', stripProfile({ w: 0.02, h: 0.01, taper: [0.8, 1, 0.8], facing: 'down' })), sL = strip(A, 'body', addrs, 'L', stripProfile({ w: 0.02, h: 0.01, taper: [0.8, 1, 0.8], facing: 'down' }));
    expect(closed(sR)).toBe(true); expect(sR.pin.parent).toBe('body'); expect(sL.pin.handedness).toBe(-1);
    for (const k of Object.keys(sR.points)) { const p = sR.points[k], q = sL.points[k]; expect(q[0]).toBeCloseTo(-p[0], 9); expect(q[2]).toBeCloseTo(p[2], 9); }
    const horn = sweep([[0, 0, 0], [0, 0, 0.05], [0, 0, 0.1], [0, 0, 0.14]], [0.02, 0.016, 0.01, 0.004], 8, { curl: 0.6, curlAxis: [1, 0, 0] });
    expect(closed(horn)).toBe(true); expect(Math.abs(horn.points['st2.s0'][1]) + Math.abs(horn.tip?.[1] ?? 0)).toBeGreaterThan(1e-3);   // the curl bent the last ring off the axis
    const placed = pinned(A, 'body', [1.5, 1], 'R', horn, 'Horns'); expect(placed.pin.face).toMatch(/^body\//); expect(Object.keys(placed.points).length).toBe(Object.keys(horn.points).length);
    const T = { s: [0.3, 2.6], t: [0.4, 2.6], grid: [4, 3], sides: 6, coverage: 1.15, inset: 0.4, height: 0.012, lean: -0.3, edgeFade: 0.2, wobble: 0.3, jitter: 0.3, brick: true, group: ['Scale', 'Plate'] };
    const t1 = tiles(A, 'body', 'R', T, 'tile0R'), t2 = tiles(A, 'body', 'R', T, 'tile0R');
    expect(JSON.stringify(t1)).toBe(JSON.stringify(t2)); expect(Object.keys(t1).length).toBeGreaterThan(6);
    for (const m of Object.values(t1)) { expect(closed(m)).toBe(true); expect(m.pin.parent).toBe('body'); }
    const torus = ringLoft(Array.from({ length: 12 }, (_, j) => { const phi = 2 * Math.PI * j / 12; return ringAt([Math.cos(phi) * 0.05, Math.sin(phi) * 0.05, 0], [-Math.sin(phi), Math.cos(phi), 0], 0.01, 6); }));
    expect(closed(torus)).toBe(true); expect(Object.keys(torus.faces).length).toBe(12 * 6 * 2);
    const hit = projectOnto(A.body, [0, 0, 0.45], [0, 1, 0]); expect(Math.abs(hit[1])).toBeGreaterThan(0.2); expect(hit[0]).toBeCloseTo(0, 9);   // the nearest hit either way along the direction
    expect(closed(loftParts([ringAt([0, 0, 0], [0, 0, 1], 0.02, 5), ringAt([0, 0, 0.05], [0, 0, 1], 0.01, 5)], [0, 0, -0.01], [0, 0, 0.06]))).toBe(true);
  });
});
