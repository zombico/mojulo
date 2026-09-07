/**
 * scene-gltf — export a baked face list as a binary glTF (.glb).
 *
 * This is a SECOND consumer of the exact `{ faces, textures, light }` payload
 * `emitThreeWorld` (scene-three.js) renders, so a stored world and its export
 * share one geometry and one baked-lighting solve. Instead of a live WebGL canvas
 * it serializes the same triangle soup to a portable .glb that opens identically
 * in Blender / Unreal / three.js / macOS Quick Look.
 *
 * Fidelity model: mojulo's lighting is BAKED into each face's colour and the World
 * renders it UNLIT (MeshBasicMaterial + vertexColors). glTF has the exact
 * counterpart — KHR_materials_unlit + COLOR_0 vertex colours — so the export is a
 * faithful capture of what is depicted, not a lossy PBR approximation. We emit no
 * lights and no metalness/roughness intent; the depiction IS the asset.
 *
 * Coverage vs the World: opaque/lit geometry (one node per render group), the
 * translucent water sheet (per-vertex alpha), and the flat shadow/ink ground decals
 * all export. Camera-facing billboards (glow sprites) and the world-fixed sky dome
 * are screen/background embellishments, not geometry, so they are dropped. Gradient-
 * painted faces collapse to a single representative colour (the same trade the World
 * makes). Animation channels (movers/tracers/fields) are not geometry; the export is
 * the static pose/frame.
 *
 * No three.js import — pure typed-array + Buffer assembly, unit-testable in node.
 */

import { faceListToMesh, decollideFaces, collectWaterMesh, collectShadowDecals } from '../figures/face-mesh.js';
import { expandSurfaceCards } from '../architecture/facade-card.js';
import { bakeAmbientOcclusion, instanceOccluderFaces } from '../effects/ao-bake.js';
import { levelCameras, levelEntityNodes, levelSceneExtras, zRotationQuat } from './scene-gltf-level.js';
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';

const COMPONENT_FLOAT = 5126;
const COMPONENT_USHORT = 5123;
const COMPONENT_UINT = 5125;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;
const COMPONENT_BYTE = 5120;
const COMPONENT_SHORT = 5122;
const MODE_TRIANGLES = 4;
// GLB chunk/header magic words (little-endian uint32).
const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'
// z-up (mojulo world) → y-up (glTF) as a root-node rotation: -90° about X maps +Z→+Y.
// Quaternion [x,y,z,w] for θ=-90° about X = [sin(-45°),0,0,cos(-45°)].
const ZUP_TO_YUP = [-0.7071067811865476, 0, 0, 0.7071067811865476];

// sRGB channel (0..1) → linear, matching face-mesh's vertex-colour convention so decal
// colours (authored 0..255 sRGB) sit in the same space as baked face colours.
function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function bounds3(arr) {
  if (!arr.length) return { min: [0, 0, 0], max: [0, 0, 0] };
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < arr.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = arr[i + k];
      if (v < min[k]) min[k] = v;
      if (v > max[k]) max[k] = v;
    }
  }
  return { min, max };
}

const TRIS = [[0, 1, 2], [0, 2, 3]];

// ── rig-figure animation export (interchange.plan.md I1) ─────────────────────
// The packed rig clips are PHASE-normalized (gaitPhase advances by distance/stride in the live
// runtime — no intrinsic period). The exported glTF needs seconds, so we map one full cycle to
// the runtime's ambient default: the clock rule advances gaitPhase at `rate ?? 1` cycles/second
// (worlds/controllable/rules-basic.js), i.e. 1 second per cycle. Documented, deterministic, and
// trivially retimed downstream (Blender scales NLA strips).
const RIG_CLIP_SECONDS = 1;

// base64 → typed array, COPYING into a fresh buffer: Buffer.from(base64) allocates from node's
// shared pool, whose byteOffset is not guaranteed 4-aligned for a Float32Array view.
function b64ToBytes(s) {
  const b = Buffer.from(s, 'base64');
  const u = new Uint8Array(b.length);
  u.set(b);
  return u;
}
const b64ToF32 = (s) => new Float32Array(b64ToBytes(s).buffer);
const b64ToU16 = (s) => new Uint16Array(b64ToBytes(s).buffer);
const b64ToU32 = (s) => new Uint32Array(b64ToBytes(s).buffer);

// Decode one packed rig part (rig-bake.js) into GLB-ready arrays, with every vertex re-expressed
// relative to the bone's REST HEAD — the runtime poses parts as M = T(head)·R(q)·T(-restHead)
// (channels/controllable __syncRigEntity), which decomposes exactly into glTF node TRS once the
// mesh is bone-local: translation = head_k, rotation = q_k. Two encodings ride the same shape:
// legacy float32 triangle soup (part.pos) and the indexed+quantized form (part.q, packRigMesh).
// Colours are normalized-uint8 linear values (rig-bake b64u8) → float COLOR_0, the same linear
// space as the baked face colours. Per-vertex specular (spec/spec8) has no glTF-unlit analog and
// is deliberately dropped, like the World's other screen embellishments.
function decodeRigPart(part, restHead) {
  const colU8 = b64ToBytes(part.col);
  const colors = new Float32Array(colU8.length);
  for (let i = 0; i < colU8.length; i++) colors[i] = colU8[i] / 255;
  if (part.q) {
    const q = b64ToU16(part.q);
    const { o, s, n } = part;
    const positions = new Float32Array(n * 3);
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = o[0] + q[i] * s[0] - restHead[0];
      positions[i + 1] = o[1] + q[i + 1] * s[1] - restHead[1];
      positions[i + 2] = o[2] + q[i + 2] * s[2] - restHead[2];
    }
    const indices = n > 65535 ? b64ToU32(part.idx) : b64ToU16(part.idx);
    return { positions, colors, indices, vertexCount: n, triangleCount: indices.length / 3 };
  }
  const raw = b64ToF32(part.pos);
  const positions = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) {
    positions[i] = raw[i] - restHead[0];
    positions[i + 1] = raw[i + 1] - restHead[1];
    positions[i + 2] = raw[i + 2] - restHead[2];
  }
  return { positions, colors, indices: null, vertexCount: raw.length / 3, triangleCount: raw.length / 9 };
}

// Weld + degenerate-drop for a triangle-soup node (GLB export hygiene — external-agent GLB
// feedback, 2026-08-11). Two mechanical wins over the raw `positions.push` soup faceListToMesh
// emits: (1) DROP zero-area triangles — mojulo pads triangle faces / cap-fans to `[a,b,c,c]`
// quads, whose second split tri is degenerate (~11% of a suit's tris render nothing); (2) WELD
// vertices that are byte-identical in (pos, colour, normal, uv) into an indexed primitive. Weld
// only pays off on SMOOTH data (a baked mesh shares vertex colours); on mojulo's own FLAT export
// each face owns its colour+normal so nothing merges — so this returns `indices` only when the
// merge is worth the index buffer, else a degenerate-free soup (still a strict win). Pure geometry,
// deterministic, no visible change; the World/SVG paths never call this (GLB-only).
function weldSoup(positions, colors, cc, normals, uvs) {
  const triCount = (positions.length / 9) | 0;
  // `colors` may be null — the unlit-sticker texture path (addNode via facesToGlb's
  // textureGroups loop) welds on position+uv alone, no COLOR_0.
  const oP = [], oC = colors ? [] : null, oN = normals && normals.length ? [] : null, oU = uvs && uvs.length ? [] : null;
  const indices = [];
  const map = new Map();
  const qp = (v) => Math.round(v * 1e5);           // position quantum (well under the 1.5e-3 decollide stagger)
  const qa = (v) => Math.round(v * 4096);          // colour/normal/uv quantum
  const coincide = (a, c) => positions[a] === positions[c] && positions[a + 1] === positions[c + 1] && positions[a + 2] === positions[c + 2];
  let dropped = 0;
  for (let t = 0; t < triCount; t++) {
    const p0 = t * 9, p1 = p0 + 3, p2 = p0 + 6;
    if (coincide(p0, p1) || coincide(p1, p2) || coincide(p0, p2)) { dropped++; continue; } // degenerate
    for (let k = 0; k < 3; k++) {
      const v = t * 3 + k, pb = v * 3, cb = v * cc, nb = v * 3, ub = v * 2;
      let key = qp(positions[pb]) + ',' + qp(positions[pb + 1]) + ',' + qp(positions[pb + 2]);
      if (oC) for (let c = 0; c < cc; c++) key += '|' + qa(colors[cb + c]);
      if (oN) key += '|n' + qa(normals[nb]) + ',' + qa(normals[nb + 1]) + ',' + qa(normals[nb + 2]);
      if (oU) key += '|u' + qa(uvs[ub]) + ',' + qa(uvs[ub + 1]);
      let idx = map.get(key);
      if (idx === undefined) {
        idx = oP.length / 3;
        map.set(key, idx);
        oP.push(positions[pb], positions[pb + 1], positions[pb + 2]);
        if (oC) for (let c = 0; c < cc; c++) oC.push(colors[cb + c]);
        if (oN) oN.push(normals[nb], normals[nb + 1], normals[nb + 2]);
        if (oU) oU.push(uvs[ub], uvs[ub + 1]);
      }
      indices.push(idx);
    }
  }
  const origVerts = positions.length / 3;
  const weldedVerts = oP.length / 3;
  // Index only when merging removed real vertices (< 85% remain); else expand back to a
  // degenerate-free soup (indices as-is over the welded verts is fine — but a no-merge index
  // buffer costs more than it saves, so hand back soup instead).
  const worthIndex = weldedVerts < origVerts * 0.85;
  if (worthIndex) {
    const IndexArr = weldedVerts > 65535 ? Uint32Array : Uint16Array;
    return {
      positions: Float32Array.from(oP), colors: oC ? Float32Array.from(oC) : null,
      normals: oN ? Float32Array.from(oN) : null, uvs: oU ? Float32Array.from(oU) : null,
      indices: IndexArr.from(indices), origVerts, weldedVerts, dropped,
    };
  }
  // degenerate-free soup: expand the (unmerged) verts through the index list
  const sP = new Float32Array(indices.length * 3), sC = oC ? new Float32Array(indices.length * cc) : null;
  const sN = oN ? new Float32Array(indices.length * 3) : null, sU = oU ? new Float32Array(indices.length * 2) : null;
  for (let i = 0; i < indices.length; i++) {
    const s = indices[i];
    sP[i * 3] = oP[s * 3]; sP[i * 3 + 1] = oP[s * 3 + 1]; sP[i * 3 + 2] = oP[s * 3 + 2];
    if (sC) for (let c = 0; c < cc; c++) sC[i * cc + c] = oC[s * cc + c];
    if (sN) { sN[i * 3] = oN[s * 3]; sN[i * 3 + 1] = oN[s * 3 + 1]; sN[i * 3 + 2] = oN[s * 3 + 2]; }
    if (sU) { sU[i * 2] = oU[s * 2]; sU[i * 2 + 1] = oU[s * 2 + 1]; }
  }
  return { positions: sP, colors: sC, normals: sN, uvs: sU, indices: null, origVerts, weldedVerts, dropped };
}

/**
 * Minimal GLB assembler. Accumulates bufferViews/accessors/meshes/nodes into a
 * single binary buffer, then `build()` packs the JSON + BIN chunks into a .glb.
 */
class GlbBuilder {
  // `quantize` (interchange-seams.plan.md seam 6a): KHR_mesh_quantization on the static
  // mesh paths — POSITION as normalized int16 under a per-mesh dequantizing node TRS
  // (centre + half-extents), NORMAL as int8, COLOR_0 as uint16, TEXCOORD_0 as uint16 when in
  // [0,1]. Roughly halves the geometry bytes with no dependency; every engine importer and
  // Blender read it. Off (default) ⇒ byte-identical to the float export. Rig figures keep
  // their own packed form either way.
  constructor(generator = 'mojulo scene-gltf', { quantize = false, lit = false, litRoughness = 0.85 } = {}) {
    this.quantize = !!quantize;
    // LIT handoff (lit-handoff.plan.md step 1): every surface material is a real
    // pbrMetallicRoughness (no unlit extension) so the importer's light shades the
    // geometry; paired with an UNSHADED payload so that light is the only light.
    this.lit = !!lit;
    this.litRoughness = litRoughness;
    this.quantizeDeclared = false;
    this.quantizeStep = 0; // the coarsest position step (world units) any quantized mesh took
    this.bin = [];
    this.binLen = 0;
    this.children = []; // node indices parented under the y-up root
    this.json = {
      asset: { version: '2.0', generator },
      extensionsUsed: [],
      scene: 0,
      scenes: [{ nodes: [] }],
      nodes: [],
      meshes: [],
      materials: [],
      accessors: [],
      bufferViews: [],
      buffers: [],
      images: [],
      samplers: [],
      textures: [],
    };
    this.unlitDeclared = false;
    this.rigWrappers = new Map(); // figure name → wrapper node index (I4 entity-node reuse)
  }

  pad4() {
    const r = this.binLen % 4;
    if (r) {
      const p = Buffer.alloc(4 - r);
      this.bin.push(p);
      this.binLen += p.length;
    }
  }

  addView(buf, target, byteStride = null) {
    this.pad4();
    const byteOffset = this.binLen;
    this.bin.push(buf);
    this.binLen += buf.length;
    const view = { buffer: 0, byteOffset, byteLength: buf.length };
    if (target) view.target = target;
    if (byteStride) view.byteStride = byteStride;
    this.json.bufferViews.push(view);
    return this.json.bufferViews.length - 1;
  }

  // `target` defaults to ARRAY_BUFFER (vertex data); pass null for animation input/output
  // accessors — the glTF validator flags a buffer-view target on non-vertex data.
  floatAccessor(arr, components, range, target = TARGET_ARRAY_BUFFER) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const view = this.addView(buf, target);
    const type = components === 4 ? 'VEC4' : components === 3 ? 'VEC3' : components === 2 ? 'VEC2' : 'SCALAR';
    const acc = { bufferView: view, componentType: COMPONENT_FLOAT, count: arr.length / components, type };
    if (range && range.min) acc.min = range.min;
    if (range && range.max) acc.max = range.max;
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }

  // Normalized-integer vertex accessor (KHR_mesh_quantization / core COLOR_0 rules). glTF
  // needs vertex-attribute strides to be multiples of 4, so VEC3 shorts pad to 8 bytes and
  // VEC3 bytes to 4 — `stride` is the padded element size the caller packed.
  intAccessor(buf, { componentType, components, count, stride, min = null, max = null }) {
    const view = this.addView(buf, TARGET_ARRAY_BUFFER, stride);
    const type = components === 4 ? 'VEC4' : components === 3 ? 'VEC3' : components === 2 ? 'VEC2' : 'SCALAR';
    const acc = { bufferView: view, componentType, normalized: true, count, type };
    if (min) acc.min = min;
    if (max) acc.max = max;
    this.json.accessors.push(acc);
    return this.json.accessors.length - 1;
  }

  declareQuantization() {
    if (this.quantizeDeclared) return;
    this.json.extensionsUsed.push('KHR_mesh_quantization');
    this.json.extensionsRequired = [...(this.json.extensionsRequired || []), 'KHR_mesh_quantization'];
    this.quantizeDeclared = true;
  }

  // Quantized attribute set for one welded soup → { attributes, translation, scale }: the node
  // carrying the mesh must apply `translation` + `scale` to dequantize POSITION (centre +
  // half-extents, so int16 spans the mesh's own box — the step is half/32767 per axis).
  quantizedAttributes(w, colorComponents) {
    this.declareQuantization();
    const n = w.positions.length / 3;
    const b = bounds3(w.positions);
    const center = [0, 1, 2].map((k) => (b.min[k] + b.max[k]) / 2);
    const half = [0, 1, 2].map((k) => Math.max((b.max[k] - b.min[k]) / 2, 1e-6));
    this.quantizeStep = Math.max(this.quantizeStep, ...half.map((h) => h / 32767));
    const pos = Buffer.alloc(n * 8);
    const qmin = [32767, 32767, 32767], qmax = [-32767, -32767, -32767];
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const q = Math.max(-32767, Math.min(32767, Math.round(((w.positions[i * 3 + k] - center[k]) / half[k]) * 32767)));
        pos.writeInt16LE(q, i * 8 + k * 2);
        if (q < qmin[k]) qmin[k] = q; if (q > qmax[k]) qmax[k] = q;
      }
    }
    const attributes = { POSITION: this.intAccessor(pos, { componentType: COMPONENT_SHORT, components: 3, count: n, stride: 8, min: qmin, max: qmax }) };
    if (w.colors && w.colors.length) {
      const cc = colorComponents || 3;
      const col = Buffer.alloc(n * 8);
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < cc; k++) col.writeUInt16LE(Math.max(0, Math.min(65535, Math.round(w.colors[i * cc + k] * 65535))), i * 8 + k * 2);
        if (cc === 3) col.writeUInt16LE(0, i * 8 + 6);
      }
      attributes.COLOR_0 = this.intAccessor(col, { componentType: COMPONENT_USHORT, components: cc, count: n, stride: 8 });
    }
    if (w.uvs && w.uvs.length) {
      let unit = true;
      for (const v of w.uvs) if (!(v >= 0 && v <= 1)) { unit = false; break; }
      if (unit) {
        const uv = Buffer.alloc(n * 4);
        for (let i = 0; i < n * 2; i++) uv.writeUInt16LE(Math.round(w.uvs[i] * 65535), i * 2);
        attributes.TEXCOORD_0 = this.intAccessor(uv, { componentType: COMPONENT_USHORT, components: 2, count: n, stride: 4 });
      } else attributes.TEXCOORD_0 = this.floatAccessor(w.uvs, 2); // repeating tiles exceed [0,1] — stay float
    }
    if (w.normals && w.normals.length) {
      const nm = Buffer.alloc(n * 4);
      for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) nm.writeInt8(Math.max(-127, Math.min(127, Math.round(w.normals[i * 3 + k] * 127))), i * 4 + k);
      attributes.NORMAL = this.intAccessor(nm, { componentType: COMPONENT_BYTE, components: 3, count: n, stride: 4 });
    }
    return { attributes, translation: center, scale: half };
  }

  // Triangle-index accessor (SCALAR uint16/uint32, ELEMENT_ARRAY_BUFFER) — used by the
  // indexed+quantized rig parts; the static face-soup path stays index-free.
  indexAccessor(arr) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const view = this.addView(buf, TARGET_ELEMENT_ARRAY_BUFFER);
    const componentType = arr.BYTES_PER_ELEMENT === 4 ? COMPONENT_UINT : COMPONENT_USHORT;
    this.json.accessors.push({ bufferView: view, componentType, count: arr.length, type: 'SCALAR' });
    return this.json.accessors.length - 1;
  }

  unlitMaterial({ alpha = null, baseColorTexture = null, name } = {}) {
    if (!this.unlitDeclared) {
      this.json.extensionsUsed.push('KHR_materials_unlit');
      this.unlitDeclared = true;
    }
    const pbr = {
      baseColorFactor: [1, 1, 1, alpha == null ? 1 : alpha],
      metallicFactor: 0,
      roughnessFactor: 1,
    };
    if (baseColorTexture != null) pbr.baseColorTexture = { index: baseColorTexture };
    const mat = { doubleSided: true, pbrMetallicRoughness: pbr, extensions: { KHR_materials_unlit: {} } };
    if (name) mat.name = name;
    if (alpha != null) mat.alphaMode = 'BLEND';
    this.json.materials.push(mat);
    return this.json.materials.length - 1;
  }

  // A REAL (lit) PBR material for faces tagged with material factors (material-response.plan.md
  // P3): no unlit extension, so importers light it and the metallic/roughness read shows.
  // COLOR_0 still multiplies baseColor — the baked Lambert rides along as the albedo's shading,
  // the documented trade of exporting a baked world into a lit viewer.
  pbrMaterial({ metallic = 0, roughness = 0.9, alpha = null, baseColorTexture = null, name, emissive = null, emissiveStrength = 1 } = {}) {
    const pbr = {
      baseColorFactor: [1, 1, 1, alpha == null ? 1 : alpha],
      metallicFactor: metallic,
      roughnessFactor: roughness,
    };
    // texture × material: the surface tile rides as the lit albedo (a marble floor with sheen)
    if (baseColorTexture != null) pbr.baseColorTexture = { index: baseColorTexture };
    const mat = { doubleSided: true, pbrMetallicRoughness: pbr };
    if (name) mat.name = name;
    if (alpha != null) mat.alphaMode = 'BLEND';
    // A glowing surface (a pot-light lens): core emissiveFactor, plus KHR_materials_emissive_strength
    // above 1 so a lit importer (Blender / Godot / Unity / Interchange) renders it as a light source
    // in its own right — not a lit albedo that reads dark under a ceiling nothing lights.
    if (Array.isArray(emissive) && emissive.length >= 3) {
      mat.emissiveFactor = emissive.slice(0, 3);
      if (emissiveStrength > 1) {
        if (!this.emissiveStrengthDeclared) { this.json.extensionsUsed.push('KHR_materials_emissive_strength'); this.emissiveStrengthDeclared = true; }
        mat.extensions = { ...(mat.extensions || {}), KHR_materials_emissive_strength: { emissiveStrength } };
      }
    }
    this.json.materials.push(mat);
    return this.json.materials.length - 1;
  }

  // The surface material for a plain group: unlit (the mojulo look, default) or — in the
  // lit handoff — a real dielectric PBR at the export's roughness. One switch, every path.
  surfaceMaterial(opts = {}) {
    return this.lit ? this.pbrMaterial({ metallic: 0, roughness: this.litRoughness, ...opts }) : this.unlitMaterial(opts);
  }

  // Only PNG/JPEG data URLs embed as glTF textures; SVG/other → null so the caller
  // falls back to baked vertex colour (geometry survives, the sticker image doesn't).
  imageFromDataUrl(dataUrl) {
    const m = /^data:(image\/(?:png|jpeg|jpg));base64,(.*)$/i.exec(dataUrl || '');
    if (!m) return null;
    const mimeType = /jpe?g/i.test(m[1]) ? 'image/jpeg' : 'image/png';
    const bytes = Buffer.from(m[2], 'base64');
    const view = this.addView(bytes, 0);
    const imgIdx = this.json.images.push({ bufferView: view, mimeType }) - 1;
    if (!this.json.samplers.length) this.json.samplers.push({});
    return this.json.textures.push({ source: imgIdx, sampler: 0 }) - 1;
  }

  // One mesh + one node from a position/colour soup. `colorComponents` is 3 (RGB) or
  // 4 (RGBA, per-vertex alpha). `uvs` (optional) adds a TEXCOORD_0 attribute.
  addNode(name, positions, colors, colorComponents, materialIndex, uvs, normals) {
    // Weld + degenerate-drop the soup before emitting (GLB export hygiene). Adaptive: returns an
    // index buffer only when merging actually shrinks the mesh (baked/smooth data), else a
    // degenerate-free soup (flat mojulo export). colorComponents drives the colour stride.
    const w = weldSoup(positions, colors, colorComponents || 3, normals, uvs);
    let attributes, dequant = null;
    if (this.quantize && w.positions.length) {
      ({ attributes, ...dequant } = this.quantizedAttributes(w, colorComponents));
    } else {
      const posAcc = this.floatAccessor(w.positions, 3, bounds3(w.positions));
      attributes = { POSITION: posAcc };
      if (w.colors && w.colors.length) attributes.COLOR_0 = this.floatAccessor(w.colors, colorComponents);
      if (w.uvs && w.uvs.length) attributes.TEXCOORD_0 = this.floatAccessor(w.uvs, 2);
      // Authored outward normals (export-normals.plan.md §3). No range needed (unit vectors).
      // Absent ⇒ no NORMAL attribute, byte-identical to a normal-free export. The z-up→y-up root
      // node rotation (ZUP_TO_YUP) rotates NORMAL along with POSITION at import — no hand-rotate.
      if (w.normals && w.normals.length) attributes.NORMAL = this.floatAccessor(w.normals, 3);
    }
    const prim = { attributes, mode: MODE_TRIANGLES, material: materialIndex };
    if (w.indices) prim.indices = this.indexAccessor(w.indices);
    this.json.meshes.push({ name, primitives: [prim] });
    const meshIdx = this.json.meshes.length - 1;
    const node = { name, mesh: meshIdx };
    if (dequant) { node.translation = dequant.translation; node.scale = dequant.scale; }
    const nodeIdx = this.json.nodes.push(node) - 1;
    this.children.push(nodeIdx);
    // Report the ACTUAL emitted geometry (post weld + degenerate-drop) so facesToGlb's
    // vertex/triangle totals and the reader round-trip count the real primitive, not the raw soup.
    return { node: nodeIdx, vertices: w.positions.length / 3, triangles: w.indices ? w.indices.length / 3 : w.positions.length / 9 };
  }

  // One shared mesh + N thin nodes (renderer-ladder P4 instancing): the template geometry is
  // stored ONCE; each transform becomes a node referencing the same mesh with its own TRS.
  // Rotation is about +Z — the nodes live in the pre-root z-up frame, exactly like addNode
  // geometry, so the y-up root conversion applies uniformly.
  addInstancedNodes(name, positions, colors, colorComponents, materialIndex, transforms) {
    let attributes, dequant = null;
    if (this.quantize && positions.length) {
      ({ attributes, ...dequant } = this.quantizedAttributes({ positions, colors, uvs: null, normals: null }, colorComponents));
    } else {
      const posAcc = this.floatAccessor(positions, 3, bounds3(positions));
      attributes = { POSITION: posAcc };
      if (colors && colors.length) attributes.COLOR_0 = this.floatAccessor(colors, colorComponents);
    }
    this.json.meshes.push({ name, primitives: [{ attributes, mode: MODE_TRIANGLES, material: materialIndex }] });
    const meshIdx = this.json.meshes.length - 1;
    transforms.forEach((t, i) => {
      const node = { name: `${name}:${i}` };
      if (Array.isArray(t.pos) && t.pos.some((v) => v)) node.translation = [t.pos[0], t.pos[1], t.pos[2]];
      const rz = t.rotZ || 0;
      if (rz) node.rotation = [0, 0, Math.sin(rz / 2), Math.cos(rz / 2)];
      if (Number.isFinite(t.scale) && t.scale !== 1) node.scale = [t.scale, t.scale, t.scale];
      // quantized: the shared mesh sits on a dequantizing CHILD under each instance's TRS, so the
      // instance transform stays exactly what the World applies and the child undoes the int16 box.
      if (dequant) {
        const child = this.json.nodes.push({ name: `${name}:${i}:q`, mesh: meshIdx, translation: dequant.translation, scale: dequant.scale }) - 1;
        node.children = [child];
      } else node.mesh = meshIdx;
      this.children.push(this.json.nodes.push(node) - 1);
    });
    return meshIdx;
  }

  // One packed rig figure (rig-bake.js / unit-rig.js / vehicle-rig.js — all three families share
  // the shape by construction) → one wrapper node under the y-up root, one bone-local mesh node
  // per non-empty part, and one glTF animation per requested clip. The rigs are rigid parts under
  // FK, NOT skinned meshes, so no skins/inverse-bind matrices: each bone node's TRS carries the
  // whole pose. At rest the node sits at translation = restHead with identity rotation, so a
  // no-animation import shows the bake's rest pose. Runtime-only extras (armOverlays, muzzle,
  // thrusters, head-look-at) are live-channel behavior, not baked curves — dropped, same doctrine
  // as billboards/sky. Returns { nodes, animations, vertices, triangles }.
  addRigFigure(name, fig, clipNames) {
    const material = this.surfaceMaterial({ name: `fig:${name}` });
    const boneNodes = []; // bone index → node index (null for part-less bones)
    const kids = [];
    let vertices = 0;
    let triangles = 0;
    fig.bones.forEach((bone, bi) => {
      const part = fig.parts[bi];
      if (!part) { boneNodes[bi] = null; return; }
      const d = decodeRigPart(part, bone.head);
      const attributes = { POSITION: this.floatAccessor(d.positions, 3, bounds3(d.positions)) };
      if (d.colors.length) attributes.COLOR_0 = this.floatAccessor(d.colors, 3);
      const prim = { attributes, mode: MODE_TRIANGLES, material };
      if (d.indices) prim.indices = this.indexAccessor(d.indices);
      const nodeName = `${name}:${bone.id}`;
      const meshIdx = this.json.meshes.push({ name: nodeName, primitives: [prim] }) - 1;
      const nodeIdx = this.json.nodes.push({ name: nodeName, mesh: meshIdx, translation: [bone.head[0], bone.head[1], bone.head[2]] }) - 1;
      boneNodes[bi] = nodeIdx;
      kids.push(nodeIdx);
      vertices += d.vertexCount;
      triangles += d.triangleCount;
    });
    if (!kids.length) return { nodes: 0, animations: 0, vertices: 0, triangles: 0 };
    const wrapIdx = this.json.nodes.push({ name, children: kids }) - 1;
    this.children.push(wrapIdx);
    this.rigWrappers.set(name, wrapIdx);
    let animations = 0;
    for (const clipName of clipNames) {
      const clip = fig.clips && fig.clips[clipName];
      if (!clip || !clip.k || !Array.isArray(clip.b)) continue;
      this.addRigClip(name, fig, boneNodes, clipName, clip);
      animations++;
    }
    return { nodes: 1, animations, vertices, triangles };
  }

  // JOINTS_0 companion to floatAccessor: uint16 VEC4 vertex attribute.
  jointAccessor(arr) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const view = this.addView(buf, TARGET_ARRAY_BUFFER);
    this.json.accessors.push({ bufferView: view, componentType: COMPONENT_USHORT, count: arr.length / 4, type: 'VEC4' });
    return this.json.accessors.length - 1;
  }

  // Inverse-bind matrices: MAT4 float accessor, no buffer-view target (the
  // validator flags targets on IBM data, same rule as animation samplers).
  ibmAccessor(arr) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const view = this.addView(buf, null);
    this.json.accessors.push({ bufferView: view, componentType: COMPONENT_FLOAT, count: arr.length / 16, type: 'MAT4' });
    return this.json.accessors.length - 1;
  }

  /**
   * SKINNED rig export (skin-over-mesh.plan.md phase 4) — the same packed rig
   * as addRigFigure, exported as ONE SkinnedMesh + a glTF `skins` entry
   * instead of N rigid part nodes. The engine does the deformation; mojulo's
   * own runtime keeps rigid FK (the renderer-ladder decision stands — this is
   * an EXPORT capability, the cost paid where the gain lives).
   *
   * Weights: when the packed bones carry rest `tail`s, each vertex weights
   * across its part's own bone + the bones ADJACENT to it (sharing a rest
   * endpoint — the joint the crease bends at), by inverse-square distance to
   * the rest bone segments, top-2 normalized. Rigs without tails (armor,
   * older bakes) bind hard [1,0,0,0] — a suit's plates SHOULD stay rigid.
   *
   * Frames: joint node TRS = T(head')·R(q) (the packed clips' world frames,
   * flat joint list — no nesting, exactly like the rigid path) and
   * IBM = T(-restHead), so J·IBM·v = head' + q·(v − restHead) — the runtime
   * formula, now evaluated by the engine per-vertex. At rest J·IBM = I: a
   * no-animation import shows the bake's rest pose byte-exactly.
   */
  addSkinnedRigFigure(name, fig, clipNames, { humanoid = false } = {}) {
    const material = this.surfaceMaterial({ name: `fig:${name}` });
    const bones = fig.bones;
    const hasTails = bones.every((b) => Array.isArray(b.tail) && b.tail.length === 3);

    // humanoid (interchange-seams.plan.md seam 3a): joints take their VRM names, weightless leaf
    // joints stand in for the hands / feet VRM requires, and the first humanoid figure carries the
    // VRMC_vrm extension so VRM-aware tools address it by name. Skeleton stays flat (see the map).
    const hb = humanoid ? humanoidBonesFor(bones) : null;
    if (hb && hb.missing.length) throw new Error(`humanoid export: rig '${name}' cannot supply VRM bones ${hb.missing.join(', ')} — only the biped figure rig qualifies`);

    // joint nodes (flat, rest pose)
    const jointNodes = bones.map((bone, bi) =>
      this.json.nodes.push({ name: `${name}:${hb && hb.names.has(bi) ? hb.names.get(bi) : bone.id}`, translation: [bone.head[0], bone.head[1], bone.head[2]] }) - 1);
    const leafNodes = hb ? hb.leaves.map((l) => this.json.nodes.push({ name: `${name}:${l.vrm}`, translation: l.at }) - 1) : [];

    // adjacency: bones sharing a rest endpoint (head/tail coincide) — the
    // candidate set for soft weights, so a thigh never bleeds into a wrist.
    const near = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-4;
    const adjacent = bones.map((a, ai) => bones
      .map((b, bi) => bi)
      .filter((bi) => bi !== ai && (
        near(bones[ai].head, bones[bi].head) || (hasTails && (
          near(bones[ai].head, bones[bi].tail) || near(bones[ai].tail, bones[bi].head) || near(bones[ai].tail, bones[bi].tail)
        ))
      )));
    const segDist = (p, bi) => {
      const h = bones[bi].head, t = hasTails ? bones[bi].tail : bones[bi].head;
      const dx = t[0] - h[0], dy = t[1] - h[1], dz = t[2] - h[2];
      const l2 = dx * dx + dy * dy + dz * dz;
      let u = l2 ? ((p[0] - h[0]) * dx + (p[1] - h[1]) * dy + (p[2] - h[2]) * dz) / l2 : 0;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      return Math.hypot(p[0] - h[0] - dx * u, p[1] - h[1] - dy * u, p[2] - h[2] - dz * u);
    };

    // merge every part into one rest-space soup with per-vertex joints/weights
    const pos = [], col = [], jnt = [], wgt = [], idx = [];
    let vertices = 0, triangles = 0;
    fig.bones.forEach((bone, bi) => {
      const part = fig.parts[bi];
      if (!part) return;
      const d = decodeRigPart(part, bone.head);
      const base = pos.length / 3;
      for (let i = 0; i < d.positions.length; i += 3) {
        // decodeRigPart is bone-local (pos − restHead); rest world re-adds it
        const p = [d.positions[i] + bone.head[0], d.positions[i + 1] + bone.head[1], d.positions[i + 2] + bone.head[2]];
        pos.push(p[0], p[1], p[2]);
        if (hasTails) {
          const cand = [bi, ...adjacent[bi]];
          const scored = cand.map((ci) => ({ ci, d: segDist(p, ci) })).sort((a, b) => a.d - b.d).slice(0, 2);
          const inv = scored.map((s) => 1 / (s.d * s.d + 1e-6));
          const sum = inv.reduce((a, b) => a + b, 0);
          jnt.push(scored[0].ci, scored[1] ? scored[1].ci : 0, 0, 0);
          wgt.push(inv[0] / sum, scored[1] ? inv[1] / sum : 0, 0, 0);
        } else {
          jnt.push(bi, 0, 0, 0);
          wgt.push(1, 0, 0, 0);
        }
      }
      for (let i = 0; i < d.colors.length; i++) col.push(d.colors[i]);
      if (d.indices) for (let i = 0; i < d.indices.length; i++) idx.push(base + d.indices[i]);
      else for (let i = 0; i < d.vertexCount; i++) idx.push(base + i);
      vertices += d.vertexCount;
      triangles += d.triangleCount;
    });
    if (!vertices) return { nodes: 0, animations: 0, vertices: 0, triangles: 0, skinned: false };

    const positions = Float32Array.from(pos);
    const attributes = {
      POSITION: this.floatAccessor(positions, 3, bounds3(positions)),
      COLOR_0: this.floatAccessor(Float32Array.from(col), 3),
      JOINTS_0: this.jointAccessor(Uint16Array.from(jnt)),
      WEIGHTS_0: this.floatAccessor(Float32Array.from(wgt), 4),
    };
    const IndexArr = vertices > 65535 ? Uint32Array : Uint16Array;
    const prim = { attributes, mode: MODE_TRIANGLES, material, indices: this.indexAccessor(IndexArr.from(idx)) };
    const meshIdx = this.json.meshes.push({ name: `${name}:skinned`, primitives: [prim] }) - 1;

    // IBM: identity + translation(−restHead), column-major
    const ibm = new Float32Array(bones.length * 16);
    bones.forEach((bone, bi) => {
      const o = bi * 16;
      ibm[o] = 1; ibm[o + 5] = 1; ibm[o + 10] = 1; ibm[o + 15] = 1;
      ibm[o + 12] = -bone.head[0]; ibm[o + 13] = -bone.head[1]; ibm[o + 14] = -bone.head[2];
    });
    if (!this.json.skins) this.json.skins = [];
    const skinIdx = this.json.skins.push({
      name: `${name}:skin`, joints: jointNodes, inverseBindMatrices: this.ibmAccessor(ibm),
    }) - 1;

    const meshNode = this.json.nodes.push({ name: `${name}:body`, mesh: meshIdx, skin: skinIdx }) - 1;
    const wrapIdx = this.json.nodes.push({ name, children: [...jointNodes, ...leafNodes, meshNode] }) - 1;
    this.children.push(wrapIdx);
    this.rigWrappers.set(name, wrapIdx);
    if (hb && !this.vrmDeclared) {
      // one avatar per VRM file: the first humanoid figure owns the extension
      const humanBones = {};
      for (const [bi, vrm] of hb.names) humanBones[vrm] = { node: jointNodes[bi] };
      hb.leaves.forEach((l, i) => { humanBones[l.vrm] = { node: leafNodes[i] }; });
      this.json.extensionsUsed.push('VRMC_vrm');
      this.json.extensions = { ...(this.json.extensions || {}), VRMC_vrm: {
        specVersion: '1.0',
        meta: { name, version: '1', authors: ['mojulo'], licenseUrl: 'https://vrm.dev/licenses/1.0/', avatarPermission: 'onlyAuthor', allowExcessivelyViolentUsage: false, allowExcessivelySexualUsage: false, commercialUsage: 'personalNonProfit', allowPoliticalOrReligiousUsage: false, allowAntisocialOrHateUsage: false, creditNotation: 'required', allowRedistribution: false, modification: 'prohibited' },
        humanoid: { humanBones },
      } };
      this.vrmDeclared = true;
    }

    let animations = 0;
    for (const clipName of clipNames) {
      const clip = fig.clips && fig.clips[clipName];
      if (!clip || !clip.k || !Array.isArray(clip.b)) continue;
      this.addRigClip(name, fig, jointNodes, clipName, clip);
      animations++;
    }
    return { nodes: 1, animations, vertices, triangles, skinned: true, soft: hasTails, humanoid: !!hb };
  }

  // One packed clip ({ k, b:[qx,qy,qz,qw,hx,hy,hz per bone per key], once? }) → one glTF
  // animation: per bone node a rotation channel + a translation channel, all samplers sharing
  // ONE input (times) accessor, LINEAR interpolation (glTF normalizes lerped quaternions —
  // matching the runtime's nlerp). Timing: RIG_CLIP_SECONDS per cycle. LOOPING clips are baked
  // at phases k/K (the runtime wraps key K-1 → key 0), so we emit K+1 keys with key 0 repeated
  // at t = RIG_CLIP_SECONDS to close the cycle — glTF has no loop flag, so a player that loops
  // the animation gets a seamless cycle and one that plays it once lands back on the start pose.
  // ONE-SHOT clips (clip.once — stagger/topple/getup) are baked 0..1 INCLUSIVE across their K
  // keys and clamp at the end, so they export as-is: K keys spanning [0, RIG_CLIP_SECONDS].
  // Packed quaternion curves may carry sign flips (q and -q depict one rotation but lerp badly —
  // the runtime hemisphere-corrects per sample); exported keys are made hemisphere-continuous
  // per bone instead (negate any key with dot(q_k, q_{k-1}) < 0).
  addRigClip(figName, fig, boneNodes, clipName, clip) {
    const nb = fig.bones.length;
    const K = clip.k;
    const B = clip.b;
    const loop = !clip.once;
    const outKeys = loop ? K + 1 : K;
    const dt = RIG_CLIP_SECONDS / (loop ? K : Math.max(1, K - 1));
    const times = new Float32Array(outKeys);
    for (let k = 0; k < outKeys; k++) times[k] = k * dt;
    const input = this.floatAccessor(times, 1, { min: [0], max: [times[outKeys - 1]] }, null);
    const samplers = [];
    const channels = [];
    for (let bi = 0; bi < nb; bi++) {
      const node = boneNodes[bi];
      if (node == null) continue;
      const rot = new Float32Array(outKeys * 4);
      const tr = new Float32Array(outKeys * 3);
      let px = 0, py = 0, pz = 0, pw = 0;
      for (let k = 0; k < outKeys; k++) {
        const o = ((k % K) * nb + bi) * 7; // k === K (the wrap key) re-reads key 0
        let qx = B[o], qy = B[o + 1], qz = B[o + 2], qw = B[o + 3];
        if (k > 0 && qx * px + qy * py + qz * pz + qw * pw < 0) { qx = -qx; qy = -qy; qz = -qz; qw = -qw; }
        rot[k * 4] = qx; rot[k * 4 + 1] = qy; rot[k * 4 + 2] = qz; rot[k * 4 + 3] = qw;
        px = qx; py = qy; pz = qz; pw = qw;
        tr[k * 3] = B[o + 4]; tr[k * 3 + 1] = B[o + 5]; tr[k * 3 + 2] = B[o + 6];
      }
      const rotSampler = samplers.push({ input, output: this.floatAccessor(rot, 4, null, null), interpolation: 'LINEAR' }) - 1;
      channels.push({ sampler: rotSampler, target: { node, path: 'rotation' } });
      const trSampler = samplers.push({ input, output: this.floatAccessor(tr, 3, null, null), interpolation: 'LINEAR' }) - 1;
      channels.push({ sampler: trSampler, target: { node, path: 'translation' } });
    }
    if (!channels.length) return;
    if (!this.json.animations) this.json.animations = [];
    this.json.animations.push({ name: `${figName}:${clipName}`, samplers, channels });
  }

  // One glTF perspective camera + its posed node (interchange.plan.md I4). The node lives
  // in the pre-root z-up frame like every other child — the y-up root rotation converts its
  // pose exactly like geometry, so Blender/Godot open with mojulo's own framing. yfov is in
  // radians (glTF §5.9); rotation is a lookAt solve (scene-gltf-level.js lookAtRotation).
  addCameraNode({ name, translation, rotation, yfov, aspectRatio, znear, zfar }) {
    if (!this.json.cameras) this.json.cameras = [];
    const camIdx = this.json.cameras.push({
      name,
      type: 'perspective',
      perspective: { yfov, aspectRatio, znear, zfar },
    }) - 1;
    const nodeIdx = this.json.nodes.push({ name: `cam:${name}`, camera: camIdx, translation, rotation }) - 1;
    this.children.push(nodeIdx);
    return nodeIdx;
  }

  // KHR_lights_punctual (lit-handoff.plan.md, pot lights): a positioned light node in the
  // pre-root z-up frame like every other child. A spot shines down its node's -Z, which under
  // the y-up root IS mojulo's -Z (down) — a ceiling downlight needs no rotation. Intensity is
  // candela for point/spot per the extension; Blender / Godot / Unreal convert on import.
  addLightNode({ name, type = 'point', translation, color = [1, 1, 1], intensity = 1, innerCone, outerCone, range, rotation }) {
    if (!this.lightsDeclared) {
      this.json.extensionsUsed.push('KHR_lights_punctual');
      this.json.extensions = { ...(this.json.extensions || {}), KHR_lights_punctual: { lights: [] } };
      this.lightsDeclared = true;
    }
    const light = { name, type, color, intensity };
    if (range > 0) light.range = range;
    if (type === 'spot') light.spot = { innerConeAngle: innerCone ?? 0, outerConeAngle: outerCone ?? Math.PI / 4 };
    const lightIdx = this.json.extensions.KHR_lights_punctual.lights.push(light) - 1;
    const node = { name: `light:${name}`, translation, extensions: { KHR_lights_punctual: { light: lightIdx } } };
    if (rotation) node.rotation = rotation;
    const nodeIdx = this.json.nodes.push(node) - 1;
    this.children.push(nodeIdx);
    return nodeIdx;
  }

  build() {
    // y-up root: parent every geometry node under one rotated node. `rootScale` (a kind's
    // metersPerUnit — the floorplan is authored in feet) rides here as a uniform scale, so
    // every importer receives metres with no per-engine code.
    const rootIdx = this.json.nodes.push({ name: 'mojulo', rotation: ZUP_TO_YUP, ...(this.rootScale ? { scale: this.rootScale, extras: { 'moj:metersPerUnit': this.rootScale[0] } } : {}), children: this.children }) - 1;
    this.json.scenes[0].nodes = [rootIdx];

    // Drop empty optional arrays so the glTF validates cleanly.
    for (const key of ['images', 'samplers', 'textures', 'materials', 'extensionsUsed']) {
      if (Array.isArray(this.json[key]) && !this.json[key].length) delete this.json[key];
    }

    const binPad = (4 - (this.binLen % 4)) % 4;
    const binTotal = this.binLen + binPad;
    this.json.buffers = [{ byteLength: binTotal }];

    const jsonBuf = Buffer.from(JSON.stringify(this.json), 'utf8');
    const jsonPad = (4 - (jsonBuf.length % 4)) % 4;
    const jsonChunkLen = jsonBuf.length + jsonPad;
    const binData = Buffer.concat(this.bin, this.binLen);
    const binChunk = binPad ? Buffer.concat([binData, Buffer.alloc(binPad)]) : binData;

    const total = 12 + 8 + jsonChunkLen + 8 + binChunk.length;
    const out = Buffer.alloc(total);
    let o = 0;
    o = out.writeUInt32LE(GLB_MAGIC, o);
    o = out.writeUInt32LE(2, o);
    o = out.writeUInt32LE(total, o);
    o = out.writeUInt32LE(jsonChunkLen, o);
    o = out.writeUInt32LE(CHUNK_JSON, o);
    o += jsonBuf.copy(out, o);
    for (let i = 0; i < jsonPad; i++) out[o++] = 0x20; // JSON pads with spaces
    o = out.writeUInt32LE(binChunk.length, o);
    o = out.writeUInt32LE(CHUNK_BIN, o);
    binChunk.copy(out, o);
    return out;
  }
}

/**
 * facesToGlb(payload) → { bytes, byteLength, nodeCount, vertexCount, triangleCount }
 * or null when the payload carries no exportable geometry.
 *
 * `payload` is the same object `emitThreeWorld` consumes (an `assemble*Scene`
 * return value): `{ faces, textures?, light? }`. Level semantics ride along by
 * default (interchange.plan.md I4): `cameras` become glTF perspective cameras,
 * `entities` become named placement nodes with `moj:` extras, and spawn /
 * colliders / game-contract summaries land as scene extras (scene-gltf-level.js).
 * Everything else on the payload (sky, movers, …) is ignored — screen/runtime
 * embellishments, not geometry.
 *
 * Opt-in `clips` (interchange.plan.md I1): an array of clip names (or '_all') adds every packed
 * RIG figure on `payload.figures` as bone-part nodes plus glTF animations for the named clips
 * (see addRigFigure/addRigClip). Absent ⇒ byte-identical static export — rig figures stay
 * excluded exactly as before. When present the result additionally carries
 * `animationCount` + `animatedFigures`.
 */
export function facesToGlb(payload = {}, { generator, clips = null, skinned = false, quantize = false, humanoid = false, lit = false, roughness = 0.85 } = {}) {
  const { faces = [], textures = {}, light = null, ao = null, repeats = [], figures = null } = payload || {};
  const repeatList = (Array.isArray(repeats) ? repeats : []).filter((r) => r && Array.isArray(r.template) && r.template.length && Array.isArray(r.transforms) && r.transforms.length);
  // rig-figure selection: only packed rigs qualify (figure-frames stacks / polygomer statics have
  // no clips to bake and stay out, matching the static path).
  const clipSel = clips === '_all' || (Array.isArray(clips) && clips.length) ? clips : null;
  const rigFigs = clipSel && figures && typeof figures === 'object'
    ? Object.entries(figures).filter(([, f]) => f && f.rig === true && Array.isArray(f.bones) && Array.isArray(f.parts))
    : [];
  if ((!Array.isArray(faces) || !faces.length) && !repeatList.length && !rigFigs.length) return null;

  // A rig may declare `embodies: '<group>'` (interchange.plan.md I2 — the figure kind):
  // the payload's static faces of that group depict the SAME body at rest, so when this
  // rig actually exports (the clips path) the static group is dropped — otherwise the
  // animated figure would ship with a frozen ghost of itself. clips absent ⇒ rigFigs is
  // empty ⇒ faceList === faces, byte-identical to the static export.
  const embodied = new Set(rigFigs.map(([, f]) => f.embodies).filter((g) => typeof g === 'string'));
  const faceList = embodied.size ? faces.filter((f) => !(f && embodied.has(f.group))) : faces;

  const b = new GlbBuilder(generator, { quantize, lit, litRoughness: roughness });
  let vertexCount = 0;
  let triangleCount = 0;

  const tally = (r) => {
    vertexCount += r.vertices;
    triangleCount += r.triangles;
  };

  // Water renders in its own translucent pass; pull it out before surface-card expansion
  // exactly as emitThreeWorld does (water quads carry no cards).
  const waterRaw = faceList.filter((f) => f && f.water);
  const expanded0 = expandSurfaceCards(faceList.filter((f) => !(f && f.water)), { light });
  // De-collide ONCE over the whole opaque face set, exactly where emitThreeWorld does it —
  // coincident faces that land in DIFFERENT render groups (separate glTF nodes, the worst
  // z-fight case in an importer) get lifted apart too. Groups below then mesh with
  // decollide:false; before this the .glb only de-collided per group and cross-group
  // duplicates survived into the export (renderer-emitter.plan.md E4).
  const expanded1 = decollideFaces(expanded0);
  // Baked ambient occlusion — the same post-expansion, post-decollide pass emitThreeWorld
  // applies, so the .glb carries the identical darkening in its COLOR_0 vertex colours (and
  // samples the same final corner positions). Repeat templates expand once here and feed the
  // bake as instance-transformed occluder-only phantoms (renderer-convergence 1a, CAST) —
  // mirroring the World path, so exported terrain darkens under instanced canopies.
  const repExpanded = repeatList.map((r) => expandSurfaceCards(r.template, { light }));
  const aoOpts = ao ? (typeof ao === 'object' ? ao : {}) : null;
  const aoPhantoms = aoOpts && repeatList.length
    ? repeatList.flatMap((r, i) => instanceOccluderFaces(repExpanded[i], r.transforms))
    : [];
  const expanded = aoOpts
    ? bakeAmbientOcclusion(expanded1, aoPhantoms.length ? { ...aoOpts, extraOccluders: aoPhantoms } : aoOpts)
    : expanded1;

  // Opaque/lit geometry, one node per render group (mirrors emitThreeWorld's grouping so a
  // Blender import shows the same toggleable walls/shells as named objects).
  const groupMap = new Map();
  for (const f of expanded) {
    if (!f || f.decal === 'shadow' || f.decal === 'ink' || f.water) continue;
    const k = typeof f.group === 'string' ? f.group : 'static';
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(f);
  }
  for (const [name, fs] of groupMap) {
    // Faces tagged `pbr: [metallic, roughness]` (a named material from the shelf) split into
    // their own node with a REAL pbrMetallicRoughness material, one node per distinct factor
    // pair; everything else keeps the unlit path. No pbr faces → identical export to today.
    const pbrBuckets = new Map();
    const plain = [];
    for (const f of fs) {
      // textured faces stay on the texture path (a label wrap outranks its material)
      if (f && Array.isArray(f.pbr) && f.pbr.length >= 2 && typeof f.texture !== 'string') {
        // an emissive face (`emissive: [r,g,b]`, `emissiveStrength`) is its own bucket + material
        const k = `${f.pbr[0]},${f.pbr[1]}` + (Array.isArray(f.emissive) ? `|e${f.emissive.join(',')}|${f.emissiveStrength ?? 1}` : '');
        if (!pbrBuckets.has(k)) pbrBuckets.set(k, []);
        pbrBuckets.get(k).push(f);
      } else plain.push(f);
    }
    const gm = faceListToMesh(plain, { decollide: false, withNormals: true }); // already de-collided globally above
    // group-wide translucency (e.g. cellular jelly + organelles): a face alpha < 1 turns the
    // whole group transparent, matching emitThreeWorld's per-group alpha.
    const af = fs.find((f) => typeof f.alpha === 'number' && f.alpha < 1);
    const groupAlpha = af ? af.alpha : null;
    if (gm.positions.length) {
      const mat = b.surfaceMaterial({ alpha: groupAlpha, name });
      tally(b.addNode(name, gm.positions, gm.colors, 3, mat, undefined, gm.normals));
    }
    let pbrIdx = 0, emIdx = 0;
    for (const [, bucket] of pbrBuckets) {
      const bm = faceListToMesh(bucket, { decollide: false, withNormals: true });
      if (!bm.positions.length) continue;
      const [metallic, roughness] = bucket[0].pbr;
      const emissive = Array.isArray(bucket[0].emissive) ? bucket[0].emissive : null;
      // emissive nodes are named `<group>:emissive` — the Unreal importer keeps that slot's own
      // (Interchange) material instead of swapping it onto the mojulo master
      const nodeName = emissive
        ? `${name}:emissive${emIdx++ ? emIdx - 1 : ''}`
        : (pbrBuckets.size > 1 ? `${name}:pbr${pbrIdx++}` : `${name}:pbr`);
      const mat = b.pbrMaterial({ metallic, roughness, alpha: groupAlpha, name: nodeName, ...(emissive ? { emissive, emissiveStrength: bucket[0].emissiveStrength ?? 1 } : {}) });
      tally(b.addNode(nodeName, bm.positions, bm.colors, 3, mat, undefined, bm.normals));
    }
    // texture × material: a textured face that ALSO carries `pbr` exports its tile as the
    // albedo of a REAL lit PBR material (marble floor with sheen) instead of the unlit sticker.
    const texPbr = new Map();
    for (const f of fs) if (f && typeof f.texture === 'string' && Array.isArray(f.pbr) && f.pbr.length >= 2) texPbr.set(f.texture, f.pbr);
    for (const [key, grp] of Object.entries(gm.textureGroups || {})) {
      if (!grp.positions.length) continue;
      const texIdx = b.imageFromDataUrl(textures[key]);
      const pbr = texPbr.get(key) || null;
      let tr;
      if (texIdx != null) {
        const mat = pbr
          ? b.pbrMaterial({ metallic: pbr[0], roughness: pbr[1], baseColorTexture: texIdx, alpha: groupAlpha, name: `${name}:${key}` })
          : b.surfaceMaterial({ baseColorTexture: texIdx, alpha: groupAlpha, name: `${name}:${key}` });
        // lit groups multiply texel × baked colour (COLOR_0); unlit stickers show the texel as-is.
        // In the LIT handoff the tile IS the albedo — no COLOR_0 under it, so the engine's light
        // is the only light on a textured surface (the fill was only the World's lit neutral).
        tr = b.addNode(`${name}:${key}`, grp.positions, (grp.lit && !b.lit) ? grp.colors : null, 3, mat, grp.uvs);
      } else {
        const mat = pbr
          ? b.pbrMaterial({ metallic: pbr[0], roughness: pbr[1], alpha: groupAlpha, name: `${name}:${key}` })
          : b.surfaceMaterial({ alpha: groupAlpha, name: `${name}:${key}` });
        tr = b.addNode(`${name}:${key}`, grp.positions, grp.colors, 3, mat);
      }
      tally(tr);
    }
  }

  // Translucent water: per-vertex alpha rides COLOR_0 (VEC4); baseColorFactor stays opaque.
  const water = waterRaw.length ? collectWaterMesh(waterRaw) : null;
  if (water && water.positions.length) {
    const mat = b.unlitMaterial({ alpha: 1, name: 'water' });
    tally(b.addNode('water', water.positions, water.colors, 4, mat));
  }

  // Flat shadow + ink ground decals → one translucent dark mesh (the World's cast/contact pools).
  const decals = collectShadowDecals(faceList);
  const inkFaces = faceList.filter((f) => f && f.decal === 'ink' && Array.isArray(f.corners) && f.corners.length >= 4);
  const decalQuads = [
    ...decals.map((d) => ({ quad: d.quad, alpha: d.alpha, color: d.color })),
    ...inkFaces.map((f) => ({ quad: f.corners.slice(0, 4), alpha: f.inkAlpha ?? 0.85, color: f.inkColor || [0, 0, 0] })),
  ];
  if (decalQuads.length) {
    const pos = [];
    const col = [];
    for (const d of decalQuads) {
      const q = d.quad;
      if (!Array.isArray(q) || q.length < 4) continue;
      const [cr, cg, cb] = (d.color || [0, 0, 0]).map((c) => srgbToLinear((c || 0) / 255));
      const a = typeof d.alpha === 'number' ? d.alpha : 0.5;
      for (const tri of TRIS) {
        for (const k of tri) {
          pos.push(q[k][0], q[k][1], q[k][2]);
          col.push(cr, cg, cb, a);
        }
      }
    }
    if (pos.length) {
      const positions = Float32Array.from(pos);
      const colors = Float32Array.from(col);
      const mat = b.unlitMaterial({ alpha: 1, name: 'shadows' });
      tally(b.addNode('shadows', positions, colors, 4, mat));
    }
  }

  // Instanced repeats (renderer-ladder P4): each entry's template bakes to ONE mesh, and its
  // transforms become thin nodes sharing it — a 500-tree block stores one tree. Mirrors
  // emitThreeWorld's InstancedMesh lowering, so the .glb depicts the same world. With `ao` on,
  // the template self-bakes (its own creases darken in every instance); the World path's
  // per-instance ambient tint is deliberately NOT mirrored (glTF per-node color would need
  // per-node materials).
  repeatList.forEach((r, i) => {
    const gm = faceListToMesh(aoOpts ? bakeAmbientOcclusion(repExpanded[i], aoOpts) : repExpanded[i]);
    if (!gm.positions.length) return;
    const name = r.group || `repeat-${i}`;
    const mat = b.unlitMaterial({ name });
    b.addInstancedNodes(name, gm.positions, gm.colors, 3, mat, r.transforms);
    vertexCount += gm.positions.length / 3;                                // stored once
    triangleCount += (gm.positions.length / 9) * r.transforms.length;      // depicted N times
  });

  // Animated rig figures (interchange.plan.md I1) — only when the caller opted in via `clips`;
  // the static export (clips absent) contributes zero bytes here and stays byte-identical.
  let animationCount = 0;
  const animatedFigures = [];
  const skinnedFigures = [];
  const humanoidFigures = [];
  for (const [name, fig] of rigFigs) {
    const clipNames = clipSel === '_all'
      ? Object.keys(fig.clips || {})
      : clipSel.filter((c) => fig.clips && fig.clips[c]);
    // `skinned` (skin-over-mesh.plan.md phase 4): one SkinnedMesh + skins/IBM
    // per figure instead of rigid part nodes — export-only; absent, the rigid
    // path stays byte-identical.
    const added = skinned ? b.addSkinnedRigFigure(name, fig, clipNames, { humanoid }) : b.addRigFigure(name, fig, clipNames);
    if (!added.nodes) continue;
    animatedFigures.push(name);
    if (added.skinned) skinnedFigures.push(name);
    if (added.humanoid) humanoidFigures.push(name);
    animationCount += added.animations;
    vertexCount += added.vertices;
    triangleCount += added.triangles;
  }

  if (!b.children.length) return null; // expansion produced nothing exportable

  // ── level-as-layout semantics (interchange.plan.md I4) — default-on ──────────────────────
  // A GLB is a derived snapshot regenerated on demand, so enriching the export needs no opt-in:
  // cameras, entity placement nodes, and `moj:` extras ride every world export. Geometry-only
  // payloads (no cameras/entities/colliders/game) add zero bytes here, and nothing below ever
  // touches an emitted world PAGE.
  const camDefs = levelCameras(payload);
  for (const c of camDefs) b.addCameraNode(c);
  // Positioned lights (`payload.lights`: pot lights today) — KHR_lights_punctual nodes.
  const lightDefs = Array.isArray(payload.lights) ? payload.lights.filter((l) => l && Array.isArray(l.position)) : [];
  for (const l of lightDefs) b.addLightNode({ ...l, translation: l.position });
  // Units: a kind authored in other-than-metres declares `metersPerUnit`; the root scales.
  // Scene extras are plain data outside the node tree, so they are pre-scaled below.
  const mpu = Number(payload.metersPerUnit);
  const unitScale = Number.isFinite(mpu) && mpu > 0 && mpu !== 1 ? mpu : null;
  if (unitScale) b.rootScale = [unitScale, unitScale, unitScale];
  // One identifiable node per entity placement. Where the entity's body is a rig this export
  // actually baked (the clips path), the I1 wrapper node IS the placement — it gains the
  // entity's TRS (translation = spawn pos, rotation = heading + the runtime's yawOffset facing
  // convention) and the extras, so the figure imports standing at its spot facing its heading.
  // Every other entity (static path, non-rig body, or a rig already claimed by an earlier
  // entity sharing the figure) becomes an empty TRS node.
  const entityDefs = levelEntityNodes(payload);
  const claimed = new Set();
  for (const e of entityDefs) {
    const wrapIdx = e.figure != null ? b.rigWrappers.get(e.figure) : undefined;
    if (wrapIdx != null && !claimed.has(wrapIdx)) {
      claimed.add(wrapIdx);
      const node = b.json.nodes[wrapIdx];
      if (e.translation.some((v) => v)) node.translation = e.translation;
      const yaw = e.heading + e.yawOffset;
      if (yaw) node.rotation = zRotationQuat(yaw);
      node.extras = e.extras;
    } else {
      const node = { name: e.name, extras: e.extras };
      if (e.translation.some((v) => v)) node.translation = e.translation;
      if (e.heading) node.rotation = zRotationQuat(e.heading);
      b.children.push(b.json.nodes.push(node) - 1);
    }
  }
  // Scene-level extras: spawn point, collider boxes, game-contract summary.
  const sceneExtras = levelSceneExtras(payload);
  if (sceneExtras && unitScale) {
    const sv = (v) => v.map((x) => x * unitScale);
    if (sceneExtras['moj:spawn']) sceneExtras['moj:spawn'] = sv(sceneExtras['moj:spawn']);
    if (sceneExtras['moj:colliders']) sceneExtras['moj:colliders'] = sceneExtras['moj:colliders'].map((c) => ({ min: sv(c.min), max: sv(c.max) }));
  }
  if (sceneExtras) b.json.scenes[0].extras = sceneExtras;

  const bytes = b.build();
  const out = {
    bytes,
    byteLength: bytes.length,
    lit: !!lit,
    nodeCount: b.children.length,
    vertexCount,
    triangleCount,
  };
  if (clipSel) {
    out.animationCount = animationCount;
    out.animatedFigures = animatedFigures;
    if (skinnedFigures.length) out.skinnedFigures = skinnedFigures;
    if (humanoidFigures.length) out.humanoidFigures = humanoidFigures;
  }
  if (camDefs.length) out.cameraCount = camDefs.length;
  if (lightDefs.length) out.lightCount = lightDefs.length;
  if (unitScale) out.metersPerUnit = unitScale;
  if (entityDefs.length) out.entityCount = entityDefs.length;
  if (quantize) { out.quantized = true; out.quantizeStep = b.quantizeStep; }
  return out;
}
