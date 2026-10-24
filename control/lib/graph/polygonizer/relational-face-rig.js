/**
 * relational-face-rig — the realistic (relational) head's FACE AS BLEND SHAPES: the head's own actions (head-relational.js
 * ACTIONS: a blink shuts the lids over the globes, a smile draws the mouth's corners up and back and bunches the cheeks,
 * the frontalis lifts the brows, the corrugator draws them down and together) as morph targets an engine plays, each the
 * difference of the hero's head rebuilt with one action at full over the head rebuilt at rest, at the rest's FIT (its
 * scale and place on the body: hero-relational-head.js relationalHeadRecipe `fit`), so an action moves the face and never
 * the head. The western rig (western-face-rig.js) is the pattern; here:
 *   • THE FACE alone is rebuilt (the visage, the nose, the eyes; the cranium and the jaw under it kept as stored), and
 *     WHAT RIDES IT moves with it: the parts pinned to the face (the brows, the lashes, the beard, the hair,
 *     the piercings: hero-head-layers.js) are differenced too, so a blink carries its lashes and a raised brow its hairs.
 *     A LASH turns with its lid: each blade swung about its eye's centre as its root on the margin is, so a shut lid's
 *     lashes point down and out as the lid does, never standing up through the fold (`lashBlades`, `turnLashes`).
 *   • THE TARGETS (RELATIONAL_FACE_TARGETS): blink, blinkLeft, blinkRight (one eye: the blink's difference weighed across
 *     the midline, Left the figure's left, mesh −x), smile, browRaise, browLower. The jaw opens by the jaw BONE.
 *   • ITS WEIGHTS come from the western expression channels (humanoid-head.js EXPRESSIONS, a key's words, the anime
 *     take's four), so the door's `expression`, the clips' keys and the tracks drive it as they drive the landmark head:
 *     the blink its own, the smile the mouth corners' lift over its range end, the brows their raise (a lower below 0)
 *     or their tilt (an acted take's brow: set, the lower; worried, the raise), whichever reads more.
 *   • THE ROWS rebase the rest build onto the figure (the stored head and the rebuilt rest may differ by the cast's last
 *     bit), so a target is always added to the head the figure carries.
 * Null for a hero without the relational head; `{ skipped: reason }` when a build changes the head's layout. Pure and
 * deterministic; its builds are of the face alone (hero-relational-head.js `faceOnly`), kept per head in the process and
 * on disk (relational-face-store.js), so a head pays them (most of a minute) once per machine.
 */
import { compileLayered } from './station-loft.js';
import { relationalHeadRecipe, oneSkinFollow } from './hero-relational-head.js';
import { resolveWesternExpression, CHANNEL_RANGES } from './humanoid-head.js';
import { westernKnots, westernState } from './western-face-rig.js';
import { FACE_FPS, drawEye } from './anime-face-rig.js';
import { faceStoreKey, readFaceStore, writeFaceStore } from './relational-face-store.js';

export const RELATIONAL_FACE_TARGETS = Object.freeze(['blink', 'blinkLeft', 'blinkRight', 'smile', 'browRaise', 'browLower']);
/** the builds the targets are differenced from: each one action at full over the rest */
const BUILDS = Object.freeze({ rest: null, blink: { blink: 1 }, smile: { smile: 1, smileEyes: 0.15 }, browRaise: { browRaise: 1 }, browLower: { browLower: 1 } });
/* (the smile's squint at a seventh: the head's at full all but shuts a deep-set eye; a squint is the aperture's, a key's
 * word); a blink also sinks the globe's faces `BLINK_SINK` behind the lid along the look (squeezed into the shut lid's
 * middle, they would show as a dot) */
const BLINK_SINK = 0.003;
const GLOBE = /^(Sclera|Iris|Pupil)$/;
/** the head's parts the actions move (hero-relational-head.js: the face over the cranium and the jaw, which lie under it
 * and are kept as stored; the ears are still) */
const PIECES = /^(visage|nose|eye[RL])$/, SKIN_PART = /^headSkin$/, LASHES = /^hairLashes$/;
const R = CHANNEL_RANGES;

const MIDLINE = 0.004;
/** the least a target moves a point for it to carry a row (m) */
const MOVES = 1e-4;
const wRight = (x) => { const t = Math.min(1, Math.max(0, (x + MIDLINE) / (2 * MIDLINE))); return t * t * (3 - 2 * t); };
const MOVED = 'an action changes the head\'s layout: the face cannot be differenced';
const RIGS = new Map(), RIGS_MAX = 4;
const keep = (map, key, v) => { if (map.size >= RIGS_MAX) map.delete(map.keys().next().value); map.set(key, v); return v; };
const pos = (x, end) => Math.max(0, x / end);
const layoutOf = (p) => JSON.stringify(p.faces ? Object.keys(p.faces) : p.stations?.map((s) => Object.keys(s.points)) ?? null);

/** a face state (westernState's) → its weights in RELATIONAL_FACE_TARGETS' order (`knots`: each eye drawn at its nearest) */
export function relationalWeights(F, knots) {
  const eL = drawEye(F.eyeL, knots), eR = drawEye(F.eyeR, knots), b = Math.min(eL, eR);
  // (the brows: their raise, or the tilt an acted take or a set face draws, whichever reads more: tilted outer-up the
  // corrugator's set brow, inner-up the worried lift)
  const tilt = F.browTilt ?? 0;
  const w = { blink: b, blinkLeft: eL - b, blinkRight: eR - b, smile: Math.min(1, pos(F.mouthCorner, R.mouthCorner[1])),
    browRaise: Math.min(1, Math.max(pos(F.browRaise, R.browRaise[1]), pos(-tilt, -R.browTilt[0]))),
    browLower: Math.min(1, Math.max(pos(-F.browRaise, -R.browRaise[0]), pos(tilt, R.browTilt[1]))) };
  return RELATIONAL_FACE_TARGETS.map((n) => +w[n].toFixed(6));
}
/** the tracks' knots and weighing for a realistic hero (the western's, its targets and weights its own) */
export function relationalKnots(authored) {
  const K = westernKnots(authored);
  return { ...K, targets: [...RELATIONAL_FACE_TARGETS], weigh: (F) => relationalWeights(F, K.eyeKnots) };
}

/** how what rides the face is carried by it: each point that is not the face's moves by the face's points near it,
 * weighed by a Gaussian of their distance (`sigma`), their sum's weight held to at most 1, so a point on the skin moves
 * as the skin does and one a few centimetres off (a long lock's tip) hardly at all. → per point [index, weight, …] */
export const CARRY = Object.freeze({ sigma: 0.005, reach: 0.02 });
function carriedBy(V, face) {
  const cell = CARRY.reach, grid = new Map(), keyOf = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  V.forEach((p, i) => { if (face[i]) { const k = keyOf(p); (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  return V.map((p, i) => {
    if (face[i]) return null;
    const gx = Math.floor(p[0] / cell), gy = Math.floor(p[1] / cell), gz = Math.floor(p[2] / cell), out = [];
    let sum = 0;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) for (const j of grid.get(`${gx + a},${gy + b},${gz + c}`) || []) {
      const q = V[j], d2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
      if (d2 > CARRY.reach ** 2) continue;
      const w = Math.exp(-d2 / CARRY.sigma ** 2); if (w < 1e-4) continue;
      out.push(j, w); sum += w;
    }
    const k = sum > 1 ? 1 / sum : 1;
    for (let j = 1; j < out.length; j += 2) out[j] *= k;
    return out;
  });
}

/** the carriers a lash's root rides: the nearest `ROOT_NEAR` of the face's points, by inverse distance */
const ROOT_NEAR = 3;
/**
 * THE LASHES TURNED WITH THEIR LIDS: each lash (a connected blade of `lash`, the rest's vertex indices of the lashes'
 * faces) swung about its eye's centre (the nearest of `balls`) by the turn that carries its ROOT (the blade's point
 * nearest the face's points, `onFace`) to where the face under it went, then moved by what is left, so the root lands on the
 * moved margin. A lash a few millimetres off the skin would otherwise move as the still fold beside it does, and stand
 * up through a shut lid. `lashBlades` finds each blade, its root's carriers and its eye once; `turnLashes` writes a
 * target's displacements `d` (the face's points set) for the lashes' points.
 */
function lashBlades(V0, faces, lash, onFace, balls) {
  const parent = new Map(lash.map((i) => [i, i])), find = (i) => { while (parent.get(i) !== i) { parent.set(i, parent.get(parent.get(i))); i = parent.get(i); } return i; };
  for (const t of faces) if (parent.has(t[0]) && parent.has(t[1]) && parent.has(t[2])) { const a = find(t[0]); for (const v of t) parent.set(find(v), a); }
  const blades = new Map(); for (const i of lash) { const r = find(i); (blades.get(r) || blades.set(r, []).get(r)).push(i); }
  const cell = CARRY.reach, grid = new Map(), keyOf = (p) => `${Math.floor(p[0] / cell)},${Math.floor(p[1] / cell)},${Math.floor(p[2] / cell)}`;
  onFace.forEach((c, i) => { if (c) { const k = keyOf(V0[i]); (grid.get(k) || grid.set(k, []).get(k)).push(i); } });
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const nearest = (p) => {
    const g = [0, 1, 2].map((a) => Math.floor(p[a] / cell)), top = [];
    for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const j of grid.get(`${g[0] + x},${g[1] + y},${g[2] + z}`) || []) {
      const e = dist(p, V0[j]); if (top.length < ROOT_NEAR || e < top[top.length - 1][0]) { top.push([e, j]); top.sort((u, v) => u[0] - v[0]); if (top.length > ROOT_NEAR) top.pop(); }
    }
    return top;
  };
  const out = [];
  for (const blade of blades.values()) {
    let root = -1, near = null;
    for (const i of blade) { const t = nearest(V0[i]); if (t.length && (!near || t[0][0] < near[0][0])) { root = i; near = t; } }
    if (root < 0) continue;   // (a blade with no skin within reach rides as the rest does)
    const c = balls.reduce((a, b) => (dist(b.c, V0[root]) < dist(a.c, V0[root]) ? b : a)).c;
    const w = near.map(([e]) => 1 / Math.max(e, 1e-5)), ws = w.reduce((t, x) => t + x, 0);
    out.push({ blade, root, c, near: near.map(([, j], k) => [j, w[k] / ws]) });
  }
  return out;
}
function turnLashes(B, V0, d) {
  for (const { blade, root, c, near } of B) {
    const dr = [0, 1, 2].map((a) => near.reduce((t, [j, w]) => t + w * d[j * 3 + a], 0));
    // (the shortest turn about the centre from the root to the root moved, Rodrigues)
    const u = V0[root].map((x, a) => x - c[a]), u1 = u.map((x, a) => x + dr[a]), nn = Math.hypot(...u) * Math.hypot(...u1);
    const ax = [u[1] * u1[2] - u[2] * u1[1], u[2] * u1[0] - u[0] * u1[2], u[0] * u1[1] - u[1] * u1[0]], s = Math.hypot(...ax) / nn;
    const co = (u[0] * u1[0] + u[1] * u1[1] + u[2] * u1[2]) / nn, k = s > 1e-9 ? ax.map((x) => x / (s * nn)) : [1, 0, 0];
    const turn = (v) => { const kv = k[0] * v[0] + k[1] * v[1] + k[2] * v[2], x = [k[1] * v[2] - k[2] * v[1], k[2] * v[0] - k[0] * v[2], k[0] * v[1] - k[1] * v[0]]; return v.map((q, a) => q * co + x[a] * s + k[a] * kv * (1 - co)); };
    const to = turn(u), rest = u.map((x, a) => x + dr[a] - to[a]);
    for (const i of blade) { const p = turn(V0[i].map((x, a) => x - c[a])); for (let a = 0; a < 3; a++) d[i * 3 + a] = c[a] + p[a] + rest[a] - V0[i][a]; }
  }
}

/**
 * The face rig of a realistic hero's row: `m` the manifest (`hero`, `recipe` with its `headFit`), `mesh` its compiled
 * figure at rest. → null | { skipped } | { targets, sub, rows, authored, K, meta } as westernFaceRig's.
 */
export function relationalFaceRig(m, mesh) {
  const hero = m?.hero, fit = m?.recipe?.headFit;
  // (the ONE SKIN, hero-one-skin.js: its own points moved per action, never re-netted, so its faces stay)
  const skin = m?.recipe?.parts?.headSkin?.mesh ?? null, HEAD = skin ? SKIN_PART : PIECES;
  if (!hero || hero.head !== 'relational' || !fit || !(m.recipe.parts?.visage || skin)) return null;
  const P = m.recipe.parts;
  // the head's parts and everything pinned to them, in the recipe's order (the figure's vertex order)
  const X = Object.keys(P).filter((n) => HEAD.test(n) || (P[n]?.layer === 2 && HEAD.test(P[n].pin?.parent ?? '')));
  const words = { sex: fit.sex, ...(fit.relations ? { relations: fit.relations } : {}), ...(fit.eyes ? { eyes: fit.eyes } : {}), ...(fit.tune ? { tune: fit.tune } : {}) };
  const key = JSON.stringify([words, fit.k, fit.ty, fit.men, X, X.map((n) => layoutOf(P[n]))]);
  let T = RIGS.get(key);
  if (T === undefined) {
    // (a head's shapes solved before on this machine, keyed on the face the figure carries)
    const stored = faceStoreKey(key, X.map((n) => P[n]));
    T = readFaceStore(stored);
    if (!T) {
      const V = {}, layout = X.map((n) => layoutOf(P[n]));
      for (const [name, actions] of Object.entries(BUILDS)) {
        const fitOnly = { k: fit.k, ty: fit.ty, men: fit.men };
        const r = skin ? { parts: { headSkin: name === 'rest' ? P.headSkin : { ...P.headSkin, mesh: { ...skin, points: oneSkinFollow({ ...words, fit: fitOnly, actions, points: skin.points, normals: skin.normals, faces: skin.faces }) } } } }
          : relationalHeadRecipe(m.recipe, { ...words, actions, fit: fitOnly, faceOnly: true });
        const parts = Object.fromEntries(X.map((n) => [n, HEAD.test(n) ? r.parts[n] : P[n]]));
        if (X.some((n, i) => !parts[n] || layoutOf(parts[n]) !== layout[i])) { T = { moved: true }; break; }
        const C = compileLayered({ ...m.recipe, parts, dials: {}, creases: {} }, {}, {});
        V[name] = C.vertices;
        if (name === 'rest') { V.part = C.provenance.map((p) => p.part); V.faces = C.faces; V.globe = new Uint8Array(C.vertices.length); C.faces.forEach((t, fi) => { if (GLOBE.test(C.groups[fi])) for (const v of t) V.globe[v] = 1; }); }
      }
      if (!T) {
        // (the one skin's socket behind each globe carries nothing: it is still while the lids over it move)
        const balls = skin ? ['globeR', 'globeL'].filter((g) => P[g]?.mesh).map((g) => { const pts = Object.values(P[g].mesh.points), c = [0, 1, 2].map((a) => pts.reduce((t, q) => t + q[a], 0) / pts.length); return { c, r: Math.max(...pts.map((q) => Math.hypot(q[0] - c[0], q[1] - c[1], q[2] - c[2]))) }; }) : [];
        const V0 = V.rest, n = V0.length, D = {}, face = V.part.map((p) => HEAD.test(p)), carrier = face.map((f, i) => f && !balls.some((b) => Math.hypot(V0[i][0] - b.c[0], V0[i][1] - b.c[1], V0[i][2] - b.c[2]) < b.r)), near = carriedBy(V0, carrier), lash = [];
        V.part.forEach((p, i) => { if (LASHES.test(p)) lash.push(i); });
        // (a lash's root rides the face's own points, the lid's margin among them: the margin lies within the globe's
        // radius of its centre, where the socket's still points are no carriers)
        const lashes = lash.length && balls.length ? lashBlades(V0, V.faces, lash, face, balls) : [];
        for (const name of Object.keys(BUILDS)) {
          if (name === 'rest') continue;
          const d = new Float64Array(n * 3); for (let i = 0; i < n; i++) if (face[i]) for (let c = 0; c < 3; c++) d[i * 3 + c] = V[name][i][c] - V0[i][c];
          if (name === 'blink') for (let i = 0; i < n; i++) if (V.globe[i]) d[i * 3 + 1] -= BLINK_SINK;
          // (what rides the face moves as the skin under it moves, not as the one face it is pinned to tilts)
          for (let i = 0; i < n; i++) if (!face[i]) { const N = near[i]; for (let c = 0; c < 3; c++) { let x = 0; for (let j = 0; j < N.length; j += 2) x += N[j + 1] * d[N[j] * 3 + c]; d[i * 3 + c] = x; } }
          // (the lashes turned with their lids, about the globes)
          if (lashes.length) turnLashes(lashes, V0, d);
          D[name] = d;
        }
        // (one eye: the blink weighed across the midline)
        for (const s of ['Left', 'Right']) { const d = new Float64Array(n * 3); for (let i = 0; i < n; i++) { const w = s === 'Right' ? wRight(V0[i][0]) : 1 - wRight(V0[i][0]); for (let c = 0; c < 3; c++) d[i * 3 + c] = D.blink[i * 3 + c] * w; } D[`blink${s}`] = d; }
        T = { V0, D };
        writeFaceStore(stored, T);
      }
    }
    keep(RIGS, key, T);
  }
  if (T.moved) return { skipped: MOVED };
  const want = new Set(X), idx = [];
  for (let i = 0; i < mesh.vertices.length; i++) if (want.has(mesh.provenance[i].part)) idx.push(i);
  if (idx.length !== T.V0.length) return { skipped: 'the figure\'s head is not the head its fit rebuilds: regenerate the row' };
  const authored = resolveWesternExpression(hero.expression ?? 'neutral'), K = relationalKnots(authored), W = (1 + K.targets.length) * 3;
  const sub = new Int32Array(mesh.vertices.length).fill(-1), rows = new Float64Array(idx.length * W);
  for (let k = 0; k < idx.length; k++) {
    const i = idx[k], o = k * W, a = mesh.vertices[i], b = T.V0[k]; let any = false;
    for (let c = 0; c < 3; c++) rows[o + c] = a[c] - b[c];
    // (a point no target moves `MOVES` m or more carries no row: the scalp's far hair, the face's still corners)
    K.targets.forEach((t, ti) => { const d = T.D[t]; for (let c = 0; c < 3; c++) { const x = d[k * 3 + c]; rows[o + 3 + ti * 3 + c] = x; if (Math.abs(x) >= MOVES) any = true; } });
    if (any) sub[i] = k;
  }
  const meta = { targets: [...K.targets], weights: K.weigh(westernState(authored)), fps: FACE_FPS, eyeKnots: [...K.eyeKnots], fixKnots: [],
    about: 'morph targets on the realistic head at rest, differences of the head rebuilt at its fit with one of its own actions at full (head-relational.js ACTIONS: the lids, the zygomaticus, the frontalis, the corrugator), what is pinned to the face riding it; the default weights are the authored expression; the jaw opens by the jaw bone, not a target' };
  return { targets: [...K.targets], sub, rows, authored, K, meta };
}
