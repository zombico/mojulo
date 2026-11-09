import { describe, it, expect } from 'vitest';
import { readLevel } from './graph.js';
import { mapLevel, placeOf } from './map.js';
import { layLevel } from './index.js';
import { outTrailStyle } from '../era/out-trail-board.js';
import { outTrailSpan } from '../era/out-trail.js';

// THE MAP: a level laid as a graph on one ground. A junction's arms leave it at their gates' bearings; a trail after a
// trail carries its line on; the grounds the sections own never lie over each other.

const hub = (radius, gates) => ({ junction: { radius, gates } });
const level = (nodes, edges) => ({ layout: 'map', kit: 'isekai-meadow', root: 'square', nodes, edges });
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('the map layout', () => {
  it('lays a junction\'s arms off its gates, each heading out along its bearing, its path starting on the gate', () => {
    const L = mapLevel(readLevel(level(
      { square: hub(26, { north: 0, southeast: 120, southwest: 240 }), meadow: { trail: { run: 12 } }, pass: { trail: { run: 12 } } },
      [{ from: 'square', to: 'meadow', gate: 'north' }, { from: 'square', to: 'pass', gate: 'southeast' }],
    )));
    expect(L.order).toEqual(['square', 'meadow', 'pass']);
    // (north is the frame's +y: the meadow heads along +y; the south-east arm along a bearing of 120°)
    expect(L.places.meadow.heading).toBeCloseTo(Math.PI / 2, 3);
    expect(L.places.pass.heading).toBeCloseTo(Math.PI / 2 - (120 * Math.PI) / 180, 2);
    // each path's first point is on its gate: the junction's edge, along the bearing
    const { st } = outTrailStyle({ kit: 'isekai-meadow' });
    for (const [id, deg] of [['meadow', 0], ['pass', 120]]) {
      const x0 = outTrailSpan(st, { run: 12 }, 1).trailX(0), a = Math.PI / 2 - (deg * Math.PI) / 180;
      expect(dist(placeOf(L.places[id], [x0, 0]), [26 * Math.cos(a), 26 * Math.sin(a)])).toBeLessThan(0.05);
    }
    // one page's worth of stages, every section placed
    expect(L.stages.map((s) => s.section)).toEqual(['junction', 'trail', 'trail']);
    expect(Object.keys(L.places).sort()).toEqual(['meadow', 'pass', 'square']);
  });

  it('carries a trail after a trail on along its line: the same heading, its frame its depth on', () => {
    const L = mapLevel(readLevel(level(
      { square: hub(26, { north: 0, south: 180 }), lower: { trail: { run: 12 } }, upper: { trail: { run: 12 } } },
      [{ from: 'square', to: 'lower', gate: 'south' }, { from: 'lower', to: 'upper' }],
    )));
    expect(L.places.upper.heading).toBeCloseTo(L.places.lower.heading, 6);
    const D = Math.hypot(L.places.upper.at[0] - L.places.lower.at[0], L.places.upper.at[1] - L.places.lower.at[1]);
    expect(D).toBeGreaterThan(60);
    // (and the follower's trail recipe follows the one before it, as a sequential chain does)
    expect(L.stages.find((s) => s.node === 'upper').manifest.trail.after.id).toBe('lower');
  });

  it('refuses arms whose grounds lie over each other, and a loop', () => {
    const tight = level({ square: hub(10, { a: 0, b: 40 }), one: { trail: { run: 12 } }, two: { trail: { run: 12 } } },
      [{ from: 'square', to: 'one', gate: 'a' }, { from: 'square', to: 'two', gate: 'b' }]);
    expect(() => mapLevel(readLevel(tight))).toThrow(/'one' and 'two' lie over each other.*widen the junction/);
    const loop = level({ square: hub(26, { a: 0, b: 180 }), one: { trail: true }, two: { trail: true } },
      [{ from: 'square', to: 'one', gate: 'a' }, { from: 'one', to: 'two' }, { from: 'square', to: 'two', gate: 'b' }]);
    expect(() => mapLevel(readLevel(loop))).toThrow(/reached from both/);
  });

  it('a junction is the map\'s: the reader names its gates and refuses one on a walk', () => {
    expect(() => readLevel(level({ square: hub(26, { a: 0, b: 180 }), one: { trail: true } }, [{ from: 'square', to: 'one' }]))).toThrow(/name its gate/);
    expect(() => readLevel(level({ square: hub(26, { a: 0, b: 180 }), one: { trail: true } }, [{ from: 'square', to: 'one', gate: 'c' }]))).toThrow(/'c' is not one of 'square''s gates/);
    expect(() => readLevel({ nodes: { square: hub(26, { a: 0, b: 180 }) } })).toThrow(/laid as a map/);
    // (laid through the level's own door)
    expect(layLevel(level({ square: hub(26, { a: 0, b: 180 }), one: { trail: { run: 12 } } }, [{ from: 'square', to: 'one', gate: 'a' }])).layout).toBe('map');
  });
});
