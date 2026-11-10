/**
 * PASSES — how a piece of lore is made, in two kinds that never do each other's work:
 *
 *   raw-new     makes a part where there was none: its PREMISE and nothing under it. It commits to what the thing is
 *               (which elements, in what shape) and stops. However much is asked, a raw-new pass ends at the last rung
 *               marked `rawNew`: depth is not its to add
 *   intensify   takes a part that exists and adds the next rung, or several: the reasons, the numbers, the kit. It
 *               never changes a rung below the ones it adds: the premise it was handed is locked
 *
 * So the first pass is cheap and the person's, and everything after is the same move repeated, by whoever holds the
 * part then (the brief's author again, or the game side). A raw-new pass that reasons, numbers and lowers in one go is
 * the failure this file exists to name.
 *
 * A PART (a polarity today; a reserve and a holder next) says its ladder:
 *
 *   definePart({ id, rungs: [{ id, rawNew?, holds(v) → bool, open?(v) → [what is missing], view?(v) → what this rung
 *                locks, compared before and after an intensification }] })
 *       rungs in order, the first the premise; `rawNew` rungs come first and at least the first is one
 *   depthOf(part, v)          → how many rungs v holds from the bottom, each standing on the one before (0: not a part)
 *   rungOf(part, v)           → the id of the highest rung held, or null
 *   openOf(part, v)           → { rung, missing: [...] } for the next rung up, or null at the top
 *   rawNewCeiling(part)       → the depth a raw-new pass may reach
 *   checkPass(part, kind, before, after) → [{ law, ok, says? }]
 *       raw-new:    `from-nothing` (before is absent), `made` (after holds the premise), `ceiling` (after is no deeper
 *                   than the ceiling: what it added past it is an intensification's)
 *       intensify:  `from-something` (before holds the premise), `deeper` (after is deeper), `locked` (every rung
 *                   before held reads the same after)
 *   Advice, as every law here: a pass is never refused, it is told.
 *
 * Pure.
 */
export const PASS_KINDS = Object.freeze(['raw-new', 'intensify']);

const fail = (m) => new Error(`lorecube: ${m}`);

export function definePart({ id, rungs }) {
  if (typeof id !== 'string' || !id) throw fail('a part has an id');
  if (!Array.isArray(rungs) || !rungs.length) throw fail(`part '${id}' has rungs, the first its premise`);
  const ids = rungs.map((r) => r.id);
  if (new Set(ids).size !== ids.length || ids.some((x) => typeof x !== 'string' || !x)) throw fail(`part '${id}': each rung has its own id`);
  for (const r of rungs) if (typeof r.holds !== 'function') throw fail(`part '${id}' rung '${r.id}' says how it is held (holds)`);
  if (!rungs[0].rawNew) throw fail(`part '${id}': its first rung is the premise, a raw-new pass's to make`);
  const last = rungs.map((r) => !!r.rawNew).lastIndexOf(true);
  if (rungs.slice(0, last + 1).some((r) => !r.rawNew)) throw fail(`part '${id}': the rungs a raw-new pass may make come first, with none between them that it may not`);
  return Object.freeze({ id, rungs: Object.freeze(rungs.map((r) => Object.freeze({ ...r }))), ceiling: last + 1 });
}

export function depthOf(part, v) {
  if (v == null) return 0;
  let d = 0;
  for (const r of part.rungs) { if (!r.holds(v)) break; d++; }
  return d;
}

export const rungOf = (part, v) => { const d = depthOf(part, v); return d ? part.rungs[d - 1].id : null; };

export function openOf(part, v) {
  const d = depthOf(part, v), next = part.rungs[d];
  return next ? { rung: next.id, missing: next.open ? next.open(v) : [] } : null;
}

export const rawNewCeiling = (part) => part.ceiling;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function checkPass(part, kind, before, after) {
  if (!PASS_KINDS.includes(kind)) throw fail(`a pass is ${PASS_KINDS.join(' | ')}, not '${kind}'`);
  const was = depthOf(part, before), is = depthOf(part, after), name = (d) => (d ? part.rungs[d - 1].id : 'nothing');
  if (kind === 'raw-new') {
    return [
      { law: 'from-nothing', ok: was === 0, ...(was ? { says: `a raw-new pass starts from nothing; this ${part.id} already holds its ${name(was)}: intensify it` } : {}) },
      { law: 'made', ok: is >= 1, ...(is ? {} : { says: `the pass made no ${part.id}: its ${part.rungs[0].id} is missing` }) },
      { law: 'ceiling', ok: is <= part.ceiling, ...(is > part.ceiling ? { says: `a raw-new pass ends at the ${name(part.ceiling)}; this one went on to the ${name(is)}: that is an intensification's` } : {}) },
    ];
  }
  const moved = part.rungs.slice(0, was).filter((r) => !same((r.view ?? ((x) => x))(before), (r.view ?? ((x) => x))(after))).map((r) => r.id);
  return [
    { law: 'from-something', ok: was >= 1, ...(was ? {} : { says: `an intensification needs a ${part.id} to deepen: make one first (raw-new)` }) },
    { law: 'deeper', ok: is > was, ...(is > was ? {} : { says: `the pass left the ${part.id} at its ${name(was)}` }) },
    { law: 'locked', ok: moved.length === 0, ...(moved.length ? { says: `an intensification adds rungs and changes none below them; this one changed the ${moved.join(', ')}` } : {}) },
  ];
}
