/**
 * cycle-figure — a cycle shelf machine as the doors draw it: its faces on the studio grid (mint_solid's vehicle
 * preview, the family layer's `cycle` instance), and its figure in a level (a parked vehicle: world-scene.js, the
 * vehicle registry's parked.js).
 *
 *   readCycleSpec(spec, at?)   → { archetype, look?, pose? }, or throws naming what it takes
 *   cycleInstanceFaces(spec)   → { faces, spec, stats }: the machine assembled, lowered to the grid's faces
 *   cycleFigure(spec)          → the rig figure (vehicle-designer/vehicle-rig.js packVehicleFigure): the machine the
 *                                root, each wheel its own bone at its axle; parked on its stand unless the pose says
 *                                otherwise; centred along its length (a parked footprint is centred on its spot)
 *
 * The recipe is the machine's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerBuild, lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { packVehicleFigure } from '../vehicle-designer/vehicle-rig.js';
import { CYCLE_ARCHETYPES, assembleCycle } from './index.js';
import { lookCard } from './cycle-looks.js';

const KEYS = Object.freeze(['archetype', 'look', 'pose']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (n) => Math.round(n * 1000) / 1000 + 0;

export function readCycleSpec(spec, at = 'cycle') {
  if (!isObj(spec)) throw new Error(`${at} is { archetype, look?, pose? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a cycle's word (${KEYS.join(', ')})`);
  if (!CYCLE_ARCHETYPES[spec.archetype]) throw new Error(`${at}.archetype is one of ${Object.keys(CYCLE_ARCHETYPES).join(', ')}`);
  if (spec.look !== undefined) lookCard(spec.look);
  if (spec.pose !== undefined) {
    if (!isObj(spec.pose)) throw new Error(`${at}.pose is { stand?: 'up' | 'down', steer?: degrees }`);
    for (const k of Object.keys(spec.pose)) if (!['stand', 'steer'].includes(k)) throw new Error(`${at}.pose.${k} is not a cycle's pose (stand, steer)`);
  }
  return spec;
}

const assembled = (spec) => assembleCycle(spec.archetype, { ...(spec.look ? { look: spec.look } : {}), pose: spec.pose ?? {} });

export function cycleInstanceFaces(spec) {
  readCycleSpec(spec);
  const { manifest, readout } = assembled(spec);
  const faces = lowerAssemblerFaces(manifest);
  return {
    faces,
    spec,
    stats: { archetype: spec.archetype, label: readout.label, layout: readout.layout, measures: readout.measures, laws: readout.laws.ok, ...(readout.lean ? { lean: readout.lean } : {}), faces: faces.length },
  };
}

export function cycleFigure(spec) {
  readCycleSpec(spec);
  // (a parked machine stands on its stand: its pose's own word wins)
  const pose = { stand: CYCLE_ARCHETYPES[spec.archetype].layout.some((e) => e.id === 'stand') ? 'down' : 'up', ...(spec.pose ?? {}) };
  const { manifest, readout } = assembled({ ...spec, pose });
  const { faces, placements } = lowerAssemblerBuild(manifest);
  let lo = Infinity, hi = -Infinity;
  for (const f of faces) for (const c of f.corners) { if (c[1] < lo) lo = c[1]; if (c[1] > hi) hi = c[1]; }
  const cy = (lo + hi) / 2, shift = (c) => [c[0], r3(c[1] - cy), c[2]];
  const buckets = new Map([['root', []]]), bones = [{ id: 'root', head: [0, 0, 0] }];
  placements.forEach((p, i) => {
    const garage = manifest.items[i].source.garage, own = garage.kind === 'cycle-wheel' ? `wheel${garage.slot === 'front' ? 'F' : 'R'}` : 'root';
    if (own !== 'root' && !buckets.has(own)) {
      buckets.set(own, []);
      bones.push({ id: own, head: shift([0, 1, 2].map((k) => (p.bounds.min[k] + p.bounds.max[k]) / 2)) });
    }
    const list = buckets.get(own);
    for (let k = p.faceStart; k < p.faceStart + p.faceCount; k++) list.push({ ...faces[k], corners: faces[k].corners.map(shift) });
  });
  return {
    ...packVehicleFigure(bones, buckets, { keys: 2, rolls: [] }),
    cycle: { archetype: spec.archetype, measures: readout.measures, ...(readout.lean ? { lean: readout.lean } : {}) },
  };
}
