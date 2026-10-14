/**
 * THE RAIL, READ — one shape over every recipe kind that is built on a rail: what it is for (its outcomes), how far each
 * has come (its concerns, each in a state), what it is made of (its parts, each fresh or not) and where it is looked at
 * (its exits). The dashboard draws this and nothing else; the books stay the words.
 *
 * Each kind keeps its own table (structure/open.js, city/plan/read.js, gameworld/review.js, the solid ladder) and
 * registers an adapter here that reads it. Nothing is stored and no `next` changes: the rail reads what the readouts
 * already read.
 *
 *   readRail(manifest, { ref, row }) → { rail, kind, outcomes: [{ id, name, concerns }], parts, exits, errors? } | null
 *
 *   concern  { id, outcome, state, name?, tab?, card?, anchor?, gate?, note? }   (`anchor`: its id in the book)
 *     state  'given'    the recipe answers it
 *            'open'     nothing answers it yet: a field would
 *            'advised'  a law or a gate finds something
 *            'waived'   given only because the recipe waived what a law found
 *     gate   on a reviewed part, who settled it: 'eyes' (the creator approved it) or 'machine' (the agent decided it and
 *            its laws hold). Never conflated: a machine-settled part is never shown as approved.
 *   part     { ref, role, state, kind?, rail? }
 *     state  'fresh' (there, as made) · 'stale' (the book moved since) · 'edited' (changed by hand since) ·
 *            'missing' (not made yet) · 'waiting' (waits on another part) · 'taken' (something else is at its ref)
 *     rail   the part's own outcomes in brief, when it is on a rail: [{ id, given, open, advised, waived }]
 *   exit     { id: 'book' | 'walk' | 'play' | 'playtest', href }
 *
 * `row(ref)` is the store's read ({ kind, manifest } or null); it is how a part is found and read. Pure otherwise.
 */

export const CONCERN_STATES = Object.freeze(['given', 'open', 'advised', 'waived']);
export const PART_STATES = Object.freeze(['fresh', 'stale', 'edited', 'missing', 'waiting', 'taken']);

const RAILS = [];

/**
 * Register a rail: `id`, `test(manifest)` (is this recipe on it), `outcomes` ([{ id, name }] in order) and
 * `read(manifest, ctx)` → { concerns, parts?, exits?, outcomes? } (`outcomes` only when a recipe narrows them).
 */
export function registerRail(rail) {
  if (!rail || typeof rail.id !== 'string' || typeof rail.test !== 'function' || typeof rail.read !== 'function' || !Array.isArray(rail.outcomes)) {
    throw new Error('rail: { id, test, outcomes, read }');
  }
  const at = RAILS.findIndex((r) => r.id === rail.id);
  if (at >= 0) RAILS[at] = rail; else RAILS.push(rail);
  return rail;
}

/** The rail a recipe is on, or null. */
export function railFor(manifest) {
  if (!manifest || typeof manifest !== 'object') return null;
  return RAILS.find((r) => r.test(manifest)) ?? null;
}

export const railIds = () => RAILS.map((r) => r.id);

const enc = encodeURIComponent;
export const sketchHref = (ref, view) => `/api/sketches/${enc(ref)}/${view}`;

/** A part's outcomes in brief: per outcome, how many concerns sit in each state. */
function brief(outcomes) {
  return outcomes.map((o) => {
    const n = { id: o.id, given: 0, open: 0, advised: 0, waived: 0 };
    for (const c of o.concerns) n[c.state] += 1;
    return n;
  });
}

function group(outcomes, concerns) {
  const by = new Map(outcomes.map((o) => [o.id, { id: o.id, name: o.name, concerns: [] }]));
  for (const c of concerns) {
    if (!CONCERN_STATES.includes(c.state)) throw new Error(`rail: concern '${c.id}' is in state '${c.state}' (${CONCERN_STATES.join(', ')})`);
    const o = by.get(c.outcome);
    if (!o) throw new Error(`rail: concern '${c.id}' names outcome '${c.outcome}', which the rail does not have`);
    o.concerns.push(c);
  }
  return [...by.values()];
}

/**
 * The rail of a recipe, or null when it is on none. A part on a rail of its own carries its outcomes in brief (one
 * level deep: a part's parts are its own page's). A read that fails says so in `errors` rather than throwing, so a
 * broken recipe still shows what can be read of it.
 */
export function readRail(manifest, { ref = null, row = () => null, depth = 1 } = {}) {
  const rail = railFor(manifest);
  if (!rail) return null;
  const errors = [];
  let got;
  try { got = rail.read(manifest, { ref, row, errors }); } catch (err) { errors.push(err.message); got = { concerns: [] }; }
  const outcomes = group(got.outcomes ?? rail.outcomes, got.concerns ?? []);
  const parts = (got.parts ?? []).map((p) => {
    if (!PART_STATES.includes(p.state)) throw new Error(`rail: part '${p.ref}' is in state '${p.state}' (${PART_STATES.join(', ')})`);
    if (depth < 1 || p.state === 'missing' || p.state === 'taken') return p;
    const r = row(p.ref);
    const sub = r && readRail(r.manifest, { ref: p.ref, row, depth: depth - 1 });
    return { ...p, ...(r?.kind && !p.kind ? { kind: r.kind } : {}), ...(sub?.outcomes.length ? { rail: brief(sub.outcomes) } : {}) };
  });
  return {
    rail: rail.id,
    kind: manifest.kind,
    outcomes,
    parts,
    exits: got.exits ?? [],
    ...(got.parent ? { parent: got.parent } : {}),
    ...(errors.length ? { errors } : {}),
  };
}
