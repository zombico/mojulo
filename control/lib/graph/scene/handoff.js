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
 *   landParts(land) → [instance set]: the form render's land (form/land-read.js formPayload), each part of it (a ground
 *     class: rock, scree, soil, sand, the trail's, the shallows' floor) a mesh of its own, shaded smooth as the page
 *     shades it, each corner its palette-solved base colour (the albedo a plain glTF reader shows) and, on the layered
 *     ground, its four layers' weights (`_SPLAT`) with the layers' atlases, their tiles and their means in its material's
 *     `extras.mojulo.terrain`: what an engine's terrain shader blends (each layer along the face's dominant axis, by
 *     weight and by its own height, as the page does). The painted faces it stands for leave the export; the sea stays
 *     the painted one
 *   roomLamps(room) → [glTF point light]: a room's lamps under the form render's solve (form/room-light.js): each where
 *     its flame is, its solved key as its colour and, in a renderer's units, its strength (π × the key's level: out =
 *     base × light, form/room-light.js), its reach its radius. With them its surfaces leave as their solved bases, so the
 *     engine's lamps light them as the page's bake does
 *   levelRecord(sketch, payload) → the LEVEL a developer wires (the GLB's scene extras `moj:handoff`, and the handoff's
 *     `level`): its environment (the sky, the sun at the level's hour, the ambient, the hour itself), its markers (the
 *     spawn, every entity as the node `entity:<id>` carries it, with its part in the loop: the pilot, a seat's body, a
 *     foe with its mind's rank and skill, a thing; the anchors; the cameras), its CONTRACT (the level's game channel,
 *     synthesized from its mechanics as the game resolves it: what it produces, consumes and audits, its doors), its SEATS
 *     (a couch level: each seat's number, label, colour, body and spawn, the screen they share, their lives) and its
 *     REFERENCE (the web build and the bible pages of the same recipe). Every name derives from the recipe (an entity's
 *     id, an anchor's id, a camera's name), never from an order, so a re-handoff of a changed recipe names what did not
 *     change as it was
 *   floraInstances(flora) → [instance set]: the form render's plants (form/flora-read.js), per template its wood on its
 *     bark (base, normal, ORM, the height in the extras) and its crown (its clumps merged in its own space as the page
 *     merges them, each leaf's normal bent toward the crown's outside, as the page's shader bends it), each plant a node
 *     of each, turned about +Z and scaled to its height
 *
 * Built so far: the albedo floor, the scree's stones, the plants, the dressed faces, the land as form, its rock's relief
 * as geometry, a room's lamps over its solved bases, and the level record. Colliders as meshes and the files beside the
 * handoff (the web build, the sound) join as their phases land.
 */
import { resolveWorldScene } from '../worlds/world-scene.js';
import { facesToGlb } from './scene-gltf.js';
import { stoneForms } from '../form/land-stones.js';
import { dressedMaterial } from '../matte-paint/dressed.js';
import { FORM_ROUGH } from '../form/room-form.js';
import { generatedSpecOf, encodePng, encodePngGrey } from '../landscape/surface-textures.js';
import { levelSceneExtras, levelCameras } from './scene-gltf-level.js';
import { synthesizeLevel } from '../game/level-synth.js';
import { normalizeLevelContract } from '../game/level-contract.js';
import { buildSeatsKernel } from '../controls/seats-kernel.js';

export const HANDOFF_VERSION = 'handoff/0';
export const HANDOFF_WHATS = Object.freeze(['level', 'asset']);
/** The form render the handoff reads, whatever the recipe's own era. */
export const HANDOFF_ERA = 'gen-7';

// (what the page draws that the handoff does not carry yet: each leaves the ledger as the phase that adds it lands)
const STAYS = Object.freeze([
  'the layered ground\'s blend: its layers\' weights and atlases are carried for an engine\'s terrain shader, the path, the trail\'s dress, the moss, the undergrowth and the scree\'s thinning are the page\'s; a plain reader sees each corner\'s solved colour',
  'the stones\' skin (the rock layer\'s tile over them): each stone leaves in its solved colour',
  'each plant\'s own tint (a template\'s plants leave in their mean leaf and bark colour), the wind, the sprays near the eye, the far levels of detail (an engine makes its own), a needled crown\'s needles, a shrub\'s blossoms and berries',
  'a tile painted other than from relief (its light painted in): it leaves as its paint',
  'the grass and its drifts',
  'a room\'s baked bounce and ambient (its lamps leave as lights, its surfaces as their solved bases)',
  'a level\'s rules (its cues, its HUD, its minds\' decisions): its contract, markers and seats are carried as data for a developer to wire',
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

// --- the land as form (the page's channels/form-land.js parts, without three) ---

const LIN8 = Float32Array.from({ length: 256 }, (_, v) => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const i8 = (s) => { const b = Buffer.from(s, 'base64'); return new Int8Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
/** The painted groups the form's land stands for, but its water: the sea leaves painted (the page draws it as a plane
 *  over the depth, an engine as its own water). */
export const landHides = (land) => (land?.hides ?? []).filter((g) => !/:water$/.test(g));

// THE ROCK'S RELIEF AS GEOMETRY (the page's reliefPart, channels/form-land.js): a cliff's triangles cut into a finer
// grid (NS a side) and every point pushed along its normal by the relief (form/rock-relief.js, read along the face's two
// side axes as the page reads it), by how steep it stands; a corner shared with another part stays where it is, so the
// cliff meets the land round it without a gap; the cut faces' normals their own, blended back to the land's where
// nothing moved
const sst = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
const steepOf = (nz) => 1 - sst(0.5, 0.8, Math.abs(nz));
function reliefField(relief) {
  const b = Buffer.from(relief.px, 'base64'), q = new Uint16Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)), sp = relief.hi - relief.lo;
  return { N: relief.size, T: relief.tile, h: Float32Array.from(q, (v) => (v / 65535 - 1) * sp) };
}
function reliefAt(RF, x, y, z, nx, ny, nz) {
  const st = steepOf(nz); if (st <= 0) return 0;
  const { N, T, h } = RF, samp = (u, v) => {
    const fx = (((u / T) % 1) + 1) % 1 * N - 0.5, fy = (((v / T) % 1) + 1) % 1 * N - 0.5, i = Math.floor(fx), j = Math.floor(fy), ax = fx - i, ay = fy - j;
    const at = (a, bb) => h[(((bb % N) + N) % N) * N + (((a % N) + N) % N)];
    return (at(i, j) * (1 - ax) + at(i + 1, j) * ax) * (1 - ay) + (at(i, j + 1) * (1 - ax) + at(i + 1, j + 1) * ax) * ay;
  };
  const aX = Math.abs(nx), aY = Math.abs(ny), bx = aX / Math.max(1e-4, aX + aY);
  const [u1, u2, w2] = aX >= aY ? [y * Math.sign(nx), -x * Math.sign(ny), 0.5 * (1 - sst(0, 0.12, bx - 0.5))] : [-x * Math.sign(ny), y * Math.sign(nx), 0.5 * (1 - sst(0, 0.12, 0.5 - bx))];
  return st * ((1 - w2) * samp(u1, z) + w2 * samp(u2, z));
}
const RELIEF_NS = 6;
function reliefCut(R, ranges, POS, COL, SPLF, NRMF, RF) {
  const key = (x, y, z) => Math.round(x * 500) + ',' + Math.round(y * 500) + ',' + Math.round(z * 500), NS = RELIEF_NS;
  const others = new Set(); for (const Q of ranges) if (Q !== R) for (let v = Q.start; v < Q.start + Q.count; v++) others.add(key(POS[v * 3], POS[v * 3 + 1], POS[v * 3 + 2]));
  const P = [], CO = [], SP = [], NI = [], WK = [], cut = [];
  const push = (p, c, sp, n, w, k) => { P.push(p[0], p[1], p[2]); CO.push(c[0], c[1], c[2]); SP.push(sp[0], sp[1], sp[2], sp[3]); NI.push(n[0], n[1], n[2]); WK.push(w); cut.push(k); };
  const corner = (v) => ({ p: [POS[v * 3], POS[v * 3 + 1], POS[v * 3 + 2]], c: [COL[v * 3], COL[v * 3 + 1], COL[v * 3 + 2]], s: [SPLF[v * 4], SPLF[v * 4 + 1], SPLF[v * 4 + 2], SPLF[v * 4 + 3]], n: [NRMF[v * 3], NRMF[v * 3 + 1], NRMF[v * 3 + 2]] });
  const mix3 = (A, B, Cc, a, b, c) => A.map((_, k) => A[k] * c + B[k] * a + Cc[k] * b);
  for (let v = R.start; v < R.start + R.count; v += 3) {
    const K = [corner(v), corner(v + 1), corner(v + 2)], free = K.map((q) => (others.has(key(...q.p)) ? 0 : 1));
    if (free.every((f) => !f) || K.every((q) => steepOf(q.n[2]) <= 0)) { for (const q of K) push(q.p, q.c, q.s, q.n, 0, 0); continue; }
    const idx = (i, j) => i * (NS + 1) - (i * (i - 1)) / 2 + j, pts = [];
    for (let i = 0; i <= NS; i++) for (let j = 0; j <= NS - i; j++) {
      const a = i / NS, b = j / NS, c = 1 - a - b, p = mix3(K[0].p, K[1].p, K[2].p, a, b, c), nr = mix3(K[0].n, K[1].n, K[2].n, a, b, c), l = Math.hypot(...nr) || 1, n = nr.map((x) => x / l);
      const w = free[0] * c + free[1] * a + free[2] * b, d = w * reliefAt(RF, p[0], p[1], p[2], n[0], n[1], n[2]);
      pts.push([p.map((x, k) => x + n[k] * d), mix3(K[0].c, K[1].c, K[2].c, a, b, c), mix3(K[0].s, K[1].s, K[2].s, a, b, c), n, w * steepOf(n[2])]);
    }
    const tri = (q0, q1, q2) => { for (const q of [q0, q1, q2]) { const t = pts[q]; push(t[0], t[1], t[2], t[3], t[4], 1); } };
    for (let i = 0; i < NS; i++) for (let j = 0; j < NS - i; j++) {
      tri(idx(i, j), idx(i + 1, j), idx(i, j + 1));
      if (j < NS - i - 1) tri(idx(i + 1, j), idx(i + 1, j + 1), idx(i, j + 1));
    }
  }
  const n = P.length / 3, acc = new Map(), fn = new Float32Array(n * 3);
  for (let t = 0; t < n; t += 3) {
    if (!cut[t]) continue;
    const a = t * 3, e1 = [P[a + 3] - P[a], P[a + 4] - P[a + 1], P[a + 5] - P[a + 2]], e2 = [P[a + 6] - P[a], P[a + 7] - P[a + 1], P[a + 8] - P[a + 2]];
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    for (let k = 0; k < 3; k++) { const q = key(P[(t + k) * 3], P[(t + k) * 3 + 1], P[(t + k) * 3 + 2]), sm = acc.get(q) ?? [0, 0, 0]; sm[0] += cr[0]; sm[1] += cr[1]; sm[2] += cr[2]; acc.set(q, sm); }
  }
  for (let v = 0; v < n; v++) {
    let nx = NI[v * 3], ny = NI[v * 3 + 1], nz = NI[v * 3 + 2];
    if (cut[v]) {
      const sm = acc.get(key(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])), l = Math.hypot(...sm) || 1, k = sst(0, 0.25, WK[v]);
      nx += (sm[0] / l - nx) * k; ny += (sm[1] / l - ny) * k; nz += (sm[2] / l - nz) * k;
    }
    const l = Math.hypot(nx, ny, nz) || 1; fn[v * 3] = nx / l; fn[v * 3 + 1] = ny / l; fn[v * 3 + 2] = nz / l;
  }
  return { positions: Float32Array.from(P), colors: Float32Array.from(CO), splat: Float32Array.from(SP), normals: fn, cut: cut.filter(Boolean).length / 3 };
}

export function landParts(land) {
  if (!land || !land.ranges?.length) return [];
  const POS = f32(land.pos), C7 = u8(land.c7), SPL = u8(land.spl), NRM = i8(land.nrm), keys = land.layers?.keys ?? [];
  const RF = land.relief ? reliefField(land.relief) : null;
  const L = land.layers, atlases = L ? { base: L.base, normal: L.normal, orm: L.orm } : null;
  const read = L ? { tile: L.tile, mean: L.mean, keys, atlas: { cells: keys.length, grid: 3, size: L.size }, ormBlue: 'height' } : null;
  const sets = [];
  for (const R of land.ranges) {
    // (the sea: the painted one stays; what the read could not class stays painted)
    if (R.key === 'water' || R.key === 'unread' || !R.count) continue;
    const a = R.start, n = R.count, ground = keys.includes(R.key.split(':')[0]), floor = R.key === 'sand:under';
    const positions = POS.slice(a * 3, (a + n) * 3), colors = new Float32Array(n * 3), normals = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) for (let c = 0; c < 3; c++) {
      colors[v * 3 + c] = LIN8[C7[(a + v) * 4 + c]];
      normals[v * 3 + c] = floor ? (c === 2 ? 1 : 0) : Math.max(-1, NRM[(a + v) * 3 + c] / 127);
    }
    let splat = ground ? Float32Array.from(SPL.subarray(a * 4, (a + n) * 4), (x) => x / 255) : null;
    // (a cliff under a relief: its rock as geometry, cut and pushed as the page pushes it)
    let geo = { positions, normals, colors }, cut = 0;
    if (RF && R.key === 'cliff') {
      const all = { POS, COL: new Float32Array(POS.length), SPLF: new Float32Array(SPL.length), NRMF: new Float32Array(NRM.length) };
      for (let k = 0; k < POS.length; k++) { all.COL[k] = LIN8[C7[Math.floor(k / 3) * 4 + (k % 3)]]; all.NRMF[k] = Math.max(-1, NRM[k] / 127); }
      for (let k = 0; k < SPL.length; k++) all.SPLF[k] = SPL[k] / 255;
      const C = reliefCut(R, land.ranges, POS, all.COL, all.SPLF, all.NRMF, RF);
      geo = { positions: C.positions, normals: C.normals, colors: C.colors }; cut = C.cut;
      if (ground) splat = C.splat;
    }
    sets.push({ name: `form:land:${R.key.replace(/[^A-Za-z0-9_-]/g, '_')}`, ...geo, ...(splat ? { splat } : {}), ...(cut ? { relief: cut } : {}),
      transforms: [{ translation: [0, 0, 0] }], color: [1, 1, 1], roughness: R.rough ?? 0.9,
      ...(ground && atlases ? { terrain: { part: R.key, atlases, read } } : {}) });
  }
  return sets;
}

// --- a room's lamps ---

export function roomLamps(room) {
  return (room?.lights ?? []).map((l, i) => {
    const m = Math.max(...l.key, 1e-9);
    return { name: `form:lamp:${i}`, type: 'point', position: l.at, color: l.key.map((v) => r5(v / m)), intensity: r5(Math.PI * m), range: l.radius };
  });
}

// --- the level a developer wires ---

export const HANDOFF_LEVEL = 'handoff-level/0';
const { SEAT_COLORS, SEAT_LABELS } = (() => { const K = buildSeatsKernel(); return { SEAT_COLORS: K.SEAT_COLORS, SEAT_LABELS: K.SEAT_LABELS }; })();
const v3 = (v) => (Array.isArray(v) && v.length >= 3 ? [r5(v[0]), r5(v[1]), r5(v[2])] : null);

/** The sun a level with none of its own and no lamps is given: high in the south-east, warm white, at a renderer's
 *  strength of π (the solve's level 1). */
export const DEFAULT_SUN = Object.freeze({ direction: Object.freeze([0.36, -0.48, 0.8]), color: Object.freeze([1, 0.96, 0.9]), intensity: r5(Math.PI) });

function environmentOf(sketch, payload) {
  const land = payload.form?.land, room = payload.form?.room, M = sketch?.manifest ?? {};
  const sky = land?.sky ?? payload.sky ?? null, sun = land?.sun ?? null, sunL = land?.light?.sun ?? null;
  const env = {};
  if (M.hour !== undefined) env.hour = M.hour;
  if (typeof payload.bg === 'string') env.background = payload.bg;
  if (sky && (sky.zenith || sky.horizon)) env.sky = { ...(sky.zenith ? { zenith: sky.zenith } : {}), ...(sky.horizon ? { horizon: sky.horizon } : {}) };
  // (the sun's light in the solve's units, out = base × light: a renderer's directional light is π × its level, as a lamp's)
  if (sun && sunL) { const m = Math.max(...sunL, 1e-9); env.sun = { direction: v3(sun), color: sunL.map((v) => r5(v / m)), intensity: r5(Math.PI * m) }; }
  const amb = land?.light?.ambient ?? room?.ambient ?? null;
  if (Array.isArray(amb)) env.ambient = amb.map(r5);
  if (payload.haze) env.haze = payload.haze;
  if (payload.weather) env.weather = true;
  // (a level with no sun of its own and no lamp, a stage lit only by its paint: a default noon sun, marked so, that a
  // developer replaces; a room lit by its lamps takes none)
  if (!env.sun && !(Array.isArray(payload.lights) && payload.lights.length)) env.sun = { ...DEFAULT_SUN, default: true };
  return env;
}

function contractOf(sketch) {
  const M = sketch?.manifest;
  if (!M || !M.game || typeof M.game !== 'object') return null;
  try { return normalizeLevelContract(synthesizeLevel(M).game); } catch { return { unsynthesized: true, game: M.game }; }
}

export function levelRecord(sketch, payload) {
  const list = (Array.isArray(payload.entities) ? payload.entities : []).filter((e) => e && typeof e === 'object');
  const pilot = payload.pilot ?? list.find((e) => e.pilotable)?.id ?? null, seats = payload.seats ?? null;
  const seatOf = (id) => (id === pilot ? 1 : seats && seats.bodies.includes(id) ? seats.bodies.indexOf(id) + 2 : null);
  const entities = list.map((e, i) => {
    const id = String(e.id ?? i), seat = seatOf(id), mind = e.rule?.mind && typeof e.rule.mind === 'object' ? e.rule.mind : null;
    const role = seat === 1 ? 'pilot' : seat ? 'seat' : mind || e.rule?.type === 'ai' ? 'foe' : 'thing';
    return { name: `entity:${id}`, role, ...(seat ? { seat } : {}), ...(e.rule?.type ? { rule: e.rule.type } : {}),
      at: v3(e.transform?.pos) ?? [0, 0, 0], ...(Number.isFinite(e.transform?.heading) ? { heading: r5(e.transform.heading) } : {}),
      ...(mind ? { mind: Object.fromEntries(['rank', 'skill', 'group', 'motivation'].filter((k) => mind[k] !== undefined).map((k) => [k, mind[k]])) } : {}),
      ...(e.rule?.foe ? { attack: e.rule.foe } : {}) };
  });
  const ex = levelSceneExtras(payload) ?? {};
  const markers = [
    ...(ex['moj:spawn'] ? [{ name: 'spawn', kind: 'spawn', at: v3(ex['moj:spawn']) }] : []),
    ...entities.map((e) => ({ kind: 'entity', ...e })),
    ...(ex['moj:anchors'] ?? []).map((a) => ({ ...a, name: `anchor:${a.id}`, kind: 'anchor', anchor: a.kind })),
    ...(levelCameras(payload) ?? []).map((c) => {
      const cam = (payload.cameras ?? []).find((x, i) => x && (x.name || `view ${i}`) === c.name), look = cam?.worldFraming?.lookAt;
      return { name: `camera:${c.name}`, kind: 'camera', at: v3(c.translation), ...(look ? { look: v3(look) } : {}), yfov: r5(c.yfov) };
    }),
  ];
  const seatRows = seats ? Array.from({ length: seats.max }, (_, k) => {
    const n = k + 1, body = n === 1 ? pilot : seats.bodies[n - 2] ?? null, e = body ? entities.find((x) => x.name === `entity:${body}`) : null;
    return { n, label: SEAT_LABELS[k], color: SEAT_COLORS[k], ...(body ? { body: `entity:${body}`, spawn: e?.at ?? null } : {}) };
  }) : null;
  return {
    version: HANDOFF_LEVEL, ref: sketch?.ref ?? null, title: payload.title ?? sketch?.title ?? null, frame: 'z-up', units: 'metres',
    environment: environmentOf(sketch, payload),
    markers,
    contract: contractOf(sketch),
    ...(seatRows ? { seats: { rows: seatRows, screen: 'shared', lives: seats.lives ?? null, pool: seats.pool ?? null, join: seats.join ?? 'drop-in', drop: seats.drop ?? null } } : {}),
    ...(sketch?.ref ? { reference: { web: `/api/sketches/${sketch.ref}/world`, play: `/api/sketches/${sketch.ref}/play`, bible: `/api/sketches/${sketch.ref}/bible` } } : {}),
  };
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
  const land = payload.form?.land ?? null, hides = new Set(landHides(land));
  const instances = [...landParts(land), ...stoneInstances(land?.stones), ...floraInstances(payload.form?.flora)];
  // (the painted faces the form's land stands for leave: the land is its parts above)
  const lamps = roomLamps(payload.form?.room);
  const handed = hides.size || lamps.length ? { ...payload, ...(hides.size ? { faces: (payload.faces || []).filter((f) => !(f && hides.has(f.group))) } : {}),
    // (a room under the solve: its lamps are the solve's, the stage's own lights the same flames at the paint's levels)
    ...(lamps.length ? { lights: lamps } : {}) } : payload;
  const keys = (handed.faces || []).map((f) => f && f.texture).filter((k) => typeof k === 'string');
  const materials = dressedMaterials(keys);
  const level = what === 'level' ? levelRecord(sketch, handed) : null;
  const exported = facesToGlb(handed, { generator: `mojulo handoff ${sketch?.ref ?? ''}`.trim(), lit: true, handoff: true, instances, materials,
    ...(level ? { sceneExtras: { 'moj:handoff': level } } : {}) });
  if (!exported) throw new Error(`handoff: '${sketch?.ref ?? sketch?.title ?? '?'}' has nothing to hand off`);
  const counts = {};
  // (a plant counts once, though its wood and its crown are two sets)
  for (const s of instances) { if (s.name.endsWith(':crown') || s.name.startsWith('form:land:')) continue; const k = s.name.split(':')[1]; counts[k] = (counts[k] ?? 0) + s.transforms.length; }
  const landSets = instances.filter((s) => s.name.startsWith('form:land:'));
  const ledger = {
    version: HANDOFF_VERSION, era: HANDOFF_ERA, what,
    carried: { faces: Array.isArray(handed.faces) ? handed.faces.length : 0, instances: counts, ...(lamps.length ? { lamps: lamps.length } : {}),
      ...(level ? { level: { markers: level.markers.length, contract: !!level.contract, seats: level.seats ? level.seats.rows.length : 0, environment: Object.keys(level.environment) } } : {}),
      ...(landSets.length ? { land: { parts: landSets.length, layered: landSets.filter((s) => s.terrain).length, vertices: landSets.reduce((a, s) => a + s.positions.length / 3, 0), reliefCut: landSets.reduce((a, s) => a + (s.relief ?? 0), 0) } } : {}), materials: { dressed: Object.keys(materials).length, painted: new Set(keys).size - Object.keys(materials).length } },
    stays: [...STAYS],
  };
  return { kind, payload, exported, instances, materials, level, ledger };
}
