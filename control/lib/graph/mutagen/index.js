// MUTAGEN: a real species made into a game creature by oozes (compose.js has the law, oozes/ the shelf). Pure data,
// deterministic, no I/O. An ooze never changes a skeleton's topology: the creature keeps the species' limbs and rig.
//
// What a plan can say is applied at the mint, so the stored plan is the mutated body and `/plan/...` patches still
// retune it. The FORM layer acts on the species' params before `buildFauna`: `scale` grows the whole animal about the
// ground point, `bulk`, `legBulk` and `tailBush` thicken by ring radius alone, `headScale` grows the head about its nape.
// The PUSHES (push.js) draw it for a game: half on the params (rings, ears, colours), half on the built plan (the
// head's rows, fangs, hackles, the rest face, glowing eyes).
import { OOZES } from './oozes/index.js';
import { oozeErrors, normalizeOozes, composeForm, FORM_KEYS } from './compose.js';
import { composePush, pushParams, pushPlan, pushErrors, growMesh } from './push.js';
import { buildFauna } from '../fauna/build.js';

export { OOZES, oozeErrors, normalizeOozes, composeForm, composePush, pushErrors, FORM_KEYS };

// FNV-1a: the default seed, from the base the creature is made from (so adding an ooze moves no other ooze's spots)
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
  const s = seed ?? strHash(key) % 1000003, push = composePush(oozes, OOZES, s);
  return { oozes, seed: s, form: composeForm(oozes), ...(push ? { push } : {}) };
}

/**
 * Species params with a resolved mutagen's form and param pushes laid over them (a new object; the params as given when
 * nothing moves). A grown head carries its eyes, ears and nose with it: a species whose head details are metres (no
 * `headRelative`) takes its own head as the reference, so they scale with the growth and keep their proportion.
 */
export function oozeParams(P, mutagen) {
  const form = mutagen?.form || {};
  if (!Object.keys(form).length && !mutagen?.push) return P;
  const out = { ...P };
  for (const k of FORM_KEYS) if (form[k] !== undefined) out[k] = (P[k] ?? 1) * form[k];
  if ((form.scale || form.headScale) && !P.headRelative && P.headScale) Object.assign(out, { headRelative: P.headScale * (P.scale ?? 1), relBrow: true });
  // a worn head mesh (build.js `wearHeadMesh`) is sized in metres, nape to nose: it grows with the animal and its head
  if ((form.scale || form.headScale) && P.headMesh) out.headMesh = growMesh(P.headMesh, (form.scale ?? 1) * (form.headScale ?? 1));
  return pushParams(out, mutagen?.push);
}

/**
 * A species' params with a resolved mutagen → its ring plan (the species' own plan when nothing acts). `report.face`
 * is the share of the face's pushes the head could seat (push.js `pushPlan`).
 */
export function oozeFauna(P, mutagen, report = {}) {
  const Q = oozeParams(P, mutagen);
  return pushPlan(buildFauna(Q), mutagen?.push, Q, report);
}
