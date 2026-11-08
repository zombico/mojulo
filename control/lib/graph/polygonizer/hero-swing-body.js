// hero-swing-body — a swing carried by the whole body (hero-swing.js's keys, a body layer over them): its own module, so
// a page that carries the swing's source (the contest's) carries none of it. Pure: the rig's own pose solve is handed in.
/**
 * THE FULL-BODY SWING (`swingBody`, an action game's: a hero whose rule plays a moveset, gameworld/combos.js): the arm's
 * arc carried by the body on the strike solver's principles (hero-strike.js), on the structured core's stance (the left
 * foot forward, so the sword hand is the rear hand and a forehand cut drives through as a cross does):
 *   • THE HIPS LEAD THE CHEST. The core's `facing` turns back with the coil and starts forward at the cock while the
 *     chest (the verb's own spine twist) is still wound back, then drives through the strike ahead of it.
 *   • THE WEIGHT MOVES. Back over the rear foot through the cock, onto the lead foot through the blow (`shift`).
 *   • THE REAR FOOT PIVOTS as the hips come through: its heel up, its toe turned in on the ball.
 *   • THE OTHER HAND COUNTERS a one-handed swing: out toward the target at the cock, drawn back to the hip through the
 *     blow. A two-handed swing keeps its own (the off hand on the grip).
 *   • THE LEGS REACH. Each key sinks the body as little as lets both planted legs reach their feet on the rig
 *     (`reach`), never a stretched leg; a key no sink lets reach gives up its weight shift a step at a time.
 * A backhand (the rising cut) turns the other way. Absent, a swing is its keys as they were.
 */
const BODY_PHASES = Object.freeze({ light: ['ready', 'cock', 'strike', 'follow', 'recover'], normal: ['ready', 'coil', 'cock', 'strike', 'follow', 'recover'], heavy: ['ready', 'coil', 'cock', 'load', 'strike', 'follow', 'recover'] });
// facing (degrees, + the right shoulder forward), w (metres the weight forward), heel and pivot (the rear foot's degrees)
const BODY_TURN = Object.freeze({
  forehand: { ready: { facing: -8, w: 0 }, coil: { facing: -18, w: -0.03 }, cock: { facing: -12, w: -0.05 }, load: { facing: -14, w: -0.06 }, strike: { facing: 16, w: 0.07, heel: 22, pivot: 18 }, follow: { facing: 22, w: 0.08, heel: 28, pivot: 24 }, recover: { facing: 6, w: 0.03, heel: 8, pivot: 8 } },
  backhand: { ready: { facing: -8, w: 0 }, coil: { facing: 4, w: -0.02 }, cock: { facing: 12, w: -0.04 }, load: { facing: 14, w: -0.05 }, strike: { facing: -14, w: 0.05 }, follow: { facing: -20, w: 0.06 }, recover: { facing: -10, w: 0.02 } },
});
const BODY_OF = Object.freeze({ rising: 'backhand', backhand: 'backhand' });
// the off (left) hand of a one-handed swing, phase by phase: a forehand aims it out and pulls it home through the blow; a
// backhand the other way about
const OFF_HAND = Object.freeze({
  forehand: { coil: { shL: { yaw: -6, pitch: 40, roll: 0 }, elbowL: 35 }, cock: { shL: { yaw: -10, pitch: 55, roll: 0 }, elbowL: 25 }, load: { shL: { yaw: -10, pitch: 58, roll: 0 }, elbowL: 25 }, strike: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, follow: { shL: { yaw: 12, pitch: -15, roll: 0 }, elbowL: 100 }, recover: { shL: { yaw: 0, pitch: 10, roll: 0 }, elbowL: 70 } },
  backhand: { coil: { shL: { yaw: 6, pitch: 5, roll: 0 }, elbowL: 80 }, cock: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, load: { shL: { yaw: 10, pitch: -10, roll: 0 }, elbowL: 95 }, strike: { shL: { yaw: -14, pitch: 45, roll: 0 }, elbowL: 30 }, follow: { shL: { yaw: -16, pitch: 50, roll: 0 }, elbowL: 25 }, recover: { shL: { yaw: -4, pitch: 25, roll: 0 }, elbowL: 50 } },
});
export const SWING_BODY = Object.freeze({ phases: BODY_PHASES, turn: BODY_TURN, of: BODY_OF, offHand: OFF_HAND });
/** a pose's legs reach on the rig (a strict rig throws; a clamping one reports) */
function legsReach(R, pose, nodesAt) {
  try { const { report } = nodesAt(R, pose); return Object.values(report.legs).every((l) => !l.metaError || l.metaError < 1e-3); } catch { return false; }
}
/**
 * The keys of `word` at `cls` carried by the whole body on rig `R` (`nodesAt` the rig's own pose solve, rigNodesAt). A
 * verb whose own keys move the off hand (two hands on the grip, a shield's bash) keeps them.
 */
export function swingBody(word, cls, keys, R, nodesAt) {
  const phases = BODY_PHASES[cls] ?? BODY_PHASES.normal, side = BODY_OF[word] ?? 'forehand', T = BODY_TURN[side];
  // (a verb that moves its own off hand: its keys' left arm leaves the ready key's)
  const ownOff = keys.some((k) => JSON.stringify([k.shL, k.elbowL]) !== JSON.stringify([keys[0].shL, keys[0].elbowL]));
  return keys.map((k, i) => {
    const ph = phases[i] ?? 'recover', B = T[ph] ?? T.recover;
    const out = { ...k, facing: B.facing, ...(B.heel ? { heelR: B.heel, splayR: -B.pivot } : {}), ...(!ownOff && OFF_HAND[side][ph] ? OFF_HAND[side][ph] : {}) };
    // the weight, and the least sink the legs reach with (a strike solver's reachSink, stepped)
    for (let w = B.w; ; w = w > 0 ? Math.max(0, w - 0.02) : Math.min(0, w + 0.02)) {
      const at = { ...out, shift: { x: 0, y: Math.round(w * 1e4) / 1e4 } };
      for (let c = k.crouch ?? 0; c <= 0.45 + 1e-9; c += 0.02) {
        const pose = { ...at, crouch: Math.round(c * 1e4) / 1e4 };
        if (legsReach(R, pose, nodesAt)) return pose;
      }
      if (w === 0) return { ...out, crouch: k.crouch ?? 0 };
    }
  });
}

