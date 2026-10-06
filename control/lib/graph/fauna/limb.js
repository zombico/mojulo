// limb — a leg as the solvers see it: its main chain from the girdle down, and the two-link solve that hangs it from
// its root to a foot block placed anywhere with any attitude. Shared by the gait solver (a foot planted in a stride)
// and the behavior solver (a foot tucked under a lying body, a leg drawn up into the feathers). Pure.
import { sub, add, mul, dot, cross, norm, unit, mv, between } from './vec.js';

/** The legs of a skeleton: `{ LF, RF, LH, RH }` → the bone ids of each leg's main chain, root first (wings excluded). */
export function limbsOf(S) {
  const out = {};
  for (const b of S.bones) {
    if (!b.role || !/^(fore|hind)\.(humerus|femur)$/.test(b.role)) continue;   // legs, not wings
    const key = `${b.id.endsWith('L') ? 'L' : 'R'}${b.role.startsWith('fore') ? 'F' : 'H'}`;
    const chain = [b.id];
    for (;;) { const next = S.bones.find((c) => c.parent === chain[chain.length - 1] && c.role?.split('.')[0] === b.role.split('.')[0]); if (!next) break; chain.push(next.id); }
    out[key] = chain;
  }
  return out;
}

/** Where a leg's FOOT BLOCK starts in its chain: the third bone (metapodial, digits, hoof), or the last of a two-bone leg. */
export const blockStart = (bones) => Math.min(2, bones.length - 1);

/**
 * Hang a leg from `root` to its foot block: the block (bones from `blockStart` on) placed rigidly by rotation `Rc` with
 * its top at `blockTop`, and the upper bones solved two-link to it, the knee bending the way it bends at rest (a
 * two-bone leg aims its one upper bone at the block). Writes each bone's world rotation into `W` and posed head into
 * `H`. The caller keeps `blockTop` within reach (`l1 + l2`); past it the leg straightens toward it and the block is
 * carried to the leg's end. `bend0`, if given, is the way the knee goes instead of its rest bend (a lying animal's knee
 * swung out onto the ground rather than down through it).
 */
export function hangLimb(bones, root, blockTop, Rc, W, H, bend0) {
  const k0 = blockStart(bones), block = bones.slice(k0), top = block[0].head, upper = bones.slice(0, k0);
  const l1 = norm(sub(bones[0].tail, bones[0].head));
  if (k0 > 1) {
    const l2 = norm(sub(bones[1].tail, bones[1].head));
    const d0 = sub(blockTop, root), d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, norm(d0))), e = unit(d0);
    const restKnee = bones[0].tail, restLine = unit(sub(bones[1].tail, bones[0].head));
    let bend = bend0 || sub(sub(restKnee, bones[0].head), mul(restLine, dot(sub(restKnee, bones[0].head), restLine)));
    bend = sub(bend, mul(e, dot(bend, e)));
    const nrm = norm(bend) > 1e-6 ? unit(bend) : unit(cross(e, [1, 0, 0]));
    const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    const knee = add(add(root, mul(e, a)), mul(nrm, hh)), end = add(root, mul(e, d));
    W[upper[0].id] = between(unit(sub(bones[0].tail, bones[0].head)), unit(sub(knee, root))); H[upper[0].id] = root;
    W[upper[1].id] = between(unit(sub(bones[1].tail, bones[1].head)), unit(sub(end, knee))); H[upper[1].id] = knee;
    const shift = sub(end, blockTop);
    for (const b of block) { W[b.id] = Rc; H[b.id] = add(add(blockTop, shift), mv(Rc, sub(b.head, top))); }
  } else {
    // a two-bone limb (a bird's thigh + tarsus as root and block): aim the root at the block top
    W[upper[0].id] = between(unit(sub(bones[0].tail, bones[0].head)), unit(sub(blockTop, root))); H[upper[0].id] = root;
    for (const b of block) { W[b.id] = Rc; H[b.id] = add(blockTop, mv(Rc, sub(b.head, top))); }
  }
}
