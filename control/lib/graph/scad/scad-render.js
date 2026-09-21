/**
 * scad-render — the `scad` recipe kind: the OpenSCAD SOURCE is the recipe.
 *
 * Every other object kind stores a JSON tree and meshes it with mojulo's own kernel. This
 * kind stores an OpenSCAD program and meshes it with OpenSCAD itself, running IN-PROCESS as
 * WebAssembly (`openscad-wasm-prebuilt`, the same optional-WASM posture as `manifold-3d`), so
 * the recipe regenerates on every read with no operator binary. The output is the ordinary
 * face list (`{ corners, fill, tint, group, outNormal }`) every emitter already consumes, so
 * /world, /scene, the .glb, the engine packs, the print legs and the gates are inherited
 * unchanged. The language is the win: exact booleans (a bore has a sharp lip), modules and
 * variables instead of a normalized tree, and a vocabulary every model already knows.
 *
 * Contract (the card, solid-vocab/scad.md, is the manual):
 *   { kind:'scad', source, parts?, units?, fn?, facing?, viewBox?, grid?, movers?, title? }
 *   - `source` is one OpenSCAD program, ≤ 64 KB. `include` / `use` / `import()` / `surface()`
 *     are refused at mint: the recipe carries its own geometry (the code realm's fence, same
 *     reason — determinism, not security).
 *   - Absent `parts`, the program's top level IS the object, one render group `body`.
 *   - With `parts` ({ name: '<statement(s)>' }), the source must define modules only (no
 *     top-level geometry — checked); each part renders `source + statement` on its own and
 *     names a RENDER GROUP, which is what a `movers` hinge swings. That is the seam the
 *     workbench's `group` provides, expressed the way OpenSCAD can: one instantiation per part.
 *   - `color()` becomes the face `tint`; the studio light shades it into `fill` the way every
 *     other kind is shaded. No colour → a neutral grey.
 *   - Units default to mm (OpenSCAD's convention), so the print legs land at true size.
 *
 * Determinism: OpenSCAD is deterministic for a pinned version, the WASM pins it, and the
 * Manifold backend is mandatory (CGAL took 14 s and 3.6 GB on the Duo; Manifold 0.2 s). The
 * geometry is memoised by a hash of (version, fn, source, statement); shading runs per call
 * because the light is the caller's (FLAT_LIGHT under the unshaded export).
 *
 * `callMain` runs ONCE per WASM instance (the second call throws), so every render creates a
 * fresh instance (~70 ms). Absent the package the renderer reports `{ skipped }` and a mint
 * refuses with the install line — never a crash on read.
 */

import { createHash } from 'node:crypto';
import { shadeHex, DEFAULT_LIGHT } from '../polygonizer/vexar.js';
import { auditClosure } from '../polygonizer/face-closure.js';
import { fieldToFaces, validateFields } from '../polygonizer/field-faces.js';
import { ensureExactKernel } from '../polygonizer/field-exact.js';
import { manifestWantsExact } from '../polygonizer/field-exact-reach.js';
import { facesToPolyhedron } from '../scene/scene-scad.js';

export const SCAD_KIND = 'scad';
export const MAX_SOURCE_BYTES = 64 * 1024;
export const DEFAULT_UNITS = 'mm';
export const SCAD_BACKEND = 'manifold';
export const DEFAULT_GROUP = 'body';
export const DEFAULT_TINT = '#b8bcc4';
const MAX_CACHED = 32;

// ─── the fence ────────────────────────────────────────────────────────────────────

const stripComments = (src) => String(src).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const FENCE = [
  [/(^|[;{}\s])(include|use)\s*</, '`include` / `use` read a file from the host; paste the module into `source` instead'],
  [/(^|[^A-Za-z0-9_])import\s*\(/, '`import()` reads a mesh or drawing file; the recipe must carry its own geometry'],
  [/(^|[^A-Za-z0-9_])surface\s*\(/, '`surface()` reads a heightmap file; the recipe must carry its own geometry'],
];

/** Refusals for a source, or [] when it may be minted. */
export function validateScadSource(source) {
  const errors = [];
  if (typeof source !== 'string' || !source.trim()) return ['`source` must be a non-empty OpenSCAD program'];
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) errors.push(`\`source\` is ${Buffer.byteLength(source, 'utf8')} bytes; the ceiling is ${MAX_SOURCE_BYTES}`);
  const bare = stripComments(source);
  for (const [re, why] of FENCE) if (re.test(bare)) errors.push(why);
  return errors;
}

/** Refusals for a `parts` map, or []. */
export function validateScadParts(parts) {
  if (parts === undefined) return [];
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) return ['`parts` must be an object { name: "<openscad statement>" }'];
  const errors = [];
  const names = Object.keys(parts);
  if (!names.length) errors.push('`parts` must name at least one part');
  for (const name of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) errors.push(`parts.${name}: a part name is an identifier (letters, digits, _ -)`);
    if (typeof parts[name] !== 'string' || !parts[name].trim()) errors.push(`parts.${name}: must be an OpenSCAD statement such as "lid();"`);
  }
  return errors;
}

// ─── the field escape hatch ───────────────────────────────────────────────────────
//
// What OpenSCAD cannot say (a blend, a brush stroke, noise, a distance expression, a warp) stays
// a mojulo `fields` entry, and the source reaches it as `mojulo_field("<id>")` — a module the
// renderer PREPENDS to the program, one `polyhedron()` per field, baked by the same kernel the
// workbench uses (the transpiler's bake path, run inbound). The sharp CSG around it is
// OpenSCAD's; the organic part inside it is mojulo's. The prelude is part of the program text,
// so the geometry memo keys on it like any other edit.

/** Refusals for a `fields` list on a scad manifest, or []. */
export function validateScadFields(fields) {
  if (fields === undefined) return [];
  if (!Array.isArray(fields)) return ['`fields` must be an array of workbench field entries, each with an `id`'];
  const errors = validateFields(fields, []);
  const ids = new Set();
  fields.forEach((f, i) => {
    if (!f || typeof f.id !== 'string' || !/^[A-Za-z_][A-Za-z0-9_-]*$/.test(f.id)) errors.push(`fields[${i}].id: every field needs an identifier id — the source reaches it as mojulo_field("<id>")`);
    else if (ids.has(f.id)) errors.push(`fields[${i}].id: '${f.id}' is used twice`);
    else ids.add(f.id);
  });
  return errors;
}

/**
 * Is this face list a 2-manifold Manifold will accept — every directed edge paired with its
 * reverse exactly once? The surface net is manifold for shapes, blends and strokes; `displace`
 * at a large amplitude folds it (unpaired and doubled edges), and OpenSCAD's Manifold backend
 * then DROPS the polyhedron from a boolean while still writing a file — a silent loss the mint
 * must catch here, before the render. Corners are keyed the way facesToPolyhedron prints them.
 */
export function auditManifold(faces) {
  const dir = new Map();
  const key = (c) => c.map((v) => { const n = Math.abs(v) < 1e-9 ? 0 : v; let s = n.toFixed(6); if (s.includes('.')) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }).join(',');
  for (const f of faces) {
    const ring = [];
    for (const c of f.corners) { const k = key(c); if (ring[ring.length - 1] !== k && ring[0] !== k) ring.push(k); }
    if (ring.length < 3) continue;
    for (let i = 0; i < ring.length; i += 1) { const k = `${ring[i]}>${ring[(i + 1) % ring.length]}`; dir.set(k, (dir.get(k) || 0) + 1); }
  }
  let unpaired = 0, doubled = 0;
  for (const [k, n] of dir) { if (n !== 1) doubled += 1; const [a, b] = k.split('>'); if (!dir.has(`${b}>${a}`)) unpaired += 1; }
  return { manifold: unpaired === 0 && doubled === 0, unpaired, doubled, edges: dir.size };
}

const preludeCache = new Map();
/** The `mojulo_field(id)` module for a manifest's `fields`, or '' when there are none. Memoised by the fields' JSON. */
export function fieldPrelude(fields) {
  if (!Array.isArray(fields) || !fields.length) return '';
  const key = JSON.stringify(fields);
  const hit = preludeCache.get(key);
  if (hit) return hit;
  const L = ['// mojulo fields — baked by mojulo\'s field kernel; edit the `fields` entries, not these numbers', 'module mojulo_field(id) {'];
  fields.forEach((f, i) => {
    const faces = fieldToFaces(f, {});
    const node = facesToPolyhedron(faces, `field '${f.id}' (${faces.length} faces, cells ${f.cells || 64})`);
    L.push(`  ${i ? 'else ' : ''}if (id == ${JSON.stringify(f.id)}) {`);
    if (node) L.push(...node.emit(2)); else L.push('    // (no surface)');
    L.push('  }');
  });
  L.push(`  else assert(false, str("mojulo_field: no field named ", id, " — the fields are ${fields.map((f) => f.id).join(', ')}"));`);
  L.push('}', '');
  const text = L.join('\n');
  if (preludeCache.size >= 16) preludeCache.delete(preludeCache.keys().next().value);
  preludeCache.set(key, text);
  return text;
}

// ─── the WASM ─────────────────────────────────────────────────────────────────────

let _modPromise = null;
// The package is ESM-only (an `exports` map with just an `import` condition). Next's server
// bundle externalizes a literal import() as a CommonJS `require()`, which Node refuses ("No
// exports main defined"); vitest's VM, conversely, has no dynamic-import callback for an
// import() built by `Function`. So: the literal import first (plain Node, vitest, the CLI), and
// on the exports refusal a specifier the bundler never saw, resolved by the Node runtime's own
// import() — the same package, resolved the way its author shipped it.
const nativeImport = new Function('s', 'return import(s)');
const isMissing = (e) => e && (e.code === 'ERR_MODULE_NOT_FOUND' || e.code === 'MODULE_NOT_FOUND');
const isExportsRefusal = (e) => e && (e.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' || /No "exports" main/.test(String(e.message || '')));
/** Lazy-load the package once; null when it is not installed (a lean install). */
export async function loadOpenscad() {
  if (!_modPromise) {
    _modPromise = (async () => {
      try {
        return await import('openscad-wasm-prebuilt');
      } catch (e) {
        if (isMissing(e)) return null;
        if (!isExportsRefusal(e)) throw e;
      }
      try {
        return await nativeImport('openscad-wasm-prebuilt');
      } catch (e) {
        if (isMissing(e)) return null;
        throw e;
      }
    })();
  }
  return _modPromise;
}

export const OPENSCAD_INSTALL_LINE = 'openscad-wasm-prebuilt is not installed — `npm install --include=optional` in control/ (or `mojulo install creative`) adds it';

let _version = null;
/** The OpenSCAD version the WASM reports (memoised), or null when the package is absent. */
export async function openscadVersion() {
  if (_version) return _version;
  const mod = await loadOpenscad();
  if (!mod) return null;
  const out = [];
  const o = await mod.createOpenSCAD({ print: (s) => out.push(String(s)), printErr: (s) => out.push(String(s)) });
  try { o.getInstance().callMain(['--version']); } catch (_) { /* --version exits through the runtime */ }
  const line = out.find((l) => /OpenSCAD version/i.test(l)) || out[0] || '';
  _version = line.replace(/^.*?version\s*/i, '').trim() || 'unknown';
  return _version;
}

/**
 * Run one OpenSCAD program to an OFF file. Returns `{ off, log, ms, empty }` — `empty` is
 * true when the program's top level makes no geometry (a library-only source). Throws with the
 * captured ERROR lines when the program fails to evaluate.
 */
export async function renderScadOff(program, { fn } = {}) {
  const mod = await loadOpenscad();
  if (!mod) return { skipped: true, reason: OPENSCAD_INSTALL_LINE };
  const log = [];
  const o = await mod.createOpenSCAD({ print: (s) => log.push(String(s)), printErr: (s) => log.push(String(s)) });
  const inst = o.getInstance();
  inst.FS.writeFile('/recipe.scad', program);
  const args = ['/recipe.scad', `--backend=${SCAD_BACKEND}`];
  if (Number.isFinite(fn) && fn >= 3) args.push('-D', `$fn=${Math.round(fn)}`);
  args.push('-o', '/out.off');
  const t0 = performance.now();
  let code = 0;
  try { code = inst.callMain(args); } catch (e) { code = -1; log.push(`runtime: ${e && e.message ? e.message : e}`); }
  const ms = Math.round(performance.now() - t0);
  const noise = /deprecat|localization|Geometries in cache|cache size|Polyhedrons in cache|^\s*$/i;
  const kept = log.filter((l) => !noise.test(l));
  const empty = log.some((l) => /top level object is empty/i.test(l));
  let off = null;
  try { off = inst.FS.readFile('/out.off'); } catch (_) { off = null; }
  // an ERROR outranks everything: a parse failure, a failed assert (an unknown mojulo_field id),
  // or a Manifold refusal — the last one still writes a file with the operand DROPPED, so an
  // output is no proof the program rendered as written
  const hard = kept.filter((l) => /\bERROR\b|runtime:/.test(l)); // \b: 'Status: NoError' is not an error
  if (!off || hard.length) {
    if (hard.length || !empty) {
      const errs = hard.length ? hard : kept.filter((l) => /WARNING/i.test(l));
      throw new Error(`OpenSCAD could not render the program (exit ${code}):\n- ${(errs.length ? errs : kept).slice(0, 12).join('\n- ')}`);
    }
  }
  return { off, log: kept, ms, empty };
}

// ─── OFF → geometry ───────────────────────────────────────────────────────────────

/**
 * Parse an OFF file (OpenSCAD's, with the optional per-face `r g b [a]` columns) into
 * `{ vertices: [[x,y,z]…], faces: [{ idx: [i…], rgb: [r,g,b] | null }] }`. Tolerant of
 * comments, a `COFF` header, and counts on the header line.
 */
export function parseOff(bytes) {
  const text = Buffer.isBuffer(bytes) || bytes instanceof Uint8Array ? Buffer.from(bytes).toString('utf8') : String(bytes);
  // OFF is line-oriented: one vertex or one face per line, and a face's colour columns sit on
  // ITS line after its indices — so the line is the unit, and the colour is whatever follows.
  const lines = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line) lines.push(line.split(/\s+/));
  }
  let i = 0;
  let head = lines[i] || [];
  if (/OFF$/i.test(head[0] || '')) { head = head.slice(1); if (!head.length) head = lines[++i] || []; }
  const nv = Number(head[0]), nf = Number(head[1]);
  i += 1;
  if (!Number.isInteger(nv) || !Number.isInteger(nf)) throw new Error('OFF: malformed header');
  if (lines.length < i + nv + nf) throw new Error(`OFF: truncated — header promises ${nv} vertices and ${nf} faces`);
  const vertices = new Array(nv);
  for (let v = 0; v < nv; v += 1, i += 1) vertices[v] = [Number(lines[i][0]), Number(lines[i][1]), Number(lines[i][2])];
  const faces = new Array(nf);
  for (let f = 0; f < nf; f += 1, i += 1) {
    const t = lines[i];
    const n = Number(t[0]);
    const idx = new Array(n);
    for (let k = 0; k < n; k += 1) idx[k] = Number(t[1 + k]);
    // 3 or 4 colour columns (r g b [a]); OpenSCAD writes 0..255 ints, other writers 0..1 floats
    let rgb = null;
    if (t.length >= n + 4) {
      const c = t.slice(n + 1, n + 4).map(Number);
      rgb = c.every((x) => x <= 1) && c.some((x) => !Number.isInteger(x)) ? c.map((x) => x * 255) : c;
    }
    faces[f] = { idx, rgb };
  }
  return { vertices, faces };
}

const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgbHex = (rgb) => `#${hex2(rgb[0])}${hex2(rgb[1])}${hex2(rgb[2])}`;

/** Newell normal of a ring of [x,y,z] points, unit length (or [0,0,1] for a degenerate ring). */
function ringNormal(pts) {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const l = Math.hypot(nx, ny, nz);
  return l > 1e-12 ? [nx / l, ny / l, nz / l] : [0, 0, 1];
}

/**
 * OFF geometry → the unshaded face records `{ corners, tint, normal }` (triangulated by fan;
 * OpenSCAD winds CCW seen from outside, so the Newell normal is outward).
 */
export function offToRecords(geom, { group = DEFAULT_GROUP } = {}) {
  const out = [];
  for (const f of geom.faces) {
    if (f.idx.length < 3) continue;
    const tint = f.rgb ? rgbHex(f.rgb) : DEFAULT_TINT;
    const ring = f.idx.map((k) => geom.vertices[k]);
    const normal = ringNormal(ring);
    for (let k = 1; k + 1 < ring.length; k += 1) {
      const a = ring[0], b = ring[k], c = ring[k + 1];
      out.push({ corners: [a, b, c], tint, normal, group });
    }
  }
  return neutralizeDefaultColours(out);
}

// OpenSCAD's OFF writer never leaves a face uncoloured: geometry without `color()` arrives in
// its preview scheme's front colour (the CGAL yellow) and the faces an uncoloured CUTTER leaves
// behind in its back colour (the green). Neither is a tint anyone authored, so a part's yellow
// becomes the neutral grey the card promises, and its green wears the part's one authored colour
// when it has exactly one (a coloured body carved by a bare `mojulo_field()` or `sphere()` stays
// the body's colour) — else the grey as well. A `color("#f9d72c")` written on purpose is the one
// thing this cannot tell apart; the card says so.
export const OPENSCAD_FRONT_COLOUR = '#f9d72c';
export const OPENSCAD_BACK_COLOUR = '#9dcb51';
export function neutralizeDefaultColours(records) {
  const authored = new Set();
  let seen = false;
  for (const r of records) {
    if (r.tint === OPENSCAD_FRONT_COLOUR || r.tint === OPENSCAD_BACK_COLOUR) seen = true;
    else if (r.tint !== DEFAULT_TINT) authored.add(r.tint);
  }
  if (!seen) return records;
  const cut = authored.size === 1 ? [...authored][0] : DEFAULT_TINT;
  return records.map((r) => (r.tint === OPENSCAD_FRONT_COLOUR ? { ...r, tint: DEFAULT_TINT } : r.tint === OPENSCAD_BACK_COLOUR ? { ...r, tint: cut } : r));
}

/**
 * Shade unshaded records under a light into the World face list. A triangle closes its ring
 * (the cap-fan encoding every emitter reads); a merged panel (coplanar-merge.js) keeps its
 * four parallelogram corners and carries its `clip` polygon through.
 */
export function shadeRecords(records, light = DEFAULT_LIGHT) {
  return records.map((r) => ({
    corners: r.corners.length === 3 ? [r.corners[0], r.corners[1], r.corners[2], r.corners[0]] : r.corners,
    fill: shadeHex(r.tint, r.normal, light),
    tint: r.tint,
    group: r.group,
    outNormal: r.normal,
    doubleSided: true,
    ...(r.clip ? { clip: r.clip, noInflate: true } : {}),
  }));
}

// ─── the memo ─────────────────────────────────────────────────────────────────────

const geomCache = new Map();
const cacheKey = (parts) => createHash('sha256').update(parts.join('\x00')).digest('hex').slice(0, 24);
function remember(key, value) {
  if (geomCache.size >= MAX_CACHED) geomCache.delete(geomCache.keys().next().value);
  geomCache.set(key, value);
  return value;
}

/**
 * Render ONE program (source + optional statement) to unshaded records, memoised.
 * Returns `{ records, log, ms, cached, empty }`.
 */
async function renderProgram(source, statement, { fn, group, prelude = '' }) {
  const version = await openscadVersion();
  if (version == null) return { skipped: true, reason: OPENSCAD_INSTALL_LINE };
  const program = `${prelude}${statement ? `${source}\n${statement}\n` : source}`;
  const key = cacheKey([version, SCAD_BACKEND, String(fn ?? ''), group, program]);
  const hit = geomCache.get(key);
  if (hit) return { ...hit, cached: true };
  const r = await renderScadOff(program, { fn });
  if (r.skipped) return r;
  const records = r.empty ? [] : offToRecords(parseOff(r.off), { group });
  return remember(key, { records, log: r.log, ms: r.ms, empty: r.empty, cached: false });
}

/**
 * A `scad` manifest → `{ parts: [{ name, records, log, ms }], skipped? }`, every part rendered.
 * With `parts`, the bare source must make no geometry (a library of modules), else refused.
 */
export async function renderScadParts(manifest) {
  const source = manifest.source;
  const fn = Number.isFinite(manifest.fn) ? manifest.fn : undefined;
  const parts = manifest.parts && typeof manifest.parts === 'object' ? manifest.parts : null;
  const prelude = fieldPrelude(manifest.fields);
  if (!parts) {
    const r = await renderProgram(source, null, { fn, group: DEFAULT_GROUP, prelude });
    if (r.skipped) return r;
    if (r.empty) throw new Error('The program makes no geometry at its top level — instantiate a module (e.g. `body();`), or name the parts in `parts`.');
    return { parts: [{ name: DEFAULT_GROUP, statement: null, ...r }] };
  }
  const bare = await renderProgram(source, null, { fn, group: '__bare', prelude });
  if (bare.skipped) return bare;
  if (!bare.empty) {
    throw new Error('With `parts`, `source` must only DEFINE modules — it makes geometry at its top level. Move the top-level calls into `parts` (e.g. parts: { body: "body();" }).');
  }
  const out = [];
  for (const [name, statement] of Object.entries(parts)) {
    const r = await renderProgram(source, statement, { fn, group: name, prelude });
    if (r.skipped) return r;
    if (r.empty) throw new Error(`parts.${name}: "${statement}" makes no geometry — does the module exist, and does it instantiate something?`);
    out.push({ name, statement, ...r });
  }
  return { parts: out };
}

/** The World face list for a manifest under a light (what /world, /scene and every export read). */
export async function renderScadFaces(manifest, light = DEFAULT_LIGHT) {
  const r = await renderScadParts(manifest);
  if (r.skipped) throw new Error(r.reason);
  return r.parts.flatMap((p) => shadeRecords(p.records, light));
}

// ─── the mint readout ─────────────────────────────────────────────────────────────

function boundsOf(records) {
  if (!records.length) return null;
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const r of records) for (const c of r.corners) for (let i = 0; i < 3; i += 1) { if (c[i] < min[i]) min[i] = c[i]; if (c[i] > max[i]) max[i] = c[i]; }
  return { min, max };
}
const round1 = (n) => Math.round(n * 10) / 10;
const sizeOf = (b) => ({ w: round1(b.max[0] - b.min[0]), d: round1(b.max[1] - b.min[1]), h: round1(b.max[2] - b.min[2]) });

/**
 * Validate + render a `scad` manifest and return the mint readout (the workbench's
 * `planWorkbench` twin): `{ stats }` with parts, size, faces, closure, warnings, the OpenSCAD
 * log, and the ledger. Throws on a refusal. Nothing is persisted.
 */
export async function planScad(manifest = {}) {
  const t0 = performance.now();
  // an embedded `fields` entry with `exact: true` bakes through Manifold (async to load, sync to bake)
  if (manifestWantsExact(manifest)) await ensureExactKernel();
  const errors = [...validateScadSource(manifest.source), ...validateScadParts(manifest.parts), ...validateScadFields(manifest.fields)];
  if (!errors.length && Array.isArray(manifest.fields)) {
    for (const f of manifest.fields) {
      const a = auditManifold(fieldToFaces(f, {}));
      if (!a.manifold) errors.push(`fields '${f.id}' bakes to a surface OpenSCAD's kernel cannot take (${a.unpaired} unpaired and ${a.doubled} doubled edges of ${a.edges}); a boolean would drop it silently. \`displace\` at a large amplitude folds the surface net — lower \`amplitude\`, raise \`cells\`, or shape the detail with \`stroke\` / \`blend\` instead.`);
    }
  }
  if (errors.length) throw new Error(`Invalid scad recipe:\n- ${errors.join('\n- ')}`);
  const { ledger: _prior, ...recipeOnly } = manifest;
  const recipeBytes = Buffer.byteLength(JSON.stringify(recipeOnly), 'utf8');
  const r = await renderScadParts(manifest);
  if (r.skipped) throw new Error(r.reason);
  const units = typeof manifest.units === 'string' ? manifest.units : DEFAULT_UNITS;
  const warnings = [];
  const log = [];
  const parts = r.parts.map((p) => {
    const b = boundsOf(p.records);
    const faces = shadeRecords(p.records);
    const closure = auditClosure(faces, { intendClosed: true });
    const colours = new Set(p.records.map((x) => x.tint)).size;
    const out = { name: p.name, ...(p.statement ? { statement: p.statement } : {}), faces: p.records.length, colours, size: sizeOf(b), base: round1(b.min[2]), top: round1(b.max[2]), ms: p.ms };
    if (!closure.closed) {
      out.open = { holes: closure.holes.length, widest: round1(closure.holes[0].diameter) };
      warnings.push(`part '${p.name}' is an open shell — ${closure.holes.length} hole${closure.holes.length === 1 ? '' : 's'}, widest ≈${round1(closure.holes[0].diameter)} ${units} across. Manifold output is closed by construction, so this is an OpenSCAD warning worth reading (a 2D object at top level, a non-manifold polyhedron()).`);
    }
    for (const l of p.log) if (/WARNING|ERROR/i.test(l) && !/Status:\s*NoError/i.test(l)) log.push(`${p.name}: ${l}`);
    return out;
  });
  const all = r.parts.flatMap((p) => p.records);
  const bounds = boundsOf(all);
  const size = bounds ? sizeOf(bounds) : null;
  if (bounds) {
    const tol = Math.max(0.2, (bounds.max[2] - bounds.min[2]) * 0.02);
    if (bounds.min[2] > tol) warnings.push(`Object floats ${round1(bounds.min[2])} ${units} above the grid (lowest z=${round1(bounds.min[2])}). Author with the lowest z = 0 to seat it on the measured floor.`);
    else if (bounds.min[2] < -tol) warnings.push(`Object sinks ${round1(-bounds.min[2])} ${units} below the grid (lowest z=${round1(bounds.min[2])}). Raise it so the lowest z = 0.`);
  }
  if (Array.isArray(manifest.movers)) {
    const names = new Set(r.parts.map((p) => p.name));
    for (const m of manifest.movers) if (m && typeof m.group === 'string' && !names.has(m.group)) warnings.push(`movers: group '${m.group}' names no part — the parts are ${[...names].join(', ')}.`);
  }
  const closed = parts.every((p) => !p.open);
  const ledger = { recipe_bytes: recipeBytes, wall_ms: Math.round(performance.now() - t0), faces: all.length, closed, openscad: await openscadVersion(), backend: SCAD_BACKEND };
  return { stats: { parts, faces: all.length, units, size, ledger, ...(log.length ? { log } : {}), ...(warnings.length ? { warnings } : {}) } };
}

/** The deterministic subset of the ledger stored on the manifest (no timings). */
export function persistedScadLedger(ledger) {
  if (!ledger) return undefined;
  return { recipe_bytes: ledger.recipe_bytes, faces: ledger.faces, closed: ledger.closed, openscad: ledger.openscad };
}
