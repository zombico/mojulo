/**
 * anime-read — a TAKE (perform.js) READ AS ANIME DRAWS IT: the take's continuous face (FACS curves at 60 fps, the gaze, the
 * lines' timed phonemes) becomes a DRAWING per layer per frame on the face tracks' 30 fps grid (polygonizer/anime-drawings.js
 * names them), held as anime holds them, and played by the anime face's targets as a STEP track.
 *
 *   • THE LAYERS, per frame: the BROWS and the LID'S SHAPE per eye (from AU1, AU2, AU4; AU5, AU7: raised, worried, angry,
 *     low; wide, angry, sad), each EYE'S CLOSURE (AU45, with the squint's and the cheek's share; drawn at the head's knots
 *     by the rig), the GAZE (the take's yaw and pitch past `GAZE_STEP` degrees: left, right, up, down; the pupils shrunk
 *     in shock), the MOUTH: over a spoken line KUCHIPAKU (each phoneme its vowel's shape, A I U E O; m, b and p shut, f and
 *     v the narrow i, any other consonant its vowel's, the next one in the word's reach, else the last), elsewhere the
 *     face's own mouth (the jaw open: the shout in anger, the o rounded, else the a; the smile, one-sided a smirk; the
 *     frown; the pucker's u; the pressed mouth small; else shut). A smile rides over the vowels as the smile channel.
 *   • THE TIMING (anime's, as anime-face-tracks.js draws the clips): every layer HELD on twos (a drawing shorter than
 *     `HOLD` frames gives way to the one before it), but a spoken closure, which stays drawn (two frames, taken from the
 *     next); the eyes drawn every frame (a blink's in-betweens are its own); the thought leading the mouth is the take's.
 *   • LOWERED (a face that draws no 7G: anime-face-rig.js sevenG): each layer's drawing lowered to the four channels (its
 *     channels, or its `lower` face), the eyes' closure and a lid's lower face the larger.
 *
 *   animeRead(take)                 → { fps, frames: [7G face per frame] } (drawingWeights' face: eyeL, eyeR, smile, open,
 *                                     brow, brows { L, R }, lids { L, R }, gaze, mouth, mouthSide)
 *   lowerFrame(face)                → the four channels' face (faceState's: eyeL, eyeR, smile, open, brow)
 *   animePerformanceTrack(take, K, { sevenG }) → { seconds, t, w, interp: 'STEP', gaps, audio? }: the face's weights a
 *                                     drawing per frame, keyed half a frame early (anime-face-tracks.js), equal neighbours merged
 * Pure and deterministic.
 */
import { DRAWINGS } from '../polygonizer/anime-drawings.js';
import { drawingWeights, faceWeights, FACE_FPS } from '../polygonizer/anime-face-rig.js';

/** the least frames a drawing holds (on twos), and the gaze's step (degrees) before it turns */
export const HOLD = 2;
export const GAZE_STEP = 6;
/** the thresholds a unit's level crosses to draw its drawing (0 … 1) */
export const READ = Object.freeze({ brow: 0.3, browLow: 0.15, lid: 0.35, jaw: 0.45, anger: 0.35, smile: 0.35, smirk: 0.3, frown: 0.3, pucker: 0.35, press: 0.4, shock: 0.5, squint: 0.35, cheek: 0.3 });
/** kuchipaku: each phoneme (ARPAbet) its mouth's drawing; a consonant not listed takes its vowel's */
export const KUCHIPAKU = Object.freeze({
  AA: 'mouth.a', AH: 'mouth.a', AE: 'mouth.a', AY: 'mouth.a', AW: 'mouth.a',
  IY: 'mouth.i', IH: 'mouth.i', Y: 'mouth.i', F: 'mouth.i', V: 'mouth.i',
  UW: 'mouth.u', UH: 'mouth.u', W: 'mouth.u',
  EH: 'mouth.e', EY: 'mouth.e', ER: 'mouth.e',
  AO: 'mouth.o', OW: 'mouth.o', OY: 'mouth.o',
  M: 'mouth.shut', B: 'mouth.shut', P: 'mouth.shut', sil: 'mouth.shut',
});
const VOWEL = new Set(['AA', 'AH', 'AE', 'AY', 'AW', 'IY', 'IH', 'UW', 'UH', 'EH', 'EY', 'ER', 'AO', 'OW', 'OY']);
/** a consonant looks this far (s) ahead for its vowel */
const REACH = 0.2;

const base = (p) => String(p).replace(/\d+$/, '');
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** the mouth a spoken line draws at time t, or undefined when no line speaks then */
function spokenMouth(lines, t) {
  for (const L of lines) {
    if (t < L.t || t > L.t + L.seconds) continue;
    const ph = L.phonemes ?? [], i = ph.findIndex((q) => t >= q.t && t < q.t + q.dur);
    if (i < 0) return ph.length ? 'mouth.shut' : undefined;
    const p = base(ph[i].p);
    if (KUCHIPAKU[p]) return KUCHIPAKU[p];
    // (a consonant: its vowel, the next in reach, else the last before it)
    for (let j = i + 1; j < ph.length && ph[j].t - t <= REACH; j++) { const q = base(ph[j].p); if (VOWEL.has(q)) return KUCHIPAKU[q]; if (q === 'sil') break; }
    for (let j = i - 1; j >= 0; j--) { const q = base(ph[j].p); if (VOWEL.has(q)) return KUCHIPAKU[q]; if (q === 'sil') break; }
    return 'mouth.e';
  }
  return undefined;
}

/** A take read as drawings, a face per frame at FACE_FPS (see the head of the file). */
export function animeRead(take) {
  const fps = FACE_FPS, n = Math.floor(take.seconds * fps) + 1, lines = take.events?.lines ?? [], R = READ;
  const raw = [];
  for (let f = 0; f < n; f++) {
    const t = f / fps, i = Math.min(take.frames - 1, Math.round(t * take.fps)), c = take.curves;
    const at = (k) => c[k]?.[i] ?? 0, side = (k, s) => at(k) + at(`${k}${s}`), both = (k) => Math.max(side(k, 'L'), side(k, 'R'));
    const face = { eyeL: 0, eyeR: 0, smile: 0, open: 0, brow: 0, brows: {}, lids: {}, gaze: null, mouth: 'mouth.shut', mouthSide: null };
    for (const s of ['L', 'R']) {
      const a1 = side('AU1', s), a2 = side('AU2', s), a4 = side('AU4', s), a5 = side('AU5', s), a7 = side('AU7', s), a6 = side('AU6', s);
      face.brows[s] = a4 > R.brow && a1 > R.brow ? 'brows.worried' : a4 > R.brow ? 'brows.angry' : a1 > R.brow && a2 > R.brow ? 'brows.raised' : a1 > R.brow ? 'brows.worried' : a4 > R.browLow ? 'brows.low' : 'brows.rest';
      // (anger's glare lifts the lid too, AU5 with AU4: anime draws it as the angry lid, not the wide one)
      face.lids[s] = a4 > R.lid && a1 <= R.brow ? 'lids.angry' : a5 > R.lid ? 'lids.wide' : a7 > R.lid ? 'lids.angry' : a1 > R.brow && a4 > R.browLow ? 'lids.sad' : 'lids.open';
      face[`eye${s}`] = clamp01(Math.max(side('AU45', s), side('AU43', s)) + R.squint * a7 + R.cheek * a6);
    }
    // the gaze: its dominant turn past the step (+yaw the figure's right, +pitch up), the pupils shrunk in shock
    const yaw = take.gaze?.yaw?.[i] ?? 0, pitch = take.gaze?.pitch?.[i] ?? 0;
    face.gaze = both('AU5') > R.shock && both('AU1') > R.shock && both('AU26') > R.jaw * 0.6 ? 'gaze.shock' : Math.max(Math.abs(yaw), Math.abs(pitch)) < GAZE_STEP ? 'gaze.ahead' : Math.abs(yaw) >= Math.abs(pitch) ? (yaw > 0 ? 'gaze.right' : 'gaze.left') : pitch > 0 ? 'gaze.up' : 'gaze.down';
    // the mouth: a spoken line's kuchipaku, else the face's own; the smile's channel rides either
    const spoken = spokenMouth(lines, t), smileL = side('AU12', 'L'), smileR = side('AU12', 'R'), jaw = both('AU26') + both('AU27');
    if (spoken) { face.mouth = spoken; face.spoken = true; face.smile = +clamp01(Math.max(smileL, smileR)).toFixed(3); }
    else if (jaw > R.jaw) face.mouth = both('AU4') > R.anger || both('AU9') > R.anger ? 'mouth.shout' : both('AU18') + both('AU22') > R.pucker ? 'mouth.o' : 'mouth.a';
    else if (Math.max(smileL, smileR) > R.smile) { if (Math.abs(smileL - smileR) > R.smirk) { face.mouth = 'mouth.smirk'; face.mouthSide = smileL > smileR ? 'L' : 'R'; } else face.mouth = 'mouth.smile'; }
    else if (both('AU15') > R.frown) face.mouth = 'mouth.frown';
    else if (both('AU18') + both('AU22') > R.pucker) face.mouth = 'mouth.u';
    else if (Math.max(both('AU20'), both('AU23'), both('AU24')) > R.press) face.mouth = 'mouth.small';
    raw.push(face);
  }
  return { fps, frames: holdOnTwos(raw) };
}

/** every layer held at least HOLD frames (a shorter drawing gives way to the one before it), a spoken closure kept drawn
 * (two frames, the next taken); the eyes' closure is not held */
function holdOnTwos(frames) {
  const keyOf = { brows: (F, s) => F.brows[s], lids: (F, s) => F.lids[s], gaze: (F) => F.gaze, mouth: (F) => `${F.mouth}|${F.mouthSide ?? ''}` };
  const setOf = { brows: (F, s, v) => { F.brows[s] = v; }, lids: (F, s, v) => { F.lids[s] = v; }, gaze: (F, _, v) => { F.gaze = v; }, mouth: (F, _, v) => { const [m, sd] = v.split('|'); F.mouth = m; F.mouthSide = sd || null; } };
  const out = frames.map((F) => ({ ...F, brows: { ...F.brows }, lids: { ...F.lids } }));
  for (const [layer, sides] of [['brows', ['L', 'R']], ['lids', ['L', 'R']], ['gaze', [null]], ['mouth', [null]]]) for (const s of sides) {
    const get = (f) => keyOf[layer](out[f], s);
    // (a spoken closure stays drawn: a lone shut frame in a line takes the next frame too)
    if (layer === 'mouth') for (let f = 1; f + 1 < out.length; f++) if (out[f].spoken && out[f].mouth === 'mouth.shut' && get(f - 1) !== get(f) && get(f + 1) !== get(f) && out[f + 1].spoken) setOf.mouth(out[f + 1], s, get(f));
    for (let f = 1; f < out.length; f++) {
      if (get(f) === get(f - 1)) continue;
      let run = 1; while (f + run < out.length && get(f + run) === get(f)) run++;
      const closure = layer === 'mouth' && out[f].spoken && out[f].mouth === 'mouth.shut';
      if (run < HOLD && f + run < out.length && !closure) for (let k = 0; k < run; k++) setOf[layer](out[f + k], s, get(f - 1));
    }
  }
  return out.map(({ spoken: _s, ...F }) => F);
}

/** a 7G face lowered to the four channels: each layer's channels or its lower face; the eyes' closure and a lid's lower
 * face the larger; the brows' two sides met halfway */
export function lowerFrame(F) {
  const low = (name) => { const D = DRAWINGS[name]; return D ? D.channels ?? D.lower ?? {} : {}; };
  const browOf = (s) => low(F.brows?.[s]).brow ?? 0, lidOf = (s) => low(F.lids?.[s]).blink ?? 0, M = low(F.mouth);
  return { eyeL: Math.max(F.eyeL ?? 0, lidOf('L')), eyeR: Math.max(F.eyeR ?? 0, lidOf('R')), smile: Math.max(F.smile ?? 0, M.smile ?? 0), open: M.open ?? 0, brow: (browOf('L') + browOf('R')) / 2 };
}

/** A take as the anime face's STEP weights track (`K` the rig's: its knots and targets; `sevenG` the rig draws the 7G):
 * a drawing per frame, keyed half a frame early (the first at 0), equal neighbours merged, the last held to the take's
 * end; a line's recording rides from its beat (recordings.js), as the realistic face's does. */
export function animePerformanceTrack(take, K, { sevenG = false } = {}) {
  const { fps, frames } = animeRead(take), t = [], w = [];
  frames.forEach((F, f) => {
    const weights = sevenG ? drawingWeights(F.mouth === 'mouth.smile' ? { ...F, smile: 1, mouth: null } : F, K) : faceWeights(lowerFrame(F), K);
    if (w.length && weights.every((x, j) => x === w.at(-1)[j])) return;
    t.push(f === 0 ? 0 : +((f - 0.5) / fps).toFixed(6)); w.push(weights);
  });
  if (t.at(-1) < take.seconds) { t.push(+take.seconds.toFixed(6)); w.push(w.at(-1)); }
  const audio = (take.events?.lines ?? []).filter((L) => L.recording).map((L) => ({ at: L.t, recording: L.recording }));
  return { seconds: take.seconds, t, w, interp: 'STEP', gaps: [], ...(audio.length ? { audio } : {}) };
}
