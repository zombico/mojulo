// The COMPOSITION LAW of oozes. An ooze spec is a word, or a list of words and `{ id, strength }` entries, read left
// to right. The layers run in a fixed order whatever the list order (form, then sites, surface and aura as they are
// built); within a layer the oozes apply left to right.
//
// FORM multiplies, the way a proportion cast composes (figure-cast.js `composeCast`): each ooze's multiplier raised to
// its strength, so strength 0 is identity, 1 the row, and two oozes at half strength meet one at full. The product is
// clamped: a creature grows at most threefold and halves at least, its girth within [0.3, 2.5]. A form never moves a
// joint except by uniform `scale`: the species' rig stays its own (legScale and the joint tables are not form keys).
import { OOZES } from './oozes/index.js';
import * as dmath from '../../util/dmath.js';

export const FORM_KEYS = Object.freeze(['scale', 'bulk', 'legBulk', 'tailBush', 'headScale']);
export const FORM_CLAMP = Object.freeze({ scale: [0.5, 3], headScale: [0.5, 3], bulk: [0.3, 2.5], legBulk: [0.3, 2.5], tailBush: [0.3, 2.5] });
const ENTRY_KEYS = ['id', 'strength'];
const say = () => `the oozes: ${Object.keys(OOZES).join(', ')}`;

/** Error strings for an ooze spec (empty = valid). The animal door refuses on a non-empty list. */
export function oozeErrors(spec, label = 'ooze') {
  if (spec === undefined || spec === null) return [];
  const list = typeof spec === 'string' || (spec && typeof spec === 'object' && !Array.isArray(spec)) ? [spec] : spec;
  if (!Array.isArray(list)) return [`${label}: a word, { id, strength }, or a list of them (${say()})`];
  const errs = [], seen = new Set();
  list.forEach((e, i) => {
    const at = Array.isArray(spec) ? `${label}[${i}]` : label;
    const o = typeof e === 'string' ? { id: e } : e;
    if (!o || typeof o !== 'object' || Array.isArray(o)) { errs.push(`${at}: a word or { id, strength }`); return; }
    const stray = Object.keys(o).filter((k) => !ENTRY_KEYS.includes(k));
    if (stray.length) errs.push(`${at}: an ooze entry takes ${ENTRY_KEYS.join(', ')} (not ${stray.join(', ')})`);
    if (!OOZES[o.id]) { errs.push(`${at}: unknown ooze ${JSON.stringify(o.id)} (${say()})`); return; }
    if (seen.has(o.id)) errs.push(`${at}: '${o.id}' is named twice; name it once, its strength says how much`);
    seen.add(o.id);
    if (o.strength !== undefined && !(Number.isFinite(o.strength) && o.strength >= 0 && o.strength <= 1)) errs.push(`${at}: strength is a number in [0, 1]`);
  });
  return errs;
}

/** A valid ooze spec → `[{ id, strength }]`, list order kept, the oozes at strength 0 dropped. Throws on an invalid one. */
export function normalizeOozes(spec) {
  const errs = oozeErrors(spec);
  if (errs.length) throw new Error(errs.join('; '));
  if (spec === undefined || spec === null) return [];
  const list = Array.isArray(spec) ? spec : [spec];
  return list.map((e) => (typeof e === 'string' ? { id: e, strength: 1 } : { id: e.id, strength: e.strength ?? 1 })).filter((e) => e.strength > 0);
}

const clamp = (k, v) => Math.min(FORM_CLAMP[k][1], Math.max(FORM_CLAMP[k][0], v));

/** Normalized oozes → the form multipliers they compose to, only the keys that move (`{}` when none does). */
export function composeForm(list, shelf = OOZES) {
  const m = {};
  for (const { id, strength } of list) {
    for (const [k, v] of Object.entries(shelf[id].form || {})) m[k] = (m[k] ?? 1) * dmath.pow(v, strength);   // dmath: the same bits on every engine
  }
  const out = {};
  for (const k of FORM_KEYS) if (m[k] !== undefined && m[k] !== 1) out[k] = clamp(k, m[k]);
  return out;
}
