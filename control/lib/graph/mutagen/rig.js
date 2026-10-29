// THE OOZED RIG: an oozed creature's skeleton and clips are its own body's, not its species'. `oozeBody` builds the
// body (the mutagen's params and plan), works out what its grafts need to move (chimera.js `graftLocomotion`: a grafted
// tail's bones and swing, grafted wings' flight) and registers it with the fauna rig (fauna/body.js) under a rig id of
// its own; every rig function then reads it as it reads a species. A stored recipe keeps its species and the ooze spec
// beside its motion (`motion.ooze`), so the World, the mint's gates and every export rebuild the same body, by the same
// pure functions, from the recipe alone.
//
//   oozeBody(species, { ooze, seed, stylism })  → { rid, plan, report } (rid the species itself when nothing acts)
//   rigSpecies(motion)                          → the rig id a stored `recipe.motion` animates with
//   oozeMotion(motion, species, spec)           → the motion as stored: the species and the spec, not the rig id
import { speciesParams } from '../fauna/species.js';
import { registerBody, bodyLocomotion } from '../fauna/body.js';
import { resolveMutagen, oozeFauna } from './index.js';
import { graftLocomotion } from './chimera.js';

const fnv = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const specOf = ({ ooze, seed, stylism } = {}) => ({ ...(ooze !== undefined ? { ooze } : {}), ...(seed !== undefined ? { seed } : {}), ...(stylism !== undefined ? { stylism } : {}) });

export function oozeBody(species, spec = {}) {
  // (a game's setting dresses the colours only: the body, and so its rig id, are the oozes')
  const M = resolveMutagen(spec.ooze, { seed: spec.seed, key: species, stylism: spec.stylism, setting: spec.setting });
  if (!M) return { rid: species, plan: null, report: {}, mutagen: null };
  // (a coat dressed in its world, `spec.colors`: the animal door's `coat: 'world'`; colours only, so the rig is the same)
  const P0 = speciesParams(species), report = {}, plan = oozeFauna(spec.colors ? { ...P0, colors: spec.colors } : P0, M, report);
  const rid = `${species}~${fnv(JSON.stringify({ oozes: M.oozes, seed: M.seed, stylism: spec.stylism ?? null })).toString(36)}`;
  const over = graftLocomotion(report, bodyLocomotion(species));
  registerBody(rid, { species, P: report.params, plan, over });
  return { rid, plan, report, mutagen: M };
}

/** The rig id a stored motion animates with: its species, or (`motion.ooze`) the oozed body rebuilt and registered. */
export function rigSpecies(motion) {
  if (!motion?.ooze) return motion?.species;
  const { oozes, seed, stylism } = motion.ooze;
  return oozeBody(motion.species, { ooze: oozes, seed, stylism }).rid;
}

/** A plan's motion as it is stored: the species and the ooze spec it is rebuilt from, never the rig id. */
export function oozeMotion(motion, species, { oozes, seed, stylism }) {
  return { ...motion, species, ooze: { oozes, seed, ...(stylism !== undefined && stylism !== null ? { stylism } : {}) } };
}
export { specOf };
