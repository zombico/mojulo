/**
 * anime-face-tracks — the anime hero's FACE IN TIME: each clip's facial track (the door keys' `face`, hero-gesture
 * heroClipFaces) drawn on a 30-fps grid over the clip's designed duration (hero-gesture heroClipSeconds), and the AMBIENT
 * BLINK, derived on read and never stored. The skinned GLB writes each track as a STEP `weights` channel on the face's
 * morph targets (anime-face-rig.js).
 *
 *   • DRAWINGS, NOT TWEENS: a key's face holds until the next key (limited animation: holds, then the next drawing); an
 *     eye is only ever drawn at a knot (anime-face-rig faceKnots: EYE_KNOTS and a hero's own closure, each an exact head
 *     build with its corrective), and an
 *     eye that changes between keys passes through its IN-BETWEENS, one frame each, right before the next key, each eye
 *     with its own: closing, the half lid (0.5); opening, the half lid then 0.20 (only the knots strictly between the two
 *     drawings; a list longer than the frames between the keys is cut from its end). The mouth and brows on an
 *     in-between frame are already the next key's. A key without a face holds the hero's authored one.
 *   • KEYED HALF A FRAME EARLY: the drawing of frame f is keyed at (f − 0.5)/30 s, the first at 0 and the last at the
 *     clip's end, so an engine sampling at exact frame times (float32 key times included) lands mid-drawing and never
 *     drops a one-frame drawing; the first drawing is the last (the clip loops); equal neighbours merge.
 *   • THE AMBIENT BLINK (BLINK_RULE; on unless `hero.blink: false`): blinks 2.5 … 5 s apart, a fifth of them doubles, each
 *     the half lid, shut for one or two frames more, the half lid, 0.20 (blinkDrawings); seeded per hero and clip
 *     (mulberry32 of faceSeed: FNV-1a of the hero record without its clips, stand and blink, so editing a clip never
 *     reshuffles another's blinks); none across a loop seam (the last ends 0.3 s before it, the gap across it 2.5 … 6 s);
 *     none whose frames, or the frame either side, meet a drawing with an eye shut or an eye change (it never fights a
 *     closed-eye key; over a half lid the eye shuts from it and comes back to it). A clip long enough to hold one (2.5 s) bakes its blinks in (max per eye over
 *     its drawings); `face:ambientBlink` (12 s, the authored face) is the layer an engine plays over the clips whose eyes
 *     hold the authored face with nothing baked (`ambientOver`), through a filter on the blink targets.
 * Pure and deterministic.
 */
import { FACE_FPS, faceKnots, faceState, drawEye, faceWeights } from './anime-face-rig.js';
import { mulberry32 } from './floorplan-glyphs.js';
import { heroClipFaces } from './hero-gesture.js';

/** the ambient blink's placement: the gap between blink starts (s), the share that are doubles and the frames between
 * the two, where the first may start (s), and how long before the loop seam the last must have ended (s) */
export const BLINK_RULE = Object.freeze({ minGap: 2.5, maxGap: 5, doubleChance: 0.2, doubleGapFrames: Object.freeze([4, 7]), firstAt: Object.freeze([0.4, 2.0]), seamGuard: 0.3 });
/** one blink's eye drawings, a frame each: the half lid, shut (held `hold` frames more), the half lid, 0.20 */
export const blinkDrawings = (hold = 1) => [0.5, 1, ...Array(hold).fill(1), 0.5, 0.2];
/** the face-only layer an engine plays over a body clip whose eyes hold */
export const AMBIENT_BLINK = Object.freeze({ name: 'face:ambientBlink', seconds: 12 });

/** FNV-1a, 32 bits (station-loft-detail's tile hash) */
const fnv1a = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
/** a clip's blink seed: the hero record without its clips, stand and blink, and the clip's name */
export function faceSeed(hero, clip) {
  const { clips: _c, gesture: _g, blink: _b, ...rest } = hero || {};
  return fnv1a(`${JSON.stringify(rest)}:${clip}`);
}

/** The ambient blinks a loop of `seconds` holds, seeded: `[{ frame, hold, double?: { gapFrames, hold } }]`, none under the
 * shortest gap (a baked blink would recur every loop) or when no placement keeps the gap across the seam. */
export function placeBlinks(seconds, seed) {
  const R = BLINK_RULE, frames = Math.round(seconds * FACE_FPS);
  if (!(seconds >= R.minGap)) return [];
  for (let attempt = 0; attempt < 64; attempt++) {
    const rnd = mulberry32(seed + attempt * 7919), blinks = [];
    let t = R.firstAt[0] + rnd() * (R.firstAt[1] - R.firstAt[0]);
    for (;;) {
      const hold = rnd() < 0.5 ? 1 : 2, dbl = rnd() < R.doubleChance, gapF = R.doubleGapFrames[0] + Math.floor(rnd() * (R.doubleGapFrames[1] - R.doubleGapFrames[0] + 1)), hold2 = rnd() < 0.5 ? 1 : 2;
      const f = Math.round(t * FACE_FPS), len = blinkDrawings(hold).length + (dbl ? gapF + blinkDrawings(hold2).length : 0);
      if ((f + len + 1) / FACE_FPS > seconds - R.seamGuard) break;   // never straddles the loop seam
      blinks.push({ frame: f, hold, ...(dbl ? { double: { gapFrames: gapF, hold: hold2 } } : {}) });
      t += R.minGap + rnd() * (R.maxGap - R.minGap);
    }
    if (!blinks.length) continue;
    const seam = (frames - blinks[blinks.length - 1].frame + blinks[0].frame) / FACE_FPS;   // the gap across the seam
    if (seam >= R.minGap && seam <= R.maxGap + 1) return blinks;
  }
  return [];
}
/** the eye drawings of a list of blinks: frame → closure */
export function blinkTrack(blinks) {
  const at = new Map();
  for (const b of blinks) {
    const seq = blinkDrawings(b.hold); seq.forEach((e, i) => at.set(b.frame + i, e));
    if (b.double) { const s2 = b.frame + seq.length + b.double.gapFrames; blinkDrawings(b.double.hold).forEach((e, i) => at.set(s2 + i, e)); }
  }
  return at;
}

/** an eye's in-betweens from drawing a to b, in time order: closing the half lid, opening the half lid then 0.20 (only the
 * knots strictly between) */
const inBetweens = (a, b) => (b > a ? [0.5].filter((k) => k > a && k < b) : b < a ? [0.5, 0.2].filter((k) => k < a && k > b) : []);
const EYES = ['eyeL', 'eyeR'];
const same = (a, b) => a.eyeL === b.eyeL && a.eyeR === b.eyeR && a.smile === b.smile && a.open === b.open && a.brow === b.brow;
/** the targets an eye drawing moves (the lids and their correctives): the ambient layer's filter */
const eyeTargets = (targets) => targets.map((n, i) => (n.startsWith('blink') ? i : -1)).filter((i) => i >= 0);

/**
 * One clip's facial track: `faces` its keys' channels (null: the authored face), `seconds` its designed duration,
 * `authored` the hero's expression channels, `seed` its blink seed, `blink` the ambient blink on. Returns `{ t, w, f,
 * blinks, eyesHold }`: the key times (s), each key's weights (anime-face-rig faceWeights, the hero's targets), each key's
 * frame, the blinks baked in, and whether the eyes hold the authored face throughout with none baked (the ambient layer
 * may play over it).
 */
export function clipFaceDrawings({ faces, seconds, authored, seed = 0, blink = true }) {
  const n = faces.length, N = Math.max(1, Math.round(seconds * FACE_FPS)), K = faceKnots(authored);
  const drawn = (F) => ({ ...F, eyeL: drawEye(F.eyeL, K.eyeKnots), eyeR: drawEye(F.eyeR, K.eyeKnots) });
  const A = drawn(faceState(authored)), keyF = faces.map((c) => (c ? drawn(faceState(c)) : A)), at = faces.map((_, i) => Math.round((i * N) / n));
  // (1, 2) the base drawings, frames 0 … N − 1 (frame N is frame 0: the loop): each key held to the next, the eyes'
  // in-betweens right before it
  const base = new Array(N);
  for (let i = 0; i < n; i++) {
    const f0 = at[i], f1 = i + 1 < n ? at[i + 1] : N, F = keyF[i], G = keyF[(i + 1) % n];
    for (let f = f0; f < f1; f++) base[f] = F;
    const room = f1 - f0 - 1; if (room <= 0) continue;
    const lists = Object.fromEntries(EYES.map((e) => [e, inBetweens(F[e], G[e]).slice(0, room)])), len = Math.max(lists.eyeL.length, lists.eyeR.length);
    for (let j = 0; j < len; j++) {
      const D = { ...F, smile: G.smile, open: G.open, brow: G.brow };
      for (const e of EYES) { const k = j - (len - lists[e].length); if (k >= 0) D[e] = lists[e][k]; }
      base[f1 - len + j] = D;
    }
  }
  // (3) the ambient blinks: a blink (with its double) whose frames, or the frame either side, meet a shut eye or an eye
  // change is dropped; the rest overlay the eyes by max (over a half lid: shut from it, back to it)
  const kept = [];
  if (blink) for (const b of placeBlinks(seconds, seed)) {
    const fs = [...blinkTrack([b]).keys()], lo = Math.min(...fs) - 1, hi = Math.max(...fs) + 1, B = (f) => base[((f % N) + N) % N];
    let ok = true;
    for (let f = lo; f <= hi && ok; f++) { const D = B(f); if (D.eyeL >= 1 || D.eyeR >= 1 || (f > lo && EYES.some((e) => D[e] !== B(f - 1)[e]))) ok = false; }
    if (ok) kept.push(b);
  }
  const track = blinkTrack(kept);
  const draw = Array.from({ length: N + 1 }, (_, f) => { const D = base[f % N], e = track.get(f % N); return e === undefined ? D : { ...D, eyeL: Math.max(D.eyeL, e), eyeR: Math.max(D.eyeR, e) }; });
  // (4) a key where the drawing changes, the first and the last kept; half a frame early
  const frames = [];
  for (let f = 0; f <= N; f++) if (f === 0 || f === N || !same(draw[f], draw[f - 1])) frames.push(f);
  for (const f of frames) for (const e of EYES) if (!K.eyeKnots.includes(draw[f][e])) throw new Error(`anime-face-tracks: eye ${draw[f][e]} at frame ${f} is not a drawn knot`);
  const w = frames.map((f) => faceWeights(draw[f], K)), Aw = faceWeights(A, K), ET = eyeTargets(K.targets);
  return {
    t: frames.map((f) => (f === 0 ? 0 : f === N ? seconds : (f - 0.5) / FACE_FPS)), w, f: frames, blinks: kept,
    eyesHold: !kept.length && w.every((x) => ET.every((i) => x[i] === Aw[i])),
  };
}

/**
 * The anime hero's facial tracks, derived on read: `clips` the recipe's (the plan's, no `face`), `seconds` each one's
 * designed duration (heroClipSeconds), `authored` the hero's expression channels. Returns `{ tracks: { <name>: { t, w } },
 * ambient?: { name, seconds, t, w }, ambientOver, blinks }`: every clip's track (the door keys' faces, the authored face
 * elsewhere, the blinks a clip of 2.5 s or more bakes in), the `face:ambientBlink` layer (the authored face with its own
 * blinks), the clips it plays over (the eyes hold, nothing baked) and the blinks placed per clip. `hero.blink: false`:
 * nothing baked and no layer.
 */
export function heroFaceTracks(hero, clips, seconds, authored) {
  const faces = heroClipFaces(hero, clips), on = hero?.blink !== false;
  const tracks = {}, blinks = {}, ambientOver = [];
  for (const name of Object.keys(clips || {})) {
    const d = clipFaceDrawings({ faces: faces[name], seconds: seconds?.[name] > 0 ? seconds[name] : 1, authored, seed: faceSeed(hero, name), blink: on });
    tracks[name] = { t: d.t, w: d.w };
    if (d.blinks.length) blinks[name] = d.blinks;
    if (on && d.eyesHold) ambientOver.push(name);
  }
  if (!on) return { tracks, ambientOver, blinks };
  const a = clipFaceDrawings({ faces: [null], seconds: AMBIENT_BLINK.seconds, authored, seed: faceSeed(hero, AMBIENT_BLINK.name) });
  blinks[AMBIENT_BLINK.name] = a.blinks;
  return { tracks, ambient: { name: AMBIENT_BLINK.name, seconds: AMBIENT_BLINK.seconds, t: a.t, w: a.w }, ambientOver, blinks };
}
