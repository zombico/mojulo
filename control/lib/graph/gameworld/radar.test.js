// THE RADAR AND THE MAP (radar.js). The concepts: the radar is the pilot's own frame (its middle the pilot, the top
// ahead, so it turns as the pilot turns), bounded by its range, a pinned thing kept on the rim; the map is the level's
// frame (north at the top, still), drawn from what stands in a body's way; a foe asleep is on neither.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { RADAR, radarMarks, planBox, planPoint, planSvg, sceneThings } from './radar.js';

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
