// BODIES: what the rig is derived from. A species is its own body (its family's tables, its params, its plan). An oozed
// creature (lib/graph/mutagen) is a body of its own: the params and the plan the mutagen built, its locomotion the
// species' with an overlay for what it grew (a grafted tail's bones and swing, a pair of wings and their flight). It
// is registered under an id of its own, `<species>~<key>`, so every rig function that takes a species id (the skeleton,
// the binds, the gaits, the behaviors, their caches) takes it unchanged; a species id reads exactly as before.
//
//   registerBody(rid, { species, P, plan, over })   an oozed body under its rig id (`over`: a locomotion overlay)
//   bodyParams(id) · bodyPlan(id) · bodyLocomotion(id) · bodyFamily(id) · bodySpecies(id) · isBody(id)
// A species' plan is built fresh on every call, as `speciesPlan` is; a registered body's plan is a fresh copy.
import { SPECIES, speciesParams, speciesPlan } from './species.js';
import { locomotionFor, mergeLocomotion, LOCOMOTION, TAIL_BUILD_OF } from './locomotion/index.js';

const BODIES = new Map();
const KEEP = 64;   // the registry holds the bodies in use (a world's creatures), the oldest let go past this

/** An oozed body under its rig id. Re-registering an id replaces it (the body is a pure function of its recipe). */
export function registerBody(rid, { species, P, plan, over = null }) {
  if (!SPECIES[species]) throw new Error(`body '${rid}': unknown species '${species}'`);
  BODIES.delete(rid);
  BODIES.set(rid, Object.freeze({ species, P, plan, over }));
  while (BODIES.size > KEEP) BODIES.delete(BODIES.keys().next().value);
  return rid;
}

export const isBody = (id) => BODIES.has(id);
/** the species a rig id is made from (itself for a species) */
export const bodySpecies = (id) => (BODIES.has(id) ? BODIES.get(id).species : SPECIES[id] ? id : null);
export const bodyFamily = (id) => { const s = bodySpecies(id); return s ? SPECIES[s].family : null; };
export const bodyParams = (id) => (BODIES.has(id) ? BODIES.get(id).P : speciesParams(id));
export const bodyPlan = (id) => (BODIES.has(id) ? structuredClone(BODIES.get(id).plan) : speciesPlan(id));

/** A body's locomotion: the species' own, with the body's overlay merged over it (mergeLocomotion's grammar). */
export function bodyLocomotion(id) {
  const s = bodySpecies(id); if (!s) return null;
  const B = BODIES.get(id), family = SPECIES[s].family;
  if (!B?.over) return locomotionFor(family, s);
  const e = LOCOMOTION[family], spec = e.species?.[s];
  const L = mergeLocomotion(mergeLocomotion(e, spec), B.over);
  const tailBuild = B.over.axial?.tailBuild ?? spec?.axial?.tailBuild ?? L.axial.tailBuild ?? TAIL_BUILD_OF[family] ?? 'stub';
  return { ...L, axial: { ...L.axial, tailBuild } };
}
