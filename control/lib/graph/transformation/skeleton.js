/**
 * skeleton.js — a baked biped's bones as a tree, and plain forward kinematics over it.
 *
 * A unit rig (worlds/unit-rig.js) packs its bones as a flat list of { id, head } in the rig frame (+y forward, +z
 * up, +x right, feet at z = 0), every bone at rest unrotated. The tree is the vajra one for the core bones; a
 * suit's synthetic riders (skirts, shoulder caps, the shield, the weapons, a welded off-arm) hang off the bone they
 * ride, read off their name, else off the nearest core bone. FK here has no anatomical limits on purpose: a stow
 * folds a body the way a toy folds, not the way a stride bends.
 */

import { QI, qmul, qrot, vadd, vsub } from './kin.js';

const CORE_PARENT = {
  pelvis: null, torso: 'pelvis', head: 'torso',
  upperArmL: 'torso', forearmL: 'upperArmL', handL: 'forearmL',
  upperArmR: 'torso', forearmR: 'upperArmR', handR: 'forearmR',
  thighL: 'pelvis', shinL: 'thighL', thighR: 'pelvis', shinR: 'thighR',
};
export const CORE_BONES = Object.freeze(Object.keys(CORE_PARENT));

const RIDER_PARENT = [
  [/^skirt/, 'pelvis'],
  [/^shoulderCapL/, 'upperArmL'], [/^shoulderCapR/, 'upperArmR'],
  [/^shield/, 'forearmL'],
  [/^offArm/, 'torso'],
];

/**
 * robotSkeleton(fig) → { bones: [{ id, head, parent, core }], byId } — parent is a bone INDEX (−1 at the root),
 * every parent listed before its child's first use by fk (fk walks in dependency order, not list order).
 */
export function robotSkeleton(fig) {
  const ids = fig.bones.map((b) => b.id);
  const byId = Object.fromEntries(ids.map((id, i) => [id, i]));
  if (byId.pelvis == null || byId.torso == null) throw new Error('transformation: the robot has no pelvis/torso bones (is it a biped rig?)');
  const present = (id) => id != null && byId[id] != null;
  const bones = fig.bones.map((b) => {
    let p = CORE_PARENT[b.id];
    const core = p !== undefined;
    if (!core) {
      const rule = RIDER_PARENT.find(([re]) => re.test(b.id));
      p = rule ? rule[1] : null;
      if (!present(p)) {
        // the nearest core bone by head distance (a weapon rides the hand nearest it)
        let best = 'torso', bd = Infinity;
        for (const c of CORE_BONES) {
          if (!present(c)) continue;
          const h = fig.bones[byId[c]].head, d = (h[0] - b.head[0]) ** 2 + (h[1] - b.head[1]) ** 2 + (h[2] - b.head[2]) ** 2;
          if (d < bd) { bd = d; best = c; }
        }
        p = best;
      }
    }
    // a hand-less rig: a missing parent climbs to the nearest present ancestor
    while (p && !present(p)) p = CORE_PARENT[p] ?? null;
    return { id: b.id, head: b.head.slice(), parent: p ? byId[p] : -1, core };
  });
  return { bones, byId };
}

/**
 * fk(skel, { root: { q, at }, local: { id → q } }) → { q: [...], h: [...] } per bone: its world rotation and where
 * its rest head goes. `root.q` turns the whole body about the pelvis head, which lands at `root.at` (the pelvis
 * rest head when absent); `local` turns a bone in its parent's frame (identity when absent).
 */
export function fk(skel, { root = {}, local = {} } = {}) {
  const n = skel.bones.length;
  const Q = new Array(n), H = new Array(n);
  const rootQ = root.q || QI;
  const visit = (i) => {
    if (Q[i]) return;
    const b = skel.bones[i], L = local[b.id] || QI;
    if (b.parent < 0) {
      Q[i] = qmul(rootQ, L);
      H[i] = root.at ? root.at.slice() : b.head.slice();
      return;
    }
    visit(b.parent);
    const P = skel.bones[b.parent];
    Q[i] = qmul(Q[b.parent], L);
    H[i] = vadd(H[b.parent], qrot(Q[b.parent], vsub(b.head, P.head)));
  };
  for (let i = 0; i < n; i++) visit(i);
  return { q: Q, h: H };
}

/** the world position of a point rigid with bone i (given at rest) under a pose { q, h } */
export const boneApply = (skel, pose, i, v) => vadd(pose.h[i], qrot(pose.q[i], vsub(v, skel.bones[i].head)));
