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
 * v1 limitations, deliberate (interchange.plan.md I3 — noted, not solved):
 * - textures are DROPPED (baseColor/vertex colour only);
 * - animations, skins, morph targets are ignored (an imported mesh is scenery
 *   first, a body later if ever);
 * - PBR flattens to the baked colour (the substrate's unlit doctrine);
 * - compressed (Draco/meshopt), quantized-position, and sparse accessors are
 *   refused loudly — re-export from the DCC without compression.
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
const IDENT = Object.freeze([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

function mul4(a, b) {
  const out = new Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

// node TRS → column-major matrix (T · R · S, per glTF §5.25)
function trsMatrix(node) {
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

const xfPoint = (m, x, y, z) => [
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
 * glbToFaces(buf, { group }) → faces[] — the whole decode: parse, walk the scene
 * tree applying node transforms, lower every TRIANGLES primitive to padded
 * [a,b,c,c] quad faces in mojulo's z-up frame. Every face carries `fill` (and
 * `cornerFills` when its three corners differ) plus the render `group`.
 */
export function glbToFaces(buf, { group = 'mesh' } = {}) {
  const { json, bin } = parseGlb(buf);
  const faces = [];

  const materialColor = (mi) => {
    const f = json.materials?.[mi]?.pbrMetallicRoughness?.baseColorFactor;
    return Array.isArray(f) ? f : [1, 1, 1, 1];
  };

  const lowerPrimitive = (prim, m) => {
    if ((prim.mode ?? MODE_TRIANGLES) !== MODE_TRIANGLES) return; // points/lines have no face form
    if (prim.extensions && (prim.extensions.KHR_draco_mesh_compression || prim.extensions.EXT_meshopt_compression)) {
      throw new Error('unsupported glTF: compressed geometry (Draco/meshopt) — re-export without compression');
    }
    const posIdx = prim.attributes?.POSITION;
    if (posIdx == null) return;
    const posAcc = json.accessors?.[posIdx];
    if (posAcc?.componentType !== 5126) {
      throw new Error('unsupported glTF: non-float POSITION (KHR_mesh_quantization?) — re-export unquantized');
    }
    const pos = readAccessor(json, bin, posIdx);
    const colIdx = prim.attributes.COLOR_0;
    const col = colIdx != null ? readAccessor(json, bin, colIdx) : null;
    const colW = colIdx != null ? TYPE_COMPONENTS[json.accessors[colIdx].type] : 0;
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
      for (const prim of json.meshes?.[node.mesh]?.primitives || []) lowerPrimitive(prim, m);
    }
    for (const child of node.children || []) walk(child, m, seen);
    seen.delete(nodeIdx);
  };

  const roots = json.scenes?.[json.scene ?? 0]?.nodes
    ?? (json.nodes || []).map((_, i) => i).filter((i) => !(json.nodes || []).some((n) => n.children?.includes(i)));
  for (const r of roots) walk(r, IDENT, new Set());
  return faces;
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
  return out;
}

/**
 * readBoundMeshFaces(filePath, { transform, group }) → faces[]
 *
 * Read + decode a bound .glb (LRU-memoized per file version) and bake the
 * placement transform into the corners, z-up frame:
 *   p' = pos + Rz(rotZ) · (scale · p)
 * `transform` accepts { pos|position:[x,y,z], rotZ|rotation:<radians about +Z>,
 * scale:<number> } — the instanced-repeats convention.
 */
export function readBoundMeshFaces(filePath, { transform = null, group = 'mesh' } = {}) {
  const st = statSync(filePath);
  const key = `${filePath}:${st.mtimeMs}:${st.size}`;
  let hit = MESH_CACHE.get(key);
  if (hit) {
    MESH_CACHE.delete(key);
    MESH_CACHE.set(key, hit); // refresh LRU recency
  } else {
    hit = glbToFaces(readFileSync(filePath), { group });
    MESH_CACHE.set(key, hit);
    if (MESH_CACHE.size > MESH_CACHE_MAX) MESH_CACHE.delete(MESH_CACHE.keys().next().value);
  }
  const t = transform && typeof transform === 'object' ? transform : {};
  const pos = Array.isArray(t.pos) ? t.pos : Array.isArray(t.position) ? t.position : [0, 0, 0];
  const rotZ = Number.isFinite(t.rotZ) ? t.rotZ : Number.isFinite(t.rotation) ? t.rotation : 0;
  const scale = Number.isFinite(t.scale) && t.scale > 0 ? t.scale : 1;
  const cos = Math.cos(rotZ), sin = Math.sin(rotZ);
  return hit.map((f) => {
    const out = cloneFace(f, group);
    for (const c of out.corners) {
      const x = c[0] * scale, y = c[1] * scale, z = c[2] * scale;
      c[0] = x * cos - y * sin + (pos[0] || 0);
      c[1] = x * sin + y * cos + (pos[1] || 0);
      c[2] = z + (pos[2] || 0);
    }
    return out;
  });
}
