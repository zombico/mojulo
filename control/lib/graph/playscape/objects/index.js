/**
 * playscape objects — game objects as ARCHETYPES that transform to the world they stand in.
 *
 *   resolveObject({ archetype, setting, fit | anchor, state, form?, params? }) → { archetype, form, params, faces,
 *                                                                               interest, fit: setting readout }
 *   ejectObject(resolved) → a frozen recipe: the form and every number named, no longer following the world
 *
 * The shared matrix: the world's SETTING picks the form (the first whose tags fit; none fitting, the nearest, stamped
 * with what it misses: a game object is never refused), the FIT (a doorway's width and height) sizes it, the STATE
 * poses it, and a tone colours its values. An ejected object carries `params`, so it builds the same whatever world
 * it is later set in; edit its numbers like any recipe's.
 */
import { fitSetting } from '../setting.js';
import { DOOR } from './door.js';

export const ARCHETYPES = Object.freeze({ door: DOOR });
export const ARCHETYPE_IDS = Object.freeze(Object.keys(ARCHETYPES));

/** The form a setting picks for an archetype: the first that fits, else the nearest (fewest misses), stamped. */
export function pickForm(A, setting = {}) {
  const ranked = Object.entries(A.forms).map(([id, f], i) => ({ id, i, ...fitSetting(f.setting, setting) }))
    .sort((a, b) => a.misses.length - b.misses.length || a.i - b.i);
  const best = ranked[0];
  return { form: best.id, fits: best.fits, misses: best.misses };
}

const DEFAULT_FRAME = { at: [0, 0, 0], N: [0, -1, 0], U: [1, 0, 0] };

export function resolveObject({ archetype, setting = {}, fit, anchor, state = 'closed', form, params, cell } = {}) {
  const A = ARCHETYPES[archetype];
  if (!A) throw new Error(`playscape: unknown archetype '${archetype}' (known: ${ARCHETYPE_IDS.join(', ')})`);
  if (!A.states.includes(state)) throw new Error(`playscape: a ${archetype} has no state '${state}' (states: ${A.states.join(', ')})`);
  const F = { ...(anchor ? A.frame(anchor) : { ...DEFAULT_FRAME, fit }), ...(cell ? { cell } : {}) };   // a shape style subdivides
  if (!F.fit && !params) throw new Error(`playscape: a ${archetype} needs a fit ({ width, height }), an anchor or ejected params`);
  const chosen = form ? { form, fits: true, misses: [], named: true } : pickForm(A, setting);
  const Form = A.forms[chosen.form];
  if (!Form) throw new Error(`playscape: a ${archetype} has no form '${chosen.form}' (forms: ${Object.keys(A.forms).join(', ')})`);
  const P = params || Form.params(F.fit);
  const faces = [];
  Form.build(faces, F, P, state);
  return {
    archetype, form: chosen.form, state, params: P, faces, interest: A.interest, frame: { at: F.at, N: F.N, U: F.U },
    fit: { fits: chosen.fits, misses: chosen.misses, ...(chosen.named ? { named: true } : {}) },
  };
}

/** Freeze a resolved object: the form and its numbers, so it no longer transforms with the world. */
export function ejectObject(o) {
  return { kind: 'game-object', archetype: o.archetype, form: o.form, state: o.state, params: structuredClone(o.params), ejected: true };
}
