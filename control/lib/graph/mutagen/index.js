// MUTAGEN: a real species made into a game creature by oozes (compose.js has the law, oozes/ the shelf). Pure data,
// deterministic, no I/O. An ooze never changes a skeleton's topology: the creature keeps the species' limbs and rig.
//
// What a plan can say is applied at the mint, so the stored plan is the mutated body and `/plan/...` patches still
// retune it. The FORM layer acts on the species' params before `buildFauna`: `scale` grows the whole animal about the
// ground point, `bulk`, `legBulk` and `tailBush` thicken by ring radius alone, `headScale` grows the head about its nape.
import { OOZES } from './oozes/index.js';
import { oozeErrors, normalizeOozes, composeForm, FORM_KEYS } from './compose.js';

export { OOZES, oozeErrors, normalizeOozes, composeForm, FORM_KEYS };

// FNV-1a: the default seed, from what the creature is made of
const strHash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** Error strings for an ooze spec and its seed (empty = valid). */
export function mutagenErrors(ooze, seed) {
  const errs = oozeErrors(ooze);
  if (seed !== undefined && seed !== null) {
    if (ooze === undefined || ooze === null) errs.push('`seed` places an ooze\'s spots: pass it with `ooze`');
    else if (!Number.isInteger(seed) || seed < 0) errs.push('`seed` is a non-negative integer');
  }
  return errs;
}

/**
 * An ooze spec → `{ oozes: [{ id, strength }], seed, form }`, or null when nothing acts (no ooze, an empty list, every
 * strength 0): the species' own body, byte-identical. `key` names the base (a species id) for the default seed.
 */
export function resolveMutagen(ooze, { seed, key = '' } = {}) {
  const errs = mutagenErrors(ooze, seed);
  if (errs.length) throw new Error(errs.join('; '));
  const oozes = normalizeOozes(ooze);
  if (!oozes.length) return null;
  return { oozes, seed: seed ?? strHash(`${key}|${oozes.map((o) => `${o.id}:${o.strength}`).join(',')}`), form: composeForm(oozes) };
}

/** Species params with a resolved mutagen's form laid over them (a new object; the params as given when no form moves). */
export function oozeParams(P, mutagen) {
  const form = mutagen?.form || {};
  if (!Object.keys(form).length) return P;
  const out = { ...P };
  for (const k of FORM_KEYS) if (form[k] !== undefined) out[k] = (P[k] ?? 1) * form[k];
  return out;
}
