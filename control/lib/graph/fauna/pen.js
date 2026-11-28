/**
 * THE ANIMALS IN A PEN (a zoo's, era/zoo.js): the land's animals walking loops inside a pen's fence, as the sea's swim
 * in a tank (marine/tank.js): each kind's loop an ellipse inside the pen's half sizes on its ground, a few of a kind
 * from their own starts; a body too long for the pen walks a tighter loop. Drawn by the walkers channel
 * (worlds/marine-fauna.js lowerMarineFauna, its figures the fauna roster's: animalFigure).
 *
 *   penFauna(walks, { lengthOf, seed? }) → { walkers, figures, readout }
 *     walks      [{ at: [x, y], half: [hx, hy], z, life: [species…], seed }]
 *     lengthOf   a species' body length (m): fauna/size-class.js sizeClassOf(sp).extent
 *     gaitOf     the gait it goes round by (one it has: a kangaroo hops, a penguin waddles; fauna/rig.js motionGaits)
 *
 * Pure: seeded by each pen's own number.
 */
export const PEN_WALK = Object.freeze({ group: Object.freeze([1, 3]), points: 18, margin: 0.4, pace: 0.45, most: 3 });
const TAU = Math.PI * 2, r3 = (v) => Math.round(v * 1000) / 1000;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/** The animals in each pen (see the header). */
export function penFauna(walks, { lengthOf, gaitOf = () => 'walk', seed = 1 } = {}) {
  const walkers = [], figures = {}, kinds = {};
  (walks ?? []).forEach((T, ti) => {
    const S = (T.seed ?? ti + 1) * 6151 + seed, share = Math.max(1, T.life.length);
    T.life.forEach((sp, si) => {
      const d = (a) => hash(S + si * 97, a), fig = `zoo:${sp}`, len = Math.max(0.1, lengthOf(sp));
      figures[fig] = { species: sp, roster: 'fauna', gait: gaitOf(sp) };
      // (a big body alone; a small one a few; the more kinds a pen holds, the fewer of each)
      const n = len > 3 ? 1 : Math.max(1, Math.min(PEN_WALK.most, Math.round(PEN_WALK.group[0] + (PEN_WALK.group[1] - PEN_WALK.group[0]) * d(1)) - (share > 2 ? 1 : 0)));
      // (its loop: an ellipse inside the fence, a kind a ring of its own, nearer or farther from the pen's middle)
      const ring = 0.45 + 0.45 * ((si + 0.5) / share);
      const rx = Math.max(0.3, (T.half[0] - PEN_WALK.margin - len / 2) * ring), ry = Math.max(0.3, (T.half[1] - PEN_WALK.margin - len / 2) * ring), turn = d(2) < 0.5 ? 1 : -1, ph = TAU * d(3);
      const loop = (k) => Array.from({ length: PEN_WALK.points + 1 }, (_, i) => {
        const a = turn * TAU * (((i + k) % PEN_WALK.points) / PEN_WALK.points) + ph;
        return [r3(T.at[0] + Math.cos(a) * rx), r3(T.at[1] + Math.sin(a) * ry), r3(T.z)];
      });
      const speed = r3(Math.max(0.15, Math.min(len * PEN_WALK.pace, (rx + ry) * 0.2)));
      for (let j = 0; j < n; j++) {
        walkers.push({ figure: fig, path: loop(Math.floor((j * PEN_WALK.points) / n)), speed, stride: r3(Math.max(0.2, len * 0.6)), blend: true });
        kinds[sp] = (kinds[sp] || 0) + 1;
      }
    });
  });
  return { walkers, figures, readout: { bodies: walkers.length, kinds } };
}
