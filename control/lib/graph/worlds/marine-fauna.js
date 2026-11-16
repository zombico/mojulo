/**
 * THE SEA'S ANIMALS ON A WORLD: a cast called by marine/fauna.js lowered onto the page. Each animal is its species' own
 * rig from the encyclopedia (fauna/ or bugs/), built here and never stored, with the one gait it moves by, and swims a
 * closed loop on the page's walkers channel (scene/channels/walkers.js: no mind, no collision, the same loop every
 * load). The figures are built once a species and kept.
 *
 *   marineLength(species)            its length in metres, as the encyclopedia measures it
 *   marineFigure({ species, roster, gait })   → the packed rig figure, its gait the walkers' `forward`
 *   marineSkin(spec)                          whether the walkers' blend holds on its skin
 *   lowerMarineFauna(payload, placed)         a placeMarineFauna result laid on a payload (a body whose skin does not
 *                                             hold the blend swims in rigid parts, named in the readout's `rigid`): its walkers after the world's
 *                                             own, its figures beside them. Nothing placed, the payload untouched
 */
import { WORLD_KINDS } from './world-kinds.js';
import { animalFigure } from './fauna-units.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { MARINE_FAUNA } from '../marine/fauna.js';
import { bugParams, assembleBug } from '../bugs/species.js';
import { withBugMotion } from '../bugs/rig.js';
import { expandPlan } from '../polygonizer/station-loft-plan.js';
import { walkerSkinStretch } from '../scene/channels/walkers.js';

const KEYS = 12, FIGURES = new Map(), SKINS = new Map();

/** A species' skin, measured once it is built: whether the walkers' blend holds on it (scene/channels/walkers.js
 *  walkerSkinStretch) → { stretch, size, holds } | null. */
export async function marineSkin(spec) {
  const key = `${spec.roster}:${spec.species}:${spec.gait}`;
  if (!SKINS.has(key)) SKINS.set(key, walkerSkinStretch(await marineFigure(spec)));
  return SKINS.get(key);
}

export function marineLength(species) {
  const R = MARINE_FAUNA[species];
  if (!R) throw new Error(`marine: '${species}' is not one of the sea's animals`);
  return sizeClassOf(species).extent;
}

export function marineFigure({ species, roster, gait }) {
  const key = `${roster}:${species}:${gait}`;
  if (!FIGURES.has(key)) FIGURES.set(key, (async () => {
    if (roster !== 'bugs') return animalFigure({ species, gait });
    const B = bugParams(species), recipe = expandPlan(withBugMotion(assembleBug(B).plan, B, species, [gait], KEYS));
    const scene = await WORLD_KINDS.layered.resolve({ kind: 'layered', recipe }, { title: species });
    const { preview, embodies, ...pack } = scene.figures.body;
    return { ...pack, clips: { ...pack.clips, forward: pack.clips[gait] } };
  })());
  return FIGURES.get(key);
}

export async function lowerMarineFauna(payload, placed) {
  if (!payload || !placed || !placed.walkers.length) return payload;
  const figures = {};
  for (const [name, spec] of Object.entries(placed.figures)) figures[name] = await marineFigure(spec);
  // (one skin only where the skin holds: a figure whose own binding parts under the blend swims in rigid parts, and is said)
  const rigid = [];
  for (const [name, spec] of Object.entries(placed.figures)) { const S = await marineSkin(spec); if (!S || !S.holds) rigid.push({ species: spec.species, ...(S ? { stretch: S.stretch } : {}) }); }
  const held = new Set(rigid.map((r) => `sea:${r.species}`));
  const walkers = placed.walkers.map((w) => (held.has(w.figure) ? (({ blend, ...rest }) => rest)(w) : w));
  if (rigid.length) placed.readout.rigid = rigid;
  payload.walkers = [...(payload.walkers || []), ...walkers];
  payload.figures = { ...(payload.figures || {}), ...figures };
  return payload;
}
