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

const COMPONENT_FLOAT = 5126;
const TARGET_ARRAY_BUFFER = 34962;
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

  floatAccessor(arr, components, range) {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
    const view = this.addView(buf, TARGET_ARRAY_BUFFER);
    const type = components === 4 ? 'VEC4' : components === 3 ? 'VEC3' : components === 2 ? 'VEC2' : 'SCALAR';
    const acc = { bufferView: view, componentType: COMPONENT_FLOAT, count: arr.length / components, type };
    if (range && range.min) acc.min = range.min;
    if (range && range.max) acc.max = range.max;
    this.json.accessors.push(acc);
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
  addNode(name, positions, colors, colorComponents, materialIndex, uvs) {
    const posAcc = this.floatAccessor(positions, 3, bounds3(positions));
    const attributes = { POSITION: posAcc };
    if (colors && colors.length) attributes.COLOR_0 = this.floatAccessor(colors, colorComponents);
    if (uvs && uvs.length) attributes.TEXCOORD_0 = this.floatAccessor(uvs, 2);
    this.json.meshes.push({ name, primitives: [{ attributes, mode: MODE_TRIANGLES, material: materialIndex }] });
    const meshIdx = this.json.meshes.length - 1;
    const nodeIdx = this.json.nodes.push({ name, mesh: meshIdx }) - 1;
    this.children.push(nodeIdx);
    return nodeIdx;
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
 * return value): `{ faces, textures?, light? }`. Everything else on the payload
 * (cameras, sky, movers, …) is ignored — only geometry exports.
 */
export function facesToGlb(payload = {}, { generator } = {}) {
  const { faces = [], textures = {}, light = null, ao = null, repeats = [] } = payload || {};
  const repeatList = (Array.isArray(repeats) ? repeats : []).filter((r) => r && Array.isArray(r.template) && r.template.length && Array.isArray(r.transforms) && r.transforms.length);
  if ((!Array.isArray(faces) || !faces.length) && !repeatList.length) return null;

  const b = new GlbBuilder(generator);
  let vertexCount = 0;
  let triangleCount = 0;

  const tally = (positions) => {
    vertexCount += positions.length / 3;
    triangleCount += positions.length / 9;
  };

  // Water renders in its own translucent pass; pull it out before surface-card expansion
  // exactly as emitThreeWorld does (water quads carry no cards).
  const waterRaw = faces.filter((f) => f && f.water);
  const expanded0 = expandSurfaceCards(faces.filter((f) => !(f && f.water)), { light });
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
    const gm = faceListToMesh(plain, { decollide: false }); // already de-collided globally above
    // group-wide translucency (e.g. cellular jelly + organelles): a face alpha < 1 turns the
    // whole group transparent, matching emitThreeWorld's per-group alpha.
    const af = fs.find((f) => typeof f.alpha === 'number' && f.alpha < 1);
    const groupAlpha = af ? af.alpha : null;
    if (gm.positions.length) {
      const mat = b.unlitMaterial({ alpha: groupAlpha, name });
      b.addNode(name, gm.positions, gm.colors, 3, mat);
      tally(gm.positions);
    }
    let pbrIdx = 0;
    for (const [, bucket] of pbrBuckets) {
      const bm = faceListToMesh(bucket, { decollide: false });
      if (!bm.positions.length) continue;
      const [metallic, roughness] = bucket[0].pbr;
      const nodeName = pbrBuckets.size > 1 ? `${name}:pbr${pbrIdx++}` : `${name}:pbr`;
      const mat = b.pbrMaterial({ metallic, roughness, alpha: groupAlpha, name: nodeName });
      b.addNode(nodeName, bm.positions, bm.colors, 3, mat);
      tally(bm.positions);
    }
    // texture × material: a textured face that ALSO carries `pbr` exports its tile as the
    // albedo of a REAL lit PBR material (marble floor with sheen) instead of the unlit sticker.
    const texPbr = new Map();
    for (const f of fs) if (f && typeof f.texture === 'string' && Array.isArray(f.pbr) && f.pbr.length >= 2) texPbr.set(f.texture, f.pbr);
    for (const [key, grp] of Object.entries(gm.textureGroups || {})) {
      if (!grp.positions.length) continue;
      const texIdx = b.imageFromDataUrl(textures[key]);
      const pbr = texPbr.get(key) || null;
      if (texIdx != null) {
        const mat = pbr
          ? b.pbrMaterial({ metallic: pbr[0], roughness: pbr[1], baseColorTexture: texIdx, alpha: groupAlpha, name: `${name}:${key}` })
          : b.unlitMaterial({ baseColorTexture: texIdx, alpha: groupAlpha, name: `${name}:${key}` });
        // lit groups multiply texel × baked colour (COLOR_0); unlit stickers show the texel as-is.
        b.addNode(`${name}:${key}`, grp.positions, grp.lit ? grp.colors : null, 3, mat, grp.uvs);
      } else {
        const mat = pbr
          ? b.pbrMaterial({ metallic: pbr[0], roughness: pbr[1], alpha: groupAlpha, name: `${name}:${key}` })
          : b.unlitMaterial({ alpha: groupAlpha, name: `${name}:${key}` });
        b.addNode(`${name}:${key}`, grp.positions, grp.colors, 3, mat);
      }
      tally(grp.positions);
    }
  }

  // Translucent water: per-vertex alpha rides COLOR_0 (VEC4); baseColorFactor stays opaque.
  const water = waterRaw.length ? collectWaterMesh(waterRaw) : null;
  if (water && water.positions.length) {
    const mat = b.unlitMaterial({ alpha: 1, name: 'water' });
    b.addNode('water', water.positions, water.colors, 4, mat);
    tally(water.positions);
  }

  // Flat shadow + ink ground decals → one translucent dark mesh (the World's cast/contact pools).
  const decals = collectShadowDecals(faces);
  const inkFaces = faces.filter((f) => f && f.decal === 'ink' && Array.isArray(f.corners) && f.corners.length >= 4);
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
      b.addNode('shadows', positions, colors, 4, mat);
      tally(positions);
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

  if (!b.children.length) return null; // expansion produced nothing exportable

  const bytes = b.build();
  return {
    bytes,
    byteLength: bytes.length,
    nodeCount: b.children.length,
    vertexCount,
    triangleCount,
  };
}
