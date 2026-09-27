/** ratio-controls.js — ONE resolver for a set of RELATIVE controls: ratios about 1 applied to some baseline, the contract
 * the body and face proportion labs established and hero-form (the body tune) and humanoid-head (the face) both speak.
 *
 * `ratioControls({ label, groups, aggregates, moves, ranges })` returns the vocabulary and three functions:
 *   - KEYS (every control, in group order), GROUPS, AGGREGATES (a group word → its keys, plus any extra word), DEFAULT
 *     (every key at 1), RANGES (advisory), MOVES, MOVE_NAMES;
 *   - `resolve(spec)`: a MOVE word, an object of keys or group words, or an array of either, composed left → right by
 *     PRODUCT (so a move and then "a little more" is more, not a replacement); a group word expands first so an explicit
 *     key in the same object wins (figure-cast's aggregate rule); a unit ratio is an exact no-op; the result carries
 *     `from` when a move named it. Stored resolved: a later re-tuning of a move never changes a stored row's meaning.
 *   - `validate(spec, label)`: error strings — an unknown control, an unknown move, a ratio that is not a positive number;
 *   - `warnings(resolved)`: the keys outside their comfortable range, one advisory line each. Nothing refuses on taste
 *     (docs/bicycles.md): a range is where the lab stopped, not a wall. */
import { r6 } from './station-loft-plan.js';

export function ratioControls({ label, groups, aggregates = {}, moves = {}, ranges = {}, zero = [] }) {
  // `zero`: controls that may go to 0 (an amount that can be switched off: asymmetry, a hairline's squareness); every
  // other control is a ratio and must stay positive
  const zeroable = new Set(zero);
  const GROUPS = Object.freeze(Object.fromEntries(Object.entries(groups).map(([g, keys]) => [g, Object.freeze([...keys])])));
  const KEYS = Object.freeze(Object.values(GROUPS).flat());
  const AGGREGATES = Object.freeze({ ...Object.fromEntries(Object.entries(GROUPS).filter(([, keys]) => keys.length > 1)), ...aggregates });
  const AGGREGATE_KEYS = Object.freeze(Object.keys(AGGREGATES));
  const DEFAULT = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, 1])));
  const RANGES = Object.freeze(Object.fromEntries(KEYS.map((k) => [k, ranges[k] ?? [0.8, 1.25]])));
  const MOVES = Object.freeze(moves);
  const MOVE_NAMES = Object.freeze(Object.keys(MOVES));
  const known = new Set([...KEYS, ...AGGREGATE_KEYS, 'from']);
  const moveOf = (name) => MOVES[name]?.tune ?? MOVES[name]?.face ?? MOVES[name]?.ratios;

  function resolve(spec) {
    const out = { ...DEFAULT };
    if (spec === undefined || spec === null) return out;
    let from = null;
    for (const entry of (Array.isArray(spec) ? spec : [spec])) {
      if (entry === undefined || entry === null) continue;
      let ratios;
      if (typeof entry === 'string') {
        if (!MOVES[entry]) throw new Error(`${label}: unknown move '${entry}' (have ${MOVE_NAMES.join(', ')})`);
        ratios = moveOf(entry); from = from ? `${from}+${entry}` : entry;
      } else if (typeof entry === 'object') {
        const { from: entryFrom, ...rest } = entry; ratios = rest;
        if (typeof entryFrom === 'string') from = from ? `${from}+${entryFrom}` : entryFrom;
      } else throw new Error(`${label}: an entry must be a move name or a ratio object`);
      const step = {};
      for (const [group, keys] of Object.entries(AGGREGATES)) if (ratios[group] !== undefined) for (const k of keys) step[k] = ratios[group];
      for (const k of KEYS) if (ratios[k] !== undefined) step[k] = ratios[k];
      for (const [k, v] of Object.entries(step)) out[k] = v === 1 ? out[k] : r6(out[k] * v);
    }
    return from ? { ...out, from } : out;
  }

  function validate(spec, at = label) {
    if (spec === undefined || spec === null) return [];
    if (Array.isArray(spec)) return spec.flatMap((e, i) => validate(e, `${at}[${i}]`));
    if (typeof spec === 'string') return MOVES[spec] ? [] : [`${at}: unknown move '${spec}' (have ${MOVE_NAMES.join(', ')})`];
    if (typeof spec !== 'object') return [`${at}: must be a move name, a ratio object, or an array of either`];
    const errs = [];
    for (const [k, v] of Object.entries(spec)) {
      if (!known.has(k)) { errs.push(`${at}.${k}: unknown control (have ${[...KEYS, ...AGGREGATE_KEYS].join(', ')}; moves: ${MOVE_NAMES.join(', ')})`); continue; }
      if (k === 'from') { if (typeof v !== 'string') errs.push(`${at}.from: must be a string`); continue; }
      if (typeof v !== 'number' || !Number.isFinite(v) || (zeroable.has(k) ? v < 0 : v <= 0)) errs.push(`${at}.${k}: must be a finite number ${zeroable.has(k) ? '>= 0 (0 switches it off; 1 = as is)' : '> 0 (a ratio to the baseline; 1 = as is)'}`);
    }
    return errs;
  }

  function warnings(resolved) {
    const out = [];
    for (const k of KEYS) {
      const v = resolved?.[k]; if (v === undefined) continue;
      const [lo, hi] = RANGES[k];
      if (v < lo || v > hi) out.push(`${label}.${k} ${v} is outside the comfortable range [${lo}, ${hi}]: the figure still closes, but the read past this is the operator's call`);
    }
    return out;
  }

  /** the keys that moved, as percentages, the move trail first: the frame note's clause and the readout's `moved` */
  const describe = (resolved) => {
    const moved = KEYS.filter((k) => resolved[k] !== 1).map((k) => `${k} ${Math.round(resolved[k] * 100)}%`);
    return moved.length ? `${label} ${resolved.from ? `${resolved.from}: ` : ''}${moved.join(', ')}` : '';
  };

  return { label, KEYS, GROUPS, AGGREGATES, AGGREGATE_KEYS, DEFAULT, RANGES, MOVES, MOVE_NAMES, resolve, validate, warnings, describe };
}
