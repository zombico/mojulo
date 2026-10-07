/**
 * lift — vertical traversal: a deck that carries the player between STOPS (heights above where it stands).
 *
 * The deck is a platform's (the same area budget and skins). Two stops make a ride lift: step on and it goes, step off
 * and after `dwell` seconds it comes home. More stops make a called lift: a use at a stop (a button or lever there)
 * sends it to that stop. `speed` is metres a second.
 *
 * A lift answers for itself: its SHAFT (the column the deck runs in, from under the lowest stop to a rider's headroom
 * over the highest; a level leaves it open and cuts every floor it passes through), its LANDINGS (where you board at
 * each stop and step off to either side), the headroom that keeps a rider from being crushed at the top, and its
 * dwell. It lowers to a `mover` carrier on a vertical rail; the ride drive runs in the world today, a called lift runs
 * as a ride between its ends until calls reach the runtime.
 */
import { P, r5 } from '../../era/geom.js';
import { blockSink } from '../../era/props.js';
import { PLATFORM_SKINS } from './platform.js';
import { driveErrors } from './drive.js';

const HEADROOM = 1.8 + 0.3;

export function liftParams({ area = 4, aspect = 1, thick = 0.4, at = [0, 0, 0], stops = [0, 6], speed = 1.5, dwell = 2 } = {}) {
  if (!(area > 0)) throw new Error('lift: area must be square metres above 0 (the walkable deck top)');
  if (!Array.isArray(stops) || stops.length < 2) throw new Error('lift: stops must list at least two heights');
  const S = [...stops].sort((a, b) => a - b);
  if (S.some((z, i) => i && z - S[i - 1] < HEADROOM)) throw new Error(`lift: stops must stand at least ${HEADROOM} m apart (a rider's headroom), got ${S.join(', ')}`);
  const travel = S[S.length - 1] - S[0], ts = S.map((z) => r5((z - S[0]) / travel));
  const drive = S.length === 2 ? { type: 'ride', speed: r5(speed / travel), dwell } : { type: 'call', stops: ts, speed: r5(speed / travel), home: 0 };
  const e = driveErrors(drive, 'lift.drive');
  if (e.length) throw new Error(e.join('; '));
  return { area: r5(area), aspect: r5(aspect), w: r5(Math.sqrt(area * aspect)), d: r5(Math.sqrt(area / aspect)), thick, at: P(at), stops: S.map(r5), travel: r5(travel), speed, dwell, drive };
}

const deckZ = (p, t) => p.at[2] + p.stops[0] + p.travel * Math.min(1, Math.max(0, t));

export const LIFT = {
  id: 'lift',
  name: 'Lift',
  role: 'carries the player up and down between stops',
  interest: 'interactable',
  variants: { ride: { about: 'two stops: step on and it goes, step off and it comes home' }, call: { about: 'three stops or more: a use at a stop sends it there' } },
  skins: { greybox: PLATFORM_SKINS.greybox },
  when: 'a lift, an elevator, a vertical platform, go up a floor, ride up, a platform that rises',

  resolve({ skin = 'greybox', t = 0, params, ...spec } = {}) {
    if (!this.skins[skin]) throw new Error(`playscape: a lift has no skin '${skin}' (skins: ${Object.keys(this.skins).join(', ')})`);
    const p = params || liftParams(spec), at = Math.min(1, Math.max(0, t)), [x, y] = p.at, z = deckZ(p, at);
    const faces = blockSink();
    this.skins[skin](faces, p, P([x, y, z]), true);
    const hw = p.w / 2, hd = p.d / 2, top = p.at[2] + p.stops[p.stops.length - 1], bottom = p.at[2] + p.stops[0];
    return {
      entry: 'lift', variant: p.drive.type, skin, t: at, params: p, interest: this.interest,
      frame: { at: P([x, y, z]), N: [0, -1, 0], U: [1, 0, 0] },
      faces,
      deck: { top: P([x, y, z]), half: [r5(hw), r5(hd)] },
      collider: [{ min: P([x - hw, y - hd, z - p.thick]), max: P([x + hw, y + hd, z]), of: 'deck' }],
      shaft: { min: P([x - hw, y - hd, bottom - p.thick]), max: P([x + hw, y + hd, top + HEADROOM]) },
      headroom: r5(HEADROOM),
      landings: p.stops.map((s, i) => ({ stop: i, z: r5(p.at[2] + s), board: P([x, y, p.at[2] + s]), exits: [P([x, y - hd - 0.6, p.at[2] + s]), P([x, y + hd + 0.6, p.at[2] + s])], t: p.drive.type === 'call' ? p.drive.stops[i] : i })),
      ride: { seconds: r5(p.travel / p.speed), dwell: p.dwell },
      world: this.lower(p),
    };
  },

  /** A mover carrier on a vertical rail. A called lift runs as a ride between its ends until calls reach the runtime. */
  lower(p, id = 'lift') {
    const [x, y] = p.at, half = p.thick / 2, path = [P([x, y, p.at[2] + p.stops[0] - half]), P([x, y, p.at[2] + p.stops[p.stops.length - 1] - half])];
    return {
      faces: [], colliders: [],
      entities: [{
        id, rule: { type: 'mover', path, drive: 'ride', speed: r5(p.speed / p.travel), dwell: p.dwell },
        body: { type: 'mesh', shape: 'box', size: [p.w, p.d, p.thick], color: '#9aa0a8', marker: false, carrier: true, carryHalf: [r5(p.w / 2), r5(p.d / 2)], deck: r5(half) },
        transform: { pos: [...path[0]] },
      }],
      ...(p.drive.type === 'call' ? { note: 'calls to a middle stop are not in the world runtime yet: it runs as a ride between its ends' } : {}),
    };
  },
};
