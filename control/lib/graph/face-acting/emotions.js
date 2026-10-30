/**
 * emotions — what an actor plays with the face, as FACS states (facs.js): the basic emotions as FACS's prototypes, and
 * the nuances a scene asks for, each the action units whose appearance together reads as it, at intensities. A face is
 * composed from them (`composeFace`):
 *
 *   • INTENSITY scales the whole (an emotion felt slightly, or at its height), each unit clamped to 1.
 *   • A BLEND is two emotions in one face, divided as FACS reads blends: the UPPER face (the brows, the eyes) carries
 *     one and the LOWER face (the mouth, the jaw) the other: bittersweet is sadness's brows over happiness's mouth.
 *   • A MASK is a felt emotion covered by a social one: the cover is on the mouth, the felt LEAKS where control is
 *     weakest, the brows and the eyes, at a share (`leak`). A polite smile over worry: no cheek raised (AU6), the inner
 *     brows still up.
 *   • ASYMMETRY leans the face to a side (`lean` −1 the figure's left … +1 its right): each sided unit split, the leaning
 *     side the stronger. Some words are one-sided by nature (contempt, wry, skeptical): their own sides stand.
 *   • An EYE LOOK (humanoid-head.js `EYE_LOOKS`) replaces the upper face: the brows, the lids, the cheek's squint.
 *
 * Artists' and FACS's readings, tuned on the eyes gate. Pure and deterministic.
 */
import { EMOTION_PROTOTYPES, FACS_UNITS, auOf } from './facs.js';
import { EYE_LOOKS } from '../polygonizer/humanoid-head.js';
import { CHANNEL_RANGES } from '../polygonizer/humanoid-head.js';

/** the nuances an actor plays, past the basic seven (each its AUs; a one-sided unit by its side) */
export const EMOTION_NUANCES = Object.freeze({
  amused: { AU6: 0.4, AU12: 0.6 },
  wry: { AU12R: 0.6, AU14R: 0.3, AU2R: 0.2 },
  skeptical: { AU2L: 0.6, AU4R: 0.4, AU14L: 0.2, AU24: 0.2 },
  worried: { AU1: 0.8, AU4: 0.4, AU20: 0.2, AU24: 0.2 },
  embarrassed: { AU12: 0.3, AU24: 0.4, AU14: 0.2, AU1: 0.2 },
  determined: { AU4: 0.6, AU7: 0.4, AU24: 0.6, AU17: 0.4 },
  tender: { AU1: 0.3, AU6: 0.3, AU12: 0.4 },
  pained: { AU4: 0.8, AU6: 0.6, AU7: 0.8, AU9: 0.4, AU10: 0.4, AU20: 0.4 },
  stifled: { AU6: 0.4, AU12: 0.4, AU17: 0.4, AU24: 0.6 },
  irritated: { AU4: 0.4, AU7: 0.4, AU24: 0.4 },
  hopeful: { AU1: 0.4, AU2: 0.4, AU12: 0.3 },
  smug: { AU12R: 0.5, AU14R: 0.3, AU2: 0.2, AU7: 0.2 },
  pensive: { AU4: 0.2, AU17: 0.3, AU24: 0.2 },
  shocked: { AU1: 1, AU2: 1, AU4: 0.4, AU5: 1, AU20: 0.4, AU26: 0.8 },
});
/** every word: the prototypes, then the nuances */
export const EMOTIONS = Object.freeze({ neutral: {}, ...EMOTION_PROTOTYPES, ...EMOTION_NUANCES });
export const EMOTION_NAMES = Object.freeze(Object.keys(EMOTIONS));

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const region = (key) => FACS_UNITS[auOf(key)[0]].region;
const UPPER = new Set(['upper', 'eyes']);
const scaled = (st, k) => Object.fromEntries(Object.entries(st).map(([a, v]) => [a, clamp01(v * k)]));
const only = (st, keep) => Object.fromEntries(Object.entries(st).filter(([a]) => keep(region(a))));
const add = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = clamp01((o[k] ?? 0) + v); return o; };

/**
 * An eye look's western channels as FACS units: the brows' raise (AU1 and AU2) or lowering (AU4), the tilt inner end up
 * (AU1) or down (AU4), the aperture wide (AU5) or narrowed (AU7), the blink (AU45), each over its range end.
 */
export function eyeLookFacs(word) {
  const L = EYE_LOOKS[word];
  if (!L) throw new Error(`emotions: '${word}' is not an eye look (have ${Object.keys(EYE_LOOKS).join(', ')})`);
  const R = CHANNEL_RANGES, st = {}, put = (k, v) => { if (v > 0) st[k] = clamp01((st[k] ?? 0) + v); };
  const raise = L.browRaise ?? 0, tilt = L.browTilt ?? 0, ap = L.aperture ?? 1;
  put('AU1', raise / R.browRaise[1]); put('AU2', raise / R.browRaise[1]); put('AU4', -raise / -R.browRaise[0]);
  put('AU1', -tilt / -R.browTilt[0]); put('AU4', tilt / R.browTilt[1]);
  put('AU5', (ap - 1) / (R.aperture[1] - 1)); put('AU7', (1 - ap) / (1 - R.aperture[0]));
  put('AU45', L.blink ?? 0);
  return Object.fromEntries(Object.entries(st).map(([k, v]) => [k, +v.toFixed(6)]));
}

/** a word's FACS state, refused by name when it is none */
export function emotionFacs(word) {
  if (!Object.hasOwn(EMOTIONS, word)) throw new Error(`emotions: '${word}' is not an emotion (have ${EMOTION_NAMES.join(', ')})`);
  return { ...EMOTIONS[word] };
}

/**
 * A face from words → its FACS state. `spec` is a word, or { emotion?, intensity? (1), blend?: { upper, lower } (two
 * words: the upper face from one, the lower from the other), mask?: { felt, shown, leak? (0.3) }, lean? (−1 … 1), eyes?
 * (an eye look, the upper face's) }. Exactly one of `emotion`, `blend` and `mask` (none: neutral).
 */
export function composeFace(spec = 'neutral') {
  const S = typeof spec === 'string' ? { emotion: spec } : { ...spec };
  const ways = ['emotion', 'blend', 'mask'].filter((k) => S[k] !== undefined);
  if (ways.length > 1) throw new Error(`emotions: one of emotion, blend and mask, not ${ways.join(' and ')}`);
  let st;
  if (S.blend) st = { ...only(emotionFacs(S.blend.upper), (r) => UPPER.has(r)), ...only(emotionFacs(S.blend.lower), (r) => !UPPER.has(r)) };
  else if (S.mask) {
    const leak = S.mask.leak ?? 0.3;
    // (the shown emotion's mouth, its eyes as far as a social one moves them: no cheek raised, the felt's upper face leaking)
    st = add(only(emotionFacs(S.mask.shown), (r) => !UPPER.has(r)), scaled(only(emotionFacs(S.mask.felt), (r) => UPPER.has(r)), leak));
  } else st = emotionFacs(S.emotion ?? 'neutral');
  if (S.eyes) st = { ...only(st, (r) => !UPPER.has(r)), ...eyeLookFacs(S.eyes) };
  st = scaled(st, S.intensity ?? 1);
  // (the lean: a sided unit given whole splits by side, the leaning side kept, the other eased by the lean)
  const lean = Math.max(-1, Math.min(1, S.lean ?? 0));
  if (lean) {
    const out = {};
    for (const [k, v] of Object.entries(st)) {
      const [au, side] = auOf(k);
      if (side || !FACS_UNITS[au].sided) { out[k] = Math.max(out[k] ?? 0, v); continue; }
      out[`${au}L`] = clamp01(v * (lean < 0 ? 1 : 1 - lean)); out[`${au}R`] = clamp01(v * (lean > 0 ? 1 : 1 + lean));
    }
    st = out;
  }
  return Object.fromEntries(Object.entries(st).filter(([, v]) => v > 0).map(([k, v]) => [k, +v.toFixed(6)]));
}
