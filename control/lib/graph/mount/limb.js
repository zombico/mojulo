/**
 * limb — a mount's legs solved in their own planes (y forward, z up), from the passive mechanics rather than keys
 * (reference.js MECHANICS). Pure: points in, points out, a `clamped` flag when a target lies out of the leg's reach.
 *
 * FORE  the scapula has no collarbone: it rotates on the thoracic sling about a pivot in its upper third, by a share of
 *       the limb's swing (`kS`), so the shoulder joint rides forward as the leg reaches. From the shoulder joint the
 *       humerus and the column below it (radius, knee, cannon; the knee locked straight in the stance, folded by
 *       `carpus` in the swing) solve as two links to the fetlock, the elbow behind.
 * HIND  the reciprocal apparatus flexes the hock with the stifle (`hock = c0 + k·stifle`, met softly at its floor), so
 *       femur, tibia and cannon are one degree of freedom of shape: the stifle is found by bisection for the hip to
 *       fetlock distance, the chain then turned about the hip onto the target.
 * LIMITS the elbow opens to `elbowMax`, the stifle to π − `stifleMin`: past them a target is out of reach (`clamped`).
 * DISTAL the pastern and hoof below the fetlock: in the stance the hoof is on the ground (rolling over its toe in
 *       breakover) and the fetlock is found from it; in the swing they hang from the fetlock by its flexion.
 *
 * Angles are radians, measured from +y counter-clockwise (so straight down is −π/2 and "forward" is counter-clockwise).
 */
export const DOWN = -Math.PI / 2;
export const dir = (a) => [Math.cos(a), Math.sin(a)];
export const ang = (v) => Math.atan2(v[1], v[0]);
export const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
export const mul = (a, s) => [a[0] * s, a[1] * s];
export const len = (a) => Math.hypot(a[0], a[1]);
export const rot = (v, a) => [v[0] * Math.cos(a) - v[1] * Math.sin(a), v[0] * Math.sin(a) + v[1] * Math.cos(a)];
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const acosC = (x) => Math.acos(clamp(x, -1, 1));
/** the interior angle at b of the path a → b → c */
export const interior = (a, b, c) => { const u = sub(a, b), v = sub(c, b); return acosC((u[0] * v[0] + u[1] * v[1]) / (len(u) * len(v))); };

/** A limb's swing: the angle of the girdle-to-fetlock line off straight down (+ forward), relative to the trunk. */
export const swingAngle = (from, to, pitch = 0) => ang(sub(to, from)) - DOWN - pitch;

/**
 * The foreleg. `L` = { b (pivot to shoulder joint), top (pivot to the blade's top), humerus, radius, cannon }, `rest`
 * the blade's angle standing, `swing0` the limb's swing standing, `kS` the blade's share, `pitch` the trunk's.
 */
export function solveFore({ pivot, pitch = 0, L, rest, swing0, kS, target, carpus = 0, elbowMax = 168 * Math.PI / 180 }) {
  const blade = rest + pitch + kS * (swingAngle(pivot, target, pitch) - swing0);
  const S = add(pivot, mul(dir(blade), L.b)), top = add(pivot, mul(dir(blade), -L.top));
  const d2 = Math.sqrt(L.radius ** 2 + L.cannon ** 2 + 2 * L.radius * L.cannon * Math.cos(carpus));
  const chord = sub(target, S);
  let D = len(chord), clamped = false;
  // the elbow opens to elbowMax at the most (anatomy), never dead straight
  const hi = Math.sqrt(L.humerus ** 2 + d2 ** 2 - 2 * L.humerus * d2 * Math.cos(elbowMax)), lo = Math.abs(L.humerus - d2) * 1.0001;
  if (D > hi) { D = hi; clamped = true; } else if (D < lo) { D = lo; clamped = true; }
  const A = acosC((L.humerus ** 2 + D ** 2 - d2 ** 2) / (2 * L.humerus * D));
  const E = add(S, mul(dir(ang(chord) - A), L.humerus));           // the elbow behind the chord
  const F0 = add(S, mul(dir(ang(chord)), D));
  const O = acosC((L.radius ** 2 + d2 ** 2 - L.cannon ** 2) / (2 * L.radius * d2));
  const radius = ang(sub(F0, E)) + O;                                // the forearm ahead of the knee's chord
  const C = add(E, mul(dir(radius), L.radius));
  const cannon = radius - carpus;
  const F = add(C, mul(dir(cannon), L.cannon));
  return { top, S, E, C, F, cannon, clamped, blade, angles: { blade, shoulder: interior(top, S, E), elbow: interior(S, E, C), carpus } };
}

/** the hind chain's shape at stifle flexion `s`: the hock coupled, its vector from the hip with the femur straight down */
// the hock's floor met softly (a softplus `SOFT` wide): a hard max would kink the leg's shape as it straightens
const SOFT = 4 * Math.PI / 180;
const softFloor = (x, lo) => lo + SOFT * Math.log1p(Math.exp((x - lo) / SOFT));
export function hindChain(L, c0, k, hockMin, s, hockFixed) {
  const h = hockFixed ?? softFloor(c0 + k * s, hockMin);
  const tib = DOWN - s, can = tib + h;
  const v = add(add(mul(dir(DOWN), L.femur), mul(dir(tib), L.tibia)), mul(dir(can), L.cannon));
  return { v, h };
}

/** the foreleg's reach from the shoulder joint with the knee folded by `carpus`, the elbow opened to `elbowMax` */
export function foreReach(L, carpus, elbowMax = 168 * Math.PI / 180) {
  const d2 = Math.sqrt(L.radius ** 2 + L.cannon ** 2 + 2 * L.radius * L.cannon * Math.cos(carpus));
  return Math.sqrt(L.humerus ** 2 + d2 ** 2 - 2 * L.humerus * d2 * Math.cos(elbowMax));
}

/** a target closer to `from` than Rmin eased out to it (a soft floor: the most a joint closes), blended by `w` */
export function softMinReach(from, Rmin, t, w = 1) {
  const v = sub(t, from), d = len(v), knee = 1.06 * Rmin;
  if (d >= knee || w <= 0 || d < 1e-9) return t;
  const ds = knee - (knee - Rmin) * Math.tanh((knee - d) / (knee - Rmin)) * 0.999;
  const s = add(from, mul(v, ds / d));
  return [t[0] + (s[0] - t[0]) * w, t[1] + (s[1] - t[1]) * w];
}

/**
 * A target eased onto a reach R from `from` (a soft saturation past 97 % of it: no kink), blended in by `w` ∈ [0, 1]:
 * a folding knee lifts its foot, a straightening leg reaches no further than it can.
 */
export function softReach(from, R, t, w = 1) {
  const v = sub(t, from), d = len(v), knee = 0.97 * R;
  if (d <= knee || w <= 0) return t;
  const ds = knee + (R - knee) * Math.tanh((d - knee) / (R - knee)) * 0.999;
  const s = add(from, mul(v, ds / d));
  return [t[0] + (s[0] - t[0]) * w, t[1] + (s[1] - t[1]) * w];
}

/** the hind leg's comfortable reach, hip to fetlock: the stifle opened to `sMin` flexion, the hock coupled to it */
export const hindReach = (L, c0, k, hockMin, sMin) => len(hindChain(L, c0, k, hockMin, sMin).v);

/**
 * The hind leg. `L` = { femur, tibia, cannon }; the reciprocal coupling `hock = c0 + k·stifle` (flexions, radians) held
 * at least `hockMin`; `hockFixed` (the standing solve) holds the hock instead. Bisection, a fixed 48 steps: determinate.
 */
export function solveHind({ hip, L, c0 = 0, k = 1, hockMin = 0.09, target, hockFixed, stifleMin = 10 * Math.PI / 180 }) {
  const D = len(sub(target, hip));
  let lo = stifleMin, hi = 2.6, clamped = false;   // the stifle opens to 180° − stifleMin at the most
  const dOf = (s) => len(hindChain(L, c0, k, hockMin, s, hockFixed).v);
  let s;
  if (D >= dOf(lo)) { s = lo; clamped = D > dOf(lo) * 1.0001; } else if (D <= dOf(hi)) { s = hi; clamped = true; } else {
    for (let i = 0; i < 48; i++) { const m = (lo + hi) / 2; if (dOf(m) > D) lo = m; else hi = m; }
    s = (lo + hi) / 2;
  }
  const { v, h } = hindChain(L, c0, k, hockMin, s, hockFixed);
  const turn = ang(sub(target, hip)) - ang(v);
  const fem = DOWN + turn, tib = fem - s, can = tib + h;
  const St = add(hip, mul(dir(fem), L.femur)), Ho = add(St, mul(dir(tib), L.tibia)), F = add(Ho, mul(dir(can), L.cannon));
  return { St, Ho, F, cannon: can, clamped, stifleFlex: s, hockFlex: h, angles: { femur: fem, stifle: Math.PI - s, hock: Math.PI - h } };
}

/**
 * The hoof on the ground: its coffin joint and toe / heel from the ground point `g` (the contact's centre, y) and its
 * pitch `eta` (0 flat; negative the heel lifted, rolling about the toe). `H` = { toe, heel, coffin } of the card.
 */
export function hoofOnGround(g, eta, H) {
  const mid = (H.toe + H.heel) / 2;
  const coffin0 = [g - mid, H.coffin], toe0 = [g - mid + H.toe, 0], heel0 = [g - mid + H.heel, 0];
  if (!eta) return { coffin: coffin0, toe: toe0, heel: heel0 };
  const about = (p) => add(toe0, rot(sub(p, toe0), eta));
  return { coffin: about(coffin0), toe: toe0, heel: about(heel0) };
}

/** The hoof hung from its coffin joint at pitch `eta`: its toe and heel. */
export function hoofAt(coffin, eta, H) {
  return { coffin, toe: add(coffin, rot([H.toe, -H.coffin], eta)), heel: add(coffin, rot([H.heel, -H.coffin], eta)) };
}
