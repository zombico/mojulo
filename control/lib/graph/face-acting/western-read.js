/**
 * western-read — a TAKE (perform.js) READ ON THE LANDMARK HEAD: the landmark (western) face has no mouth among its
 * targets (polygonizer/western-face-rig.js: its eyes, its mouth's corners and its brows), its mouth is its JAW BONE (the
 * clip key's `jaw`, degrees). So a take is read as the anime face reads it (anime-read.js: drawings held on twos, the
 * eyes every frame, KUCHIPAKU over a spoken line: each vowel its mouth), lowered to the four channels, and laid on the
 * landmark head: the closure, the smile and the brow on its targets (western-face-rig.js `fromAnime`, each eye its own),
 * the mouth's opening on its jaw (the line's vowels the jaw's degrees, a closure shut).
 *
 *   JAW_TALK                           the jaw's degrees at a mouth drawn open full (a talking jaw, under the clip key's 25)
 *   westernPerformanceTrack(take, K)   → { seconds, t, w, jaw: { t, d }, interp: 'STEP' }: the face's weights a drawing per
 *                                      frame in K's targets (K: western-face-rig.js westernKnots), and the jaw's degrees
 *                                      on the same frames; keyed half a frame early, equal neighbours merged, held to the
 *                                      take's end, as anime-read.js keys the anime face's
 *
 * Pure and deterministic.
 */
import { animeRead, lowerFrame } from './anime-read.js';
import { westernState, fromAnime } from '../polygonizer/western-face-rig.js';

/** the jaw's degrees at a mouth drawn open full: a speaking jaw (the clip key's range runs to 25, a shout) */
export const JAW_TALK = 14;

const r3 = (v) => Math.round(v * 1000) / 1000;

/** A take on the landmark head (see the header). */
export function westernPerformanceTrack(take, K) {
  const { fps, frames } = animeRead(take), t = [], w = [], d = [];
  frames.forEach((F, f) => {
    const L = lowerFrame(F);
    // (the smile and the brow on the face, each eye its own closure; the mouth's opening the jaw's)
    const state = { ...westernState(fromAnime({ smile: L.smile, brow: L.brow })), eyeL: L.eyeL, eyeR: L.eyeR };
    const weights = K.weigh(state), deg = r3(Math.max(0, Math.min(1, L.open)) * JAW_TALK);
    if (w.length && d.at(-1) === deg && weights.every((x, j) => x === w.at(-1)[j])) return;
    t.push(f === 0 ? 0 : +((f - 0.5) / fps).toFixed(6)); w.push(weights); d.push(deg);
  });
  if (t.at(-1) < take.seconds) { t.push(+take.seconds.toFixed(6)); w.push(w.at(-1)); d.push(d.at(-1)); }
  return { seconds: take.seconds, t, w, jaw: { t: [...t], d }, interp: 'STEP' };
}
