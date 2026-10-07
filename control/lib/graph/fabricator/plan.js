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
import { placementOf, placeError } from './place.js';

export const FABRICATOR_VERSION = 'fabricator-v0.5.0';
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
    const at = placeError(n, i);
    if (at) return at;
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

/**
 * Where each library cutter goes, said once per module: which part takes it and from which face. Cutters run from
 * z = 0 DOWN into the material, so each is translated to the face it enters (and rotated for a side face).
 */
export const WHERE = Object.freeze({
  mj_heatset_hole: 'in the part the screw threads INTO, entering from the face the other part sits on; depth includes 2 mm past the screw tip',
  mj_tapped_hole: 'in the part the screw threads INTO, entering from the mating face; depth includes 2 mm past the screw tip',
  mj_counterbore: 'through the part the screw HEAD bears on, entering from its outer face; `depth` is the whole hole, the head recess is the screw head\'s height unless `head_depth` says otherwise',
  mj_countersink: 'through the part the countersunk head bears on, entering from its outer face',
  mj_clearance_hole: 'through every part the bolt passes without threading',
  mj_nut_trap: 'in the part the nut sits in, entering from the face away from the bolt head',
  mj_bearing_seat: 'one per bearing, in the housing, coaxial with the shaft and entering from the outer faces; the seat is the bearing\'s width deep, and `shoulder` stops the outer race while clearing the inner ring',
  mj_hole: 'a plain hole sized to the fit named in the call: "press" in the part that holds the piece, "slip" or "running" in the part that moves on it; a gland or vent hole goes through the wall',
  mj_oring_groove: 'in ONE of the two mating faces (the body\'s rim or the lid), the ring\'s inside ⌀ as named',
  mj_oring_gland: 'a function: [groove depth, groove width] for that cord; cut a groove of that section along the rim of ONE mating face, its centreline on the rim\'s middle',
  mj_nema_mount: 'through the plate the motor face bears on, the motor\'s shaft on the pilot',
  mj_d_bore: 'in the hub that turns with the shaft',
  mj_keyway_hub: 'in the hub, its keyway lined up with the shaft\'s',
  mj_circlip_groove: 'on the shaft, just outside the bearing or hub it keeps in place',
  mj_board_standoffs: 'on the floor the board sits over, the board\'s lower-left corner at the origin',
  mj_vesa: 'through the plate that meets the display or the arm',
  mj_enclosure: 'the box itself: a part of its own (`part = "base"` and `"lid"` as two `parts`)',
});
const moduleOf = (call) => (String(call).match(/^(mj_[a-z0-9_]+)/) || [])[1];

const toolLabel = (code) => { const t = code && toolOf(hardwarePart(code)); return t ? t.label : null; };

/**
 * `{ needs, host?, loadN?, cycles?, access?, tags? }` → `{ version, executors, needs: [{ id, function, executor,
 * strategy, route, why, … }], bom: [{ code, label, count, tool, buy, part, provenance, standard, for, executor }],
 * cuts: [{ need, part, route, call, count, where }], joints: [{ need, type, count }], kit, principles, notices, refused,
 * gaps, overlaps: [{ need, coveredBy, why }], suggestions: [{ from, function, …, why }] }`. A fastening need carries the
 * `assumes` its bolt lengths were cut to (`grip`: mm of material under the head); a need whose part was sized by
 * strength carries its `sizing` (./sizing.js: the size, the weakest mode, its safety factor and the one asked, the
 * load and whether it was assumed), and a bolt line its `grade` (the property class the check assumed). A plan whose
 * needs say where (`at`, `axis`, `parts`) carries `placement`: the cuts as an OpenSCAD block, and what is left by hand.
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
  const covered = [];
  const suggested = [];
  const needs = spec.needs.map((raw, i) => {
    const need = withDefaults(raw, spec);
    const id = typeof raw.id === 'string' && raw.id ? raw.id : `${need.function}-${i + 1}`;
    const count = raw.count ?? 1;
    const r = resolve(need);
    const executor = executorOf(r);
    // A fitting a frame joint places is counted by the frame (its fittings follow the contact's length), so the plan
    // names it per joint and leaves the count to the mint.
    const framed = executor === 'frames' && !!r.joint;
    for (const p of r.parts) {
      if (p.route === 'buy') {
        const key = `${p.part}|${p.code || ''}|${p.label}|${p.grade || ''}`;
        const line = bom.get(key) || { code: p.code, label: p.code ? hardwarePart(p.code)?.label || p.label : p.label, count: 0,
          tool: toolLabel(p.code), buy: p.buy, part: p.part, provenance: p.provenance, standard: p.standard, ...(p.grade ? { grade: p.grade } : {}), for: [], executor: [] };
        if (framed) { line.count = null; line.perJoint = p.qty; line.note = 'counted by the frame at mint: fittings per joint follow its length'; }
        else if (line.count !== null) line.count += p.qty * count;
        if (!line.for.includes(id)) line.for.push(id);
        if (!line.executor.includes(executor)) line.executor.push(executor);
        bom.set(key, line);
      } else if (executor === 'scad') {
        cuts.push({ need: id, part: p.part, route: p.route, call: p.call, count: p.qty * count, where: WHERE[moduleOf(p.call)] || null });
      }
    }
    if (framed) joints.push({ need: id, ...r.joint, count });
    // The library's kit is OpenSCAD; a wood need designed from scratch is carpentry, so it names no mj_ module.
    if (executor !== 'frames') for (const m of r.kit) kit.add(m);
    for (const f of r.covers) covered.push({ need: id, function: f });
    for (const sg of r.suggest) suggested.push({ from: id, ...sg });
    for (const n of r.notices) notices.add(n);
    if (r.principle) principles.push({ need: id, principle: r.principle });
    for (const x of r.refused) refused.push({ need: id, ...x });
    if (r.route === 'mint') gaps.push({ need: id, function: need.function, why: r.why });
    const assumes = need.function === 'fasten' && r.parts.some((p) => /-(socket|hex|button|csk)$/.test(p.code || ''))
      ? { grip: need.grip ?? 10, size: need.size || null } : undefined;
    return { id, function: need.function, count, executor, strategy: r.strategy, line: r.line, route: r.route, why: r.why, ...(assumes ? { assumes } : {}), ...(r.sizing ? { sizing: r.sizing } : {}) };
  });
  // A job one need's parts already do, listed again as its own need: say so, so nothing is bought twice.
  const overlaps = covered.flatMap((c) => needs.filter((n) => n.id !== c.need && n.function === c.function)
    .map((n) => ({ need: n.id, coveredBy: c.need, why: `${c.need}'s ${needs.find((x) => x.id === c.need).strategy} already does the ${c.function} job; drop '${n.id}' or keep it as the only one` })));
  // A suggested need is left out when the plan already has that job (the same function, and the same through / shaft).
  const has = (sg) => spec.needs.some((n) => n.function === sg.function && (n.through ?? null) === (sg.through ?? null)
    && (sg.shaftD === undefined || n.shaftD === sg.shaftD) && (sg.rim === undefined || Array.isArray(n.rim) || n.sealD !== undefined));
  // Where the needs say where (`at`, `axis`, `parts`), their scad cuts are written out as OpenSCAD (./place.js).
  const placement = placementOf(cuts, needs.map((n, i) => ({ id: n.id, strategy: n.strategy, raw: spec.needs[i] })));
  const suggestions = [...new Map(suggested.filter((sg) => !has(sg)).map((sg) => [JSON.stringify({ ...sg, from: undefined, why: undefined }), sg])).values()];
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
    overlaps,
    suggestions,
    ...(placement ? { placement } : {}),
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

const sizeKey = (s) => (s ? s.size ?? s.code ?? (s.frame != null ? `NEMA ${s.frame}` : s.module != null ? `module ${s.module}` : null) : null);
const lineKey = (l) => `${l.code || l.label}${l.grade ? ` (${l.grade})` : ''}`;

/**
 * What a re-plan changed against the plan stored before it: the version, each need's strategy and size, and the bill
 * of materials line by line. Empty lists when nothing moved.
 */
export function planChanges(before, after) {
  const was = new Map((before?.needs || []).map((n) => [n.id, n]));
  const now = new Map(after.needs.map((n) => [n.id, n]));
  const needs = [];
  for (const [id, n] of now) {
    const o = was.get(id);
    if (!o) needs.push({ need: id, added: n.strategy });
    else if (o.strategy !== n.strategy) needs.push({ need: id, from: o.strategy, to: n.strategy });
    else if (sizeKey(o.sizing) !== sizeKey(n.sizing)) needs.push({ need: id, size: { from: sizeKey(o.sizing) ?? 'by load class', to: sizeKey(n.sizing) } });
  }
  for (const [id, o] of was) if (!now.has(id)) needs.push({ need: id, removed: o.strategy });
  const count = (plan) => new Map((plan?.bom || []).map((l) => [lineKey(l), l.count]));
  const b0 = count(before); const b1 = count(after);
  const bom = [];
  for (const [k, c] of b1) if (!b0.has(k)) bom.push({ line: k, added: c }); else if (b0.get(k) !== c) bom.push({ line: k, from: b0.get(k), to: c });
  for (const [k, c] of b0) if (!b1.has(k)) bom.push({ line: k, removed: c });
  return { ...(before?.version !== after.version ? { version: { from: before?.version ?? null, to: after.version } } : {}), needs, bom };
}
