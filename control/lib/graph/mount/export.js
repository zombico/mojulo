/**
 * export — the mount as an engine gets it: one skinned GLB (scene/scene-gltf.js facesToGlb, the hero's writer) with the
 * rig's bones as joints, the body's skin bound by its own weights, the corrective shapes as morph targets, and every
 * clip as joint keys and the shapes' weights. Assets and animations only: an engine imports the file as it is.
 *
 * THE PACK is the rig figure the writer reads (station-loft-rig.js packLayeredRig's shape): `bones` at the stand,
 * `parts` (a bone's triangles as a corner soup, each corner its coat colour, its four joints and weights, its field
 * normal; the writer welds the corners back into one mesh), `clips` (per key, every bone's rotation from the stand as
 * a quaternion and its head: v' = h + R(q)(v − restHead), which is linear blend skinning; `cw` the shapes' weights per
 * key; `s` its seconds, `once` a one-shot, `v` a cycle's ground speed), `correctives` (the targets, each a driver's key).
 *
 * THE HAIR (`hair`): the mane, the forelock and the tail as cards at their rest hang (hair.js, settled at the stand),
 * each card both its faces (no importer need honour a double-sided material), skinned to short chains of joints laid
 * along their strands (hair-bake.js). 'baked' (the default): every clip carries the chains' keys from the hair's own
 * simulation through it (its swing, as the sheets show it); 'rigid': the chains ride the bones they grow from (an
 * engine's spring bones or cloth may swing them); false: no hair.
 *
 * THE CLIPS are IN PLACE: a gait's cycle loops on the spot and carries its ground speed (`moj:speed` in the GLB: an
 * engine moves the body at that speed, or plays the cycle at its planar speed ÷ it); a one-shot (a transition, the
 * jump) keeps its own course in place as well, its travel in its extras. Sampled at `fps` (a cycle at a whole number of
 * keys over its stride, so its last key wraps onto its first).
 *
 *   MOUNT_CLIPS                      the clip names `mountClips` knows
 *   mountClips(B, { names })         → { name: { frames(k) → solved pose, k, s, once, v } }
 *   mountPack(B, { mesh, coat, set, clips, fps }) → the rig figure
 *   mountGlb(B, { … , lit }) → { bytes, … } (facesToGlb's result)
 */
import { MOUNT_BONES } from './pose.js';
import { gaitCycle, standPose } from './gait.js';
import { jumpClip } from './jump.js';
import { oneShot } from './motion.js';
import { idleLayer, idleClip, grazeClip, IDLE_LAYERS } from './idle.js';
import { boneFrames } from './skin.js';
import { coatColor } from './coats.js';
import { correctiveWeights } from './correctives.js';
import { quatOfRows } from '../fauna/rig.js';
import { b64u8 } from '../figures/rig-bake.js';
import { facesToGlb } from '../scene/scene-gltf.js';
import { hairCards } from './hair.js';
import { hairRig, bakeHairClip, hairJointKeys } from './hair-bake.js';
import { tackPieces, tackSkin } from './tack.js';

const r5 = (x) => Math.round(x * 1e5) / 1e5;
const b64f32 = (a) => Buffer.from(Float32Array.from(a).buffer).toString('base64');
const b64u32 = (a) => Buffer.from(Uint32Array.from(a).buffer).toString('base64');
const b64bytes = (a) => Buffer.from(Uint8Array.from(a).buffer).toString('base64');
const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hexLinear = (h) => [1, 3, 5].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));

/** the clips a mount carries: its gaits' cycles, the transitions between them and the halt, the jump, the rest */
export const MOUNT_CLIPS = Object.freeze([
  'walk', 'trot', 'canter', 'gallop', 'reinBack',
  'stand-walk', 'walk-trot', 'trot-canter', 'canter-gallop', 'gallop-canter', 'canter-trot', 'trot-walk', 'walk-stand',
  'jump', 'idle', ...Object.keys(IDLE_LAYERS).map((n) => `idle-${n}`), 'graze',
]);

/** each clip as a sampler of solved poses: `at(t)` the pose at t seconds, `s` its seconds, `once` a one-shot, `v` its
 * speed; a one-shot's `before(t)` (t < 0) the pose it is entered from (its entry gait running in: the hair's warm-up) */
export function mountClips(B, { names = MOUNT_CLIPS, seed = 3 } = {}) {
  const out = {};
  for (const name of names) {
    const tr = /^([a-zA-Z]+)-([a-zA-Z]+)$/.exec(name);
    if (['walk', 'trot', 'canter', 'gallop', 'reinBack'].includes(name)) {
      const c = gaitCycle(B, name), T = 1 / c.f;
      out[name] = { at: (t) => c.poseAt(t / T), s: T, once: false, v: Math.abs(c.speed) };
    } else if (name === 'jump') {
      const j = jumpClip(B), A = j.A, T = 1 / A.f;
      out[name] = { at: (t) => j.poseAt(t), before: (t) => A.poseAt(((j.entry.phase + t / T) % 1 + 1) % 1), s: j.duration, once: true, flight: j.flight };
    } else if (name === 'idle') {
      const c = idleClip(B, { seed });
      out[name] = { at: (t) => c.poseAt(t), s: c.duration, once: true };
    } else if (name === 'graze') {
      const c = grazeClip(B, { seed });
      out[name] = { at: (t) => c.poseAt(t), s: c.duration, once: true };
    } else if (/^idle-/.test(name)) {
      const c = idleLayer(B, name.slice(5), { seed });
      out[name] = { at: (t) => c.poseAt(t), s: c.duration, once: false };
    } else if (tr && !/^idle$/.test(tr[1])) {
      const c = oneShot(B, { from: tr[1], to: tr[2] }), A = c.A;
      // (before it starts: its entry gait running into its entry phase, or the stand it starts from)
      const before = A?.poseAt && A.f ? (t) => A.poseAt(((c.entry.phase + t * A.f) % 1 + 1) % 1) : () => c.poseAt(0);
      out[name] = { at: (t) => c.poseAt(t), before, s: c.duration, once: true };
    } else throw new Error(`mount: no clip '${name}' (it knows: ${MOUNT_CLIPS.join(', ')})`);
  }
  return out;
}

/** a bone's rotation from the stand into a pose, row-major (a rest vector v goes to Σ_k (R_k·v) P_k) */
const turnOf = (r, p) => [0, 1, 2].map((a) => [0, 1, 2].map((b) => p.R[0][a] * r.R[0][b] + p.R[1][a] * r.R[1][b] + p.R[2][a] * r.R[2][b]));

/**
 * The rig figure. `mesh` a bodyMesh (its vertices, quads, normals, weights, parts); `set` a corrective set
 * (correctives.js fitCorrectives / correctiveKeys), or null for none (then no targets and no weights: plain LBS);
 * `clips` mountClips' samplers; `fps` the keys a second.
 */
export function mountPack(B, { mesh, coat = 'bay', markings = {}, set = null, clips = {}, fps = 30, hair = 'baked', tack = false } = {}) {
  if (hair === true) hair = 'baked';
  const stand = standPose(B), rest = boneFrames(B, stand), body = MOUNT_BONES.map((b) => b.id);
  const rig = hair ? hairRig(B) : null, ids = [...body, ...(rig ? rig.joints.map((J) => J.id) : [])], index = new Map(ids.map((id, i) => [id, i]));
  const bones = [...MOUNT_BONES.map((b) => ({ id: b.id, head: stand.bones[b.id].head.map(r5), tail: stand.bones[b.id].tail.map(r5) })),
    ...(rig ? rig.joints.map((J) => ({ id: J.id, head: J.head.map(r5), tail: J.tail.map(r5) })) : [])];
  // the targets: every driver's keys, in order
  const targets = set ? set.drivers.flatMap((d) => d.keys.map((kk, ki) => ({ id: `${d.id}@${Math.round(kk.angle * 180 / Math.PI)}`, driver: { id: d.id, parent: d.parent, child: d.child, angle: r5(kk.angle), key: ki }, w: 0 }))) : [];
  const rowOf = new Map();                                         // vertex → its rows (3 × targets), where any target moves it
  if (set) { let t = 0; for (const d of set.drivers) for (const kk of d.keys) { for (const [i, dv] of kk.deltas) { let r = rowOf.get(i); if (!r) rowOf.set(i, r = new Float32Array(3 * targets.length)); r[3 * t] = dv[0]; r[3 * t + 1] = dv[1]; r[3 * t + 2] = dv[2]; } t++; } }
  // the parts: each quad's two triangles to the bone its corners weigh most
  const P = ids.map(() => ({ pos: [], col: [], jnt: [], wgt: [], nrm: [], ci: [], cd: [], faces: 0 }));   // (a part per joint, the hair's too)
  const colours = mesh.quads.map((q) => { const c = q.map((i) => mesh.vertices[i]).reduce((a, b) => a.map((x, i) => x + b[i] / 4), [0, 0, 0]); return hexLinear(coatColor(coat, mesh.parts[q[0]], c, { stand: mesh.stand, markings })); });
  mesh.quads.forEach((q, qi) => {
    const votes = new Map();
    for (const v of q) for (const [b, w] of mesh.weights[v]) votes.set(b, (votes.get(b) || 0) + w);
    const owner = [...votes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0][0], part = P[index.get(owner)];
    for (const tri of [[q[0], q[1], q[2]], [q[0], q[2], q[3]]]) {
      const a = mesh.vertices[tri[0]], b = mesh.vertices[tri[1]], c = mesh.vertices[tri[2]];
      if (Math.hypot(...[0, 1, 2].map((k) => (b[(k + 1) % 3] - a[(k + 1) % 3]) * (c[(k + 2) % 3] - a[(k + 2) % 3]) - (b[(k + 2) % 3] - a[(k + 2) % 3]) * (c[(k + 1) % 3] - a[(k + 1) % 3]))) < 1e-14) continue;   // (two corners met)
      part.faces++;
      for (const v of tri) {
        const corner = part.pos.length / 3;
        part.pos.push(...mesh.vertices[v]); part.col.push(...colours[qi]); part.nrm.push(...mesh.normals[v]);
        const w = [...mesh.weights[v], ...Array(4).fill(['spine1', 0])].slice(0, 4);
        part.jnt.push(...w.map(([bn]) => index.get(bn))); part.wgt.push(...w.map(([, x]) => x));
        const row = rowOf.get(v);
        if (row) { part.ci.push(corner); part.cd.push(...row); }
      }
    }
  });
  // the hair: its cards at the stand's hang, both faces, on the chains along their strands
  if (rig) {
    const hc = hairCards(rig.guides, rig.rest, { coat }), nb = body.length;
    const skinOf = (at) => rig.skin(at).map(([j, w]) => [nb + j, w]);
    hc.quads.forEach((q, qi) => {
      const col = hexLinear(hc.colors[qi]), V = q.map((i) => hc.vertices[i]);
      const n0 = (() => { const a = V[0], b = V[1], c = V[2], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]], n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n) || 1; return n.map((x) => x / l); })();
      const part = P[skinOf(hc.at[q[0]]).sort((x, y) => y[1] - x[1])[0][0]];
      for (const [order, nrm] of [[[0, 1, 2, 0, 2, 3], n0], [[0, 2, 1, 0, 3, 2], n0.map((x) => -x)]]) {
        part.faces += 2;
        for (const k of order) {
          const vi = q[k], w = [...skinOf(hc.at[vi]), ...Array(4).fill([0, 0])].slice(0, 4);
          part.pos.push(...hc.vertices[vi]); part.col.push(...col); part.nrm.push(...nrm);
          part.jnt.push(...w.map(([j]) => j)); part.wgt.push(...w.map(([, x]) => x));
        }
      }
    });
  }
  // the tack (tack.js; `tack`: true or its options): each piece's quads on the joints it rides, its quads' own normals
  if (tack) {
    const pieces = tackPieces(B, tack === true ? {} : tack), skins = tackSkin(pieces, mesh);
    pieces.forEach((pc, k) => pc.quads.forEach((q, qi) => {
      const col = hexLinear(pc.colors[qi]), V = q.map((i) => pc.vertices[i]);
      const n = (() => { const u = [V[2][0] - V[0][0], V[2][1] - V[0][1], V[2][2] - V[0][2]], v = [V[3][0] - V[1][0], V[3][1] - V[1][1], V[3][2] - V[1][2]], c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...c); return l > 1e-12 ? c.map((x) => x / l) : null; })();
      if (!n) return;                                                   // (a degenerate quad)
      const votes = new Map(); for (const i of q) for (const [b, w] of skins[k][i]) votes.set(b, (votes.get(b) || 0) + w);
      const part = P[index.get([...votes.entries()].sort((a2, b2) => b2[1] - a2[1] || (a2[0] < b2[0] ? -1 : 1))[0][0])];
      part.faces += 2;
      for (const c of [0, 1, 2, 0, 2, 3]) {
        const i = q[c], w = [...skins[k][i], ...Array(4).fill(['spine1', 0])].slice(0, 4);
        part.pos.push(...pc.vertices[i]); part.col.push(...col); part.nrm.push(...n);
        part.jnt.push(...w.map(([bn]) => index.get(bn))); part.wgt.push(...w.map(([, x]) => x));
        // (a piece on the skin takes its body vertex's corrective rows: it moves as the skin under it moves)
        const row = skins[k].near[i] >= 0 ? rowOf.get(skins[k].near[i]) : null;
        if (row) { part.ci.push(part.pos.length / 3 - 1); part.cd.push(...row); }
      }
    }));
  }
  const parts = P.map((p) => (p.faces ? {
    pos: b64f32(p.pos), col: b64u8(p.col), faces: p.faces, jnt: b64bytes(p.jnt), wgt: b64f32(p.wgt), nrm: b64f32(p.nrm),
    ...(p.ci.length ? { corrective: { i: b64u32(p.ci), d: b64f32(p.cd) } } : {}),
  } : null));
  // the clips: per key every bone's turn from the stand and its head; the shapes' weights
  const packed = {};
  for (const [name, c] of Object.entries(clips)) {
    const K = c.once ? Math.max(2, Math.round(c.s * fps) + 1) : Math.max(2, Math.round(c.s * fps));
    const b = [], cw = set ? [] : null, strands = rig && hair === 'baked' ? bakeHairClip(B, rig, c, K) : null;
    for (let k = 0; k < K; k++) {
      const t = c.once ? c.s * k / (K - 1) : c.s * k / K, f = boneFrames(B, c.at(t));
      for (const id of body) { const p = f[id]; b.push(...quatOfRows(turnOf(rest[id], p)).map(r5), ...p.h.map(r5)); }
      // the hair's chains: their keys from the simulation (baked), or carried by the bones they grow from (rigid)
      if (rig) {
        const keys = strands ? hairJointKeys(rig, strands[k], f, rest) : rig.joints.map((J) => { const R = turnOf(rest[J.bone], f[J.bone]), d = J.head.map((x, i) => x - rest[J.bone].h[i]); return { R, h: [0, 1, 2].map((a2) => f[J.bone].h[a2] + R[a2][0] * d[0] + R[a2][1] * d[1] + R[a2][2] * d[2]) }; });
        for (const kj of keys) b.push(...quatOfRows(kj.R).map(r5), ...kj.h.map(r5));
      }
      if (cw) { const w = new Map(correctiveWeights(set, rest, f).map((x) => [`${x.driver}:${x.key}`, x.w])); for (const tg of targets) cw.push(r5(w.get(`${tg.driver.id}:${tg.driver.key}`) ?? 0)); }
    }
    packed[name] = { k: K, b, ...(cw ? { cw } : {}), s: r5(c.s), ...(c.once ? { once: true } : {}), ...(c.v > 0 ? { v: r5(c.v) } : {}) };
  }
  return {
    rig: true, weld: true, bones, parts, clips: packed, figH: r5(Math.max(...mesh.vertices.map((v) => v[2])) - Math.min(...mesh.vertices.map((v) => v[2]))),
    ...(targets.length ? { correctives: {
      targets, joints: {},
      about: 'the mount\'s corrective shapes (lib/graph/mount/correctives.js): morph targets on the rest, each its offsets at full weight in bind space; a target is one driver\'s key, a driver the bend of `child` in `parent`\'s frame about its side axis (radians from the stand), its keys weighted piecewise linearly in that angle (zero at the stand, one at the key, clamped at the last); every clip carries the weights its poses drive',
    } } : {}),
  };
}

/** the mount as a GLB: the pack through the hero's writer (`lit`: the engine lights it, the field's normals carried) */
export function mountGlb(B, { name = 'mount', lit = false, ...opts } = {}) {
  const pack = mountPack(B, opts);
  const out = facesToGlb({ figures: { [name]: pack } }, { generator: 'mojulo mount', clips: '_all', skinned: true, lit });
  return { ...out, pack };
}
