/**
 * alert — WARINESS as a dial, 0 calm … 1 on guard, and how it shows: in the blinks, in where and how the eyes look, and
 * in the face the looking moves. Fear raises it by itself (`fearOf`: a face holding fear's brows and eyes is wary
 * whatever the dial says), and a beat or an emote may set it.
 *
 *   • THE BLINKS: a wary face WATCHES: its spontaneous blinks thin (vigilance holds the eyes open), each one quicker, and
 *     more of them ride the gaze's shifts (a blink taken with a check, not while watching); a STARTLE blinks hard and
 *     fast, then the eyes fly wide and settle slowly.
 *   • THE LOOKING: the eyes dwell less, re-fixate wider and CHECK (glances off to a side or behind, larger and more
 *     often), focused on what they check (a check looks at something, a few metres off), never unfocused.
 *   • THE FACE: the upper lids raised off the iris and the brows' inner ends up and drawn together a little (fear's
 *     brow, faint), by the dial; and the look moves the face: a large saccade widens the lids for a moment, the more the
 *     warier (parts.js `lookPulses`).
 * Watching's suppression of the blink and the startle's are the psychophysiology's (vigilance, the startle reflex);
 * the numbers are tuned on the eyes gate. Pure tables and arithmetic.
 */
import { auOf } from './facs.js';

/** the dial's reach: the blinks' rate (× at 1), their length (×), the gaze-shift blink's chance (+ at 1); the eyes' dwell
 * (×), re-fixation reach (×), the checks (how often, how long, how far, focused at `distance` m); the held face at 1 */
export const ALERT = Object.freeze({
  blink: Object.freeze({ rate: 0.4, length: 0.7, shift: 0.35 }),
  eyes: Object.freeze({ dwell: 0.5, reach: 2.2, check: Object.freeze({ every: [7, 14], hold: [0.35, 0.8], reach: [9, 18], distance: 3 }), quicken: 0.6 }),
  face: Object.freeze({ AU5: 0.3, AU1: 0.22, AU2: 0.12, AU4: 0.1 }),
});
/** a STARTLE: the reflex blink (close, shut, open: s), then the eyes wide and the brows up (their heights, the rise after
 * the blink, the hold, the slow fall: s), and the alertness it leaves (a floor for the rest of the beat) */
export const STARTLE = Object.freeze({ close: 0.04, shut: 0.04, open: 0.12, widen: Object.freeze({ AU5: 0.75, AU1: 0.5, AU2: 0.45 }), rise: 0.08, hold: 0.45, fall: 1.1, leaves: 0.7 });

const clamp01 = (v) => Math.max(0, Math.min(1, v));
/** a unit's value in a state, its whole and the greater of its sides */
const unit = (S, au) => (S[au] ?? 0) + Math.max(S[`${au}L`] ?? 0, S[`${au}R`] ?? 0);

/** how much fear a face holds (0 … 1): the lids raised, fear's brow (the inner ends up AND drawn down together: AU1
 * with AU4), the lips stretched back; fear's prototype reads about 1, worry under half, surprise (no AU4) a little */
export function fearOf(S = {}) {
  return clamp01(0.5 * unit(S, 'AU5') + 0.8 * Math.min(unit(S, 'AU1'), unit(S, 'AU4')) + 0.3 * unit(S, 'AU20'));
}

/** the face a wariness adds (a FACS state) */
export const alertFace = (a) => (a > 0 ? Object.fromEntries(Object.entries(ALERT.face).map(([k, v]) => [k, +(v * a).toFixed(6)])) : {});

/** the blinks at a wariness: { rate (a minute), slow (× a blink's length: the card's own times the dial's), shift (+ the
 * chance a large gaze shift takes a blink) } */
export function alertBlink(blink, a) {
  return { ...blink, rate: blink.rate * (1 - (1 - ALERT.blink.rate) * a), slow: (blink.slow ?? 1) * (1 - (1 - ALERT.blink.length) * a), shift: ALERT.blink.shift * a };
}

/** an emote's eyes at a wariness: dwelling less, re-fixating wider, and checking (its own glances away, or the dial's),
 * focused; at nought, the eyes as they were */
export function alertEyes(eyes, a) {
  if (!(a > 0)) return eyes;
  const E = ALERT.eyes, k = (r, f) => [r[0] * f, r[1] * f];
  const away = eyes.away ?? E.check;
  return {
    ...eyes,
    ...(eyes.scan ? { scan: { ...eyes.scan, dwell: k(eyes.scan.dwell, 1 - (1 - E.dwell) * a) } } : {}),
    refix: eyes.refix ? { every: k(eyes.refix.every, 1 - (1 - E.dwell) * a), reach: k(eyes.refix.reach, 1 + (E.reach - 1) * a) } : eyes.scan ? null : { every: k([2, 4], 1 - (1 - E.dwell) * a), reach: k([1, 3], 1 + (E.reach - 1) * a) },
    away: { every: k(away.every, 1 - E.quicken * a), hold: away.hold, reach: k(away.reach, 1 + 0.5 * a), distance: E.check.distance },
  };
}

/** Error lines for a wariness dial */
export const alertErrors = (a, at = 'alert') => (a === undefined || (Number.isFinite(a) && a >= 0 && a <= 1) ? [] : [`${at}: 0 (calm) … 1 (on guard)`]);

/** a state's whole units' keys sided where the state holds them by side (a face that lifts AU2L and AU2R takes the
 * dial's AU2 on each side, never as a whole besides) */
export function addState(S, add) {
  const out = { ...S };
  for (const [k, v] of Object.entries(add)) {
    const [au] = auOf(k), sided = out[`${au}L`] !== undefined || out[`${au}R`] !== undefined;
    for (const key of sided ? [`${au}L`, `${au}R`] : [k]) out[key] = clamp01((out[key] ?? 0) + v);
  }
  return out;
}
