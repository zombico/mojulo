/**
 * versus react — how a body takes what happens to it: the reactions library (a page module: both pages pose with it).
 *
 * The sim records what a body is reacting to (versus-core.js `rx`: the kind, where it landed, how hard, a counter)
 * and how long the state lasts (the stun left, the time down, the rise); this turns that into a pose, as a TIMED CLIP:
 * keyframes over the state's own length, each eased, the impact fast and the recovery slow. The poses are the fight's
 * words (versus-rig.js: segment angles in the plane) and the round body's (pitch, twist, spin, bank, lie). The sim's
 * boxes never read them: a reacting body is hurt where its stance's boxes are.
 *
 *   hit     high: the head snaps back, the arms fly; body: the trunk folds over the blow; low: a knee buckles;
 *           crouching: the shoulders jolt back; heavier, and a counter, go further and hold longer
 *   crush   a guard broken open: blown back, then a stagger that sways until it recovers
 *   block   rocked back into the guard, held, then out
 *   fall    by what put it in the air: launched (tumbling back, arms flung), knocked down (jack-knifed), swept (the legs
 *           taken out, onto its back fast), hit in the air (limp), thrown (turned over), burst away, knocked out
 *   down    the landing (a slam, a bounce), lying, then in its last third rolling onto a side and pushing up to a knee
 *   rise    from the knee to the guard; tech: a hop back out of a broken throw; thrown: held, struggling
 *
 *   reactionPose(p, rules, own?) → a pose, or null for a state that is not a reaction (`own`: the fighter's guard and
 *                                  crouch, its tradition's, that the hits, blocks and rising come home to)
 *
 * Pure, no dice.
 */
/* (inlined after versus-rig.js and versus-library.js: POSES, lerpPose) */
import { lerpPose } from './versus-rig.js';
import { POSES } from './versus-library.js';

const rxPose = (base, over = {}) => ({ ...base, ...over });
const GUARD = POSES.guard, CROUCH = POSES.crouch;
// lying on the back is a standing body turned onto it (pitch -90): authored upright, as it would stand
const LIE = { torso: 0, head: 12, armF: [25, 40], armB: [-25, -10], legF: [12, -6, 95], legB: [4, -16, 90], pitch: -90, lie: true };

// ease in and out, and an impact's fast attack (most of the move in the first part of the span)
const smooth = (u) => u * u * (3 - 2 * u);
const snap = (u) => 1 - (1 - u) ** 3;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** A clip at t (0 … 1 of its span): keys [[t, pose, ease?]], each span eased by the key it arrives at. */
export function clipAt(keys, t) {
  const u = clamp01(t);
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, pose, ease] = keys[i];
    if (u <= t1) {
      const [t0, from] = keys[i - 1];
      const f = t1 > t0 ? (u - t0) / (t1 - t0) : 1;
      return lerpPose(from, pose, (ease === 'snap' ? snap : smooth)(f));
    }
  }
  return keys[keys.length - 1][1];
}

// ── hits: an impact pose, struck fast, held, then home ───────────────────────────────────────────────────────

export const HIT_PEAKS = {
  high: rxPose(GUARD, { torso: -20, head: -45, armF: [12, 60], armB: [-28, 35], legF: [10, 0, 95], legB: [-24, -14, 80], hip: [-70, 0], twist: -10 }),
  body: rxPose(GUARD, { torso: 42, head: 32, armF: [22, 98], armB: [8, 104], legF: [26, -12, 90], legB: [-12, -30, 76], hip: [-50, -40] }),
  low: rxPose(GUARD, { torso: 22, head: 10, armF: [58, 118], armB: [-34, 26], legF: [6, -48, 70], legB: [-26, -26, 74], hip: [-30, -70] }),
  crouch: rxPose(CROUCH, { torso: -6, head: -32, armF: [-6, 58], armB: [-30, 28], hip: [-40, 0] }),
};
const HIT_HOME = { high: GUARD, body: GUARD, low: GUARD, crouch: CROUCH };
// (a fighter's own guard and crouch, when it stands its tradition's: the reactions come home to them)
const homeOf = (where, own) => (where === 'crouch' ? own?.crouch : own?.guard) ?? HIT_HOME[where];
// how far a blow carries the body (light, medium, heavy), and how much more a counter does
const HIT_AMP = [0.7, 1, 1.25], COUNTER_AMP = 0.25;

// the impact is struck at once and held through the hit's freeze (the pause the sim holds a hit for), then it gives
function hitClip(where, amp, hold, own) {
  const home = homeOf(where, own), peak = lerpPose(home, HIT_PEAKS[where], amp);
  return [[0, peak], [hold, lerpPose(home, peak, 0.85)], [1, home]];
}

// ── a guard broken open: blown back, then swaying until it recovers ─────────────────────────────────────────

const CRUSHED = rxPose(GUARD, { torso: -28, head: -35, armF: [112, 150], armB: [-62, -20], legF: [30, 15, 100], legB: [-36, -20, 70], hip: [-80, 0] });
const SWAY = (s) => rxPose(POSES.walkA, { torso: 6, head: -16, armF: [2, 22], armB: [-10, 16], twist: 12 * s, hip: [-20 * s, -30] });
export const CRUSH_CLIP = [[0, CRUSHED], [0.15, CRUSHED], [0.35, SWAY(1)], [0.55, SWAY(-1)], [0.75, SWAY(0.6)], [1, GUARD]];

// ── block: rocked back into the guard, held, then out ───────────────────────────────────────────────────────

const blockClip = (low, amp, own) => {
  const guard = low ? POSES.blockLow : POSES.blockHigh, home = homeOf(low ? 'crouch' : 'high', own);
  const rocked = rxPose(guard, { torso: guard.torso - 12 * amp, head: (guard.head ?? 0) - 10 * amp, hip: [-40 * amp, 0] });
  return [[0, rocked], [0.25, guard], [0.85, guard], [1, home]];
};

// ── in the air: by what put it there; the turn grows with the frames aloft ──────────────────────────────────

export const FALLS = {
  launch: { pose: { torso: 0, head: -30, armF: [150, 160], armB: [170, 175], legF: [40, 20, 110], legB: [20, 0, 100] }, turn: -3.5, most: -105 },
  down: { pose: { torso: -40, head: -50, armF: [120, 140], armB: [150, 160], legF: [60, 40, 110], legB: [40, 30, 100] }, turn: -4, most: -80 },
  sweep: { pose: { torso: -20, head: 12, armF: [-40, -10], armB: [-60, -30], legF: [95, 95, 160], legB: [80, 80, 150] }, turn: -6, most: -70 },
  air: { pose: { torso: -30, head: -40, armF: [140, 150], armB: [160, 170], legF: [50, -20, 90], legB: [30, -40, 80] }, turn: -3, most: -60 },
  throw: { pose: { torso: 5, head: -25, armF: [140, 150], armB: [160, 168], legF: [50, 20, 110], legB: [35, 0, 100] }, turn: -8, most: -120 },
  blown: { pose: { torso: -35, head: -45, armF: [130, 150], armB: [150, 165], legF: [55, 30, 110], legB: [35, 20, 100] }, turn: -3, most: -60 },
  ko: { pose: { torso: -45, head: -60, armF: [135, 120], armB: [160, 140], legF: [55, 45, 110], legB: [35, 30, 100] }, turn: -2.5, most: -85 },
};
// a body in the air rests its lowest point on the sim's height (as one lying rests it on the floor), so it comes down
// onto the floor where it lands
function fallPose(kind, sf) {
  const F = FALLS[kind] ?? FALLS.down;
  return { ...F.pose, pitch: Math.max(F.most, F.turn * sf), air: true, lie: true };
}

// ── down, up ────────────────────────────────────────────────────────────────────────────────────────────────

const ROLLED = rxPose(LIE, { legF: [70, -40, 90], legB: [60, -70, 80], armB: [-70, -50], armF: [40, 90], pitch: -55, bank: 30, head: 30 });
const KNEEL = { torso: 24, head: 5, armF: [42, 120], armB: [20, 148], legF: [82, -20, 90], legB: [-12, -100, 30], hip: [0, 0] };
export const DOWN_CLIP = [
  [0, rxPose(LIE, { pitch: -95, legF: [40, 10, 110], legB: [30, 0, 100] })],
  [0.1, rxPose(LIE, { pitch: -98, head: -8 }), 'snap'],              // the slam
  [0.2, rxPose(LIE, { pitch: -84, head: 20, legF: [24, 4, 100] })],   // the bounce
  [0.32, LIE, 'snap'],
  [0.5, rxPose(LIE, { head: 16 })],
  [0.75, ROLLED],
  [1, rxPose(KNEEL, { lie: false })],
];
const LIMP = rxPose(LIE, { head: -10, armF: [100, 120], armB: [-120, -100], legF: [20, 10, 100], legB: [-6, -10, 80] });
export const RISE_CLIP = [[0, KNEEL], [1, GUARD]];
export const TECH_CLIP = [[0, CROUCH], [0.45, POSES.backdash, 'snap'], [1, GUARD]];
const HELD = (s) => rxPose(GUARD, { torso: 26, head: 22, armF: [72, 112], armB: [42, 100], legF: [10, 0, 100], legB: [-12, -10, 92], hip: [60, 30], twist: 8 * s });
export const HELD_CLIP = [[0, HELD(1)], [0.5, HELD(-1)], [1, HELD(1)]];

/** The pose a reacting body is in (a state of being acted on), or null for any other. */
export function reactionPose(p, rules = {}, own = null) {
  const r = p.rx || { k: 'hit', h: 1, w: 1, c: 0 };
  // how far through the stun (the frames gone over the frames gone and left)
  const stunT = () => p.sf / Math.max(1, p.sf + p.stun);
  switch (p.st) {
    case 'hit': {
      if (r.k === 'crush') return clipAt(CRUSH_CLIP, stunT());
      const where = p.low ? 'crouch' : r.h === 0 ? 'high' : r.h === 2 ? 'low' : 'body';
      const amp = HIT_AMP[r.w ?? 1] + (r.c ? COUNTER_AMP : 0);
      return clipAt(hitClip(where, amp, r.c ? 0.45 : 0.25 + 0.05 * (r.w ?? 1), own), stunT());
    }
    case 'block': return clipAt(blockClip(!!p.low, HIT_AMP[r.w ?? 1], own), stunT());
    case 'fall': return fallPose(p.ko ? 'ko' : r.k, p.sf);
    case 'ko': return p.y > 0 ? fallPose('ko', p.sf + 20) : LIMP;   // (ko lies as it fell: rigJoints rests it)
    case 'down': return clipAt(DOWN_CLIP, p.sf / Math.max(1, rules.down ?? 36));
    case 'rise': return clipAt(own?.guard ? [RISE_CLIP[0], [1, own.guard]] : RISE_CLIP, p.sf / Math.max(1, rules.rise ?? 10));
    case 'tech': return clipAt(TECH_CLIP, p.sf / 14);
    case 'thrown': return clipAt(HELD_CLIP, (p.sf % 24) / 24);
    default: return null;
  }
}
