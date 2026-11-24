/**
 * A MECHA BOSS'S FIGURES — a vehicle boss of the mecha shelf (boss/vehicles.js, a row with a `frame`) drawn as itself: its
 * frame rigged as the artillery range rigs it (frames.js frameBase: its walk, its fold into its tank form and its drive, and
 * its tails' reload where it has twin tails), and a carrier's drones as the craft shelf draws them.
 *
 *   bossFigures(id, { palette?, drone? }) → { [id]: figure, [`${id}-drone`]?: figure }   the figures a page carries
 *                                          under the names boss/stand.js gives them (vehicleEntity, carrierEntities)
 *   bossPlaces(id)                        → { walker: { body: [x, y, z] }, tank?: {...} } where the frame's bodies stand in
 *                                          each form, in the row's frame (x ahead, y left, z up): what its parts' boxes are
 *                                          read off (boss-figures.test.js holds them to it)
 *
 * The frame's assembly is the slow part (a few seconds), kept by its words (frames.js).
 */
import { frameBase } from './frames.js';
import { craftFigure } from '../../craft-shelf/craft-rig.js';
import { readVehicle } from '../../boss/vehicles.js';
import { MECHA_ARCHETYPES } from '../../mecha-shelf/index.js';
import { frameOf } from './frames.js';

export function bossFigures(id, { palette = null, drone = 'inspectionQuad' } = {}) {
  const V = readVehicle(id);
  if (!V.frame) throw new Error(`boss figures: the ${id} is no frame of the mecha shelf (it is drawn as its dress)`);
  const tails = !!MECHA_ARCHETYPES[frameOf(V.frame).archetype]?.tails;
  const F = frameBase({ frame: V.frame, ...(palette ? { palette } : {}) }, { reload: tails });
  return { [id]: F.figure, ...(V.carrier ? { [`${id}-drone`]: craftFigure(drone, { light: 'form' }) } : {}) };
}

const PLACES = ['pelvis', 'cage', 'pack', 'hipR', 'hipL', 'tailBaseR', 'tailBaseL', 'tailSeg1R', 'tailSeg1L', 'footR', 'footL', 'shankR', 'shankL', 'bayFR', 'bayFL', 'bayRR', 'bayRL'];
export function bossPlaces(id) {
  const V = readVehicle(id), F = frameBase({ frame: V.frame }, { places: PLACES });
  // (vehicle space, +y ahead and +x right, as the row's: x ahead, y left)
  const row = (q) => [q[1], -q[0], q[2]];
  return Object.fromEntries(Object.entries(F.places).map(([form, P]) => [form, Object.fromEntries(Object.entries(P).map(([k, q]) => [k, row(q)]))]));
}
