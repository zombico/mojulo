/**
 * THE FISH IN A TANK (an aquarium's, era/aquarium.js): the sea's animals swimming on loops inside a tank's water, the
 * way placeMarineFauna swims them over a seabed but held to the glass: each loop an ellipse inside the tank's half
 * sizes, at a height between its sand and its surface, a kind's group a few on one loop from their own starts; a body
 * too long for the tank swims at the tank's own length along its longer side. Drawn by the walkers channel
 * (worlds/marine-fauna.js lowerMarineFauna), as the sea's are.
 *
 *   tankFauna(swims, { lengthOf, seed? }) → { walkers, figures, readout }   (placeMarineFauna's shape)
 *     swims      [{ at: [x, y], half: [hx, hy], z0, z1, life: [species…], seed }]
 *     lengthOf   a species' body length (m): worlds/marine-fauna.js marineLength
 *
 * Pure: seeded by each tank's own number.
 */
import { MARINE_FAUNA, MARINE_HABITS } from './fauna.js';

export const TANK_SWIM = Object.freeze({ most: 5, points: 16, margin: 0.15 });
const TAU = Math.PI * 2, r3 = (v) => Math.round(v * 1000) / 1000;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 2654435761) ^ Math.imul(b | 0, 1597334677)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return ((h ^ (h >>> 13)) >>> 0) / 4294967296; };

/** The fish in each tank (see the header). */
export function tankFauna(swims, { lengthOf, seed = 1 } = {}) {
  const walkers = [], figures = {}, kinds = {};
  (swims ?? []).forEach((T, ti) => {
    const S = (T.seed ?? ti + 1) * 7919 + seed;
    T.life.forEach((sp, si) => {
      const R = MARINE_FAUNA[sp];
      if (!R) return;
      const H = MARINE_HABITS[R.lives] ?? MARINE_HABITS.reef, d = (a) => hash(S + si * 101, a), fig = `sea:${sp}`;
      const len = Math.max(0.05, lengthOf(sp)), room = Math.max(0.3, Math.min(T.half[0], T.half[1]) - TANK_SWIM.margin - len / 2);
      figures[fig] = { species: sp, roster: R.roster, gait: R.gait };
      const n = Math.max(1, Math.min(TANK_SWIM.most, Math.round(R.group[0] + (R.group[1] - R.group[0]) * d(1))));
      // (its loop: an ellipse filling the tank's water, its long axis the tank's, at its height; a bed-dweller low)
      const rx = Math.max(0.2, (T.half[0] - TANK_SWIM.margin - len / 2) * (0.55 + 0.4 * d(2))), ry = Math.max(0.2, Math.min(room, (T.half[1] - TANK_SWIM.margin - len / 2) * (0.55 + 0.4 * d(3))));
      const low = R.lives === 'bed', span = Math.max(0, T.z1 - T.z0), zc = low ? T.z0 : T.z0 + span * (0.25 + 0.5 * d(4)), turn = d(5) < 0.5 ? 1 : -1, ph = TAU * d(6);
      const loop = (k, dz) => Array.from({ length: TANK_SWIM.points + 1 }, (_, i) => {
        const a = turn * TAU * (((i + k) % TANK_SWIM.points) / TANK_SWIM.points);
        return [r3(T.at[0] + Math.cos(a) * rx), r3(T.at[1] + Math.sin(a) * ry), r3(Math.min(T.z1, Math.max(T.z0, zc + dz + (low ? 0 : span * 0.08 * Math.sin(2 * a + ph)))))];
      });
      const speed = r3(Math.max(0.04, Math.min(len * H.pace, (rx + ry) * 0.25)));
      for (let j = 0; j < n; j++) {
        walkers.push({ figure: fig, path: loop(Math.floor((j * TANK_SWIM.points) / n), j ? (d(10 + j) - 0.5) * Math.min(0.5, span * 0.3) : 0), speed, stride: r3(Math.max(0.05, len * 0.9)), style: `sea:${R.lives}`, blend: true });
        kinds[sp] = (kinds[sp] || 0) + 1;
      }
    });
  });
  return { walkers, figures, readout: { bodies: walkers.length, kinds } };
}
