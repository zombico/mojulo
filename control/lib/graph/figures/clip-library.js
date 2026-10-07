/**
 * clip-library — humanoid clips from an outside ANIMATION LIBRARY (a glTF one: Quaternius's Universal Animation
 * Library, a Godot or Blender export, a VRMA-shaped file) played on mojulo's own humanoid rigs. The interop proof of
 * docs/emote-bridge.md's pass-through lane: a library's walk plays on a hero as it plays on the library's mannequin,
 * and mojulo's own clips fill only the gaps between.
 *
 * Two steps, so the library is read once and the hero any number of times:
 *
 *   hubClips(gltf, bin, { map, clips?, fps?, bones?, at? })  → { rest: { hipsHeight }, clips: { <name>: HUB } }
 *       reads the library: every named clip sampled at `fps`, each humanoid bone's WORLD TURN away from the library's
 *       own bind T-pose, carried into the native frame (z up, facing +y, the figure's left on −x), and the hips'
 *       offset as a share of the library's hip height (only the bob and the sway: the run across the ground is the
 *       runtime's). `map` names each library joint's VRM bone (LIBRARY_MAPS); `at: true` also keeps each joint's place
 *       per frame in the native frame (`hub.at`, for checking a retarget against the library's own mannequin).
 *   retargetClip(pack, hub, { keys?, once? })           → a packed clip ({ k, b, s, once? }) for that rig
 *       each bone: its rotation is the hub's turn for its VRM bone (or its nearest ancestor's) composed on the mold's
 *       rest → T offset (rig-tpose.js tposeFrames), q = D · qT; its head by FK down the rig's own tree from the hips,
 *       which bob by the hub's offset scaled to this rig's hip height. The pack keys play on the World page as every
 *       rig clip does (q from rest, posed heads).
 *
 * World turns rather than parent-local ones: a rig with fewer spine bones than the library (the hero's one torso
 * against spine, chest and upper chest) takes each bone's own turn and loses nothing above it. The rests must both be
 * T-poses (the library's bind pose is; the mold puts the rig in one). HUB, the stored form, is { seconds, fps, loop,
 * bones: { <vrm>: [x,y,z,w, …] per frame }, hips: [x,y,z, …] per frame }. Pure arithmetic; deterministic.
 */
import { tposeFrames } from './rig-tpose.js';

const r4 = (x) => Math.round(x * 1e4) / 1e4 + 0;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const QI = [0, 0, 0, 1];
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const qnorm = (q) => { const l = Math.hypot(...q) || 1; return q.map((c) => c / l); };
function qrot(q, v) {
  const u = [q[0], q[1], q[2]], c = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const t = c(u, v).map((x) => 2 * x);
  return add(add(v, t.map((x) => x * q[3])), c(u, t));
}
function slerp(a, b, t) {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb = d < 0 ? b.map((c) => -c) : b; d = Math.abs(d);
  if (d > 0.9995) return qnorm(a.map((c, i) => c + (bb[i] - c) * t));
  const th = Math.acos(d), s = Math.sin(th), wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
  return a.map((c, i) => c * wa + bb[i] * wb);
}
// a rotation matrix (rows) to a quaternion
function matQuat(m) {
  const [[a, b, c], [d, e, f], [g, h, i]] = m, tr = a + e + i;
  let q;
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(h - f) / s, (c - g) / s, (d - b) / s, s / 4]; }
  else if (a > e && a > i) { const s = Math.sqrt(1 + a - e - i) * 2; q = [s / 4, (b + d) / s, (c + g) / s, (h - f) / s]; }
  else if (e > i) { const s = Math.sqrt(1 + e - a - i) * 2; q = [(b + d) / s, s / 4, (f + h) / s, (c - g) / s]; }
  else { const s = Math.sqrt(1 + i - a - e) * 2; q = [(c + g) / s, (f + h) / s, s / 4, (d - b) / s]; }
  return qnorm(q);
}

// the library's frame (glTF: y up, facing +z, the figure's left on +x) into the native one (z up, facing +y, left on
// −x): (x, y, z) → (−x, z, y), a proper rotation, so a turn's axis maps and its angle stays
const toNative = (v) => [-v[0], v[2], v[1]];
const turnToNative = (q) => [...toNative(q), q[3]];

/** Library joint → VRM bone, per library. A Godot BoneMap's profile names are the VRM names with a capital. */
export const LIBRARY_MAPS = Object.freeze({
  'quaternius-ual': Object.freeze({
    'DEF-hips': 'hips', 'DEF-spine.001': 'spine', 'DEF-spine.002': 'chest', 'DEF-spine.003': 'upperChest', 'DEF-neck': 'neck', 'DEF-head': 'head',
    ...Object.fromEntries(['L', 'R'].flatMap((s) => {
      const S = s === 'L' ? 'left' : 'right';
      return [['shoulder', 'Shoulder'], ['upper_arm', 'UpperArm'], ['forearm', 'LowerArm'], ['hand', 'Hand'], ['thigh', 'UpperLeg'], ['shin', 'LowerLeg'], ['foot', 'Foot'], ['toe', 'Toes']]
        .map(([b, v]) => [`DEF-${b}.${s}`, `${S}${v}`]);
    })),
  }),
});

/** The humanoid bones a hub carries (the fingers ride their hands). */
export const HUB_BONES = Object.freeze(['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
  ...['left', 'right'].flatMap((s) => ['Shoulder', 'UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot', 'Toes'].map((b) => s + b))]);

// a glTF accessor as floats (the library's own buffer)
function accessor(g, bin, i) {
  const a = g.accessors[i], v = g.bufferViews[a.bufferView], n = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }[a.type];
  if (a.componentType !== 5126) throw new Error(`clip-library: accessor ${i} is not float (componentType ${a.componentType})`);
  const off = (v.byteOffset || 0) + (a.byteOffset || 0), stride = v.byteStride || 4 * n, out = new Float32Array(a.count * n);
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  for (let k = 0; k < a.count; k++) for (let c = 0; c < n; c++) out[k * n + c] = dv.getFloat32(off + k * stride + 4 * c, true);
  return { data: out, n, count: a.count };
}

// one channel sampled at t (LINEAR / STEP; a CUBICSPLINE's value is its middle element)
function sampleChannel(ch, t) {
  const { times, vals, n, interp, path } = ch, last = times.length - 1, cubic = interp === 'CUBICSPLINE', at = (k) => (cubic ? vals.slice((3 * k + 1) * n, (3 * k + 2) * n) : vals.slice(k * n, (k + 1) * n));
  if (t <= times[0]) return Array.from(at(0));
  if (t >= times[last]) return Array.from(at(last));
  let k = 0;
  while (k < last - 1 && times[k + 1] <= t) k++;
  const u = (t - times[k]) / (times[k + 1] - times[k] || 1), a = Array.from(at(k)), b = Array.from(at(k + 1));
  if (interp === 'STEP') return a;
  return path === 'rotation' ? slerp(a, b, u) : a.map((x, i) => x + (b[i] - x) * u);
}

/** Read a glTF animation library into hub clips (see the header). */
export function hubClips(gltf, bin, { map, clips, fps = 24, bones = HUB_BONES, at: keepAt = false } = {}) {
  if (!map) throw new Error('clip-library: give the library\'s joint → VRM map (LIBRARY_MAPS)');
  const nodes = gltf.nodes, skin = gltf.skins && gltf.skins[0];
  if (!skin) throw new Error('clip-library: the library has no skin (no skeleton to read clips against)');
  const parent = new Array(nodes.length).fill(-1);
  nodes.forEach((n, i) => (n.children || []).forEach((c) => { parent[c] = i; }));
  const vrmNode = {};
  nodes.forEach((n, i) => { const v = map[n.name]; if (v && bones.includes(v)) vrmNode[v] = i; });
  const absent = ['hips', 'leftUpperArm', 'rightUpperArm', 'leftUpperLeg', 'rightUpperLeg'].filter((v) => vrmNode[v] === undefined);
  if (absent.length) throw new Error(`clip-library: the map names no library joint for ${absent.join(', ')}`);
  // the bind T-pose: each joint's world turn and place, from its inverse bind matrix (rigid: the inverse is the transpose)
  const ibm = accessor(gltf, bin, skin.inverseBindMatrices).data, bind = {};
  skin.joints.forEach((ni, j) => {
    const m = ibm.slice(16 * j, 16 * j + 16), R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]], t = [m[12], m[13], m[14]];
    const RT = [[R[0][0], R[1][0], R[2][0]], [R[0][1], R[1][1], R[2][1]], [R[0][2], R[1][2], R[2][2]]];
    bind[ni] = { q: matQuat(RT), p: RT.map((row) => -(row[0] * t[0] + row[1] * t[1] + row[2] * t[2])) };
  });
  const hipsBind = bind[vrmNode.hips];
  if (!hipsBind) throw new Error('clip-library: the hips are not a skin joint');
  const hipsHeight = hipsBind.p[1];
  const out = {};
  const wanted = clips || gltf.animations.map((a) => a.name);
  for (const name of wanted) {
    const an = gltf.animations.find((a) => a.name === name);
    if (!an) throw new Error(`clip-library: the library has no clip '${name}'`);
    const chans = {};
    let seconds = 0;
    for (const c of an.channels) {
      const s = an.samplers[c.sampler], ti = accessor(gltf, bin, s.input), vo = accessor(gltf, bin, s.output);
      seconds = Math.max(seconds, ti.data[ti.count - 1]);
      (chans[c.target.node] ||= {})[c.target.path] = { times: ti.data, vals: vo.data, n: vo.n, interp: s.interpolation || 'LINEAR', path: c.target.path };
    }
    const frames = Math.max(1, Math.round(seconds * fps)), hub = { seconds: r4(seconds), fps, bones: {}, hips: [] };
    for (const v of Object.keys(vrmNode)) hub.bones[v] = [];
    if (keepAt) hub.at = Object.fromEntries(Object.keys(vrmNode).map((v) => [v, []]));
    for (let f = 0; f < frames; f++) {
      const t = (f / frames) * seconds, world = new Map();
      const at = (i) => {
        if (world.has(i)) return world.get(i);
        const n = nodes[i], ch = chans[i] || {};
        const r = ch.rotation ? sampleChannel(ch.rotation, t) : n.rotation || QI;
        const tr = ch.translation ? sampleChannel(ch.translation, t) : n.translation || [0, 0, 0];
        const sc = ch.scale ? sampleChannel(ch.scale, t)[0] : n.scale ? n.scale[0] : 1;
        const P = parent[i] >= 0 ? at(parent[i]) : { q: QI, p: [0, 0, 0], s: 1 };
        const w = { q: qnorm(qmul(P.q, r)), p: add(P.p, qrot(P.q, tr.map((x) => x * P.s))), s: P.s * sc };
        world.set(i, w);
        return w;
      };
      for (const [v, ni] of Object.entries(vrmNode)) {
        const D = turnToNative(qnorm(qmul(at(ni).q, qconj(bind[ni].q))));
        hub.bones[v].push(...D.map(r4));
        if (keepAt) hub.at[v].push(...toNative(at(ni).p));
      }
      // the hips' offset from the bind, a share of the hip height: the bob and the sway, never the run
      const d = toNative(sub(at(vrmNode.hips).p, hipsBind.p)).map((x) => x / hipsHeight);
      hub.hips.push(r4(d[0]), 0, r4(d[2]));
    }
    out[name] = hub;
  }
  return { rest: { hipsHeight: r4(hipsHeight) }, clips: out };
}

/** Retarget one hub clip onto a humanoid pack (the hero's, the figure's): a packed clip it plays. */
export function retargetClip(pack, hub, { keys, once = false } = {}) {
  const T = tposeFrames(pack.bones), frames = hub.hips.length / 3, K = keys || frames;
  const rest = pack.bones.map((b) => b.head), hipsIdx = T.findIndex((f) => f.vrm === 'hips');
  // the rig's hip height above its lowest rest point, so the hub's bob scales to this body
  const floor = Math.min(...pack.bones.flatMap((b) => [b.head[2], b.tail[2]]));
  const hipH = rest[hipsIdx][2] - floor;
  // the hub track each bone reads: its own VRM bone's, else its nearest ancestor's that the hub carries
  const track = T.map((f, i) => { for (let j = i; j >= 0; j = T[j].parent) if (T[j].vrm && hub.bones[T[j].vrm]) return T[j].vrm; return null; });
  const order = []; const seen = new Set();
  const visit = (i) => { if (seen.has(i)) return; if (T[i].parent >= 0) visit(T[i].parent); seen.add(i); order.push(i); };
  T.forEach((_, i) => visit(i));
  const turnAt = (v, u) => {
    const x = u * frames, f0 = Math.floor(x) % frames, f1 = once ? Math.min(frames - 1, f0 + 1) : (f0 + 1) % frames, w = x - Math.floor(x), tr = hub.bones[v];
    return slerp(tr.slice(4 * f0, 4 * f0 + 4), tr.slice(4 * f1, 4 * f1 + 4), once && f0 === frames - 1 ? 0 : w);
  };
  const hipsAt = (u) => {
    const x = u * frames, f0 = Math.floor(x) % frames, f1 = once ? Math.min(frames - 1, f0 + 1) : (f0 + 1) % frames, w = x - Math.floor(x), h = hub.hips;
    return [0, 1, 2].map((c) => h[3 * f0 + c] + (h[3 * f1 + c] - h[3 * f0 + c]) * w);
  };
  const flat = [];
  for (let k = 0; k < K; k++) {
    const u = once ? k / Math.max(1, K - 1) * ((frames - 1) / frames) : k / K;
    const q = new Array(T.length), head = new Array(T.length);
    for (const i of order) {
      q[i] = qnorm(qmul(track[i] ? turnAt(track[i], u) : QI, T[i].q));
      const p = T[i].parent;
      head[i] = p >= 0 ? add(head[p], qrot(q[p], sub(rest[i], rest[p]))) : add(rest[i], hipsAt(u).map((x) => x * hipH));
    }
    for (let i = 0; i < T.length; i++) flat.push(...q[i].map(r4), ...head[i].map(r4));
  }
  return { k: K, b: flat, s: hub.seconds, ...(once ? { once: true } : {}) };
}

/** Every named clip of a hub library retargeted onto a pack, under `prefix` + its library name. */
export function libraryClips(pack, lib, names = Object.keys(lib.clips), { prefix = '', once = [] } = {}) {
  const out = {};
  for (const n of names) {
    if (!lib.clips[n]) throw new Error(`clip-library: the library has no clip '${n}' (it has ${Object.keys(lib.clips).join(', ')})`);
    out[prefix + n] = retargetClip(pack, lib.clips[n], { once: once.includes(n) });
  }
  return out;
}
