/**
 * rig-tpose — the T-POSE MOLD: re-rest a humanoid PACKED rig in the VRM T-pose the engines retarget from
 * (docs/emote-bridge.md §3.6). An export-time step over the pack shape the figure (rig-bake bakeRigFigure) and the
 * hero (station-loft-rig packLayeredRig) share — `{ rig, bones: [{ id, head, tail }], parts, clips, figH }` — so one
 * mold serves every humanoid kind, and no recipe changes.
 *
 * Roles by VRM name (figure-humanoid-map humanoidBonesFor):
 *   aim sideways — upper arm, lower arm, hand: straight along the figure's lateral axis (left = the side the left
 *                  upper arm roots on), the shortest arc from the hanging arm turning the palm down; the lower arm's
 *                  aim takes out the elbow flex and the carrying angle the posing API cannot (the elbow only folds).
 *   aim down     — upper and lower leg: straight down (−z; the native frame is z-up).
 *   keep world   — hips, spine, chest, neck, head, foot, toes: the rest orientation, moved only by FK (the feet stay
 *                  flat, the head where its face rig expects it).
 *   ride         — fingers, thumb, jaw, eyes, unnamed bones (a bust): rigid with the parent.
 * Parents: the nearest present ancestor on the VRM humanoid tree; an unnamed bone takes the bone whose segment is
 * nearest its head. Heads by FK: hT = hT(parent) + qT(parent)·(head − head(parent)).
 *
 * The pack after the mold: rest bones at T; parts moved to T (a skinned part, the hero's, by its own `jnt`/`wgt`; a
 * rigid part by its bone — so a rigid-part body tears at the shoulder, and the flat figure does not come here: its
 * flesh is procedural, so figure-world REBUILDS it on a T armature instead, figure-tpose.js); every clip key re-expressed on the new rest, q' = q·qT⁻¹ with the posed heads unchanged, so a clip
 * plays the same motion (exact for a rigid vertex; a blended vertex re-binds as any T-pose rebind does); the whole
 * rest lifted so its lowest vertex stays on the floor it stood on; and `tpose: { offsets: { <bone id>: qT } }`, the
 * per-bone A↔T delta an importer needs. Deterministic: plain arithmetic, no dice.
 */
import { humanoidBonesFor } from '../polygonizer/figure-humanoid-map.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const r4 = (x) => Math.round(x * 1e4) / 1e4;

// quaternions [x, y, z, w]
const QI = [0, 0, 0, 1];
const qmul = (a, b) => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];
const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
function qrot(q, v) {
  const u = [q[0], q[1], q[2]], t = cross(u, v).map((c) => 2 * c);
  return add(add(v, t.map((c) => c * q[3])), cross(u, t));
}
// shortest arc carrying unit a onto unit b
function qarc(a, b) {
  const d = dot(a, b);
  if (d > 1 - 1e-12) return QI;
  if (d < -1 + 1e-12) { const ax = unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); return [ax[0], ax[1], ax[2], 0]; }
  const c = cross(a, b), w = 1 + d, l = Math.hypot(c[0], c[1], c[2], w);
  return [c[0] / l, c[1] / l, c[2] / l, w / l];
}

// the VRM 1.0 humanoid tree (child → parent)
const VRM_PARENT = { spine: 'hips', chest: 'spine', upperChest: 'chest', neck: 'upperChest', head: 'neck', jaw: 'head', leftEye: 'head', rightEye: 'head' };
for (const s of ['left', 'right']) {
  Object.assign(VRM_PARENT, {
    [`${s}Shoulder`]: 'upperChest', [`${s}UpperArm`]: `${s}Shoulder`, [`${s}LowerArm`]: `${s}UpperArm`, [`${s}Hand`]: `${s}LowerArm`,
    [`${s}UpperLeg`]: 'hips', [`${s}LowerLeg`]: `${s}UpperLeg`, [`${s}Foot`]: `${s}LowerLeg`, [`${s}Toes`]: `${s}Foot`,
    [`${s}ThumbMetacarpal`]: `${s}Hand`, [`${s}ThumbProximal`]: `${s}ThumbMetacarpal`, [`${s}ThumbDistal`]: `${s}ThumbProximal`,
  });
  for (const d of ['Index', 'Middle', 'Ring', 'Little']) Object.assign(VRM_PARENT, { [`${s}${d}Proximal`]: `${s}Hand`, [`${s}${d}Intermediate`]: `${s}${d}Proximal`, [`${s}${d}Distal`]: `${s}${d}Intermediate` });
}
const ARM = /^(left|right)(UpperArm|LowerArm|Hand)$/, LEG = /^(left|right)(UpperLeg|LowerLeg)$/;
const WORLD = /^(hips|spine|chest|upperChest|neck|head|(left|right)(Foot|Toes|Shoulder))$/;

const segDistSq = (p, a, b) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1))); const d = sub(p, add(a, ab.map((c) => c * t))); return dot(d, d); };

/**
 * The T frames of a humanoid pack's bones: per bone `{ q: qT, head: hT, tail: tT, role, parent }`, in bone order.
 * Throws when the rig is not humanoid (a required VRM bone missing).
 */
export function tposeFrames(bones) {
  const { names, missing } = humanoidBonesFor(bones);
  if (missing.length) throw new Error(`rig-tpose: not a humanoid rig (missing ${missing.join(', ')})`);
  const byVrm = new Map([...names].map(([i, v]) => [v, i]));
  const parentOf = bones.map((b, i) => {
    const v = names.get(i);
    if (v) { for (let p = VRM_PARENT[v]; p; p = VRM_PARENT[p]) if (byVrm.has(p)) return byVrm.get(p); return v === 'hips' ? -1 : byVrm.get('hips'); }
    let best = -1, bd = Infinity;
    bones.forEach((o, j) => { if (j !== i) { const d = segDistSq(b.head, o.head, o.tail); if (d < bd) { bd = d; best = j; } } });
    return best;
  });
  // the lateral axis from the rig itself: left = from the right upper arm's root toward the left's, level
  const hl = bones[byVrm.get('leftUpperArm')].head, hr = bones[byVrm.get('rightUpperArm')].head;
  const left = unit([hl[0] - hr[0], hl[1] - hr[1], 0]), right = left.map((c) => -c), down = [0, 0, -1];
  const out = new Array(bones.length);
  const solve = (i, seen = new Set()) => {
    if (out[i]) return out[i];
    if (seen.has(i)) throw new Error(`rig-tpose: bone ${bones[i].id} is its own ancestor`);
    seen.add(i);
    const b = bones[i], v = names.get(i) || null, p = parentOf[i];
    const P = p >= 0 ? solve(p, seen) : null;
    const qp = P ? P.q : QI;
    const head = P ? add(P.head, qrot(P.q, sub(b.head, bones[p].head))) : [...b.head];
    const arm = v && ARM.exec(v), leg = v && LEG.test(v);
    const role = arm ? 'aim' : leg ? 'aim' : v && WORLD.test(v) ? 'world' : 'ride';
    let q;
    if (role === 'aim') q = qmul(qarc(unit(qrot(qp, sub(b.tail, b.head))), arm ? (arm[1] === 'left' ? left : right) : down), qp);
    else if (role === 'world') q = QI;
    else q = qp;
    out[i] = { q, head, tail: add(head, qrot(q, sub(b.tail, b.head))), role, parent: p, vrm: v };
    return out[i];
  };
  bones.forEach((_, i) => solve(i));
  return out;
}

const f32 = (b64) => { const buf = Buffer.from(b64, 'base64'); return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4); };
const u8 = (b64) => Uint8Array.from(Buffer.from(b64, 'base64'));
const b64f32 = (arr) => Buffer.from(new Float32Array(arr).buffer).toString('base64');
/**
 * Re-rest a humanoid pack in the T-pose. Returns a NEW pack (the input is not touched): `bones` at T, `parts` moved,
 * `clips` re-expressed, `figH` re-measured, `tpose.offsets` the per-bone qT (rounded like the pack).
 */
export function tposeRig(fig) {
  const T = tposeFrames(fig.bones);
  const rest = fig.bones.map((b) => b.head);
  const move = (v, j) => add(T[j].head, qrot(T[j].q, sub(v, rest[j])));
  // parts: a skinned part (the hero's jnt/wgt) by its own weights; a rigid part by the bone it is packed under
  const moved = fig.parts.map((P, pi) => {
    if (!P) return null;
    const pos = f32(P.pos), jnt = P.jnt ? u8(P.jnt) : null, wgt = P.wgt ? f32(P.wgt) : null, out = new Array(pos.length);
    for (let k = 0; k < pos.length / 3; k++) {
      const v = [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]];
      let w = [0, 0, 0];
      if (jnt) { for (let s = 0; s < 4; s++) { const a = wgt[4 * k + s]; if (a) w = add(w, move(v, jnt[4 * k + s]).map((c) => c * a)); } }
      else w = move(v, pi);
      out[3 * k] = w[0]; out[3 * k + 1] = w[1]; out[3 * k + 2] = w[2];
    }
    return out;
  });
  // stand the T rest on the floor the authored rest stood on (its lowest vertex)
  let z0 = Infinity, z1 = Infinity, zTop = -Infinity;
  fig.parts.forEach((P, pi) => { if (!P) return; const a = f32(P.pos), b = moved[pi]; for (let k = 2; k < a.length; k += 3) { z0 = Math.min(z0, a[k]); z1 = Math.min(z1, b[k]); zTop = Math.max(zTop, b[k]); } });
  const lift = Number.isFinite(z0) && Number.isFinite(z1) ? z0 - z1 : 0;
  const up = (p) => [p[0], p[1], p[2] + lift];
  const parts = fig.parts.map((P, pi) => {
    if (!P) return null;
    const b = moved[pi]; for (let k = 2; k < b.length; k += 3) b[k] += lift;
    return { ...P, pos: b64f32(b) };
  });
  const inv = T.map((t) => qconj(t.q));
  const clips = Object.fromEntries(Object.entries(fig.clips || {}).map(([name, c]) => {
    const nb = fig.bones.length, b = c.b.slice();
    for (let k = 0; k < c.k; k++) for (let i = 0; i < nb; i++) {
      const o = (k * nb + i) * 7, q = qmul([b[o], b[o + 1], b[o + 2], b[o + 3]], inv[i]);
      for (let a = 0; a < 4; a++) b[o + a] = r4(q[a]);
    }
    return [name, { ...c, b }];
  }));
  return {
    ...fig,
    bones: fig.bones.map((bn, i) => ({ ...bn, head: up(T[i].head).map(r4), ...(bn.tail ? { tail: up(T[i].tail).map(r4) } : {}) })),
    parts,
    clips,
    ...(Number.isFinite(zTop) ? { figH: r4(zTop + lift - z0) } : {}),
    tpose: { offsets: Object.fromEntries(fig.bones.map((bn, i) => [bn.id, T[i].q.map(r4)])) },
  };
}

/** The parent bone index of every bone of a humanoid pack (−1 for the hips), the tree the engine skeleton nests on:
 * the VRM humanoid tree, an unnamed bone under the bone whose segment is nearest its head (tposeFrames). */
export const humanoidParents = (bones) => tposeFrames(bones).map((t) => t.parent);

// the VRM / engine humanoid space from mojulo's native one: y up, the figure facing +z, its left on +x. Native is z up,
// facing +y, its left on −x, so C(x, y, z) = (−x, z, y) — a proper rotation (det +1), so a quaternion maps by its axis.
const C = (v) => [-v[0], v[2], v[1]];
const Cq = (q) => [-q[0], q[2], q[1], q[3]];

/**
 * A pack carried into the VRM space (y up, facing +z, the figure's left on +x): every rest head and tail, every part
 * vertex, every clip key's rotation and posed head, and every face row (a rebase and its target deltas, vectors) through
 * C. The skinned writer's engine-skeleton mode writes this pack so the skeleton space an engine builds IS that space.
 */
export function vrmSpacePack(fig) {
  const parts = fig.parts.map((P) => {
    if (!P) return null;
    const a = f32(P.pos), out = new Array(a.length);
    for (let k = 0; k < a.length; k += 3) { const v = C([a[k], a[k + 1], a[k + 2]]); out[k] = v[0]; out[k + 1] = v[1]; out[k + 2] = v[2]; }
    let morph = P.morph;
    if (morph) {
      const d = f32(morph.d), o = new Float32Array(d.length);
      for (let k = 0; k < d.length; k += 3) { const v = C([d[k], d[k + 1], d[k + 2]]); o[k] = v[0]; o[k + 1] = v[1]; o[k + 2] = v[2]; }
      morph = { ...morph, d: Buffer.from(o.buffer).toString('base64') };
    }
    return { ...P, pos: b64f32(out), ...(morph ? { morph } : {}) };
  });
  const clips = Object.fromEntries(Object.entries(fig.clips || {}).map(([name, c]) => {
    const b = c.b.slice(), nb = fig.bones.length;
    for (let k = 0; k < c.k; k++) for (let i = 0; i < nb; i++) {
      const o = (k * nb + i) * 7, q = Cq([b[o], b[o + 1], b[o + 2], b[o + 3]]), h = C([b[o + 4], b[o + 5], b[o + 6]]);
      for (let a = 0; a < 4; a++) b[o + a] = q[a];
      for (let a = 0; a < 3; a++) b[o + 4 + a] = h[a];
    }
    return [name, { ...c, b }];
  }));
  return { ...fig, bones: fig.bones.map((bn) => ({ ...bn, head: C(bn.head), ...(bn.tail ? { tail: C(bn.tail) } : {}) })), parts, clips, space: 'vrm' };
}

/**
 * The engine skeleton's clavicles: a weightless `clavicleL` / `clavicleR` bone (VRM leftShoulder / rightShoulder) from a
 * point just off the midline at the upper arm's root height to the upper arm's root, appended to a humanoid pack that
 * has none. An engine's humanoid profile (Godot's SkeletonProfileHumanoid) hangs the upper arm off the shoulder bone,
 * whose rest is a large turn: without one, every arm track from a skeleton that has it lands a quarter-turn off. The
 * clavicle rides its parent (the chest, else the spine) rigidly in every clip key, so the pack's motion is unchanged;
 * a clip from elsewhere can then shrug it. Appended at the end, so every skin index stays valid. No-op when present.
 */
const CLAVICLE_IN = 0.2;   // the clavicle's root, as a share of the upper arm root's offset from the midline
export function withClavicles(fig) {
  const { names } = humanoidBonesFor(fig.bones);
  const have = new Set(names.values()), by = new Map([...names].map(([i, v]) => [v, i]));
  if (have.has('leftShoulder') || have.has('rightShoulder')) return fig;
  const parentFor = by.get('upperChest') ?? by.get('chest') ?? by.get('spine');
  const added = [['L', 'leftUpperArm'], ['R', 'rightUpperArm']].filter(([, v]) => by.has(v)).map(([S, v]) => {
    const u = fig.bones[by.get(v)].head, mid = fig.bones[by.get('hips')].head;
    return { id: `clavicle${S}`, head: [mid[0] + (u[0] - mid[0]) * CLAVICLE_IN, mid[1] + (u[1] - mid[1]) * CLAVICLE_IN, u[2]], tail: [...u] };
  });
  if (!added.length) return fig;
  const nb = fig.bones.length, nb2 = nb + added.length, P = fig.bones[parentFor];
  const clips = Object.fromEntries(Object.entries(fig.clips || {}).map(([name, c]) => {
    const b = new Array(c.k * nb2 * 7);
    for (let k = 0; k < c.k; k++) {
      for (let i = 0; i < nb * 7; i++) b[k * nb2 * 7 + i] = c.b[k * nb * 7 + i];
      const po = (k * nb + parentFor) * 7, q = [c.b[po], c.b[po + 1], c.b[po + 2], c.b[po + 3]], h = [c.b[po + 4], c.b[po + 5], c.b[po + 6]];
      added.forEach((a, j) => {
        const o = (k * nb2 + nb + j) * 7, d = qrot(q, sub(a.head, P.head));
        b[o] = q[0]; b[o + 1] = q[1]; b[o + 2] = q[2]; b[o + 3] = q[3];
        b[o + 4] = r4(h[0] + d[0]); b[o + 5] = r4(h[1] + d[1]); b[o + 6] = r4(h[2] + d[2]);
      });
    }
    return [name, { ...c, b }];
  }));
  return { ...fig, bones: [...fig.bones, ...added.map((a) => ({ ...a, head: a.head.map(r4), tail: a.tail.map(r4) }))], parts: [...fig.parts, ...added.map(() => null)], clips };
}

/**
 * The engine skeleton's TRUNK joints: a rig whose trunk is coarser than the profile's (the flat figure's one `spine`
 * bone; the hero's `chest` with no upper chest) has its top trunk bone SPLIT — joints `trunkChest` / `trunkUpperChest`
 * (VRM chest / upperChest) placed along it, the bone's skin spread over the chain by where each vertex lies along the
 * segment (piecewise-linear hats; a rigid part gains its weights here), so a retargeted chest or upper-chest turn bends
 * the torso's flesh with the arms and head instead of shearing it. The new joints ride the split bone in every clip key,
 * so the pack's own motion is unchanged. Appended at the end (skin indices stay valid). No-op when the profile's trunk
 * is all there.
 */
export function withTrunkJoints(fig) {
  const { names } = humanoidBonesFor(fig.bones);
  const by = new Map([...names].map(([i, v]) => [v, i]));
  if (by.has('upperChest')) return fig;
  const top = by.get('chest') ?? by.get('spine');
  if (top === undefined) return fig;
  const B = fig.bones[top], seg = sub(B.tail, B.head), L2 = dot(seg, seg) || 1;
  const cuts = by.has('chest') ? [['trunkUpperChest', 0.5]] : [['trunkChest', 1 / 3], ['trunkUpperChest', 2 / 3]];
  const nb = fig.bones.length, nb2 = nb + cuts.length;
  const at = (f) => add(B.head, seg.map((c) => c * f));
  const added = cuts.map(([id, f]) => ({ id, head: at(f).map(r4), tail: [...B.tail] }));
  // the chain the bone's skin spreads over: [the bone at 0, each cut at its share]
  const chain = [[top, 0], ...cuts.map(([, f], j) => [nb + j, f])];
  const hats = (v) => {
    const u = Math.max(0, Math.min(1, dot(sub(v, B.head), seg) / L2));
    for (let j = chain.length - 1; j >= 0; j--) {
      if (u < chain[j][1]) continue;
      if (j === chain.length - 1) return [[chain[j][0], 1]];
      const t = (u - chain[j][1]) / (chain[j + 1][1] - chain[j][1]);
      return [[chain[j][0], 1 - t], [chain[j + 1][0], t]];
    }
    return [[top, 1]];
  };
  const b64u8 = (arr) => Buffer.from(Uint8Array.from(arr).buffer).toString('base64');
  const parts = fig.parts.map((P, pi) => {
    if (!P) return P;
    const pos = f32(P.pos), n = pos.length / 3;
    const jnt = P.jnt ? u8(P.jnt) : null, wgt = P.wgt ? f32(P.wgt) : null;
    if (!jnt && pi !== top) return P;              // a rigid part of another bone: the exporter's capsule weights, as ever
    let touched = false;
    const J = new Array(4 * n).fill(0), W = new Array(4 * n).fill(0);
    for (let k = 0; k < n; k++) {
      const v = [pos[3 * k], pos[3 * k + 1], pos[3 * k + 2]];
      const inf = jnt ? [0, 1, 2, 3].map((s) => [jnt[4 * k + s], wgt[4 * k + s]]).filter(([, w]) => w > 0) : [[pi, 1]];
      const out = [];
      for (const [j, w] of inf) { if (j === top) { touched = true; for (const [c, h] of hats(v)) if (h > 0) out.push([c, w * h]); } else out.push([j, w]); }
      out.sort((a, b) => b[1] - a[1] || a[0] - b[0]);
      const keep = out.slice(0, 4), sum = keep.reduce((a, [, w]) => a + w, 0) || 1;
      keep.forEach(([j, w], s) => { J[4 * k + s] = j; W[4 * k + s] = w / sum; });
    }
    return touched ? { ...P, jnt: b64u8(J), wgt: b64f32(W) } : P;
  });
  const clips = Object.fromEntries(Object.entries(fig.clips || {}).map(([name, c]) => {
    const b = new Array(c.k * nb2 * 7);
    for (let k = 0; k < c.k; k++) {
      for (let i = 0; i < nb * 7; i++) b[k * nb2 * 7 + i] = c.b[k * nb * 7 + i];
      const po = (k * nb + top) * 7, q = [c.b[po], c.b[po + 1], c.b[po + 2], c.b[po + 3]], h = [c.b[po + 4], c.b[po + 5], c.b[po + 6]];
      added.forEach((a, j) => {
        const o = (k * nb2 + nb + j) * 7, d = qrot(q, sub(a.head, B.head));
        b[o] = q[0]; b[o + 1] = q[1]; b[o + 2] = q[2]; b[o + 3] = q[3];
        b[o + 4] = r4(h[0] + d[0]); b[o + 5] = r4(h[1] + d[1]); b[o + 6] = r4(h[2] + d[2]);
      });
    }
    return [name, { ...c, b }];
  }));
  return { ...fig, bones: [...fig.bones, ...added], parts: [...parts, ...added.map(() => null)], clips };
}

/** Every joint the engine skeleton adds to meet the humanoid profile: the trunk joints, then the clavicles (which then
 * hang off the upper chest). */
export const withProfileJoints = (fig) => withClavicles(withTrunkJoints(fig));
