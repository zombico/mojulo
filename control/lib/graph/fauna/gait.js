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
 *  - SPINE, from the footfalls: from above each girdle turns with its leading leg (`axial.yaw`) and the trunk bends
 *    between them (`axial.lateral`), a C that flips each step in a trot, none in a pace; from the side the back
 *    rounds as the legs gather and stretches as they extend (`axial.flex`), hard in a gallop or bound, none in a
 *    pronk. The body bobs with the stance legs.
 *  - WAVES (snakes, fish): a serpenoid: the heading along the body swings as a wave travelling head to tail, its
 *    amplitude from the pattern and rising from `from`, its mean held straight ahead; the axis is laid out from it.
 *  - STROKES: the pattern's limb group beats about its roots: fins and flippers flap (hind half a beat behind),
 *    paddles and kicks sweep fore and aft. WINGS are rebuilt at each instant's fold (spread on the downstroke, half
 *    folded coming up) and rolled about the body's long axis; soaring holds them spread.
 *  - HEAD steady (held level), nod (twice a stride).
 *  - TAIL: the snakes' travelling wave run down the tail from the pelvis, its root answering the spin the swinging
 *    legs give the body (TAILS: a stiff counterweight, a loose trailing tail); a planted tail props; the ground lays a
 *    tail along it rather than through it.
 */
import { faunaSkeleton } from './skeleton.js';
import { locomotionFor, PATTERNS, TAILS, TAIL_BUILDS } from './locomotion/index.js';
import { SPECIES, speciesParams, speciesPlan } from './species.js';
import { buildWing } from './wing.js';

const TAU = 2 * Math.PI;
const AXIS = /^(spine|neck|tail)\d+$|^head$/;
const ASYMMETRIC = new Set(['transverseGallop', 'rotaryGallop', 'halfBound', 'bound', 'pronk', 'saltation', 'bipedHop', 'canter']);
const MAX_FLEX = 50 * Math.PI / 180;      // whole-trunk arc at flex 1 (a cheetah)
const MAX_GIRDLE = 25 * Math.PI / 180;    // a girdle's turn with its leading leg at yaw 1
const MAX_BEND = 20 * Math.PI / 180;      // … and what the trunk's sideways bend adds to it at lateral 1 (a sprawler)
const DEG = Math.PI / 180;
const TAIL_MAX = 35 * DEG;                // the most a tail root swings to balance (a light tail cannot cancel it all)
const TAIL_STEADY = 0.4;                  // the share of the legs' spin a counterweight answers in a steady, straight gait
                                          // (the body takes the rest; turns and leaps use the tail fully: Patel et al. 2016)
const TAIL_FOLLOW = 10 * DEG;             // a trailing tail's swing with the hips (Wada et al. 1993, dogs at a walk and trot)
const PROP = 35 * DEG;                    // how far a propping tail presses its root down (the ground lays the rest)
const FLAG = 80 * DEG;                    // a flagged tail's lift

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
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const rotZ = (a) => { const c = Math.cos(a), s = Math.sin(a); return [[c, -s, 0], [s, c, 0], [0, 0, 1]]; };
const axisAngle = (k, a) => { const [x, y, z] = k, c = Math.cos(a), s = Math.sin(a), C = 1 - c; return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]]; };
/**
 * A TRAVELLING WAVE along a chain (the serpenoid): the heading at arc fraction u ∈ [0, 1] and phase t is
 * `amp · env(u) · s(t − lag·u)` — the signal `s` leaves the root and reaches the tip `lag` of a stride later. A snake
 * or a fish runs it over the whole body (s a sine); a tail runs it from the pelvis, s the spin the legs give the body.
 */
const travelling = (amp, s, lag, env) => (u, t) => amp * env(u) * s(t - lag * u);

/** A foot's fore-aft place through one stride (+ forward), at phase u of its own cycle: back along the ground for
 * `duty`, then forward through the air. */
const footDy = (u, duty, excursion) => {
  if (u < duty) return excursion * (0.5 - u / duty);
  const v = (u - duty) / (1 - duty); return excursion * (ease(v) - 0.5);
};

/** The smallest rotation taking unit a onto unit b. */
const between = (a, b) => { const c = cross(a, b), s = norm(c), d = dot(a, b); if (s < 1e-9) return d > 0 ? I3 : axisAngle(unit(cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), Math.PI); return axisAngle(mul(c, 1 / s), Math.atan2(s, d)); };

/** The limbs a pattern can drive: `{ LF, RF, LH, RH }` → the bone ids of each limb's main chain, root first. */
function limbsOf(S) {
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

/** A pattern's feet, as limb keys: a biped's `L`/`R` are its hind legs. */
const footKey = (k) => (k === 'L' ? 'LH' : k === 'R' ? 'RH' : k);

/**
 * Pose a species through `gait` at phase t. Returns `{ bones: { <id>: { head, tail, m } }, ground }` (`m` the bone's
 * absolute rest → posed rotation, rows); `ground` is how
 * far the ground has slid back (metres), for drawing the treadmill.
 */
export function poseGait(id, gaitWord, t, ctx = prepare(id)) {
  const { S, L, byId, limbs, h } = ctx;   // ctx.wing: the worn wing, rebuildable at any fold
  const g = L.gaits[gaitWord]; if (!g) throw new Error(`gait: ${id} has no gait '${gaitWord}' (has ${Object.keys(L.gaits).join(', ')})`);
  const P = PATTERNS[g.pattern], A = L.axial;
  const asym = ASYMMETRIC.has(g.pattern);
  const local = {};   // bone id → local rotation (rest frame)

  // the stride: its length, the share a foot is down, the foot's travel along the ground, and the feet that walk it
  const stride = (g.stride || 0) * h, duty = g.duty ?? 0.5, excursion = stride * duty;
  const feet = P.kind === 'feet' ? Object.entries(P.feet).filter(([fk]) => limbs[footKey(fk)] && !(g.hindOnly && fk.endsWith('F'))) : [];
  // a foot's place along the stride, −1 (back) … +1 (forward), and a pair's: right minus left (which side leads),
  // and both together (gathered under the body or stretched out)
  const reachOf = (fk, off, x) => (excursion ? footDy(frac(x - off), duty, excursion) / (excursion / 2) : 0);
  const pairOf = (end) => feet.filter(([fk]) => footKey(fk).endsWith(end));
  const lead = (end, x) => { const P2 = pairOf(end); return P2.length === 2 ? P2.reduce((m, [fk, off]) => m + (footKey(fk)[0] === 'R' ? 1 : -1) * reachOf(fk, off, x), 0) / 2 : 0; };
  const reach = (end, x) => { const P2 = pairOf(end); return P2.length ? P2.reduce((m, [fk, off]) => m + reachOf(fk, off, x), 0) / P2.length : 0; };

  // SPINE, from the footfalls (seen from above and from the side):
  //  - from ABOVE each girdle turns with its own pair of legs: the leading leg's shoulder or hip swings forward with it
  //    (`axial.yaw`, girdle rotation, lengthening the stride), and the trunk bends between the two girdles
  //    (`axial.lateral`, the sprawlers' standing wave): opposite turns in a trot bow it into a C that flips each step,
  //    the same turn in a pace bends nothing; most of the girdles' common turn is cancelled (the body's inertia and
  //    the tail hold the heading), so the trunk swings about its own middle
  //  - from the SIDE the back rounds as the legs gather (hind feet forward under the body, forefeet back) and
  //    stretches as they extend (`axial.flex`): hard in a gallop and a bound, little in a trot, none in a pronk (all
  //    four together); the spring that stores and returns the stride's energy
  const trunk = S.bones.filter((b) => /^spine\d+$/.test(b.id)), n = trunk.length;
  const fore = pairOf('F').length ? 'F' : null;
  const gatherAt = (x) => (fore ? (reach('H', x) - reach('F', x)) / 2 : reach('H', x));
  const flexWaveAt = (x) => gatherAt(x);
  const flexWave = flexWaveAt(t);
  const flex = (A.flex || 0) * MAX_FLEX * flexWave;
  const girdle = ((A.yaw || 0) * MAX_GIRDLE + (A.lateral || 0) * MAX_BEND);
  const thP = girdle * lead('H', t), thS = fore ? girdle * lead('F', t) : 0, common = 0.7 * (thP + thS) / 2;
  let prev = 0;
  trunk.forEach((b, k) => {
    const share = k === 0 ? -(n - 1) / 2 / n : 1 / n;
    // headings run linearly from the pelvis (the root, spine0) to the shoulders; each bone turns by the step
    const head = thP + (thS - thP) * (n > 1 ? k / (n - 1) : 0) - common;
    local[b.id] = mm(rotZ(head - prev), rotX(-flex * share));
    prev = head;
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
    const theta = [], wave = travelling(th0, (x) => -Math.sin(TAU * x), waves, env);   // = th0·env·sin(2π(waves·u − t))
    for (let i = 1; i < pts.length; i++) { const u = (arc[i - 1] + arc[i]) / 2 / Ltot; theta.push(wave(u, t)); }
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

  // TAIL: a short body wave hung off the pelvis — the travelling wave of the snakes and fish, run down the tail. Two
  // motions ride it, summed:
  //  - ACTIVE, by what the tail is for (TAILS). A counterweight answers the SPIN the swinging legs give the body (each
  //    foot's fore-aft travel signed by its side for the yaw, unsigned for the pitch, the back's flexion too), by an
  //    angle that shrinks as the tail's inertia outgrows the body's (a light tail cannot cancel it all). A trailing
  //    tail follows the hips' sway at a walk and trot and is braced still at the gallop (dogs: Wada et al. 1993).
  //  - PASSIVE, by what the tail is made of (TAIL_BUILDS): a damped pendulum shaken by the body's heave and the hips'
  //    sway at the stride's own frequency, so a long hair switch swings late and wide and a short muscled tail follows
  //    in step; at speed hair and fur stream up behind (drag), and a flag goes up in flight.
  // A pattern that plants the tail (the kangaroo's slow walk) presses it down through that foot's stance. The ground
  // lays a tail along it rather than through it (below).
  // the body's bob at phase x: a small dip with the stance legs, and in a flight phase (no foot down) a ballistic arc,
  // its height from the stride time: the speed that stride implies (Alexander & Jayes 1983: stride/h ≈ 2.3·Fr^0.3,
  // v = √(Fr·g·h)), the stride lasting stride ÷ v
  const bobFeet = feet;
  const bobAt = (x) => {
    const down = (y) => bobFeet.some(([, off]) => frac(y - off) < duty);
    let v = -h * 0.015 * Math.cos((asym ? 1 : 2) * TAU * x);
    if (!down(x)) {
      let a = x, b = x; const step = 1 / 720;
      while (!down(a - step) && x - a < 1) a -= step;
      while (!down(b + step) && b - x < 1) b += step;
      const Fr = Math.pow((g.stride || 1) / 2.3, 1 / 0.3);
      const T = stride / Math.sqrt(Fr * 9.81 * h);
      v += 0.5 * 9.81 * (x - a) * (b - x) * T * T;
    }
    return v;
  };
  const TM = TAILS[A.tail] || TAILS.none, TB = TAIL_BUILDS[A.tailBuild] || TAIL_BUILDS.stub, tp = ctx.tail;
  const tailBones = S.bones.filter((b) => /^tail\d+$/.test(b.id));
  const moving = A.tail !== 'none' && A.tail !== 'still' && !(A.tail === 'drive' && P.kind !== 'feet');   // a driving tail rests while fins row
  if (P.kind !== 'wave' && tailBones.length && moving) {
    const hind = feet.filter(([fk]) => footKey(fk).endsWith('H'));
    // the legs' angular momentum, as the tail must answer it: each leg's swing (its foot's travel over the leg's
    // length, an angle) times its inertia over the tail's; pitched about the hip by the leg's own length, yawed by the
    // hip's sideways offset (a leg forward on the right spins the body left)
    const legSwing = Math.atan(excursion / 2 / h);
    const legW = Object.fromEntries(feet.map(([fk]) => { const key = footKey(fk), root = byId[limbs[key][0]].head;
      return [fk, { w: (tp.legs[key[1]] || 0) / 2, arm: Math.abs(root[0]) / (0.5 * h), side: key[0] === 'R' ? 1 : -1 }]; }));
    const spin = (x, set) => {
      let yaw = 0, pitch = 0;
      for (const [fk, off] of set) { const u = footDy(frac(x - off), duty, excursion) / (excursion / 2 || 1), L = legW[fk]; yaw += L.side * L.arm * L.w * u; pitch += L.w * u; }
      return { yaw: yaw * legSwing, pitch: pitch * legSwing };
    };
    // the hips' sway as a shape (a trailing tail follows it): the hind feet's side-signed travel, normalised
    const sway = (x) => { const set = hind.length ? hind : feet; let y = 0; for (const [fk, off] of set) y += (footKey(fk)[0] === 'R' ? 1 : -1) * footDy(frac(x - off), duty, excursion);
      return excursion ? y / ((excursion / 2) * set.length) : 0; };
    const clampA = (a) => Math.max(-TAIL_MAX, Math.min(TAIL_MAX, a));
    const beat = asym ? 1 : 2, heave = (x) => (P.kind === 'stroke' ? Math.sin(TAU * x) : -Math.cos(beat * TAU * x));
    const counterweight = A.tail === 'counter' || A.tail === 'prop', braced = asym && !counterweight;
    // the stride's period (s) from the speed it implies, and the tail as a pendulum SHAKEN AT ITS ROOT (base
    // excitation): its swing against the body, per unit of the root's travel over the pendulum's length, at a drive
    // `k` times a stride is r²/√((1−r²)² + (2ζr)²), lagging atan2(2ζr, 1 − r²) (r: the drive over its own frequency).
    // Shaken slowly it rides along; shaken fast it stays put in space while the body moves under it (a squirrel's
    // brush flowing over a bound)
    const Fr = g.stride ? Math.pow(g.stride / 2.3, 1 / 0.3) : 0.3, period = g.stride ? stride / Math.sqrt(Fr * 9.81 * h) : 1;
    const Lp = Math.max(0.05, (2 / 3) * tp.swingLength), wn = Math.sqrt(9.81 / Lp), zeta = braced ? Math.max(TB.zeta, 0.7) : TB.zeta;
    const pend = (k) => { const r = (TAU * k / period) / wn, re = 1 - r * r, im = 2 * zeta * r; return { amp: Math.min(3, (r * r) / Math.hypot(re, im)), shift: Math.atan2(im, re) / (TAU * k) }; };
    const shake = pend(1), bounce = pend(beat);
    // ACTIVE: a counterweight cancels the legs' spin (and the back's flexion, by the body's inertia over the tail's);
    // a trailing tail follows the hips' sway, braced still at the gallop
    const g0 = counterweight ? TM.gain * TAIL_STEADY : 0;
    const yawSig = counterweight ? (x) => clampA(-g0 * spin(x, feet).yaw) : (x) => (braced ? 0 : -TAIL_FOLLOW * (TM.gain ? 1 : 0) * sway(x));
    const pitchSig = (x) => (counterweight ? clampA(g0 * (spin(x, feet).pitch - 0.5 * MAX_FLEX * (A.flex || 0) * flexWaveAt(x) * Math.min(2, 0.1 / Math.max(1e-3, tp.rho)))) : 0);
    const envA = (u) => 1 + (TM.whip || 0) * u, envP = (u) => 1 + TB.whip * u;
    const yawA = travelling(1, yawSig, TM.lag || 0, envA);
    const pitchA = travelling(1, pitchSig, TM.lag || 0, envA);
    // PASSIVE: the root shaken by the hips' sideways sway (~3% of hip height in a stride) and by the body's bob; the
    // free share of the tail (`passive`: a muscled tail braces most of it) swings against them, late as its pendulum says
    const free = TB.passive * (braced ? 0.4 : 1), bob0 = Array.from({ length: 24 }, (_, i) => bobAt(i / 24)).reduce((m, v) => m + v, 0) / 24;
    const clampP = (a) => Math.max(-30 * DEG, Math.min(30 * DEG, a));
    const yawP = travelling(free * shake.amp, (x) => clampP(-0.03 * h * sway(x - shake.shift) / Lp), TB.lag, envP);
    const pitchP = travelling(free * bounce.amp, (x) => (P.kind === 'feet' ? clampP(-(bobAt(x - bounce.shift) - bob0) / Lp) : clampP(0.02 * h * heave(x - bounce.shift) / Lp)), TB.lag, envP);
    // carried up: streaming at speed (drag lifts hair and fur toward the line of travel), or flagged in flight
    const lift = (TM === TAILS.flag ? (asym ? FLAG : 0) : 0) + (TB.stream ? Math.min(35 * DEG, 10 * DEG * Fr) : 0);
    const n = tailBones.length; let y0 = 0, p0 = 0;
    tailBones.forEach((b, k) => {
      const u = n > 1 ? k / (n - 1) : 0, y = yawA(u, t) + yawP(u, t), pp = pitchA(u, t) + pitchP(u, t) + lift;
      local[b.id] = mm(rotZ(y - y0), rotX(-(pp - p0)));   // each bone turns by the heading's step (rotX(−a) lifts a tail's tip)
      y0 = y; p0 = pp;
    });
  }
  // a planted tail (a fifth foot): pressed down through its stance, eased in and out
  if (P.kind === 'feet' && P.feet.tail !== undefined && tailBones.length) {
    const u = frac(t - P.feet.tail), w = u < duty ? Math.sin(Math.PI * u / duty) : 0;
    local[tailBones[0].id] = mm(rotX(PROP * w), local[tailBones[0].id] || I3);
  }

  // STROKES: the pattern's limb group beats about its roots. Wings, pectoral wings and flippers flap (a roll about
  // the body's long axis); paddles and kicks sweep fore and aft. Wings are posed apart, below, from the spread wing.
  if (P.kind === 'stroke' && P.limbs !== 'wings') {
    const group = {
      pectoral: (b) => /^(pectoral|wing\d)/.test(b.id),
      fins: (b) => /^(pectoral|pelvic)/.test(b.id),
      flippers: () => true,
      flipper: (b) => /^flipper/.test(b.id),
      fore: (b) => b.role?.startsWith('fore'),
      hind: (b) => b.role?.startsWith('hind') || /^(pelvic|paddle)/.test(b.id),
    }[P.limbs] || (() => false);
    const flap = P.limbs === 'pectoral' || P.limbs === 'flippers' || P.limbs === 'flipper';
    for (const b of S.bones) {
      if (!b.parent || AXIS.test(b.id) || !AXIS.test(b.parent) || !group(b)) continue;   // a fin or limb root, hung on the axis
      const hind = /hind|pelvic|Hind/.test(b.id) || b.role?.startsWith('hind');
      const side = b.id.endsWith('L') ? -1 : 1;
      const lag = (hind ? P.phase || 0 : 0) + (P.phase && !hind && P.limbs !== 'flippers' && side < 0 ? P.phase : 0);
      const a = (flap ? 35 : 28) * Math.PI / 180 * Math.sin(TAU * (t - lag));
      local[b.id] = flap ? rotY(-side * a) : rotX(side * a);
    }
  }

  // HEAD: nod twice a stride
  if (A.head === 'nod') local.head = rotX(5 * Math.PI / 180 * Math.sin(2 * TAU * t));

  // the body: a small dip with the stance legs, and in a flight phase (no foot down) a ballistic arc, its height from
  // the stride time: the speed that stride implies (Alexander & Jayes 1983: stride/h ≈ 2.3·Fr^0.3, v = √(Fr·g·h)),
  // the stride lasting stride ÷ v
  const bob = P.kind === 'feet' ? bobAt(t) : 0;

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
      const dy = footDy(u, duty, excursion); let dz = 0, curl = 0;
      if (u >= duty) { const v = (u - duty) / (1 - duty); dz = Math.max(0, bob) + h * (asym ? 0.12 : 0.1) * Math.sin(Math.PI * v); curl = Math.sin(Math.PI * v); }
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
  // WINGS in a wing gait: the wing rebuilt at this instant's fold (spread on the downstroke, half folded coming up),
  // rolled about the body's long axis through its root; a wing gait that does not use them leaves them folded
  const direct = new Set();
  if (ctx.wing && (g.pattern === 'wingbeat' || g.pattern === 'soar')) {
    const soar = g.pattern === 'soar' || P.still;
    const theta = soar ? 6 * Math.PI / 180 : 50 * Math.PI / 180 * Math.cos(TAU * t);
    const fold = soar ? 0 : 0.45 * Math.max(0, Math.sin(TAU * (t - 0.5)));
    for (const side of ['R', 'L']) {
      const sg = side === 'R' ? 1 : -1, root = ctx.wing.rootIn(side, H, W), R = rotY(-sg * theta);
      for (const wb of ctx.wing.at(fold, side)) {
        const id = `${wb.id}${side}`, rest = byId[id]; if (!rest) continue;
        H[id] = add(root, mv(R, wb.head));
        W[id] = mm(R, between(unit(sub(rest.tail, rest.head)), unit(sub(wb.tail, wb.head))));
        direct.add(id);
      }
    }
  }

  // branches (toes, claws, dewclaws) ride their limb parent, in tree order so a claw rides its toe
  const onLimb = new Set();
  for (const b of S.bones) {
    if (!b.parent || AXIS.test(b.id) || direct.has(b.id)) continue;
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
  // `m`: the bone's absolute rest → posed rotation (rows), what a rig pack turns into its key quaternion
  for (const b of S.bones) bones[b.id] = { head: H[b.id], tail: add(H[b.id], mv(W[b.id], sub(b.tail, b.head))), m: W[b.id] };
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
  return { S, L, byId, limbs, h, wing: wingOf(id, S, byId), tail: tailPhysics(id, S, L) };
}

/**
 * The tail as a balance organ, from the plan it is built of: `rho` its inertia about its root over the body's about
 * the body's centre, `legs` each pair's inertia about its roots over the tail's (`{ F, H }`), and `swingLength` the pendulum it swings as (its bones, and a hair switch's hair). Body and tail
 * are the parts the skeleton binds to spine / neck bones and to tail bones (hair left out: it carries little mass);
 * each ring's mass ∝ its cross-section, a tail's times its build's `core` (a bushy tail is mostly hair).
 */
function tailPhysics(id, S, L) {
  const plan = speciesPlan(id), B = TAIL_BUILDS[L.axial.tailBuild] || TAIL_BUILDS.stub, J = plan.joints;
  const area = (r) => (Array.isArray(r) ? r[0] * r[1] : r * r);
  const rings = (seg) => {
    if (seg.kind === 'segment' && J[seg.from] && J[seg.to]) {
      const a = J[seg.from], b = J[seg.to], m = seg.rMid ?? [seg.rA, seg.rB].map((r) => (Array.isArray(r) ? r : [r, r])).reduce((x, y) => x.map((v, i) => (v + y[i]) / 2));
      return [{ at: a, a: area(seg.rA) }, { at: mul(add(a, b), 0.5), a: area(m) }, { at: b, a: area(seg.rB) }];
    }
    return (seg.stations || []).map((st) => {
      if (st.r) return { at: st.at, a: area(st.r) };
      const P = Object.values(st.points), c = mul(P.reduce(add, [0, 0, 0]), 1 / P.length), R = P.reduce((m, p) => m + norm(sub(p, c)), 0) / P.length;
      return { at: c, a: R * R };
    });
  };
  const bonesOf = (b) => (typeof b === 'string' ? [b] : b.stations || [b.from, b.to]);
  const kind = (name) => { const ids = bonesOf(S.bind[name] || ''), t = ids.filter((x) => /^tail\d+$/.test(x)).length, n = ids.filter((x) => /^(spine|neck)\d+$/.test(x)).length;
    return t > n ? 'tail' : n ? 'body' : null; };
  const parts = plan.segments.filter((g) => !/Hair/.test(g.name));
  const tail = parts.filter((g) => kind(g.name) === 'tail').flatMap(rings), body = parts.filter((g) => kind(g.name) === 'body').flatMap(rings);
  const bones = S.bones.filter((b) => /^tail\d+$/.test(b.id));
  if (!tail.length || !body.length || !bones.length) return { rho: 1, legs: { F: 0, H: 0 }, swingLength: 0.3 };
  const mB = body.reduce((m, r) => m + r.a, 0), c = mul(body.reduce((m, r) => add(m, mul(r.at, r.a)), [0, 0, 0]), 1 / mB);
  const IB = body.reduce((m, r) => m + r.a * dot(sub(r.at, c), sub(r.at, c)), 0), root = bones[0].head;
  const IT = B.core * tail.reduce((m, r) => m + r.a * dot(sub(r.at, root), sub(r.at, root)), 0);
  // the legs' inertia about their own roots (each part riding a limb chain's bone, branches with their chain)
  const limbs = limbsOf(S), chainOf = {};
  for (const [key, chain] of Object.entries(limbs)) for (const b of chain) chainOf[b] = key;
  for (const b of S.bones) if (!chainOf[b.id] && chainOf[b.parent]) chainOf[b.id] = chainOf[b.parent];
  const IL = { F: 0, H: 0 };
  for (const g of plan.segments) { const b = typeof S.bind[g.name] === 'string' ? S.bind[g.name] : null, key = b && chainOf[b]; if (!key) continue;
    const hip = S.bones.find((x) => x.id === limbs[key][0]).head; IL[key[1]] += rings(g).reduce((m, r) => m + r.a * dot(sub(r.at, hip), sub(r.at, hip)), 0); }
  const hair = plan.segments.find((g) => g.name === 'tailHair');
  const hairLen = hair ? rings(hair).reduce((m, r, i, a) => m + (i ? norm(sub(r.at, a[i - 1].at)) : 0), 0) : 0;
  return { rho: IT / IB, legs: { F: IL.F / IT, H: IL.H / IT }, swingLength: bones.reduce((m, b) => m + norm(sub(b.tail, b.head)), 0) + hairLen };
}

/** The worn wing, rebuildable at any fold: bones relative to the root (scaled), and the root as the body carries it. */
function wingOf(id, S, byId) {
  const P = speciesParams(id); if (!P.wings) return null;
  const Wp = { scale: P.scale || 1, ...P.wings }, at = speciesPlan(id).joints[Wp.at || 'wingRoot'];
  const first = `${Wp.wing.arm[0].id}R`; if (!byId[first]) return null;
  const cache = new Map();
  return {
    at: (fold, side) => {
      const key = `${fold.toFixed(4)}${side}`;
      if (!cache.has(key)) cache.set(key, buildWing(Wp.wing, [0, 0, 0], fold, side).bones.map((b) => ({ id: b.id, head: mul(b.head, Wp.scale), tail: mul(b.tail, Wp.scale) })));
      return cache.get(key);
    },
    // the root joint carried by the bone the wing hangs on
    rootIn: (side, H, W) => {
      const p = byId[byId[first].parent], q = side === 'R' ? at : [-at[0], at[1], at[2]];
      return add(H[p.id], mv(W[p.id], sub(q, p.head)));
    },
  };
}

/** n evenly spaced poses of one stride. */
export function gaitFrames(id, gaitWord, n = 24) {
  const ctx = prepare(id);
  return Array.from({ length: n }, (_, i) => poseGait(id, gaitWord, i / n, ctx));
}
