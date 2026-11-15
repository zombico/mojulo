/**
 * THE ARENA MAP'S TEMPLATES — a few starting shapes, each one idea of how a fighting map circulates, written in the
 * blocks (blocks.js). A template is a start, never a finished map: the generator (generate.js) changes it a block at a
 * time under the laws (laws.js), so two seeds of one template are two maps. A new template is a row and its builder.
 *
 *   TEMPLATES         { <id>: { about, plan, build() → map } }
 *   seal(M)           a map with a wall on every outer edge a floor meets (the ground's a wall; an upper floor's as it has, else a wall)
 *   blank(nx, ny, nz) an open box: the ground floored, walled round
 *
 * Pure, no dice.
 */
const rect = (i0, j0, i1, j1, k) => { const out = []; for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push([i, j, k]); return out; };

/** A wall on every outer edge a floor cell meets. */
export function seal(M) {
  const has = new Set(M.walls.map((w) => `${w.at},${w.side}`)), add = (at, side) => { const id = `${at},${side}`; if (!has.has(id)) { has.add(id); M.walls.push({ at, side, kind: 'full' }); } };
  for (const [i, j, k] of M.floors) {
    if (i === 0) add([-1, j, k], 'e');
    if (i === M.nx - 1) add([i, j, k], 'e');
    if (j === 0) add([i, -1, k], 'n');
    if (j === M.ny - 1) add([i, j, k], 'n');
  }
  return M;
}
export function blank(nx, ny, nz) { return seal({ nx, ny, nz, floors: rect(0, 0, nx - 1, ny - 1, 0), solids: [], walls: [], ramps: [], ladders: [] }); }
const wallsAlong = (M, i, j0, j1, k, gaps = []) => { for (let j = j0; j <= j1; j++) if (!gaps.includes(j)) M.walls.push({ at: [i, j, k], side: 'e', kind: 'full' }); };

export const TEMPLATES = Object.freeze({
  courtyard: Object.freeze({
    about: 'a court under a gallery: the gallery rings the court a level up and looks down into it',
    plan: 'one ring on the ground under the gallery, one ring on it, the court the heart both see; a ramp at two sides, a ladder at the other two',
    build() {
      // (a side no longer than the mid band reaches: a gallery one cell wide cannot have its line broken without
      // cutting its ring, so its sides are short enough to need none)
      const M = blank(8, 8, 2);
      M.floors.push(...rect(0, 0, 7, 7, 1).filter(([i, j]) => i === 0 || j === 0 || i === 7 || j === 7));
      M.solids.push([2, 5, 0], [5, 2, 0]);
      M.ramps.push({ at: [2, 3, 0], dir: [-1, 0], run: 2 }, { at: [5, 4, 0], dir: [1, 0], run: 2 });
      M.ladders.push({ at: [3, 1, 0], dir: [0, -1] }, { at: [4, 6, 0], dir: [0, 1] });
      return seal(M);
    },
  }),
  'figure-eight': Object.freeze({
    about: 'two rings sharing a middle: a mass in each ring, a floor on each mass, a bridge between them over the middle',
    plan: 'the middle is crossed on every lap and overlooked from both floors and the bridge',
    build() {
      const M = blank(15, 8, 2);
      M.solids.push(...rect(3, 2, 5, 5, 0), ...rect(9, 2, 11, 5, 0));
      M.floors.push(...rect(3, 2, 5, 5, 1), ...rect(9, 2, 11, 5, 1), ...rect(6, 5, 8, 5, 1));
      M.ramps.push({ at: [1, 3, 0], dir: [1, 0], run: 2 }, { at: [13, 4, 0], dir: [-1, 0], run: 2 });
      M.ladders.push({ at: [6, 4, 0], dir: [-1, 0] }, { at: [8, 3, 0], dir: [1, 0] });
      return seal(M);
    },
  }),
  'three-rooms': Object.freeze({
    about: 'three rooms in a row, two doors between each pair, a balcony in each end room and a bridge through the middle one',
    plan: 'the end rooms are close quarters, the middle one the long line; the bridge crosses it in the open',
    build() {
      // (the rooms walled apart on both levels; the bridge two cells wide, so panels can stagger along it)
      const M = blank(12, 8, 2);
      wallsAlong(M, 3, 0, 7, 0, [1, 6]); wallsAlong(M, 7, 0, 7, 0, [1, 6]);
      wallsAlong(M, 3, 0, 7, 1, [3, 4]); wallsAlong(M, 7, 0, 7, 1, [3, 4]);
      M.floors.push(...rect(0, 0, 0, 7, 1), ...rect(11, 0, 11, 7, 1), ...rect(1, 3, 10, 4, 1));
      M.ramps.push({ at: [2, 1, 0], dir: [-1, 0], run: 2 }, { at: [9, 6, 0], dir: [1, 0], run: 2 });
      M.ladders.push({ at: [1, 6, 0], dir: [-1, 0] }, { at: [10, 1, 0], dir: [1, 0] }, { at: [5, 2, 0], dir: [0, 1] });
      return seal(M);
    },
  }),
  stack: Object.freeze({
    about: 'a tower round a well: a gallery on each level, the well open from the ground to the top',
    plan: 'a small floor, three levels of it; every level sees the well, and the fight is up and down',
    build() {
      const M = blank(7, 7, 3), well = (i, j) => i >= 2 && i <= 4 && j >= 2 && j <= 4;
      M.floors.push(...rect(0, 0, 6, 6, 1).filter(([i, j]) => !well(i, j)), ...rect(0, 0, 6, 6, 2).filter(([i, j]) => i <= 1 || j >= 5));
      M.ramps.push({ at: [3, 3, 0], dir: [-1, 0], run: 2 });
      M.ladders.push({ at: [4, 2, 0], dir: [0, -1] }, { at: [2, 1, 1], dir: [-1, 0] }, { at: [5, 4, 1], dir: [0, 1] });
      return seal(M);
    },
  }),
});
export const TEMPLATE_IDS = Object.freeze(Object.keys(TEMPLATES));
