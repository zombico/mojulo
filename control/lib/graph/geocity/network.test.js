// THE NETWORK UNDER A DOWNTOWN (`geocity.under`): the walked-in podiums' concourses joined below grade by passages
// (lib/graph/network, the `passage` section): on the smallest evocation that holds a network, every concourse reached
// (a dog-leg where two concourses do not face each other across their street), held to the network's laws, and each
// passage walked from one podium's plaza, down its stair, along the passage and up into the next podium to its plaza, and
// back.
import { describe, it, expect } from 'vitest';
import { assembleGeocityScene } from './scene.js';
import { walker } from '../network/walk-gate.js';

const geocity = { metro: { from: 'lakeshore', rings: { core: 350, frame: 700 } }, extent: [1800, 1500], water: { sides: ['s'], depth: 200 }, core: [0.5, 0.2] };
const M = { kind: 'geocube', cube: 'valley-morning', show: 'geocity', seed: 2, hour: 'noon' };

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
    // (every concourse reached: a dog-leg where two concourses do not face each other across their street)
    expect(law('under-reached').ok).toBe(true);
    expect(N.geocity.under.tunnels.some((t) => t.kind === 'dog-leg' && t.turns === 2)).toBe(true);
    expect(N.geocity.under.section).toBe('passage');
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
