/**
 * THE MTS — the warlord's smaller frames: built from the same parts on the same rule as a frame, drawn smaller (`scale`),
 * with less armour (`ap`, a share of their build's) and a shorter stability bar (it scales with them). They come in
 * packs; they teach fighting frames before the frame. A new MT is a row.
 *
 *   MTS                  the shelf: { name, build, scale, ap, palette, mind }
 *   readMt(id, at?)      → the row (throws naming the fault)
 *
 * Pure data and a reader: gameworld/frame-goal.js stands an MT group (a frame group's `mt`) with assault-frame/pilot.js
 * frameEntity at its scale.
 */
import { readBuild } from './assemble.js';

const f = Object.freeze;
export const MTS = f({
  // a light skirmisher: a carbine and a shotgun on light legs, quick boosts, in threes; it closes and circles
  jackal: f({
    name: 'Jackal', palette: 'ash', scale: 0.6, ap: 0.32,
    build: f({ from: 'raptor', head: 'hd-lancet', core: 'cr-raptor', arms: 'ar-light', legs: 'lg-light', booster: 'bs-falcon', generator: 'gn-quick', fcs: 'fc-close', armR: 'rf-carbine', armL: 'sg-scatter', backR: null, backL: null }),
    mind: f({ range: 90, aggression: 0.8, dodge: 0.6 }),
  }),
  // a heavy: a gatling and a mortar on heavy legs; it hangs back and lobs, and its mortar braces it, the window
  rhino: f({
    name: 'Rhino', palette: 'ash', scale: 0.72, ap: 0.5,
    build: f({ from: 'citadel', head: 'hd-bulwark', core: 'cr-citadel', arms: 'ar-heavy', legs: 'lg-heavy', booster: 'bs-ox', generator: 'gn-deep', fcs: 'fc-long', armR: 'gt-gatling', armL: null, backR: 'gc-mortar', backL: null }),
    mind: f({ range: 170, aggression: 0.4, dodge: 0.3 }),
  }),
});

export function readMt(id, at = 'mt') {
  const M = MTS[id];
  if (!M) throw new Error(`${at} is an MT: ${Object.keys(MTS).join(', ')}`);
  readBuild(M.build, `${at}.build`);
  return M;
}
