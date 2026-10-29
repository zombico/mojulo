/**
 * emotes — the face's HELD STATES: what a face does when nothing is happening to it, as a loop that lives. An emotion
 * (emotions.js) is what a face reads as; an emote is a state a face sits in, its units held, its eyes on their regard,
 * its blinks at its own rate, and now and then a stir (a lip pressed, the lids sinking and caught). Each is a CARD, and
 * every card is general: any realistic face plays any emote, and a new emote is a card, not code.
 *
 * A CARD: { words (what people call it), reads (what it shows), face (a FACS state, each side its own: an emote is
 * asymmetric by construction, as a face at rest is), eyes: { yaw, pitch (degrees, the regard's home), drift (degrees,
 * the eyes' slow wander), refix: { every: [s, s], reach: [deg, deg] } | null (the small re-fixations of eyes on
 * nothing) }, blink: { rate (a minute), slow? (× the blink's length) }, stirs?: [{ face, every: [s, s], up, hold, down
 * (s) }], seconds (the loop) }.
 *
 *   • THE REGARD is the far point: no distance, the eyes parallel (gaze.js), looking at nothing and never cross-eyed.
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
import { BLINK, MOVING_HOLD, GAZE, CAPTURE_FPS } from './perform.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';

export const FACE_EMOTES = Object.freeze({
  rest: {
    words: ['resting face', 'at rest', 'neutral', 'blank', 'idle'],
    reads: 'nothing on it but the face\'s own unevenness: one brow a touch higher, a corner a touch lower, a lid a touch heavier; looking at nothing',
    face: { AU2L: 0.12, AU4R: 0.08, AU45R: 0.08, AU15R: 0.1, AU12L: 0.06, AU24: 0.06 },
    eyes: { yaw: 0, pitch: -4, drift: 0.5, refix: { every: [2.5, 5], reach: [1, 3] } },
    blink: { rate: 14 }, seconds: 8,
  },
  vacant: {
    words: ['zoned out', 'vacant', 'spaced out', 'thousand-yard stare', 'blank stare'],
    reads: 'nobody home: the lids a little heavy, the lips just apart, the eyes still on nothing and seldom blinking',
    face: { AU45L: 0.22, AU45R: 0.16, AU25: 0.14, AU26: 0.03, AU1: 0.06, AU2R: 0.08 },
    eyes: { yaw: 0, pitch: -2, drift: 0.3, refix: null },
    blink: { rate: 7, slow: 1.3 }, seconds: 8,
  },
  daydream: {
    words: ['daydreaming', 'lost in thought', 'far away', 'wistful', 'dreamy'],
    reads: 'far away and pleasantly so: the eyes up and off, a half smile on one side, the brows a little lifted',
    face: { AU12L: 0.22, AU6L: 0.08, AU1: 0.12, AU2L: 0.22, AU45: 0.08 },
    eyes: { yaw: 14, pitch: 9, drift: 0.6, refix: { every: [3, 6], reach: [1, 3] } },
    blink: { rate: 10 }, seconds: 8,
  },
  absorbed: {
    words: ['absorbed', 'turning it over', 'concentrating', 'inward', 'brooding'],
    reads: 'turned inward, working something over: the eyes down and off, one brow drawn, the lips pressed and working',
    face: { AU4R: 0.3, AU4L: 0.08, AU7R: 0.2, AU24: 0.18, AU17: 0.12, AU14R: 0.15 },
    eyes: { yaw: -9, pitch: -11, drift: 0.4, refix: { every: [1.5, 3.5], reach: [1.5, 4] } },
    blink: { rate: 9 }, stirs: [{ face: { AU24: 0.2, AU17: 0.15 }, every: [3, 6], up: 0.3, hold: 0.6, down: 0.6 }], seconds: 8,
  },
  waiting: {
    words: ['waiting', 'bored', 'patient', 'killing time', 'restless'],
    reads: 'patient and a little bored: the eyes wandering, one cheek drawn in, now and then a held sigh in the chin',
    face: { AU14L: 0.2, AU2R: 0.18, AU45: 0.1, AU24: 0.08 },
    eyes: { yaw: 4, pitch: -3, drift: 0.6, refix: { every: [1.2, 2.8], reach: [3, 9] } },
    blink: { rate: 16 }, stirs: [{ face: { AU17: 0.25, AU24: 0.2, AU14R: 0.15 }, every: [3.5, 6], up: 0.35, hold: 0.5, down: 0.8 }], seconds: 8,
  },
  drowsy: {
    words: ['drowsy', 'sleepy', 'nodding off', 'heavy-lidded', 'tired'],
    reads: 'fighting sleep: the lids heavy, one heavier, the brows lifting to hold them, the lids sinking and caught, the blinks slow',
    face: { AU45L: 0.42, AU45R: 0.34, AU1: 0.14, AU2L: 0.16, AU2R: 0.08, AU25: 0.12 },
    eyes: { yaw: 0, pitch: -7, drift: 0.4, refix: null },
    blink: { rate: 9, slow: 2.2 }, stirs: [{ face: { AU45: 0.65 }, every: [3, 6], up: 0.9, hold: 0.5, down: 0.6 }], seconds: 10,
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
export function emoteState(spec) {
  const errs = emoteErrors(spec);
  if (errs.length) throw new Error(`emotes: ${errs.join('; ')}`);
  const S = typeof spec === 'string' ? { emote: spec } : spec, C = FACE_EMOTES[S.emote], K = S.intensity ?? 1;
  const side = (st) => (S.mirror ? mirrored(st) : st), scale = (st) => Object.fromEntries(Object.entries(side(st)).map(([k, v]) => [k, clamp01(v * K)]));
  const face = scale(C.face);
  if (S.face !== undefined) for (const [k, v] of Object.entries(composeFace(S.face))) face[k] = clamp01((face[k] ?? 0) + v);
  return { emote: S.emote, card: C, face, stirs: (C.stirs ?? []).map((st) => ({ ...st, face: scale(st.face) })),
    home: { yaw: (S.mirror ? -1 : 1) * C.eyes.yaw, pitch: C.eyes.pitch }, eyes: C.eyes, blink: C.blink };
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
    const W = MOVING_HOLD.hz.map((r) => wave(span(r)));
    curves[k] = Array.from({ length: n }, (_, i) => clamp01(v * (1 + MOVING_HOLD.share * W.reduce((m, [w, ph]) => m + Math.sin(w * tOf(i) + ph), 0) / W.length)));
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
  for (const st of E.stirs) {
    const len = st.up + st.hold + st.down;
    for (const t of round(span([0.5, 2]), len, () => span(st.every))) {
      for (const [k, v] of Object.entries(st.face)) layer(k, t, st.up, st.hold, st.down, v);
      events.stirs.push({ t: r4(t), dur: r4(len) });
    }
  }
  // THE BLINKS at the card's rate, closing fast and opening slower (perform.js's), `slow` times as long
  const slow = C.blink.slow ?? 1, mean = 60 / C.blink.rate;
  const blink = () => [span(BLINK.close) * slow, span(BLINK.shut) * slow, span(BLINK.open) * slow];
  const longest = (BLINK.close[1] + BLINK.shut[1] + BLINK.open[1]) * slow;
  for (const t of round(span([0.2, 1.5]), longest, () => Math.max(BLINK.gap, mean * (0.35 + 1.3 * rnd())))) {
    const [c, s, o] = blink();
    layer('AU45', t, c, s, o, 1);
    events.blinks.push({ t: r4(t), dur: r4(c + s + o), cause: 'spontaneous' });
  }
  // THE REGARD: home, the far point; re-fixations near it, saccades on the main sequence; a slow drift of whole cycles
  const home = E.home, fix = [];
  if (C.eyes.refix) for (const t of round(span(C.eyes.refix.every) * 0.5, 0.1, () => span(C.eyes.refix.every))) {
    const r = span(C.eyes.refix.reach), a = 2 * Math.PI * rnd();
    fix.push({ t, yaw: home.yaw + r * Math.cos(a), pitch: home.pitch + 0.6 * r * Math.sin(a) });
  }
  const drift = { yaw: [wave(span([0.05, 0.15])), wave(span([0.2, 0.4]))], pitch: [wave(span([0.05, 0.15])), wave(span([0.2, 0.4]))] };
  const wander = (ws, t) => (C.eyes.drift * ws.reduce((m, [w, ph]) => m + Math.sin(w * t + ph), 0)) / ws.length;
  const yaw = new Array(n), pitch = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = tOf(i);
    let at = { ...home };
    if (fix.length) {
      // (the fixation the eyes are on: the last begun, round the loop; mid-saccade, between it and the one before)
      let k = fix.length - 1; for (let j = 0; j < fix.length; j++) if (fix[j].t <= t) k = j;
      const to = fix[k], from = fix[(k - 1 + fix.length) % fix.length], amp = Math.hypot(to.yaw - from.yaw, to.pitch - from.pitch);
      const u = mod(t - to.t, P) / (GAZE.saccade.base + GAZE.saccade.perDeg * amp);
      at = u >= 1 ? to : { yaw: lerp(from.yaw, to.yaw, ease(u)), pitch: lerp(from.pitch, to.pitch, ease(u)) };
    }
    yaw[i] = Math.max(-LIMIT, Math.min(LIMIT, at.yaw + wander(drift.yaw, t)));
    pitch[i] = Math.max(-LIMIT, Math.min(LIMIT, at.pitch + wander(drift.pitch, t)));
  }
  fix.forEach((f, k) => { const p = fix[(k - 1 + fix.length) % fix.length], amp = Math.hypot(f.yaw - p.yaw, f.pitch - p.pitch); if (amp > 0.5) events.saccades.push({ t: r4(f.t), dur: r4(GAZE.saccade.base + GAZE.saccade.perDeg * amp), amp: r4(amp) }); });
  return {
    fps, seconds: r4(P), frames: n, loop: true, emote: S.emote,
    curves: Object.fromEntries(Object.keys(curves).sort().map((k) => [k, curves[k].map(r4)])),
    gaze: { yaw: yaw.map(r4), pitch: pitch.map(r4) }, events,
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
