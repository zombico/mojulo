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
