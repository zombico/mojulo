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

const COMPONENT_FLOAT = 5126;
const COMPONENT_USHORT = 5123;
const COMPONENT_UINT = 5125;
const TARGET_ARRAY_BUFFER = 34962;
const TARGET_ELEMENT_ARRAY_BUFFER = 34963;
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
  const oP = [], oC = [], oN = normals && normals.length ? [] : null, oU = uvs && uvs.length ? [] : null;
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
      for (let c = 0; c < cc; c++) key += '|' + qa(colors[cb + c]);
      if (oN) key += '|n' + qa(normals[nb]) + ',' + qa(normals[nb + 1]) + ',' + qa(normals[nb + 2]);
      if (oU) key += '|u' + qa(uvs[ub]) + ',' + qa(uvs[ub + 1]);
      let idx = map.get(key);
      if (idx === undefined) {
        idx = oP.length / 3;
        map.set(key, idx);
        oP.push(positions[pb], positions[pb + 1], positions[pb + 2]);
        for (let c = 0; c < cc; c++) oC.push(colors[cb + c]);
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
      positions: Float32Array.from(oP), colors: Float32Array.from(oC),
      normals: oN ? Float32Array.from(oN) : null, uvs: oU ? Float32Array.from(oU) : null,
      indices: IndexArr.from(indices), origVerts, weldedVerts, dropped,
    };
  }
  // degenerate-free soup: expand the (unmerged) verts through the index list
  const sP = new Float32Array(indices.length * 3), sC = new Float32Array(indices.length * cc);
  const sN = oN ? new Float32Array(indices.length * 3) : null, sU = oU ? new Float32Array(indices.length * 2) : null;
  for (let i = 0; i < indices.length; i++) {
    const s = indices[i];
    sP[i * 3] = oP[s * 3]; sP[i * 3 + 1] = oP[s * 3 + 1]; sP[i * 3 + 2] = oP[s * 3 + 2];
    for (let c = 0; c < cc; c++) sC[i * cc + c] = oC[s * cc + c];
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
  constructor(generator = 'mojulo scene-gltf') {
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

  addView(buf, target) {
    this.pad4();
    const byteOffset = this.binLen;
    this.bin.push(buf);
    this.binLen += buf.length;
    const view = { buffer: 0, byteOffset, byteLength: buf.length };
    if (target) view.target = target;
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
  pbrMaterial({ metallic = 0, roughness = 0.9, alpha = null, baseColorTexture = null, name } = {}) {
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
    this.json.materials.push(mat);
    return this.json.materials.length - 1;
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
    const posAcc = this.floatAccessor(w.positions, 3, bounds3(w.positions));
    const attributes = { POSITION: posAcc };
    if (w.colors && w.colors.length) attributes.COLOR_0 = this.floatAccessor(w.colors, colorComponents);
    if (w.uvs && w.uvs.length) attributes.TEXCOORD_0 = this.floatAccessor(w.uvs, 2);
    // Authored outward normals (export-normals.plan.md §3). No range needed (unit vectors).
    // Absent ⇒ no NORMAL attribute, byte-identical to a normal-free export. The z-up→y-up root
    // node rotation (ZUP_TO_YUP) rotates NORMAL along with POSITION at import — no hand-rotate.
    if (w.normals && w.normals.length) attributes.NORMAL = this.floatAccessor(w.normals, 3);
    const prim = { attributes, mode: MODE_TRIANGLES, material: materialIndex };
    if (w.indices) prim.indices = this.indexAccessor(w.indices);
    this.json.meshes.push({ name, primitives: [prim] });
    const meshIdx = this.json.meshes.length - 1;
    const nodeIdx = this.json.nodes.push({ name, mesh: meshIdx }) - 1;
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
    const posAcc = this.floatAccessor(positions, 3, bounds3(positions));
    const attributes = { POSITION: posAcc };
    if (colors && colors.length) attributes.COLOR_0 = this.floatAccessor(colors, colorComponents);
    this.json.meshes.push({ name, primitives: [{ attributes, mode: MODE_TRIANGLES, material: materialIndex }] });
    const meshIdx = this.json.meshes.length - 1;
    transforms.forEach((t, i) => {
      const node = { name: `${name}:${i}`, mesh: meshIdx };
      if (Array.isArray(t.pos) && t.pos.some((v) => v)) node.translation = [t.pos[0], t.pos[1], t.pos[2]];
      const rz = t.rotZ || 0;
      if (rz) node.rotation = [0, 0, Math.sin(rz / 2), Math.cos(rz / 2)];
      if (Number.isFinite(t.scale) && t.scale !== 1) node.scale = [t.scale, t.scale, t.scale];
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
    const material = this.unlitMaterial({ name: `fig:${name}` });
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

  build() {
    // y-up root: parent every geometry node under one rotated node.
    const rootIdx = this.json.nodes.push({ name: 'mojulo', rotation: ZUP_TO_YUP, children: this.children }) - 1;
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
export function facesToGlb(payload = {}, { generator, clips = null } = {}) {
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

  const b = new GlbBuilder(generator);
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
        const k = `${f.pbr[0]},${f.pbr[1]}`;
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
      const mat = b.unlitMaterial({ alpha: groupAlpha, name });
      tally(b.addNode(name, gm.positions, gm.colors, 3, mat, undefined, gm.normals));
    }
    let pbrIdx = 0;
    for (const [, bucket] of pbrBuckets) {
      const bm = faceListToMesh(bucket, { decollide: false, withNormals: true });
      if (!bm.positions.length) continue;
      const [metallic, roughness] = bucket[0].pbr;
      const nodeName = pbrBuckets.size > 1 ? `${name}:pbr${pbrIdx++}` : `${name}:pbr`;
      const mat = b.pbrMaterial({ metallic, roughness, alpha: groupAlpha, name: nodeName });
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
          : b.unlitMaterial({ baseColorTexture: texIdx, alpha: groupAlpha, name: `${name}:${key}` });
        // lit groups multiply texel × baked colour (COLOR_0); unlit stickers show the texel as-is.
        tr = b.addNode(`${name}:${key}`, grp.positions, grp.lit ? grp.colors : null, 3, mat, grp.uvs);
      } else {
        const mat = pbr
          ? b.pbrMaterial({ metallic: pbr[0], roughness: pbr[1], alpha: groupAlpha, name: `${name}:${key}` })
          : b.unlitMaterial({ alpha: groupAlpha, name: `${name}:${key}` });
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
  for (const [name, fig] of rigFigs) {
    const clipNames = clipSel === '_all'
      ? Object.keys(fig.clips || {})
      : clipSel.filter((c) => fig.clips && fig.clips[c]);
    const added = b.addRigFigure(name, fig, clipNames);
    if (!added.nodes) continue;
    animatedFigures.push(name);
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
  if (sceneExtras) b.json.scenes[0].extras = sceneExtras;

  const bytes = b.build();
  const out = {
    bytes,
    byteLength: bytes.length,
    nodeCount: b.children.length,
    vertexCount,
    triangleCount,
  };
  if (clipSel) {
    out.animationCount = animationCount;
    out.animatedFigures = animatedFigures;
  }
  if (camDefs.length) out.cameraCount = camDefs.length;
  if (entityDefs.length) out.entityCount = entityDefs.length;
  return out;
}
