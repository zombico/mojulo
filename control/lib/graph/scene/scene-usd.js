/**
 * scene-usd — export a baked face list as OpenUSD: USDA text, or a USDZ package.
 *
 * The FIFTH consumer of the `{ faces, textures, repeats, cameras, entities }` payload
 * (interchange-seams.plan.md seam 2) and an INTERCHANGE sibling of facesToGlb — not an
 * engine kernel: the engine packs keep consuming GLB; USD is the door to the DCC side that
 * is converging on it (Blender, Houdini, Unreal, Omniverse, Apple). USDZ additionally gives
 * iOS / visionOS AR Quick Look of an object at true scale — an eyes gate the print leg did
 * not have.
 *
 * Mirrors the GLB writer's preprocessing so the two depict the SAME world: water split
 * out, surface cards expanded, one global de-collide, the AO bake (with instanced repeat
 * phantoms), one Mesh per render group (+ a `:pbr` / `:<texture>` split like the GLB
 * nodes), translucent water and shadow decals with displayOpacity, instanced repeats as a
 * PointInstancer (one prototype, N transforms), the level cameras as Camera prims, entity
 * placements as Xforms carrying the `moj:` extras in customData, and the scene extras
 * (spawn / colliders / game) in the layer's customLayerData.
 *
 * Frame: mojulo is z-up and USD declares `upAxis = "Z"`, so — unlike the GLB's rotated
 * root — coordinates land VERBATIM. `metersPerUnit` carries the recipe's declared units
 * (1 by default, the pinned MOJULO_UNITS), which is what makes Quick Look show true size.
 *
 * Colour: per-vertex `primvars:displayColor` (linear, the AO-baked colours the World
 * draws — USD's native equivalent of COLOR_0). Untextured meshes bind NO material, so
 * every viewer shows displayColor directly; textured groups bind a UsdPreviewSurface with
 * a UsdUVTexture on diffuseColor (the practical seam for Blender / Quick Look) and `pbr`
 * groups a UsdPreviewSurface with the displayColor primvar as diffuse + the constant
 * metallic / roughness. Unlit fidelity is a documented loss: USD viewers LIGHT the
 * surface; the baked colours read as albedo.
 *
 * Deliberate v1 limits (the ledger): rig figures / clips are not exported (UsdSkel is
 * seam 2c, after the humanoid map); per-instance tints are dropped (as the GLB does);
 * normals are authored only where the face carried `outNormal`.
 *
 * Pure text + Buffer assembly, unit-testable in node.
 */

import { faceListToMesh, decollideFaces, collectWaterMesh, collectShadowDecals } from '../figures/face-mesh.js';
import { expandSurfaceCards } from '../architecture/facade-card.js';
import { bakeAmbientOcclusion, instanceOccluderFaces } from '../effects/ao-bake.js';
import { levelCameras, levelEntityNodes, levelSceneExtras } from './scene-gltf-level.js';
import { buildZip } from './zip-writer.js';

const TRIS = [[0, 1, 2], [0, 2, 3]];

function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

// Shortest decimal text at fixed precision; never "-0".
function num(v, p = 5) {
  const s = (Math.round(v * 10 ** p) / 10 ** p).toString();
  return s === '-0' ? '0' : s;
}
const v3 = (x, y, z, p) => `(${num(x, p)}, ${num(y, p)}, ${num(z, p)})`;
const v2 = (x, y, p) => `(${num(x, p)}, ${num(y, p)})`;
const str = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ')}"`;

// USD prim / property identifiers: [A-Za-z_][A-Za-z0-9_]*; unique within a parent.
function makeNamer() {
  const seen = new Set();
  return (raw, fallback = 'prim') => {
    let id = String(raw ?? '').replace(/[^A-Za-z0-9_]/g, '_');
    if (!id) id = fallback;
    if (/^[0-9]/.test(id)) id = `_${id}`;
    let out = id;
    let n = 2;
    while (seen.has(out)) out = `${id}_${n++}`;
    seen.add(out);
    return out;
  };
}

// Rotate a unit vector by quaternion [x,y,z,w] (glTF order).
function rotate(q, v) {
  const [qx, qy, qz, qw] = q;
  const [x, y, z] = v;
  // t = 2 * cross(q.xyz, v); v' = v + qw * t + cross(q.xyz, t)
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  return [
    x + qw * tx + (qy * tz - qz * ty),
    y + qw * ty + (qz * tx - qx * tz),
    z + qw * tz + (qx * ty - qy * tx),
  ];
}

// USD row-vector 4×4: rows are the images of the basis vectors, then the translation.
function transformMatrix(translation, q) {
  const r = [rotate(q, [1, 0, 0]), rotate(q, [0, 1, 0]), rotate(q, [0, 0, 1])];
  const row = (a, w) => `(${num(a[0], 6)}, ${num(a[1], 6)}, ${num(a[2], 6)}, ${w})`;
  return `( ${row(r[0], 0)}, ${row(r[1], 0)}, ${row(r[2], 0)}, ${row(translation, 1)} )`;
}

// Index a triangle soup into { points, indices, colors, opacities, uvs, normals } with
// exact-key dedup over (position, colour, uv) so displayColor stays per-vertex-correct.
function indexSoup(positions, colors, comps, uvs = null, normals = null) {
  const key = new Map();
  const points = [];
  const cols = [];
  const ops = [];
  const sts = [];
  const nrms = [];
  const indices = [];
  const n = positions.length / 3;
  for (let i = 0; i < n; i++) {
    const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
    const c = colors ? [colors[i * comps], colors[i * comps + 1], colors[i * comps + 2]] : null;
    const a = colors && comps === 4 ? colors[i * comps + 3] : null;
    const uv = uvs ? [uvs[i * 2], uvs[i * 2 + 1]] : null;
    const nm = normals ? [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]] : null;
    const k = `${p}|${c}|${a}|${uv}|${nm}`;
    let idx = key.get(k);
    if (idx === undefined) {
      idx = points.length;
      key.set(k, idx);
      points.push(p);
      if (c) cols.push(c);
      if (a != null) ops.push(a);
      if (uv) sts.push(uv);
      if (nm) nrms.push(nm);
    }
    indices.push(idx);
  }
  // drop zero-area / collapsed triangles
  const clean = [];
  for (let i = 0; i + 3 <= indices.length; i += 3) {
    const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
    if (a === b || b === c || a === c) continue;
    const A = points[a], B = points[b], C = points[c];
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2];
    const vx = C[0] - A[0], vy = C[1] - A[1], vz = C[2] - A[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (!(nx * nx + ny * ny + nz * nz > 0)) continue;
    clean.push(a, b, c);
  }
  return { points, indices: clean, colors: cols.length ? cols : null, opacities: ops.length ? ops : null, uvs: sts.length ? sts : null, normals: nrms.length ? nrms : null };
}

// One `def Mesh` block. `material` is a prim path to bind, or null.
function meshPrim(name, ix, { material = null, indent = '    ' } = {}) {
  if (!ix.indices.length) return null;
  const I = indent, J = `${indent}    `;
  const tris = ix.indices.length / 3;
  const lines = [];
  lines.push(`${I}def Mesh "${name}"${material ? ' (\n' + J + 'prepend apiSchemas = ["MaterialBindingAPI"]\n' + I + ')' : ''}`);
  lines.push(`${I}{`);
  lines.push(`${J}int[] faceVertexCounts = [${new Array(tris).fill('3').join(', ')}]`);
  lines.push(`${J}int[] faceVertexIndices = [${ix.indices.join(', ')}]`);
  lines.push(`${J}point3f[] points = [${ix.points.map((p) => v3(p[0], p[1], p[2], 5)).join(', ')}]`);
  if (ix.normals) lines.push(`${J}normal3f[] normals = [${ix.normals.map((p) => v3(p[0], p[1], p[2], 4)).join(', ')}] (\n${J}    interpolation = "vertex"\n${J})`);
  if (ix.colors) lines.push(`${J}color3f[] primvars:displayColor = [${ix.colors.map((c) => v3(c[0], c[1], c[2], 4)).join(', ')}] (\n${J}    interpolation = "vertex"\n${J})`);
  if (ix.opacities) lines.push(`${J}float[] primvars:displayOpacity = [${ix.opacities.map((a) => num(a, 4)).join(', ')}] (\n${J}    interpolation = "vertex"\n${J})`);
  if (ix.uvs) lines.push(`${J}texCoord2f[] primvars:st = [${ix.uvs.map((t) => v2(t[0], t[1], 5)).join(', ')}] (\n${J}    interpolation = "vertex"\n${J})`);
  lines.push(`${J}uniform token subdivisionScheme = "none"`);
  lines.push(`${J}bool doubleSided = 1`);
  if (material) lines.push(`${J}rel material:binding = <${material}>`);
  lines.push(`${I}}`);
  return { text: lines.join('\n'), vertices: ix.points.length, triangles: tris };
}

// UsdPreviewSurface material blocks under /mojulo/Looks.
function materialPrim(name, { texture = null, metallic = null, roughness = null, opacity = null } = {}) {
  const I = '        ', J = '            ';
  const lines = [`${I}def Material "${name}"`, `${I}{`, `${J}token outputs:surface.connect = </mojulo/Looks/${name}/surface.outputs:surface>`];
  lines.push(`${J}def Shader "surface"`, `${J}{`, `${J}    uniform token info:id = "UsdPreviewSurface"`);
  if (texture) lines.push(`${J}    color3f inputs:diffuseColor.connect = </mojulo/Looks/${name}/tex.outputs:rgb>`);
  else lines.push(`${J}    color3f inputs:diffuseColor.connect = </mojulo/Looks/${name}/vertexColor.outputs:result>`);
  lines.push(`${J}    float inputs:metallic = ${num(metallic ?? 0, 3)}`);
  lines.push(`${J}    float inputs:roughness = ${num(roughness ?? 1, 3)}`);
  if (opacity != null) lines.push(`${J}    float inputs:opacity = ${num(opacity, 3)}`);
  lines.push(`${J}    token outputs:surface`, `${J}}`);
  if (texture) {
    lines.push(`${J}def Shader "stReader"`, `${J}{`, `${J}    uniform token info:id = "UsdPrimvarReader_float2"`, `${J}    string inputs:varname = "st"`, `${J}    float2 outputs:result`, `${J}}`);
    lines.push(`${J}def Shader "tex"`, `${J}{`, `${J}    uniform token info:id = "UsdUVTexture"`, `${J}    asset inputs:file = @${texture}@`, `${J}    float2 inputs:st.connect = </mojulo/Looks/${name}/stReader.outputs:result>`, `${J}    token inputs:wrapS = "repeat"`, `${J}    token inputs:wrapT = "repeat"`, `${J}    float3 outputs:rgb`, `${J}}`);
  } else {
    lines.push(`${J}def Shader "vertexColor"`, `${J}{`, `${J}    uniform token info:id = "UsdPrimvarReader_float3"`, `${J}    string inputs:varname = "displayColor"`, `${J}    float3 outputs:result`, `${J}}`);
  }
  lines.push(`${I}}`);
  return lines.join('\n');
}

// A texture data URL → { name, bytes } sidecar (png/jpeg), or null.
function textureSidecar(key, dataUrl, namer) {
  const m = /^data:(image\/(?:png|jpeg|jpg));base64,(.*)$/i.exec(dataUrl || '');
  if (!m) return null;
  const ext = /jpe?g/i.test(m[1]) ? 'jpg' : 'png';
  return { name: `textures/${namer(key, 'tex')}.${ext}`, bytes: Buffer.from(m[2], 'base64') };
}

/**
 * facesToUsda(payload, { generator, title, metersPerUnit }) → { text, bytes, byteLength,
 * sidecars: [{ name, bytes }], vertexCount, triangleCount, nodeCount, cameraCount,
 * entityCount, instancerCount, textureCount } or null when nothing is exportable.
 *
 * `sidecars` are the texture images the USDA references by relative path
 * (`textures/<key>.png`); a caller writing `model.usda` writes them beside it, and
 * facesToUsdz packs them into the one file.
 */
export function facesToUsda(payload = {}, { generator = 'mojulo scene-usd', title = null, metersPerUnit = 1 } = {}) {
  const { faces = [], textures = {}, light = null, ao = null, repeats = [] } = payload || {};
  const repeatList = (Array.isArray(repeats) ? repeats : []).filter((r) => r && Array.isArray(r.template) && r.template.length && Array.isArray(r.transforms) && r.transforms.length);
  if ((!Array.isArray(faces) || !faces.length) && !repeatList.length) return null;

  // ── the GLB writer's preprocessing, verbatim ────────────────────────────────────
  const waterRaw = faces.filter((f) => f && f.water);
  const expanded0 = expandSurfaceCards(faces.filter((f) => !(f && f.water)), { light });
  const expanded1 = decollideFaces(expanded0);
  const repExpanded = repeatList.map((r) => expandSurfaceCards(r.template, { light }));
  const aoOpts = ao ? (typeof ao === 'object' ? ao : {}) : null;
  const aoPhantoms = aoOpts && repeatList.length
    ? repeatList.flatMap((r, i) => instanceOccluderFaces(repExpanded[i], r.transforms))
    : [];
  const expanded = aoOpts
    ? bakeAmbientOcclusion(expanded1, aoPhantoms.length ? { ...aoOpts, extraOccluders: aoPhantoms } : aoOpts)
    : expanded1;

  const primNamer = makeNamer();
  const lookNamer = makeNamer();
  const texNamer = makeNamer();
  const prims = [];
  const looks = [];
  const sidecars = [];
  const sidecarByKey = new Map();
  let vertexCount = 0;
  let triangleCount = 0;
  let nodeCount = 0;
  const tally = (m) => { if (!m) return; prims.push(m.text); vertexCount += m.vertices; triangleCount += m.triangles; nodeCount += 1; };
  // world-unit bounds of everything written (the verify gate compares Blender's import box to
  // this × metersPerUnit); instancer prototypes are grown at each instance position + scale,
  // rotation ignored — an approximation the gate tolerates.
  const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
  const growPt = (x, y, z) => { if (x < bmin[0]) bmin[0] = x; if (x > bmax[0]) bmax[0] = x; if (y < bmin[1]) bmin[1] = y; if (y > bmax[1]) bmax[1] = y; if (z < bmin[2]) bmin[2] = z; if (z > bmax[2]) bmax[2] = z; };
  const meshPrimB = (name, ix, opts) => { for (const p of ix.points) growPt(p[0], p[1], p[2]); return meshPrim(name, ix, opts); };
  const sidecarFor = (key) => {
    if (sidecarByKey.has(key)) return sidecarByKey.get(key);
    const sc = textureSidecar(key, textures[key], texNamer);
    sidecarByKey.set(key, sc);
    if (sc) sidecars.push(sc);
    return sc;
  };

  // groups, the GLB node grouping
  const groupMap = new Map();
  for (const f of expanded) {
    if (!f || f.decal === 'shadow' || f.decal === 'ink' || f.water) continue;
    const k = typeof f.group === 'string' ? f.group : 'static';
    if (!groupMap.has(k)) groupMap.set(k, []);
    groupMap.get(k).push(f);
  }
  for (const [name, fs] of groupMap) {
    const pbrBuckets = new Map();
    const plain = [];
    for (const f of fs) {
      if (f && Array.isArray(f.pbr) && f.pbr.length >= 2 && typeof f.texture !== 'string') {
        const k = `${f.pbr[0]},${f.pbr[1]}`;
        if (!pbrBuckets.has(k)) pbrBuckets.set(k, []);
        pbrBuckets.get(k).push(f);
      } else plain.push(f);
    }
    const af = fs.find((f) => typeof f.alpha === 'number' && f.alpha < 1);
    const groupAlpha = af ? af.alpha : null;
    const gm = faceListToMesh(plain, { decollide: false, withNormals: true });
    if (gm.positions.length) {
      let material = null;
      if (groupAlpha != null) {
        const mname = lookNamer(`${name}_alpha`);
        looks.push(materialPrim(mname, { opacity: groupAlpha }));
        material = `/mojulo/Looks/${mname}`;
      }
      tally(meshPrimB(primNamer(name), indexSoup(gm.positions, gm.colors, 3, null, gm.normals), { material }));
    }
    let pbrIdx = 0;
    for (const [, bucket] of pbrBuckets) {
      const bm = faceListToMesh(bucket, { decollide: false, withNormals: true });
      if (!bm.positions.length) continue;
      const [metallic, roughness] = bucket[0].pbr;
      const nodeName = pbrBuckets.size > 1 ? `${name}:pbr${pbrIdx++}` : `${name}:pbr`;
      const mname = lookNamer(nodeName);
      looks.push(materialPrim(mname, { metallic, roughness, opacity: groupAlpha }));
      tally(meshPrimB(primNamer(nodeName), indexSoup(bm.positions, bm.colors, 3, null, bm.normals), { material: `/mojulo/Looks/${mname}` }));
    }
    const texPbr = new Map();
    for (const f of fs) if (f && typeof f.texture === 'string' && Array.isArray(f.pbr) && f.pbr.length >= 2) texPbr.set(f.texture, f.pbr);
    for (const [key, grp] of Object.entries(gm.textureGroups || {})) {
      if (!grp.positions.length) continue;
      const sc = sidecarFor(key);
      const pbr = texPbr.get(key) || null;
      const mname = lookNamer(`${name}:${key}`);
      looks.push(materialPrim(mname, { texture: sc ? sc.name : null, metallic: pbr ? pbr[0] : 0, roughness: pbr ? pbr[1] : 1, opacity: groupAlpha }));
      // lit groups carry the baked colour as displayColor beside the texture; unlit stickers carry no colour
      tally(meshPrimB(primNamer(`${name}:${key}`), indexSoup(grp.positions, sc && !grp.lit ? null : grp.colors, 3, sc ? grp.uvs : null, null), { material: `/mojulo/Looks/${mname}` }));
    }
  }

  // translucent water (RGBA colours → displayColor + displayOpacity)
  const water = waterRaw.length ? collectWaterMesh(waterRaw) : null;
  if (water && water.positions.length) tally(meshPrimB(primNamer('water'), indexSoup(water.positions, water.colors, 4)));

  // shadow + ink ground decals → one translucent dark mesh
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
      for (const tri of TRIS) for (const k of tri) { pos.push(q[k][0], q[k][1], q[k][2]); col.push(cr, cg, cb, a); }
    }
    if (pos.length) tally(meshPrimB(primNamer('shadows'), indexSoup(Float32Array.from(pos), Float32Array.from(col), 4)));
  }

  // instanced repeats → PointInstancer (one prototype mesh, N transforms)
  let instancerCount = 0;
  repeatList.forEach((r, i) => {
    const gm = faceListToMesh(aoOpts ? bakeAmbientOcclusion(repExpanded[i], aoOpts) : repExpanded[i]);
    if (!gm.positions.length) return;
    const name = primNamer(r.group || `repeat-${i}`);
    const protoIx = indexSoup(gm.positions, gm.colors, 3);
    const proto = meshPrim('proto', protoIx, { indent: '        ' });
    if (!proto) return;
    const T = r.transforms;
    for (const t of T) {
      const p = Array.isArray(t.pos) ? t.pos : [0, 0, 0];
      const sc = Number.isFinite(t.scale) ? t.scale : 1;
      for (const q of protoIx.points) growPt((p[0] || 0) + q[0] * sc, (p[1] || 0) + q[1] * sc, (p[2] || 0) + q[2] * sc);
    }
    const positions = T.map((t) => { const p = Array.isArray(t.pos) ? t.pos : [0, 0, 0]; return v3(p[0] || 0, p[1] || 0, p[2] || 0, 5); });
    const orientations = T.map((t) => { const h = (t.rotZ || 0) / 2; return `(${num(Math.cos(h), 6)}, 0, 0, ${num(Math.sin(h), 6)})`; });
    const scales = T.map((t) => { const s = Number.isFinite(t.scale) ? t.scale : 1; return v3(s, s, s, 5); });
    prims.push([
      `    def PointInstancer "${name}"`,
      '    {',
      `        rel prototypes = [</mojulo/${name}/proto>]`,
      `        int[] protoIndices = [${new Array(T.length).fill('0').join(', ')}]`,
      `        point3f[] positions = [${positions.join(', ')}]`,
      `        quath[] orientations = [${orientations.join(', ')}]`,
      `        float3[] scales = [${scales.join(', ')}]`,
      proto.text,
      '    }',
    ].join('\n'));
    instancerCount += 1;
    nodeCount += 1;
    vertexCount += proto.vertices;
    triangleCount += proto.triangles * T.length;
  });

  if (!prims.length) return null;

  // level cameras (Camera prims; USD cameras look down -Z like glTF, and the frame is z-up already)
  const camDefs = levelCameras(payload);
  for (const c of camDefs) {
    const name = primNamer(`cam:${c.name}`);
    const hAperture = 36; // mm; a 35mm-style gate — focal length follows the recipe's vertical fov
    const vAperture = hAperture / c.aspectRatio;
    const focal = vAperture / (2 * Math.tan(c.yfov / 2));
    prims.push([
      `    def Camera "${name}"`,
      '    {',
      `        float2 clippingRange = ${v2(c.znear, c.zfar, 3)}`,
      `        float focalLength = ${num(focal, 4)}`,
      `        float horizontalAperture = ${num(hAperture, 3)}`,
      `        float verticalAperture = ${num(vAperture, 4)}`,
      '        token projection = "perspective"',
      `        matrix4d xformOp:transform = ${transformMatrix(c.translation, c.rotation)}`,
      '        uniform token[] xformOpOrder = ["xformOp:transform"]',
      '    }',
    ].join('\n'));
    nodeCount += 1;
  }

  // entity placements (empty Xforms with the moj: extras as customData; rig bodies are not exported in v1)
  const entityDefs = levelEntityNodes(payload);
  for (const e of entityDefs) {
    const name = primNamer(e.name);
    const custom = Object.entries(e.extras).map(([k, v]) => `            string ${str(k)} = ${str(v)}`).join('\n');
    const yawDeg = ((e.heading + e.yawOffset) * 180) / Math.PI;
    prims.push([
      `    def Xform "${name}" (`,
      '        customData = {',
      custom,
      '        }',
      '    )',
      '    {',
      `        double3 xformOp:translate = ${v3(e.translation[0], e.translation[1], e.translation[2], 5)}`,
      `        float xformOp:rotateZ = ${num(yawDeg, 4)}`,
      '        uniform token[] xformOpOrder = ["xformOp:translate", "xformOp:rotateZ"]',
      '    }',
    ].join('\n'));
    nodeCount += 1;
  }

  // scene extras → layer customLayerData (each value JSON-serialized: USD dictionaries stay flat + typed)
  const sceneExtras = levelSceneExtras(payload);
  const layerData = sceneExtras
    ? `    customLayerData = {\n${Object.entries(sceneExtras).map(([k, v]) => `        string ${str(k)} = ${str(JSON.stringify(v))}`).join('\n')}\n    }\n`
    : '';

  const header = [
    '#usda 1.0',
    '(',
    `    doc = ${str(`generated by ${generator}`)}`,
    '    defaultPrim = "mojulo"',
    '    upAxis = "Z"',
    `    metersPerUnit = ${num(metersPerUnit, 6)}`,
    layerData.trimEnd(),
    ')',
    '',
    'def Xform "mojulo" (',
    '    kind = "component"',
    ...(title ? [`    customData = {\n        string title = ${str(title)}\n    }`] : []),
    ')',
    '{',
  ].filter((l) => l !== '');
  const looksBlock = looks.length ? [`    def Scope "Looks"`, '    {', looks.join('\n'), '    }'].join('\n') : null;
  const text = `${[...header, ...(looksBlock ? [looksBlock] : []), ...prims, '}'].join('\n')}\n`;
  const bytes = Buffer.from(text, 'utf8');
  const out = {
    text,
    bytes,
    byteLength: bytes.length,
    sidecars,
    vertexCount,
    triangleCount,
    nodeCount,
    instancerCount,
    textureCount: sidecars.length,
    bounds: Number.isFinite(bmin[0]) ? { min: bmin, max: bmax, size: [bmax[0] - bmin[0], bmax[1] - bmin[1], bmax[2] - bmin[2]] } : null,
  };
  if (camDefs.length) out.cameraCount = camDefs.length;
  if (entityDefs.length) out.entityCount = entityDefs.length;
  return out;
}

/**
 * facesToUsdz(payload, opts) → the same result shape with `bytes` = a USDZ package: an
 * UNCOMPRESSED zip whose entries start on 64-byte boundaries (the USDZ rule, so a reader can
 * mmap the payload in place), `model.usda` first, then the texture sidecars it references.
 * `sidecars` is empty on the result (they are inside the package); `files` lists the entries.
 */
export function facesToUsdz(payload = {}, opts = {}) {
  const usda = facesToUsda(payload, opts);
  if (!usda) return null;
  const entries = [{ name: 'model.usda', data: usda.bytes, method: 'store' }, ...usda.sidecars.map((s) => ({ name: s.name, data: s.bytes, method: 'store' }))];
  const bytes = buildZip(entries, { align: 64 });
  const { text, sidecars, ...rest } = usda;
  return { ...rest, bytes, byteLength: bytes.length, sidecars: [], files: entries.map((e) => e.name) };
}
