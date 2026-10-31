/**
 * THE ENGINE HANDOFF (the `engine-handoff` theme): what an engine is handed of a mojulo world, written once and read by
 * every engine's adapter (Godot, Unity, Unreal, Blender), never a game's rules. The web is the game, end to end; an
 * engine gets the polygon-level work: the ASSETS (every surface as a material the engine lights, the form render's
 * instances), the ANIMATION (the rigs, clips and faces the GLB already carries) and the LEVELS (layout, light, colliders
 * and markers).
 *
 * It reads the world in the form render (gen-7, era/eras.js): a surface carries its material and its form, never light,
 * which is how an engine lights a scene. The read is unshaded (`handoff: true` lets the form render's land read run under
 * it, worlds/world-scene.js), so a surface not yet built as form leaves as ALBEDO UNLIT: its own colour, no light baked
 * in, under a lit material the engine shades.
 *
 *   resolveHandoff(sketch, { what? }) → { kind, payload, exported, instances, ledger }
 *     what      'level' (a world, default) | 'asset' (one thing by ref)
 *     exported  facesToGlb's result: the GLB, lit (glTF metal-rough, no unlit extension), the instances in it
 *     ledger    { version, era, what, carried: { faces, instances: { <set>: n } }, stays: [what stayed the web's] }
 *   stoneInstances(stones) → [instance set]: the form land's scree stones (form/land-stones.js), one set per shape, size
 *     and tone, each stone a node turned to its ground's normal and yawed by its index, as the World page stands them
 *   dressedMaterials(keys) → { <key>: { base, normal, orm, height, depth, metres, rough } }: each tile key painted by the
 *     matte painter (matte-paint/dressed.js, the `dressed` generator) painted again as material: its colour under no light,
 *     its relief's tangent-space normal, glTF's ORM (occlusion red, roughness green, no metal) and its height as its own
 *     grey map over `depth` metres, for an engine's parallax. A tile painted any other way keeps its paint (its light
 *     painted in, the ledger says so)
 *   floraInstances(flora) → [instance set]: the form render's plants (form/flora-read.js), per template its wood on its
 *     bark (base, normal, ORM, the height in the extras) and its crown (its clumps merged in its own space as the page
 *     merges them, each leaf's normal bent toward the crown's outside, as the page's shader bends it), each plant a node
 *     of each, turned about +Z and scaled to its height
 *
 * Built so far: the albedo floor, the scree's stones, the plants and the dressed faces. The land's layers, the rooms'
 * light, the environment and the markers join as their phases land.
 */
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { stoneForms } from '../form/land-stones.js';
import { dressedMaterial } from '../matte-paint/dressed.js';
import { FORM_ROUGH } from '../form/room-form.js';
import { generatedSpecOf, encodePng, encodePngGrey } from '../landscape/surface-textures.js';

export const HANDOFF_VERSION = 'handoff/0';
export const HANDOFF_WHATS = Object.freeze(['level', 'asset']);
/** The form render the handoff reads, whatever the recipe's own era. */
export const HANDOFF_ERA = 'gen-7';

// (what the page draws that the handoff does not carry yet: each leaves the ledger as the phase that adds it lands)
const STAYS = Object.freeze([
  'the land\'s layered ground (its layers, their relief and parallax): the land leaves as its painted faces\' albedo',
  'the stones\' skin (the rock layer\'s tile over them): each stone leaves in its solved colour',
  'each plant\'s own tint (a template\'s plants leave in their mean leaf and bark colour), the wind, the sprays near the eye, the far levels of detail (an engine makes its own), a needled crown\'s needles, a shrub\'s blossoms and berries',
  'a tile painted other than from relief (its light painted in): it leaves as its paint',
  'the grass and its drifts',
  'the light: the sun at the level\'s hour, the sky, fog and occlusion',
]);

// (the page's per-stone jitter, channels/form-land.js: the same hash, so a stone stands as wide and as deep as on the page)
const hsh = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
const r5 = (v) => Math.round(v * 1e5) / 1e5;
// (a stone whose radius is under CAST_R takes the far shape, its block of fractures; the page's own split)
const CAST_R = 0.18, PER = 9, YAW = 2.399;

// the rotation that takes +Z to the unit normal n (three's setFromUnitVectors), then the yaw `a` about +Z after it
function standOn(n, a) {
  const l = Math.hypot(n[0], n[1], n[2]) || 1, x = n[0] / l, y = n[1] / l, z = n[2] / l;
  let q;
  if (z < -1 + 1e-6) q = [0, -1, 0, 0];
  else { const w = 1 + z, k = Math.hypot(-y, x, 0, w); q = [-y / k, x / k, 0, w / k]; }
  const s = Math.sin(a / 2), c = Math.cos(a / 2);
  // q × (0, 0, s, c)
  return [q[3] * 0 + q[0] * c + q[1] * s - q[2] * 0, q[3] * 0 - q[0] * s + q[1] * c + q[2] * 0, q[3] * s + q[0] * 0 - q[1] * 0 + q[2] * c, q[3] * c - q[0] * 0 - q[1] * 0 - q[2] * s];
}

export function stoneInstances(stones) {
  if (!stones || !stones.n) return [];
  const buf = Buffer.from(stones.px, 'base64'), SP = new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const forms = stoneForms();
  const sets = new Map();
  for (let i = 0; i < stones.n; i++) {
    const o = i * PER, r = SP[o + 3], v = SP[o + 8], big = r >= CAST_R, tone = Math.round(SP[o + 7] * 10) / 10;
    const key = `${v}:${big ? 'near' : 'far'}:${tone.toFixed(1)}`;
    if (!sets.has(key)) {
      const F = forms[big ? 'near' : 'far'][v];
      sets.set(key, { name: `form:stones:${v}:${big ? 'near' : 'far'}:${tone.toFixed(1)}`, positions: Float32Array.from(F.pos), normals: Float32Array.from(F.nrm),
        color: stones.base.map((c) => r5(Math.min(1, c * tone))), roughness: 0.85, transforms: [] });
    }
    sets.get(key).transforms.push({
      translation: [r5(SP[o]), r5(SP[o + 1]), r5(SP[o + 2])],
      rotation: standOn([SP[o + 4], SP[o + 5], SP[o + 6]], i * YAW).map(r5),
      scale: [r5(r * (0.9 + 0.3 * hsh(i, 1))), r5(r * (0.8 + 0.3 * hsh(i, 2))), r5(r)],
    });
  }
  return [...sets.keys()].sort().map((k) => sets.get(k));
}

// --- the dressed faces (the matte painter's tiles, read as the material they were painted from) ---

const dressedCache = new Map();
const pngUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
export function dressedMaterials(keys) {
  const out = {};
  for (const key of [...new Set(keys)].sort()) {
    const spec = typeof key === 'string' ? generatedSpecOf(key) : null;
    if (!spec || spec.gen !== 'dressed') continue;
    if (dressedCache.has(key) && !dressedCache.get(key)) continue;
    if (!dressedCache.has(key)) {
      // (a cut that paints without a relief has no material: it keeps its paint)
      const rough = FORM_ROUGH[spec.cfg.cut] ?? 0.85;
      let M = null; try { M = dressedMaterial(spec.cfg, { size: spec.size, seed: spec.seed, rough }); } catch { dressedCache.set(key, null); continue; }
      let lo = Infinity, hi = -Infinity; for (const h of M.height) { if (h < lo) lo = h; if (h > hi) hi = h; }
      const span = Math.max(1e-6, hi - lo), grey = Buffer.alloc(M.W * M.H);
      for (let k = 0; k < grey.length; k++) grey[k] = Math.round(((M.height[k] - lo) / span) * 255);
      dressedCache.set(key, { base: pngUrl(encodePng(M.baseColor, M.W, M.H)), normal: pngUrl(encodePng(M.normal, M.W, M.H)), orm: pngUrl(encodePng(M.orm, M.W, M.H)),
        height: pngUrl(encodePngGrey(grey, M.W, M.H)), depth: r5(span), metres: spec.cfg.metres ?? 2, rough });
    }
    if (dressedCache.get(key)) out[key] = dressedCache.get(key);
  }
  return out;
}

// --- the plants (the page's channels/form-flora.js, its merge and placement, without three) ---

const f32 = (s) => { const b = Buffer.from(s, 'base64'); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const u8 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
const norm3 = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const qmul = (a, b) => [a[0] * b[3] + a[3] * b[0] + a[1] * b[2] - a[2] * b[1], a[1] * b[3] + a[3] * b[1] + a[2] * b[0] - a[0] * b[2],
  a[2] * b[3] + a[3] * b[2] + a[0] * b[1] - a[1] * b[0], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
const qrot = (q, v) => {
  const [x, y, z, w] = q, ix = w * v[0] + y * v[2] - z * v[1], iy = w * v[1] + z * v[0] - x * v[2], iz = w * v[2] + x * v[1] - y * v[0], iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
};
const qaxis = (a, ang) => { const s = Math.sin(ang / 2); return [a[0] * s, a[1] * s, a[2] * s, Math.cos(ang / 2)]; };
// (three's setFromUnitVectors)
function qfromTo(f, t) {
  let r = f[0] * t[0] + f[1] * t[1] + f[2] * t[2] + 1, q;
  if (r < 1e-8) { r = 0; q = Math.abs(f[0]) > Math.abs(f[2]) ? [-f[1], f[0], 0, r] : [0, -f[2], f[1], r]; } else q = [...cross3(f, t), r];
  const l = Math.hypot(...q) || 1; return q.map((v) => v / l);
}
// (three's setFromRotationMatrix over makeBasis(x, y, z): the columns its basis)
function qbasis(x, y, z) {
  const [m11, m12, m13, m21, m22, m23, m31, m32, m33] = [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]], tr = m11 + m22 + m33;
  if (tr > 0) { const s = 0.5 / Math.sqrt(tr + 1); return [(m32 - m23) * s, (m13 - m31) * s, (m21 - m12) * s, 0.25 / s]; }
  if (m11 > m22 && m11 > m33) { const s = 2 * Math.sqrt(1 + m11 - m22 - m33); return [0.25 * s, (m12 + m21) / s, (m13 + m31) / s, (m32 - m23) / s]; }
  if (m22 > m33) { const s = 2 * Math.sqrt(1 + m22 - m11 - m33); return [(m12 + m21) / s, 0.25 * s, (m23 + m32) / s, (m13 - m31) / s]; }
  const s = 2 * Math.sqrt(1 + m33 - m11 - m22); return [(m13 + m31) / s, (m23 + m32) / s, 0.25 * s, (m21 - m12) / s];
}
const AXZ = [0, 0, 1], AXX = [1, 0, 0], LEAF_BEND = 0.65, CLUMP_PER = 12;

/** A template's clumps merged in its own space (the page's `merged`): positions, colours (each vertex its tone over its
 *  leaf, the plant's colour the material's) and normals bent toward the crown's outside. */
export function mergeClumps(sites, n, geos, pad) {
  const S = f32(sites), V = geos.map((G) => ({ p: f32(G.p), c: u8(G.c), n: G.n }));
  let tv = 0; for (let i = 0; i < n; i++) tv += V[i % V.length].n * 3;
  const pos = new Float32Array(tv * 3), col = new Float32Array(tv * 3), nrm = new Float32Array(tv * 3);
  let o = 0;
  for (let i = 0; i < n; i++) {
    const b = i * CLUMP_PER, G = V[i % V.length], p = [S[b], S[b + 1], S[b + 2]], fo = [S[b + 3], S[b + 4], S[b + 5]], d = [S[b + 6], S[b + 7], S[b + 8]];
    const s = S[b + 9], tone = 0.62 + 0.38 * S[b + 10], r = S[b + 11];
    let q;
    if (pad === 'cross') { const x = norm3(d), z = norm3(fo); q = qbasis(x, cross3(z, x), z); }
    else if (pad) {
      let x = [d[0], d[1], 0]; if (x[0] * x[0] + x[1] * x[1] < 1e-6) x = [fo[0], fo[1], 0]; if (x[0] * x[0] + x[1] * x[1] < 1e-6) x = [1, 0, 0];
      x = norm3(x); q = qbasis(x, cross3(AXZ, x), AXZ);
    } else { const f = norm3(fo); q = qmul(qaxis(f, r * 40), qfromTo(AXZ, f)); }
    const out = norm3(fo), start = o;
    for (let k = 0; k < G.n * 3; k++, o++) {
      const v = qrot(q, [G.p[k * 3], G.p[k * 3 + 1], G.p[k * 3 + 2]]);
      pos[o * 3] = p[0] + v[0] * s; pos[o * 3 + 1] = p[1] + v[1] * s; pos[o * 3 + 2] = p[2] + v[2] * s;
      for (let c = 0; c < 3; c++) col[o * 3 + c] = (G.c[k * 3 + c] / 128) * tone;
    }
    // (each triangle's own normal, bent toward the clump's outside: a crown takes the sun as one volume)
    for (let t = start; t < o; t += 3) {
      const a = [pos[t * 3], pos[t * 3 + 1], pos[t * 3 + 2]], e1 = [pos[t * 3 + 3] - a[0], pos[t * 3 + 4] - a[1], pos[t * 3 + 5] - a[2]], e2 = [pos[t * 3 + 6] - a[0], pos[t * 3 + 7] - a[1], pos[t * 3 + 8] - a[2]];
      let fn = norm3(cross3(e1, e2)); if (fn[0] * out[0] + fn[1] * out[1] + fn[2] * out[2] < 0) fn = fn.map((v) => -v);
      const bent = norm3([0, 1, 2].map((c) => fn[c] * (1 - LEAF_BEND) + out[c] * LEAF_BEND));
      for (let k = 0; k < 3; k++) nrm.set(bent, (t + k) * 3);
    }
  }
  return { positions: pos, colors: col, normals: nrm };
}

const woodOf = (W) => {
  const big = W.big, ib = Buffer.from(W.idx, 'base64'), ab = ib.buffer.slice(ib.byteOffset, ib.byteOffset + ib.byteLength);
  const nb = Buffer.from(W.nrm, 'base64'), N = new Int8Array(nb.buffer.slice(nb.byteOffset, nb.byteOffset + nb.byteLength));
  return { positions: f32(W.pos), normals: Float32Array.from(N, (v) => Math.max(-1, v / 127)), uvs: f32(W.uv),
    indices: big ? new Uint32Array(ab) : new Uint16Array(ab), ...(W.col ? { colors: Float32Array.from(u8(W.col), (v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) } : {}) };
};

export const FLORA_STRIDE = 13;
export function floraInstances(F) {
  if (!F || !F.n) return [];
  const P = f32(F.trees), by = F.templates.map(() => []);
  for (let i = 0; i < F.n; i++) by[P[i * FLORA_STRIDE + 11]].push(i);
  const mean = (list, o) => [0, 1, 2].map((k) => r5(Math.min(1, list.reduce((a, i) => a + P[i * FLORA_STRIDE + o + k], 0) / list.length)));
  const sets = [];
  F.templates.forEach((t, ti) => {
    const list = by[ti]; if (!list.length) return;
    const transforms = list.map((i) => { const b = i * FLORA_STRIDE, sc = r5(P[b + 3]); return { translation: [r5(P[b]), r5(P[b + 1]), r5(P[b + 2])], rotation: qaxis(AXZ, P[b + 4]).map(r5), scale: [sc, sc, sc] }; });
    const name = `form:flora:${ti}:${String(t.name ?? t.kind).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const B = t.bark && F.barks?.[t.bark];
    sets.push({ name: `${name}:wood`, ...woodOf(t.wood), transforms, color: t.culm ? [1, 1, 1] : mean(list, 8), roughness: t.culm ? 0.62 : 1,
      ...(B ? { textures: { base: B.base, normal: B.normal, orm: B.orm, height: B.height }, depth: B.depth, metres: B.metres } : {}) });
    if (t.sleeve || !t.nClumps) return;
    const crown = mergeClumps(t.clumps, t.nClumps, t.clumpGeo, t.cross ? 'cross' : t.pad);
    // (glTF's colours stay at or under one: a vertex's tone over its leaf can pass it, so the excess moves into the
    // material's colour)
    let K = 1; for (const v of crown.colors) if (v > K) K = v;
    if (K > 1) for (let k = 0; k < crown.colors.length; k++) crown.colors[k] /= K;
    sets.push({ name: `${name}:crown`, ...crown, transforms, color: mean(list, 5).map((v) => r5(Math.min(1, v * K))), roughness: 0.82 });
  });
  return sets;
}

export async function resolveHandoff(sketch, { what = 'level' } = {}) {
  if (!HANDOFF_WHATS.includes(what)) throw new Error(`handoff: what is ${HANDOFF_WHATS.join(' | ')} (got '${what}')`);
  const { payload, kind } = await resolveWorldScene(sketch, { unshaded: true, era: HANDOFF_ERA, handoff: true });
  if (!payload) throw new Error(`handoff: '${sketch?.ref ?? sketch?.title ?? '?'}' resolves to no scene`);
  const instances = [...stoneInstances(payload.form?.land?.stones), ...floraInstances(payload.form?.flora)];
  const keys = (payload.faces || []).map((f) => f && f.texture).filter((k) => typeof k === 'string');
  const materials = dressedMaterials(keys);
  const exported = facesToGlb(payload, { generator: `mojulo handoff ${sketch?.ref ?? ''}`.trim(), lit: true, handoff: true, instances, materials });
  if (!exported) throw new Error(`handoff: '${sketch?.ref ?? sketch?.title ?? '?'}' has nothing to hand off`);
  const counts = {};
  // (a plant counts once, though its wood and its crown are two sets)
  for (const s of instances) { if (s.name.endsWith(':crown')) continue; const k = s.name.split(':')[1]; counts[k] = (counts[k] ?? 0) + s.transforms.length; }
  const ledger = {
    version: HANDOFF_VERSION, era: HANDOFF_ERA, what,
    carried: { faces: Array.isArray(payload.faces) ? payload.faces.length : 0, instances: counts, materials: { dressed: Object.keys(materials).length, painted: new Set(keys).size - Object.keys(materials).length } },
    stays: [...STAYS],
  };
  return { kind, payload, exported, instances, materials, ledger };
}
