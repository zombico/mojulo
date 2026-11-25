import { describe, it, expect } from 'vitest';
import { WORKS_CARDS, readWorks, worksFaces } from './works.js';
import { readLocalMeru } from './plan.js';

// THE WORKS (works.js): an industrial interior over the land. One case per concept: the words read and refuse; its faces
// take the land's classes (steel, concrete) or glow; its scaffolds' floors are plates a frame stands on and never sees;
// its lamps hang under its trusses; what stops a body is its walls and machines; the same words, the same works.
const id = Object.keys(WORKS_CARDS)[0];

describe('the works', () => {
  it('reads a card or its words, and refuses what it does not know', () => {
    expect(readWorks(id).id).toBe(id);
    expect(readWorks({ from: id, crane: null }).crane).toBeNull();
    expect(() => readWorks('mill')).toThrow(/not a card/);
    expect(() => readWorks({ roof: 1 })).toThrow(/not a word/);
    expect(() => readWorks({ scaffolds: [{ at: [0, 0], bays: [2, 2], lifts: [20, 10] }] })).toThrow(/rising/);
    expect(() => readLocalMeru({ works: id })).toThrow(/stand on an island/);
  });

  it('builds its faces in the land\'s classes, its scaffolds\' floors unseen plates, the same for the same words', () => {
    const W = readWorks({ from: id, scaffolds: [{ at: [0, 0], bays: [2, 2], lifts: [10, 20] }] }), R = worksFaces(W, [0, 0]), S = worksFaces(structuredClone(W), [0, 0]);
    // (the land's classes, what glows and the unseen plates; and what its wagons carry, in fills of their own)
    const G = new Set(R.faces.map((f) => f.group));
    for (const g of ['isekai:cliff', 'isekai:rock', 'isekai:soil', 'works:glow', 'works:floor']) expect(G.has(g)).toBe(true);
    for (const g of G) expect(['isekai:cliff', 'isekai:rock', 'isekai:soil', 'works:glow', 'works:floor', 'works:ore', 'works:coke']).toContain(g);
    expect(R.faces.filter((f) => f.group === 'works:floor').length).toBe(2);   // (one plate a lift)
    expect(JSON.stringify(S.faces)).toBe(JSON.stringify(R.faces));
    // (each lift a deck a frame stands on, at its height)
    expect(R.decks.some((d) => d[5] === 10) && R.decks.some((d) => d[5] === 20)).toBe(true);
  });

  it('hangs its lamps under its trusses and glows at its furnaces; its walls and machines stop a body', () => {
    const W = readWorks(id), R = worksFaces(W, [0, 0]);
    expect(R.lamps.length).toBeGreaterThan(0);
    for (const q of R.lamps) expect(q.at[2]).toBeLessThan(W.hall.height - W.trusses.depth);
    // (a glow at each furnace's mouth and over each ladle, and more along the runners between)
    expect(R.glows.length).toBeGreaterThanOrEqual(W.furnaces.length + W.ladles.length);
    // (the hall's four walls, a column under each truss's end on each line, a furnace, a deck's slab among what stops)
    const has = (x, y, z) => R.colliders.some((c) => x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && z >= c.min[2] && z <= c.max[2]);
    expect(has(W.hall.half[0] + 2, 0, 5)).toBe(true);
    const F = W.furnaces[0];
    expect(has(F.at[0], F.at[1], 5)).toBe(true);
    const D = W.decks[0];
    expect(has(D.at[0], D.at[1], D.height - 1)).toBe(true);
    expect(has(D.at[0], D.at[1], 5)).toBe(false);   // (walked under)
  });

  it('stacks a superstructure: a process frame\'s levels decks over its stopping columns, a column ringed, walkways between', () => {
    const W = readWorks({ frames: [{ at: [0, 0], bays: [2, 2], levels: [12, 24], ramp: 's' }], vessels: [{ at: [80, 0], radius: 6, height: 60, rings: [24] }],
      spheres: [{ at: [-80, 0], radius: 10 }], racks: [{ path: [[0, 60], [100, 60]], tiers: [10] }], bridges: [{ from: [12, 0], to: [74, 0], z: [24, 24] }] });
    const R = worksFaces(W, [0, 0]);
    const has = (x, y, z) => R.colliders.some((c) => x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && z >= c.min[2] && z <= c.max[2]);
    // (each level a deck at its height, the bridge one at its; walked under, a bay's middle open, its corner column stopping)
    for (const z of [12, 24]) expect(R.decks.some((d) => d[5] === z && d[0] === -12)).toBe(true);
    expect(R.decks.some((d) => d[0] <= 40 && d[3] >= 40 && d[5] === 24)).toBe(true);
    expect(has(6, 6, 5)).toBe(false);
    expect(has(-12, -12, 5)).toBe(true);
    // (the column and the sphere stop a body)
    expect(has(80, 0, 30)).toBe(true);
    expect(has(-80, 0, 10)).toBe(true);
    // (the rack: its posts and its tier stop a body, walked under below the tier, its top a deck walked along)
    expect(has(0, 65, 5)).toBe(true);
    expect(has(6, 60, 5)).toBe(false);
    expect(has(6, 60, 11)).toBe(true);
    expect(R.decks.some((d) => d[0] <= 50 && d[3] >= 50 && d[1] <= 60 && d[4] >= 60 && d[5] === 13)).toBe(true);
    // (a lamp under each level's corners and a ring's)
    expect(R.lamps.filter((q) => q.at[2] < 24).length).toBeGreaterThanOrEqual(2);
    expect(() => readWorks({ frames: [{ at: [0, 0], bays: [2, 2], levels: [24, 12] }] })).toThrow(/rising/);
    expect(() => readWorks({ bridges: [{ from: [0, 0], to: [1, 1] }] })).toThrow(/bridges\[0\]\.z/);
  });

  it('lays rails with trains of what is to be smelted, and runners of molten metal from the tap to the pour', () => {
    const W = readWorks({ rails: [{ path: [[-100, 0], [100, 0]], trains: [{ at: 10, cars: 2, load: 'mixed' }] }],
      runners: [{ path: [[0, 40], [0, 80], [20, 80]], z: [16, 16, 12], pour: 3 }], ladles: [{ at: [25, 80], radius: 8, height: 9 }] });
    const R = worksFaces(W, [0, 0]), groups = new Set(R.faces.map((f) => f.group));
    const has = (x, y, z) => R.colliders.some((c) => x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && z >= c.min[2] && z <= c.max[2]);
    // (two wagons a load each, 'mixed' taking the loads in turn; each stops a body, the track between them none)
    expect(groups.has('works:ore') && groups.has('works:coke')).toBe(true);
    expect(has(-100 + 10 + 7, 0, 3)).toBe(true);
    expect(has(-100 + 10 + 16 + 7, 0, 3)).toBe(true);
    expect(has(60, 0, 1)).toBe(false);
    // (the runner's metal level on the level stretch and down its spout, a stream falling at its end; the ladle a pool)
    const [run, fall, pool] = [R.melt.find((m) => !m.fall && !m.pool), R.melt.find((m) => m.fall), R.melt.find((m) => m.pool)];
    expect(run.pts[0][2]).toBeCloseTo(16.55, 2);
    expect(run.pts[run.pts.length - 1][2]).toBeCloseTo(12.55, 2);
    expect(fall.pts[0][2] - fall.pts[1][2]).toBeCloseTo(3, 5);
    expect(pool.pts[0].slice(0, 2)).toEqual([25, 80]);
    // (its trestles stop a body; under its trough a frame walks)
    expect(has(0, 80, 5) || has(1.8, 80, 5) || has(-1.8, 80, 5)).toBe(false);
    expect(R.colliders.some((c) => c.max[2] > 14 && c.max[0] - c.min[0] < 2)).toBe(true);
    expect(() => readWorks({ rails: [{ path: [[0, 0], [10, 10]] }] })).toThrow(/along the axes/);
    expect(() => readWorks({ rails: [{ path: [[0, 0], [10, 0]], trains: [{ at: 0, cars: 1, load: 'gold' }] }] })).toThrow(/load/);
    expect(() => readWorks({ runners: [{ path: [[0, 0], [10, 0], [10, 10]], z: [1, 2, 3, 4] }] })).toThrow(/z/);
  });
});
