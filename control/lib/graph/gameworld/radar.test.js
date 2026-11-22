// THE RADAR AND THE MAP (radar.js). The concepts: the radar is the pilot's own frame (its middle the pilot, the top
// ahead, so it turns as the pilot turns), bounded by its range, a pinned thing kept on the rim; the map is the level's
// frame (north at the top, still), drawn from what stands in a body's way; a foe asleep is on neither.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RADAR, radarMarks, planBox, planPoint, planSvg, radarPlan, sceneThings, planFloors, floorPlanSvg } from './radar.js';

const at = (m) => [m.x, m.y];
describe('the radar', () => {
  const me = [10, 10];
  it('puts what is ahead at the top and what is to the right at the right, whichever way the pilot faces', () => {
    // facing +x (heading 0): a thing further along x is ahead; one at lower y is to the right
    const [ahead] = radarMarks(me, 0, [{ at: [20, 10], kind: 'foe' }], RADAR), [right] = radarMarks(me, 0, [{ at: [10, 0], kind: 'foe' }], RADAR);
    expect(ahead.x).toBeCloseTo(0.5, 3); expect(ahead.y).toBeLessThan(0.5);
    expect(right.x).toBeGreaterThan(0.5); expect(right.y).toBeCloseTo(0.5, 3);
    // turned to face +y: the same thing along x is now to the right
    const [turned] = radarMarks(me, Math.PI / 2, [{ at: [20, 10], kind: 'foe' }], RADAR);
    expect(turned.x).toBeGreaterThan(0.5); expect(turned.y).toBeCloseTo(0.5, 3);
    // (a distance is a share of the range: a third of it out is a sixth of the scope from its middle)
    expect(0.5 - ahead.y).toBeCloseTo((10 / RADAR.range) / 2, 3);
  });
  it('drops what is past its range, keeps a pinned thing on the rim toward where it is, and draws the nearest first up to its most', () => {
    expect(radarMarks(me, 0, [{ at: [10 + RADAR.range + 5, 10], kind: 'foe' }], RADAR)).toEqual([]);
    const [pin] = radarMarks(me, 0, [{ at: [10 + RADAR.range * 4, 10], kind: 'goal', pin: true }], RADAR);
    expect(pin.kind).toBe('goal');
    expect(Math.hypot(pin.x - 0.5, pin.y - 0.5)).toBeCloseTo(RADAR.rim, 2);
    expect(pin.y).toBeLessThan(0.5);
    const many = Array.from({ length: RADAR.most + 5 }, (_, k) => ({ at: [10 + 1 + k, 10], kind: 'foe' }));
    const M = radarMarks(me, 0, many, RADAR);
    expect(M).toHaveLength(RADAR.most);
    expect(M[0].y).toBeGreaterThan(M.at(-1).y);
  });
});

describe('the map', () => {
  const cols = [{ min: [0, 0, 0], max: [30, 0.4, 3] }, { min: [0, 0, 0], max: [0.4, 20, 3] }, { min: [10, 10, 0], max: [12, 12, 1.1] }, { min: [0, 0, 2.8], max: [30, 20, 3] }, { min: [20, 5, 0], max: [21, 6, 0.3] }];
  const box = planBox(cols, [[30, 0, 36, 6]]);
  it('is a square round everything, north at the top: a place further north is higher, further east further right', () => {
    expect(box[2]).toBeGreaterThanOrEqual(36);
    const a = planPoint(box, [5, 5]), n = planPoint(box, [5, 15]), e = planPoint(box, [25, 5]);
    expect(n.y).toBeLessThan(a.y); expect(n.x).toBe(a.x);
    expect(e.x).toBeGreaterThan(a.x); expect(e.y).toBe(a.y);
    expect(planPoint(box, [-999, 999])).toEqual({ x: 0, y: 0 });
    expect(planBox([], [])[2]).toBeGreaterThan(0);
  });
  it('draws what stands in a body\'s way on the ground (a mass, a low thing, water) and not a floor over it or a kerb', () => {
    const svg = planSvg(cols, [[30, 0, 36, 6]], box), rects = (fill) => (svg.match(new RegExp(`fill="${fill}"`, 'g')) || []).length;
    expect(rects('#d9d2bd')).toBe(2);   // the two walls
    expect(rects('#8f8a78')).toBe(1);   // the low wall; the slab at 2.8 m and the 0.3 m kerb are not in the way
    expect(rects('#3f6f8f')).toBe(1);
    expect(svg.startsWith('<svg') && svg.endsWith('</svg>')).toBe(true);
  });
});

describe('the map under the radar', () => {
  it('lays the plan with the pilot at the middle and ahead at the top, at the radar\'s scale', () => {
    const box = [0, 0, 80];
    expect(radarPlan(box, [20, 60], Math.PI / 2, 40)).toEqual({ x: 0.25, y: 0.25, size: 1, turn: 0 });   // (facing north: as drawn)
    expect(radarPlan(box, [20, 60], 0, 40).turn).toBe(-90);                                            // (facing east: east up)
    expect(radarPlan(box, [20, 60], Math.PI / 2, 20).size).toBe(2);                                     // (a closer radar, a bigger map)
  });
  it('draws a land\'s things by their own heights, and its tall grass, where asked; as it was where not', () => {
    const raised = [{ min: [0, 0, 5], max: [2, 2, 7] }], box = [0, 0, 10];
    expect(planSvg(raised, null, box)).not.toContain('<rect x="0"');                 // (a thing on a rise: over a head, as it was)
    expect(planSvg(raised, null, box, { rel: true })).toContain('fill="#d9d2bd"');     // (by its own height: a mass)
    expect(planSvg([], null, box, { veils: [{ at: [5, 5, 0], r: 2 }] })).toContain('<circle cx="256" cy="256" r="102.4"');
  });
  it('draws the land\'s contours a step apart, a major one brighter, and its trail in runs', () => {
    // (a ramp rising a metre a cell eastward over 0..6 m: lines at each whole metre run north to south)
    const relief = { x0: 0, y0: 0, cell: 1, nx: 7, ny: 3, z: Array.from({ length: 21 }, (_, q) => q % 7) };
    const svg = planSvg([], null, [0, 0, 10], { relief: { ...relief, z: relief.z.map((v) => v + 0.5) } });
    const minor = svg.match(/stroke="#4b5244"[^>]*/)[0], d = /d="([^"]*)"/.exec(svg)[1];
    expect(d.split('M').length - 1).toBeGreaterThan(8);
    expect(svg).toContain('stroke="#78806c"');                                       // (5 m: a major line)
    expect(minor).toBeTruthy();
    const trail = planSvg([], null, [0, 0, 10], { trail: { x0: 0, y0: 0, cell: 1, nx: 4, ny: 2, on: [0, 1, 1, 0, 0, 0, 1, 0] } });
    expect((trail.match(/fill="#8a7350"/g) || []).length).toBe(2);                  // (one run a row)
  });
});

describe('what a scene shows', () => {
  const body = { hittable: true }, me = { id: 'p', pilotable: true, transform: { pos: [0, 0, 0] } };
  const foe = (id, more = {}) => ({ id, team: 'foes', transform: { pos: [3, 0, 0] }, body: { ...body }, ...more });
  it('is the task in hand, pinned, and the pilot\'s foes awake and standing: none asleep, down or gone', () => {
    const W = { entities: [me, foe('a'), foe('b', { dormant: true }), foe('c', { downed: true }), foe('d', { gone: true }), foe('e', { body: { hittable: false } }), { id: 'cam', isCamera: true, team: 'foes', transform: { pos: [0, 0, 0] }, body }] };
    expect(sceneThings(W, me, [9, 9])).toEqual([{ at: [9, 9], kind: 'goal', pin: true }, { at: [3, 0, 0], kind: 'foe' }]);
    expect(sceneThings(W, me, null)).toEqual([{ at: [3, 0, 0], kind: 'foe' }]);
  });
});

describe('the module', () => {
  it('is the page\'s side: it imports nothing, and each function is whole on its own (inlined with toString())', () => {
    const src = readFileSync(fileURLToPath(new URL('./radar.js', import.meta.url)), 'utf8');
    expect([...src.matchAll(/^import /gm)]).toEqual([]);
    for (const f of [radarMarks, planBox, planPoint, planSvg, sceneThings]) expect(() => new Function(`return (${f.toString()})`)()).not.toThrow();
  });
});

describe('what a watcher sees, on the radar', () => {
  const cfg = { ...RADAR, range: 30 };
  const watcher = (boxes = [], extra = {}) => ({ at: [0, 10], kind: 'foe', sight: { heading: -Math.PI / 2, cone: 0.6, range: 14, eye: 1.35, pe: 1.275, feet: 0, state: 'calm', boxes, ...extra } });
  it('a watcher that shows its sight carries its fan: itself first, then its cone toward where it faces', () => {
    const [m] = radarMarks([0, 0], Math.PI / 2, [watcher()], cfg);
    expect(m.fan[0]).toEqual([m.x, m.y]);
    expect(m.state).toBe('calm');
    // (it stands ahead of the pilot and looks back at it: the fan comes down the scope toward the middle)
    for (const p of m.fan.slice(1)) expect(p[1]).toBeGreaterThan(m.y);
    expect(Math.max(...m.fan.map((p) => p[1]))).toBeCloseTo(m.y + 14 * (0.5 / 30), 2);
  });
  it('a ray ends at what would hide the pilot as it stands: a metre of cover ends it for a crouch, not for a body standing', () => {
    const wall = [{ min: [-6, 5, 0], max: [6, 5.4, 1] }];
    const reach = (pe) => { const [m] = radarMarks([0, 0], Math.PI / 2, [watcher(wall, { pe })], cfg); return Math.max(...m.fan.map((p) => p[1])) - m.y; };
    expect(reach(1.275)).toBeCloseTo(14 * (0.5 / 30), 2);
    expect(reach(0.825)).toBeLessThan(6 * (0.5 / 30));
  });
  it('a foe that shows no sight is a mark and nothing more', () => {
    const [m] = radarMarks([0, 0], 0, [{ at: [5, 0], kind: 'foe' }], cfg);
    expect(m.fan).toBeUndefined();
  });
});

describe('one floor\'s plan', () => {
  // (two decks: a slab at 4 and one at 12 over half of it; a column on each; a container on the upper)
  const C = [
    { min: [0, 0, 3.7], max: [20, 20, 4] }, { min: [0, 0, 11.7], max: [10, 20, 12] },
    { min: [5, 5, 4], max: [6, 6, 11.7] }, { min: [15, 15, 4], max: [16, 16, 6] },
    { min: [2, 2, 12], max: [8, 4, 14.6] },
  ];
  it('a level\'s floors are its slabs\' tops, lowest first; a column or a container is no floor', () => {
    expect(planFloors(C)).toEqual([4, 12]);
  });
  it('each floor draws its own slabs as ground and what stands at it alone; the other floor\'s things are not on it', () => {
    const box = planBox(C, null), low = floorPlanSvg(planSvg, C, box, 4), high = floorPlanSvg(planSvg, C, box, 12);
    const rects = (svg) => (svg.match(/<rect /g) || []).length;
    // (each the plan's ground, then low: its slab and the two columns standing on it; high: its slab and its container)
    expect(rects(low)).toBe(1 + 1 + 2);
    expect(rects(high)).toBe(1 + 1 + 1);
    expect(low).not.toBe(high);
    expect(low).toContain('fill="#0e1214"');
  });
});
