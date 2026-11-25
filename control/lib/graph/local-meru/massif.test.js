import { describe, it, expect } from 'vitest';
import { MASSIF_CARDS, readMassif, massifField, massifLaws } from './massif.js';
import { readLocalMeru } from './plan.js';

// THE MASSIF (massif.js): a field's standing rock as words. One case per concept, on the smallest massif that has it: one
// block, one cut, one pool. The words read and refuse; a wall stands sheer and steps at the column's beds; a cut is
// floored and walled by the same beds; a pool and a river are carved under the floor's datum; the field is the same for
// the same words; the laws read the land it made; absent, the meru is as it was.
const one = (more = {}) => readMassif({ from: 'wadi', blocks: [{ at: [0, 0], size: [160, 120], dir: 0, height: 90 }], cuts: [], pools: [], clefts: { per: 0, width: [12, 20], reach: 0.5 }, warp: { strength: 0, scale: 50 }, flute: { depth: 0, scale: 10 }, ...more });

describe('the massif', () => {
  it('reads a card or its words, and refuses what it does not know, teaching', () => {
    const id = Object.keys(MASSIF_CARDS)[0];
    expect(readMassif(id).id).toBe(id);
    expect(readMassif({ from: id, slope: 0 }).id).toBe(`${id}*`);
    expect(readMassif(undefined)).toBeNull();
    expect(() => readMassif('swamp')).toThrow(/not a card/);
    expect(() => readMassif({ walls: 3 })).toThrow(/not a word/);
    expect(() => readMassif({ beds: [{ top: 20, bench: 2 }, { top: 10, bench: 2 }] })).toThrow(/bottom up/);
    expect(() => readMassif({ cuts: [{ path: [[0, 0]], width: 10 }] })).toThrow(/2 or more/);
  });

  it('stands its walls sheer and steps them at the column\'s beds, the same for the same words', () => {
    const M = one(), F = massifField(M, [0, 0], 3), G = massifField(structuredClone(M), [0, 0], 3);
    // (inside, the block's height and its cap; outside past its talus, none)
    expect(F.rock(0, 0)).toBeGreaterThanOrEqual(90);
    expect(F.rock(300, 0)).toBe(0);
    // (across a riser: a bed's height climbed within a few metres)
    let steepest = 0;
    for (let x = 100; x < 170; x += 1) steepest = Math.max(steepest, F.rock(x, 0) - F.rock(x + 4, 0));
    expect(steepest).toBeGreaterThan(20);
    for (const [x, y] of [[0, 0], [159, 3], [170, -10]]) expect(G.rock(x, y)).toBe(F.rock(x, y));
  });

  it('floors and walls a cut with the same beds, and carves water under the floor\'s datum', () => {
    const M = one({ cuts: [{ path: [[-300, 0], [300, 0]], width: 80, river: { width: 10, depth: 5 } }], pools: [{ at: [250, 250], radius: 30, depth: 4 }] });
    const F = massifField(M, [0, 0], 3, 10);
    expect(F.rock(0, 0)).toBeLessThan(2);   // (the cut's floor through the block)
    expect(F.rock(0, 90)).toBeGreaterThan(40);   // (and the block beside it)
    expect(F.water(0, 0)).toBe(true);
    expect(F.at(0, 0, 12)).toBeLessThan(10 - 4);   // (the river's bed under the datum whatever the floor's roll)
    expect(F.at(250, 250, 11)).toBeLessThan(10 - 3);
    expect(F.water(-250, 250)).toBe(false);
  });

  it('strews its fallen blocks on the talus, off the water', () => {
    const M = one({ strew: { count: 12, size: [2, 3] } }), F = massifField(M, [0, 0], 5);
    expect(F.boulders.length).toBeGreaterThan(0);
    for (const b of F.boulders) { expect(F.water(b.x, b.y)).toBe(false); expect(F.rock(b.x, b.y)).toBeLessThan(90 * M.talus.share * 2); }
  });

  it('reads its laws off the land a card made: walls stand, the floor is open', () => {
    const F = massifField(readMassif(Object.keys(MASSIF_CARDS)[0]), [0, 0], 3), L = massifLaws((x, y) => F.at(x, y, 0), [-400, -400, 400, 400]);
    expect(L.map((l) => l.law)).toEqual(['walls-stand', 'talus-repose', 'floor-open']);
    expect(L.find((l) => l.law === 'walls-stand').ok).toBe(true);
    expect(L.find((l) => l.law === 'floor-open').ok).toBe(true);
  });

  it('pushes a wall\'s corners in and out by its thin beds, never the floor\'s, the same place the same push', () => {
    const M = one(), F = massifField(M, [0, 0], 3), G = massifField(structuredClone(M), [0, 0], 3);
    // (the floor far off and the cap's middle are no wall)
    expect(F.warp(300, 0, 0)).toEqual([0, 0]);
    expect(F.warp(0, 0, 95)).toEqual([0, 0]);
    // (up a wall, the push swings with the beds: some out, some in, never past the face's words)
    const P = M.face.bulge + M.face.undercut + M.face.grain, ds = [];
    for (let x = 130; x < 166; x += 2) for (let z = 2; z < 80; z += 3) { const [dx, dy] = F.warp(x, 0, z); ds.push(Math.hypot(dx, dy) * Math.sign(dx || 1)); expect(G.warp(x, 0, z)).toEqual([dx, dy]); }
    expect(Math.max(...ds)).toBeGreaterThan(0.3);
    expect(Math.min(...ds)).toBeLessThan(-0.3);
    for (const d of ds) expect(Math.abs(d)).toBeLessThanOrEqual(P + 1e-9);
    // (the thin beds' partings and middles, the heights a wall is cut at, in order and inside the span asked)
    const L = F.partings(10, 40);
    expect(L.length).toBeGreaterThan(2);
    expect([...L].sort((a, b) => a - b)).toEqual(L);
    for (const l of L) expect(l > 10 && l < 40).toBe(true);
    // (a face of 0s is a smooth wall)
    expect(massifField(one({ face: { beds: [5, 10], bulge: 0, undercut: 0, grain: 0 } }), [0, 0], 3).warp(150, 0, 20)).toEqual([0, 0]);
  });

  it('lays the ground in front of a frame: outcrops off the rock, dry washes, boulders in clusters on the open floor', () => {
    const M = one({ outcrops: { count: 6, height: [3, 5], size: [8, 14], within: 400 }, washes: { count: 1, width: [12, 12], depth: [1.2, 1.2] }, scatter: { clusters: 4, per: [3, 5], spread: 15, size: [2, 4] }, strew: { count: 0, size: [2, 3] } });
    const F = massifField(M, [0, 0], 7, 10);
    // (the outcrops: low rock off the card's own block, each standing its height)
    expect(F.outcrops.length).toBeGreaterThan(2);
    for (const o of F.outcrops) { expect(Math.hypot(...o.at)).toBeGreaterThan(Math.max(...M.blocks[0].size)); expect(F.rock(o.at[0], o.at[1])).toBeGreaterThanOrEqual(o.height - 1e-9); }
    // (a wash: its bed cut under the floor round it, never under the sea line: dry)
    let bed = null;
    for (let x = -400; x <= 400 && !bed; x += 4) for (let y = -400; y <= 400 && !bed; y += 4) if (F.wash(x, y) > 0.99 && F.rock(x, y) === 0) bed = [x, y];
    expect(bed).toBeTruthy();
    expect(F.at(bed[0], bed[1], 12)).toBeCloseTo(12 - 1.2, 1);
    expect(F.water(bed[0], bed[1])).toBe(false);
    // (the scatter's boulders on the open floor, off the rock and the water)
    expect(F.boulders.length).toBeGreaterThan(4);
    for (const b of F.boulders) { expect(F.rock(b.x, b.y)).toBeLessThanOrEqual(0.3); expect(F.water(b.x, b.y)).toBe(false); }
  });

  it('strikes its craters by the impacts\' law: every size, a bowl under a rim, the fresh ones deep and strewn, the old filled', () => {
    const M = one({ craters: { count: 30, diameter: [10, 120], slope: 1.1, fresh: 0.5, within: 500, at: [{ at: [300, 300], diameter: 80, fresh: 1 }, { at: [-300, -300], diameter: 80, fresh: 0 }] }, strew: { count: 0, size: [2, 3] } });
    const F = massifField(M, [0, 0], 4, 0), C = F.craters;
    expect(C.length).toBeGreaterThan(20);
    // (the law: most small, but a fair few large)
    const D = C.map((c) => c.diameter);
    expect(D.filter((d) => d < 25).length).toBeGreaterThan(D.filter((d) => d >= 25).length);
    expect(D.filter((d) => d >= 40).length).toBeGreaterThan(1);
    // (a fresh one: a deep bowl under a rim; an old one of the same size shallow and flat-floored)
    const at = (x, y) => F.at(x, y, 0);
    expect(at(300, 300)).toBeLessThan(-12);
    expect(at(300 + 40, 300)).toBeGreaterThan(1);
    expect(at(-300, -300)).toBeGreaterThan(at(300, 300) + 5);
    expect(at(-300, -300)).toBeCloseTo(at(-295, -300), 1);
    // (its thrown blocks round the fresh one on its rim and blanket, more than round the old, which threw none of its own)
    const near = (q) => F.boulders.filter((b) => { const d = Math.hypot(b.x - q[0], b.y - q[1]); return d > 38 && d < 90; }).length;
    expect(near([300, 300])).toBeGreaterThan(near([-300, -300]) + 3);
  });

  it('stands only on an island, and a meru that names none reads as it always did', () => {
    expect(() => readLocalMeru({ massif: 'wadi' })).toThrow(/stands on an island/);
    expect(readLocalMeru({ island: { walk: 'none' }, massif: 'wadi' }).massif.id).toBe('wadi');
    expect(readLocalMeru({ island: { walk: 'none' } })).not.toHaveProperty('massif');
  });
});
