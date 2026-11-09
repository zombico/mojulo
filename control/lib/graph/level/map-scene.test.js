import { describe, it, expect } from 'vitest';
import { assembleMapScene } from './map-scene.js';
import { mapLevel } from './map.js';
import { readLevel } from './graph.js';

// THE MAP'S PAGE: each section built as its own page would be, then placed on the level's ground and composed into one.
// Stand-in stage pages (a flat ground under each trail, a wall along its cliff side, an anchor at its trailhead) show
// the placing exactly: turned to its heading, lifted to its gate, its walls laid as runs of short boxes.

const hub = (radius, gates) => ({ junction: { radius, gates } });
const level = (nodes, edges) => ({ layout: 'map', kit: 'isekai-meadow', root: 'square', nodes, edges });
// a stand-in trail page: its ground a sheet at height `h` (its own frame), a wall along x = 0, an anchor at its path
const stage = (h) => async (manifest) => ({
  faces: [{ corners: [[0, 0, h], [44, 0, h], [44, 80, h], [0, 80, h]], normal: [0, 0, 1], group: 'isekai:ground', fill: '#76b43a' }],
  colliders: [{ min: [-0.5, 0, h], max: [0, 80, h + 3], of: 'bound:-x' }],
  anchors: [{ id: 'trailhead', kind: 'beat', at: [26, 4, h], N: [0, 1, 0] }],
  walk: { speed: 6, spawn: [26, 2, h + 1.7], minEye: 1.7 },
  sky: { zenith: [1, 2, 3] }, cameras: [], outTrail: { id: `out-trail:${manifest.trail.id}` },
});
const W = level({ square: hub(26, { north: 0, east: 90, southwest: 225 }), meadow: { trail: { run: 12 } }, pass: { trail: { run: 12 } }, upper: { trail: { run: 12 } } },
  [{ from: 'square', to: 'meadow', gate: 'north' }, { from: 'square', to: 'pass', gate: 'east' }, { from: 'pass', to: 'upper' }]);

describe('the map\'s page', () => {
  it('places each section on the level: turned to its heading, its ground lifted to meet its junction', async () => {
    const P = await assembleMapScene({ level: W }, {}, { buildStage: stage(5) });
    const L = mapLevel(readLevel(W));
    // (one page: the junction's disc and every trail's ground)
    expect(P.map.order).toEqual(['square', 'meadow', 'pass', 'upper']);
    expect(P.faces.some((f) => f.group === 'map:junction')).toBe(true);
    // every trail's ground lifted to the junction's height (0): the sheet at 5 in its frame stands at 0 on the map
    const sheets = P.faces.filter((f) => f.group === 'isekai:ground');
    expect(sheets).toHaveLength(3);
    for (const f of sheets) for (const c of f.corners) expect(c[2]).toBeCloseTo(0, 5);
    // the east arm turned a quarter: its trailhead's facing (+y in its frame) is +x on the map
    const head = P.anchors.find((a) => a.node === 'pass' && a.id === 'trailhead');
    expect(head.N[0]).toBeCloseTo(1, 5); expect(head.N[1]).toBeCloseTo(0, 5);
    // and its path's first point on its gate (east of the square, on its edge)
    expect(Math.hypot(L.gates.pass[0] - 26, L.gates.pass[1])).toBeLessThan(0.05);
    // a trail after a trail keeps its parent's lift and heading: the upper's sheet starts where the pass's ends
    const pass = sheets[1].corners, upper = sheets[2].corners;
    expect(Math.hypot(upper[0][0] - pass[3][0], upper[0][1] - pass[3][1])).toBeLessThan(10);
  });

  it('lays a wall on a turned frame as a run of short boxes, each the box round its stretch', async () => {
    const P = await assembleMapScene({ level: W }, {}, { buildStage: stage(0) });
    // the south-west arm (225°) is turned off the axes: its 80 m wall is many boxes, none of them a giant diagonal one
    const sw = level({ square: hub(26, { southwest: 225, north: 0 }), arm: { trail: { run: 12 } } }, [{ from: 'square', to: 'arm', gate: 'southwest' }]);
    const Q = await assembleMapScene({ level: sw }, {}, { buildStage: stage(0) });
    const walls = Q.colliders.filter((c) => /^bound:-x/.test(c.of));
    expect(walls.length).toBeGreaterThan(20);
    for (const c of walls) expect(Math.hypot(c.max[0] - c.min[0], c.max[1] - c.min[1])).toBeLessThan(4);
    // on a frame square to the axes (north, east, and the one after east), one box stays one box
    expect(P.colliders.filter((c) => c.of === 'bound:-x')).toHaveLength(3);
  });

  it('the page is the root\'s: its sky, and the walk from the junction\'s centre', async () => {
    const P = await assembleMapScene({ level: W }, {}, { buildStage: stage(0) });
    expect(P.sky).toEqual({ zenith: [1, 2, 3] });
    expect(P.walk.spawn[0]).toBeCloseTo(0, 5); expect(P.walk.spawn[1]).toBeCloseTo(0, 5);
  });

  it('fills the land between the bands, meeting each band\'s edge at its height and lying under it, never over', async () => {
    const P = await assembleMapScene({ level: W }, {}, { buildStage: stage(0) });
    const land = P.faces.filter((f) => f.group === 'map:land');
    expect(land.length).toBeGreaterThan(100);
    // (between the north and the east arms, where neither band reaches, there is land)
    const at = (x, y) => land.some((f) => { const xs = f.corners.map((c) => c[0]), ys = f.corners.map((c) => c[1]); return x >= Math.min(...xs) && x <= Math.max(...xs) && y >= Math.min(...ys) && y <= Math.max(...ys); });
    expect(at(70, 70)).toBe(true);
    // nowhere inside the junction's disc does land stand above the paving (0)
    for (const f of land) for (const c of f.corners) if (Math.hypot(c[0], c[1]) < 26) expect(c[2]).toBeLessThanOrEqual(0);
    // and round the disc it meets the paving's height (within a hand's breadth)
    const rim = land.flatMap((f) => f.corners).filter((c) => Math.abs(Math.hypot(c[0], c[1]) - 30) < 2);
    expect(rim.length).toBeGreaterThan(0);
    for (const c of rim) expect(Math.abs(c[2])).toBeLessThan(0.3);
  });
});

