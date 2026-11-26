/**
 * BODY FIT: does a species carry out a class? Measured from the body it already is, never authored per species: its
 * support and wings (fauna/behavior/capabilities.js), its size class (fauna/size-class.js) and its gaits (fauna/rig.js),
 * the way the mind measures a body's verbs (mind/measure.js). A class asks (./vocab.js MOVES `needs`, the row's `fits`);
 * the body answers.
 *
 *   fitOf(classId, species, { ooze?, stylism? })  → { ok, misses: [why …], body: { support, wings, swimmer, size,
 *                            extent, height, scale, gaits } }
 *   checkFit(classId, species, grown?)  the same, throwing the misses when it does not fit
 *   fitOfPeople(classId, skin) · checkFitPeople(classId, skin)   the same for a people (./people.js: a person or a
 *                            non-human people, on two legs at its own stature)
 *   fitOfModel(classId, skin) · checkFitModel(classId, skin)     the same for a model made elsewhere (./model.js: a rigged
 *                            humanoid, on two legs at the height it is stood at)
 *   TOPOLOGIES · topologyOf(body)  the body's shape as the shelves that animate it key it: a `person` (a people on the
 *                            humanoid rig, or a model), a `kin` (a beast-kin's card on that rig, beast/cards.js), and a
 *                            species by what holds it up: `winged` (any wings), `quadruped`, `biped`, `finned`, `limbless`.
 *                            Every fit's body carries it (`body.topology`)
 *   bodyOf(species, { ooze?, stylism? })  the body measured: an ooze GROWS it (mutagen/compose.js: a uniform `scale`,
 *                            never a joint), so its size class is the grown body's (a dire wolf is a wolf × 1.45)
 *
 * An ooze's chimera grafts (wings at 0.66) are not measured yet: an oozed body has the species' own wings and gaits.
 * A fauna species only (the ring-plan bodies the animal door mints and the oozes grow); a bug, a maker or an archetype
 * throws: they fight in a later step. Pure and deterministic; a species' skeleton is built once (the fauna caches).
 */
import { SPECIES } from '../fauna/species.js';
import { capabilitiesOf } from '../fauna/behavior/capabilities.js';
import { extentOf, heightOf, classOfExtent } from '../fauna/size-class.js';
import { resolveMutagen } from '../mutagen/index.js';
import { motionGaits } from '../fauna/rig.js';
import { MOVES, TOPOLOGIES } from './vocab.js';
import { foeClass } from './index.js';
import { peopleBody } from './people.js';
import { modelBody } from './model.js';
import { isKin } from './packs.js';

const r3 = (v) => Math.round(v * 1000) / 1000;

export function bodyOf(species, { ooze, stylism } = {}) {
  if (!SPECIES[species]) throw new Error(`foe: no fauna species '${species}' (a foe's body is a fauna species: create_character { as: 'animal' }'s)`);
  const cap = capabilitiesOf(species), M = resolveMutagen(ooze, { key: species, stylism }), scale = M?.form?.scale ?? 1;
  const extent = r3(extentOf(species) * scale), height = r3(heightOf(species) * scale);
  return { support: cap.support, wings: cap.wings, swimmer: cap.swimmer, size: classOfExtent(extent, height), extent, height, scale, gaits: motionGaits(species) };
}

/** A body's shape, as the shelves that move it read it (the attack cards' poses, the foe audit): one word a body. */
export { TOPOLOGIES };
const BY_SUPPORT = Object.freeze({ four: 'quadruped', two: 'biped', wingwalk: 'winged', fins: 'finned', none: 'limbless' });
export function topologyOf(b) {
  if (b.people !== undefined) return isKin(b.people) ? 'kin' : 'person';
  if (b.model !== undefined) return 'person';
  return b.wings ? 'winged' : b.swimmer && b.support !== 'four' ? 'finned' : BY_SUPPORT[b.support] ?? 'limbless';
}

const NEEDS = {
  ground: (b) => (b.swimmer || b.support === 'fins' ? 'it needs ground under it, and the body swims' : null),
  wings: (b) => (b.wings ? null : 'it needs wings, and the body has none'),
};

// the class's asks against a measured body
function fitWith(c, b) {
  const F = c.fits, misses = [];
  for (const n of MOVES[c.move].needs) { const m = NEEDS[n](b); if (m) misses.push(`${c.move}: ${m}`); }
  if (F.support && !F.support.includes(b.support)) misses.push(`support: it stands on ${F.support.join(' | ')}, the body on ${b.support}`);
  if (F.size && !F.size.includes(b.size)) misses.push(`size: it is ${F.size.join(' | ')}, the body ${b.size}`);
  if (F.gaits && !F.gaits.some((g) => b.gaits.includes(g))) misses.push(`gaits: it moves by ${F.gaits.join(' | ')}, the body by ${b.gaits.join(', ')}`);
  if (F.wings === true && !b.wings) misses.push('wings: it flies, and the body has none');
  if (F.wings === false && b.wings) misses.push('wings: it keeps to the ground, and the body has wings');
  return { ok: misses.length === 0, misses, body: { ...b, topology: topologyOf(b) } };
}

export const fitOf = (classId, species, grown = {}) => fitWith(foeClass(classId), bodyOf(species, grown));
/** A people's fit (./people.js): a two-legged body at its own stature, checked as a species' is. */
export const fitOfPeople = (classId, skin) => fitWith(foeClass(classId), peopleBody(skin));

export function checkFitPeople(classId, skin) {
  const f = fitOfPeople(classId, skin);
  if (!f.ok) throw new Error(`foe: a ${classId} does not fit a ${skin.people} (${f.misses.join('; ')})`);
  return f;
}

/** A model's fit (./model.js): a two-legged body at the height it is stood at, checked as a people's is. */
export const fitOfModel = (classId, skin) => fitWith(foeClass(classId), modelBody(skin));

export function checkFitModel(classId, skin) {
  const f = fitOfModel(classId, skin);
  if (!f.ok) throw new Error(`foe: a ${classId} does not fit a model on two legs (${f.misses.join('; ')})`);
  return f;
}

export function checkFit(classId, species, grown = {}) {
  const f = fitOf(classId, species, grown);
  if (!f.ok) throw new Error(`foe: a ${classId} does not fit a ${grown.ooze ? 'grown ' : ''}${species} (${f.misses.join('; ')})`);
  return f;
}
