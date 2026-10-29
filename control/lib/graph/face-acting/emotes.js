/**
 * emotes — the face's HELD STATES: what a face does when nothing is happening to it, as a loop that lives. An emotion
 * (emotions.js) is what a face reads as; an emote is a state a face sits in, its units held, its eyes on their regard,
 * its blinks at its own rate, and now and then a stir (a lip pressed, the lids sinking and caught). Each is a CARD, and
 * every card is general: any realistic face plays any emote, and a new emote is a card, not code.
 *
 * A CARD: { words (what people call it), reads (what it shows), face (a FACS state, each side its own: an emote is
 * asymmetric by construction, as a face at rest is), eyes: { yaw, pitch (degrees, the regard's home), distance? (m: the
 * eyes focus there, converged; none, the far point), drift (degrees, the eyes' slow wander), refix: { every: [s, s],
 * reach: [deg, deg] } | null (the small re-fixations of eyes on nothing), scan? { points: [[yaw, pitch]] (degrees from
 * home), weights, dwell: [s, s] } (a listener's eyes between a speaker's eyes and mouth), away? { every, hold, reach }
 * (glances off to a side, unfocused, and back) }, blink: { rate (a minute), slow? (× the blink's length) }, stirs?: [{ face, every: [s, s], up, hold, down
 * (s) } | { tell (an upper-face gesture, parts.js UPPER_GESTURES), intensity?, every }], alert? (its wariness,
 * alert.js: 0 calm … 1 on guard; a spec's `alert` over it, the face's fear raising it), breath? ({ rate?, depth?,
 * high?, sigh?: [s, s] }: its own over the breath its state breathes, breath.js), head? ({ yaw?, pitch?, roll? (degrees,
 * its carriage), follow? (0 … 1, how far the head follows the eyes' larger looks), sway? (degrees) }: head.js; a stir's
 * `head` a turn, nod or tilt it makes), seconds (the loop) }. Each part of the face
 * lives in the hold its own way and pulls on the others as parts.js says.
 *
 *   • THE REGARD: at the far point where it names no distance (the eyes parallel, looking at nothing), focused where it
 *     does (converged on it, gaze.js: a listener on a speaker's face), unfocused in a glance away; never cross-eyed.
 *   • THE LOOP is seamless: every wave of the moving hold and of the drift turns a whole number of times in it, and the
 *     blinks, the stirs and the fixations are laid round it, so the last frame is the first.
 *   • THE MOUTH is the face's set alone (the corners, a lip pressed or just apart): speech's articulation is not an
 *     emote's (mouth.js `MOUTH`: a line laid over a loop takes the mouth and the loop gives way).
 *
 * `emoteTake(spec)` → a take as perform.js's `perform` returns one (so relational-face-rig.js `performanceTrack` keys it),
 * with `loop: true`. Seeded (mulberry32), pure and deterministic. Tuned on the eyes gate, the operator's.
 */
import { auOf } from './facs.js';
import { composeFace } from './emotions.js';
import { BLINK, GAZE, CAPTURE_FPS } from './perform.js';
import { PARTS, partOf, couple, tellOf, lookLids, lookPulses } from './parts.js';
import { fearOf, alertFace, alertEyes, alertBlink, alertErrors, addState } from './alert.js';
import { breathOf, breathTake, breathFace, SIGH_SECONDS } from './breath.js';
import { headTake } from './head.js';
import { vergence, EYES } from './gaze.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

export const FACE_EMOTES = Object.freeze({
  rest: {
    words: ['resting face', 'at rest', 'neutral', 'blank', 'idle'],
    reads: 'nothing on it but the face\'s own unevenness: one brow a touch higher, a corner a touch lower, a lid a touch heavier; looking at nothing',
    face: { AU2L: 0.12, AU4R: 0.08, AU45R: 0.08, AU15R: 0.1, AU12L: 0.06, AU6L: 0.08, AU24: 0.06 },
    eyes: { yaw: 0, pitch: -4, drift: 0.5, refix: { every: [2.5, 5], reach: [1, 3] } },
    blink: { rate: 14 }, head: { pitch: -2, roll: 2, follow: 0.5, sway: 0.6 }, seconds: 8,
  },
  vacant: {
    words: ['zoned out', 'vacant', 'spaced out', 'thousand-yard stare', 'blank stare'],
    reads: 'nobody home: the lids a little heavy, the lips just apart, the eyes still on nothing and seldom blinking',
    face: { AU45L: 0.22, AU45R: 0.16, AU25: 0.14, AU26: 0.03, AU1: 0.06, AU2R: 0.08 }, breath: { rate: 10 },
    eyes: { yaw: 0, pitch: -2, drift: 0.3, refix: null },
    blink: { rate: 7, slow: 1.3 }, head: { pitch: -4, roll: -3, follow: 0.2, sway: 0.3 }, seconds: 8,
  },
  daydream: {
    words: ['daydreaming', 'lost in thought', 'far away', 'wistful', 'dreamy'],
    reads: 'far away and pleasantly so: the eyes up and off, a half smile on one side, the brows a little lifted',
    face: { AU12L: 0.22, AU6L: 0.2, AU1: 0.12, AU2L: 0.22, AU45: 0.08 },
    eyes: { yaw: 14, pitch: 9, drift: 0.6, refix: { every: [3, 6], reach: [1, 3] } },
    blink: { rate: 10 }, head: { yaw: 6, pitch: 5, roll: 6, follow: 0.6, sway: 0.8 }, stirs: [{ tell: 'eyeSmile', every: [4, 8] }], seconds: 8,
  },
  absorbed: {
    words: ['absorbed', 'turning it over', 'concentrating', 'inward', 'brooding'],
    reads: 'turned inward, working something over: the eyes down and off, one brow drawn, the lips pressed and working',
    face: { AU4R: 0.3, AU4L: 0.08, AU7R: 0.32, AU24: 0.18, AU17: 0.12, AU14R: 0.15 },
    eyes: { yaw: -9, pitch: -11, drift: 0.4, refix: { every: [1.5, 3.5], reach: [1.5, 4] } },
    blink: { rate: 9 }, head: { yaw: -4, pitch: -8, roll: -4, follow: 0.4, sway: 0.4 }, stirs: [{ face: { AU24: 0.2, AU17: 0.15 }, every: [3, 6], up: 0.3, hold: 0.6, down: 0.6 }, { tell: 'knit', every: [4, 7] }], seconds: 8,
  },
  waiting: {
    words: ['waiting', 'bored', 'patient', 'killing time', 'restless'],
    reads: 'patient and a little bored: the eyes wandering, one cheek drawn in, now and then a held sigh in the chin',
    face: { AU14L: 0.2, AU2R: 0.18, AU45: 0.1, AU24: 0.08 }, breath: { sigh: [5, 9] },
    eyes: { yaw: 4, pitch: -3, drift: 0.6, refix: { every: [1.2, 2.8], reach: [3, 9] } },
    blink: { rate: 16 }, head: { roll: 3, follow: 0.6, sway: 1.2 }, stirs: [{ face: { AU17: 0.25, AU24: 0.2, AU14R: 0.15 }, every: [3.5, 6], up: 0.35, hold: 0.5, down: 0.8, head: { roll: -4, pitch: -2 } }], seconds: 8,
  },
  drowsy: {
    words: ['drowsy', 'sleepy', 'nodding off', 'heavy-lidded', 'tired'],
    reads: 'fighting sleep: the lids heavy, one heavier, the brows lifting to hold them, the lids sinking and caught, the blinks slow',
    face: { AU45L: 0.42, AU45R: 0.34, AU1: 0.14, AU2L: 0.26, AU2R: 0.06, AU25: 0.12 }, breath: { rate: 9, depth: 0.6, sigh: [5, 8] },
    eyes: { yaw: 0, pitch: -7, drift: 0.4, refix: null },
    blink: { rate: 9, slow: 2.2 }, head: { pitch: -6, roll: 4, follow: 0.3, sway: 0.5 }, stirs: [{ face: { AU45: 0.65 }, every: [3, 6], up: 0.9, hold: 0.5, down: 0.6, head: { pitch: -10 } }], seconds: 10,
  },
  listening: {
    words: ['listening', 'hearing someone out', 'attentive', 'in conversation', 'paying attention'],
    reads: 'listening to someone close by: the eyes on their face, moving between their eyes and their mouth, the brows a little lifted with interest, a glance away now and then, a smile in the eyes at times',
    face: { AU1: 0.1, AU2L: 0.16, AU2R: 0.08, AU12L: 0.08, AU6L: 0.08 },
    // (a speaker's face a little over a metre off: their eyes about a degree and a half either side and above its middle,
    // their mouth below; a listener looks mostly at the eyes)
    eyes: { yaw: 0, pitch: 0, distance: 1.1, drift: 0.2,
      scan: { points: [[-1.6, 1.3], [1.6, 1.3], [0, -2.6]], weights: [0.4, 0.4, 0.2], dwell: [0.5, 1.4] },
      away: { every: [5, 10], hold: [0.4, 0.9], reach: [7, 14] } },
    blink: { rate: 15 }, head: { pitch: -2, roll: 7, follow: 0.5, sway: 0.6 }, stirs: [{ tell: 'eyeSmile', intensity: 0.5, every: [5, 9] }], seconds: 12,
  },
  wary: {
    words: ['wary', 'on guard', 'watchful', 'uneasy', 'vigilant', 'alert'],
    reads: 'on guard: the eyes on something a few metres off and checking to the sides, the lids up, the brows faintly set, the blinks held back and quick, a narrowing of the eyes now and then',
    face: { AU1: 0.06, AU4R: 0.22, AU7L: 0.2, AU24: 0.12 },
    eyes: { yaw: 0, pitch: -2, distance: 4, drift: 0.3, refix: { every: [1.2, 2.5], reach: [2, 5] } },
    blink: { rate: 12 }, alert: 0.75, head: { pitch: -5, follow: 0.4, sway: 0.2 }, stirs: [{ tell: 'appraise', intensity: 0.6, every: [4, 8] }], seconds: 12,
  },
});
export const FACE_EMOTE_NAMES = Object.freeze(Object.keys(FACE_EMOTES));

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };   // smootherstep
const lerp = (a, b, t) => a + (b - a) * t;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const mod = (t, p) => ((t % p) + p) % p;
const LIMIT = 24;   // (the regard within the look targets' reach, relational-face-rig.js GAZE_TURN)

/** the keys a pulse on `k` lays onto: the unit's sides where the curves hold it by side (a held heavier lid, and a blink
 * over it), else the key itself */
export const sidesOf = (curves, k) => (/^AU\d+$/.test(k) && (curves[`${k}L`] || curves[`${k}R`]) ? [`${k}L`, `${k}R`] : [k]);
/** a state's sides swapped (AU12L ↔ AU12R; a whole unit, a lip, as it is) */
const mirrored = (st) => Object.fromEntries(Object.entries(st).map(([k, v]) => { const [au, s] = auOf(k); return [s === 'L' ? `${au}R` : s === 'R' ? `${au}L` : k, v]; }));

/** Error lines for an emote spec (empty = valid): a name, or { emote, face?, intensity?, mirror?, seconds?, seed?, fps? } */
export function emoteErrors(spec) {
  const S = typeof spec === 'string' ? { emote: spec } : spec;
  if (!S || typeof S !== 'object' || Array.isArray(S)) return [`emote: a name (${FACE_EMOTE_NAMES.join(', ')}) or { emote, face?, intensity?, mirror?, seconds?, seed? }`];
  const errs = [];
  if (!Object.hasOwn(FACE_EMOTES, S.emote)) errs.push(`emote: '${S.emote}' is not an emote (have ${FACE_EMOTE_NAMES.join(', ')})`);
  if (S.face !== undefined) try { composeFace(S.face); } catch (e) { errs.push(`face: ${e.message}`); }
  errs.push(...alertErrors(S.alert));
  if (S.intensity !== undefined && !(Number.isFinite(S.intensity) && S.intensity >= 0 && S.intensity <= 2)) errs.push('intensity: 0 … 2');
  if (S.mirror !== undefined && typeof S.mirror !== 'boolean') errs.push('mirror: true | false');
  if (S.seconds !== undefined && !(Number.isFinite(S.seconds) && S.seconds >= 2 && S.seconds <= 60)) errs.push('seconds: 2 … 60');
  if (S.seed !== undefined && !Number.isInteger(S.seed)) errs.push('seed: an integer');
  if (S.fps !== undefined && !(Number.isInteger(S.fps) && S.fps >= 10 && S.fps <= 120)) errs.push('fps: 10 … 120, whole');
  return errs;
}

/**
 * An emote resolved: { emote, card, face (the held state: the card's, mirrored where asked and scaled by `intensity`,
 * an emotion's face over it where `face` gives one, emotions.js composeFace's spec: the emote the base the emotion
 * adds to, so the face's own unevenness shows through it), stirs (each its face mirrored and scaled), home (the regard,
 * mirrored), eyes, blink }. The loop (`emoteTake`) and a performance's beat (perform.js) play the same resolution.
 */
export function emoteState(spec, { floor = 0 } = {}) {
  const errs = emoteErrors(spec);
  if (errs.length) throw new Error(`emotes: ${errs.join('; ')}`);
  const S = typeof spec === 'string' ? { emote: spec } : spec, C = FACE_EMOTES[S.emote], K = S.intensity ?? 1;
  const side = (st) => (S.mirror ? mirrored(st) : st), scale = (st) => Object.fromEntries(Object.entries(side(st)).map(([k, v]) => [k, clamp01(v * K)]));
  const face = scale(C.face);
  if (S.face !== undefined) for (const [k, v] of Object.entries(composeFace(S.face))) face[k] = clamp01((face[k] ?? 0) + v);
  // (its wariness: the spec's, else the card's, raised by any fear the face holds; alert.js)
  const a = Math.max(S.alert ?? C.alert ?? 0, floor, fearOf(face));
  // (a stir is the card's own units, or an upper-face gesture's, parts.js: `tell`, mirrored with the emote)
  const flipHead = (h) => (h ? { ...h, ...(h.yaw !== undefined ? { yaw: (S.mirror ? -1 : 1) * h.yaw } : {}), ...(h.roll !== undefined ? { roll: (S.mirror ? -1 : 1) * h.roll } : {}) } : undefined);
  const stir = (st) => { if (!st.tell) return { ...st, face: scale(st.face ?? {}), ...(st.head ? { head: flipHead(st.head) } : {}) }; const G = tellOf({ gesture: st.tell, mirror: !!S.mirror, intensity: K * (st.intensity ?? 1) }); return { every: st.every, up: G.up, hold: G.hold, down: G.down, face: G.units, tell: st.tell }; };
  return { emote: S.emote, card: C, face: addState(face, alertFace(a)), stirs: (C.stirs ?? []).map(stir), alert: a,
    home: { yaw: (S.mirror ? -1 : 1) * C.eyes.yaw, pitch: C.eyes.pitch, v: C.eyes.distance ? vergence(C.eyes.distance) : 0 }, flip: S.mirror ? -1 : 1,
    eyes: alertEyes(C.eyes, a), blink: alertBlink(C.blink, a),
    // (its carriage, mirrored with it: the warier, the more the head follows the eyes and the stiller it sways; head.js)
    head: { yaw: 0, pitch: 0, roll: 0, ...flipHead(C.head), follow: Math.min(1, (C.head?.follow ?? 0.5) + 0.4 * a), sway: (C.head?.sway ?? 0.5) * (1 - 0.5 * a) } };
}

/**
 * A regard's fixations from `t0` to `t1` (s), after its home ({ t, yaw, pitch, v (the eyes' convergence, degrees: its
 * focus), away? }): a SCAN over its points (degrees from home, each by its weight, never the same twice running: a
 * listener's eyes moving between a speaker's eyes and mouth), else RE-FIXATIONS within its reach, else its drift alone;
 * and its GLANCES AWAY, the eyes off to a side and unfocused (the far point) and back. `rnd` the caller's dice.
 */
export function regardFixations(E, t0, t1, rnd) {
  const span = (r) => lerp(r[0], r[1], rnd()), eyes = E.eyes, home = E.home, out = [];
  const every = eyes.scan?.dwell ?? eyes.refix?.every ?? [2, 4];
  let nextAway = eyes.away ? t0 + span(eyes.away.every) : Infinity, on = -1;
  // (the first a half interval in: a regard begun is already looking)
  for (let t = t0 + 0.5 * span(every); t < t1 - 0.1;) {
    if (t >= nextAway) {
      const r = span(eyes.away.reach), side = rnd() < 0.5 ? -1 : 1;
      out.push({ t, yaw: home.yaw + side * r, pitch: home.pitch - r * span([0.1, 0.5]), v: eyes.away.distance ? vergence(eyes.away.distance) : 0, away: true });
      t += span(eyes.away.hold); nextAway = t + span(eyes.away.every);
      on = -1; continue;
    }
    if (eyes.scan) {
      // (a point by its weight, never the one the eyes are on)
      const W = eyes.scan.weights.map((w, j) => (j === on ? 0 : w)), sum = W.reduce((a, b) => a + b, 0);
      let x = rnd() * sum, j = 0; while (j < W.length - 1 && (x -= W[j]) > 0) j++;
      on = j; const [py, pp] = eyes.scan.points[j];
      out.push({ t, yaw: home.yaw + E.flip * py, pitch: home.pitch + pp, v: home.v });
    } else if (eyes.refix) {
      const r = span(eyes.refix.reach), a = 2 * Math.PI * rnd();
      out.push({ t, yaw: home.yaw + r * Math.cos(a), pitch: home.pitch + 0.6 * r * Math.sin(a), v: home.v });
    } else out.push({ t, yaw: home.yaw + eyes.drift * (2 * rnd() - 1), pitch: home.pitch + eyes.drift * (2 * rnd() - 1), v: home.v });
    t += span(every);
  }
  return out;
}

/**
 * An emote played as a loop: { fps, seconds, frames, curves, gaze: { yaw, pitch }, events: { blinks, saccades, stirs },
 * loop: true, emote }. `spec` is a name or { emote, face? (an emotion over it: `emoteState`), intensity? (1: the card's
 * face and stirs, not the blinks), mirror? (the sides swapped, the regard to the other side), seconds? (the card's),
 * seed? (1), fps? (60) }.
 */
export function emoteTake(spec) {
  const E = emoteState(spec), S = typeof spec === 'string' ? { emote: spec } : spec, C = E.card;
  const fps = S.fps ?? CAPTURE_FPS, rnd = mulberry32((S.seed ?? 1) >>> 0);
  const N = Math.max(2, Math.round((S.seconds ?? C.seconds) * fps)), P = N / fps, n = N + 1, tOf = (i) => (i % N) / fps;
  const span = (r) => lerp(r[0], r[1], rnd());
  // (a wave that turns a whole number of times in the loop, near the frequency asked)
  const wave = (hz) => [(2 * Math.PI * Math.max(1, Math.round(hz * P))) / P, 2 * Math.PI * rnd()];
  // THE HELD FACE, living: each unit its two slow waves (the moving hold, perform.js's), whole cycles in the loop
  const curves = {};
  for (const [k, v] of Object.entries(E.face).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const H = PARTS[partOf(k)].hold, W = H.hz.map((r) => wave(span(r)));
    curves[k] = Array.from({ length: n }, (_, i) => clamp01(v * (1 + H.share * W.reduce((m, [w, ph]) => m + Math.sin(w * tOf(i) + ph), 0) / W.length)));
  }
  // (a pulse laid round the loop over a unit's curve: the greater of the two)
  const layer = (k0, t0, up, hold, down, peak) => {
    // (a whole unit's pulse on each side where the face holds the unit by side: a blink over a heavier lid shuts it once)
    for (const k of sidesOf(curves, k0)) layerOne(k, t0, up, hold, down, peak);
  };
  const layerOne = (k, t0, up, hold, down, peak) => {
    const c = curves[k] || (curves[k] = new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      const t = mod(tOf(i) - t0, P);
      if (t > up + hold + down) continue;
      const v = peak * (t < up ? ease(t / up) : t < up + hold ? 1 : 1 - ease((t - up - hold) / down));
      if (v > c[i]) c[i] = v;
    }
  };
  // (moments round the loop: from a start, each the last's end plus a gap, the last kept only if it clears the first)
  const round = (first, len, gap) => {
    const at = [];
    for (let t = first; t + len < P; t += len + gap()) at.push(t);
    while (at.length > 1 && at.at(-1) + len + 0.3 > at[0] + P) at.pop();
    return at;
  };
  const events = { blinks: [], saccades: [], stirs: [] };
  // THE STIRS: a moment the held face moves (a lip pressed, the lids sinking and caught), then settles back
  const headPulses = [];
  for (const st of E.stirs) {
    const len = st.up + st.hold + st.down;
    for (const t of round(span([0.5, 2]), len, () => span(st.every))) {
      for (const [k, v] of Object.entries(st.face)) layer(k, t, st.up, st.hold, st.down, v);
      if (st.head) headPulses.push({ t, up: st.up, hold: st.hold, down: st.down, ...st.head });
      events.stirs.push({ t: r4(t), dur: r4(len), ...(st.tell ? { tell: st.tell } : {}) });
    }
  }
  // THE REGARD: home, focused at its distance (else the far point); its scan, re-fixations or drift and its glances away
  // round the loop (the last kept only if it clears the first), saccades on the main sequence, the focus following
  // slower; a slow drift of whole cycles
  const home = E.home, fix = E.eyes.refix || E.eyes.scan || E.eyes.away ? regardFixations(E, 0, P, rnd) : [];
  while (fix.length > 1 && fix.at(-1).t + 0.3 > fix[0].t + P) fix.pop();
  const drift = { yaw: [wave(span([0.05, 0.15])), wave(span([0.2, 0.4]))], pitch: [wave(span([0.05, 0.15])), wave(span([0.2, 0.4]))] };
  const wander = (ws, t) => (E.eyes.drift * ws.reduce((m, [w, ph]) => m + Math.sin(w * t + ph), 0)) / ws.length;
  const yaw = new Array(n), pitch = new Array(n), verg = new Array(n).fill(home.v);
  for (let i = 0; i < n; i++) {
    const t = tOf(i);
    let at = { ...home };
    if (fix.length) {
      // (the fixation the eyes are on: the last begun, round the loop; mid-saccade, between it and the one before; the
      // focus easing from the one before's over EYES.verge)
      let k = fix.length - 1; for (let j = 0; j < fix.length; j++) if (fix[j].t <= t) k = j;
      const to = fix[k], from = fix[(k - 1 + fix.length) % fix.length], amp = Math.hypot(to.yaw - from.yaw, to.pitch - from.pitch);
      const since = mod(t - to.t, P), u = since / (GAZE.saccade.base + GAZE.saccade.perDeg * amp);
      at = u >= 1 ? to : { yaw: lerp(from.yaw, to.yaw, ease(u)), pitch: lerp(from.pitch, to.pitch, ease(u)) };
      verg[i] = lerp(from.v, to.v, ease(since / EYES.verge));
    }
    yaw[i] = Math.max(-LIMIT, Math.min(LIMIT, at.yaw + wander(drift.yaw, t)));
    pitch[i] = Math.max(-LIMIT, Math.min(LIMIT, at.pitch + wander(drift.pitch, t)));
  }
  fix.forEach((f, k) => { const p = fix[(k - 1 + fix.length) % fix.length], amp = Math.hypot(f.yaw - p.yaw, f.pitch - p.pitch); if (amp > 0.5) events.saccades.push({ t: r4(f.t), dur: r4(GAZE.saccade.base + GAZE.saccade.perDeg * amp), amp: r4(amp) }); });
  // THE HEAD (head.js): its carriage and sway (whole cycles round the loop), its stirs, following the larger looks; the
  // eyes kept on the gaze by turning back in the head
  const hw = () => [wave(span([0.05, 0.12])), wave(span([0.15, 0.3]))], waves = { yaw: hw(), pitch: hw(), roll: hw() };
  const head = headTake({ gaze: { yaw, pitch }, pose: () => E.head, pulses: headPulses, n, fps, loop: true, waves });
  for (let i = 0; i < n; i++) { yaw[i] = head.eyes.yaw[i]; pitch[i] = head.eyes.pitch[i]; }
  // THE LOOK MOVES THE FACE: the lids and brows following the eye, a large glance's moment of widened lids (parts.js)
  lookLids(curves, pitch, n);
  lookPulses(events.saccades, () => E.alert, layer);
  // THE COUPLINGS: the cheek's raise under the lower lid, the brow's weight on the lid (parts.js)
  couple(curves, n);
  // THE BREATH (breath.js): whole breaths round the loop at the state's rate, the card's sighs among them (each clear of
  // the seam), on the face: through the mouth the warier, a sigh's lifted brows and parted lips
  const own = C.breath ?? {}, BS = breathOf(E.face, E.alert, own);
  const sighs = BS.sigh ? round(span(BS.sigh) * 0.5, SIGH_SECONDS, () => span(BS.sigh)) : [];
  const breath = breathTake({ n, fps, at: () => BS, sighs, loop: true });
  breathFace(curves, breath, { n, fps, wrap: true });
  if (sighs.length) events.sighs = sighs.map(r4);
  // THE BLINKS at the card's rate (its wariness's: alert.js), closing fast and opening slower (perform.js's), `slow` times
  // as long; and a large gaze shift may take one (more the warier), where it clears the others
  const slow = E.blink.slow ?? 1, mean = 60 / E.blink.rate;
  const blink = () => [span(BLINK.close) * slow, span(BLINK.shut) * slow, span(BLINK.open) * slow];
  const longest = (BLINK.close[1] + BLINK.shut[1] + BLINK.open[1]) * slow;
  for (const t of round(span([0.2, 1.5]), longest, () => Math.max(BLINK.gap, mean * (0.35 + 1.3 * rnd())))) {
    const [c, s, o] = blink();
    layer('AU45', t, c, s, o, 1);
    events.blinks.push({ t: r4(t), dur: r4(c + s + o), cause: 'spontaneous' });
  }
  const shift = E.blink.shift ?? 0;
  if (shift > 0) for (const sac of events.saccades) {
    if (sac.amp < BLINK.shiftDeg || !(rnd() < shift)) continue;
    if (events.blinks.some((b) => Math.min(mod(sac.t - b.t, P), mod(b.t - sac.t, P)) < BLINK.gap)) continue;
    const [c, s2, o] = blink();
    layer('AU45', sac.t, c, s2, o, 1);
    events.blinks.push({ t: sac.t, dur: r4(c + s2 + o), cause: 'gaze' });
  }
  return {
    fps, seconds: r4(P), frames: n, loop: true, emote: S.emote,
    curves: Object.fromEntries(Object.keys(curves).sort().map((k) => [k, curves[k].map(r4)])),
    gaze: { yaw: yaw.map(r4), pitch: pitch.map(r4), ...(verg.some((v) => v > 0) ? { vergence: verg.map(r4) } : {}) },
    breath: { v: breath.v.map(r4), high: breath.high.map(r4) },
    head: { yaw: head.yaw.map(r4), pitch: head.pitch.map(r4), roll: head.roll.map(r4) }, events,
  };
}

/**
 * The hero door's `emote` → its clips ({ <clip>: an emote spec }): a name (one clip, named by it), a list of names
 * (one each), or { <clip>: a name | { emote, intensity?, mirror?, seconds?, seed? } }. Throws by name on a bad one
 * (`emoteClipErrors` the lines).
 */
export function emoteClips(door) {
  const errs = emoteClipErrors(door);
  if (errs.length) throw new Error(`emotes: ${errs.join('; ')}`);
  return typeof door === 'string' ? { [door]: door } : Array.isArray(door) ? Object.fromEntries(door.map((e) => [e, e])) : { ...door };
}
export function emoteClipErrors(door) {
  const shape = `emote: a name (${FACE_EMOTE_NAMES.join(', ')}), a list of names, or { <clip>: a name | { emote, intensity?, mirror?, seconds?, seed? } }`;
  if (typeof door === 'string') return emoteErrors(door);
  if (Array.isArray(door)) return door.length ? door.flatMap((e, i) => (typeof e === 'string' ? emoteErrors(e).map((x) => `[${i}].${x}`) : [`[${i}]: a name`])) : [shape];
  if (!door || typeof door !== 'object' || !Object.keys(door).length) return [shape];
  return Object.entries(door).flatMap(([clip, s]) => (/^[A-Za-z][A-Za-z0-9_-]{0,31}$/.test(clip) ? emoteErrors(s).map((x) => `${clip}.${x}`) : [`${clip}: a clip's name is a word (letters, digits, - and _)`]));
}
