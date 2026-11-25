/**
 * import-model — a model made OUTSIDE mojulo brought in from this machine's disk, through the door that owns what it
 * is: `mint_solid({ kind: 'model', spec: { from } })` for an object (a prop, scenery, a print), `create_character({
 * from })` for a character (a body or a mascot, rigged onto the vajra when its own skeleton does not read). Both:
 *
 *   1. read the file (a GLB, a VRM, a .gltf with its folder, an OBJ with its MTL, an STL, a 3MF, or a zip of one) into
 *      one canonical GLB (lib/graph/import/read-path.js, to-glb.js): what did not travel is named
 *   2. assess it (lib/graph/import/assess.js): what it holds, its units, its height, what it is, how it moves, and the
 *      machine gate over its rig
 *   3. mint a `model` row whose recipe is those DECISIONS (worlds/model.js), and bind the GLB to it as its mesh
 *      (sketch-model-export.js bindMeshBytes: append-only, hashed, its source and licence in the sidecar)
 *
 * The file is read where it is: a path on this machine (in the desktop app, a folder the person chose; in a cloud
 * session, the file uploaded into it). Nothing is fetched: a URL is refused, naming the step that brings it here.
 *
 *   importModel(input, { door: 'solid' | 'character' }) → { ok, ref, url, worldUrl, sceneUrl, import, next }
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SketchRepository } from '@/lib/db/repositories/sketches';
import { readModelPath } from '@/lib/graph/import/read-path.js';
import { assessModel } from '@/lib/graph/import/assess.js';
import { UNIT_NAMES, unitMetres } from '@/lib/graph/import/inspect.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const pct = (v) => `${Math.round(v * 1000) / 10}%`;

/** The words an import takes, beside `from` (the doors' schemas and the model card read this). */
export const IMPORT_KEYS = Object.freeze(['from', 'entry', 'up', 'units', 'height', 'as', 'rig', 'licence']);

/** A stated licence: a word ('CC0-1.0') or { name, url?, author? }. */
function readLicence(v) {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string' && v.trim()) return { name: v.trim() };
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.name === 'string') {
    const out = { name: v.name };
    for (const k of ['url', 'author', 'source']) if (typeof v[k] === 'string' && v[k]) out[k] = v[k];
    return out;
  }
  throw new Error("import: `licence` is the terms it came under: a word ('CC0-1.0') or { name, url?, author? }");
}

/** A model on this machine imported through `door` (see the header). */
export async function importModel(input, { door }) {
  const { from, entry = null, up = null, units = null, height = null, rig = null, title, ref, folder_ref: folderRef } = input || {};
  const stated = readLicence(input?.licence);
  if (units !== null && !UNIT_NAMES.includes(units)) throw new Error(`import: \`units\` is the unit the file's numbers are in: ${UNIT_NAMES.join(' | ')}`);
  if (height !== null && !(Number.isFinite(height) && height > 0)) throw new Error('import: `height` is the metres it stands (a positive number)');
  // a character door's `as` words: a person is a hero's body, a mascot a mascot's
  let as = input?.as ?? null;
  if (door === 'character') {
    if (as === 'hero' || as === 'body') as = 'body';
    else if (as !== null && as !== 'mascot') throw new Error("create_character: a character from a file is `as: 'hero'` (a person's body) or `as: 'mascot'` (head-heavy, cartoony); leave it out and its proportions say which");
  } else as = null;
  const read = await readModelPath(from, { entry, up });
  const a = await assessModel(read.bytes, { height, units, as, rig: door === 'solid' ? 'none' : rig });
  const cls = a.class.class;
  if (door === 'character') {
    if (cls !== 'body' && cls !== 'mascot') {
      throw new Error(`create_character: '${path.basename(read.from.path)}' reads as a ${cls} (${a.class.basis}). A character from a file is a body or a mascot (say \`as: 'hero'\` or \`as: 'mascot'\` if it is one); bring a ${cls} in as an object: mint_solid({ kind: 'model', spec: { from } })`);
    }
    if (!a.rig.ok) {
      throw new Error(`create_character: '${path.basename(read.from.path)}' is a ${cls} that cannot be rigged: ${a.rig.error}${a.rig.own ? ` (its own skeleton: ${a.rig.own})` : ''}. Bring it in as an object, placed as it stands: mint_solid({ kind: 'model', spec: { from } })`);
    }
  }
  // the unit its numbers are in → metres (a figure's own height is read against a figure's range: assess.js)
  const unitScale = unitMetres(a.units.assumed) ?? 1;
  const decided = {
    file: path.basename(read.from.path),
    format: read.from.format,
    ...(read.from.entry ? { entry: read.from.entry } : {}),
    ...(read.from.files.length ? { beside: read.from.files } : {}),
    sha256: createHash('sha256').update(readFileSync(read.from.path)).digest('hex'),
    up: read.from.up,
    units: a.units.assumed,
    ...(a.units.ambiguous && units === null ? { unitsRead: a.units.basis } : {}),
    height: r4(door === 'character' ? a.height : a.inspect.rest.height * unitScale),
    class: cls,
    ...(a.class.headsTall ? { headsTall: a.class.headsTall } : {}),
    rig: door === 'character' ? a.rig.how : 'none',
    ...(stated || a.inspect.licence ? { licence: { ...(a.inspect.licence || {}), ...(stated || {}), basis: stated ? 'stated' : a.inspect.licence.basis } } : {}),
    triangles: a.inspect.triangles,
  };
  const manifest = { kind: 'model', units: 'm', import: decided };
  const sketch = SketchRepository.create({ title: title || `${door === 'character' ? cls : 'model'} · ${decided.file.replace(/\.[a-z0-9]+$/i, '')}`, manifest, ref, folderRef: folderRef ?? null });
  const { bindMeshBytes } = await import('@/lib/mcp/tools/sketch-model-export');
  const note = `imported from ${decided.file}${a.rig.how === 'auto' ? ', rigged onto the vajra' : ''}`;
  const bound = await bindMeshBytes(sketch, a.glb, { sourcePath: read.from.path, source: 'import', note, scale: unitScale !== 1 ? unitScale : null, sourceUnits: unitScale !== 1 ? a.units.assumed : null });
  const urls = {
    url: `/sketches/${encodeURIComponent(sketch.ref)}`,
    worldUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/world`,
    sceneUrl: `/api/sketches/${encodeURIComponent(sketch.ref)}/scene`,
  };
  const warnings = [...a.inspect.warnings.filter((w) => !(stated && /names no licence/.test(w))), ...read.ledger.notes, ...(a.rig.fit?.notes || [])];
  if (a.units.ambiguous && units === null) warnings.push(`its units: ${a.units.basis}`);
  if (a.class.basis && /between/.test(a.class.basis)) warnings.push(a.class.basis);
  const gate = a.rig.gate ? { verdict: a.rig.gate.verdict, torn: pct(a.rig.gate.torn), poses: a.rig.gate.poses.filter((p) => p.torn > 0.01).map((p) => `${p.name} ${pct(p.torn)}${p.worst[0] ? ` (${p.worst[0].bone})` : ''}`) } : null;
  const readout = {
    ...decided,
    stands: door === 'character' ? `${decided.height} m` : `${a.inspect.rest.size.map((v) => r4(v * unitScale)).join(' × ')} m`,
    class: { is: cls, basis: a.class.basis },
    ...(door === 'character' ? { rig: { how: a.rig.how, bones: a.rig.bones, ...(a.rig.fit?.facing ? { facing: a.rig.fit.facing } : {}) }, gate } : {}),
    sha256Glb: bound.sha256,
    ...(warnings.length ? { warnings } : {}),
  };
  const name = cls === 'mascot' ? 'mascot' : door === 'character' ? 'hero' : 'thing';
  const next = door === 'character'
    ? { tool: 'compose_world', reason: `Play it: a world's figures map wears it as a body (\`figures: { ${name}: { modelRef: '${sketch.ref}' } }\`, the hero as \`{ type: 'figure-rig', figure: '${name}' }\`), its states the clip library's; export it skinned with export_model({ ref: '${sketch.ref}' }). The machine gate ran${gate ? ` (${gate.verdict}, ${gate.torn} torn)` : ''}; the eyes gate is the person's: look at it move.` }
    : { tool: 'compose_world', reason: `Place it: a world's figures map stands it as scenery (\`figures: { ${name}: { meshRef: '${sketch.ref}', transform: { pos: [x, y, 0] } } }\`); print or export it with export_model({ ref: '${sketch.ref}' }).` };
  return { ok: true, ref: sketch.ref, ...urls, import: readout, next };
}
