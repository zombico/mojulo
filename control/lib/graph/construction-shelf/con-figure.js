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
 *   conFigure(spec)            → the rig figure (vehicle-designer/vehicle-rig.js packVehicleFigure): the machine the root,
 *                                at its pose (its rest unless the spec says), centred along its length and across its
 *                                width on its spot (a parked footprint is centred on its spot), and its footprint
 *
 * The recipe is the machine's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerBuild, lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
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

export function conFigure(spec) {
  readConSpec(spec);
  const { manifest, readout } = assembled(spec);
  const { faces, placements } = lowerAssemblerBuild(manifest);
  // (centred on its spot: its bounds' middle across and along at the origin, its ground where it stands)
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let k = 0; k < 2; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; }
  const cx = (lo[0] + hi[0]) / 2, cy = (lo[1] + hi[1]) / 2, shift = (c) => [r3(c[0] - cx), r3(c[1] - cy), c[2]];
  const root = [];
  for (const p of placements) for (let k = p.faceStart; k < p.faceStart + p.faceCount; k++) root.push({ ...faces[k], corners: faces[k].corners.map(shift) });
  return {
    ...packVehicleFigure([{ id: 'root', head: [0, 0, 0] }], new Map([['root', root]]), { keys: 2, rolls: [] }),
    construction: { archetype: spec.archetype, label: readout.label, pose: readout.pose, measures: readout.measures, footprint: { L: r3(hi[1] - lo[1]), W: r3(hi[0] - lo[0]), H: readout.measures.height } },
  };
}
