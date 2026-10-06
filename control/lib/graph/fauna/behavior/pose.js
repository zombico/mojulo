/**
 * pose — a resolved behavior posed on a species' skeleton: every bone's posed head and tail at phase t ∈ [0, 1) of the
 * behavior's loop. The output is a gait frame's (`{ bones: { <id>: { head, tail, m } }, ground }`), so the stick strip,
 * the clip packer and the rig read it unchanged. Pure and deterministic.
 *
 * Each mechanism word of a strategy (./index.js: SUPPORT, HEAD, TAIL, LOOP) is posed by one PRINCIPLE, the same for
 * every body, read through that body's own bones:
 *  - SUPPORT moves the trunk as one (lowered until the belly rests on the ground, rolled onto a hip, shifted over one
 *    foot) and places each FOOT BLOCK on the ground where that support puts it (planted where it stood, folded flat
 *    under the chest or beside the belly, drawn up into the belly), in the frame of the trunk bone the leg hangs on;
 *    the leg hangs from its girdle to the block by the gait solver's two-link (../limb.js). A legless body is LAID
 *    OUT along a path instead: a coil on the ground, or a coil with the front third raised in an S.
 *  - HEAD bends the neck and turns the head: down until the mouth touches the ground (solved, not set), up, back
 *    along the flank, into the shoulders.
 *  - TAIL bends the tail: wrapped round the curl, flagged up, twitching at the tip, sculling.
 *  - LOOP is a small motion over the pose: breathing in the ribs, a grind or a nod of the head, a scan in short
 *    turns, fins sculling. Swimming on (`cruise`) is the species' own swim gait.
 *
 * A word not posed yet throws, naming it (`posable` lists them): the resolver covers every species; posing grows rig
 * by rig.
 */
import { faunaSkeleton } from '../skeleton.js';
import { speciesPlan, SPECIES } from '../species.js';
import { locomotionFor } from '../locomotion/index.js';
import { poseGait, prepare as prepareGait } from '../gait.js';
import { limbsOf, hangLimb, blockStart } from '../limb.js';
import { sub, add, mul, norm, unit, I3, mm, mv, rotX, rotY, rotZ, axisAngle, between } from '../vec.js';
import { resolveBehavior } from './index.js';
import { capabilitiesOf } from './capabilities.js';

const TAU = 2 * Math.PI, DEG = Math.PI / 180;
const AXIS = /^(spine|neck|tail)\d+$|^head$/;
const transpose = (A) => [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);

/** The words this module poses. A strategy is posable when its support, head, tail and loop words are all here. */
export const POSED = Object.freeze({
  support: ['stand', 'upright', 'balance', 'cocked', 'sit', 'rear', 'side', 'crouch', 'sternal', 'sphinx', 'curl', 'perch', 'sit_bird', 'coil', 'coil-strike', 'hover', 'cruise'],
  head: ['level', 'low', 'high', 'ground', 'reach', 'on-paws', 'on-flank', 'tucked', 'sunk', 'fixed', 'forward', 'inside', 'to-hands'],
  tail: ['rest', 'wrap', 'flag', 'twitch', 'level', 'scull', 'none', 'rattle', 'prop'],
  loop: ['breathe', 'chew', 'crop', 'strip', 'peck', 'scan', 'stare', 'tongue', 'fins', 'swim', 'snap', 'sway', 'nibble', 'gnaw', 'root', 'tear', 'gape'],
});

/** The words of resolved strategy `r` this module cannot pose yet (empty: posable). */
export function unposed(r) {
  return ['support', 'head', 'tail', 'loop'].filter((k) => !POSED[k].includes(r[k])).map((k) => `${k} '${r[k]}'`);
}

/** Whether species `id` can be posed doing `behavior` (or its `variant`), and if not, which words are missing. */
export function posable(id, behavior, { variant } = {}) {
  const r = resolveBehavior(id, behavior, { variant }), missing = unposed(r);
  return { ok: !missing.length, strategy: r.strategy, missing };
}

const CTX = new Map();

/** The pieces every frame of a species reuses: skeleton, limbs, girth, the trunk's measures. */
export function prepare(id) {
  if (CTX.has(id)) return CTX.get(id);
  const S = faunaSkeleton(id); if (!S) throw new Error(`behavior pose: unknown species '${id}'`);
  const byId = Object.fromEntries(S.bones.map((b) => [b.id, b]));
  const limbs = limbsOf(S);
  const of = (re) => S.bones.filter((b) => re.test(b.id));
  const spine = of(/^spine\d+$/), neck = of(/^neck\d+$/), tail = of(/^tail\d+$/);
  const hip = limbs.RH ? byId[limbs.RH[0]] : null, shoulder = limbs.RF ? byId[limbs.RF[0]] : null;
  const h = (hip || shoulder)?.head[2] || Math.max(...S.bones.map((b) => b.head[2]));
  const ctx = { id, S, byId, limbs, spine, neck, tail, h, ...trunkRings(id, S) };
  CTX.set(id, ctx);
  return ctx;
}

/** The trunk's belly height (its lowest ring bottom) and its thickness (the deepest ring), from the plan it builds. */
function trunkRings(id, S) {
  const plan = speciesPlan(id);
  const onSpine = (name) => { const b = S.bind[name]; const ids = typeof b === 'string' ? [b] : b ? (b.stations || [b.from, b.to]) : []; return ids.some((x) => /^spine\d+$/.test(x)); };
  let belly = Infinity, girth = 0;
  for (const g of plan.segments) {
    if (!onSpine(g.name)) continue;
    for (const st of g.stations || []) {
      if (st.r && st.at) { const r = Array.isArray(st.r) ? st.r : [st.r, st.r]; belly = Math.min(belly, st.at[2] - r[1]); girth = Math.max(girth, 2 * r[1], 2 * r[0]); }
      else if (st.points) { const P = Object.values(st.points), zs = P.map((p) => p[2]); belly = Math.min(belly, ...zs); girth = Math.max(girth, Math.max(...zs) - Math.min(...zs)); }
    }
  }
  return { belly: Number.isFinite(belly) ? Math.max(0, belly) : 0, girth: girth || 0.1 };
}

/** Pose species `id` doing `behavior` at loop phase t; `variant` picks another way from its repertoire. */
export function poseBehavior(id, behavior, t = 0, { variant, ctx = prepare(id) } = {}) {
  const r = resolveBehavior(id, behavior, { variant });
  const missing = unposed(r);
  if (missing.length) throw new Error(`behavior pose: ${id} ${behavior} → '${r.strategy}' is not posed yet (${missing.join(', ')})`);
  return poseStrategy(ctx, r, t);
}

/** n evenly spaced poses of one loop (a hold breathes through it). */
export function behaviorFrames(id, behavior, n = 24, { variant } = {}) {
  const ctx = prepare(id);
  return Array.from({ length: n }, (_, i) => poseBehavior(id, behavior, i / n, { variant, ctx }));
}

/** Pose a resolved strategy `r` (`{ support, head, tail, loop }`) at phase t. */
export function poseStrategy(ctx, r, t) {
  if (r.support === 'cruise') return cruise(ctx, t);
  if (r.support === 'coil' || r.support === 'coil-strike') return coil(ctx, r, t);

  const { S, byId, limbs, spine, neck, tail, h } = ctx;
  const local = {};
  const turn = (id, R) => { local[id] = mm(local[id] || I3, R); };
  const body = support(ctx, r.support, r);

  // the trunk's own bend (a curl), then head, tail and loop, as local turns
  if (r.support === 'curl') for (const b of spine.slice(1)) turn(b.id, rotZ(CURL.spine / Math.max(1, spine.length - 1)));
  headTurns(ctx, r, body, turn);
  tailTurns(ctx, r, t, turn);

  // a limb or wing rooted on the neck rides the trunk, not the neck's turn
  for (const b of S.bones) if (b.parent && /^neck\d+$/.test(b.parent) && !AXIS.test(b.id)) local[b.id] = transpose(chainTurn(local, byId, b.parent));

  // forward kinematics: the root carries the body move (about the trunk's foot on the ground)
  const W = {}, H = {};
  const fk = () => {
    for (const b of S.bones) {
      const Lr = local[b.id] || I3;
      if (!b.parent) { W[b.id] = mm(body.R, Lr); H[b.id] = add(add(body.pivot, mv(body.R, sub(b.head, body.pivot))), body.T); continue; }
      const p = byId[b.parent];
      W[b.id] = mm(W[p.id], Lr);
      H[b.id] = add(H[p.id], mv(W[p.id], sub(b.head, p.head)));
    }
  };
  fk();
  // a head that goes to a height is solved there: the neck bends down until the muzzle reaches it
  if (body.solveHead) solveHeadToGround(ctx, r, local, fk, H, W, body.solveHead, body);
  if (body.face) aimHead(ctx, local, fk, W, body.face);
  if (body.facePitch !== undefined) aimHead(ctx, local, fk, W, [0, Math.cos(body.facePitch), Math.sin(body.facePitch)]);
  // the loop rides over the solved pose
  loopTurns(ctx, r, t, turn);
  fk();

  // the head and neck never go through the ground: a lying body lifts its head just clear
  clearHead(ctx, local, fk, H, W, body);

  // the legs: each foot block placed by the support, the leg hung to it; a knee that would go into the ground swings
  // out and up onto it instead (a lying animal's stifle and elbow lie on the ground beside the body)
  const blockOf = {}, solved = new Set();
  for (const [key, chain] of Object.entries(limbs)) {
    const bones = chain.map((c) => byId[c]);
    const place = body.feet(key, bones, H, W);
    if (!place) continue;
    for (const c of chain) solved.add(c);
    // a lying leg bends as lying legs do, the elbow back along the body and the knee forward, a little out
    const side = key.startsWith('R') ? 1 : -1, fore = key.endsWith('F'), k0 = blockStart(bones);
    const Wp = W[byId[bones[0].id].parent];
    const bend = place.bend || (body.lying ? mv(Wp, [0.5 * side, fore ? -1 : 1, 0.2]) : undefined);
    hangLimb(bones, H[bones[0].id], place.top, place.R, W, H, bend);
    // a knee still in the ground swings out to the side, then up only as far as it must
    // (out and up in the body's frame; on a body rolled onto its side that can point down, so last of all, world up)
    for (const bendTry of [0.3, 0.8, 1.5].map((lift) => mv(Wp, [side, fore ? -0.3 : 0.3, lift])).concat([[0, fore ? -0.3 : 0.3, 1]])) {
      if (!(k0 > 1 && H[bones[1].id][2] < 0.005 * h)) break;
      hangLimb(bones, H[bones[0].id], place.top, place.R, W, H, bendTry);
    }
    blockOf[bones[k0 - 1]?.id] = bones[k0];
  }
  // branches (toes, claws, dewclaws) ride their limb parent, in tree order; a branch beside the foot block (a bird's
  // side toes, a theropod's second finger) rides the block, not the bone above it
  // (a bone the leg solve placed is skipped; a role-carrying bone off a branch, a duck's claw on its web, is a branch)
  const onLimb = new Set();
  for (const b of S.bones) {
    if (!b.parent || AXIS.test(b.id)) continue;
    if (solved.has(b.id)) { onLimb.add(b.id); continue; }
    if (!onLimb.has(b.parent)) continue;
    onLimb.add(b.id);
    const blk = blockOf[b.parent];
    const p = blk || byId[b.parent];
    W[b.id] = mm(W[p.id], local[b.id] || I3);
    H[b.id] = add(H[p.id], mv(W[p.id], sub(b.head, p.head)));
  }
  clearWings(ctx, W, H);
  groundTail(ctx, W, H);
  return frame(S, W, H);
}

const frame = (S, W, H) => {
  const bones = {};
  for (const b of S.bones) bones[b.id] = { head: H[b.id], tail: add(H[b.id], mv(W[b.id], sub(b.tail, b.head))), m: W[b.id] };
  return { bones, ground: 0 };
};

/** The product of the neck's own local turns down to neck bone `id` (what a limb hung on it inherits from the neck). */
function chainTurn(local, byId, id) {
  const path = []; for (let b = byId[id]; b && /^neck\d+$/.test(b.id); b = b.parent ? byId[b.parent] : null) path.unshift(b.id);
  return path.reduce((M, x) => mm(M, local[x] || I3), I3);
}

// ── SUPPORT ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const CURL = { spine: 95 * DEG, neck: 75 * DEG, head: 25 * DEG, tail: -200 * DEG };

/**
 * A support: the trunk's rigid move (`R` about `pivot`, then `T`) and where each foot block goes (`feet(key, bones, H, W)`
 * → `{ top, R }` or null to leave the leg as the trunk carries it).
 */
function support(ctx, word, r) {
  const { byId, spine, h, belly } = ctx;
  const ys = spine.map((b) => b.head[1]);
  const pivot = [0, ys.reduce((m, y) => m + y, 0) / ys.length, 0];
  const planted = (key, bones) => restBlock(bones);   // where it stood: rest top, rest attitude
  const lie = belly - 0.01 * h;                        // the belly comes down onto the ground
  switch (word) {
    // standing where it stood; `upright` is the same for a body built upright (a penguin, a bird drawn up tall: its
    // height comes from the head word)
    case 'stand': case 'upright': case 'balance': return { R: I3, pivot, T: [0, 0, 0], feet: planted };
    case 'cocked': {
      // the hip drops on the resting side; that hind hoof rests on its toe, the fetlock flexed, a little forward
      const drop = 0.03 * h;
      return { R: rotY(-2.5 * DEG), pivot, T: [0, 0, -drop / 2], feet: (key, bones, H, W) => (key === 'LH' ? onToe(bones, 0.06 * h, 28 * DEG) : planted(key, bones)) };
    }
    case 'sternal': case 'sphinx': case 'curl': {
      const T = [0, 0, -lie];
      return { R: word === 'curl' ? rotY(-12 * DEG) : I3, pivot, T, lying: true, feet: (key, bones, H, W) => folded(ctx, word, key, bones, H, W) };
    }
    case 'sit_bird': {
      return { R: I3, pivot, T: [0, 0, -lie], lying: true, feet: (key, bones, H, W) => folded(ctx, 'sit_bird', key, bones, H, W) };
    }
    case 'perch': {
      // the body sinks a little and shifts over the standing (right) foot; the left leg draws up into the belly
      const foot = ctx.limbs.RH ? byId[ctx.limbs.RH[0]].head[0] : 0;
      return { R: I3, pivot, T: [foot * 0.8, 0, -0.06 * h], feet: (key, bones, H, W) => (key === 'LH' ? tucked(ctx, bones, H, W) : planted(key, bones)) };
    }
    // a body that already stands on two legs rears by standing (a kangaroo, a theropod: no trunk to pitch up)
    case 'rear': if (capabilitiesOf(ctx.id).support === 'two') return { R: I3, pivot, T: [0, 0, 0], feet: planted };
    // fallthrough
    case 'sit': return upright(ctx, word, r) || { R: I3, pivot, T: [0, 0, 0], feet: planted };
    case 'side': return side(ctx, pivot);
    case 'crouch': {
      // the trunk sinks on its planted feet, the front a little lower (the eyes on the ground ahead), the legs flexing
      const hipZ = ctx.limbs.RH ? byId[ctx.limbs.RH[0]].head[2] : h;
      return { R: rotX(-6 * DEG), pivot: [0, pivot[1], 0], T: [0, 0, -CROUCH * hipZ], feet: planted };
    }
    case 'hover': return { R: I3, pivot, T: [0, 0, 0], feet: () => null };
    default: throw new Error(`behavior pose: support '${word}' is not posed`);
  }
}

const CROUCH = 0.35;   // a crouch sinks the hips by this share of their standing height
const ROLL = 80 * DEG; // lying on the side: the trunk rolled this far onto its left flank (not quite flat: the hips stay a little propped)

/**
 * Lying on the side: the trunk rolled onto its left flank about its own line and settled until it rests on the ground
 * at half its thickness. The legs lie loose, out to the side as the roll carries them, drawn a fifth of the way in
 * toward their roots (relaxed joints), each knee bending in its own plane as the body carries it, nothing below ground.
 */
function side(ctx, pivot0) {
  const { spine, girth, limbs, byId } = ctx;
  const R = rotY(-ROLL), z0 = spine[0].head[2], pivot = [0, pivot0[1], z0];
  // settled until the trunk line rests at half its thickness, or higher if a girdle (the hips, the shoulders) would
  // sink below a quarter of it (a body whose trunk is not all on its spine)
  const roots = [...spine.flatMap((b) => [b.head, b.tail]), ...Object.values(limbs).map((c) => byId[c[0]].head)];
  const low = Math.min(...roots.map((q) => add(pivot, mv(R, sub(q, pivot)))[2]));
  const T = [0, 0, Math.max(0.5 * girth - z0, 0.25 * girth - low)];
  const carried = (q) => add(add(pivot, mv(R, sub(q, pivot))), T);
  return {
    R, pivot, T, lying: true,
    feet: (key, bones, H) => {
      const k0 = blockStart(bones), top = bones[k0].head, root = H[bones[0].id];
      const at = add(root, mul(sub(carried(top), root), 0.8));
      const below = (id) => ctx.S.bones.filter((x) => x.parent === id).flatMap((x) => [x, ...below(x.id)]);
      const foot = k0 > 0 ? below(bones[k0 - 1].id) : bones.slice(k0);
      const lowest = Math.min(...foot.flatMap((b) => [mv(R, sub(b.head, top))[2], mv(R, sub(b.tail, top))[2]]));
      if (at[2] + lowest < 0.005) at[2] = 0.005 - lowest;
      // the knee's rest bend, carried by the roll
      const k = bones[0], line = unit(sub(bones[1].tail, k.head)), kv = sub(k.tail, k.head);
      return { top: at, R, bend: mv(R, sub(kv, mul(line, kv[0] * line[0] + kv[1] * line[1] + kv[2] * line[2]))) };
    },
  };
}

/** A foot block where it stands at rest. */
function restBlock(bones) {
  const k0 = blockStart(bones);
  return { top: bones[k0].head, R: I3 };
}

/** A resting hind hoof: the block tipped forward about its toe by `a`, the toe set `fwd` ahead on the ground. */
function onToe(bones, fwd, a) {
  const k0 = blockStart(bones), top = bones[k0].head, tip = bones[bones.length - 1].tail;
  const R = rotX(a), toe = add(tip, [0, fwd, 0]);
  return { top: sub(toe, mv(R, sub(tip, top))), R };
}

/** A foot block drawn up under the belly feathers, the toes curled back, in the frame of the trunk bone it hangs on. */
function tucked(ctx, bones, H, W) {
  const k0 = blockStart(bones), top = bones[k0].head, tip = bones[bones.length - 1].tail, root = bones[0], parent = ctx.byId[root.parent];
  const l = norm(sub(root.tail, root.head)) + norm(sub(top, root.tail));
  const at = add(root.head, [-0.3 * root.head[0], 0.15 * l, -0.45 * l]);
  const Wp = W[parent.id];
  return { top: add(H[parent.id], mv(Wp, sub(at, parent.head))), R: mm(Wp, between(unit(sub(tip, top)), unit([0, -0.6, -0.5]))) };
}

/**
 * Legs folded under a lying body, in the frame of the trunk bone each leg hangs on. Hoofed and padded forelegs fold at
 * the wrist, the forearm down to the ground and the cannon or paw tucked back under the chest (`sphinx`: the forearms
 * lie forward instead, paws out in front); hind legs fold at the hock, the hock on the ground beside the rump and the
 * shank lying forward under the belly; a bird sits down over its toes. A curled body's forelegs lie forward as a
 * sphinx's do, along the curve of the trunk they hang on.
 */
function folded(ctx, word, key, bones, H, W) {
  const { byId } = ctx;
  const k0 = blockStart(bones), top = bones[k0].head, tip = bones[bones.length - 1].tail, root = bones[0];
  const parent = byId[root.parent];
  const l1 = norm(sub(root.tail, root.head)), l2 = k0 > 1 ? norm(sub(bones[1].tail, bones[1].head)) : 0, lb = norm(sub(tip, top));
  const fore = key.endsWith('F'), side = key.startsWith('R') ? 1 : -1;
  let at, dir;   // the block's top on the ground (rest frame of the parent bone) and the way the block lies
  if (word === 'sit_bird') { at = [root.head[0] * 0.9, root.head[1] - 0.05 * (l1 + l2), 0]; dir = [0, 1, -0.2]; }
  else if (fore && (word === 'sphinx' || word === 'curl')) { at = [root.head[0], root.head[1] + 0.75 * (l1 + l2), 0]; dir = [0, 1, -0.05]; }
  else if (fore) { at = [root.head[0] * 0.85, root.tail[1] + 0.25 * l2, 0]; dir = [-0.1 * side, -1, -0.1]; }
  else { at = [root.head[0] * 1.25 + side * 0.15 * lb, root.head[1] - 0.2 * (l1 + l2), 0]; dir = [-0.25 * side, 1, -0.1]; }
  // into the world through the trunk bone the leg hangs on, then down onto the ground
  const Wp = W[parent.id], Hp = H[parent.id];
  return groundBlock(ctx, bones, H, add(Hp, mv(Wp, sub(at, parent.head))), mv(Wp, dir));
}

/**
 * A foot block laid on the ground at world point `at` (its x, y), lying along world direction `dir`: the whole foot
 * rests on the ground (the block and the toes that ride with it, everything below the bone above it), and the leg
 * folds no tighter than its two bones allow (closer in than |l1 − l2| the block slides out along the ground).
 */
function groundBlock(ctx, bones, H, at, dir) {
  const k0 = blockStart(bones), top = bones[k0].head, tip = bones[bones.length - 1].tail, root = bones[0];
  const l1 = norm(sub(root.tail, root.head)), l2 = k0 > 1 ? norm(sub(bones[1].tail, bones[1].head)) : 0;
  const R = between(unit(sub(tip, top)), unit(dir));
  const below = (id) => ctx.S.bones.filter((x) => x.parent === id).flatMap((x) => [x, ...below(x.id)]);
  const foot = k0 > 0 ? below(bones[k0 - 1].id) : bones.slice(k0);
  const lowest = Math.min(...foot.flatMap((b) => [mv(R, sub(b.head, top))[2], mv(R, sub(b.tail, top))[2]]));
  const spot = [at[0], at[1], Math.max(0, -lowest) + 0.005];
  const root0 = H[root.id], near = k0 > 1 ? Math.abs(l1 - l2) * 1.03 : 0, away = unit([spot[0] - root0[0], spot[1] - root0[1], 0]);
  for (let i = 0; i < 40 && norm(sub(spot, root0)) < near; i++) { spot[0] += away[0] * 0.05 * near; spot[1] += away[1] * 0.05 * near; }
  return { top: spot, R };
}

/** The angle of the trunk from the horizontal at rest (rump to shoulders), and the hind legs' reach (thigh + shank). */
function trunkAngle(ctx) {
  const { spine } = ctx, a = spine[0].head, b = spine[spine.length - 1].tail;
  return Math.atan2(b[2] - a[2], b[1] - a[1]);
}

const SIT = 60 * DEG, REAR = 78 * DEG;

/**
 * Upright on the hind legs: the trunk pitched up about the hips until it stands at SIT (60°) or REAR (78°) from the
 * horizontal. Sitting, the rump comes down to the ground and the hind feet lie flat out in front, the knees up; rearing,
 * the hips ride on the near-straight hind legs, the feet flat under them. The forelegs hang free in front of the chest,
 * or bring the hands up to the mouth (`to-hands`). The neck takes back most of the pitch and the face is aimed by the
 * head word (./headTurns). Needs hind legs; a body without them stands.
 */
function upright(ctx, word, r) {
  const { byId, limbs } = ctx;
  if (!limbs.RH) return null;
  const hipB = byId[limbs.RH[0]], hip = hipB.head, legs = limbs.RH.slice(0, 2).map((x) => byId[x]);
  const L = legs.reduce((m, b) => m + norm(sub(b.tail, b.head)), 0);
  const p = (word === 'sit' ? SIT : REAR) - trunkAngle(ctx), R = rotX(p), pivot = [0, hip[1], hip[2]];
  // sitting, the trunk comes down until its lowest point (the rump, once pitched up) rests on the ground; rearing, the
  // hips ride on the near-straight hind legs
  const rump = [...ctx.spine.flatMap((b) => [b.head, b.tail]), ...ctx.tail.slice(0, 1).map((b) => b.head)];   // the tail's root is the rump too
  const low = Math.min(...rump.map((q) => add(pivot, mv(R, sub(q, pivot)))[2]));
  const dz = word === 'sit' ? 0.005 * ctx.h - low : 0.9 * L - hip[2];
  return {
    R, pivot, T: [0, 0, dz], upright: p,
    feet: (key, bones, H, W) => {
      const side = key.startsWith('R') ? 1 : -1, root = H[bones[0].id];
      const k0 = blockStart(bones), La = bones.slice(0, k0).reduce((m, b) => m + norm(sub(b.tail, b.head)), 0);
      if (key.endsWith('H')) {
        const out = word === 'sit' ? 0.5 * L : 0.1 * L;
        return { ...groundBlock(ctx, bones, H, [root[0] * 1.3, root[1] + out, 0], [0.12 * side, 1, 0]), bend: [0.4 * side, 1, word === 'sit' ? 0.8 : 0.1] };
      }
      // the forelegs, off the ground: hanging in front of the chest, or the hands up at the mouth
      if (r.head === 'to-hands') {
        const muzzle = add(H.head, mv(W.head, sub(byId.head.tail, byId.head.head)));
        return { top: add(muzzle, [0.08 * side * La, -0.15 * La, -0.3 * La]), R: between(unit(sub(bones[bones.length - 1].tail, bones[k0].head)), unit([-0.3 * side, 0.3, 1])), bend: [0.3 * side, -1, -0.6] };
      }
      // hanging, unless the hand reaches the ground (a chimpanzee's long arms): then it rests on it
      const hang = add(root, [0.05 * side * La, 0.3 * La, -0.8 * La]), lb = norm(sub(bones[bones.length - 1].tail, bones[k0].head));
      if (hang[2] - lb < 0.01 * ctx.h) return { ...groundBlock(ctx, bones, H, hang, [0.1 * side, 1, -0.1]), bend: [0.3 * side, -1, -0.4] };
      return { top: hang, R: between(unit(sub(bones[bones.length - 1].tail, bones[k0].head)), unit([0, 0.35, -1])), bend: [0.3 * side, -1, -0.4] };
    },
  };
}

// ── HEAD ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Pitch a set (down < 0), shared over the neck bones, and the head's own pitch. */
const NECK_PITCH = {
  level: [0, 0], forward: [0, 0], fixed: [-8 * DEG, 4 * DEG],
  high: [24 * DEG, -10 * DEG], reach: [34 * DEG, 18 * DEG],   // `low`, `ground`, `on-paws` are solved to a height
};

function headTurns(ctx, r, body, turn) {
  const { neck } = ctx, w = r.head, n = Math.max(1, neck.length);
  const each = (a) => (neck.length ? neck.forEach((b) => turn(b.id, a(b))) : null);
  // a curled body's neck carries on the curl, whatever the head then does
  if (r.support === 'curl') { each(() => rotZ(CURL.neck / n)); turn('head', rotZ(CURL.head)); }
  // an upright trunk carries its head as a standing one does: the neck takes back most of the trunk's pitch and the
  // face is aimed level (or as the word says), not wherever the pitched trunk would point it
  if (body.upright !== undefined) {
    const face = { level: 0, forward: 0, fixed: -5, high: 18, reach: 35, low: -40, ground: -70, 'to-hands': -40 }[w];
    if (face !== undefined) { each(() => rotX(-0.75 * body.upright / n)); body.facePitch = face * DEG; return; }
  }
  if (w === 'low') { body.solveHead = 'low'; return; }
  if (NECK_PITCH[w]) { const [p, hp] = NECK_PITCH[w]; each(() => rotX(p / n)); turn('head', rotX(hp)); return; }
  if (w === 'ground' || w === 'on-paws') { body.solveHead = w; return; }
  // turned back: the neck swings round and the face points back along the body, resting on the flank or the back
  if (w === 'on-flank') { each(() => mm(rotZ(-130 * DEG / n), rotX(-15 * DEG / n))); body.face = [0.35, -1, -0.2]; return; }
  if (w === 'tucked') { each(() => mm(rotZ(150 * DEG / n), rotX(-20 * DEG / n))); body.face = [-0.25, -1, -0.15]; return; }
  if (w === 'sunk') { if (neck[0]) turn(neck[0].id, rotX(-55 * DEG)); neck.slice(1).forEach((b) => turn(b.id, rotX(70 * DEG / Math.max(1, n - 1)))); turn('head', rotX(-10 * DEG)); return; }
  if (w === 'inside') {
    if (r.support === 'curl') { body.solveHead = 'on-paws'; return; }
    each(() => mm(rotZ(150 * DEG / n), rotX(-20 * DEG / n))); body.face = [-0.25, -1, -0.15]; return;
  }
}

/** The world's horizontal side-to-side axis in the body's own frame: what a neck bends about to lower the head. */
const pitchAxis = (body) => unit(mv(transpose(body.R), [1, 0, 0]));

/** Turn the head (in its neck's frame) so the face points along world direction `want`. */
function aimHead(ctx, local, fk, W, want) {
  const { byId, neck } = ctx;
  const neckEnd = neck.length ? neck[neck.length - 1].id : byId.head.parent;
  const d = mv(W.head, unit(sub(byId.head.tail, byId.head.head))), Pt = transpose(W[neckEnd] || I3);
  local.head = mm(between(unit(mv(Pt, d)), unit(mv(Pt, want))), local.head || I3);
  fk();
}

/**
 * The neck bends down (shared over its bones, on top of any turn it already has) until the muzzle reaches a height: the
 * ground for `ground` (the face pointing down to crop), `on-paws` and `on-flank` (the head kept level, its jaw resting),
 * and half the shoulder's standing height for `low` (a dozing horse's head hangs about there). A neck
 * too short to reach (a sheep, a horse: ../capabilities.js `reach` under 1) brings the shoulders down: the trunk
 * pitches forward over the hind feet, the planted forelegs flexing under it, until the mouth reaches.
 */
function solveHeadToGround(ctx, r, local, fk, H, W, how, body) {
  const { neck, byId, h, limbs } = ctx;
  const base = Object.fromEntries([...neck.map((b) => [b.id, local[b.id] || I3]), ['head', local.head || I3]]);
  const tipZ = () => add(H.head, mv(W.head, sub(byId.head.tail, byId.head.head)))[2];
  // a cropping or hanging head is measured at the muzzle; a resting one at whichever of jaw and muzzle is lower
  const lowest = how === 'ground' || how === 'low' ? tipZ : () => Math.min(tipZ(), H.head[2]);
  const shoulder = limbs.RF ? byId[limbs.RF[0]].head[2] : h;
  const target = how === 'low' ? 0.5 * shoulder : (how === 'ground' ? 0.01 : 0.03) * h;
  // the face's pitch in the world (from the horizontal, on its own heading): down at the grass, hanging, or level
  // a lying head rests: `ground` is the chin on the ground, not the face turned down to crop
  const face = how === 'ground' && body.lying ? -5 : ({ ground: -80, low: -65 }[how] ?? -5);
  // the neck bends down about the world's horizontal axis, read in the body's frame (a body rolled onto its side
  // lowers its head by turning the neck sideways in its own frame)
  const axis = pitchAxis(body);
  const neckEnd = neck.length ? neck[neck.length - 1].id : byId.head.parent;
  const r0 = unit(sub(byId.head.tail, byId.head.head));
  const set = (a) => {
    for (const b of neck) local[b.id] = mm(base[b.id], axisAngle(axis, -a / Math.max(1, neck.length)));
    local.head = base.head; fk();
    const d = mv(W.head, r0), flat = Math.hypot(d[0], d[1]) || 1, f = face * DEG;
    const want = [d[0] / flat * Math.cos(f), d[1] / flat * Math.cos(f), Math.sin(f)];
    const Pt = transpose(W[neckEnd] || I3);
    local.head = mm(between(unit(mv(Pt, d)), unit(mv(Pt, want))), base.head);
    fk();
  };
  // the neck's best: the first angle (coarse, then bisected) whose muzzle reaches, else the angle that gets nearest
  const neckSolve = () => {
    let prev = 0, best = 0, bestZ = Infinity;
    for (let k = 0; k <= 30; k++) {
      const a = k * 5 * DEG; set(a); const z = lowest();
      if (z < bestZ) { bestZ = z; best = a; }
      if (z <= target) { let lo = prev, hi = a; for (let i = 0; i < 25; i++) { const mid = (lo + hi) / 2; set(mid); if (lowest() > target) lo = mid; else hi = mid; } set(hi); return true; }
      prev = a;
    }
    set(best); return false;
  };
  if (neckSolve() || how !== 'ground' || body.lying || !limbs.RH) return;   // a lying head stays as near as it gets
  // the shoulders come down: pitch the trunk about the hind feet (at most 20°) until the neck reaches
  const hip = byId[limbs.RH[0]].head, pivot = [0, hip[1], 0], R0 = body.R;
  const pitch = (p) => { body.R = mm(rotX(-p), R0); body.pivot = pivot; };
  let lo = 0, hi = 20 * DEG; pitch(hi);
  if (!neckSolve()) return;
  for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; pitch(mid); if (neckSolve()) hi = mid; else lo = mid; }
  pitch(hi); neckSolve();
}

/**
 * The head and neck never go through the ground: the neck pitches up (shared over its bones, on top of its turn) just
 * until no neck or head point is in it; a head too long for that (a pterosaur's crest and beak) then pitches up itself.
 */
function clearHead(ctx, local, fk, H, W, body) {
  const { neck, byId } = ctx;
  const ids = [...neck.map((b) => b.id), 'head'].filter((x) => byId[x]);
  const lowest = () => Math.min(...ids.map((x) => Math.min(H[x][2], add(H[x], mv(W[x], sub(byId[x].tail, byId[x].head)))[2])));
  if (lowest() >= 0) return;
  const lift = (bones, share) => {
    const base = Object.fromEntries(bones.map((x) => [x, local[x] || I3]));
    const axis = pitchAxis(body);
    const set = (a) => { for (const x of bones) local[x] = mm(axisAngle(axis, a * share), base[x]); fk(); };
    let lo = 0, hi = 90 * DEG; set(hi); if (lowest() < 0) return false;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; set(mid); if (lowest() < 0) lo = mid; else hi = mid; }
    set(hi); return true;
  };
  if (neck.length && lift(neck.map((b) => b.id), 1 / neck.length)) return;
  lift(['head'], 1);
}

/** A wing that would go into the ground (a sitting pterosaur's) is lifted about the body's long axis through its root. */
function clearWings(ctx, W, H) {
  const { S, byId } = ctx;
  const kids = (id) => S.bones.filter((b) => b.parent === id).flatMap((b) => [b.id, ...kids(b.id)]);
  for (const root of S.bones.filter((b) => b.role === 'wing.humerus')) {
    const sub3 = [root.id, ...kids(root.id)], side = root.id.endsWith('L') ? -1 : 1, pivot = H[root.id];
    const H0 = Object.fromEntries(sub3.map((x) => [x, H[x]])), W0 = Object.fromEntries(sub3.map((x) => [x, W[x]]));
    const tipZ = () => Math.min(...sub3.map((x) => Math.min(H[x][2], add(H[x], mv(W[x], sub(byId[x].tail, byId[x].head)))[2])));
    const set = (a) => { const R = rotY(-side * a); for (const x of sub3) { W[x] = mm(R, W0[x]); H[x] = add(pivot, mv(R, sub(H0[x], pivot))); } };
    if (tipZ() >= 0) continue;
    let lo = 0, hi = 90 * DEG; set(hi); if (tipZ() < 0) continue;
    for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; set(mid); if (tipZ() < 0) lo = mid; else hi = mid; }
    set(hi);
  }
}

// ── TAIL ────────────────────────────────────────────────────────────────────────────────────────────────────────────

function tailTurns(ctx, r, t, turn) {
  const { tail } = ctx, n = tail.length; if (!n) return;
  switch (r.tail) {
    case 'wrap': tail.forEach((b) => turn(b.id, rotZ(CURL.tail / n))); break;
    case 'flag': turn(tail[0].id, rotX(-75 * DEG)); break;
    case 'twitch': { const tip = tail[n - 1]; turn(tip.id, rotZ(18 * DEG * Math.sin(2 * TAU * t))); break; }
    case 'rattle': tail.slice(Math.floor(n / 2)).forEach((b) => turn(b.id, mm(rotX(-35 * DEG), rotZ(4 * DEG * Math.sin(8 * TAU * t))))); break;
    case 'scull': tail.forEach((b, k) => turn(b.id, rotZ(5 * DEG * Math.sin(TAU * (t - 0.15 * k))))); break;
    default: break;   // rest, level, none: as the body carries it
  }
}

// ── LOOP ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** The loops: small motions over the pose. No jaw or tongue bone yet: a chew is the head's grind, a tongue its flick. */
function loopTurns(ctx, r, t, turn) {
  const { spine, neck } = ctx, s = Math.sin(TAU * t);
  const mid = spine[Math.floor(spine.length / 2)];
  switch (r.loop) {
    case 'breathe': if (mid) turn(mid.id, rotX(0.8 * DEG * s)); break;
    case 'chew': turn('head', rotZ(4 * DEG * Math.sin(3 * TAU * t))); if (mid) turn(mid.id, rotX(0.6 * DEG * s)); break;
    case 'crop': turn('head', rotX(7 * DEG * Math.max(0, Math.sin(2 * TAU * t)))); break;
    case 'strip': if (neck.length) turn(neck[neck.length - 1].id, rotX(-6 * DEG * Math.max(0, Math.sin(2 * TAU * t)))); break;
    case 'peck': { const k = Math.max(0, Math.sin(2 * TAU * t)) ** 3; neck.forEach((b) => turn(b.id, rotX(-40 * DEG * k / Math.max(1, neck.length)))); turn('head', rotX(-25 * DEG * k)); break; }
    case 'scan': { const steps = [0, 28, 28, -24, -24, 0], u = t * steps.length, i = Math.floor(u), f = Math.min(1, (u - i) * 3), a = steps[i % steps.length] + (steps[(i + 1) % steps.length] - steps[i % steps.length]) * (f * f * (3 - 2 * f)); turn('head', rotZ(a * DEG)); break; }
    case 'tongue': turn('head', rotX(1.5 * DEG * Math.max(0, Math.sin(4 * TAU * t)))); break;
    case 'snap': turn('head', rotX(-10 * DEG * Math.max(0, Math.sin(TAU * t)) ** 4)); break;
    case 'nibble': turn('head', rotX(5 * DEG * Math.sin(2 * TAU * t))); break;   // the hands follow the mouth
    // working the meal with the cheek teeth: the head tilts to one side and tugs back, then the other
    case 'gnaw': turn('head', mm(rotY(12 * DEG * Math.sin(TAU * t)), rotX(6 * DEG * Math.max(0, Math.sin(2 * TAU * t))))); break;
    // the snout pushes forward and down through the soil, then lifts and shakes it off
    case 'root': turn('head', mm(rotX(-8 * DEG * Math.sin(TAU * t)), rotZ(5 * DEG * Math.sin(3 * TAU * t)))); break;
    // a sharp pull upward and back from the food pinned below, then down again
    case 'tear': { const k = Math.max(0, Math.sin(TAU * t)) ** 2; neck.forEach((b) => turn(b.id, rotX(25 * DEG * k / Math.max(1, neck.length)))); turn('head', rotX(15 * DEG * k)); break; }
    // gape: the mouth held open while swimming on (no jaw bone yet: the swim carries it)
    case 'sway': if (neck.length) turn(neck[0].id, rotZ(7 * DEG * s)); break;
    case 'fins': for (const b of ctx.S.bones) if (/^(pectoral|pelvic|flipper)[RL]$/.test(b.id)) turn(b.id, rotY((b.id.endsWith('L') ? -1 : 1) * 10 * DEG * Math.sin(TAU * (t + (/pelvic/.test(b.id) ? 0.25 : 0))))); break;
    default: break;   // stare: no motion; swim: the cruise
  }
}

// ── the ground under a lowered body: a tail lies along it rather than through it ────────────────────────────────────

function groundTail(ctx, W, H) {
  const { byId, tail } = ctx;
  for (const b of tail) {
    const p = byId[b.parent];
    if (/^tail\d+$/.test(p.id)) H[b.id] = add(H[p.id], mv(W[p.id], sub(p.tail, p.head)));
    const rr = sub(b.tail, b.head), l = norm(rr), d = mv(W[b.id], rr);
    if (H[b.id][2] + d[2] >= 0) continue;
    const dz = Math.max(-l, -Math.max(0, H[b.id][2])), flat = Math.hypot(d[0], d[1]) || 1, k = Math.sqrt(l * l - dz * dz) / flat;
    W[b.id] = between(unit(rr), unit([d[0] * k, d[1] * k, dz]));
  }
}

// ── SWIMMING ON: the species' own swim gait ─────────────────────────────────────────────────────────────────────────

function cruise(ctx, t) {
  const L = locomotionFor(SPECIES[ctx.id].family, ctx.id);
  const g = L.gaits.swim ? 'swim' : L.gaits.fly ? 'fly' : Object.keys(L.gaits)[0];
  ctx.gait ||= prepareGait(ctx.id);
  return poseGait(ctx.id, g, t, ctx.gait);
}

// ── LAID OUT: a legless body along a path ───────────────────────────────────────────────────────────────────────────

/**
 * A coil: the body from the tail tip outward on a flat spiral on the ground (its loops a body's thickness apart), the
 * neck and head turned back in across the top of the coils. `coil-strike`: the rear two thirds coiled, the front third
 * raised in an S, the head level and forward. Bones are laid along the path by arc length, each keeping its length.
 */
function coil(ctx, r, t) {
  const { S, byId, spine, neck, tail, girth } = ctx;
  // the axis, tail tip → head tip, as each bone's back → front
  const ax = [...[...tail].reverse(), ...spine, ...neck, byId.head].filter(Boolean);
  const pts = []; for (const b of ax) { const tw = /^tail\d+$/.test(b.id); pts.push(tw ? b.tail : b.head, tw ? b.head : b.tail); }
  const seg = []; for (let i = 0; i < ax.length; i++) seg.push(norm(sub(pts[2 * i + 1], pts[2 * i])));
  const total = seg.reduce((m, x) => m + x, 0);
  const strike = r.support === 'coil-strike', front = strike ? total / 3 : (neck.reduce((m, b) => m + norm(sub(b.tail, b.head)), 0) + norm(sub(byId.head.tail, byId.head.head)));
  const flat = total - front, gap = 1.1 * girth, r0 = 1.4 * girth, z0 = girth / 2;

  // the spiral, sampled by arc length
  const spiral = []; { let th = 0, s = 0, prev = [r0, 0, z0]; spiral.push({ s: 0, p: prev });
    while (s < flat) { th += 0.02; const rr = r0 + gap * th / TAU, p = [rr * Math.cos(th), rr * Math.sin(th), z0]; s += norm(sub(p, prev)); spiral.push({ s, p }); prev = p; } }
  const at = (s) => { for (let i = 1; i < spiral.length; i++) if (spiral[i].s >= s) { const a = spiral[i - 1], b = spiral[i], u = (s - a.s) / Math.max(1e-9, b.s - a.s); return add(a.p, mul(sub(b.p, a.p), u)); } return spiral[spiral.length - 1].p; };
  const end = at(flat), endBefore = at(Math.max(0, flat - 0.05)), outward = unit(sub(end, endBefore));

  // the front: back in across the coils (coil), or up in an S and forward (strike), swaying with the loop
  const s0 = Math.sin(TAU * t);
  const frontAt = (u) => {   // u ∈ [0, 1] along the front, from the coil's end
    const d = u * front;
    if (!strike) {
      const inward = unit([-end[0], -end[1], 0]), turnTo = unit(add(mul(outward, Math.max(0, 1 - 4 * u)), mul(inward, Math.min(1, 4 * u))));
      return add(end, [turnTo[0] * d, turnTo[1] * d, girth * Math.min(1, 3 * u)]);
    }
    // the S in the vertical plane through the coil's end, heading out: pitch from the horizontal along the front
    const PITCH = [10, 70, 85, 40, -25, -10, 0], k = u * (PITCH.length - 1), i = Math.min(PITCH.length - 2, Math.floor(k));
    let z = end[2], y = 0; const n = 24;
    for (let j = 0; j < n; j++) { const uu = (j + 0.5) / n * u, kk = uu * (PITCH.length - 1), ii = Math.min(PITCH.length - 2, Math.floor(kk)); const ph = (PITCH[ii] + (PITCH[ii + 1] - PITCH[ii]) * (kk - ii)) * DEG; z += Math.sin(ph) * d / n; y += Math.cos(ph) * d / n; }
    const sway = r.loop === 'sway' ? 0.08 * front * s0 * u : 0;
    const side = unit([-outward[1], outward[0], 0]);
    return add(add(end, mul(outward, y)), add([0, 0, z - end[2]], mul(side, sway)));
  };
  const path = (s) => (s <= flat ? at(s) : frontAt(Math.min(1, (s - flat) / front)));

  const W = {}, H = {};
  let s = 0;
  ax.forEach((b, i) => {
    const back = path(s), fwd = path(s + seg[i]); s += seg[i];
    const tw = /^tail\d+$/.test(b.id), head = tw ? fwd : back, tl = tw ? back : fwd;
    // a bone keeps its length: its far end goes along the path's chord from its near end
    H[b.id] = head; W[b.id] = between(unit(sub(b.tail, b.head)), unit(sub(tl, head)));
  });
  // the head bone keeps its level carriage at the end of the path; the tongue loop flicks it
  if (r.loop === 'tongue') W.head = mm(rotX(1.5 * DEG * Math.max(0, Math.sin(4 * TAU * t))), W.head);
  // the tail rattle: the last tail bones lifted and shaking
  if (r.tail === 'rattle' && tail.length) { const tip = tail[tail.length - 1]; W[tip.id] = mm(mm(rotZ(4 * DEG * Math.sin(8 * TAU * t)), rotX(-40 * DEG)), W[tip.id]); }
  // anything else on the body (fins, a stray limb) rides its axial parent rigidly
  for (const b of S.bones) if (!W[b.id]) { const p = byId[b.parent]; W[b.id] = W[p.id]; H[b.id] = add(H[p.id], mv(W[p.id], sub(b.head, p.head))); }
  return frame(S, W, H);
}
