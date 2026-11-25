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
    expect(new Set(R.faces.map((f) => f.group))).toEqual(new Set(['isekai:cliff', 'isekai:rock', 'isekai:soil', 'works:glow', 'works:floor']));
    expect(R.faces.filter((f) => f.group === 'works:floor').length).toBe(2);   // (one plate a lift)
    expect(JSON.stringify(S.faces)).toBe(JSON.stringify(R.faces));
    // (each lift a deck a frame stands on, at its height)
    expect(R.decks.some((d) => d[5] === 10) && R.decks.some((d) => d[5] === 20)).toBe(true);
  });

  it('hangs its lamps under its trusses and glows at its furnaces; its walls and machines stop a body', () => {
    const W = readWorks(id), R = worksFaces(W, [0, 0]);
    expect(R.lamps.length).toBeGreaterThan(0);
    for (const q of R.lamps) expect(q.at[2]).toBeLessThan(W.hall.height - W.trusses.depth);
    expect(R.glows.length).toBe(W.furnaces.length + W.ladles.length);
    // (the hall's four walls, a column under each truss's end on each line, a furnace, a deck's slab among what stops)
    const has = (x, y, z) => R.colliders.some((c) => x >= c.min[0] && x <= c.max[0] && y >= c.min[1] && y <= c.max[1] && z >= c.min[2] && z <= c.max[2]);
    expect(has(W.hall.half[0] + 2, 0, 5)).toBe(true);
    const F = W.furnaces[0];
    expect(has(F.at[0], F.at[1], 5)).toBe(true);
    const D = W.decks[0];
    expect(has(D.at[0], D.at[1], D.height - 1)).toBe(true);
    expect(has(D.at[0], D.at[1], 5)).toBe(false);   // (walked under)
  });
});
