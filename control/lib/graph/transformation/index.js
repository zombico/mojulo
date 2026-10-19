/**
 * transformation — a body in two forms: a robot that folds into a vehicle and back (more-than-meets).
 *
 *   bakeTransformer({ robot?, vehicle?, scheme?, height?, keys? }) → { figure, readout }
 *
 *   robot:   { frame: { tint?, joint?, eye? } }   (the default: an inner frame made to the vehicle's size)
 *          | { figure }                          (a baked biped rig: a suit's bakeUnitRig, a unitRef resolved upstream)
 *          | { manifest }                        (an assembler biped, inline)
 *   vehicle: { ride: 'car' | 'coupe' | 'van', seed? }   (gameworld/ride.js, the veh-* shelf)
 *          | { racer: { … } }                    (car-designer/roster.js racerOf)
 *          | { supercar: { preset?, … } }        (car-designer/supercar-figure.js)
 *          | { craft: '<archetype>', palette? }  (the craft shelf: a jet, a warbird, a starfighter)
 *          | { figure }                          (a baked vehicle rig: a vehicleRef resolved upstream)
 *          | absent                              (the robot's own alt form: the scheme says which)
 *   scheme:  a TRANSFORM_SCHEMES id (absent: by the vehicle, schemes.js schemeFor)
 *   height:  the robot's height in metres when the frame is made (absent: the vehicle's length × the scheme's ratio)
 *
 * The figure is a plain rig figure (`rig: true`) carrying `forms`: the World page plays it as any rig body, and an
 * entity with `forms` (controllable/forms.js) changes between them. Pure and deterministic.
 */

import { bakeUnitRig } from '../worlds/unit-rig.js';
import { innerFrameManifest } from './inner-frame.js';
import { composeTransformer, piecesOfFigure, normalizePieces } from './compose.js';
import { TRANSFORM_SCHEMES, SCHEME_IDS, schemeFor } from './schemes.js';

export { TRANSFORM_SCHEMES, SCHEME_IDS, schemeFor, composeTransformer, piecesOfFigure, innerFrameManifest };

const RIDE_H = 1.5;   // a ride's height in the world (gameworld/ride.js)

/** the vehicle source → its pieces (normalized, metres) */
export async function vehiclePieces(src) {
  if (!src) return null;
  if (src.figure) return piecesOfFigure(src.figure);
  if (typeof src.ride === 'string') {
    const { rideBuild } = await import('../gameworld/ride.js');
    const { bakeVehicleRig } = await import('../vehicle-designer/vehicle-rig.js');
    return piecesOfFigure(bakeVehicleRig(rideBuild(src.ride, src.seed ?? 1), { targetH: RIDE_H }));
  }
  if (src.racer && typeof src.racer === 'object') {
    const { racerOf } = await import('../car-designer/roster.js');
    return piecesOfFigure(racerOf(src.racer).S.figure);
  }
  if (src.supercar && typeof src.supercar === 'object') {
    const { supercarFigure } = await import('../car-designer/supercar-figure.js');
    return piecesOfFigure(supercarFigure(src.supercar));
  }
  if (typeof src.craft === 'string') {
    const { craftPieces } = await import('../craft-shelf/craft-rig.js');
    const c = craftPieces(src.craft, { palette: src.palette });
    return normalizePieces(c.pieces);
  }
  throw new Error('transformation: vehicle must be { ride } | { racer } | { supercar } | { craft } | { figure }');
}

/** bakeTransformer(spec) → { figure, readout } */
export async function bakeTransformer({ robot = { frame: {} }, vehicle = null, scheme, height, keys = 24 } = {}) {
  const sid = scheme || schemeFor({ vehicle });
  const S = TRANSFORM_SCHEMES[sid];
  if (!S) throw new Error(`transformation: scheme '${sid}' is not one of ${SCHEME_IDS.join(', ')}`);
  const V = await vehiclePieces(vehicle);
  let fig;
  if (robot.figure) fig = robot.figure;
  else {
    const H = Number.isFinite(height) ? height : (V ? V.length * S.ratio : 18);
    const manifest = robot.manifest || innerFrameManifest({ H, build: (S.frame && S.frame.build) || undefined, ...(robot.frame || {}) });
    fig = bakeUnitRig(manifest, { keys: 12, targetH: H });
  }
  return composeTransformer({ robot: fig, vehicle: V, scheme: sid, keys });
}
