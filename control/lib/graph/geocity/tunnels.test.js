// THE TUNNELS UNDER THE STREETS (`geocity.under`): the walked-in podiums' concourses joined below grade. Which passages a
// network lays (two concourses facing each other across one street, overlapping along it, nothing between), a passage's
// floor (its cover under the street and the plazas, no ramp steeper than 1:12, a stair only where a ramp cannot meet its
// concourse), the network's laws, and the gate on the smallest evocation that holds a network: each passage walked from
// one podium's plaza, down its stair, along the passage and up into the next podium to its plaza, and back.
import { describe, it, expect } from 'vitest';
import { tunnelEdges, tunnelOf, networkLaws, TUNNEL } from './tunnels.js';
import { assembleGeocityScene } from './scene.js';
import { walker } from './walk-gate.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon' };

describe('the passages a network lays', () => {
  // two blocks facing each other across a 20 m street running east-west, their concourses overlapping along it
  const A = { id: 'A', rect: [0, 0, 40, 40], concourse: [10, 10, 30, 30], width: 3.6 }, B = { id: 'B', rect: [0, 60, 40, 100], concourse: [14, 65, 34, 85], width: 3.6 };

  it('lays one across the street between two concourses that face each other, its middle where they overlap', () => {
    const [e, ...more] = tunnelEdges([A, B]);
    expect(more).toEqual([]);
    expect(e).toMatchObject({ a: 'A', b: 'B', axis: 'y', sideA: '+y', sideB: '-y' });
    expect(e.u).toBeCloseTo((14 + 30) / 2, 5);
  });

  it('lays none where they do not overlap along the street, where a block stands between, or across two streets', () => {
    expect(tunnelEdges([A, { ...B, concourse: [32, 65, 39, 85] }])).toEqual([]);
    const between = [0, 45, 40, 55];
    expect(tunnelEdges([A, B], [A.rect, B.rect, between])).toEqual([]);
    expect(tunnelEdges([A, { ...B, rect: [0, 200, 40, 240], concourse: [14, 205, 34, 225] }])).toEqual([]);
  });

  it('measures the network: every concourse reached, or the pieces that are not', () => {
    const t = { a: 'A', b: 'B', cover: 1.2, slab: 0.5, grade: 1 / 14, length: 40 };
    const laws = networkLaws([A, B, { id: 'C' }], [t]), law = (id) => laws.find((l) => l.law === id);
    expect(law('under-reached')).toMatchObject({ ok: false });
    expect(law('under-reached').value).toMatch(/C not reached from A, B/);
    expect(networkLaws([A, B], [t]).every((l) => l.ok)).toBe(true);
    expect(networkLaws([A, B], [{ ...t, cover: 0.4 }]).find((l) => l.law === 'under-cover').ok).toBe(false);
  });
});

describe('a passage\'s floor', () => {
  // A's way out at y 30.25, B's at y 64.75, a street from y 40 to 60; land at 10, each plaza at 11
  const edge = { a: 'A', b: 'B', axis: 'y', u: 20, sideA: '+y', sideB: '-y' };
  const port = (plane, z0) => ({ plane, lo: 18.2, hi: 21.8, z0, top: 2.7 });
  const ctx = { S: () => 10, top: () => 11, rectA: [0, 0, 40, 40], rectB: [0, 60, 40, 100], look: { floor: null, wall: null, ceiling: null, light: 0.3 } };

  it('keeps its cover under the street and the plazas, climbs no steeper than a ramp, and meets each concourse\'s floor', () => {
    // (B's way out 14.75 m into its block: room for a landing and a ramp down to the street's cover)
    const t = tunnelOf(edge, port(30.25, 6.5), port(74.75, 6.5), ctx);
    expect(t.cover).toBeGreaterThanOrEqual(TUNNEL.cover);
    expect(t.slab).toBeGreaterThanOrEqual(TUNNEL.slab);
    expect(t.grade).toBeLessThanOrEqual(TUNNEL.grade + 1e-6);
    expect(t.line[0][2]).toBeCloseTo(6.5, 5);
    expect(t.line[t.line.length - 1][2]).toBeCloseTo(6.5, 5);
    expect(t.length).toBeCloseTo(44.5, 5);
    // (under the street its ceiling a section's height over its floor, the street's cover over that)
    expect(t.level).toBeLessThanOrEqual(10 - TUNNEL.cover - TUNNEL.height);
    expect(t.ends.map((e) => e.kind)).toEqual(['ramp', 'ramp']);
    // its walls held, and its middle walked by the page's probe: no step over a riser, no wall
    expect(t.colliders).toHaveLength(2);
    const r = walker({ faces: t.faces, colliders: t.colliders })(t.line);
    expect(r.steepest).toBeLessThanOrEqual(0.31);
    expect(r.walls).toBe(0);
  });

  it('takes a stair where its block has no room for a ramp down to its cover', () => {
    // B's concourse 3 m over A's, its plaza and the street close under it: a ramp from B's landing would stand in the street
    const t = tunnelOf(edge, port(30.25, 6.5), port(64.75, 9.5), { ...ctx, S: (x, y) => (y > 40 && y < 60 ? 10 : 14), top: (x, y) => (y > 60 ? 14 : 11) });
    expect(t.ends[1]).toMatchObject({ kind: 'stair' });
    expect(t.ends[1].steps * TUNNEL.riser).toBeGreaterThanOrEqual(t.ends[1].drop - 1e-6);
    const r = walker({ faces: t.faces, colliders: t.colliders })(t.line);
    expect(r.steepest).toBeLessThanOrEqual(TUNNEL.riser + 1e-6);
    expect(r.walls).toBe(0);
    expect(r.end).toBeCloseTo(9.5, 3);
  });
});

describe('the network under an evocation, walked', () => {
  const N = assembleGeocityScene({ ...M, geocity: { ...geocity, evoke: 'neighbourhood', under: true } });
  const law = (id) => N.geocity.laws.find((l) => l.law === id), byId = new Map(N.anchors.map((a) => [a.id, a]));
  const tunnels = N.anchors.filter((a) => a.kind === 'tunnel');

  it('joins its podiums by passages under the streets, held to their laws', () => {
    expect(tunnels.length).toBeGreaterThan(1);
    expect(N.geocity.under.tunnels).toHaveLength(tunnels.length);
    for (const id of ['under-cover', 'under-grade', 'under-run']) expect(law(id).ok).toBe(true);
    // (every podium a passage reaches has its way out for it, and every passage two ends)
    for (const t of tunnels) for (const end of [t.from, t.to]) expect(byId.get(end).ports.some((p) => p.id === t.id.slice('tunnel-'.length))).toBe(true);
    // (a podium no passage reaches is named by the law that every concourse is reached)
    const lone = N.anchors.filter((a) => a.kind === 'building' && !a.ports.length).map((a) => a.id.slice('podium-'.length));
    for (const id of lone) expect(law('under-reached').value).toContain(id);
    expect(N.cameras.map((c) => c.name)).toContain('tunnel');
    expect(law('faces').ok).toBe(true);
  });

  it('walks each passage from one podium\'s plaza into the next and out onto its plaza, and back: no step over a riser, no wall, no box', () => {
    const walk = walker(N);
    for (const t of tunnels) {
      const id = t.id.slice('tunnel-'.length), A = byId.get(t.from), B = byId.get(t.to);
      const reachA = A.ports.find((p) => p.id === id).reach, reachB = B.ports.find((p) => p.id === id).reach;
      const way = [...A.down, ...reachA.slice(1), ...t.line.slice(1), ...reachB.slice().reverse().slice(1), ...B.down.slice().reverse().slice(1)];
      for (const pts of [way, way.slice().reverse()]) {
        const r = walk(pts);
        expect({ id, steepest: r.steepest <= 0.36, walls: r.crossed, boxes: r.boxes }).toEqual({ id, steepest: true, walls: [], boxes: [] });
        expect(r.end).toBeCloseTo(pts[pts.length - 1][2], 1);
      }
    }
  });
});
