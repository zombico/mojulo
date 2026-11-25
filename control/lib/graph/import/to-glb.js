/**
 * to-glb — a model made ELSEWHERE turned, at the door, into the ONE format mojulo keeps: a self-contained glTF binary.
 * The bound-mesh slot (scene/mesh-store.js) stores a GLB, the readers downstream read a GLB (scene-gltf-read.js for
 * scenery, scene/rig-import.js for a body), so every file a person brings is made one here, once, and nothing after
 * this module knows which format it was. The STL and 3MF path bind_mesh_render already had is one branch of it.
 *
 *   toGlb(bytes, name, { resolve?, entry?, up? }) → { bytes, from, ledger }
 *     bytes    the file (a Buffer)
 *     name     its file name (the extension routes it; the magic bytes are checked against it)
 *     resolve  (uri) → Buffer | null: the files a .gltf or an .obj names beside it (its .bin, its .mtl, its images),
 *              by the relative path it names them by; the caller reads them (import/read-path.js: a folder or a zip),
 *              so this module never touches a disk. A name that climbs out (`..`), an absolute path and a URL are
 *              refused before `resolve` is asked
 *     entry    for a zip holding several models, the one meant (its path in the zip)
 *     up       'y' | 'z': the axis the FILE stands on, when it is not its format's own (glTF and OBJ stand on y, STL
 *              and 3MF on z). The canonical GLB stands on glTF's y always: a file declared otherwise is turned at its
 *              root, the vertices left as they came
 *
 *   from     { format, entry?, files: [names read beside it], up }
 *   ledger   { images_missing: [], uris_refused: [], notes: [] }: what did not travel, named
 *
 *   packGlb(json, bin) → Buffer       a glTF JSON and its one binary buffer, as a GLB
 *   IMPORT_FORMATS                    the formats read, each with its own up axis
 *   FORMATS_REFUSED                   the formats not read yet, each with the line that gets it in
 *
 * The same bytes (and the same files beside them) give the same GLB: no clock, no dice, keys in a fixed order. A GLB
 * that names nothing outside itself comes back byte for byte (a VRM keeps its every extension).
 */
import { parseGlb } from '../scene/scene-gltf-read.js';
import { meshFileToFaces, unzipEntries } from '../scene/mesh-read.js';

const fail = (m) => new Error(`import: ${m}`);

/** The formats read, with the axis each stands on when nothing else is said. */
export const IMPORT_FORMATS = Object.freeze({
  glb: Object.freeze({ name: 'glTF binary', up: 'y' }),
  vrm: Object.freeze({ name: 'VRM avatar (a glTF binary)', up: 'y' }),
  gltf: Object.freeze({ name: 'glTF with its .bin and images', up: 'y' }),
  obj: Object.freeze({ name: 'Wavefront OBJ (with its .mtl)', up: 'y' }),
  stl: Object.freeze({ name: 'STL', up: 'z' }),
  '3mf': Object.freeze({ name: '3MF', up: 'z' }),
  zip: Object.freeze({ name: 'a zip holding one of the above', up: null }),
});
const EXPORT_GLB = 'export it from the tool that made it as a GLB (glTF binary, no Draco or meshopt compression) and bring that';
/** The formats not read yet, each with the line that gets it in. */
export const FORMATS_REFUSED = Object.freeze({
  fbx: `FBX is not read here yet: ${EXPORT_GLB} (Blender: File → Import → FBX, then File → Export → glTF 2.0 .glb)`,
  dae: `COLLADA is not read here yet: ${EXPORT_GLB}`,
  usd: `USD is not read here yet: ${EXPORT_GLB}`, usda: `USD is not read here yet: ${EXPORT_GLB}`,
  usdc: `USD is not read here yet: ${EXPORT_GLB}`, usdz: `USDZ is not read here yet: ${EXPORT_GLB}`,
  blend: `a .blend is not read here: ${EXPORT_GLB}`,
  ply: `PLY is not read here yet: ${EXPORT_GLB}, or as an STL`,
  '3ds': `3DS is not read here: ${EXPORT_GLB}`,
  max: `a 3ds Max scene is not read here: ${EXPORT_GLB}`,
  ma: `a Maya scene is not read here: ${EXPORT_GLB}`, mb: `a Maya scene is not read here: ${EXPORT_GLB}`,
  c4d: `a Cinema 4D scene is not read here: ${EXPORT_GLB}`,
  step: 'a STEP file is a CAD solid, not a mesh: export it as an STL or a 3MF', stp: 'a STEP file is a CAD solid, not a mesh: export it as an STL or a 3MF',
});
/** glTF extensions whose data cannot be read here: refused at the door, never half-read. */
const UNREADABLE_EXTENSIONS = Object.freeze({
  KHR_draco_mesh_compression: 'Draco-compressed geometry',
  EXT_meshopt_compression: 'meshopt-compressed geometry',
});

const extOf = (name) => String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
const align = (n, a = 4) => (n + a - 1) & ~(a - 1);

// ── the container ────────────────────────────────────────────────────────────────────────────────────────────────────
/** A glTF JSON and its one binary buffer as a GLB (JSON padded with spaces, BIN with zeros, per the spec). */
export function packGlb(json, bin = null) {
  const jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = Buffer.alloc(align(jsonBuf.length) - jsonBuf.length, 0x20);
  const hasBin = !!bin && bin.length > 0;
  const binPad = hasBin ? Buffer.alloc(align(bin.length) - bin.length, 0) : null;
  const total = 12 + 8 + jsonBuf.length + jsonPad.length + (hasBin ? 8 + bin.length + binPad.length : 0);
  const head = Buffer.alloc(12);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(total, 8);
  const chunk = (len, type) => { const c = Buffer.alloc(8); c.writeUInt32LE(len, 0); c.writeUInt32LE(type, 4); return c; };
  const parts = [head, chunk(jsonBuf.length + jsonPad.length, 0x4e4f534a), jsonBuf, jsonPad];
  if (hasBin) parts.push(chunk(bin.length + binPad.length, 0x004e4942), bin, binPad);
  return Buffer.concat(parts);
}

/** An image's MIME type by its first bytes (null: not one glTF carries). */
export function imageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf[0] === 0xab && buf.toString('latin1', 1, 7) === 'KTX 20') return 'image/ktx2';
  return null;
}

// a 1×1 white PNG: an image a file names but did not bring stands in as this, so its material still reads (named)
const WHITE_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=', 'base64');

/** A relative URI a file names beside it, decoded, or null when it climbs out, is absolute or is a URL. */
export function safeRelative(uri) {
  if (typeof uri !== 'string' || !uri) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(uri) || uri.startsWith('/') || uri.startsWith('\\')) return null;
  let p;
  try { p = decodeURIComponent(uri); } catch { p = uri; }
  p = p.replace(/\\/g, '/');
  const out = [];
  for (const seg of p.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') return null;
    out.push(seg);
  }
  return out.length ? out.join('/') : null;
}

function dataUri(uri) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  return m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]), 'latin1');
}

/** Read a named neighbour: a data URI inline, else a safe relative path through `resolve`. */
function neighbour(uri, resolve, ledger, files) {
  if (uri.startsWith('data:')) return dataUri(uri);
  const rel = safeRelative(uri);
  if (!rel) { ledger.uris_refused.push(uri); return null; }
  const got = resolve ? resolve(rel) : null;
  if (got) files.push(rel);
  return got ?? null;
}

/**
 * Every buffer and image a glTF names, pulled into one binary buffer: the views moved onto it, the images given views.
 * `bin` is a GLB's own chunk (the buffer with no uri). Returns { json, bin, changed }.
 */
function embedAll(json, bin, resolve, ledger, files) {
  const buffers = json.buffers || [];
  const images = json.images || [];
  const external = buffers.some((b) => typeof b.uri === 'string') || images.some((im) => typeof im.uri === 'string');
  if (!external) return { json, bin, changed: false };
  const out = JSON.parse(JSON.stringify(json));
  const parts = [];
  let size = 0;
  const push = (buf) => { const at = align(size, 8); if (at > size) parts.push(Buffer.alloc(at - size)); parts.push(buf); size = at + buf.length; return at; };
  const base = buffers.map((b, i) => {
    let data;
    if (typeof b.uri !== 'string') {
      if (!bin) throw fail(`buffer ${i} names no file and the model carries no binary chunk`);
      data = bin;
    } else {
      data = neighbour(b.uri, resolve, ledger, files);
      if (!data) throw fail(`the geometry file '${b.uri}' the model names is not beside it (bring the folder or a zip of it)`);
    }
    if (data.length < (b.byteLength || 0)) throw fail(`buffer ${i} ('${b.uri ?? 'binary chunk'}') is ${data.length} bytes, shorter than the ${b.byteLength} it declares`);
    return push(data.subarray(0, b.byteLength ?? data.length));
  });
  for (const v of out.bufferViews || []) { v.byteOffset = (v.byteOffset || 0) + base[v.buffer ?? 0]; v.buffer = 0; }
  (out.images || []).forEach((im, i) => {
    if (typeof im.uri !== 'string') return;
    let data = neighbour(im.uri, resolve, ledger, files);
    let mime = data ? imageMime(data) : null;
    if (!data || !mime) { ledger.images_missing.push(im.uri); data = WHITE_PNG; mime = 'image/png'; }
    const at = push(data);
    out.bufferViews = out.bufferViews || [];
    out.bufferViews.push({ buffer: 0, byteOffset: at, byteLength: data.length });
    delete out.images[i].uri;
    out.images[i].bufferView = out.bufferViews.length - 1;
    out.images[i].mimeType = mime;
  });
  const merged = Buffer.concat(parts);
  out.buffers = merged.length ? [{ byteLength: merged.length }] : [];
  if (!merged.length) delete out.buffers;
  return { json: out, bin: merged, changed: true };
}

function refuseUnreadable(json) {
  const used = [...new Set([...(json.extensionsRequired || []), ...(json.extensionsUsed || [])])];
  const bad = used.filter((e) => UNREADABLE_EXTENSIONS[e]);
  if (bad.length) throw fail(`the model carries ${bad.map((e) => UNREADABLE_EXTENSIONS[e]).join(' and ')}, which is not read here: ${EXPORT_GLB}`);
}

// a turn at the scene's root, so a file that stands on another axis stands on glTF's y (its vertices untouched)
const S45 = Math.SQRT1_2;
function standOn(json, rotation) {
  const out = JSON.parse(JSON.stringify(json));
  out.nodes = out.nodes || [];
  const sceneIdx = out.scene ?? 0;
  const scene = out.scenes?.[sceneIdx];
  if (!scene) return out;
  out.nodes.push({ name: 'import-up', rotation, children: [...(scene.nodes || [])] });
  scene.nodes = [out.nodes.length - 1];
  return out;
}

// ── glTF ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function gltfToGlb(bytes, { resolve, ledger, files, glb }) {
  let json, bin = null;
  if (glb) ({ json, bin } = parseGlb(bytes));
  else {
    try { json = JSON.parse(bytes.toString('utf8').replace(/^﻿/, '')); } catch { throw fail('the .gltf is not JSON'); }
    if (!json?.asset || !/^2\./.test(String(json.asset.version || ''))) throw fail(`unsupported glTF asset version ${json?.asset?.version ?? '(none)'} (expected 2.x)`);
  }
  refuseUnreadable(json);
  const e = embedAll(json, bin, resolve, ledger, files);
  return { json: e.json, bin: e.bin, same: glb && !e.changed };
}

// ── OBJ ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const num = (s, d = 0) => { const v = Number(s); return Number.isFinite(v) ? v : d; };
const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;

/** The file a map line names after its options (`-s 1 1 1 -bm 0.5 tex.png` → `tex.png`). */
function mapFile(rest) {
  const t = rest.trim().split(/\s+/);
  let i = 0;
  while (i < t.length && /^-[a-z_]+$/i.test(t[i])) { i += 1; while (i < t.length - 1 && /^(-?[\d.]+(e-?\d+)?|on|off|[a-z])$/i.test(t[i]) && !/\.[a-z0-9]{2,4}$/i.test(t[i])) i += 1; }
  return t.slice(i).join(' ') || null;
}

/** An MTL as { <name>: { kd, d, map } }. */
export function readMtl(text) {
  const mats = {};
  let cur = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const sp = line.search(/\s/);
    const key = (sp < 0 ? line : line.slice(0, sp)).toLowerCase(), rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (key === 'newmtl') { cur = { kd: null, d: 1, map: null }; mats[rest] = cur; continue; }
    if (!cur) continue;
    if (key === 'kd') { const p = rest.split(/\s+/).map((x) => num(x, 1)); cur.kd = [p[0], p[1] ?? p[0], p[2] ?? p[0]]; }
    else if (key === 'd') cur.d = Math.min(1, Math.max(0, num(rest.split(/\s+/).pop(), 1)));
    else if (key === 'tr') cur.d = Math.min(1, Math.max(0, 1 - num(rest.split(/\s+/).pop(), 0)));
    else if (key === 'map_kd') cur.map = mapFile(rest);
  }
  return mats;
}

/**
 * An OBJ (and the MTLs and textures it names, through `resolve`) as a glTF: one mesh, a primitive per material in the
 * order it is first used, polygons fanned to triangles, each corner's position/uv/normal triple one vertex.
 */
function objToGltf(bytes, { resolve, ledger, files }) {
  const text = bytes.toString('utf8').replace(/\\\r?\n/g, ' ');
  const V = [], C = [], T = [], N = [];
  const prims = new Map(); // material name → { key → index, pos, uv, nrm, col, idx }
  const mtllibs = [];
  let mat = '', hasColour = false, faces = 0;
  const prim = (m) => { if (!prims.has(m)) prims.set(m, { keys: new Map(), pos: [], uv: [], nrm: [], col: [], idx: [], hasUv: false, hasNrm: false }); return prims.get(m); };
  const at = (s, list) => { const i = parseInt(s, 10); if (!Number.isFinite(i) || i === 0) return -1; return i > 0 ? i - 1 : list.length + i; };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line[0] === '#') continue;
    const sp = line.search(/\s/);
    const key = sp < 0 ? line : line.slice(0, sp), rest = sp < 0 ? '' : line.slice(sp + 1).trim();
    if (key === 'v') {
      const p = rest.split(/\s+/).map((x) => num(x));
      V.push([p[0] ?? 0, p[1] ?? 0, p[2] ?? 0]);
      if (p.length >= 6) { hasColour = true; C.push([p[3], p[4], p[5]]); } else C.push(null);
    } else if (key === 'vt') { const p = rest.split(/\s+/).map((x) => num(x)); T.push([p[0] ?? 0, p[1] ?? 0]); }
    else if (key === 'vn') { const p = rest.split(/\s+/).map((x) => num(x)); N.push([p[0] ?? 0, p[1] ?? 0, p[2] ?? 1]); }
    else if (key === 'usemtl') mat = rest;
    else if (key === 'mtllib') mtllibs.push(rest);
    else if (key === 'f') {
      const P = prim(mat);
      const corners = rest.split(/\s+/).map((tok) => {
        const [a, b, c] = tok.split('/');
        const vi = at(a, V), ti = b ? at(b, T) : -1, ni = c ? at(c, N) : -1;
        if (vi < 0 || vi >= V.length) return null;
        const k = `${vi}/${ti}/${ni}`;
        if (!P.keys.has(k)) {
          P.keys.set(k, P.pos.length / 3);
          P.pos.push(...V[vi]);
          if (ti >= 0 && ti < T.length) { P.uv.push(T[ti][0], 1 - T[ti][1]); P.hasUv = true; } else P.uv.push(0, 0);
          if (ni >= 0 && ni < N.length) { P.nrm.push(...N[ni]); P.hasNrm = true; } else P.nrm.push(0, 0, 1);
          const c3 = C[vi] ?? [1, 1, 1];
          P.col.push(toLinear(c3[0]), toLinear(c3[1]), toLinear(c3[2]));
        }
        return P.keys.get(k);
      }).filter((x) => x !== null);
      for (let i = 1; i + 1 < corners.length; i++) { P.idx.push(corners[0], corners[i], corners[i + 1]); faces += 1; }
    }
  }
  if (!faces) throw fail('the OBJ has no faces (no `f` lines that name its vertices)');
  // its materials, from every MTL it names that came with it
  const mtl = {};
  for (const lib of mtllibs) {
    const got = neighbour(lib, resolve, ledger, files);
    if (got) Object.assign(mtl, readMtl(got.toString('utf8')));
    else ledger.notes.push(`its material file '${lib}' did not come with it: its surfaces are grey`);
  }
  const json = { asset: { version: '2.0', generator: 'mojulo import (obj)' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ name: 'obj', mesh: 0 }], meshes: [{ name: 'obj', primitives: [] }], accessors: [], bufferViews: [], materials: [] };
  const parts = [];
  let size = 0;
  const pushView = (buf, target) => {
    const at2 = align(size, 4); if (at2 > size) parts.push(Buffer.alloc(at2 - size)); parts.push(buf); size = at2 + buf.length;
    json.bufferViews.push({ buffer: 0, byteOffset: at2, byteLength: buf.length, ...(target ? { target } : {}) });
    return json.bufferViews.length - 1;
  };
  const f32 = (arr) => { const b = Buffer.alloc(arr.length * 4); arr.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; };
  const accessor = (arr, type, width, extra = {}) => {
    const view = pushView(f32(arr), 34962);
    json.accessors.push({ bufferView: view, componentType: 5126, count: arr.length / width, type, ...extra });
    return json.accessors.length - 1;
  };
  const images = new Map();
  const imageOf = (file) => {
    if (images.has(file)) return images.get(file);
    const data = neighbour(file, resolve, ledger, files);
    const mime = data ? imageMime(data) : null;
    let idx = null;
    if (data && mime) {
      json.images = json.images || []; json.textures = json.textures || [];
      json.images.push({ bufferView: pushView(data), mimeType: mime, name: file });
      json.textures.push({ source: json.images.length - 1 });
      idx = json.textures.length - 1;
    } else ledger.images_missing.push(file);
    images.set(file, idx);
    return idx;
  };
  const matIndex = new Map();
  const materialFor = (name) => {
    if (matIndex.has(name)) return matIndex.get(name);
    const m = mtl[name];
    const tex = m?.map ? imageOf(m.map) : null;
    const kd = tex != null ? [1, 1, 1] : (m?.kd ? m.kd.map(toLinear) : [0.8, 0.8, 0.8]);
    const d = m ? m.d : 1;
    json.materials.push({
      name: name || 'default',
      pbrMetallicRoughness: { baseColorFactor: [...kd.map(r6), r6(d)], metallicFactor: 0, roughnessFactor: 0.9, ...(tex != null ? { baseColorTexture: { index: tex } } : {}) },
      ...(d < 1 ? { alphaMode: 'BLEND' } : {}), doubleSided: true,
    });
    matIndex.set(name, json.materials.length - 1);
    return json.materials.length - 1;
  };
  for (const [name, P] of prims) {
    if (!P.idx.length) continue;
    const count = P.pos.length / 3;
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < count; i++) for (let k = 0; k < 3; k++) { const v = P.pos[i * 3 + k]; if (v < min[k]) min[k] = v; if (v > max[k]) max[k] = v; }
    const attributes = { POSITION: accessor(P.pos, 'VEC3', 3, { min: min.map(r6), max: max.map(r6) }) };
    if (P.hasNrm) attributes.NORMAL = accessor(P.nrm, 'VEC3', 3);
    if (P.hasUv) attributes.TEXCOORD_0 = accessor(P.uv, 'VEC2', 2);
    if (hasColour) attributes.COLOR_0 = accessor(P.col, 'VEC3', 3);
    const big = count > 65535;
    const ib = Buffer.alloc(P.idx.length * (big ? 4 : 2));
    P.idx.forEach((v, i) => (big ? ib.writeUInt32LE(v, i * 4) : ib.writeUInt16LE(v, i * 2)));
    const iv = pushView(ib, 34963);
    json.accessors.push({ bufferView: iv, componentType: big ? 5125 : 5123, count: P.idx.length, type: 'SCALAR' });
    json.meshes[0].primitives.push({ attributes, indices: json.accessors.length - 1, material: materialFor(name), mode: 4 });
  }
  const bin = Buffer.concat(parts);
  json.buffers = [{ byteLength: bin.length }];
  if (!json.images) delete json.images;
  return { json, bin, faces };
}

// ── STL / 3MF (the path bind_mesh_render had) ────────────────────────────────────────────────────────────────────────
async function meshToGlb(bytes, name) {
  const faces = meshFileToFaces(bytes, name);
  if (!faces || !faces.length) throw fail(`${name}: no triangle geometry could be read from the file`);
  const { facesToGlb } = await import('../scene/scene-gltf.js');
  const glb = facesToGlb({ faces }, { generator: 'mojulo import' });
  if (!glb) throw fail(`${name}: the mesh could not be written as a GLB`);
  return { bytes: glb.bytes, triangles: faces.length };
}

// ── zip ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
const RANK = { glb: 0, vrm: 0, gltf: 1, obj: 2, stl: 3, '3mf': 3 };
/** The model files a set of names holds, best first (a GLB before a glTF before an OBJ before a print mesh), skipping
 * the clutter archivers leave (`__MACOSX/`, dot files). */
export function modelCandidates(names) {
  return names
    .filter((n) => !/(^|\/)(__MACOSX|\.)/.test(n) && RANK[extOf(n)] !== undefined)
    .sort((a, b) => RANK[extOf(a)] - RANK[extOf(b)] || a.split('/').length - b.split('/').length || (a < b ? -1 : a > b ? 1 : 0));
}

/** Pick the one model a folder or a zip holds: the `entry` named, else the single best; several equally good → ask. */
export function pickEntry(names, entry = null, where = 'the zip') {
  if (entry) {
    const want = safeRelative(entry);
    if (!want || !names.includes(want)) throw fail(`'${entry}' is not in ${where}${names.length ? ` (models in it: ${modelCandidates(names).slice(0, 12).join(', ')})` : ''}`);
    return want;
  }
  const c = modelCandidates(names);
  if (!c.length) throw fail(`${where} holds no model mojulo reads (${Object.keys(IMPORT_FORMATS).filter((k) => k !== 'zip').join(', ')})`);
  const best = c.filter((n) => RANK[extOf(n)] === RANK[extOf(c[0])]);
  if (best.length > 1) throw fail(`${where} holds ${best.length} models; name the one meant as \`entry\`: ${best.slice(0, 12).join(', ')}${best.length > 12 ? ', …' : ''}`);
  return c[0];
}

const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');
/** A resolver over a map of files by their path, for the model at `entry` (names it gives are relative to its folder). */
export function resolverOver(files, entry) {
  const base = dirOf(entry);
  return (rel) => {
    const joined = safeRelative(base + rel);
    return joined && files.has(joined) ? files.get(joined) : (files.get(rel) ?? null);
  };
}

// ── the door ─────────────────────────────────────────────────────────────────────────────────────────────────────────
/** A file as the canonical GLB: { bytes, from, ledger }. */
export async function toGlb(bytes, name, { resolve = null, entry = null, up = null } = {}) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (up !== null && up !== 'y' && up !== 'z') throw fail("`up` is 'y' or 'z' (the axis the file stands on)");
  let ext = extOf(name);
  const isZip = bytes.length > 4 && bytes.readUInt32LE(0) === 0x04034b50;
  const isGlb = bytes.length > 4 && bytes.readUInt32LE(0) === 0x46546c67;
  if (FORMATS_REFUSED[ext]) throw fail(FORMATS_REFUSED[ext]);
  if (isGlb && ext !== 'vrm') ext = 'glb';
  if (isZip && ext !== '3mf') {
    const files = unzipEntries(bytes);
    const names = [...files.keys()];
    if (names.includes('3D/3dmodel.model')) ext = '3mf';
    else {
      const pick = pickEntry(names, entry);
      const inner = await toGlb(files.get(pick), pick, { resolve: resolverOver(files, pick), up });
      return { ...inner, from: { ...inner.from, container: 'zip', entry: pick } };
    }
  }
  if (!IMPORT_FORMATS[ext] || ext === 'zip') throw fail(`'${name}' is not a format mojulo reads (${Object.keys(IMPORT_FORMATS).join(', ')}): ${EXPORT_GLB}`);
  const ledger = { images_missing: [], uris_refused: [], notes: [] };
  const files = [];
  const own = IMPORT_FORMATS[ext].up;
  const stands = up ?? own;
  let out;
  if (ext === 'stl' || ext === '3mf') {
    const m = await meshToGlb(bytes, name);
    out = m.bytes;
    // a print mesh stands on z, as mojulo's own frame does; one written standing on y is turned at its root
    if (stands === 'y') { const { json, bin } = parseGlb(out); out = packGlb(standOn(json, [S45, 0, 0, S45]), bin && Buffer.from(bin)); }
  } else {
    let json, bin, same = false;
    if (ext === 'obj') ({ json, bin } = objToGltf(bytes, { resolve, ledger, files }));
    else ({ json, bin, same } = gltfToGlb(bytes, { resolve, ledger, files, glb: ext === 'glb' || ext === 'vrm' }));
    // glTF and OBJ stand on y; one written standing on z is turned at its root
    if (stands === 'z') { json = standOn(json, [-S45, 0, 0, S45]); same = false; }
    out = same ? bytes : packGlb(json, bin && Buffer.from(bin));
  }
  // the door's own check: what comes out parses as the GLB every reader after this reads
  parseGlb(out);
  if (ledger.images_missing.length) ledger.notes.push(`${ledger.images_missing.length} image${ledger.images_missing.length === 1 ? '' : 's'} it names did not come with it: ${ledger.images_missing.slice(0, 4).join(', ')} (bring the folder, or a zip of it)`);
  return { bytes: out, from: { format: ext, files, up: stands }, ledger };
}
