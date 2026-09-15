/**
 * manifest-patch — iterate a stored recipe by naming the part, not by resending the recipe.
 *
 * `update_sketch { patch }` carries an ordered list of ops applied against the STORED manifest;
 * the result is handed to the same kind gates a full `manifest` replacement pays (the workbench
 * plan, `resolveWorldScene`, the ledger stamp, the revision archive). Nothing forks: a patch is a
 * cheaper way to author the next manifest, never a second write path. The stored artifact is the
 * resolved manifest, so re-render and byte-identical regeneration are untouched; the ops ride the
 * archived revision as its diff.
 *
 * Three op kinds, applied in order against the live document (JSON Patch discipline — a
 * positional pointer written after an `add` means what the author saw):
 *
 *   { op: 'set',    id: 'dial', material: 'chrome', profile: [...] }   shallow-merge into the monomer
 *                                                                        (a key set to `null` deletes it)
 *   { op: 'set',    path: '/movers/0/states', value: [0, 0.27] }        replace at an RFC 6901 pointer
 *                                                                        (the last segment is created if absent)
 *   { op: 'remove', id: 'g_stop' }  |  { op: 'remove', path: '/reliefs/3' }
 *   { op: 'add',    into: 'lathes', entry: { id: 'usbcap', … } }        append a monomer
 *
 * Ids resolve across every monomer array (`lathes` … `shells`); an id carried by two entries is
 * refused with both locations named. Unnamed monomers are reachable only by `path` — naming a
 * part is what makes it editable. Removing a monomer that a `cuts` entry or a `movers` entry
 * still names is refused with the dependant named, so a patch cannot store a recipe whose cut or
 * hinge points at nothing.
 *
 * Pure: a deep clone is patched, the input is never mutated, and every refusal is thrown with the
 * op's index and the reason. No dependency — the pointer walker is the ~30 lines it needs.
 */

import { MONOMER_KIND_OF_KEY } from '@/lib/graph/polygonizer/workbench-cuts';

export const PATCH_OPS = Object.freeze(['set', 'remove', 'add']);
export const MONOMER_ARRAYS = Object.freeze(Object.keys(MONOMER_KIND_OF_KEY));

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const isId = (v) => typeof v === 'string' && v.length > 0;

/** RFC 6901: '/a/b~1c/0' → ['a', 'b/c', '0']. The empty pointer (the whole document) is refused. */
export function parsePointer(path, where) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error(`${where}: \`path\` must be a JSON Pointer starting with '/' (e.g. '/movers/0/states'); to replace the whole document pass \`manifest\``);
  }
  return path.slice(1).split('/').map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'));
}

/** Walk to the parent of the pointer's last segment. Every intermediate must exist. */
function resolveParent(doc, segments, path, where) {
  let node = doc;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    const next = Array.isArray(node) ? node[arrayIndex(node, seg, path, where, false)] : (isObject(node) ? node[seg] : undefined);
    if (next === undefined || next === null || typeof next !== 'object') {
      throw new Error(`${where}: \`path\` '${path}' has nothing at '/${segments.slice(0, i + 1).join('/')}' — only the last segment is created`);
    }
    node = next;
  }
  return { parent: node, last: segments[segments.length - 1] };
}

function arrayIndex(arr, seg, path, where, allowEnd) {
  if (seg === '-') return arr.length;
  if (!/^(0|[1-9]\d*)$/.test(seg)) throw new Error(`${where}: \`path\` '${path}' indexes an array with '${seg}' — use a number or '-'`);
  const n = Number(seg);
  const max = allowEnd ? arr.length : arr.length - 1;
  if (n > max) throw new Error(`${where}: \`path\` '${path}' index ${n} is past the end (${arr.length} entr${arr.length === 1 ? 'y' : 'ies'})`);
  return n;
}

/** id → { key, index, spec }; duplicates are kept aside so an ambiguous ADDRESS refuses by name. */
function indexIds(doc) {
  const byId = new Map();
  const dupes = new Map();
  for (const key of MONOMER_ARRAYS) {
    const arr = Array.isArray(doc[key]) ? doc[key] : [];
    arr.forEach((spec, index) => {
      if (!isObject(spec) || !isId(spec.id)) return;
      const prior = byId.get(spec.id);
      if (prior) dupes.set(spec.id, [...(dupes.get(spec.id) || [`${prior.key}[${prior.index}]`]), `${key}[${index}]`]);
      else byId.set(spec.id, { key, index, spec });
    });
  }
  return { byId, dupes };
}

function findById(doc, id, where) {
  if (!isId(id)) throw new Error(`${where}: \`id\` must be a non-empty string`);
  const { byId, dupes } = indexIds(doc);
  if (dupes.has(id)) throw new Error(`${where}: id '${id}' is ambiguous — carried by ${dupes.get(id).join(' and ')}; give each a distinct id, or address one by \`path\``);
  const hit = byId.get(id);
  if (!hit) {
    const known = [...byId.keys()];
    throw new Error(`${where}: no monomer carries id '${id}'${known.length ? ` (known: ${known.join(', ')})` : ' — unnamed monomers are reachable by `path` only (e.g. \'/extrudes/3\')'}`);
  }
  return hit;
}

/** The cut or mover that still names this monomer, or null. */
function dependantOf(doc, key, spec) {
  const id = isId(spec.id) ? spec.id : null;
  if (id && Array.isArray(doc.cuts)) {
    for (let i = 0; i < doc.cuts.length; i += 1) {
      const c = doc.cuts[i];
      if (!isObject(c)) continue;
      if (c.from === id) return `cuts[${i}] (${c.id ? `'${c.id}'` : 'unnamed'}) still cuts FROM '${id}'`;
      for (const op of ['subtract', 'intersect']) {
        if (Array.isArray(c[op]) && c[op].includes(id)) return `cuts[${i}] (${c.id ? `'${c.id}'` : 'unnamed'}) still names '${id}' in \`${op}\``;
      }
    }
  }
  if (Array.isArray(doc.movers)) {
    // A mover drives a render GROUP: the monomer's `group`, or its id when a cut lifts it into
    // its own group (every cut operand's faces carry `group: <operand id>`). The group survives
    // the removal when another monomer still carries it.
    const others = MONOMER_ARRAYS.flatMap((k) => (Array.isArray(doc[k]) ? doc[k] : []).filter((s) => s !== spec));
    const groups = new Set();
    if (isId(spec.group) && !others.some((s) => isObject(s) && s.group === spec.group)) groups.add(spec.group);
    if (id) groups.add(id);
    for (let i = 0; i < doc.movers.length; i += 1) {
      const m = doc.movers[i];
      if (!isObject(m)) continue;
      for (const field of ['group', 'parent']) {
        if (isId(m[field]) && groups.has(m[field])) return `movers[${i}] still drives ${field === 'parent' ? 'a child of ' : ''}group '${m[field]}'`;
      }
    }
  }
  return null;
}

function refuseIfDepended(doc, key, spec, where, label) {
  const why = dependantOf(doc, key, spec);
  if (why) throw new Error(`${where}: cannot remove ${label} — ${why}; remove or re-point the dependant first`);
}

/** After a path op under a monomer array, name the part the readout will look for. */
function touchMonomerAt(doc, segments, touched) {
  if (segments.length < 2 || !MONOMER_ARRAYS.includes(segments[0]) || !/^\d+$/.test(segments[1])) return;
  const entry = Array.isArray(doc[segments[0]]) ? doc[segments[0]][Number(segments[1])] : undefined;
  if (isObject(entry) && isId(entry.id)) touched.add(entry.id);
  else touched.add(`/${segments[0]}/${segments[1]}`);
}

function applySet(doc, op, where, touched) {
  const { op: _op, id, path, value, ...fields } = op;
  if ((id === undefined) === (path === undefined)) throw new Error(`${where}: \`set\` takes exactly one of \`id\` or \`path\``);
  if (id !== undefined) {
    if (value !== undefined) throw new Error(`${where}: \`set\` by \`id\` merges the remaining keys into the monomer — \`value\` belongs to the \`path\` form`);
    const keys = Object.keys(fields);
    if (!keys.length) throw new Error(`${where}: \`set\` by \`id\` needs at least one key to merge (a key set to null deletes it)`);
    const { key, index, spec } = findById(doc, id, where);
    const next = { ...spec };
    for (const k of keys) {
      if (fields[k] === null) delete next[k];
      else next[k] = fields[k];
    }
    doc[key][index] = next;
    touched.add(id);
    return;
  }
  if (value === undefined) throw new Error(`${where}: \`set\` by \`path\` needs a \`value\``);
  if (Object.keys(fields).length) throw new Error(`${where}: \`set\` by \`path\` replaces the value at the pointer — extra keys (${Object.keys(fields).join(', ')}) belong to the \`id\` form`);
  const segments = parsePointer(path, where);
  const { parent, last } = resolveParent(doc, segments, path, where);
  if (Array.isArray(parent)) parent[arrayIndex(parent, last, path, where, true)] = value;
  else if (isObject(parent)) parent[last] = value;
  else throw new Error(`${where}: \`path\` '${path}' points into a scalar`);
  touched.add(path);
  touchMonomerAt(doc, segments, touched);
}

function applyRemove(doc, op, where, touched) {
  const { id, path } = op;
  if ((id === undefined) === (path === undefined)) throw new Error(`${where}: \`remove\` takes exactly one of \`id\` or \`path\``);
  if (id !== undefined) {
    const { key, index, spec } = findById(doc, id, where);
    refuseIfDepended(doc, key, spec, where, `'${id}'`);
    doc[key].splice(index, 1);
    touched.add(id);
    return;
  }
  const segments = parsePointer(path, where);
  const { parent, last } = resolveParent(doc, segments, path, where);
  if (Array.isArray(parent)) {
    if (last === '-') throw new Error(`${where}: \`remove\` at '${path}' — '-' names the slot past the end; nothing is there`);
    const i = arrayIndex(parent, last, path, where, false);
    if (segments.length === 2 && MONOMER_ARRAYS.includes(segments[0]) && isObject(parent[i])) {
      refuseIfDepended(doc, segments[0], parent[i], where, `'${path}'`);
      if (isId(parent[i].id)) touched.add(parent[i].id);
    }
    parent.splice(i, 1);
  } else if (isObject(parent)) {
    if (!(last in parent)) throw new Error(`${where}: \`path\` '${path}' has nothing to remove`);
    delete parent[last];
  } else {
    throw new Error(`${where}: \`path\` '${path}' points into a scalar`);
  }
  touched.add(path);
}

function applyAdd(doc, op, where, touched) {
  const { into, entry } = op;
  if (!MONOMER_ARRAYS.includes(into)) throw new Error(`${where}: \`add\` needs \`into\`, one of ${MONOMER_ARRAYS.join(' | ')}`);
  if (!isObject(entry)) throw new Error(`${where}: \`add\` needs \`entry\`, the monomer object`);
  if (entry.id !== undefined) {
    if (!isId(entry.id)) throw new Error(`${where}: \`entry.id\` must be a non-empty string when given`);
    const { byId, dupes } = indexIds(doc);
    const prior = byId.get(entry.id);
    if (prior || dupes.has(entry.id)) throw new Error(`${where}: id '${entry.id}' already exists (${prior ? `${prior.key}[${prior.index}]` : dupes.get(entry.id).join(', ')}) — pick a distinct id, or \`set\` that one`);
  }
  if (!Array.isArray(doc[into])) doc[into] = [];
  doc[into].push(structuredClone(entry));
  if (isId(entry.id)) touched.add(entry.id);
  else touched.add(`/${into}/${doc[into].length - 1}`);
}

/**
 * Apply `ops` to a deep clone of `manifest`.
 * @returns {{ manifest: object, touched: Set<string> }} the next manifest and the ids / pointers
 *   the patch addressed (a part is "touched" whether or not its geometry moved).
 */
export function applyManifestPatch(manifest, ops) {
  if (!isObject(manifest)) throw new Error('`patch` needs a stored object manifest to apply to');
  if (!Array.isArray(ops) || !ops.length) throw new Error('`patch` must be a non-empty array of ops ({ op: \'set\' | \'remove\' | \'add\', … })');
  const doc = structuredClone(manifest);
  const touched = new Set();
  ops.forEach((op, i) => {
    const where = `patch[${i}]`;
    if (!isObject(op)) throw new Error(`${where}: an op is an object { op: 'set' | 'remove' | 'add', … }`);
    if (op.op === 'set') applySet(doc, op, where, touched);
    else if (op.op === 'remove') applyRemove(doc, op, where, touched);
    else if (op.op === 'add') applyAdd(doc, op, where, touched);
    else throw new Error(`${where}: unknown op '${op.op}' — one of ${PATCH_OPS.join(' | ')}`);
  });
  return { manifest: doc, touched };
}
