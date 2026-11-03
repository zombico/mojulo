/**
 * con-figure — a construction shelf machine as the doors draw it: its faces on the studio grid (mint_solid's vehicle
 * preview, the family layer's `construction` instance), and its figure in a level (a parked machine: world-scene.js,
 * the vehicle registry's parked.js).
 *
 *   readConSpec(spec, at?)     → { archetype, pose?, tool?, carrier?, height?, palette? }, or throws naming what it takes:
 *                                `pose` a named pose ('dump', 'rigged') or joint values ({ boom: 20, slew: 90 }), `tool`
 *                                one its mount takes, `carrier` one it lists, `height` metres under a tower crane's hook,
 *                                `palette` one of the shelf's
 *   conInstanceFaces(spec)     → { faces, spec, stats }: the machine assembled at its pose, lowered to the grid's faces
 *   conFootprint(spec)         → { L, W, H }: what a parked machine stands on at its pose (its parts within 3 m of the
 *                                ground, across and along: a crane's floats out, a tower crane's base) and its height
 *   conTrafficMesh(spec, k)    → { pos, col, len, wid }: the machine folded to drive (its `transport` pose, else its
 *                                rest), baked as the city's moving cars are (vehicles/car-bake.js): facing +x, centred
 *                                on its footprint, its wheels on the road, every metre `k` of the world's units
 *   conFigure(spec)            → the rig figure (vehicle-designer/vehicle-rig.js packVehicleFigure): the machine the root,
 *                                at its pose (its rest unless the spec says), what it stands on centred on its spot (a
 *                                parked footprint is centred on its spot), and its footprint
 *
 * The recipe is the machine's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerBuild, lowerAssemblerFaces, resolveAssemblerPlacements } from '../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { faceListToMesh } from '../figures/face-mesh.js';
import { b64f32, b64u8 } from '../figures/rig-bake.js';
import { CON_ARCHETYPES, CON_PALETTES, assembleMachine, composeMachine, posedJoints } from './index.js';

const KEYS = Object.freeze(['archetype', 'pose', 'tool', 'carrier', 'height', 'palette']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (n) => Math.round(n * 1000) / 1000 + 0;

export function readConSpec(spec, at = 'construction') {
  if (!isObj(spec)) throw new Error(`${at} is { archetype, pose?, tool?, carrier?, height?, palette? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a construction machine's word (${KEYS.join(', ')})`);
  if (!CON_ARCHETYPES[spec.archetype]) throw new Error(`${at}.archetype is one of ${Object.keys(CON_ARCHETYPES).join(', ')}`);
  if (spec.palette !== undefined && !CON_PALETTES[spec.palette]) throw new Error(`${at}.palette is one of ${Object.keys(CON_PALETTES).join(', ')}`);
  if (spec.height !== undefined && !Number.isFinite(spec.height)) throw new Error(`${at}.height is metres under its hook`);
  if (spec.pose !== undefined && typeof spec.pose !== 'string' && !isObj(spec.pose)) throw new Error(`${at}.pose is a pose's name or its joints' values { joint: degrees }`);
  // (its swaps and its pose read as the shelf reads them: a tool its mount does not take, a pose it has not, refused)
  const key = composeMachine(spec.archetype, { tool: spec.tool, carrier: spec.carrier, height: spec.height });
  if (spec.pose !== undefined) posedJoints(key, spec.pose);
  return spec;
}

const assembled = (spec, pose = spec.pose ?? 'rest') => assembleMachine(spec.archetype, { pose, tool: spec.tool, carrier: spec.carrier, height: spec.height, palette: spec.palette });

export function conInstanceFaces(spec) {
  readConSpec(spec);
  const { manifest, readout } = assembled(spec);
  const faces = lowerAssemblerFaces(manifest);
  return {
    faces,
    spec,
    stats: {
      archetype: spec.archetype, ...(readout.composed ? { composed: readout.composed } : {}), label: readout.label, classOf: readout.classOf, pose: readout.pose,
      joints: readout.joints, ...(readout.height !== undefined ? { height: readout.height } : {}), measures: readout.measures, laws: readout.laws.ok, faces: faces.length,
    },
  };
}

/** What it stands on at its pose: the bounds of its parts that reach within 3 m of the ground (a crane's floats out, a
 *  tower crane's base, never a boom overhead), its middle, and its height. */
function standsOn(manifest, readout) {
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const p of resolveAssemblerPlacements(manifest)) {
    if (p.bounds.min[2] > 3) continue;
    for (let k = 0; k < 2; k++) { lo[k] = Math.min(lo[k], p.bounds.min[k]); hi[k] = Math.max(hi[k], p.bounds.max[k]); }
  }
  return { L: r3(hi[1] - lo[1]), W: r3(hi[0] - lo[0]), H: readout.measures.height, centre: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2] };
}
export function conFootprint(spec) {
  readConSpec(spec);
  const { manifest, readout } = assembled(spec), F = standsOn(manifest, readout);
  return { L: F.L, W: F.W, H: F.H };
}

export function conFigure(spec) {
  readConSpec(spec);
  const { manifest, readout } = assembled(spec), F = standsOn(manifest, readout);
  const { faces, placements } = lowerAssemblerBuild(manifest);
  // (centred on its spot: what it stands on, its middle at the origin, its ground where it stands)
  const [cx, cy] = F.centre, shift = (c) => [r3(c[0] - cx), r3(c[1] - cy), c[2]];
  const root = [];
  for (const p of placements) for (let k = p.faceStart; k < p.faceStart + p.faceCount; k++) root.push({ ...faces[k], corners: faces[k].corners.map(shift) });
  return {
    ...packVehicleFigure([{ id: 'root', head: [0, 0, 0] }], new Map([['root', root]]), { keys: 2, rolls: [] }),
    construction: { archetype: spec.archetype, label: readout.label, pose: readout.pose, measures: readout.measures, footprint: { L: F.L, W: F.W, H: F.H } },
  };
}

/** The machine as a moving car: folded to drive, turned to face +x, centred, every metre `k` units. */
export function conTrafficMesh(spec, k = 1) {
  readConSpec(spec);
  const pose = spec.pose ?? (CON_ARCHETYPES[spec.archetype].poses.transport ? 'transport' : 'rest');
  const { manifest } = assembleMachine(spec.archetype, { pose, tool: spec.tool, carrier: spec.carrier, height: spec.height, palette: spec.palette, laws: false });
  // (its +y forward turned to +x: (x, y) → (y, −x))
  const turn = (v) => [v[1], -v[0], v[2]];
  const faces = lowerAssemblerFaces(manifest).map((f) => ({ ...f, corners: f.corners.map((c) => turn(c).map((x) => x * k)), ...(f.normal ? { normal: turn(f.normal) } : {}), ...(f.outNormal ? { outNormal: turn(f.outNormal) } : {}) }));
  const gm = faceListToMesh(faces, { decollide: true }), pos = gm.positions;
  let mnx = Infinity, mxx = -Infinity, mny = Infinity, mxy = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { mnx = Math.min(mnx, pos[i]); mxx = Math.max(mxx, pos[i]); mny = Math.min(mny, pos[i + 1]); mxy = Math.max(mxy, pos[i + 1]); }
  const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2, centred = new Float32Array(pos.length);
  for (let i = 0; i < pos.length; i += 3) { centred[i] = pos[i] - cx; centred[i + 1] = pos[i + 1] - cy; centred[i + 2] = pos[i + 2]; }
  return { pos: b64f32(centred), col: b64u8(gm.colors), len: mxx - mnx, wid: mxy - mny };
}
