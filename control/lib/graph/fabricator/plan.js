// fabricator/plan — a list of needs → the shopping list, the cuts and the notices for one object.
//
// What `mint_solid({ kind: 'scad', via: 'fabricate' })` hands the agent and stores beside the source. Each need is
// resolved on its own (./index.js); the plan then gathers what is BOUGHT into one bill of materials (the same part and
// code summed across needs), keeps what is FITTED or PRINTED as the `mj_*` calls the source should place, and carries
// every notice once. Deterministic: the same needs give the same plan, byte for byte.
import { FUNCTIONS, TAGS, resolve } from './index.js';
import { INVENTORY } from './inventory.js';

export const FABRICATOR_VERSION = 'fabricator-v0.1.0';

const SHARED = ['host', 'loadN', 'cycles', 'access'];

/** Why a needs list cannot be planned, or null. */
export function needsError(needs) {
  if (!Array.isArray(needs) || !needs.length) return '`needs` must be a non-empty array of { function, … } — what each part of the object has to DO';
  for (const [i, n] of needs.entries()) {
    if (!n || typeof n !== 'object') return `needs[${i}] is not an object`;
    if (!FUNCTIONS[n.function]) return `needs[${i}].function '${n.function}' is not one of ${Object.keys(FUNCTIONS).join(', ')}`;
    if (n.count !== undefined && !(Number.isInteger(n.count) && n.count > 0)) return `needs[${i}].count must be a positive integer`;
    const bad = (n.tags || []).filter((t) => !TAGS[t]);
    if (bad.length) return `needs[${i}].tags: unknown ${bad.join(', ')} (one of ${Object.keys(TAGS).join(', ')})`;
  }
  return null;
}

/** Spread the spec-level defaults (`host`, `loadN`, `cycles`, `access`, `tags`) under each need; a need's own wins. */
function withDefaults(need, spec) {
  const out = { ...need };
  for (const k of SHARED) if (out[k] === undefined && spec[k] !== undefined) out[k] = spec[k];
  const tags = [...new Set([...(spec.tags || []), ...(need.tags || [])])];
  if (tags.length) out.tags = tags;
  return out;
}

/**
 * `{ needs, host?, loadN?, cycles?, access?, tags? }` → `{ version, needs: [{ id, function, strategy, route, why, … }],
 * bom: [{ part, label, code, buy, qty, provenance, standard }], cuts: [{ need, part, route, call }], kit, principles,
 * notices, refused, gaps }`. Throws on a malformed needs list (needsError).
 */
export function fabricationPlan(spec) {
  const err = needsError(spec && spec.needs);
  if (err) throw new Error(err);
  const bom = new Map();
  const cuts = [];
  const kit = new Set();
  const notices = new Set();
  const principles = [];
  const refused = [];
  const gaps = [];
  const needs = spec.needs.map((raw, i) => {
    const need = withDefaults(raw, spec);
    const id = typeof raw.id === 'string' && raw.id ? raw.id : `${need.function}-${i + 1}`;
    const count = raw.count ?? 1;
    const r = resolve(need);
    for (const p of r.parts) {
      if (p.route === 'buy') {
        const key = `${p.part}|${p.code || ''}`;
        const row = bom.get(key) || { part: p.part, label: p.label, code: p.code, buy: p.buy, qty: 0, provenance: p.provenance, standard: p.standard, for: [] };
        row.qty += p.qty * count;
        if (!row.for.includes(id)) row.for.push(id);
        bom.set(key, row);
      } else {
        cuts.push({ need: id, part: p.part, route: p.route, call: p.call, qty: p.qty * count });
      }
    }
    for (const m of r.kit) kit.add(m);
    for (const n of r.notices) notices.add(n);
    if (r.principle) principles.push({ need: id, principle: r.principle });
    for (const x of r.refused) refused.push({ need: id, ...x });
    if (r.route === 'mint') gaps.push({ need: id, function: need.function, why: r.why });
    return { id, function: need.function, count, strategy: r.strategy, line: r.line, route: r.route, why: r.why };
  });
  return {
    version: FABRICATOR_VERSION,
    needs,
    bom: [...bom.values()].sort((a, b) => a.part.localeCompare(b.part) || String(a.code).localeCompare(String(b.code))),
    cuts,
    kit: [...kit].sort(),
    principles,
    notices: [...notices],
    refused,
    gaps,
  };
}

/** The `mj_*` modules a plan asks the source to call (its cuts and printed parts). */
export function planModules(plan) {
  return [...new Set(plan.cuts.map((c) => (c.call.match(/^(mj_[a-z0-9_]+)/) || [])[1]).filter(Boolean))].sort();
}

/** Plan modules the source never calls: advisory, so a skipped cut is said, never refused. */
export function unplacedModules(plan, source) {
  return planModules(plan).filter((m) => !new RegExp(`(^|[^A-Za-z0-9_])${m}\\s*\\(`).test(source));
}

export { INVENTORY };
