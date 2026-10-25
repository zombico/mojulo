/**
 * hero-face-action — the anime hero's FACE ACTING AN ACTION: hand it a solved action (a strike, hero-strike; a jump or a
 * roll, hero-jump; a guard taken up, hero-grip; a blow taken, hero-react) and a seed, and it gives a face sequence
 * timed to that action's beats, drawn on the face tracks' 30-fps grid (anime-face-rig FACE_FPS) in the four expression
 * channels (blink, smile, open, brow). A take is one of a few SAMPLES per family (a kiai, a gritted strike, a fencer's
 * stillness, a smirk, a flinch; a jump's effort, its joy, a startle; a roll eyes shut or eyes open; a guard's resolve,
 * calm, smirk or fire; a blow's wince or grit), picked by the seed and weighted by the action's own intensity, and
 * each sample's drawings land within a range of frames of their beat and with channels within a range, so no two takes
 * are the same face at the same frame.
 *
 *   • THE BEATS come from the action, never authored here: a strike's load, contact and follow (its STRIKES timing over
 *     its seconds), a jump's load and absorb (the deepest sink either side of the air: sampled off the clip), take-off,
 *     apex, touch-down and a double jump's kick, a roll's start and end, a guard's arms closing and set.
 *   • THE THOUGHT LEADS (the eyes and brows lead the body: Williams, The Animator's Survival Kit): the set face is drawn a
 *     few frames before the load it drives, the eyes on the target.
 *   • THE BREATH FOLLOWS THE MECHANICS: the breath is set in the load (the mouth shut), and the shout, or the clench, is ON
 *     the contact (kendo's ki-ken-tai-ichi: the spirit, the sword and the body land together) — its drawing starts a
 *     frame or two before the contact so it is on screen at it — held through the follow, released in the recovery. A
 *     jump says its "hup" on the take-off and squashes its lids on the touch-down.
 *   • EYES ON THE TARGET: no shut eye from the load to the end of the follow (a flinch squints to the half lid at most);
 *     the blink comes after, as the action settles — a blink closes a thought (Murch, In the Blink of an Eye) — and a
 *     roll may shut its eyes through the tumble.
 *   • DRAWN, NOT TWEENED (anime-face-tracks' rule): a drawing holds at least two frames (on twos) and an eye changing
 *     between two drawings passes through its in-betweens a frame each right before the next (closing the half lid;
 *     opening the half lid then 0.20); a drawing with no room is dropped, its beat's anchor (the shout, the take-off)
 *     never. Eyes are only drawn at the knots (EYE_KNOTS).
 *   • A ONE-SHOT starts on the authored face and comes back to it before its end, so the next clip takes over cleanly; a
 *     guard ends on its own held face (`hold`), the face its idle keeps.
 * Seeded (mulberry32), pure and deterministic: the same action and seed give the same take.
 */
import { FACE_FPS, EYE_KNOTS, faceKnots, faceState, faceWeights } from './anime-face-rig.js';
import { blinkDrawings } from './anime-face-tracks.js';
import { mulberry32 } from './floorplan-glyphs.js';
import { STRIKES } from './hero-strike.js';

/** a drawing holds this many frames at least (on twos) */
export const MIN_HOLD = 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const r2 = (x) => +x.toFixed(2);
const NEUTRAL = Object.freeze({ blink: 0, smile: 0, open: 0, brow: 0 });

/**
 * The samples, per family: each a weight (a function of the action: { intensity, order, regime, name }) and its marks.
 * A mark is drawn at its beat less `lead` frames (a range: + before the beat, − after it); `face` the channels it
 * draws over the authored face (a number, a [lo, hi] range, or for `blink` a list of knots to choose among); `anchor`
 * marks are never dropped; `blink` marks a blink over whatever face is drawn then (shut 1 or 2 frames more, chosen
 * among); `held` the face a guard keeps.
 * A family's last mark is its return (`back`: the authored face) or, for a guard, the face it holds.
 */
export const FACE_SAMPLES = Object.freeze({
  strike: {
    kiai: { weight: ({ intensity }) => 0.3 + 1.2 * intensity, marks: [
      { at: 'load', lead: [2, 3], face: { brow: [0.45, 0.7], blink: [0.18, 0.2] } },                          // set: the breath held
      { at: 'contact', lead: [1, 2], face: { brow: [0.8, 1], blink: [0.18, 0.2], open: [0.6, 0.9] }, anchor: true }, // the shout on the contact
      { at: 'follow', lead: [-3, -1], face: { brow: [0.3, 0.5], blink: [0.1, 0.12], open: [0.15, 0.3] } },     // the breath out
      { at: 'follow', lead: [-6, -4], blink: [1, 2] },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    grit: { weight: () => 0.8, marks: [
      { at: 'load', lead: [2, 4], face: { brow: [0.55, 0.75], blink: [0.18, 0.2] } },
      { at: 'contact', lead: [1, 2], face: { brow: [0.9, 1], blink: [0.2], open: 0 }, anchor: true },          // teeth set on the contact
      { at: 'follow', lead: [-2, 0], face: { brow: [0.3, 0.45], blink: [0.12, 0.18], open: [0.1, 0.2] } },
      { at: 'follow', lead: [-6, -3], blink: [1, 2] },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    focus: { weight: ({ order, intensity }) => (order === 'hand' ? 1.4 : 0.3 + 0.6 * (1 - intensity)), marks: [
      { at: 'load', lead: [3, 5], face: { brow: [0.3, 0.45], blink: [0.1, 0.12] } },                          // still: a fencer's eyes
      { at: 'contact', lead: [1, 2], face: { brow: [0.45, 0.6], blink: [0, 0.1], open: [0, 0.08] }, anchor: true }, // the eyes widen on the touch
      { at: 'follow', lead: [-6, -3], blink: [1] },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    cocky: { weight: () => 0.5, marks: [
      { at: 'load', lead: [2, 4], face: { smile: [0.3, 0.5], brow: [0.15, 0.3], blink: [0.18, 0.2] } },      // the smirk
      { at: 'contact', lead: [1, 2], face: { open: [0.4, 0.6], brow: [0.7, 0.9], blink: [0.18, 0.2] }, anchor: true },
      { at: 'follow', lead: [-3, -1], face: { smile: [0.6, 0.85], blink: [0.12], brow: [0, 0.15] } },          // the grin after
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    flinch: { weight: () => 0.25, marks: [
      { at: 'load', lead: [2, 3], face: { brow: [-0.5, -0.3], blink: [0.1, 0.12] } },                         // unsure
      { at: 'contact', lead: [1, 2], face: { brow: [0.5, 0.7], blink: [0.5], open: [0.25, 0.4] }, anchor: true },   // squints into it
      { at: 'follow', lead: [-3, -1], face: { brow: [-0.5, -0.3], open: [0.25, 0.4], blink: [0] } },          // did that land?
      { at: 'follow', lead: [-7, -5], blink: [1] },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
  },
  jump: {
    effort: { weight: () => 1, marks: [
      { at: 'load', lead: [3, 5], face: { brow: [0.5, 0.7], blink: [0.18, 0.2] } },
      { at: 'takeoff', lead: [1, 2], face: { brow: [0.75, 0.9], blink: [0.2], open: [0.4, 0.6] }, anchor: true },  // the hup
      { at: 'kick', lead: [1, 2], face: { brow: [0.9, 1], blink: [0.2], open: [0.6, 0.8] }, anchor: true },        // a double jump's second push
      { at: 'apex', lead: [4, 6], face: { brow: [0.25, 0.4], blink: [0, 0.1], open: [0, 0.12] } },
      { at: 'land', lead: [0, 1], face: { brow: [0.35, 0.5], blink: [0.5], open: [0.25, 0.4] }, anchor: true },   // the lids squash on the touch-down
      { at: 'absorb', lead: [-3, -1], face: { brow: [0.05, 0.2], blink: [0.1, 0.12], open: [0.1, 0.2] } },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    joy: { weight: ({ name }) => (name === 'jumpBack' ? 0.3 : 0.7), marks: [
      { at: 'load', lead: [3, 5], face: { smile: [0.3, 0.5], blink: [0.12] } },
      { at: 'takeoff', lead: [1, 2], face: { smile: [0.6, 0.8], open: [0.35, 0.5], blink: [0.12] }, anchor: true },
      { at: 'apex', lead: [3, 5], face: { blink: [1], smile: 1, brow: [-0.3, -0.15], open: [0, 0.2] } },        // the eyes shut in a grin
      { at: 'land', lead: [0, 1], face: { smile: [0.7, 0.9], open: [0.4, 0.55], blink: [0.12] }, anchor: true },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    startle: { weight: ({ name }) => (name === 'jumpBack' ? 1.4 : 0.3), marks: [
      { at: 'load', lead: [3, 6], face: { open: [0.4, 0.55], brow: [-0.6, -0.45], blink: [0] } },             // the start
      { at: 'takeoff', lead: [1, 2], face: { open: [0.25, 0.4], brow: [-0.5, -0.3], blink: [0] }, anchor: true },
      { at: 'land', lead: [0, 1], face: { brow: [0.4, 0.6], blink: [0.5], open: [0.15, 0.3] }, anchor: true },
      { at: 'absorb', lead: [-3, -1], face: { brow: [0.4, 0.6], blink: [0.18, 0.2] } },                       // the eyes back on the threat
      { at: 'absorb', lead: [-7, -5], blink: [1] },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
  },
  // a blow taken (hero-react: a hit, a stagger): the face answers the impact a frame after it lands, the lids squeezed to
  // the half lid at most (the eyes stay on the threat), and comes back as the body gives back to the stand
  react: {
    wince: { weight: () => 1, marks: [
      { at: 'impact', lead: [-1, 0], face: { brow: [-0.7, -0.45], blink: [0.5], open: [0.3, 0.5] }, anchor: true },   // the pain: the brows up, the lids squeezed
      { at: 'hold', lead: [1, 2], face: { brow: [-0.4, -0.2], blink: [0.18, 0.2], open: [0.1, 0.2] } },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
    grit: { weight: () => 0.7, marks: [
      { at: 'impact', lead: [-1, 0], face: { brow: [0.8, 1], blink: [0.5], open: 0 }, anchor: true },                // teeth set against it
      { at: 'hold', lead: [1, 2], face: { brow: [0.5, 0.7], blink: [0.18, 0.2] } },
      { at: 'end', lead: [3, 5], back: true, anchor: true },
    ] },
  },
  roll: {
    tuck: { weight: () => 1, marks: [
      { at: 'start', lead: [2, 4], face: { brow: [0.6, 0.85], blink: [1], open: 0 }, anchor: true },           // eyes shut through the tumble
      { at: 'end', lead: [0, 2], face: { brow: [0.5, 0.7], blink: [0.18, 0.2] }, anchor: true },               // open on the way up
      { at: 'end', lead: [-6, -4], blink: [1] },
      { at: 'end!', lead: [3, 5], back: true, anchor: true },
    ] },
    brave: { weight: () => 0.6, marks: [
      { at: 'start', lead: [3, 5], face: { brow: [0.85, 1], blink: [0.2], open: 0 } },
      { at: 'mid', lead: [1, 3], face: { brow: 1, blink: [0.2], open: [0.1, 0.2] }, anchor: true },
      { at: 'end', lead: [0, 2], face: { brow: [0.45, 0.6], blink: [0.18] } },
      { at: 'end!', lead: [3, 5], back: true, anchor: true },
    ] },
  },
  guard: {
    resolve: { weight: ({ regime }) => (regime === 'skilled' ? 1.4 : 0.6), marks: [
      { at: 'close', lead: [2, 4], face: { brow: [0.35, 0.5], blink: [0.12, 0.18] } },
      { at: 'set', lead: [7, 9], blink: [1] },                                                                 // the reset, then the eyes harden
      { at: 'set', lead: [3, 4], face: { brow: [0.55, 0.75], blink: [0.18, 0.2] }, anchor: true, held: true },
    ] },
    calm: { weight: ({ regime }) => (regime === 'skilled' ? 1 : 0.3), marks: [
      { at: 'close', lead: [1, 3], face: { brow: [0.15, 0.3], blink: [0.12, 0.18] } },
      { at: 'set', lead: [3, 5], face: { brow: [0.2, 0.35], blink: [0.12] }, anchor: true, held: true },
    ] },
    smirk: { weight: ({ regime }) => (regime === 'weightless' ? 1.4 : 0.2), marks: [
      { at: 'close', lead: [2, 4], face: { smile: [0.25, 0.4], blink: [0.18], brow: [0.1, 0.2] } },
      { at: 'set', lead: [3, 5], face: { smile: [0.4, 0.55], blink: [0.18, 0.2], brow: [0.15, 0.3] }, anchor: true, held: true },
    ] },
    fire: { weight: ({ regime }) => (regime === 'weightless' ? 0.8 : 0.4), marks: [
      { at: 'close', lead: [2, 4], face: { brow: [0.6, 0.8], blink: [0.18, 0.2] } },
      { at: 'set', lead: [3, 5], face: { brow: [0.85, 1], blink: [0.2], open: [0.08, 0.15] }, anchor: true, held: true },
    ] },
  },
});
export const FACE_FAMILIES = Object.freeze(Object.keys(FACE_SAMPLES));

/** a strike's intensity: how much of the body it commits (the facing turned, a lunge), 0.2 … 1 */
const strikeIntensity = (K) => clamp(Math.abs(K.turn) / 45 + 2 * (K.lunge ?? 0), 0.2, 1);

/**
 * The beats of a solved action, in seconds: `{ family, name, seconds, intensity, order?, regime?, beats }`.
 * A strike (hero-strike heroStrike): load, contact, follow, end. A jump (hero-jump heroJump; `name` its JUMPS name):
 * load and absorb (the deepest sink either side of the air), takeoff, apex, land, kick (a double jump), end. A roll:
 * start, mid, end, end!. A guard (hero-grip heroGuard): close (the arms begin to close), set (the guard taken), end.
 * Or `{ family, seconds, beats }` as given (a reaction's: impact, hold, end; hero-motion.js MOVE_FAMILIES.react).
 */
export function actionBeats(action, { name } = {}) {
  if (action?.beats && action.family) return { intensity: 0.6, ...action };
  if (action?.contact && action.hand) {
    const base = action.name.replace(/Left$/, ''), K = STRIKES[base], T = action.seconds;
    return { family: 'strike', name: base, seconds: T, intensity: strikeIntensity(K), order: K.order,
      beats: { load: K.timing.load * T, contact: action.contact.t, follow: K.timing.follow * T, end: T } };
  }
  if (action?.regime && action.hold) {
    const T = action.clip.seconds, ks = action.keys, close = (ks.at(-2)?.t ?? 0) * T;
    return { family: 'guard', name: action.name, seconds: T, intensity: action.regime === 'weightless' ? 0.8 : 0.5, regime: action.regime,
      beats: { close, set: T, end: T } };
  }
  if (action?.fn && (action.air || action.roll)) {
    const T = action.seconds;
    if (action.roll) { const { start, end } = action.roll; return { family: 'roll', name: name ?? 'roll', seconds: T, intensity: 0.7, beats: { start, mid: (start + end) / 2, end, 'end!': T } }; }
    const A = action.air, M = 120, sink = Array.from({ length: M + 1 }, (_, i) => action.fn(i / M).sink);
    const deepest = (a, b) => { let best = a, v = -Infinity; for (let i = Math.ceil(a * M / T); i <= Math.floor(b * M / T); i++) if (sink[i] > v) { v = sink[i]; best = (i / M) * T; } return best; };
    return { family: 'jump', name: name ?? 'jump', seconds: T, intensity: 0.7,
      beats: { load: deepest(0, A.takeoff), takeoff: A.takeoff, ...(A.kick ? { kick: A.kick } : {}), apex: A.apex, land: A.land, absorb: deepest(A.land, T), end: T } };
  }
  throw new Error('hero-face-action: an action is a heroStrike, heroJump or heroGuard result, or { family, seconds, beats }');
}

/** a sample's channel value: a range eased toward its top by the intensity, a list of knots chosen among */
function valueOf(spec, key, rnd, intensity) {
  if (typeof spec === 'number') return spec;
  if (key === 'blink') return spec[Math.floor(rnd() * spec.length)];
  const [lo, hi] = spec; return r2(lo + (hi - lo) * clamp(0.5 * intensity + 0.5 * rnd(), 0, 1));
}
const pickInt = (rnd, [a, b]) => a + Math.floor(rnd() * (b - a + 1));
const sameFace = (a, b) => a.blink === b.blink && a.smile === b.smile && a.open === b.open && a.brow === b.brow;
/** an eye's in-betweens from a to b (anime-face-tracks: closing the half lid, opening the half lid then 0.20) */
const inBetweens = (a, b) => (b > a ? [0.5].filter((k) => k > a && k < b) : b < a ? [0.5, 0.2].filter((k) => k < a && k > b) : []);

/**
 * The face acting a solved action: `action` a heroStrike / heroJump / heroGuard result (a jump's `name` in opts), `seed`
 * picks the take (the sample, the frames each drawing lands on, the channels), `sample` forces one, `after` the take
 * played before it (or its sample's name: that sample is a quarter as likely again), `authored` the hero's
 * expression channels (the face a one-shot starts and ends on; neutral by default).
 * Returns `{ family, name, sample, seed, seconds, frames, preroll, beats, drawings: [{ frame, t, beat, face }], faces, hold }`:
 * the drawings (where the face changes: the in-betweens and blinks included), `faces` the face per frame (frames 0 … N − 1),
 * `hold` the last face (a guard's held face) and `preroll` the frames the face wanted to lead the clip's first frame by
 * (the thought before the body: a strike that loads from frame 0).
 */
export function actionFace(action, { seed = 0, sample, after, authored = NEUTRAL, name } = {}) {
  const B = actionBeats(action, { name }), fam = FACE_SAMPLES[B.family], N = Math.max(1, Math.round(B.seconds * FACE_FPS));
  const rnd = mulberry32((seed >>> 0) * 2654435761 + 97);
  // (1) the take: a sample by weight, unless one is asked for
  let pick = sample; const again = typeof after === 'string' ? after : after?.sample;
  if (pick === undefined) {
    const W = Object.entries(fam).map(([k, s]) => [k, s.weight(B) * (k === again ? 0.25 : 1)]), total = W.reduce((s, [, w]) => s + w, 0);
    let x = rnd() * total; pick = W.find(([, w]) => (x -= w) < 0)?.[0] ?? W.at(-1)[0];
  } else if (!fam[pick]) throw new Error(`hero-face-action: no ${B.family} sample '${pick}' (have ${Object.keys(fam).join(', ')})`);
  const S = fam[pick], A = { ...NEUTRAL, ...authored };
  // (2) each mark on its frame (its beat less its lead), its face drawn over the authored one; a mark whose beat the
  // action lacks (a single jump's kick) is left out
  const marks = S.marks.filter((m) => B.beats[m.at] !== undefined).map((m) => {
    const want = Math.round(B.beats[m.at] * FACE_FPS) - pickInt(rnd, m.lead), frame = clamp(want, 1, N - 1);
    if (m.blink) return { ...m, frame: want, hold: m.blink[Math.floor(rnd() * m.blink.length)] };
    const face = m.back ? { ...A } : { ...A, ...Object.fromEntries(Object.entries(m.face).map(([k, v]) => [k, valueOf(v, k, rnd, B.intensity)])) };
    return { ...m, frame, want, face, beatF: Math.round(B.beats[m.at] * FACE_FPS) };
  });
  // (3) the drawings on twos (frame 0 is the face the clip takes over, so a drawing may start at frame 1): the anchors
  // keep their frames; an optional drawing too close to the one before or the next anchor, or that would cover an anchor
  // before its beat, is dropped; the eyes' in-betweens take their frames from the end of the drawing before
  // (a drawing after the return, or after a guard's held face, is left out: the take ends there)
  const last = Math.min(...marks.filter((m) => m.back || m.held).map((m) => m.frame));
  const faceMarks = marks.filter((m) => m.face && (m.back || m.held || m.frame < last)).sort((a, b) => a.frame - b.frame || (b.anchor ? 1 : 0) - (a.anchor ? 1 : 0));
  const kept = [];
  for (const m of faceMarks) {
    const prev = kept.at(-1), next = faceMarks.find((o) => o.anchor && o.frame > m.frame);
    const room = (o, p) => p.frame - o.frame - inBetweens(o.face.blink, p.face.blink).length;
    if (!m.anchor) {
      if (prev && room(prev, m) < MIN_HOLD) continue;
      if (prev?.anchor && m.frame - inBetweens(prev.face.blink, m.face.blink).length <= prev.beatF) continue;   // an anchor holds through its beat
      if (next && room(m, next) < MIN_HOLD) continue;
    } else if (prev && room(prev, m) < MIN_HOLD) {
      if (prev.anchor) m.frame = prev.frame + MIN_HOLD + inBetweens(prev.face.blink, m.face.blink).length;   // two anchors too close: the later waits
      else kept.pop();
    }
    if (m.frame > N - 1) continue;
    kept.push(m);
  }
  // (4) frame by frame: the authored face, each drawing held to the next, the in-betweens before each eye change
  const base = Array.from({ length: N }, () => A), beatAt = new Array(N).fill(null);
  const all = [{ frame: 0, face: A, at: 'start' }, ...kept];
  for (let i = 0; i < all.length; i++) {
    const m = all[i], f1 = i + 1 < all.length ? all[i + 1].frame : N;
    for (let f = m.frame; f < f1; f++) base[f] = m.face;
    beatAt[m.frame] = m.at;
    if (i + 1 < all.length) { const nx = all[i + 1], ib = inBetweens(m.face.blink, nx.face.blink); ib.forEach((e, j) => { const f = f1 - ib.length + j; if (f > m.frame) base[f] = { ...nx.face, blink: e }; }); }
  }
  // (5) the blinks, each over the face drawn then (max per eye), where it fits: wholly inside the clip, not touching a
  // shut eye or an eye change, never between the load and the end of the follow of a strike
  const guardFrom = B.family === 'strike' ? Math.round(B.beats.load * FACE_FPS) - 3 : -1, guardTo = B.family === 'strike' ? Math.round(B.beats.follow * FACE_FPS) + 1 : -1;
  const faces = base.slice();
  for (const m of marks.filter((o) => o.hold !== undefined && o.blink)) {
    const seq = blinkDrawings(m.hold), f0 = m.frame, f1 = f0 + seq.length - 1;
    if (f0 < 1 || f1 > N - 2 || (f0 <= guardTo && f1 >= guardFrom)) continue;
    let ok = true;
    for (let f = f0 - 1; f <= f1 + 1 && ok; f++) if (base[f].blink >= 1 || (f > f0 - 1 && base[f].blink !== base[f - 1].blink)) ok = false;
    if (!ok) continue;
    seq.forEach((e, j) => { faces[f0 + j] = { ...base[f0 + j], blink: Math.max(base[f0 + j].blink, e) }; beatAt[f0 + j] ??= j ? null : 'blink'; });
  }
  // (6) the drawings: where the face changes
  const drawings = [];
  for (let f = 0; f < N; f++) if (f === 0 || !sameFace(faces[f], faces[f - 1])) drawings.push({ frame: f, t: +(f / FACE_FPS).toFixed(4), beat: beatAt[f] ?? 'between', face: faces[f] });
  // the frames the face would lead the clip by (a drawing that wanted to start before frame 1): an engine blending in
  // from an idle may start the face that much early
  const preroll = Math.max(0, ...kept.map((m) => 1 - m.want));
  return { family: B.family, name: B.name, sample: pick, seed, seconds: B.seconds, frames: N, preroll, beats: Object.fromEntries(Object.entries(B.beats).map(([k, v]) => [k, +v.toFixed(4)])), drawings, faces, hold: faces[N - 1] };
}

/**
 * A take as the face track the GLB writes (anime-face-tracks' keys): `{ t, w }`, each drawing keyed half a frame early
 * (the first at 0), the weights in the hero's targets (anime-face-rig faceWeights, `authored` the hero's channels for its
 * knots), and a last key at the clip's end holding the last drawing (a one-shot: it does not loop back).
 */
export function actionFaceTrack(take, authored = NEUTRAL) {
  const K = faceKnots(authored), t = [], w = [];
  for (const d of take.drawings) { t.push(d.frame === 0 ? 0 : +((d.frame - 0.5) / FACE_FPS).toFixed(6)); w.push(faceWeights(faceState(d.face), K)); }
  t.push(take.seconds); w.push(w.at(-1));
  return { t, w };
}

/** the eye knots a take's faces are drawn at (a check: every eye a knot) */
export const onKnots = (take) => take.faces.every((f) => EYE_KNOTS.includes(f.blink));
