// A NETWORK OF PASSAGES (lib/graph/network): which nodes it joins and by what path (straight across a gap where two rooms
// face each other, a dog-leg where they do not), a passage built to its section along that path (its cover under open
// ground and under a slab, no ramp steeper than its section's, level through every turn, a stair only where a ramp
// cannot meet its node's floor and its section takes one), the network's laws, and every section's passage walked end
// to end by the page's ground probe.
import { describe, it, expect } from 'vitest';
import { networkEdges, pathOf } from './edges.js';
import { passageOf, STAIR } from './passage.js';
import { networkLaws } from './laws.js';
import { readSection, SECTIONS, SECTION_IDS } from './sections.js';
import { walker } from './walk-gate.js';

const P = readSection('passage');

describe('the edges a network lays', () => {
  // two sites facing each other across a 20 m gap running east-west, their rooms overlapping along it
  const A = { id: 'A', rect: [0, 0, 40, 40], room: [10, 10, 30, 30], door: 3.6 }, B = { id: 'B', rect: [0, 60, 40, 100], room: [14, 65, 34, 85], door: 3.6 };

  it('lays one straight across the gap where the rooms overlap along it, its middle where they do', () => {
    const [e, ...more] = networkEdges([A, B], { section: P });
    expect(more).toEqual([]);
    expect(e).toMatchObject({ a: 'A', b: 'B', axis: 'y', kind: 'straight', sideA: '+y', sideB: '-y', mid: null });
    expect(e.uA).toBeCloseTo((14 + 30) / 2, 5);
    expect(pathOf(e, { plane: 30.5 }, { plane: 64.5 })).toEqual([[22, 30.5], [22, 64.5]]);
  });

  it('lays a dog-leg where their sites face each other but their rooms do not: out of each to the gap\'s middle line and along it, its jog a section wide', () => {
    const Bf = { ...B, rect: [10, 60, 50, 100], room: [32, 65, 48, 85] };
    // (sites round a corner from each other face nothing across the gap: no dog-leg down a street)
    expect(networkEdges([A, { ...Bf, rect: [44, 60, 84, 100], room: [52, 65, 72, 85] }], { section: P })).toEqual([]);
    const [e] = networkEdges([A, Bf], { section: P });
    expect(e).toMatchObject({ kind: 'dog-leg', axis: 'y', mid: 50 });
    expect(Math.abs(e.uB - e.uA)).toBeGreaterThanOrEqual(P.width);
    const path = pathOf(e, { plane: 30.5 }, { plane: 64.5 });
    expect(path).toHaveLength(4);
    for (let k = 0; k + 1 < path.length; k++) expect(path[k][0] === path[k + 1][0] || path[k][1] === path[k + 1][1]).toBe(true);
  });

  it('lays none where a site stands between them, or across two gaps', () => {
    expect(networkEdges([A, B], { section: P, blocks: [A.rect, B.rect, [0, 45, 40, 55]] })).toEqual([]);
    expect(networkEdges([A, { ...B, rect: [0, 200, 40, 240], room: [14, 205, 34, 225] }], { section: P })).toEqual([]);
  });

  it('measures the network: every node reached, or the pieces that are not', () => {
    const t = { a: 'A', b: 'B', cover: 1.2, slab: 0.5, grade: 1 / 14, length: 40 };
    const laws = networkLaws([A, B, { id: 'C' }], [t], { section: P, prefix: 'net', noun: 'building' });
    expect(laws.find((l) => l.law === 'net-reached')).toMatchObject({ ok: false });
    expect(laws.find((l) => l.law === 'net-reached').value).toMatch(/C not reached from A, B/);
    expect(networkLaws([A, B], [t], { section: P }).every((l) => l.ok)).toBe(true);
    expect(networkLaws([A, B], [{ ...t, cover: 0.4 }], { section: P }).find((l) => l.law === 'network-cover').ok).toBe(false);
  });
});

describe('a passage built to its section', () => {
  // ground at 10 between y 40 and 60, each site's slab at 11 over it
  const over = (x, y) => (y > 40 && y < 60 ? { z: 10, under: 'ground' } : { z: 11, under: 'slab' });
  const end = (plane, z0, u = 20) => ({ z0, lo: [u - 1.8, plane], hi: [u + 1.8, plane], top: 2.7, plane });
  const look = { light: 0.45, stripe: '#2f8fb0' };

  it('keeps its cover under the ground and the slab, climbs no steeper than its grade, and meets each node\'s floor', () => {
    const a = end(30.25, 6.5), b = end(74.75, 6.5), t = passageOf({ id: 'A-B', path: [[20, 30.25], [20, 74.75]], a, b, section: P, over, look });
    expect(t.cover).toBeGreaterThanOrEqual(P.cover);
    expect(t.slab).toBeGreaterThanOrEqual(P.slab);
    expect(t.grade).toBeLessThanOrEqual(P.grade + 1e-6);
    expect(t.line[0][2]).toBeCloseTo(6.5, 5);
    expect(t.line[t.line.length - 1][2]).toBeCloseTo(6.5, 5);
    expect(t.length).toBeCloseTo(44.5, 5);
    expect(t.level).toBeLessThanOrEqual(10 - P.cover - P.height);
    expect(t.ends.map((e) => e.kind)).toEqual(['ramp', 'ramp']);
    const r = walker({ faces: t.faces, colliders: t.colliders })(t.line);
    expect(r.steepest).toBeLessThanOrEqual(0.31);
    expect(r.walls).toBe(0);
  });

  it('takes a stair where its node\'s site has no room for a ramp down to its cover', () => {
    const t = passageOf({ id: 'A-B', path: [[20, 30.25], [20, 64.75]], a: end(30.25, 6.5), b: end(64.75, 9.5), section: P, over: (x, y) => (y > 40 && y < 60 ? { z: 10, under: 'ground' } : { z: y > 60 ? 14 : 11, under: 'slab' }), look });
    expect(t.ends[1]).toMatchObject({ kind: 'stair' });
    expect(t.ends[1].steps * STAIR.riser).toBeGreaterThanOrEqual(t.ends[1].drop - 1e-6);
    const r = walker({ faces: t.faces, colliders: t.colliders })(t.line);
    expect(r.steepest).toBeLessThanOrEqual(STAIR.riser + 1e-6);
    expect(r.walls).toBe(0);
    expect(r.end).toBeCloseTo(9.5, 1);
  });

  it('turns at square junctions along a dog-leg, level through each, walked end to end without a wall', () => {
    const path = [[20, 30.25], [20, 50], [56, 50], [56, 74.75]], a = end(30.25, 6.5), b = end(74.75, 6.5, 56);
    const t = passageOf({ id: 'A-B', path, a, b, section: P, over, look });
    expect(t.turns).toBe(2);
    expect(t.footprint).toHaveLength(5);
    // (each junction level: its floor one height)
    for (const [x, y] of [[20, 50], [56, 50]]) {
      const zs = t.faces.filter((f) => f.group === 'network:tunnel-floor' && f.corners.length === 4 && f.corners.every((c) => Math.abs(c[0] - x) <= P.width / 2 + 1e-6 && Math.abs(c[1] - y) <= P.width / 2 + 1e-6)).flatMap((f) => f.corners.map((c) => c[2]));
      expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(1e-6);
    }
    expect(t.cover).toBeGreaterThanOrEqual(P.cover);
    const r = walker({ faces: t.faces, colliders: t.colliders })(t.line), back = walker({ faces: t.faces, colliders: t.colliders })(t.line.slice().reverse());
    for (const w of [r, back]) { expect(w.steepest).toBeLessThanOrEqual(0.31); expect(w.crossed).toEqual([]); expect(w.boxes).toEqual([]); }
  });

  it('builds every section to its own box, depth and finish, each walked without a wall', () => {
    for (const id of SECTION_IDS) {
      const S = readSection(id), deep = (x, y) => (y > 40 && y < 60 ? { z: 20, under: 'ground' } : { z: 20, under: 'slab' });
      const t = passageOf({ id, path: [[20, 30.25], [20, 120]], a: end(30.25, 14 - S.height), b: end(120, 14 - S.height), section: S, over: deep, look });
      expect(t.faces.length).toBeGreaterThan(50);
      // (its width its section's: the floor's span across)
      const xs = t.faces.filter((f) => f.group === 'network:tunnel-floor').flatMap((f) => f.corners.map((c) => c[0]));
      expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(S.width, 5);
      expect(t.cover).toBeGreaterThanOrEqual(S.cover - 1e-6);
      expect(t.grade).toBeLessThanOrEqual(S.grade + 1e-6);
      expect(new Set(t.faces.map((f) => f.group)).size).toBeGreaterThan(4);
      const r = walker({ faces: t.faces, colliders: t.colliders })(t.line.map((p) => [p[0] + (id === 'vehicle' ? 0 : 0), p[1], p[2]]));
      expect(r.crossed).toEqual([]);
    }
    expect(() => readSection('canal')).toThrow(/is not a section/);
    expect(readSection({ from: 'service', width: 4 })).toMatchObject({ width: 4, finish: 'service' });
    expect(() => readSection({ from: 'service', finish: 'gold' })).toThrow(/finish is/);
    expect(Object.keys(SECTIONS)).toEqual(SECTION_IDS);
  });
});
