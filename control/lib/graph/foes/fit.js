/**
 * BODY FIT: does a species carry out a class? Measured from the body it already is, never authored per species: its
 * support and wings (fauna/behavior/capabilities.js), its size class (fauna/size-class.js) and its gaits (fauna/rig.js),
 * the way the mind measures a body's verbs (mind/measure.js). A class asks (./vocab.js MOVES `needs`, the row's `fits`);
 * the body answers.
 *
 *   fitOf(classId, species)  → { ok, misses: [why …], body: { support, wings, swimmer, size, gaits } }
 *   checkFit(classId, species)  the same, throwing the misses when it does not fit
 *
 * A fauna species only (the ring-plan bodies the animal door mints and the oozes grow); a bug, a maker or an archetype
 * throws: they fight in a later step. Pure and deterministic; a species' skeleton is built once (the fauna caches).
 */
import { SPECIES } from '../fauna/species.js';
import { capabilitiesOf } from '../fauna/behavior/capabilities.js';
import { sizeClassOf } from '../fauna/size-class.js';
import { motionGaits } from '../fauna/rig.js';
import { MOVES } from './vocab.js';
import { foeClass } from './index.js';

function bodyOf(species) {
  if (!SPECIES[species]) throw new Error(`foe: no fauna species '${species}' (a foe's body is a fauna species: create_character { as: 'animal' }'s)`);
  const cap = capabilitiesOf(species);
  return { support: cap.support, wings: cap.wings, swimmer: cap.swimmer, size: sizeClassOf(species).class, gaits: motionGaits(species) };
}

const NEEDS = {
  ground: (b) => (b.swimmer || b.support === 'fins' ? 'it needs ground under it, and the body swims' : null),
  wings: (b) => (b.wings ? null : 'it needs wings, and the body has none'),
};

export function fitOf(classId, species) {
  const c = foeClass(classId), b = bodyOf(species), F = c.fits, misses = [];
  for (const n of MOVES[c.move].needs) { const m = NEEDS[n](b); if (m) misses.push(`${c.move}: ${m}`); }
  if (F.support && !F.support.includes(b.support)) misses.push(`support: it stands on ${F.support.join(' | ')}, the body on ${b.support}`);
  if (F.size && !F.size.includes(b.size)) misses.push(`size: it is ${F.size.join(' | ')}, the body ${b.size}`);
  if (F.gaits && !F.gaits.some((g) => b.gaits.includes(g))) misses.push(`gaits: it moves by ${F.gaits.join(' | ')}, the body by ${b.gaits.join(', ')}`);
  if (F.wings === true && !b.wings) misses.push('wings: it flies, and the body has none');
  if (F.wings === false && b.wings) misses.push('wings: it keeps to the ground, and the body has wings');
  return { ok: misses.length === 0, misses, body: b };
}

export function checkFit(classId, species) {
  const f = fitOf(classId, species);
  if (!f.ok) throw new Error(`foe: a ${classId} does not fit a ${species} (${f.misses.join('; ')})`);
  return f;
}
