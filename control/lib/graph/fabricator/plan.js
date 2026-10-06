// fabricator/plan — a list of needs → who carries each one out, what to buy, and the cuts, joints and notices.
//
// What `fabricate_solid` hands the agent and stores beside the recipe. Each need is resolved on its own (./index.js)
// and given its EXECUTOR, the kind that already owns that material's joinery:
//   frames  a wood need whose strategy is a furniture joint (cam-lock, confirmat, dowel, hinge, slide …): a workbench
//           `frames` entry's joint code places and counts the fittings (../construction/furniture-joints.js);
//   scad    a need solved by `mj_*` cuts or printed parts, or designed from scratch off the library's kit: an
//           OpenSCAD source places them;
//   none    bought and fitted by hand (a T-nut, a gearmotor, foam tape), or from scratch with nothing to call.
// The bill of materials is one list in the furniture report's and the instruction manual's shape (`code`, `label`,
// `count`, plus `tool`, `buy`, `provenance`, `standard`, `for`). A line the frame will place is the plan's estimate:
// the frame's own report replaces it at mint. Deterministic: the same needs give the same plan, byte for byte.
import { FUNCTIONS, TAGS, resolve } from './index.js';
import { hardwarePart, toolOf } from '../construction/hardware.js';

export const FABRICATOR_VERSION = 'fabricator-v0.2.0';
export const EXECUTORS = Object.freeze(['frames', 'scad', 'none']);

const SHARED = ['host', 'loadN', 'cycles', 'access'];

/** Why a needs list cannot be planned, or null. */
export function needsError(needs) {
  if (!Array.isArray(needs) || !needs.length) return '`needs` must be a non-empty array of { function, … } — what each part of the object has to DO';
  const ids = new Set();
  for (const [i, n] of needs.entries()) {
    if (!n || typeof n !== 'object') return `needs[${i}] is not an object`;
    if (!FUNCTIONS[n.function]) return `needs[${i}].function '${n.function}' is not one of ${Object.keys(FUNCTIONS).join(', ')}`;
    if (n.count !== undefined && !(Number.isInteger(n.count) && n.count > 0)) return `needs[${i}].count must be a positive integer`;
    const bad = (n.tags || []).filter((t) => !TAGS[t]);
    if (bad.length) return `needs[${i}].tags: unknown ${bad.join(', ')} (one of ${Object.keys(TAGS).join(', ')})`;
    if (n.id !== undefined) { if (ids.has(n.id)) return `needs[${i}].id '${n.id}' is used twice`; ids.add(n.id); }
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

/** Who carries a resolution out. */
function executorOf(r) {
  const wood = r.capabilities.host === 'wood';
  if (wood && r.joint) return 'frames';
  if (r.parts.some((p) => p.route !== 'buy')) return 'scad';
  if (!r.parts.length) return wood ? 'frames' : r.kit.length ? 'scad' : 'none';
  return 'none';
}

const toolLabel = (code) => { const t = code && toolOf(hardwarePart(code)); return t ? t.label : null; };

/**
 * `{ needs, host?, loadN?, cycles?, access?, tags? }` → `{ version, executors, needs: [{ id, function, executor,
 * strategy, route, why, … }], bom: [{ code, label, count, tool, buy, part, provenance, standard, for, executor }],
 * cuts: [{ need, part, route, call, count }], joints: [{ need, type, count }], kit, principles, notices, refused, gaps }`.
 * Throws on a malformed needs list (needsError).
 */
export function fabricationPlan(spec) {
  const err = needsError(spec && spec.needs);
  if (err) throw new Error(err);
  const bom = new Map();
  const cuts = [];
  const joints = [];
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
    const executor = executorOf(r);
    for (const p of r.parts) {
      if (p.route === 'buy') {
        const key = `${p.part}|${p.code || ''}`;
        const line = bom.get(key) || { code: p.code, label: p.code ? hardwarePart(p.code)?.label || p.label : p.label, count: 0,
          tool: toolLabel(p.code), buy: p.buy, part: p.part, provenance: p.provenance, standard: p.standard, for: [], executor: [] };
        line.count += p.qty * count;
        if (!line.for.includes(id)) line.for.push(id);
        if (!line.executor.includes(executor)) line.executor.push(executor);
        bom.set(key, line);
      } else if (executor === 'scad') {
        cuts.push({ need: id, part: p.part, route: p.route, call: p.call, count: p.qty * count });
      }
    }
    if (executor === 'frames' && r.joint) joints.push({ need: id, ...r.joint, count });
    for (const m of r.kit) kit.add(m);
    for (const n of r.notices) notices.add(n);
    if (r.principle) principles.push({ need: id, principle: r.principle });
    for (const x of r.refused) refused.push({ need: id, ...x });
    if (r.route === 'mint') gaps.push({ need: id, function: need.function, why: r.why });
    return { id, function: need.function, count, executor, strategy: r.strategy, line: r.line, route: r.route, why: r.why };
  });
  return {
    version: FABRICATOR_VERSION,
    executors: EXECUTORS.filter((e) => e !== 'none' && needs.some((n) => n.executor === e)),
    needs,
    bom: [...bom.values()].sort((a, b) => a.part.localeCompare(b.part) || String(a.code).localeCompare(String(b.code))),
    cuts,
    joints,
    kit: [...kit].sort(),
    principles,
    notices: [...notices],
    refused,
    gaps,
  };
}

/** The `mj_*` modules a plan asks a scad source to call (its cuts and printed parts). */
export function planModules(plan) {
  return [...new Set(plan.cuts.map((c) => (c.call.match(/^(mj_[a-z0-9_]+)/) || [])[1]).filter(Boolean))].sort();
}

/** Plan modules a scad source never calls: advisory, so a skipped cut is said, never refused. */
export function unplacedModules(plan, source) {
  return planModules(plan).filter((m) => !new RegExp(`(^|[^A-Za-z0-9_])${m}\\s*\\(`).test(source));
}

/** Planned frame joint types a minted frame never made (read off its own joint report): advisory too. */
export function unplacedJoints(plan, frameStats) {
  const made = new Set((frameStats || []).flatMap((f) => (f.joints || []).map((j) => j.type)));
  return [...new Set(plan.joints.map((j) => j.type))].filter((t) => !made.has(t)).sort();
}

/**
 * The bill of materials after a frames mint: the frames' own hardware lists (what the joints actually placed and
 * counted) in place of the plan's estimate for frame-placed lines, then every other planned line.
 */
export function mintedBom(plan, frameStats) {
  const placed = new Map();
  for (const f of frameStats || []) for (const h of f.furniture?.hardware || []) {
    const line = placed.get(h.code) || { code: h.code, label: h.label, count: 0, tool: toolLabel(h.code), from: 'frames' };
    line.count += h.count;
    placed.set(h.code, line);
  }
  const rest = plan.bom.filter((l) => !(l.executor.length === 1 && l.executor[0] === 'frames'));
  return [...[...placed.values()].sort((a, b) => (a.code < b.code ? -1 : 1)), ...rest.map((l) => ({ ...l, from: 'plan' }))];
}
