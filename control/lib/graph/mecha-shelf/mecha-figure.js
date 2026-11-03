/**
 * mecha-figure — a mecha shelf frame as the doors draw it: its faces on the studio grid (mint_solid's vehicle preview,
 * the family layer's `mecha` instance), its rider seated in it.
 *
 *   readMechaSpec(spec, at?)    → { archetype, pose?, palette?, rider?, task?, tools?, arms?, packTask?, packTools?, packMaker?, cabin?, slits?, backpack?, weapons?, livery?, wear? }, or throws: `pose` a stance's
 *                                 name ('board', 'lift'), a stance ({ knee | height, track?, fore?, sway?, feet? }) or
 *                                 joint values ({ joints: { kneeR: 60 } }), `palette` one of the shelf's, `rider` true (the
 *                                 realistic hero) or the hero's spec, astride the saddle in the frame's posture, its hands
 *                                 on the grips, its feet on the pegs; a modular frame's `task` (a site's task: its loadout,
 *                                 mecha-tools.js), `tools` ({ r?, l? }: a tool per arm) and `arms` ({ r?, l? }: an arm kit);
 *                                 a frame with a giant arm pack's `packTask` and `packTools` ({ r?, l? }) for its giant arms,
 *                                 its `packMaker` the design house whose pack it carries (mecha-gap-makers.js); a frame's
 *                                 `cabin` ('armoured': its closed cabin) and that cabin's `slits` ('open' | 'shut'); its
 *                                 `backpack` ('weapons': mecha-backpacks.js) and that backpack's `weapons` ({ r?, l? }); a
 *                                 dressed frame's `livery` and `wear` (mecha-military.js: the field walker's)
 *   mechaInstanceFaces(spec)    → (async) { faces, spec, stats }: the frame assembled at its stance, lowered to the grid's
 *                                 faces, its rider with it
 *
 * The recipe is the frame's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { MECHA_ARCHETYPES, MECHA_PALETTES, assembleFrame, composeFrame, frameRow, posedFrame } from './index.js';
import { readRiderHero, riderOn } from '../cycle-shelf/cycle-rider.js';
import { dressFaces, readMechaDress } from './mecha-military.js';
import { resolveMechaPalette } from './mecha-common.js';


const KEYS = Object.freeze(['archetype', 'pose', 'palette', 'rider', 'task', 'tools', 'arms', 'packTask', 'packTools', 'packMaker', 'cabin', 'slits', 'backpack', 'weapons', 'livery', 'wear']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readMechaSpec(spec, at = 'mecha') {
  if (!isObj(spec)) throw new Error(`${at} is { archetype, pose?, palette?, rider? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a mecha frame's word (${KEYS.join(', ')})`);
  if (!MECHA_ARCHETYPES[spec.archetype]) throw new Error(`${at}.archetype is one of ${Object.keys(MECHA_ARCHETYPES).join(', ')}`);
  if (spec.palette !== undefined && !MECHA_PALETTES[spec.palette]) throw new Error(`${at}.palette is one of ${Object.keys(MECHA_PALETTES).join(', ')}`);
  if (spec.pose !== undefined && typeof spec.pose !== 'string' && !isObj(spec.pose)) throw new Error(`${at}.pose is a stance's name, a stance { knee | height, … } or { joints }`);
  for (const k of ['tools', 'arms', 'packTools', 'weapons']) if (spec[k] !== undefined && !isObj(spec[k])) throw new Error(`${at}.${k} is { r?, l? }: one per arm`);
  // (its fitting and its pose read as the shelf reads them: a task, a tool, an arm or a stance it has not, refused)
  const key = composeFrame(spec.archetype, { task: spec.task, tools: spec.tools, arms: spec.arms, packTask: spec.packTask, packTools: spec.packTools, packMaker: spec.packMaker, cabin: spec.cabin, slits: spec.slits, backpack: spec.backpack, weapons: spec.weapons });
  if (spec.pose !== undefined) posedFrame(key, spec.pose);
  readMechaDress(key, { livery: spec.livery, wear: spec.wear });
  if (spec.rider !== undefined && spec.rider !== false) readRiderHero(spec.rider, `${at}.rider`);
  return spec;
}

/**
 * The rider seated on a frame at its stance: solved in the pelvis's frame (the rider's solve seats a rider on the
 * machine's centreline, and a frame sways off its own), then carried to where the pelvis stands. → { faces, report }
 */
export async function seatRider(archetype, readout, { hero, posture } = {}) {
  const [dx, dy] = readout.root, shift = (p) => [p[0] - dx, p[1] - dy, p[2]];
  const rider = Object.fromEntries(Object.entries(readout.rider).map(([k, p]) => [k, shift(p)]));
  const out = await riderOn(archetype, { hero, posture: posture ?? frameRow(archetype).posture, rider });
  const back = (c) => [c[0] + dx, c[1] + dy, c[2]];
  return { ...out, faces: out.faces.map((f) => ({ ...f, corners: f.corners.map(back) })) };
}

export async function mechaInstanceFaces(spec) {
  readMechaSpec(spec);
  const words = { pose: spec.pose, palette: spec.palette, task: spec.task, tools: spec.tools, arms: spec.arms, packTask: spec.packTask, packTools: spec.packTools, packMaker: spec.packMaker, cabin: spec.cabin, slits: spec.slits, backpack: spec.backpack, weapons: spec.weapons };
  const dressed = !!frameRow(spec.archetype).dress;
  const { manifest, readout } = assembleFrame(spec.archetype, { ...words, ...(dressed ? { finish: false } : {}) });
  // (a dressed frame in its styling library's look, its kit fitted: mecha-military.js; else its parts as finished)
  const faces = dressed
    ? dressFaces({ manifest, anchors: readout.anchors, colors: resolveMechaPalette(spec.palette, {}, frameRow(spec.archetype).palette).colors, archetype: spec.archetype }, { livery: spec.livery, wear: spec.wear })
    : lowerAssemblerFaces(manifest);
  // (its rider seated, posed on the frame's own rider points at its stance, in its frame)
  const rider = spec.rider ? await seatRider(readout.composed ?? spec.archetype, readout, { hero: spec.rider }) : null;
  if (rider) faces.push(...rider.faces);
  return {
    faces,
    spec,
    stats: {
      archetype: spec.archetype, ...(readout.composed ? { composed: readout.composed, loadout: readout.loadout, ...(readout.packLoadout ? { packLoadout: readout.packLoadout } : {}) } : {}), label: readout.label, classOf: readout.classOf, pose: readout.pose, joints: readout.joints,
      measures: readout.measures, mass: readout.mass.gross, laws: readout.laws.ok, faces: faces.length,
      ...(rider ? { rider: { reached: rider.report.reached, hands: rider.report.hands } } : {}),
    },
  };
}
