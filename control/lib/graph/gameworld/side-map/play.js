/**
 * THE SIDE MAP, PLAYED — a laid map (layout.js) handed to the runtime (worlds/controllable/sidemap.js): the camera on its
 * zones, the ladders as climbables, the catch zone its falls are counted in. What a level made from a side map is
 * composed from; the level itself (its hero, its foes, its mechanics) is the game's.
 *
 *   sideMapPlay(layout, { stature, target? }) → {
 *     camera     { rule: 'side-map', target, screen, dist, tilt, lookH, stature, zones: [{ rect, lock, hold?, rise?,
 *                checkpoint }] }   each zone's rectangle, the axis its frame holds, held where a door shuts behind it
 *                (a chute's foot, a boss's room), rising at the layout's pace, its checkpoint
 *     ladders    [climbable entity]  a layout's ladder as the climb takes it: its normal toward the camera (the hero's
 *                back to it), stepped off at its lip onto the floor beyond, climbed at LADDER_RATE
 *     catch      { type: 'zone', zone: SIDE_FALL, … }  the zone in limbo a fall out of the frame is counted in (the lives
 *                mechanic's `falls: [SIDE_FALL]`)
 *     colliders  the layout's blocks, the level's solids, and its crates (each `of` its id: a block that breaks)
 *     spawn      [x, y, z] the first checkpoint's, on the lane
 *   }
 *   SIDE_FALL, LIMBO
 *
 * Pure. The lane is the layout's: along +y at x 0, the camera on the +x side.
 */
import { LADDER_RATE } from './layout.js';
import { CRATE } from './crates.js';

export const SIDE_FALL = 'side-fall';
export const LIMBO = -5000;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A laid map, as the runtime plays it. */
export function sideMapPlay(layout, { stature, target = 'hero' } = {}) {
  const L = layout, C = L.camera, held = new Set(L.doors.map((d) => d.zone));
  const zones = L.zones.map((Z) => {
    const R = L.rises.find((r) => r.zone === Z.i), cp = L.checkpoints.find((c) => c.zone === Z.i);
    return { rect: Z.rect, lock: Z.lock, ...(held.has(Z.i) ? { hold: true } : {}), ...(R ? { rise: R.pace } : {}), ...(cp ? { checkpoint: cp.at } : {}) };
  });
  const ladders = L.ladders.map((l, i) => {
    const base = [0, l.foot[0], l.foot[1]], length = r3(l.lip[1] - l.foot[1]);
    return {
      id: `side-ladder-${i}`,
      rule: { type: 'climbable', form: 'ladder', base, axis: [0, 0, 1], length, N: [1, 0, 0], Nh: [1, 0, 0], U: [0, 1, 0], half: 0, speed: LADDER_RATE, standoff: 0.35, pitch: 0.3, top: [0, r3(l.lip[0] + 0.7), l.lip[1]] },
      body: { type: 'none' },
      transform: { pos: base, heading: Math.PI },
    };
  });
  const cp0 = L.checkpoints[0]?.at ?? [1, 0];
  return {
    camera: { rule: 'side-map', target, screen: [L.screen.width, L.screen.height], dist: C.dist, tilt: C.tilt, lookH: C.lookH, ...(stature ? { stature } : {}), limbo: LIMBO, zones },
    ladders,
    catch: { type: 'zone', zone: SIDE_FALL, at: [0, 0, LIMBO], half: [1e6, 1e6, 200], watch: target },
    // (and its crates, each its own collider by its id: a world's breakability makes it a block that breaks, crates.js)
    colliders: [...L.blocks.map((b) => ({ min: b.min, max: b.max })), ...(L.crates ?? []).map((c) => ({ min: [-CRATE / 2, c.s0, c.z0], max: [CRATE / 2, c.s1, c.z1], of: c.id }))],
    spawn: [0, cp0[0], cp0[1] + 0.05],
  };
}
