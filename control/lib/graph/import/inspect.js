/**
 * inspect — what a canonical GLB (import/to-glb.js) holds, read once, before anything is decided about it: how much
 * geometry, what it is dressed in, whether it has a skeleton and clips, whose it is (its licence), and how big it
 * stands. The decisions an import makes (its units, its height, its class, its rig) are read off this; none is made
 * here.
 *
 *   inspectModel(glb) → {
 *     triangles, meshes, primitives, materials, textures, images: { <mime>: n },
 *     skins: [{ joints, names }], clips: [{ name, channels, seconds }], morphs, extensions,
 *     vrm: null | '0.x' | '1.0', licence: { name?, url?, author?, source?, title?, commercial?, redistribution?,
 *       modification?, credit?, basis } | null, warnings: [],
 *     rest: { min, max, size, height, centre, skinned }   metres as the file says them, in mojulo's native frame
 *                                                          (z up, the file's +z forward reads as −y), each vertex
 *                                                          skinned at rest by its own weights where it is skinned
 *     units: { assumed: 'm', basis, readings: [{ units, height }] }
 *   }
 *
 * The rest is measured by the file's own rule (glTF §3.7.3: a skinned vertex is Σ w · joint · inverse bind), never by
 * a mesh node's transform alone: a Mixamo export's armature carries a 0.01 scale and a quarter turn the skinning
 * applies, so its mesh node's box reads two centimetres tall where an engine stands it 1.8 metres.
 *
 * Pure: the same bytes give the same reading.
 */
import { parseGlb, readAccessor, mul4, trsMatrix, IDENT } from '../scene/scene-gltf-read.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const xf = (m, x, y, z) => [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
/** glTF's y-up frame → mojulo's native z-up (the inverse of the writer's −90° about x). */
export const toNative = ([x, y, z]) => [x, -z, y];

/** A figure's height range in metres: a skinned model outside it was written in another unit. */
export const FIGURE_RANGE = Object.freeze([0.3, 12]);
const UNIT_METRES = Object.freeze({ m: 1, cm: 0.01, mm: 0.001, in: 0.0254, ft: 0.3048 });
export const UNIT_NAMES = Object.freeze(Object.keys(UNIT_METRES));
export const unitMetres = (u) => UNIT_METRES[u] ?? null;

/** Every node's global matrix at rest (down its own parents), and which nodes the default scene draws. */
export function sceneMatrices(json) {
  const nodes = json.nodes || [];
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  const G = new Array(nodes.length);
  const glob = (i) => G[i] ?? (G[i] = parent[i] < 0 ? trsMatrix(nodes[i]) : mul4(glob(parent[i]), trsMatrix(nodes[i])));
  nodes.forEach((_, i) => glob(i));
  const drawn = new Array(nodes.length).fill(false);
  const scene = json.scenes?.[json.scene ?? 0];
  const roots = scene ? scene.nodes || [] : nodes.map((_, i) => i).filter((i) => parent[i] < 0);
  const walk = (i) => { if (drawn[i]) return; drawn[i] = true; for (const c of nodes[i].children || []) walk(c); };
  roots.forEach(walk);
  G.drawn = drawn;
  return G;
}

/** Each drawn mesh node's primitives at rest: [{ node, prim, P }], P the positions in the file's own frame (glTF's y
 * up), skinned by their weights when the node has a skin (glTF §3.7.3), else carried by the node's matrix. */
export function restPrimitives(json, bin, { G = sceneMatrices(json) } = {}) {
  const out = [];
  (json.nodes || []).forEach((node, ni) => {
    if (node.mesh == null || !G.drawn[ni]) return;
    const mesh = json.meshes?.[node.mesh];
    if (!mesh) return;
    const skin = node.skin != null ? json.skins?.[node.skin] : null;
    let JM = null;
    if (skin) {
      const IBM = skin.inverseBindMatrices != null ? readAccessor(json, bin, skin.inverseBindMatrices) : null;
      JM = skin.joints.map((j, k) => mul4(G[j] ?? IDENT, IBM ? IBM.slice(k * 16, k * 16 + 16) : IDENT));
    }
    for (const prim of mesh.primitives || []) {
      if (prim.attributes?.POSITION == null) continue;
      const P = readAccessor(json, bin, prim.attributes.POSITION);
      const J = JM && prim.attributes.JOINTS_0 != null ? readAccessor(json, bin, prim.attributes.JOINTS_0) : null;
      const W = JM && prim.attributes.WEIGHTS_0 != null ? readAccessor(json, bin, prim.attributes.WEIGHTS_0) : null;
      const n = P.length / 3, R = new Array(P.length);
      for (let i = 0; i < n; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        let p = null;
        if (J && W) {
          const acc = [0, 0, 0];
          let sw = 0;
          for (let k = 0; k < 4; k++) {
            const w = W[i * 4 + k];
            if (!(w > 0)) continue;
            const q = xf(JM[J[i * 4 + k]] ?? IDENT, x, y, z);
            acc[0] += w * q[0]; acc[1] += w * q[1]; acc[2] += w * q[2]; sw += w;
          }
          if (sw > 0) p = [acc[0] / sw, acc[1] / sw, acc[2] / sw];
        }
        if (!p) p = xf(G[ni], x, y, z);
        R[i * 3] = p[0]; R[i * 3 + 1] = p[1]; R[i * 3 + 2] = p[2];
      }
      out.push({ node: ni, prim, P: R, skinned: !!(J && W) });
    }
  });
  return out;
}

/** Each vertex of every drawn mesh at rest, in the file's own frame: `each(p, node, prim)`; `stride` keeps every n-th. */
export function forEachRestVertex(json, bin, each, { stride = 1, G = sceneMatrices(json) } = {}) {
  for (const { node, prim, P } of restPrimitives(json, bin, { G })) for (let i = 0; i < P.length / 3; i += stride) each([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], node, prim);
}

/** Every triangle at rest in mojulo's NATIVE frame (z up), flat: [ax, ay, az, bx, …] (strips and fans fanned out). */
export function restTriangles(glb) {
  const { json, bin } = parseGlb(Buffer.isBuffer(glb) ? glb : Buffer.from(glb));
  const out = [];
  for (const { prim, P } of restPrimitives(json, bin)) {
    const mode = prim.mode ?? 4;
    const n = P.length / 3;
    const idx = prim.indices != null ? readAccessor(json, bin, prim.indices) : Array.from({ length: n }, (_, i) => i);
    const push = (i) => { const q = toNative([P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]); out.push(q[0], q[1], q[2]); };
    if (mode === 4) for (let t = 0; t + 2 < idx.length; t += 3) { push(idx[t]); push(idx[t + 1]); push(idx[t + 2]); }
    else if (mode === 5) for (let t = 0; t + 2 < idx.length; t++) { push(idx[t]); push(idx[t + 1 + (t & 1)]); push(idx[t + 2 - (t & 1)]); }
    else if (mode === 6) for (let t = 1; t + 1 < idx.length; t++) { push(idx[0]); push(idx[t]); push(idx[t + 1]); }
  }
  return out;
}

function licenceOf(json) {
  const ex = json.extensions || {};
  if (ex.VRMC_vrm?.meta) {
    const m = ex.VRMC_vrm.meta;
    return {
      title: m.name ?? null, author: Array.isArray(m.authors) ? m.authors.join(', ') : null, url: m.licenseUrl ?? null,
      commercial: m.commercialUsage ?? null, redistribution: m.allowRedistribution ?? null, modification: m.modification ?? null,
      credit: m.creditNotation ?? null, avatar: m.avatarPermission ?? null, basis: 'VRMC_vrm.meta',
    };
  }
  if (ex.VRM?.meta) {
    const m = ex.VRM.meta;
    return {
      title: m.title ?? null, author: m.author ?? null, name: m.licenseName ?? null, url: m.otherLicenseUrl || null,
      commercial: m.commercialUssageName ?? null, avatar: m.allowedUserName ?? null, basis: 'VRM.meta',
    };
  }
  const a = json.asset || {}, x = a.extras || {};
  const out = {
    title: x.title ?? null, author: x.author ?? null, name: typeof x.license === 'string' ? x.license : null,
    source: x.source ?? null, copyright: a.copyright ?? null,
  };
  if (!Object.values(out).some(Boolean)) return null;
  return { ...out, basis: 'asset' };
}

function licenceWarnings(lic) {
  const w = [];
  if (!lic) return ['the file names no licence: say where it came from and under what terms (`licence`), so its exports carry it'];
  if (lic.commercial && /personal|nonprofit|disallow/i.test(String(lic.commercial))) w.push(`its licence limits commercial use (${lic.commercial})`);
  if (lic.redistribution === false) w.push('its licence does not allow it to be redistributed: an exported game carrying it is for its maker, not for sharing');
  if (lic.modification && /prohibited/i.test(String(lic.modification))) w.push(`its licence does not allow it to be modified (${lic.modification}): rigging it is a modification`);
  if (lic.name && /\bNC\b|non-?commercial/i.test(lic.name)) w.push(`its licence is non-commercial (${lic.name})`);
  if (lic.name && /\bND\b|no ?deriv/i.test(lic.name)) w.push(`its licence allows no derivatives (${lic.name}): rigging it is one`);
  return w;
}

/** What a canonical GLB holds (see the header). */
export function inspectModel(glb) {
  const { json, bin } = parseGlb(Buffer.isBuffer(glb) ? glb : Buffer.from(glb));
  let triangles = 0, primitives = 0, morphs = 0;
  for (const m of json.meshes || []) for (const p of m.primitives || []) {
    primitives += 1;
    morphs = Math.max(morphs, (p.targets || []).length);
    const mode = p.mode ?? 4;
    const count = p.indices != null ? json.accessors?.[p.indices]?.count ?? 0 : json.accessors?.[p.attributes?.POSITION]?.count ?? 0;
    if (mode === 4) triangles += Math.floor(count / 3);
    else if (mode === 5 || mode === 6) triangles += Math.max(0, count - 2);
  }
  const images = {};
  for (const im of json.images || []) { const k = im.mimeType || 'unknown'; images[k] = (images[k] || 0) + 1; }
  const skins = (json.skins || []).map((s) => ({ joints: s.joints.length, names: s.joints.map((j) => json.nodes?.[j]?.name ?? `node${j}`) }));
  const clips = (json.animations || []).map((a, i) => {
    let seconds = 0;
    for (const s of a.samplers || []) { const acc = json.accessors?.[s.input]; if (acc?.max?.[0] > seconds) seconds = acc.max[0]; }
    return { name: a.name || `clip${i}`, channels: (a.channels || []).length, seconds: r4(seconds) };
  });
  const vrm = json.extensions?.VRMC_vrm ? '1.0' : json.extensions?.VRM ? '0.x' : null;
  const licence = licenceOf(json);
  // the rest, in the native frame
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  let skinned = false, seen = 0;
  const stride = triangles > 400000 ? 4 : 1;
  for (const r of restPrimitives(json, bin)) {
    if (r.skinned) skinned = true;
    for (let i = 0; i < r.P.length / 3; i += stride) {
      const q = toNative([r.P[i * 3], r.P[i * 3 + 1], r.P[i * 3 + 2]]);
      for (let k = 0; k < 3; k++) { if (q[k] < min[k]) min[k] = q[k]; if (q[k] > max[k]) max[k] = q[k]; }
      seen += 1;
    }
  }
  if (!seen) throw new Error('import: the model draws nothing (no mesh in its scene)');
  const size = [0, 1, 2].map((k) => max[k] - min[k]);
  const height = size[2];
  const rest = { min: min.map(r4), max: max.map(r4), size: size.map(r4), height: r4(height), centre: [0, 1, 2].map((k) => r4((min[k] + max[k]) / 2)), skinned };
  return {
    triangles, meshes: (json.meshes || []).length, primitives, materials: (json.materials || []).length, textures: (json.textures || []).length,
    images, skins, clips, morphs, extensions: [...(json.extensionsUsed || [])].sort(),
    vrm, licence, warnings: licenceWarnings(licence), rest, units: unitsReading(height, { figure: skins.length > 0 }),
  };
}

/**
 * How the file's numbers read as metres: glTF says metres, and a figure (a skinned model) whose height falls outside a
 * figure's range was written in another unit, read every way it could be. Never decided here: the import states it.
 */
export function unitsReading(height, { figure = false } = {}) {
  const readings = UNIT_NAMES.map((u) => ({ units: u, height: r4(height * UNIT_METRES[u]) }));
  const inRange = (h) => h >= FIGURE_RANGE[0] && h <= FIGURE_RANGE[1];
  if (!figure) return { assumed: 'm', basis: 'glTF says metres; a mesh with no skeleton is read at its own numbers', readings };
  if (inRange(height)) return { assumed: 'm', basis: `glTF says metres, and it stands ${r4(height)} m, a figure's height`, readings };
  const fits = readings.filter((r) => inRange(r.height)).map((r) => r.units);
  return { assumed: fits[0] ?? 'm', basis: `it reads ${r4(height)} as metres, outside a figure's ${FIGURE_RANGE.join('–')} m: ${fits.length ? `as ${fits.join(' or ')} it fits` : 'no unit makes it a figure\'s height'}; say its height`, readings, ambiguous: true };
}
