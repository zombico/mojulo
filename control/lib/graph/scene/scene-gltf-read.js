/**
 * scene-gltf-read — decode a binary glTF (.glb) BACK into the face-list currency
 * (interchange.plan.md I3, the bind-back door).
 *
 * The inverse of scene-gltf.js's facesToGlb, deliberately lowered SERVER-SIDE at
 * resolve time: an externally refined mesh (a Blender pass over an export_model
 * file, bound via bind_mesh_render) re-enters the substrate as the same
 * `{ corners, fill }` face list every emitter already consumes, so the whole
 * pipeline (SVG / CSS-3D / three / live world / re-export) renders it with ZERO
 * emitted-page changes — no runtime GLB loader ever ships (that would change
 * emitted bytes and fight the char net).
 *
 * Decoding rules:
 * - indexed AND non-indexed TRIANGLES primitives → one face per triangle,
 *   padded to the [a,b,c,c] quad the World mesh builder expects
 *   (padTrianglesForWorld's convention — the second split tri is degenerate).
 * - colour: COLOR_0 vertex colours when present (float, or normalized
 *   ubyte/ushort), else the material's baseColorFactor. glTF colours are LINEAR;
 *   faces carry sRGB hex (`fill`, per-corner `cornerFills` when the triangle is
 *   not flat-coloured) — the exact inverse of face-mesh's srgbToLinear.
 * - node TRS (or `matrix`) applied down the scene tree, then the GLOBAL
 *   y-up → z-up conversion — the inverse of the writer's 'mojulo' root rotation
 *   (-90° about X), so a mojulo-exported GLB round-trips to identical coords.
 *
 * Textures (interchange-seams.plan.md seam 6b, 2026-09-06): a primitive carrying
 * TEXCOORD_0 under a material with a baseColorTexture lowers to the currency's own
 * texture-wrap form — faces get `{ texture: key, uv: [[u,v]×4] }` (+ `textureLit`
 * when COLOR_0 rides too) and the embedded PNG / JPEG is re-hoisted, byte-preserved,
 * into a `textures` map (data URL) — exactly the shape facesToGlb consumed, so a
 * writer → reader → writer round trip is byte-identical (`glbToScene`). The key is
 * the material's (else the node's) name after its last ':' — the writer's own
 * `<group>:<key>` spelling — so a Blender pass that repaints the SHIPPED albedo
 * comes home under the same key. UVs travel RAW (the writer's convention).
 *
 * Deliberate limits (noted, not solved):
 * - normal / roughness-metallic / occlusion / emissive MAPS are dropped and COUNTED
 *   (`ledger.maps_dropped`); non-PNG/JPEG images, external image URIs and
 *   TEXCOORD_1+ bindings are dropped and NAMED (`ledger.textures_dropped`);
 * - animations, skins, morph targets are ignored (an imported mesh is scenery
 *   first, a body later if ever);
 * - PBR factors flatten to the baked colour (the substrate's unlit doctrine);
 * - compressed (Draco/meshopt) and sparse accessors are refused loudly — re-export
 *   from the DCC without compression. (Quantized accessors — KHR_mesh_quantization —
 *   decode fine: normalized ints + the mesh node's dequantizing TRS.)
 *
 * Pure Buffer work — no three.js, no deps; unit-testable in node.
 */

import { readFileSync, statSync } from 'node:fs';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
const MODE_TRIANGLES = 4;

// componentType → { bytes, read } (little-endian, per glTF 2.0 §3.6.2.2)
const COMPONENTS = {
  5120: { bytes: 1, read: (b, o) => b.readInt8(o), norm: 127 },
  5121: { bytes: 1, read: (b, o) => b.readUInt8(o), norm: 255 },
  5122: { bytes: 2, read: (b, o) => b.readInt16LE(o), norm: 32767 },
  5123: { bytes: 2, read: (b, o) => b.readUInt16LE(o), norm: 65535 },
  5125: { bytes: 4, read: (b, o) => b.readUInt32LE(o) },
  5126: { bytes: 4, read: (b, o) => b.readFloatLE(o) },
};
const TYPE_COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

/**
 * parseGlb(buf) → { json, bin } — strict structural validation (the bind-time
 * machine gate): magic, version, declared length, chunk layout, JSON parse.
 * Throws a descriptive error on anything that is not a well-formed GLB.
 */
export function parseGlb(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 20) {
    throw new Error('not a GLB: file too short for a glTF binary header');
  }
  if (buf.readUInt32LE(0) !== GLB_MAGIC) {
    throw new Error("not a GLB: missing 'glTF' magic (a .gltf JSON, or not glTF at all?)");
  }
  const version = buf.readUInt32LE(4);
  if (version !== 2) throw new Error(`unsupported GLB container version ${version} (expected 2)`);
  const declared = buf.readUInt32LE(8);
  if (declared !== buf.length) {
    throw new Error(`corrupt GLB: header declares ${declared} bytes but the file is ${buf.length}`);
  }
  // chunk walk — first chunk MUST be JSON; an optional BIN chunk follows.
  let o = 12;
  let json = null;
  let bin = null;
  while (o < buf.length) {
    if (o + 8 > buf.length) throw new Error('corrupt GLB: truncated chunk header');
    const len = buf.readUInt32LE(o);
    const type = buf.readUInt32LE(o + 4);
    const start = o + 8;
    if (start + len > buf.length) throw new Error('corrupt GLB: chunk overruns the file');
    if (json === null) {
      if (type !== CHUNK_JSON) throw new Error('corrupt GLB: first chunk is not JSON');
      try {
        json = JSON.parse(buf.toString('utf8', start, start + len));
      } catch {
        throw new Error('corrupt GLB: JSON chunk does not parse');
      }
    } else if (type === CHUNK_BIN && bin === null) {
      bin = buf.subarray(start, start + len);
    }
    o = start + len;
  }
  if (!json || typeof json !== 'object') throw new Error('corrupt GLB: no JSON chunk');
  if (!json.asset || !/^2\./.test(String(json.asset.version || ''))) {
    throw new Error(`unsupported glTF asset version ${json?.asset?.version ?? '(none)'} (expected 2.x)`);
  }
  return { json, bin };
}

// ── minimal column-major 4x4 math (glTF's matrix convention) ─────────────────
export const IDENT = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function mul4(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// node TRS → column-major matrix (T · R · S, per glTF §5.25)
export function trsMatrix(node) {
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return node.matrix;
  const [tx, ty, tz] = node.translation || [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation || [0, 0, 0, 1];
  const s = node.scale || [1, 1, 1];
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    tx, ty, tz, 1,
  ];
}

export const xfPoint = (m, x, y, z) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

// linear (0..1) → sRGB hex channel — the inverse of face-mesh's srgbToLinear.
function linearToSrgb(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const rgbHex = (r, g, b) => `#${hex2(linearToSrgb(r))}${hex2(linearToSrgb(g))}${hex2(linearToSrgb(b))}`;

// Decode one accessor into a flat number array (denormalized when `normalized`).
function readAccessor(json, bin, idx) {
  const acc = json.accessors?.[idx];
  if (!acc) throw new Error(`corrupt glTF: missing accessor ${idx}`);
  if (acc.sparse) throw new Error('unsupported glTF: sparse accessors (re-export without sparse encoding)');
  const comp = COMPONENTS[acc.componentType];
  const width = TYPE_COMPONENTS[acc.type];
  if (!comp || !width) throw new Error(`unsupported glTF accessor (componentType ${acc.componentType}, type ${acc.type})`);
  const out = new Array(acc.count * width);
  if (acc.bufferView == null) return out.fill(0); // spec: zero-initialized
  const view = json.bufferViews?.[acc.bufferView];
  if (!view || !bin) throw new Error('corrupt glTF: accessor points at a missing bufferView/BIN chunk');
  const stride = view.byteStride || comp.bytes * width;
  const base = (view.byteOffset || 0) + (acc.byteOffset || 0);
  for (let i = 0; i < acc.count; i++) {
    for (let k = 0; k < width; k++) {
      const o = base + i * stride + k * comp.bytes;
      if (o + comp.bytes > (view.byteOffset || 0) + view.byteLength) throw new Error('corrupt glTF: accessor reads past its bufferView');
      let v = comp.read(bin, o);
      if (acc.normalized && comp.norm) v = Math.max(-1, v / comp.norm);
      out[i * width + k] = v;
    }
  }
  return out;
}

/**
 * glbToScene(buf, { group }) → { faces, textures, ledger } — the whole decode: parse,
 * walk the scene tree applying node transforms, lower every TRIANGLES primitive to
 * padded [a,b,c,c] quad faces in mojulo's z-up frame. Every face carries `fill` (and
 * `cornerFills` when its three corners differ) plus the render `group`; textured
 * primitives add `texture` + per-corner `uv` (seam 6b) and their image lands in
 * `textures`. `ledger` names what did not travel.
 */
export function glbToScene(buf, { group = 'mesh' } = {}) {
  const { json, bin } = parseGlb(buf);
  const faces = [];
  const textures = {};
  const ledger = { textures_carried: [], textures_dropped: [], maps_dropped: { normal: 0, occlusion: 0, emissive: 0, metallicRoughness: 0 } };

  const materialColor = (mi) => {
    const f = json.materials?.[mi]?.pbrMetallicRoughness?.baseColorFactor;
    return Array.isArray(f) ? f : [1, 1, 1, 1];
  };

  // ── textures (seam 6b) ────────────────────────────────────────────────────
  const imageOf = (texIdx) => {
    const tex = json.textures?.[texIdx];
    const img = tex ? json.images?.[tex.source] : null;
    if (!img) return { url: null, reason: 'texture points at no image' };
    if (typeof img.uri === 'string') {
      const m = /^data:(image\/(?:png|jpeg|jpg));base64,/i.exec(img.uri);
      if (m) return { url: img.uri, mime: /jpe?g/i.test(m[1]) ? 'image/jpeg' : 'image/png', bytes: Math.floor((img.uri.length - m[0].length) * 3 / 4) };
      return { url: null, reason: img.uri.startsWith('data:') ? `unsupported image type (${img.uri.slice(5, 40).split(';')[0]})` : 'external image uri — not carried' };
    }
    const mime = /jpe?g/i.test(img.mimeType || '') ? 'image/jpeg' : img.mimeType === 'image/png' ? 'image/png' : null;
    if (!mime) return { url: null, reason: `unsupported image type (${img.mimeType || 'unknown'})` };
    const view = json.bufferViews?.[img.bufferView];
    if (!view || !bin) return { url: null, reason: 'image bufferView missing' };
    const bytes = bin.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    return { url: `data:${mime};base64,${bytes.toString('base64')}`, mime, bytes: view.byteLength };
  };
  const keyOwner = new Map(); // key → texIdx (first claimant keeps the plain key)
  const keyByTex = new Map(); // texIdx → key
  const keyFor = (texIdx, mat, nodeName) => {
    if (keyByTex.has(texIdx)) return keyByTex.get(texIdx);
    const raw = (typeof mat?.name === 'string' && mat.name) || (typeof nodeName === 'string' && nodeName) || `tex${texIdx}`;
    const base = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) || raw : raw;
    const key = keyOwner.has(base) && keyOwner.get(base) !== texIdx ? `${base}#${texIdx}` : base;
    keyOwner.set(key, texIdx);
    keyByTex.set(texIdx, key);
    return key;
  };
  const mapsSeen = new Set();
  const countMaps = (mi, mat) => {
    if (mapsSeen.has(mi) || !mat) return;
    mapsSeen.add(mi);
    if (mat.normalTexture) ledger.maps_dropped.normal++;
    if (mat.occlusionTexture) ledger.maps_dropped.occlusion++;
    if (mat.emissiveTexture) ledger.maps_dropped.emissive++;
    if (mat.pbrMetallicRoughness?.metallicRoughnessTexture) ledger.maps_dropped.metallicRoughness++;
  };
  // → { key, uvs, lit } when this primitive's albedo texture can travel, else null (reason ledgered)
  const textureFor = (prim, nodeName) => {
    const mi = prim.material;
    const mat = json.materials?.[mi];
    countMaps(mi, mat);
    const bct = mat?.pbrMetallicRoughness?.baseColorTexture;
    if (!bct || bct.index == null) return null;
    const key = keyFor(bct.index, mat, nodeName);
    const set = bct.texCoord ?? 0;
    const uvIdx = prim.attributes?.[`TEXCOORD_${set}`];
    if (set !== 0 || uvIdx == null) {
      ledger.textures_dropped.push({ key, reason: set !== 0 ? `bound to TEXCOORD_${set} — only TEXCOORD_0 is carried` : 'primitive has no TEXCOORD_0' });
      return null;
    }
    if (!(key in textures)) {
      const img = imageOf(bct.index);
      if (!img.url) { ledger.textures_dropped.push({ key, reason: img.reason }); return null; }
      textures[key] = img.url;
      ledger.textures_carried.push({ key, mime: img.mime, bytes: img.bytes });
    }
    return { key, uvs: readAccessor(json, bin, uvIdx) };
  };

  const lowerPrimitive = (prim, m, nodeName) => {
    if ((prim.mode ?? MODE_TRIANGLES) !== MODE_TRIANGLES) return; // points/lines have no face form
    if (prim.extensions && (prim.extensions.KHR_draco_mesh_compression || prim.extensions.EXT_meshopt_compression)) {
      throw new Error('unsupported glTF: compressed geometry (Draco/meshopt) — re-export without compression');
    }
    const posIdx = prim.attributes?.POSITION;
    if (posIdx == null) return;
    // POSITION may be float, or a (normalized) integer accessor under KHR_mesh_quantization —
    // readAccessor denormalizes, and the node walk applies the dequantizing TRS the writer put
    // on the mesh node (interchange-seams.plan.md seam 6a).
    const pos = readAccessor(json, bin, posIdx);
    const colIdx = prim.attributes.COLOR_0;
    const col = colIdx != null ? readAccessor(json, bin, colIdx) : null;
    const colW = colIdx != null ? TYPE_COMPONENTS[json.accessors[colIdx].type] : 0;
    const tex = textureFor(prim, nodeName);
    const base = materialColor(prim.material);
    const baseHex = rgbHex(base[0], base[1], base[2]);
    const alpha = base[3] < 1 ? base[3] : null;
    const idx = prim.indices != null ? readAccessor(json, bin, prim.indices) : null;
    const count = idx ? idx.length : pos.length / 3;
    // world-space (y-up) → mojulo z-up: (x, y, z) → (x, -z, y) — the inverse of
    // scene-gltf's ZUP_TO_YUP root rotation.
    const corner = (vi) => {
      const p = xfPoint(m, pos[vi * 3], pos[vi * 3 + 1], pos[vi * 3 + 2]);
      return [p[0], -p[2], p[1]];
    };
    const cornerHex = (vi) => (col ? rgbHex(col[vi * colW], col[vi * colW + 1], col[vi * colW + 2]) : baseHex);
    for (let t = 0; t + 2 < count; t += 3) {
      const vis = [0, 1, 2].map((k) => (idx ? idx[t + k] : t + k));
      const c = vis.map(corner);
      const hexes = vis.map(cornerHex);
      const face = { corners: [c[0], c[1], c[2], [...c[2]]], fill: hexes[0], group };
      if (hexes[1] !== hexes[0] || hexes[2] !== hexes[0]) face.cornerFills = [hexes[0], hexes[1], hexes[2], hexes[2]];
      if (alpha != null) face.alpha = alpha;
      if (tex) {
        const uv = vis.map((vi) => [tex.uvs[vi * 2], tex.uvs[vi * 2 + 1]]);
        face.texture = tex.key;
        face.uv = [uv[0], uv[1], uv[2], [...uv[2]]];
        if (col) face.textureLit = true; // texel × baked colour, the writer's COLOR_0 rule
      }
      faces.push(face);
    }
  };

  const walk = (nodeIdx, parentM, seen) => {
    if (seen.has(nodeIdx)) return; // cycle guard on malformed files
    seen.add(nodeIdx);
    const node = json.nodes?.[nodeIdx];
    if (!node) return;
    const m = mul4(parentM, trsMatrix(node));
    if (node.mesh != null) {
      for (const prim of json.meshes?.[node.mesh]?.primitives || []) lowerPrimitive(prim, m, node.name);
    }
    for (const child of node.children || []) walk(child, m, seen);
    seen.delete(nodeIdx);
  };

  const roots = json.scenes?.[json.scene ?? 0]?.nodes
    ?? (json.nodes || []).map((_, i) => i).filter((i) => !(json.nodes || []).some((n) => n.children?.includes(i)));
  // A `mojulo` root carrying `moj:metersPerUnit` was scaled by the WRITER so importers receive
  // metres (the floorplan is authored in feet). Reading back is the inverse door: faces return
  // in the recipe's own units — a 10 ft edge reads as 10 — and the factor rides the ledger
  // (world-contract-tiers W2). A uniform scale commutes with the root rotation, so walking from
  // the inverse scale is exact. Without the extra (a foreign GLB, a metre kind) nothing changes.
  const rootUnitScale = (node) => {
    const mpu = Number(node?.extras?.['moj:metersPerUnit']);
    if (!(Number.isFinite(mpu) && mpu > 0 && mpu !== 1) || !Array.isArray(node.scale)) return null;
    return node.scale.every((s) => Math.abs(s - mpu) < 1e-9) ? mpu : null;
  };
  for (const r of roots) {
    const mpu = rootUnitScale(json.nodes?.[r]);
    if (mpu) ledger.metersPerUnit = mpu;
    const inv = mpu ? 1 / mpu : 1;
    walk(r, mpu ? [inv, 0, 0, 0, 0, inv, 0, 0, 0, 0, inv, 0, 0, 0, 0, 1] : IDENT, new Set());
  }
  return { faces, textures, ledger };
}

/** glbToFaces(buf, { group }) → faces[] — the face-list view of glbToScene. */
export function glbToFaces(buf, opts = {}) {
  return glbToScene(buf, opts).faces;
}

// ── bound-mesh decode cache (the AO_CACHE discipline, effects/ao-bake.js) ────
// The decode is a pure function of the file bytes; bound artifacts are
// append-only (never edited in place), so (path, mtime, size) keys a safe
// in-process LRU. Cached faces are TEMPLATES: every read returns fresh clones
// with the caller's transform baked, so no stale face objects ever cross
// resolves (downstream channels mutate faces).
const MESH_CACHE = new Map();
const MESH_CACHE_MAX = 8;

function cloneFace(f, group) {
  const out = { ...f, corners: f.corners.map((c) => [...c]), group };
  if (f.cornerFills) out.cornerFills = [...f.cornerFills];
  if (f.uv) out.uv = f.uv.map((p) => [...p]);
  return out;
}

/**
 * readBoundMeshScene(filePath, { transform, group }) → { faces, textures, ledger }
 *
 * Read + decode a bound .glb (LRU-memoized per file version) and bake the
 * placement transform into the corners, z-up frame:
 *   p' = pos + Rz(rotZ) · (scale · p)
 * `transform` accepts { pos|position:[x,y,z], rotZ|rotation:<radians about +Z>,
 * scale:<number> } — the instanced-repeats convention.
 */
export function readBoundMeshScene(filePath, { transform = null, group = 'mesh' } = {}) {
  const st = statSync(filePath);
  const key = `${filePath}:${st.mtimeMs}:${st.size}`;
  let hit = MESH_CACHE.get(key);
  if (hit) {
    MESH_CACHE.delete(key);
    MESH_CACHE.set(key, hit); // refresh LRU recency
  } else {
    hit = glbToScene(readFileSync(filePath), { group });
    MESH_CACHE.set(key, hit);
    if (MESH_CACHE.size > MESH_CACHE_MAX) MESH_CACHE.delete(MESH_CACHE.keys().next().value);
  }
  const t = transform && typeof transform === 'object' ? transform : {};
  const pos = Array.isArray(t.pos) ? t.pos : Array.isArray(t.position) ? t.position : [0, 0, 0];
  const rotZ = Number.isFinite(t.rotZ) ? t.rotZ : Number.isFinite(t.rotation) ? t.rotation : 0;
  const scale = Number.isFinite(t.scale) && t.scale > 0 ? t.scale : 1;
  const cos = Math.cos(rotZ), sin = Math.sin(rotZ);
  const faces = hit.faces.map((f) => {
    const out = cloneFace(f, group);
    for (const c of out.corners) {
      const x = c[0] * scale, y = c[1] * scale, z = c[2] * scale;
      c[0] = x * cos - y * sin + (pos[0] || 0);
      c[1] = x * sin + y * cos + (pos[1] || 0);
      c[2] = z + (pos[2] || 0);
    }
    return out;
  });
  return { faces, textures: { ...hit.textures }, ledger: hit.ledger };
}

/** readBoundMeshFaces(filePath, opts) → faces[] — the face-list view of readBoundMeshScene. */
export function readBoundMeshFaces(filePath, opts = {}) {
  return readBoundMeshScene(filePath, opts).faces;
}
