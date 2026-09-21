/**
 * workbench-cuts — a boolean between NAMED monomers, lowered to a `fields` monomer
 * (parts-booleans.plan.md B1).
 *
 * The surface monomers (`lathes` / `extrudes` / `sweeps` / …) are direct meshers with no
 * half-edge mesh to boolean on; only a `fields` entry can take material away. Until now a
 * modeler who composed a flange as a lathe and a bolt circle as sweeps had to REWRITE both as
 * one field term list to bore the holes. A `cuts` entry does that rewrite for them:
 *
 *   cuts: [ { id?: 'bolts', from: 'flange', subtract: ['bore', 'bolt1', 'bolt2'], cells?: 64, blend?: 0 },
 *           { from: 'lid', intersect: ['envelope'] } ]
 *
 * `from` and every operand name a monomer by `id` (an optional field on any monomer). Each
 * named lathe / solid extrude / sweep / field is TAKEN OUT of its array and re-expressed as its
 * field twin (field-terms.js: `lathe` / `extrude` / `sweep` shapes take the monomer's own
 * params; a field nests as a `transform` sub-solid), and ONE `fields` entry is emitted —
 * `add` the body, then `subtract` / `intersect` each operand — keeping the body's tint and
 * material. The emitted field's `id` is the cut's (default `cut:<from>`), so a later cut can
 * consume it (a cut of a cut). Every operand's faces carry `group: <operand id>`.
 *
 * D0 (the plan's decision): a recipe boolean is a FIELD boolean. A kernel must regenerate
 * byte-identical from the recipe alone; Manifold is an optional dependency, so it stays the
 * export's business (`export_model union:true`). The one ceiling — every cut edge rounds to
 * about one grid cell — is the field solid's, said on the card and in `stats.cuts`.
 *
 * This is a RENDER-TIME seam: the recipe stores the monomers and the cut, never the rewrite.
 * `lowerCuts` runs in front of every consumer (lowerObjectFaces, planWorkbench, the wrap
 * collector, the export ledger). Absent `cuts`, it returns the manifest BY IDENTITY, so every
 * existing workbench re-renders byte-for-byte.
 *
 * Refused by name (no field twin, or the cut would lose what the monomer is for): lofts,
 * shells, drapes, reliefs, a shelled (`wallThickness`) or tapered (`endProfile`) extrude, a
 * wrapped lathe / extrude (the label needs its surface), an unknown or duplicate id, an operand
 * used twice, an operand that is its own body.
 *
 * Pure: no DB, no three.js, no polygonizing here.
 */

import { DEFAULT_CELLS, MIN_FIELD_CELLS, MAX_FIELD_CELLS } from './field-faces.js';

/** Monomer array key → the kind name a cut operand is described as. */
export const MONOMER_KIND_OF_KEY = Object.freeze({
  lathes: 'lathe', extrudes: 'extrude', sweeps: 'sweep', lofts: 'loft', fields: 'field', drapes: 'drape', reliefs: 'relief', shells: 'shell',
});
const KEYS = Object.keys(MONOMER_KIND_OF_KEY);
/** Kinds a cut can reach — the ones with a field twin. */
export const CUTTABLE_KINDS = Object.freeze(['lathe', 'extrude', 'sweep', 'field']);
const OPS = ['subtract', 'intersect'];

const isId = (v) => typeof v === 'string' && v.length > 0;

/** True when the manifest carries a non-empty `cuts` list. */
export function hasCuts(manifest) {
  return !!manifest && typeof manifest === 'object' && Array.isArray(manifest.cuts) && manifest.cuts.length > 0;
}

/** The monomer `id` registry: id → { kind, key, index, spec }. Throws on a duplicate id. */
function registry(manifest) {
  const byId = new Map();
  for (const key of KEYS) {
    const arr = Array.isArray(manifest[key]) ? manifest[key] : [];
    arr.forEach((spec, index) => {
      if (!spec || typeof spec !== 'object' || !isId(spec.id)) return;
      const prior = byId.get(spec.id);
      if (prior) throw new Error(`monomer id '${spec.id}' is used twice (${prior.key}[${prior.index}] and ${key}[${index}]) — a cut names parts by id, so each id must be unique`);
      byId.set(spec.id, { kind: MONOMER_KIND_OF_KEY[key], key, index, spec });
    });
  }
  return byId;
}

/** Why this monomer cannot be cut, or null when it can. */
function uncuttable(entry) {
  const { kind, spec } = entry;
  if (!CUTTABLE_KINDS.includes(kind)) return `a ${kind} has no field twin — cuts reach lathes, solid extrudes, sweeps and fields`;
  if (kind === 'extrude') {
    if (Number.isFinite(spec.wallThickness) && spec.wallThickness > 0) return 'a shelled extrude (`wallThickness`) has no field twin — cut the solid prism, then hollow it with a `shell` term, or author it as a `fields` monomer';
    if (spec.endProfile !== undefined) return 'a tapered extrude (`endProfile`) has no field twin — author it as a `fields` monomer';
  }
  if ((kind === 'lathe' || kind === 'extrude') && spec.wrap && typeof spec.wrap === 'object') return 'a wrapped monomer cannot be cut — the label needs its surface';
  return null;
}

/** A monomer entry → its field term (`op` add | subtract | intersect), tagged with the operand's id. */
function fieldTerm(entry, op, blend) {
  const { kind, spec } = entry;
  const withBlend = (t) => (Number.isFinite(blend) && blend > 0 && op !== 'add' ? { ...t, blend } : t);
  switch (kind) {
    case 'lathe':
      return withBlend({ id: spec.id, op, shape: { kind: 'lathe', axisFrom: spec.axisFrom, axisTo: spec.axisTo, profile: spec.profile, ...(Array.isArray(spec.harmonics) ? { harmonics: spec.harmonics } : {}) } });
    case 'extrude':
      return withBlend({ id: spec.id, op, shape: { kind: 'extrude', profile: spec.profile, axisFrom: spec.axisFrom, axisTo: spec.axisTo } });
    case 'sweep':
      return withBlend({ id: spec.id, op, shape: { kind: 'sweep', path: spec.path, radius: spec.radius } });
    case 'field': {
      // a field nests as a `transform` sub-solid (its own translate, else the identity); its inner
      // term ids stay the groups, exactly as they were when it stood alone
      const t = { op: 'transform', translate: Array.isArray(spec.translate) ? spec.translate : [0, 0, 0], terms: spec.terms };
      return withBlend(op === 'add' ? t : { ...t, combine: op });
    }
    default:
      throw new Error(`no field twin for kind '${kind}'`);
  }
}

/**
 * validateCuts(manifest) → error strings (empty = valid). Non-throwing; the mint gate joins
 * these with the monomer validators' so a bad cut is a clear 400 naming the id.
 */
export function validateCuts(manifest) {
  const cuts = manifest && manifest.cuts;
  if (cuts === undefined) return [];
  if (!Array.isArray(cuts)) return ['cuts: must be an array of { from, subtract | intersect: [ids] }'];
  if (!cuts.length) return [];
  try {
    lowerCuts(manifest);
    return [];
  } catch (err) {
    return [err.message];
  }
}

/**
 * lowerCuts(manifest) → the manifest with every cut lowered: the named monomers removed from
 * their arrays and one `fields` entry per cut appended (cut order). Absent `cuts`, returns
 * `manifest` itself. Throws with the cut's index and the id at fault.
 */
export function lowerCuts(manifest) {
  if (!hasCuts(manifest)) return manifest;
  const cuts = manifest.cuts;
  const byId = registry(manifest);
  const consumed = new Set();            // entry objects taken into a cut
  const emitted = [];                    // { entry } in cut order (an emitted field may itself be consumed later)

  cuts.forEach((cut, i) => {
    const at = `cuts[${i}]`;
    if (!cut || typeof cut !== 'object') throw new Error(`${at}: must be an object { from, subtract | intersect: [ids] }`);
    if (!isId(cut.from)) throw new Error(`${at}.from: must name a monomer by its \`id\``);
    const ops = OPS.filter((k) => cut[k] !== undefined);
    if (ops.length !== 1) throw new Error(`${at}: give exactly one of \`subtract\` / \`intersect\` (a non-empty list of monomer ids)`);
    const op = ops[0];
    const operandIds = cut[op];
    if (!Array.isArray(operandIds) || !operandIds.length || !operandIds.every(isId)) throw new Error(`${at}.${op}: must be a non-empty array of monomer ids`);
    if (cut.id !== undefined && !isId(cut.id)) throw new Error(`${at}.id: must be a non-empty string when provided`);
    if (cut.cells !== undefined && !(Number.isInteger(cut.cells) && cut.cells >= MIN_FIELD_CELLS && cut.cells <= MAX_FIELD_CELLS)) throw new Error(`${at}.cells: must be an integer in [${MIN_FIELD_CELLS}, ${MAX_FIELD_CELLS}] when provided (grid cells along the cut part's longest side; every cut edge rounds to about one cell)`);
    if (cut.blend !== undefined && !(Number.isFinite(cut.blend) && cut.blend >= 0)) throw new Error(`${at}.blend: must be a non-negative number when provided`);
    if (cut.exact !== undefined && typeof cut.exact !== 'boolean') throw new Error(`${at}.exact: must be true or false when provided`);
    if (cut.exact === true && Number.isFinite(cut.blend) && cut.blend > 0) throw new Error(`${at}.exact: an exact cut has no blended rim — drop \`blend\` or drop \`exact\``);
    const cutId = isId(cut.id) ? cut.id : `cut:${cut.from}`;
    if (byId.has(cutId)) throw new Error(`${at}.id '${cutId}': already names a monomer — give the cut its own id`);

    const resolve = (id, role) => {
      const entry = byId.get(id);
      if (!entry) throw new Error(`${at}.${role} '${id}': no monomer carries that \`id\` (known: ${[...byId.keys()].join(', ') || 'none'})`);
      if (consumed.has(entry)) throw new Error(`${at}.${role} '${id}': already consumed by an earlier cut — a monomer joins one cut; cut the cut's own id instead`);
      const why = uncuttable(entry);
      if (why) throw new Error(`${at}.${role} '${id}': ${why}`);
      return entry;
    };
    const body = resolve(cut.from, 'from');
    const seen = new Set();
    const operands = operandIds.map((id) => {
      if (id === cut.from) throw new Error(`${at}.${op} '${id}': an operand cannot be its own body`);
      if (seen.has(id)) throw new Error(`${at}.${op} '${id}': listed twice`);
      seen.add(id);
      return resolve(id, op);
    });

    const from = body.spec;
    const spec = {
      id: cutId,
      cells: Number.isInteger(cut.cells) ? cut.cells : DEFAULT_CELLS,
      // parts-booleans + field-exact: an exact cut composes the same terms with Manifold
      ...(cut.exact === true ? { exact: true, ...(Number.isInteger(cut.segments) ? { segments: cut.segments } : {}) } : {}),
      terms: [fieldTerm(body, 'add'), ...operands.map((o) => fieldTerm(o, op, cut.blend))],
      ...(from.tint !== undefined ? { tint: from.tint } : {}),
      ...(from.fill !== undefined ? { fill: from.fill } : {}),
      ...(from.style !== undefined ? { style: from.style } : {}),
      ...(from.material !== undefined ? { material: from.material } : {}),
      // the readout's provenance (planWorkbench's stats.cuts, the export ledger): never stored
      cut: { id: cutId, from: cut.from, [op]: [...operandIds], cells: Number.isInteger(cut.cells) ? cut.cells : DEFAULT_CELLS, ...(Number.isFinite(cut.blend) && cut.blend > 0 ? { blend: cut.blend } : {}) },
    };
    consumed.add(body);
    for (const o of operands) consumed.add(o);
    const entry = { kind: 'field', key: 'fields', index: -1, spec, emitted: true };
    byId.set(cutId, entry);
    emitted.push(entry);
  });

  // the lowered manifest carries no `cuts`: lowering is idempotent, so a consumer that lowers
  // twice (planWorkbench, then lowerObjectFaces) sees the identity the second time
  const { cuts: _cuts, ...out } = manifest;
  for (const key of KEYS) {
    if (!Array.isArray(manifest[key])) continue;
    const kept = manifest[key].filter((spec) => !(isId(spec && spec.id) && consumed.has(byId.get(spec.id))));
    if (kept.length) out[key] = kept; else delete out[key];
  }
  const fields = [...(Array.isArray(out.fields) ? out.fields : []), ...emitted.filter((e) => !consumed.has(e)).map((e) => e.spec)];
  if (fields.length) out.fields = fields; else delete out.fields;
  return out;
}
