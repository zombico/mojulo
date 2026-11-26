/**
 * THE FOE'S BLADE — a fair hit: a foe whose blow is an attack card's held swing (foes/attacks.js) lands it where its
 * weapon goes and nowhere else. Its swing is baked on its figure with the weapon in its hand (worlds/world-kinds.js); the
 * weapon's tip is read across the contact window (figures/clip-reach.js), and the blow's numbers the runtime adjudicates
 * a hit by (worlds/controllable/combat-melee.js: a target within `strikeReach` and its own width, inside `strikeCone`
 * of the aim) are taken from that path at the body's scale. A player reads the reach off the weapon: out of it, never
 * hit; in its arc, hit.
 *
 *   BLADE                    { margin, coneMin, coneMax }: the cone's degrees over the tip's own sweep, and its bounds
 *   bladeFit(figure, clip | [clip], scale?, { tip?, window? }?)  → { strikeReach, strikeCone, blade: { low, high } } or null where no clip
 *                              carries a weapon's tip; over several (a body's swing directions), what covers them all
 *
 * Pure.
 */
import { clipReach } from '../figures/clip-reach.js';

export const BLADE = Object.freeze({ margin: 8, coneMin: 14, coneMax: 80 });
const r3 = (v) => Math.round(v * 1000) / 1000;

export function bladeFit(figure, clip = 'swing_neutral', scale = 1, opts = {}) {
  // (several clips, a body's swing directions: the reach and the cone that cover every one, its height band too; `opts`
  // a tip and a window where the clip carries none, a beast's head and its blow's window)
  const Rs = [].concat(clip).map((c) => clipReach(figure, c, opts)).filter((x) => x && x.reach > 0);
  if (!Rs.length) return null;
  const R = { reach: Math.max(...Rs.map((x) => x.reach)), cone: Math.max(...Rs.map((x) => x.cone)), low: Math.min(...Rs.map((x) => x.low)), high: Math.max(...Rs.map((x) => x.high)) };
  const s = scale > 0 ? scale : 1;
  return {
    strikeReach: r3(R.reach * s),
    strikeCone: r3(Math.min(BLADE.coneMax, Math.max(BLADE.coneMin, R.cone + BLADE.margin))),
    blade: { low: r3(R.low * s), high: r3(R.high * s) },
  };
}
