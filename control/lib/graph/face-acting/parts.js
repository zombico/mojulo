/**
 * parts — the face as PARTS that move on their own: the brows, the lids, the cheeks and the mouth, each its own timing,
 * its own life in a hold, and pulled by the others where the anatomy pulls (the cheek raised pushes the lower lid up; a
 * lowered brow bears down on the lid; the outer brow raised lifts the lid's skin a little). And the upper face's own
 * GESTURES: short moves of the brows, the lids and the cheeks (a one-sided brow, the smile in the eyes alone, an
 * appraising squint), the expression the face keeps while the mouth belongs to a line (mouth.js).
 *
 *   • TIMING (`PARTS`): each part's `lead` (s before a beat: the brows lead a thought, the lids go with the gaze; the
 *     cheeks LAG the smile, the raise that follows a felt smile's corners by a tenth of a second or more) and `pace` (×
 *     a change's onset and offset: the lids quickest, the cheeks slowest).
 *   • THE HOLD (`PARTS[part].hold`): the moving hold, each part's own: the brows' slow drift, the lids' faint flutter, the
 *     cheeks' slow settle, the mouth's as it was (perform.js MOVING_HOLD).
 *   • THE COUPLINGS (`COUPLINGS`, `couple`): a part's move a floor under another's, side by side, frame by frame, so a
 *     coupled move rides its cause's timing. A floor, never a sum: a lid already narrower keeps its own.
 *   • THE GESTURES (`UPPER_GESTURES`): cards of a few units (a side its own), a rise, a hold and a fall; a beat's `tell`
 *     (perform.js) and an emote's stir (emotes.js) lay one over the face.
 * Artists' and the anatomy's readings, tuned on the eyes gate. Pure tables and arithmetic.
 */
import { auOf } from './facs.js';

/** the parts: their units, their lead (s, before the beat; negative a lag), their pace (× a change's onset and offset)
 * and their moving hold (a share of the unit's height in two slow waves, Hz) */
export const PARTS = Object.freeze({
  brows: Object.freeze({ units: Object.freeze(['AU1', 'AU2', 'AU4']), lead: 0.12, pace: 1, hold: Object.freeze({ share: 0.06, hz: Object.freeze([[0.1, 0.25], [0.3, 0.6]]) }) }),
  lids: Object.freeze({ units: Object.freeze(['AU5', 'AU7', 'AU45']), lead: 0.1, pace: 0.75, hold: Object.freeze({ share: 0.03, hz: Object.freeze([[0.4, 0.8], [1.4, 2.4]]) }) }),
  cheeks: Object.freeze({ units: Object.freeze(['AU6', 'AU11', 'AU13', 'AU34']), lead: -0.12, pace: 1.3, hold: Object.freeze({ share: 0.05, hz: Object.freeze([[0.08, 0.2], [0.25, 0.5]]) }) }),
  mouth: Object.freeze({ units: null, lead: 0, pace: 1, hold: Object.freeze({ share: 0.05, hz: Object.freeze([[0.15, 0.35], [0.4, 0.9]]) }) }),
});
export const PART_NAMES = Object.freeze(Object.keys(PARTS));

/** a state's key (or a unit) → its part: the brows, the lids, the cheeks, else the mouth (the lower face and the jaw) */
export function partOf(key) {
  const [au] = auOf(key) ?? [key];
  return PART_NAMES.find((p) => PARTS[p].units?.includes(au)) ?? 'mouth';
}

/** the couplings: `from`'s value (per side) a floor of `gain` × it under `to` (per side) */
export const COUPLINGS = Object.freeze([
  Object.freeze({ from: 'AU6', to: 'AU7', gain: 0.35, why: 'the cheek raised bunches the lower lid up' }),
  Object.freeze({ from: 'AU4', to: 'AU7', gain: 0.15, why: 'the brow lowered bears down on the lid' }),
  Object.freeze({ from: 'AU2', to: 'AU5', gain: 0.12, why: 'the outer brow raised lifts the lid\'s skin' }),
]);

/**
 * The couplings laid on a take's curves ({ AUxx[L|R]: [per frame] }, `n` frames), in place: for each side, the cause's
 * whole and side summed, its floor under the coupled unit's side less what its whole already holds. A face with none of
 * the causes is untouched. Returns the curves.
 */
export function couple(curves, n) {
  for (const C of COUPLINGS) {
    const has = (s) => curves[`${C.from}${s}`];
    if (!has('') && !has('L') && !has('R')) continue;
    for (const s of ['L', 'R']) {
      const whole = curves[C.from], side = curves[`${C.from}${s}`], held = curves[C.to];
      let out = curves[`${C.to}${s}`];
      for (let i = 0; i < n; i++) {
        const want = C.gain * ((whole?.[i] ?? 0) + (side?.[i] ?? 0)) - (held?.[i] ?? 0);
        if (want > (out?.[i] ?? 0)) { out ??= curves[`${C.to}${s}`] = new Array(n).fill(0); out[i] = Math.min(1, want); }
      }
    }
  }
  return curves;
}

/** the upper face's gestures: each its units (a side by L or R), its rise, hold and fall (s), the words people say */
export const UPPER_GESTURES = Object.freeze({
  oneBrow: { words: ['one brow up', 'a raised eyebrow', 'skeptical brow'], reads: 'the doubter\'s brow: one outer brow up, the other drawn a little down', units: { AU2R: 0.6, AU1: 0.15, AU4L: 0.2 }, up: 0.15, hold: 0.7, down: 0.45 },
  eyeSmile: { words: ['smiling eyes', 'a smile in the eyes', 'warmth'], reads: 'the smile in the eyes alone: the cheeks up, the lower lids with them, the mouth left as it is', units: { AU6: 0.5, AU7: 0.15 }, up: 0.3, hold: 0.6, down: 0.6 },
  appraise: { words: ['sizing up', 'appraising squint', 'narrowed eyes'], reads: 'sizing something up: the lids narrowed, the brows a little down', units: { AU7: 0.5, AU4: 0.2 }, up: 0.2, hold: 0.6, down: 0.45 },
  knit: { words: ['knitted brow', 'a frown of thought', 'puzzled'], reads: 'puzzling: the brows drawn together and their inner ends up a little', units: { AU4: 0.4, AU1: 0.25 }, up: 0.2, hold: 0.7, down: 0.5 },
  wince: { words: ['wince', 'flinch', 'grimace of the eyes'], reads: 'a flinch: the eyes screwed up fast, the brows down, then easing out', units: { AU6: 0.5, AU7: 0.6, AU4: 0.45, AU45: 0.3 }, up: 0.08, hold: 0.15, down: 0.4 },
  widen: { words: ['eyes widen', 'interest', 'a spark of interest'], reads: 'interest caught: the lids up off the iris, the brows lifted with them', units: { AU5: 0.45, AU1: 0.3, AU2: 0.3 }, up: 0.12, hold: 0.35, down: 0.45 },
  attend: { words: ['focus', 'attending', 'concentration'], reads: 'attending closely: the lids narrowed a touch and held, the brows barely lowered', units: { AU7: 0.3, AU4: 0.12 }, up: 0.3, hold: 1, down: 0.6 },
});
export const UPPER_GESTURE_NAMES = Object.freeze(Object.keys(UPPER_GESTURES));

/** Error lines for a tell: a gesture's name, or { gesture, at? (s, the beat's own time by default), mirror?, intensity? } */
export function tellErrors(T) {
  const S = typeof T === 'string' ? { gesture: T } : T;
  if (!S || typeof S !== 'object' || Array.isArray(S)) return [`tell: a gesture (${UPPER_GESTURE_NAMES.join(', ')}) or { gesture, at?, mirror?, intensity? }`];
  const errs = [];
  if (!Object.hasOwn(UPPER_GESTURES, S.gesture)) errs.push(`tell: '${S.gesture}' is not an upper-face gesture (have ${UPPER_GESTURE_NAMES.join(', ')})`);
  if (S.at !== undefined && !(Number.isFinite(S.at) && S.at >= 0)) errs.push('tell.at: seconds, 0 or more');
  if (S.mirror !== undefined && typeof S.mirror !== 'boolean') errs.push('tell.mirror: true | false');
  if (S.intensity !== undefined && !(Number.isFinite(S.intensity) && S.intensity >= 0 && S.intensity <= 2)) errs.push('tell.intensity: 0 … 2');
  return errs;
}

/** a tell resolved: { units (mirrored where asked, scaled), up, hold, down, at? } */
export function tellOf(T) {
  const errs = tellErrors(T);
  if (errs.length) throw new Error(`parts: ${errs.join('; ')}`);
  const S = typeof T === 'string' ? { gesture: T } : T, G = UPPER_GESTURES[S.gesture], K = S.intensity ?? 1;
  const units = Object.fromEntries(Object.entries(G.units).map(([k, v]) => { const [au, s] = auOf(k); return [S.mirror && s ? `${au}${s === 'L' ? 'R' : 'L'}` : k, Math.min(1, v * K)]; }));
  return { gesture: S.gesture, units, up: G.up, hold: G.hold, down: G.down, ...(S.at !== undefined ? { at: S.at } : {}) };
}
