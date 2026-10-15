/**
 * versus skin — a character's own body posed by the fight (inlined into the arena's block, versus-arena.client.js).
 *
 * The fight poses a stick figure in its plane (versus-rig.js rigJoints: x forward, y up, mm). A character made with
 * create_character brings its rig instead: rigid parts, one per bone, in the figure's own rest frame (metres, z up,
 * facing +y, its right side +x; the layered hero's packed rig). Every fight pose is a turn in the plane, so each bone
 * takes ONE angle about the figure's sideways axis: how far its segment of the stick figure has turned from where it
 * stands at rest (torso and head up, arms and legs down, the foot forward). The bone keeps its own length and its rest
 * shape (an arm's outward hang, a foot's pitch); positions follow down the chain from the pelvis, each bone's head
 * carried by its parent's turn, so no joint opens. A grounded pose stands on the feet's lowest point as the rest does.
 *
 * The lead side (F, nearer the camera) is the figure's right when it faces +x and its left when it faces -x.
 *
 *   skinSkeleton(bones)                → the bones' roles: [{ id, head, tail, kind, seg?, of?, mix?, parent, anchor? }]
 *   skinPose(sk, joints, face, air)    → { a: [angle per bone, radians], h: [[x, y, z] posed head per bone] }
 *
 * Pure, no dice: floats in, floats out; nothing here is kept by the sim.
 */

// where each stick segment stands at rest (forward, up): the trunk and head up, the limbs down, the foot forward
const SKIN_REST = { trunk: [0, 1], head: [0, 1], limb: [0, -1], foot: [1, 0] };
// the bones the fight turns: a segment of the stick figure (its two joints, `$` the side's F or B), its rest, the parent
const SKIN_AIM = {
  pelvis: { seg: ['pelvis', 'neck'], rest: 'trunk', parent: null },
  lumbar: { seg: ['pelvis', 'neck'], rest: 'trunk', parent: null },
  torso: { seg: ['pelvis', 'neck'], rest: 'trunk', parent: ['lumbar', 'pelvis'] },
  neck: { seg: ['neck', 'head'], rest: 'head', parent: ['torso'] },
  head: { seg: ['neck', 'head'], rest: 'head', parent: ['neck'] },
  upperArm: { seg: ['shoulder', 'elbow$'], rest: 'limb', parent: ['clavicle$', 'torso'] },
  foreArm: { seg: ['elbow$', 'hand$'], rest: 'limb', parent: ['upperArm$'] },
  thigh: { seg: ['pelvis', 'knee$'], rest: 'limb', parent: ['pelvis'] },
  shank: { seg: ['knee$', 'ankle$'], rest: 'limb', parent: ['thigh$'] },
  foot: { seg: ['ankle$', 'toe$'], rest: 'foot', parent: ['shank$'] },
};
// the bones that ride another whole (its turn, its frame)
const SKIN_FOLLOW = { jaw: 'head', clavicle: 'torso', bust: 'torso', hand: 'foreArm$', toes: 'foot$' };
// the folds at a bend: halfway between the two bones' turns, carried round the bend's joint (the second bone's head)
const SKIN_FOLD = { hipFold: ['pelvis', 'thigh$'], kneeFold: ['thigh$', 'shank$'], elbowFold: ['upperArm$', 'foreArm$'] };

const skinSplit = (id) => { const m = /^(.*?)([RL])$/.exec(id); return m ? [m[1], m[2]] : [id, null]; };
// a point's distance from a bone's segment, head to tail
function skinSeg(p, a, b) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
  const L = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const t = L > 0 ? Math.max(0, Math.min(1, (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / L)) : 0;
  return Math.hypot(w[0] - d[0] * t, w[1] - d[1] * t, w[2] - d[2] * t);
}

/** A packed rig's bones ([{ id, head, tail }]) → each bone's role, in an order where a parent comes before its children. */
export function skinSkeleton(bones) {
  const index = Object.fromEntries(bones.map((b, i) => [b.id, i]));
  const find = (names, S) => {
    for (const n of names ?? []) { const i = index[n.replace('$', S ?? '')]; if (i !== undefined) return i; }
    return -1;
  };
  const roles = bones.map((b) => {
    const [base, S] = skinSplit(b.id);
    const out = { id: b.id, head: b.head, tail: b.tail, side: S };
    const A = SKIN_AIM[base] ?? SKIN_AIM[b.id];
    if (A) return { ...out, kind: 'aim', seg: A.seg, rest: A.rest, parentOf: A.parent, S };
    if (SKIN_FOLD[base]) return { ...out, kind: 'fold', mixOf: SKIN_FOLD[base], S };
    if (SKIN_FOLLOW[base]) return { ...out, kind: 'follow', ofName: SKIN_FOLLOW[base], S };
    return { ...out, kind: 'follow', ofName: null, S };
  });
  for (const r of roles) {
    if (r.kind === 'aim') r.parent = r.parentOf ? find(r.parentOf, r.S) : -1;
    else if (r.kind === 'fold') { r.mix = r.mixOf.map((n) => find([n], r.S)); r.anchor = r.mix[1]; r.parent = r.mix[1]; }
    else {
      r.of = r.ofName ? find([r.ofName], r.S) : -1;
      // a bone with no word (a finger, a held thing): it rides the nearest bone's segment from its head
      if (r.of < 0) {
        let best = -1, bd = Infinity;
        roles.forEach((o, j) => {
          if (o === r || o.kind === 'follow' && !o.ofName) return;
          const d = skinSeg(r.head, o.head, o.tail);
          if (d < bd) { bd = d; best = j; }
        });
        r.of = best;
      }
      r.parent = r.of;
    }
  }
  for (const r of roles) { delete r.parentOf; delete r.mixOf; delete r.ofName; }
  // parents first
  const order = [], placed = new Set();
  for (let pass = 0; pass < roles.length && order.length < roles.length; pass++) {
    roles.forEach((r, i) => {
      if (placed.has(i)) return;
      const deps = [r.parent, r.of, ...(r.mix ?? [])].filter((j) => j !== undefined && j >= 0 && j !== i);
      if (deps.every((j) => placed.has(j))) { placed.add(i); order.push(i); }
    });
  }
  return { roles, order };
}

const skinAngle = (d) => Math.atan2(d[1], d[0]);
// turn a rest offset about +x (the figure's sideways axis) by a: y forward toward z up
const skinTurn = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };

/** The fight's joints (mm, the stick figure facing forward) → each bone's turn and posed head, in the figure's frame. */
export function skinPose(sk, J, face, air) {
  const F = face > 0 ? 'R' : 'L';
  const at = (name, S) => J[name.replace('$', S === F ? 'F' : 'B')];
  const { roles, order } = sk;
  const a = new Array(roles.length).fill(0), h = new Array(roles.length);
  for (const i of order) {
    const r = roles[i];
    if (r.kind === 'aim') {
      const p = at(r.seg[0], r.S), q = at(r.seg[1], r.S);
      a[i] = skinAngle([q[0] - p[0], q[1] - p[1]]) - skinAngle(SKIN_REST[r.rest]);
    } else if (r.kind === 'fold') a[i] = (a[r.mix[0]] + a[r.mix[1]]) / 2;
    else a[i] = r.of >= 0 ? a[r.of] : 0;
    if (r.parent < 0) h[i] = [r.head[0], J.pelvis[0] / 1000, J.pelvis[1] / 1000];
    else {
      // carried by the parent's turn (a fold, round its bend: the anchor's head, by its own turn)
      const P = roles[r.parent], turn = r.kind === 'fold' ? a[i] : a[r.parent];
      const d = skinTurn([r.head[0] - P.head[0], r.head[1] - P.head[1], r.head[2] - P.head[2]], turn);
      h[i] = [h[r.parent][0] + d[0], h[r.parent][1] + d[1], h[r.parent][2] + d[2]];
    }
  }
  if (!air) {
    // stand on the feet as the rest does: the lowest foot point back at its rest height
    let rest = Infinity, now = Infinity;
    roles.forEach((r, i) => {
      if (!/^(foot|toes)[RL]$/.test(r.id)) return;
      const t = skinTurn([r.tail[0] - r.head[0], r.tail[1] - r.head[1], r.tail[2] - r.head[2]], a[i]);
      rest = Math.min(rest, r.head[2], r.tail[2]);
      now = Math.min(now, h[i][2], h[i][2] + t[2]);
    });
    if (Number.isFinite(rest)) for (const p of h) if (p) p[2] += rest - now;
  }
  return { a, h };
}
