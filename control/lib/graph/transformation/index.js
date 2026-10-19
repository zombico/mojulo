/**
 * transformation — a body in two forms: a robot that folds into a vehicle and back (more-than-meets).
 *
 *   bakeTransformer({ robot?, vehicle?, scheme?, height?, keys? }) → { figure, readout }
 *
 *   robot:   { frame: { tint?, joint?, eye? } }   (the default: an inner frame made to the vehicle's size)
 *          | { variable: { palette?, build? } }  (a VARIABLE SUIT, variable-suit.js: a suit drawn to fold into its own
 *                                                waverider; no vehicle, its scheme 'variable', `height` its height)
 *          | { alien: { palette?, build? } }     (an ALIEN BODY, alien-body.js: pointed shells folding into a hover
 *                                                jetski; no vehicle, its scheme 'alien-jetski')
 *          | { figure }                          (a baked biped rig: a suit's bakeUnitRig, a unitRef resolved upstream)
 *          | { manifest }                        (an assembler biped, inline)
 *   vehicle: { ride: 'car' | 'coupe' | 'van', seed? }   (gameworld/ride.js, the veh-* shelf)
 *          | { racer: { … } }                    (car-designer/roster.js racerOf)
 *          | { supercar: { preset?, … } }        (car-designer/supercar-figure.js)
 *          | { craft: '<archetype>', palette? }  (the craft shelf: a jet, a warbird, a starfighter)
 *          | { figure }                          (a baked vehicle rig: a vehicleRef resolved upstream)
 *          | absent                              (the robot's own alt form: the scheme says which)
 *   scheme:  a TRANSFORM_SCHEMES id (absent: by the vehicle, schemes.js schemeFor): a car 'car-bot' | 'rear-foot', a
 *            jet 'jet-bot' | 'fuselage-fold' (its dials `fold` 'front' | 'back', `legs` 'stretch' | 'box')
 *   height:  the robot's height in metres when the frame is made (absent: the vehicle's length × the scheme's ratio)
 *
 * The figure is a plain rig figure (`rig: true`) carrying `forms`: the World page plays it as any rig body, and an
 * entity with `forms` (controllable/forms.js) changes between them. Pure and deterministic.
 */

import { bakeUnitRig } from '../worlds/unit-rig.js';
import { innerFrameManifest } from './inner-frame.js';
import { composeTransformer, piecesOfFigure, normalizePieces } from './compose.js';
import { TRANSFORM_SCHEMES, SCHEME_IDS, SCHEME_DIALS, schemeFor, resolveScheme } from './schemes.js';
import { variableSuit, VARIABLE_PALETTES } from './variable-suit.js';
import { alienBody, ALIEN_PALETTES } from './alien-body.js';
import { lowerAssemblerBuild } from '../worlds/workbench-assembler.js';
import { faceListToMesh } from '../figures/face-mesh.js';

export { TRANSFORM_SCHEMES, SCHEME_IDS, SCHEME_DIALS, schemeFor, resolveScheme, composeTransformer, piecesOfFigure, innerFrameManifest, variableSuit, VARIABLE_PALETTES, alienBody, ALIEN_PALETTES };

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
 * bakeKitBody(built, { H, keys }) → { figure, readout }: a body drawn to fold (variable-suit.js, alien-body.js:
 * { manifest, kit, scheme }) baked as a suit and composed with its kit. The kit is lowered into the suit bake's own
 * frame (centred on x and y over the suit's faces, its feet on z = 0, scaled to H), as the suit's faces are.
 */
export function bakeKitBody(built, { H, keys = 24 } = {}) {
  const fig = bakeUnitRig(built.manifest, { keys: 12, targetH: H });
  const { faces } = lowerAssemblerBuild(built.manifest);
  let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 3; k++) { if (c[k] < mn[k]) mn[k] = c[k]; if (c[k] > mx[k]) mx[k] = c[k]; }
  const s = H / ((mx[2] - mn[2]) || 1), cx = (mn[0] + mx[0]) / 2, cy = (mn[1] + mx[1]) / 2;
  const N = (v) => [(v[0] - cx) * s, (v[1] - cy) * s, (v[2] - mn[2]) * s];
  const kit = built.kit.map((k) => {
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
  return composeTransformer({ robot: fig, scheme: built.scheme, keys, kit });
}

/** bakeVariableSuit({ H, palette, build, keys }): the variable suit folding into its waverider */
export const bakeVariableSuit = ({ H = 18, palette = 'federal', build = {}, keys = 24 } = {}) => bakeKitBody(variableSuit({ H, palette, build }), { H, keys });

/** bakeAlienBody({ H, palette, build, keys }): the alien body folding into its hover jetski */
export const bakeAlienBody = ({ H = 3.5, palette = 'void', build = {}, keys = 24 } = {}) => bakeKitBody(alienBody({ H, palette, build }), { H, keys });

/** bakeTransformer(spec) → { figure, readout } */
export async function bakeTransformer({ robot = { frame: {} }, vehicle = null, scheme, fold, legs, height, keys = 24 } = {}) {
  if (robot.variable) return bakeVariableSuit({ H: Number.isFinite(height) ? height : 18, ...(robot.variable || {}), keys });
  if (robot.alien) return bakeAlienBody({ H: Number.isFinite(height) ? height : 3.5, ...(robot.alien || {}), keys });
  const sid = scheme || schemeFor({ vehicle });
  const dials = { fold, legs };
  const S = resolveScheme(sid, dials);
  const V = await vehiclePieces(vehicle);
  let fig;
  if (robot.figure) fig = robot.figure;
  else {
    const H = Number.isFinite(height) ? height : (V ? V.length * S.ratio : 18);
    const manifest = robot.manifest || innerFrameManifest({ H, build: (S.frame && S.frame.build) || undefined, ...(robot.frame || {}) });
    fig = bakeUnitRig(manifest, { keys: 12, targetH: H });
  }
  return composeTransformer({ robot: fig, vehicle: V, scheme: sid, dials, keys });
}
