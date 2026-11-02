/**
 * hero-servo — the hero's ARM AS SERVOS: each joint a degree of freedom with a hard range (the body never passes it), an
 * ease range (where it works without strain), a rest and a speed, so a solver can be written against them and a pose or
 * a clip checked against them. This module READS; it never poses. The manual manipulator's arm solver
 * (space boxer) is written against it.
 *
 *   • THE SHOULDER is a ball joint, so it is read as SWING and TWIST, not three angles: the humerus's direction in the
 *     thorax's frame as a PLANE of elevation (0 lateral, the abduction plane; 90 forward, flexion; ±180 across the body;
 *     −90 back, extension) and an ELEVATION (0 hanging, 90 level, 180 overhead), held to a swing CONE whose reach
 *     differs by plane (SHOULDER_CONE); and its AXIAL ROTATION, hero-grip.js `humeralTurn` (+ external: the forearm
 *     swung outward), read only when the elbow is bent enough to show it and the arm is short of overhead.
 *     It is read off the POSED skeleton, so it measures where the arm went whatever words put it there (the rig's
 *     `sh<S>` pitch, yaw and roll are not anatomical and are not mirrored between the sides).
 *   • THE GIRDLE: the rig's `shoulders` turn (± LIMITS.shoulders), read from the pose; its elevation and the scapula's
 *     rhythm follow the raise automatically (figure-vajra.js) and are reported, not checked.
 *   • THE ELBOW is a hinge: the rig's `elbow<S>` channel is its flexion.
 *   • THE FOREARM AND THE WRIST: as hero-grip.js's laws read them (WRIST_RANGE and WRIST_EASE, the forearm's turn its
 *     `twist`): the hand's posed frame against the forearm as the elbow carries it (anatomicalForearm), when the pose
 *     has the hand's joints (the whole rig); else the rig's `wrist<S>` channel.
 * Sources: the shoulder's cardinal planes from adult normal ranges (flexion 180, extension 60, abduction 180, horizontal
 * adduction 135 and abduction 45 at the level, rotation 70 internal and 90 external: AAOS norms), its ease from the
 * functional ranges daily tasks use (Namdari et al. 2012: flexion 121, extension 46, abduction 128, cross-body 116,
 * external 59); the planes between interpolated; the elbow's 150 from AAOS. Values marked `estimate` are this module's
 * own, to be replaced when a source is in hand. Pure and deterministic.
 */
import { rigNodesAt, handValue, boneFrames } from './station-loft-rig.js';
import { WRIST_RANGE, WRIST_EASE, humeralTurn, wristFor, anatomicalForearm } from './hero-grip.js';
import { LIMITS } from './figure-vajra.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]), unit = (a) => mul(a, 1 / (len(a) || 1));
const DEG = 180 / Math.PI;
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * DEG;
const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10 + 0);

/**
 * THE SHOULDER'S SWING CONE: per plane of elevation (degrees, −180 … 180), the highest elevation the humerus reaches
 * (hard) and works at ease, read between the rows linearly. 0 lateral (abduction), 90 forward (flexion), 135 across the
 * front (horizontal adduction past the level), ±180 straight across the body, −45 behind the shoulder line (horizontal
 * abduction), −90 back (extension), −135 behind and across (a hand behind the back).
 */
export const SHOULDER_CONE = Object.freeze([
  Object.freeze({ plane: -180, hard: 40, ease: 25, source: 'estimate' }),
  Object.freeze({ plane: -135, hard: 50, ease: 30, source: 'estimate' }),
  Object.freeze({ plane: -90, hard: 60, ease: 46, source: 'norm' }),
  Object.freeze({ plane: -45, hard: 110, ease: 80, source: 'estimate' }),
  Object.freeze({ plane: 0, hard: 180, ease: 128, source: 'norm' }),
  Object.freeze({ plane: 45, hard: 180, ease: 128, source: 'estimate' }),
  Object.freeze({ plane: 90, hard: 180, ease: 121, source: 'norm' }),
  Object.freeze({ plane: 135, hard: 140, ease: 116, source: 'norm' }),
  Object.freeze({ plane: 180, hard: 40, ease: 25, source: 'estimate' }),
]);

/**
 * THE SERVOS: per joint and degree of freedom, its hard range and ease range (degrees, the rig's signs where the rig
 * owns the channel), its rest, and its speed (degrees a second, the register's: SERVO_SPEEDS).
 */
export const SERVOS = Object.freeze({
  girdle: Object.freeze({ channel: 'shoulders', range: [-LIMITS.shoulders, LIMITS.shoulders], ease: [-15, 15], rest: 0, source: 'rig; ease estimate' }),
  shoulder: Object.freeze({ swing: SHOULDER_CONE, twist: Object.freeze({ range: [-70, 90], ease: [-50, 59], rest: 0, source: 'norm; internal ease estimate' }), readTwistAbove: 20, poleAbove: 150 }),
  elbow: Object.freeze({ channel: 'elbow', range: [0, 150], ease: [0, 135], rest: 0, source: 'norm; ease: the last 15° press the flesh (estimate)' }),
  wrist: Object.freeze({
    flex: Object.freeze({ range: WRIST_RANGE.flex, ease: WRIST_EASE.flex, rest: 0, source: 'hero-grip.js' }),
    deviation: Object.freeze({ range: WRIST_RANGE.deviation, ease: WRIST_EASE.deviation, rest: 0, source: 'hero-grip.js' }),
    twist: Object.freeze({ range: WRIST_RANGE.twist, ease: WRIST_EASE.twist, rest: 0, source: 'hero-grip.js (the forearm’s turn)' }),
  }),
});

/**
 * THE SERVOS' SPEEDS per register, degrees a second: the peaks the hero's own attacks already reach, measured off the
 * straight strikes (hero-strike.js) and the swings (hero-swing.js, the normal class) at their authored lengths on the
 * realistic male and female (`scripts/spikes/manipulator/servo-audit.mjs`), the higher of the two families. They are
 * what the clips do, not measured people. The shoulder's is its swing (the humerus's own turn) and its rotation; the
 * wrist's is the forearm's turn as the anatomy reads it (the arm's roll carries it), its flex and deviation null: no
 * clip bends the hand on its wrist (the channel is only ever held), so there is nothing to measure yet.
 */
export const SERVO_SPEEDS = Object.freeze({
  realistic: Object.freeze({ girdle: 890, shoulderSwing: 1750, shoulderTwist: 5030, elbow: 3670, wrist: Object.freeze({ flex: null, deviation: null, twist: 7010 }) }),
});

/** the cone's reach at a plane: { hard, ease } */
export function coneAt(plane) {
  const C = SHOULDER_CONE; let p = ((plane + 180) % 360 + 360) % 360 - 180;
  for (let i = 0; i < C.length - 1; i++) {
    const a = C[i], b = C[i + 1];
    if (p >= a.plane && p <= b.plane) { const f = (p - a.plane) / (b.plane - a.plane); return { hard: a.hard + (b.hard - a.hard) * f, ease: a.ease + (b.ease - a.ease) * f }; }
  }
  return { hard: C[0].hard, ease: C[0].ease };
}

/**
 * The thorax's frame on a posed skeleton: `up` (the navel to the neck's base), `right` (the girdle's line, the left
 * girdle point to the right, square to up), `fwd` (up × right).
 */
export function thoraxFrame(n) {
  const up = unit(sub(n.neckHub, n.navel));
  const line = n.girdleR && n.girdleL ? sub(n.girdleR, n.girdleL) : sub(n.shoulderR, n.shoulderL);
  const right = unit(sub(line, mul(up, dot(line, up))));
  return { up, right, fwd: cross(up, right) };
}

/**
 * The shoulder of side S read off a posed skeleton `n`: { plane, elevation, twist, lateral, humerus } — degrees; the
 * plane is null near the hanging pole (elevation under 2°), the twist null when the elbow is bent less than
 * SERVOS.shoulder.readTwistAbove (the forearm's line shows no turn) or the arm is near overhead (past poleAbove: the
 * shortest swing from hanging, undefined straight up, wraps the reading round ±180 as it nears it).
 */
export function shoulderAngles(n, S, elbowFlex = null) {
  const T = thoraxFrame(n), lat = S === 'R' ? T.right : mul(T.right, -1);
  const h = unit(sub(n[`elbow${S}`], n[`shoulder${S}`]));
  const elevation = angle(mul(T.up, -1), h);
  const plane = elevation < 2 ? null : Math.atan2(dot(h, T.fwd), dot(h, lat)) * DEG;
  const fore = sub(n[`wrist${S}`], n[`elbow${S}`]);
  const bent = elbowFlex ?? angle(h, fore);
  // (hero-grip.js humeralTurn: the elbow's hinge against the shoulder line carried from the hanging arm by the shortest
  // swing; + outward, external rotation)
  const twist = bent >= SERVOS.shoulder.readTwistAbove && elevation <= SERVOS.shoulder.poleAbove ? humeralTurn(n, S) : null;
  return { plane: r1(plane), elevation: r1(elevation), twist: r1(twist), humerus: h };
}

const scalar = (v, { range, ease }) => ({ value: r1(v), range: [...range], ease: [...ease], margin: r1(Math.min(v - range[0], range[1] - v)), inRange: v >= range[0] - 1e-9 && v <= range[1] + 1e-9, inEase: v >= ease[0] - 1e-9 && v <= ease[1] + 1e-9 });

/**
 * Every arm servo of a pose, read: { R: { girdle, shoulder: { swing, twist }, elbow, wrist: { flex, deviation, twist },
 * girdleRise, hand (handRead: null unless the hand's joints are posed) }, L: {…} }. Each entry { value, range, ease, margin (degrees to the nearer hard stop; − past it), inRange,
 * inEase }; the swing's value is its elevation against the cone at its plane. `nodes` may be passed if already posed.
 */
export function servoRead(R, pose, nodes = null) {
  const n = nodes ?? rigNodesAt(R, pose).nodes, out = {};
  for (const S of ['R', 'L']) {
    if (!n[`elbow${S}`]) continue;
    const elbowFlex = pose[`elbow${S}`] ?? 0;
    const sh = shoulderAngles(n, S, elbowFlex);
    const cone = sh.plane === null ? { hard: 180, ease: 180 } : coneAt(sh.plane);
    const swing = { plane: sh.plane, value: sh.elevation, range: [0, r1(cone.hard)], ease: [0, r1(cone.ease)], margin: r1(cone.hard - sh.elevation), inRange: sh.elevation <= cone.hard + 1e-9, inEase: sh.elevation <= cone.ease + 1e-9 };
    const twist = sh.twist === null ? null : scalar(sh.twist, SERVOS.shoulder.twist);
    // the wrist as anatomy (the hand's posed frame against the forearm as the elbow carries it: hero-grip.js's laws read
    // it so), when the hand's joints are posed; else its channel
    const hb = R.bones[R.boneIndex?.[`hand${S}`]], seen = hb && [hb.head, hb.tail, ...(hb.aux || [])].every((j) => n[j]);
    const w = seen ? wristFor(R, S, anatomicalForearm(R, n, S), boneFrames({ bones: [hb] }, R.joints, n)[0].m)
      : R.hands?.[S] ? handValue(R, `wrist${S}`, pose[`wrist${S}`] ?? 0) : { flex: 0, deviation: 0, twist: 0 };
    // the girdle's rise: the clavicle's line above the thorax's level, as the raise lifts it (read, not checked)
    const T = thoraxFrame(n), clav = n[`clavicle${S}`] ? sub(n[`shoulder${S}`], n[`clavicle${S}`]) : null;
    out[S] = {
      girdle: scalar(pose.shoulders ?? 0, SERVOS.girdle),
      shoulder: { swing, twist },
      elbow: scalar(elbowFlex, SERVOS.elbow),
      wrist: Object.fromEntries(['flex', 'deviation', 'twist'].map((k) => [k, scalar(w[k], SERVOS.wrist[k])])),
      girdleRise: clav ? r1(90 - angle(T.up, clav)) : null,
      hand: handRead(R, n, S),
    };
  }
  return out;
}

/**
 * THE HAND'S SERVOS: each joint's angle read off the posed skeleton in the hand's own frame (the hand bone's rest → posed
 * turn undone, so it reads the same wherever the arm holds the hand): degrees, + closing.
 *   finger   `mcp` (the proximal phalanx off the metacarpal's line, wrist → knuckle, in the finger's plane), `pip`, `dip`
 *            (each phalanx off the one before), `spread` (the proximal phalanx out of that plane, + away from the middle
 *            finger: the index and the middle toward the thumb)
 *   thumb    `radial` (the metacarpal off the index's metacarpal in the palm's plane: radial abduction), `palmar` (the
 *            metacarpal out of the palm's plane, + to the palm's front: palmar abduction), `mcp`, `ip`
 * Sources: the finger's knuckle flexion 90, its middle joint 100, its last joint 90 (AAOS norms; a hand at rest reads 0
 * hyperextension, a passive 30 at the knuckle an estimate), the thumb's knuckle 50 and last joint 80 (AAOS), each
 * finger's spread about 20 (AAOS's abduction; the little finger's wider, an estimate); the thumb's two root angles are
 * estimates around the rig's own rest thumb. Ease is the range less a margin where no functional range is in hand.
 */
export const HAND_SERVOS = Object.freeze({
  finger: Object.freeze({
    mcp: Object.freeze({ range: [-30, 90], ease: [-10, 80], source: 'norm; hyperextension estimate' }),
    pip: Object.freeze({ range: [-5, 105], ease: [0, 95], source: 'norm' }),
    dip: Object.freeze({ range: [-10, 90], ease: [0, 80], source: 'norm' }),
    spread: Object.freeze({ range: [-15, 25], ease: [-8, 18], source: 'norm (abduction 20); adduction past the line an estimate' }),
  }),
  little: Object.freeze({ spread: Object.freeze({ range: [-15, 35], ease: [-8, 25], source: 'estimate' }) }),
  thumb: Object.freeze({
    radial: Object.freeze({ range: [0, 75], ease: [10, 60], source: 'estimate' }),
    palmar: Object.freeze({ range: [-15, 75], ease: [-5, 60], source: 'estimate' }),
    mcp: Object.freeze({ range: [-15, 55], ease: [-5, 50], source: 'norm (50); hyperextension estimate' }),
    ip: Object.freeze({ range: [-20, 80], ease: [-10, 70], source: 'norm (80); hyperextension estimate' }),
  }),
});
const SPREAD_OF = Object.freeze({ index: 1, middle: 1, ring: -1, little: -1 });
const handFrames = new WeakMap();
/** the hand's rest frame for side S: { A (wrist → middle knuckle), V (across, toward the thumb), N (out of the palm's
 * front), hinge (the fingers' closing axis, + closing) } */
function handFrame(R, S) {
  const memo = handFrames.get(R) || {}; if (memo[S]) return memo[S];
  const J = R.joints, at = (j) => J[`${j}${S}`];
  const A = unit(sub(at('middleMcp'), at('wrist')));
  let V = sub(at('indexMcp'), at('littleMcp')); V = unit(sub(V, mul(A, dot(V, A))));
  const g = R.hands[S].digits.index, hinge = unit(g.links[0].axis ?? g.axis);
  // the palm's front: the side a finger closing about its hinge moves toward
  let N = unit(cross(A, V)); if (dot(cross(hinge, A), N) < 0) N = mul(N, -1);
  memo[S] = { A, V, N, hinge }; handFrames.set(R, memo);
  return memo[S];
}
/** the signed angle (degrees) from a to b about the unit k */
const about = (a, b, k) => Math.atan2(dot(cross(a, b), k), dot(a, b)) * DEG;
/**
 * The hand of side S read off a posed skeleton `n` (the whole rig: the hand's joints posed): { <digit>: { <joint>:
 * { value, range, ease, margin, inRange, inEase } } }, or null when the hand's joints are not there.
 */
export function handRead(R, n, S) {
  const H = R.hands?.[S], hb = R.bones[R.boneIndex?.[`hand${S}`]];
  if (!H || !hb || ![hb.head, hb.tail, ...(hb.aux || []), `indexMcp${S}`].every((j) => n[j])) return null;
  const m = boneFrames({ bones: [hb] }, R.joints, n)[0].m, back = (v) => [m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2], m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2], m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2]];
  const F = handFrame(R, S), rel = (a, b) => unit(back(sub(n[b], n[a]))), J = R.joints, out = {};
  for (const [d, g] of Object.entries(H.digits)) {
    const chain = [g.links[0].pivot, ...g.links.slice(1).map((l) => l.pivot), g.links.at(-1).joints.at(-1)];
    const seg = chain.slice(1).map((j, i) => rel(chain[i], j));
    if (d === 'thumb') {
      const meta = seg[0], inPlane = unit(sub(meta, mul(F.N, dot(meta, F.N)))), ixMeta = unit(sub(sub(J[`indexMcp${S}`], J[`wrist${S}`]), mul(F.N, dot(sub(J[`indexMcp${S}`], J[`wrist${S}`]), F.N))));
      const kAx = unit(g.links[1].axis ?? g.axis), hk = (a, b) => { const c = cross(a, b); return len(c) < 1e-9 ? kAx : (dot(c, kAx) >= 0 ? unit(c) : mul(unit(c), -1)); };
      const vals = { radial: Math.acos(Math.max(-1, Math.min(1, dot(inPlane, ixMeta)))) * DEG, palmar: Math.asin(Math.max(-1, Math.min(1, dot(meta, F.N)))) * DEG, mcp: about(seg[0], seg[1], hk(seg[0], seg[1])), ip: about(seg[1], seg[2], hk(seg[1], seg[2])) };
      // (a joint turned past straight the other way reads − : the hinge's own axis signs it)
      vals.mcp = Math.sign(dot(cross(seg[0], seg[1]), kAx) || 1) * Math.abs(vals.mcp); vals.ip = Math.sign(dot(cross(seg[1], seg[2]), kAx) || 1) * Math.abs(vals.ip);
      out[d] = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, scalar(v, HAND_SERVOS.thumb[k])]));
      continue;
    }
    // the metacarpal's line (the wrist to the knuckle), the finger's plane through it and the hinge
    const meta = rel(`wrist${S}`, g.links[0].pivot), h = F.hinge;
    const p = seg[0], pIn = unit(sub(p, mul(h, dot(p, h))));
    const flexOf = (a, b) => about(a, b, h);
    const vals = { mcp: flexOf(unit(sub(meta, mul(h, dot(meta, h)))), pIn), pip: flexOf(seg[0], seg[1]), dip: flexOf(seg[1], seg[2]), spread: Math.asin(Math.max(-1, Math.min(1, dot(p, F.V)))) * DEG * (SPREAD_OF[d] ?? 1) };
    const sv = { ...HAND_SERVOS.finger, ...(HAND_SERVOS[d] || {}) };
    out[d] = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, scalar(v, sv[k])]));
  }
  return out;
}

/** the servos as flat paths for a side's read (`shoulder.swing`, `wrist.flex`, …) */
const PATHS = ['girdle', 'shoulder.swing', 'shoulder.twist', 'elbow', 'wrist.flex', 'wrist.deviation', 'wrist.twist'];
const at = (o, p) => p.split('.').reduce((x, k) => x?.[k], o);

/**
 * A CLIP checked against the servos: `clip.fn(t)` a pose for t in 0 … 1, `seconds` its length, sampled `samples` times.
 * → { sides: { R: { <path>: { min, max, worstMargin, outOfRange (frames), outOfEase (share of frames read), peakSpeed
 * (deg/s) } , swingSpeed (the humerus's own turn, deg/s) }, L }, frames }. The shoulder's swing speed is the humerus's
 * direction turning (plane and elevation are poor coordinates near the pole). Advisory: nothing refuses.
 */
export function servoReport(R, clip, { seconds = 1, samples = 40 } = {}) {
  const reads = [], hum = { R: [], L: [] };
  for (let i = 0; i <= samples; i++) {
    const pose = clip.fn(i / samples), n = rigNodesAt(R, pose).nodes, rd = servoRead(R, pose, n);
    reads.push(rd);
    for (const S of Object.keys(rd)) hum[S].push(unit(sub(n[`elbow${S}`], n[`shoulder${S}`])));
  }
  const dt = seconds / samples, sides = {};
  for (const S of Object.keys(reads[0])) {
    const s = {};
    for (const p of PATHS) {
      const xs = reads.map((r) => at(r[S], p)), seen = xs.filter(Boolean);
      if (!seen.length) { s[p] = null; continue; }
      let peak = 0;
      // (a reading that wraps round ±180 between frames turns the short way)
      for (let i = 1; i < xs.length; i++) if (xs[i] && xs[i - 1]) peak = Math.max(peak, Math.abs((((xs[i].value - xs[i - 1].value) % 360) + 540) % 360 - 180) / dt);
      s[p] = { min: r1(Math.min(...seen.map((x) => x.value))), max: r1(Math.max(...seen.map((x) => x.value))), worstMargin: r1(Math.min(...seen.map((x) => x.margin))), outOfRange: seen.filter((x) => !x.inRange).length, outOfEase: r1(seen.filter((x) => !x.inEase).length / seen.length * 100) / 100, read: seen.length, peakSpeed: r1(p === 'shoulder.swing' ? null : peak) };
    }
    let sw = 0; for (let i = 1; i < hum[S].length; i++) sw = Math.max(sw, angle(hum[S][i - 1], hum[S][i]) / dt);
    s.swingSpeed = r1(sw);
    sides[S] = s;
  }
  return { sides, frames: samples + 1, seconds };
}
