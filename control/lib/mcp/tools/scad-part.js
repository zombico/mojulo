/**
 * The part lane's expansion: a scad row minted with `spec.part` names a recipe-book part (a wall hook, a phone stand,
 * a box with a lid), and its `params` are the recipe. The part's pure builder writes the OpenSCAD program; the row
 * stores it as `source` beside `part` and `params`, so every scad reader (render, export, fabricate, the ladder) reads
 * a plain scad row. The program is stamped at mint and rewritten by update_sketch when `/params` or `/part` change,
 * which keeps a minted row stable when a builder is refined later, the way an equipment build carries its laws.
 *
 * A hand edit under `/source` detaches the row: `part` and `params` are dropped and it is a scad part like any other.
 *
 * The params are the size of the ask made concrete: a look names none (every default), a fit names the one to three
 * that matter (the rail the hook hangs on, the phone's thickness).
 */
import { ensureBookLoaded } from '@/lib/graph/views/recipe-book/loader';
import { bookParts } from '@/lib/graph/views/recipe-book/registry';

const typeOf = (spec) => (Array.isArray(spec.one_of) ? 'one_of' : typeof spec.default);

/** The named params over the part's defaults; refuses an unknown name, a wrong type or a value out of range. */
export function resolvePartParams(def, params = {}) {
  if (params === null || typeof params !== 'object' || Array.isArray(params)) throw new Error(`part '${def.id}': params is an object { <name>: value }`);
  const names = Object.keys(def.params);
  const errors = [];
  for (const k of Object.keys(params)) if (!def.params[k]) errors.push(`'${k}' is not a ${def.id} param (${names.join(', ')})`);
  const out = {};
  for (const [k, spec] of Object.entries(def.params)) {
    const v = params[k] === undefined ? spec.default : params[k];
    const t = typeOf(spec);
    if (t === 'one_of') {
      if (!spec.one_of.includes(v)) errors.push(`${k} is one of ${spec.one_of.join(' | ')}, not ${JSON.stringify(v)}`);
    } else if (t === 'number') {
      if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${k} is a number${spec.unit ? ` (${spec.unit})` : ''}, not ${JSON.stringify(v)}`);
      else if ((spec.min !== undefined && v < spec.min) || (spec.max !== undefined && v > spec.max)) errors.push(`${k} is ${spec.min ?? '…'}–${spec.max ?? '…'}${spec.unit ? ` ${spec.unit}` : ''}, not ${v}`);
    } else if (typeof v !== t) {
      errors.push(`${k} is a ${t}, not ${JSON.stringify(v)}`);
    }
    out[k] = v;
  }
  if (errors.length) throw new Error(`part '${def.id}': ${errors.join('; ')}. Its params: get_solid_vocab({ id: '${def.id}' }).`);
  return out;
}

/** The part's definition, after the book has loaded; a miss names the parts there are. */
export async function partDef(id) {
  await ensureBookLoaded();
  const def = bookParts().get(id);
  if (!def) {
    const known = [...bookParts().keys()];
    throw new Error(`unknown part '${id}'. Parts in the recipe book: ${known.length ? known.join(', ') : '(none loaded)'}. Find one by intent via semantic_search({ kinds: ['solid_vocab'] }).`);
  }
  return def;
}

/** `{ source, parts? }` written by the part's builder from the resolved params. */
export async function partProgram(id, params) {
  const def = await partDef(id);
  const resolved = resolvePartParams(def, params);
  const out = def.source(resolved);
  const program = typeof out === 'string' ? { source: out } : out;
  if (!program || typeof program.source !== 'string' || !program.source.trim()) throw new Error(`part '${id}': its builder wrote no program`);
  return program;
}

/**
 * The manifest with its program rewritten from `part` and `params` (update_sketch). `touched` holds the patched
 * paths: an edit under `/source` or `/parts` alone detaches the row instead, so a hand edit is never overwritten.
 */
export async function expandPartManifest(manifest, { touched, patch } = {}) {
  if (!manifest || manifest.part === undefined) return { manifest };
  const under = (root) => [...(touched || [])].some((t) => String(t) === root || String(t).startsWith(`${root}/`));
  if (patch !== undefined && (under('/source') || under('/parts')) && !under('/params') && !under('/part')) {
    const { part: _part, params: _params, ...rest } = manifest;
    return { manifest: rest, detached: manifest.part };
  }
  const { source, parts } = await partProgram(manifest.part, manifest.params);
  const { parts: _old, ...rest } = manifest;
  return { manifest: { ...rest, source, ...(parts ? { parts } : {}) } };
}
