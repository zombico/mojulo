/**
 * gait — a species' skeleton posed through one stride of one gait: the posed head and tail of every bone at a phase
 * t ∈ [0, 1). Pure and deterministic; the frames a stick strip draws and a rig clip will pack.
 *
 * In place (a treadmill): the body stays over the origin, the ground slides back under the planted feet.
 *  - FEET (footfall gaits): each limb whose pattern names it plants at its phase offset for `duty` of the stride,
 *    sliding back by the stance excursion (stride × hip height × duty), then swings forward lifting its foot. The two
 *    upper bones of the limb's main chain solve two-link to the foot block, bending the way the leg bends at rest;
 *    the foot block (metapodial, digits, hoof) holds its rest attitude planted, rolls about its ground contact when
 *    the leg cannot reach (the heel peeling up at the ends of the stance), and curls in the swing.
 *  - SPINE: up-and-down flexion (`axial.flex`) once a stride in the asymmetric gaits (gallop, bound, hop), lightly
 *    twice in the symmetric ones; a sideways bend (`axial.lateral`) as a standing wave for the sprawlers; the body
 *    bobs with the stance legs.
 *  - WAVES (snakes, fish): a serpenoid: the heading along the body swings as a wave travelling head to tail, its
 *    amplitude from the pattern and rising from `from`, its mean held straight ahead; the axis is laid out from it.
 *  - STROKES (fins, flippers): the paired fin or flipper bones sweep about their roots; hind half a beat behind.
 *  - HEAD steady (held level), nod (twice a stride); TAIL trails the hips with a lag, or counters them, and drags
 *    on the ground rather than sinking through it.
 * Wing beats wait for the wing bones (the rig step); a flying gait poses the body only.
 */
import { faunaSkeleton } from './skeleton.js';
import { locomotionFor, PATTERNS } from './locomotion/index.js';
import { SPECIES } from './species.js';

const TAU = 2 * Math.PI;
const AXIS = /^(spine|neck|tail)\d+$|^head$/;
const ASYMMETRIC = new Set(['transverseGallop', 'rotaryGallop', 'halfBound', 'bound', 'pronk', 'saltation', 'bipedHop', 'canter']);
const MAX_FLEX = 50 * Math.PI / 180;      // whole-trunk arc at flex 1 (a cheetah)
const MAX_LATERAL = 40 * Math.PI / 180;   // whole-trunk sideways arc at lateral 1 (a sprawler)

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (v) => Math.hypot(v[0], v[1], v[2]);
const unit = (v) => { const l = norm(v); return l > 1e-12 ? mul(v, 1 / l) : [0, 0, 0]; };
const frac = (x) => x - Math.floor(x);
const ease = (v) => 0.5 - 0.5 * Math.cos(Math.PI * v);

// 3×3 rotations as row arrays
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const mv = (A, v) => [dot(A[0], v), dot(A[1], v), dot(A[2], v)];
const rotX = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const axisAngle = (k, a) => { const [x, y, z] = k, c = Math.cos(a), s = Math.sin(a), C = 1 - c; return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]; };
/** The smallest rotation taking unit a onto unit b. */
const between = (a, b) => { const c = cross(a, b), s = norm(c), d = dot(a, b); if (s < 1e-9) return d > 0 ? I3 : axisAngle(unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), Math.PI); return axisAngle(mul(c, 1 / s), Math.atan2(s, d)); };

/** The limbs a pattern can drive: `{ LF, RF, LH, RH }` → the bone ids of each limb's main chain, root first. */
function limbsOf(S) {
  const out = {};
  for (const b of S.bones) {
    if (!b.role || !/\.(humerus|femur)$/.test(b.role)) continue;
    const key = `${b.id.endsWith('L') ? 'L' : 'R'}${b.role.startsWith('fore') ? 'F' : 'H'}`;
    const chain = [b.id];
    for (;;) { const next = S.bones.find((c) => c.parent === chain[chain.length - 1] && c.role); if (!next) break; chain.push(next.id); }
    out[key] = chain;
  }
  return out;
}

/** A pattern's feet, as limb keys: a biped's `L`/`R` are its hind legs. */
const footKey = (k) => (k === 'L' ? 'LH' : k === 'R' ? 'RH' : k);

/**
 * Pose a species through `gait` at phase t. Returns `{ bones: { <id>: { head, tail } }, ground }`: `ground` is how
 * far the ground has slid back (metres), for drawing the treadmill.
 */
export function poseGait(id, gaitWord, t, ctx = prepare(id)) {
  const { S, L, byId, limbs, h } = ctx;
  const g = L.gaits[gaitWord]; if (!g) throw new Error(`gait: ${id} has no gait '${gaitWord}' (has ${Object.keys(L.gaits).join(', ')})`);
  const P = PATTERNS[g.pattern], A = L.axial;
  const asym = ASYMMETRIC.has(g.pattern);
  const local = {};   // bone id → local rotation (rest frame)

  // SPINE: flexion and sideways bend spread over the trunk, centred so mid-back stays level
  const trunk = S.bones.filter((b) => /^spine\d+$/.test(b.id)), n = trunk.length;
  const flexWave = asym ? Math.cos(TAU * (t - 0.05)) : 0.25 * Math.cos(2 * TAU * t);
  const flex = (A.flex || 0) * MAX_FLEX * flexWave;
  const lat = A.wave === 'standing' ? (A.lateral || 0) * MAX_LATERAL * Math.sin(TAU * t) : 0;
  trunk.forEach((b, k) => {
    const share = k === 0 ? -(n - 1) / 2 / n : 1 / n;
    local[b.id] = mm(rotZ(lat * share), rotX(-flex * share));
  });

  // WAVES: a serpenoid — the heading along the body swings as a wave travelling head → tail, its mean held straight
  // ahead; the axis is laid out again from the head tip by that heading (positions, not stacked bone turns)
  const fixed = {};
  if (P.kind === 'wave') {
    const ax = [byId.head, ...S.bones.filter((b) => /^neck\d+$/.test(b.id)).reverse(), ...[...trunk].reverse(), ...S.bones.filter((b) => /^tail\d+$/.test(b.id))];
    const pts = [], who = [];   // rest points head tip → tail tip, each bone's front then back
    for (const b of ax) { const tailward = /^tail\d+$/.test(b.id); pts.push(tailward ? b.head : b.tail, tailward ? b.tail : b.head); who.push(b); }
    // straighten the rest first (a snake rests coiled): each step runs straight back, keeping its length and rise
    const straight = [pts[0]];
    for (let i = 1; i < pts.length; i++) { const d = sub(pts[i], pts[i - 1]), l = norm(d), dz = Math.max(-l, Math.min(l, d[2])); straight.push(add(straight[i - 1], [0, -Math.sqrt(l * l - dz * dz), dz])); }
    pts.splice(0, pts.length, ...straight);
    const arc = [0]; for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + norm(sub(pts[i], pts[i - 1])));
    const Ltot = arc[arc.length - 1] || 1, amp = g.amp ?? P.amp, waves = g.waves ?? P.waves, from = g.from ?? P.from;
    const th0 = Math.min(0.9, TAU * waves * amp);
    // even along the body when the whole body waves (from 0); otherwise rising from `from` to the tail
    const env = (u) => (from <= 0 ? 1 : u < from ? 0 : Math.min(1, 0.3 + 0.7 * (u - from) / Math.max(1e-6, 1 - from)));
    const theta = [];
    for (let i = 1; i < pts.length; i++) { const u = (arc[i - 1] + arc[i]) / 2 / Ltot; theta.push(th0 * env(u) * Math.sin(TAU * (waves * u - t))); }
    let mean = 0; for (let i = 1; i < pts.length; i++) mean += theta[i - 1] * (arc[i] - arc[i - 1]); mean /= Ltot;
    const R = P.plane === 'vertical' ? rotX : rotZ;
    const q = [pts[0]];
    for (let i = 1; i < pts.length; i++) q.push(add(q[i - 1], mv(R((P.plane === 'vertical' ? -1 : 1) * (theta[i - 1] - mean)), sub(pts[i], pts[i - 1]))));
    // keep the body centred where it rests
    const c0 = mul(pts.reduce(add, [0, 0, 0]), 1 / pts.length), c1 = mul(q.reduce(add, [0, 0, 0]), 1 / q.length), shift = sub(c0, c1);
    who.forEach((b, k) => {
      const tailward = /^tail\d+$/.test(b.id), front = add(q[2 * k], shift), back = add(q[2 * k + 1], shift);
      const head = tailward ? front : back, tail = tailward ? back : front;
      fixed[b.id] = { H: head, W: between(unit(sub(b.tail, b.head)), unit(sub(tail, head))) };
    });
  }

  // TAIL: a lagging wave (trail) or the hips' counter-swing (counter)
  if (P.kind !== 'wave') {
    const tailBones = S.bones.filter((b) => /^tail\d+$/.test(b.id)), tailN = Math.max(1, tailBones.length);
    tailBones.forEach((b, k) => {
      const lag = Math.sin(TAU * ((asym ? 1 : 2) * t - 0.12 * (k + 1)));
      const a = (A.tail === 'counter' ? 24 : A.tail === 'trail' ? 16 : 0) * Math.PI / 180 / tailN;   // the whole tail's swing, shared
      // a counterweight swings against the body's pitch in a bounding gait (kangaroo), against the hips' yaw in a stride
      local[b.id] = A.tail === 'counter' && asym ? rotX(a * Math.cos(TAU * t)) : mm(rotZ(A.tail === 'counter' ? -a * Math.sin(TAU * t) : 0), rotX(a * lag));
    });
  }

  // STROKES: paired fins / flippers sweep about their roots
  if (P.kind === 'stroke') {
    for (const b of S.bones) {
      if (!b.parent || AXIS.test(b.id) || !AXIS.test(b.parent)) continue;   // a fin or limb root, hung on the axis
      const hind = /hind|pelvic|Hind/.test(b.id) || b.role?.startsWith('hind');
      const side = b.id.endsWith('L') ? -1 : 1;
      const a = 28 * Math.PI / 180 * Math.sin(TAU * (t - (hind ? P.phase || 0 : 0)));
      local[b.id] = rotX(side * a);
    }
  }

  // HEAD: nod twice a stride
  if (A.head === 'nod') local.head = rotX(5 * Math.PI / 180 * Math.sin(2 * TAU * t));

  // the body: a small dip with the stance legs, and in a flight phase (no foot down) a ballistic arc, its height from
  // the stride time: the speed that stride implies (Alexander & Jayes 1983: stride/h ≈ 2.3·Fr^0.3, v = √(Fr·g·h)),
  // the stride lasting stride ÷ v
  const stride = (g.stride || 0) * h, duty = g.duty ?? 0.5, excursion = stride * duty;
  let bob = 0;
  if (P.kind === 'feet') {
    const feet = Object.entries(P.feet).filter(([fk]) => limbs[footKey(fk)] && !(g.hindOnly && fk.endsWith('F')));
    const down = (x) => feet.some(([, off]) => frac(x - off) < duty);
    bob = -h * 0.015 * Math.cos((asym ? 1 : 2) * TAU * t);
    if (!down(t)) {
      let a = t, b = t; const step = 1 / 720;
      while (!down(a - step) && t - a < 1) a -= step;
      while (!down(b + step) && b - t < 1) b += step;
      const Fr = Math.pow((g.stride || 1) / 2.3, 1 / 0.3);
      const T = stride / Math.sqrt(Fr * 9.81 * h);
      bob += 0.5 * 9.81 * (t - a) * (b - t) * T * T;
    }
  }

  // FORWARD KINEMATICS: world rotation and posed head per bone
  const W = {}, H = {};
  for (const b of S.bones) {
    if (fixed[b.id]) { W[b.id] = fixed[b.id].W; H[b.id] = fixed[b.id].H; continue; }
    const Lr = local[b.id] || I3;
    if (!b.parent) { W[b.id] = Lr; H[b.id] = add(b.head, [0, 0, bob]); continue; }
    const p = byId[b.parent];
    W[b.id] = mm(W[p.id], Lr);
    H[b.id] = add(H[p.id], mv(W[p.id], sub(b.head, p.head)));
  }
  // the head held level (steady), and a waving body's head on its heading
  if ((A.head === 'steady' || A.head === 'thrust' || A.head === 'reach') && P.kind !== 'wave') W.head = local.head || I3;

  // FEET: plant, slide, swing; two-link to the foot block
  if (P.kind === 'feet') {
    for (const [fk, off] of Object.entries(P.feet)) {
      const chain = limbs[footKey(fk)]; if (!chain || chain.length < 2 || (g.hindOnly && fk.endsWith('F'))) continue;
      const bones = chain.map((c) => byId[c]);
      const u = frac(t - off), restFoot = bones[bones.length - 1].tail;
      let dy, dz = 0, curl = 0;
      if (u < duty) dy = excursion * (0.5 - u / duty);
      else { const v = (u - duty) / (1 - duty); dy = excursion * (ease(v) - 0.5); dz = Math.max(0, bob) + h * (asym ? 0.12 : 0.1) * Math.sin(Math.PI * v); curl = Math.sin(Math.PI * v); }
      const foot = add(restFoot, [0, dy, dz]);
      // the foot block: bones from the third on (or the last alone in a two-bone limb), rigid at rest, curled in swing
      const k0 = Math.min(2, bones.length - 1);
      const block = bones.slice(k0), top = block[0].head;
      // the swing curl folds the block's far end back and up (rotX(+a) would swing it forward)
      let Rc = rotX(-curl * (bones[0].role.startsWith('fore') ? 55 : 35) * Math.PI / 180);
      let footRel = mv(Rc, sub(restFoot, top));
      let blockTop = sub(foot, footRel);
      // two-link: root → knee → blockTop, bending as at rest
      let root = H[bones[0].id]; const l1 = norm(sub(bones[0].tail, bones[0].head));
      const upper = bones.slice(0, k0), l2 = k0 > 1 ? norm(sub(bones[1].tail, bones[1].head)) : 0;
      // out of reach (the ends of a long stance): the block rolls about its ground contact, heel or pastern peeling
      // up, until the leg reaches it; the foot stays where it is planted
      const reach = (k0 > 1 ? l1 + l2 : l1) * 0.999;
      if (norm(sub(blockTop, root)) > reach) {
        const rolled = (phi) => add(foot, mv(rotX(phi), sub(blockTop, foot)));
        const sign = norm(sub(rolled(0.3), root)) < norm(sub(rolled(-0.3), root)) ? 1 : -1;
        let lo = 0, hi = sign * Math.PI / 2;
        if (norm(sub(rolled(hi), root)) <= reach) {
          for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (norm(sub(rolled(mid), root)) > reach) lo = mid; else hi = mid; }
        } else {
          // no roll reaches: roll as far as it helps, the girdle makes up the rest
          let best = 0; for (let i = 1; i <= 32; i++) { const phi = sign * (Math.PI / 2) * i / 32; if (norm(sub(rolled(phi), root)) < norm(sub(rolled(best), root))) best = phi; }
          hi = best;
        }
        Rc = mm(rotX(hi), Rc); blockTop = rolled(hi); footRel = sub(foot, blockTop);
        // still out of reach: the girdle glides toward the foot (the shoulder blade slides on the ribs, no collarbone
        // in a runner; the pelvis rocks less), up to a share of the upper bone
        const over = norm(sub(blockTop, root)) - reach;
        if (over > 0) root = add(root, mul(unit(sub(blockTop, root)), Math.min(over, (bones[0].role.startsWith('fore') ? 0.3 : 0.15) * l1)));
      }
      if (k0 > 1) {
        const d0 = sub(blockTop, root), d = Math.min(l1 + l2 - 1e-6, Math.max(Math.abs(l1 - l2) + 1e-6, norm(d0))), e = unit(d0);
        const restKnee = bones[0].tail, restLine = unit(sub(bones[1].tail, bones[0].head));
        let bend = sub(sub(restKnee, bones[0].head), mul(restLine, dot(sub(restKnee, bones[0].head), restLine)));
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
  }
  // branches (toes, claws, dewclaws) ride their limb parent, in tree order so a claw rides its toe
  const onLimb = new Set();
  for (const b of S.bones) {
    if (!b.parent || AXIS.test(b.id)) continue;
    if (b.role) { onLimb.add(b.id); continue; }
    if (!onLimb.has(b.parent)) continue;
    onLimb.add(b.id);
    const p = byId[b.parent];
    W[b.id] = mm(W[p.id], local[b.id] || I3);
    H[b.id] = add(H[p.id], mv(W[p.id], sub(b.head, p.head)));
  }

  // the ground: a tail drags along it rather than sinking (each tail bone, root first, lifted onto z = 0)
  for (const b of S.bones) {
    if (!/^tail\d+$/.test(b.id)) continue;
    const p = byId[b.parent];
    if (/^tail\d+$/.test(p.id)) H[b.id] = add(H[p.id], mv(W[p.id], sub(p.tail, p.head)));
    const r = sub(b.tail, b.head), l = norm(r), d = mv(W[b.id], r);
    if (H[b.id][2] + d[2] >= 0) continue;
    const dz = Math.max(-l, -Math.max(0, H[b.id][2])), flat = Math.hypot(d[0], d[1]) || 1, k = Math.sqrt(l * l - dz * dz) / flat;
    W[b.id] = between(unit(r), unit([d[0] * k, d[1] * k, dz]));
  }

  const bones = {};
  for (const b of S.bones) bones[b.id] = { head: H[b.id], tail: add(H[b.id], mv(W[b.id], sub(b.tail, b.head))) };
  return { bones, ground: P.kind === 'feet' ? frac(t) * stride : 0 };
}

/** The pieces poseGait reuses across frames. */
export function prepare(id) {
  const S = faunaSkeleton(id); if (!S) throw new Error(`gait: unknown species '${id}'`);
  const L = locomotionFor(SPECIES[id].family, id);
  const byId = Object.fromEntries(S.bones.map((b) => [b.id, b]));
  const limbs = limbsOf(S);
  const hipRoot = limbs.RH?.[0] || limbs.RF?.[0];
  const h = hipRoot ? byId[hipRoot].head[2] : Math.max(...S.bones.map((b) => b.head[2]));
  return { S, L, byId, limbs, h };
}

/** n evenly spaced poses of one stride. */
export function gaitFrames(id, gaitWord, n = 24) {
  const ctx = prepare(id);
  return Array.from({ length: n }, (_, i) => poseGait(id, gaitWord, i / n, ctx));
}
