/**
 * transformation — a body in two forms: a robot that folds into a vehicle and back (more-than-meets).
 *
 *   bakeTransformer({ robot?, vehicle?, scheme?, height?, keys? }) → { figure, readout }
 *
 *   robot:   { frame: { tint?, joint?, eye? } }   (the default: an inner frame made to the vehicle's size)
 *          | { variable: { palette?, build? } }  (a VARIABLE SUIT, variable-suit.js: a suit drawn to fold into its own
 *                                                waverider; no vehicle, its scheme 'variable', `height` its height)
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
import { variableSuit, VARIABLE_PALETTES } from './variable-suit.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { faceListToMesh } from '../figures/face-mesh.js';

export { TRANSFORM_SCHEMES, SCHEME_IDS, schemeFor, composeTransformer, piecesOfFigure, innerFrameManifest, variableSuit, VARIABLE_PALETTES };

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

/**
 * bakeVariableSuit({ H, palette, build, keys }) → { figure, readout }: a variable suit (variable-suit.js) baked as a
 * suit and composed with its kit into the body that folds into its waverider. The kit is lowered into the suit bake's
 * own frame (centred on x and y over the suit's faces, its feet on z = 0, scaled to H), as the suit's faces are.
 */
export function bakeVariableSuit({ H = 18, palette = 'federal', build = {}, keys = 24 } = {}) {
  const vs = variableSuit({ H, palette, build });
  const fig = bakeUnitRig(vs.manifest, { keys: 12, targetH: H });
  const { faces } = lowerAssemblerBuild(vs.manifest);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const s = H / ((mx[2] - mn[2]) || 1), cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
  const N = (v) => [(v[0] - cx) * s, (v[1] - cy) * s, (v[2] - mn[2]) * s];
  const kit = vs.kit.map((k) => {
    const lowered = lowerAssemblerBuild({ kind: 'assembler', units: 'm', items: [{ id: k.id, source: k.source, at: [0, 0, 0] }] }).faces
      .map((f) => ({ ...f, corners: f.corners.map(N) }));
    const gm = faceListToMesh(lowered);
    const F = k.flight;
    return {
      id: `kit_${k.id}`, bone: k.bone,
      soup: { pos: Array.from(gm.positions), col: Array.from(gm.colors), spec: gm.specs ? Array.from(gm.specs) : null },
      flight: { bone: F.bone, turns: F.turns, pivot: F.pivot && N(F.pivot), to: F.to && N(F.to) },
    };
  });
  return composeTransformer({ robot: fig, scheme: vs.scheme, keys, kit });
}

/** bakeTransformer(spec) → { figure, readout } */
export async function bakeTransformer({ robot = { frame: {} }, vehicle = null, scheme, height, keys = 24 } = {}) {
  if (robot.variable) return bakeVariableSuit({ H: Number.isFinite(height) ? height : 18, ...(robot.variable || {}), keys });
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
