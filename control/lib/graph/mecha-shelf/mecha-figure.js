/**
 * mecha-figure — a mecha shelf frame as the doors draw it: its faces on the studio grid (mint_solid's vehicle preview,
 * the family layer's `mecha` instance), its rider seated in it.
 *
 *   readMechaSpec(spec, at?)    → { archetype, pose?, palette?, rider? }, or throws naming what it takes: `pose` a stance's
 *                                 name ('board', 'lift'), a stance ({ knee | height, track?, fore?, sway?, feet? }) or
 *                                 joint values ({ joints: { kneeR: 60 } }), `palette` one of the shelf's, `rider` true (the
 *                                 realistic hero) or the hero's spec, astride the saddle in the frame's posture, its hands
 *                                 on the grips, its feet on the pegs
 *   mechaInstanceFaces(spec)    → (async) { faces, spec, stats }: the frame assembled at its stance, lowered to the grid's
 *                                 faces, its rider with it
 *
 * The recipe is the frame's words, never its geometry: it regenerates on every read. Pure.
 */
import { lowerAssemblerFaces } from '../worlds/workbench-assembler.js';
import { MECHA_ARCHETYPES, MECHA_PALETTES, assembleFrame, posedFrame } from './index.js';
import { readRiderHero, riderOn } from '../cycle-shelf/cycle-rider.js';

const KEYS = Object.freeze(['archetype', 'pose', 'palette', 'rider']);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function readMechaSpec(spec, at = 'mecha') {
  if (!isObj(spec)) throw new Error(`${at} is { archetype, pose?, palette?, rider? }`);
  for (const k of Object.keys(spec)) if (!KEYS.includes(k)) throw new Error(`${at}.${k} is not a mecha frame's word (${KEYS.join(', ')})`);
  if (!MECHA_ARCHETYPES[spec.archetype]) throw new Error(`${at}.archetype is one of ${Object.keys(MECHA_ARCHETYPES).join(', ')}`);
  if (spec.palette !== undefined && !MECHA_PALETTES[spec.palette]) throw new Error(`${at}.palette is one of ${Object.keys(MECHA_PALETTES).join(', ')}`);
  if (spec.pose !== undefined && typeof spec.pose !== 'string' && !isObj(spec.pose)) throw new Error(`${at}.pose is a stance's name, a stance { knee | height, … } or { joints }`);
  // (its pose read as the shelf reads it: a stance it has not, a joint it has not, refused)
  if (spec.pose !== undefined) posedFrame(spec.archetype, spec.pose);
  if (spec.rider !== undefined && spec.rider !== false) readRiderHero(spec.rider, `${at}.rider`);
  return spec;
}

export async function mechaInstanceFaces(spec) {
  readMechaSpec(spec);
  const { manifest, readout } = assembleFrame(spec.archetype, { pose: spec.pose, palette: spec.palette });
  const faces = lowerAssemblerFaces(manifest);
  // (its rider seated, posed on the frame's own rider points at its stance, in its frame)
  const rider = spec.rider ? await riderOn(spec.archetype, { hero: spec.rider, posture: MECHA_ARCHETYPES[spec.archetype].posture, rider: readout.rider }) : null;
  if (rider) faces.push(...rider.faces);
  return {
    faces,
    spec,
    stats: {
      archetype: spec.archetype, label: readout.label, classOf: readout.classOf, pose: readout.pose, joints: readout.joints,
      measures: readout.measures, mass: readout.mass.gross, laws: readout.laws.ok, faces: faces.length,
      ...(rider ? { rider: { reached: rider.report.reached, hands: rider.report.hands } } : {}),
    },
  };
}
