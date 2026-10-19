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
import { stylismErrors, resolveStylism, heighten, spendDetail, registerNote } from './stylism.js';

export { OOZES, oozeErrors, normalizeOozes, composeForm, composePush, pushErrors, FORM_KEYS };

// FNV-1a: the default seed, from the base the creature is made from (so adding an ooze moves no other ooze's spots)
const strHash = (s) => { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** Error strings for an ooze spec, its seed and its stylism (empty = valid). */
export function mutagenErrors(ooze, seed, stylism) {
  const errs = [...oozeErrors(ooze), ...stylismErrors(stylism)];
  if (seed !== undefined && seed !== null) {
    if ((ooze === undefined || ooze === null) && (stylism === undefined || stylism === null)) errs.push('`seed` places an ooze\'s spots: pass it with `ooze`');
    else if (!Number.isInteger(seed) || seed < 0) errs.push('`seed` is a non-negative integer');
  }
  return errs;
}

/**
 * An ooze spec (and a stylism) → `{ oozes: [{ id, strength }], seed, form, push?, stylism? }`, or null when nothing
 * acts (no ooze, an empty list, every strength 0, and no stylism): the species' own body, byte-identical. `key` names
 * the base (a species id) for the default seed. A stylism's register is laid on here (the warp); its detail budget is
 * spent on the body it is built on (`oozeFauna`).
 */
export function resolveMutagen(ooze, { seed, key = '', stylism } = {}) {
  const errs = mutagenErrors(ooze, seed, stylism);
  if (errs.length) throw new Error(errs.join('; '));
  const oozes = normalizeOozes(ooze), S = resolveStylism(oozes.map((o) => OOZES[o.id].stylism), stylism);
  if (!oozes.length && !S) return null;
  const s = seed ?? strHash(key) % 1000003;
  let form = composeForm(oozes), push = composePush(oozes, OOZES, s);
  if (S?.a) ({ form, push } = heighten(form, push, S.a));
  return { oozes, seed: s, form, ...(push && Object.keys(push).length ? { push } : {}), ...(S ? { stylism: S } : {}) };
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
  let push = mutagen?.push;
  if (mutagen?.stylism) {
    const D = spendDetail(mutagen.stylism, push, canWear(Q));
    push = D.push;
    report.notes = [registerNote(mutagen.stylism), ...D.notes];
  }
  return pushPlan(buildFauna(Q), push, Q, report);
}

// which ornaments a body can wear: a ring head takes horns and cheek spurs (a worn head mesh does not), a trunk a crest,
// shoulders and a neck their spikes and ruff, forelegs their spurs and bands, a tail its spikes and a tip
function canWear(Q) {
  const legs = (Q.legs || []).length > 0, tos = new Set((Q.legs || []).map((r) => r[2]));
  return { horns: !Q.headMesh && !!Q.craniumRows, cheeks: !Q.headMesh && !!Q.craniumRows, hackles: Array.isArray(Q.torso), shoulders: !!Q.joints?.shoulder,
    ruff: Q.neckRA !== undefined, spurs: legs && (Q.legs || []).some((r) => !tos.has(r[1])), bands: legs, tailSpikes: !!Q.tail, tipGlow: !!(Q.tail && Q.tip) };
}
