/**
 * perform — the FACE ACTING, as a facial capture session records it: a performance described in beats becomes per-frame
 * curves of FACS action units (facs.js), the eyes' gaze, and the events a capture shows (the blinks, the saccades, a
 * micro-expression, a brow flash). The nonverbal face: what it feels, where it looks, how it lives between the beats.
 *
 * A PERFORMANCE: { beats: [{ at (s), face (emotions.js composeFace's spec: a word, a blend, a mask …), onset?
 * ('spontaneous' | 'posed' | seconds), gaze? ('listener' | 'away' | 'down' | 'up' | { yaw, pitch, distance? } degrees and
 * metres: the eyes focus at the distance, gaze.js; the listener at a conversation's), state?
 * ('listening' | 'speaking' | 'thinking' | 'attentive'), flash? (a brow flash on the beat), micro? (a face spec flashed
 * for a fifth of a second), microAt? (s, its time; the beat's by default), say? (a line spoken from the beat: speech.js,
 * a text or { text | phonemes, rate?, articulation? }, or a RECORDED line as the door keeps it, { recording, seconds,
 * timing, phonemes | envelope, words? } (recordings.js bindLine): its phonemes on the recording's own timeline, the
 * recording starting with the beat; the beat's state speaking unless it says another), emote? (a held state, emotes.js: a
 * name or { emote, mirror?, intensity? }; the base the beat's `face` adds to, its regard where the beat names no gaze, its
 * blinks' rate and pace but while speaking, its stirs, until the next beat), tell? (an upper-face gesture, parts.js
 * UPPER_GESTURES: a name, { gesture, at?, mirror?, intensity? } or a list: a one-sided brow, the smile in the eyes, an
 * appraising squint …, laid over the face from the beat or its own `at`), alert? (0 calm … 1 on guard, alert.js: carried
 * to the beats after it), startle? (a startle on the beat: the reflex blink, then the eyes wide) }], alert? (the
 * performance's wariness, 0 … 1), seconds?,
 * intensity? (1), seed? (1), fps? (60) }. Each beat holds until the next; the take ends `seconds` in (else two seconds
 * past the last beat or the last line's end, whichever is later).
 *
 *   • THE PARTS (parts.js): the brows, the lids, the cheeks and the mouth each move on their own timing (the brows lead,
 *     the lids go quickest, the cheeks lag the smile and settle slowest) and live in a hold their own way; the cheek
 *     raised pushes the lower lid up, a lowered brow bears on the lid, the outer brow lifts it, frame by frame.
 *   • THE DYNAMICS (FACS's: an expression has an onset, an apex and an offset): a SPONTANEOUS change eases in over a
 *     third to three fifths of a second and out more slowly; a POSED one snaps in within a fifth. Each unit's timing and
 *     its apex are jittered a little (seeded), so the units never move in lockstep, as no face's do.
 *   • THE THOUGHT LEADS (the eyes and the brows before the mouth: Williams; Ekman's own timing of felt expressions): the
 *     upper face's units start `lead` seconds before the lower's, and the gaze shifts with them.
 *   • A MICRO-EXPRESSION (Ekman and Friesen; Haggard and Isaacs): a felt face leaking for at most a fifth of a second,
 *     laid over the face; a BROW FLASH (Eibl-Eibesfeldt): the brows up and down in about a third of a second, the
 *     greeting's and the emphasis's.
 *   • THE BLINKS: spontaneous blinks at the state's rate (people blink more speaking than listening, least attending or
 *     reading: Bentivoglio et al.), each closing fast and opening slower (`BLINK`), and the blinks a mind makes: one at a
 *     thought's close (a beat's change) and one with a large gaze shift, each by chance; none through a brow flash.
 *   • THE MOVING HOLD: a held expression is never dead still; each unit lives a few hundredths of its height in slow
 *     waves of its own.
 *   • THE LINES SPOKEN (speech.js): the mouth speaks over the face. Speech owns the jaw and the lips' shapes; the face's
 *     own mouth gives way where they cannot both be (mouth.js `MOUTH`, the ownership: a rounded lip draws the smile's and
 *     the stretch's corners in; a pressed, tightened or sucked lip, and the face's own jaw, let go while the line runs), and keeps the rest: the
 *     brows, the eyes, the corners' set. An emphasized word lifts the brows (Ekman's baton), and a sentence's close may
 *     take a blink.
 *   • WARINESS (alert.js): a performance's, a beat's, or the fear a face holds: the spontaneous blinks thin and quicken,
 *     more of them ride the gaze's shifts, the eyes CHECK their surroundings (glances off, focused), the lids rise and
 *     the brows take fear's set a little; a STARTLE blinks hard and the eyes fly wide. And THE LOOK moves the face
 *     (parts.js): the upper lid follows the eye down and lifts looking up, a large glance widens the lids for a moment.
 *   • THE GAZE: fixations with a little drift, saccades between them timed by the main sequence (a saccade's duration
 *     grows with its amplitude: about 21 ms plus 2.2 ms a degree), the eyes away while thinking (gaze aversion while
 *     retrieving), on the listener while listening, glancing off now and then while speaking.
 *
 * Seeded (mulberry32), pure and deterministic: the same performance and seed give the same take. `captureFrame` reads a
 * frame back as a FACS state (the curves summed per unit and side), for the rig's weights (relational-face-rig.js
 * facsWeights).
 */
import { composeFace } from './emotions.js';
import { auOf } from './facs.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { speak, speechErrors } from './speech.js';
import { MOUTH, overMouth } from './mouth.js';
import { emoteErrors, emoteState, sidesOf, regardFixations } from './emotes.js';
import { vergence, EYES } from './gaze.js';
import { PARTS, partOf, couple, tellErrors, tellOf, lookLids, lookPulses } from './parts.js';
import { ALERT, STARTLE, fearOf, alertFace, alertBlink, alertErrors, addState } from './alert.js';

export const CAPTURE_FPS = 60;
/** a change's timing, seconds: [shortest, longest], the onset rising, the offset falling; the upper face's lead */
export const DYNAMICS = Object.freeze({
  spontaneous: Object.freeze({ onset: [0.35, 0.6], offset: [0.45, 0.9] }),
  posed: Object.freeze({ onset: [0.12, 0.2], offset: [0.2, 0.3] }),
  lead: 0.12, jitter: Object.freeze({ time: 0.06, gain: 0.08 }),
});
/** the MOVING HOLD: a held unit lives, a share of its own height (`share`) in two slow waves (their frequencies, Hz),
 * seeded per unit, so no expression is held dead still and a unit at rest stays at rest; the mouth's, each other part
 * its own (parts.js PARTS) */
export const MOVING_HOLD = PARTS.mouth.hold;
/** a micro-expression's onset, hold and offset (s): a fifth of a second whole */
export const MICRO = Object.freeze({ onset: 0.05, hold: 0.1, offset: 0.05 });
/** speech over the face: how far a rounded lip (the pucker's, the funnel's) draws in the face's corners (the smile, the
 * dimple, the stretch), how far the line lets go of the face's closing units and its jaw, the line's envelope's ease (s);
 * an emphasized word's baton (the brows' heights, its rise and fall, s, its hold a share of the word); a sentence's
 * blink's chance */
export const SPEAKING = Object.freeze({ round: MOUTH.round, release: MOUTH.release, ease: MOUTH.ease, baton: Object.freeze({ AU1: 0.3, AU2: 0.35, rise: 0.12, hold: 0.6, fall: 0.2 }), phrase: 0.5 });
/** a brow flash: its units' heights, its rise, hold and fall (s) */
export const BROW_FLASH = Object.freeze({ AU1: 0.6, AU2: 0.7, rise: 0.1, hold: 0.15, fall: 0.15 });
/** the blinks: the spontaneous rate a minute by state, a blink's closing, shut and opening (s, [min, max]), the least
 * gap between two (s), and the mind's blinks' chances: at a beat's change, with a gaze shift over `shiftDeg` */
export const BLINK = Object.freeze({
  rate: Object.freeze({ listening: 15, speaking: 24, thinking: 10, attentive: 8 }),
  close: [0.07, 0.1], shut: [0.03, 0.06], open: [0.12, 0.2], gap: 0.6, beat: 0.5, shift: 0.6, shiftDeg: 15,
});
/** the gaze: named targets (degrees: +yaw the figure's right, +pitch up; the listener a face across a conversation, the
 * eyes focused on it, the rest at the far point), aversion's reach, the drift (its period and
 * size), the main sequence (s: base + perDeg × amplitude), a speaker's glances (how often, how long) */
export const GAZE = Object.freeze({
  listener: Object.freeze({ yaw: 0, pitch: 0, distance: 1.1 }), down: Object.freeze({ yaw: 0, pitch: -15 }), up: Object.freeze({ yaw: 0, pitch: 12 }),
  away: Object.freeze({ yaw: [12, 22], pitch: [-6, 10] }), drift: Object.freeze({ every: [0.4, 1.2], deg: 0.8 }),
  saccade: Object.freeze({ base: 0.021, perDeg: 0.0022 }), glance: Object.freeze({ every: [3, 6], hold: [0.5, 1.1], chance: 0.35 }),
});

const STATES = Object.keys(BLINK.rate);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };                 // smootherstep
const snap = (x) => { const t = clamp01(x); return 1 - (1 - t) ** 3; };                                      // fast attack
const lerp = (a, b, t) => a + (b - a) * t;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** Error lines for a performance (empty = valid). */
export function performanceErrors(P) {
  const errs = [];
  if (!P || typeof P !== 'object' || !Array.isArray(P.beats) || !P.beats.length) return ['performance: { beats: [{ at, face, … }], seconds?, intensity?, seed?, fps? }'];
  P.beats.forEach((b, i) => {
    const at = `beats[${i}]`;
    if (!Number.isFinite(b.at) || b.at < 0) errs.push(`${at}.at: seconds, 0 or more`);
    try { composeFace(b.face ?? 'neutral'); } catch (e) { errs.push(`${at}.face: ${e.message}`); }
    if (b.micro !== undefined) try { composeFace(b.micro); } catch (e) { errs.push(`${at}.micro: ${e.message}`); }
    if (b.state !== undefined && !STATES.includes(b.state)) errs.push(`${at}.state: one of ${STATES.join(', ')}`);
    if (b.onset !== undefined && !(b.onset === 'spontaneous' || b.onset === 'posed' || (Number.isFinite(b.onset) && b.onset > 0))) errs.push(`${at}.onset: 'spontaneous' | 'posed' | seconds`);
    if (b.say !== undefined) errs.push(...speechErrors(b.say).map((e) => `${at}.${e}`));
    if (b.emote !== undefined) errs.push(...emoteErrors(b.emote).map((e) => `${at}.${e}`));
    if (b.tell !== undefined) for (const T of [b.tell].flat()) errs.push(...tellErrors(T).map((e) => `${at}.${e}`));
    errs.push(...alertErrors(b.alert, `${at}.alert`));
    if (b.startle !== undefined && typeof b.startle !== 'boolean') errs.push(`${at}.startle: true | false`);
    // (a recording is saved by the character door, which keeps its id: a path here would play nothing)
    if (b.say && typeof b.say === 'object' && b.say.audio !== undefined) errs.push(`${at}.say.audio: a recording is saved by the door (create_character or update_character, recordings.js), which keeps its id; a performance holds no path`);
    const g = b.gaze;
    if (g !== undefined && !(typeof g === 'string' ? ['listener', 'away', 'down', 'up'].includes(g) : g && Number.isFinite(g.yaw) && Number.isFinite(g.pitch) && (g.distance === undefined || (Number.isFinite(g.distance) && g.distance > 0)))) errs.push(`${at}.gaze: 'listener' | 'away' | 'down' | 'up' | { yaw, pitch, distance? (m) }`);
  });
  if (P.seconds !== undefined && !(Number.isFinite(P.seconds) && P.seconds > 0)) errs.push('seconds: more than 0');
  errs.push(...alertErrors(P.alert));
  return errs;
}

/**
 * The take: { fps, seconds, frames, curves: { AUxx[L|R]: [value per frame] }, gaze: { yaw: [], pitch: [] } (degrees),
 * events: { blinks: [{ t, dur, cause }], saccades: [{ t, dur, amp }], micro: [{ t, dur }], flashes: [{ t }] } }.
 */
export function perform(P) {
  const errs = performanceErrors(P);
  if (errs.length) throw new Error(`perform: ${errs.join('; ')}`);
  const fps = P.fps ?? CAPTURE_FPS, rnd = mulberry32((P.seed ?? 1) >>> 0), K = P.intensity ?? 1;
  const span = (r) => lerp(r[0], r[1], rnd());
  // (a beat's held state: an emote's face, the beat's own face over it, or the face alone)
  const held = (b, floor) => b.emote === undefined ? null : emoteState({ ...(typeof b.emote === 'string' ? { emote: b.emote } : b.emote), ...(b.face !== undefined ? { face: b.face } : {}) }, { floor });
  // (each beat's wariness, alert.js: the performance's, a beat's own carried on, a startle's floor for its beat, raised
  // by any fear its face holds; the wariness's face over its own)
  let carry = P.alert ?? 0;
  const beats = [...P.beats].sort((a, b) => a.at - b.at).map((b) => {
    if (b.alert !== undefined) carry = b.alert;
    const floor = Math.max(carry, b.startle ? STARTLE.leaves : 0), E = held(b, floor);
    const S0 = E ? E.face : composeFace(b.face ?? 'neutral'), a = E ? E.alert : Math.max(floor, fearOf(S0));
    return { ...b, ...(b.say !== undefined && !b.state ? { state: 'speaking' } : {}), ...(E ? { E } : {}), a, S: Object.fromEntries(Object.entries(E ? S0 : addState(S0, alertFace(a))).map(([k, v]) => [k, clamp01(v * K)])) };
  });
  // (the lines, each spoken from its beat)
  const lines = beats.filter((b) => b.say !== undefined).map((b) => ({ at: b.at, say: b.say, take: speak(b.say, { fps }) }));
  const seconds = P.seconds ?? Math.max(beats.at(-1).at + 2, ...lines.map((L) => L.at + L.take.seconds + 0.5)), n = Math.max(1, Math.round(seconds * fps) + 1), tOf = (i) => i / fps;
  const keys = [...new Set(beats.flatMap((b) => Object.keys(b.S)))].sort();
  const curves = {};
  // THE UNITS: each a chain of transitions, one a beat, from where the unit is when it starts to the beat's apex
  for (const k of keys) {
    // (the unit's part: its lead before the beat, its pace, its hold)
    const part = PARTS[partOf(k)], tr = [];
    let prevTarget = 0;
    for (const b of beats) {
      const to = clamp01((b.S[k] ?? 0) * (1 + DYNAMICS.jitter.gain * (2 * rnd() - 1)));
      if (Math.abs(to - prevTarget) < 1e-6) { prevTarget = to; rnd(); continue; }
      const mode = typeof b.onset === 'number' ? null : DYNAMICS[b.onset ?? 'spontaneous'];
      const dur = typeof b.onset === 'number' ? b.onset : span(to > prevTarget ? mode.onset : mode.offset) * part.pace;
      const t0 = Math.max(0, b.at - part.lead + DYNAMICS.jitter.time * (2 * rnd() - 1));
      tr.push({ t0, t1: t0 + dur, to, shape: b.onset === 'posed' && to > prevTarget ? snap : ease });
      prevTarget = to;
    }
    // (evaluated in order: a transition starts from the value the one before left at its start; then the moving hold)
    const waves = part.hold.hz.map((r) => [2 * Math.PI * span(r), 2 * Math.PI * rnd()]);
    const live = (t) => 1 + part.hold.share * waves.reduce((m, [w, ph]) => m + Math.sin(w * t + ph), 0) / waves.length;
    const vals = new Array(n);
    let j = -1, from = 0, cur = 0;
    for (let i = 0; i < n; i++) {
      const t = tOf(i);
      while (j + 1 < tr.length && tr[j + 1].t0 <= t) { from = cur; j++; }
      if (j >= 0) { const T = tr[j]; cur = t >= T.t1 ? T.to : lerp(from, T.to, T.shape((t - T.t0) / (T.t1 - T.t0))); }
      vals[i] = clamp01(cur * live(t));
    }
    curves[k] = vals;
  }
  const layer = (k0, t0, up, hold, down, peak) => {
    // (a pulse laid over a unit's curve: the greater of the two; a whole unit's on each side where the face holds the unit
    // by side, so a blink over a heavier lid shuts it once, never past shut)
    for (const k of sidesOf(curves, k0)) layerOne(k, t0, up, hold, down, peak);
  };
  const layerOne = (k, t0, up, hold, down, peak) => {
    const c = curves[k] || (curves[k] = new Array(n).fill(0));
    for (let i = Math.max(0, Math.floor(t0 * fps)); i < n; i++) {
      const t = tOf(i) - t0; if (t > up + hold + down) break; if (t < 0) continue;
      const v = peak * (t < up ? ease(t / up) : t < up + hold ? 1 : 1 - ease((t - up - hold) / down));
      if (v > c[i]) c[i] = v;
    }
  };
  // THE MICRO-EXPRESSIONS and THE BROW FLASHES
  const events = { blinks: [], saccades: [], micro: [], flashes: [], lines: [], batons: [] };
  for (const b of beats) {
    if (b.micro !== undefined) {
      const t0 = b.microAt ?? b.at;
      for (const [k, v] of Object.entries(composeFace(b.micro))) layer(k, t0, MICRO.onset, MICRO.hold, MICRO.offset, clamp01(v * K));
      events.micro.push({ t: r4(t0), dur: r4(MICRO.onset + MICRO.hold + MICRO.offset) });
    }
    if (b.flash) { layer('AU1', b.at, BROW_FLASH.rise, BROW_FLASH.hold, BROW_FLASH.fall, BROW_FLASH.AU1); layer('AU2', b.at, BROW_FLASH.rise, BROW_FLASH.hold, BROW_FLASH.fall, BROW_FLASH.AU2); events.flashes.push({ t: r4(b.at) }); }
  }
  // THE EMOTES' STIRS: within a beat that holds an emote, its moments (a lip pressed, the lids sinking and caught)
  if (beats.some((b) => b.E)) events.stirs = [];
  beats.forEach((b, bi) => {
    const end = bi + 1 < beats.length ? beats[bi + 1].at : seconds;
    for (const st of b.E?.stirs ?? []) {
      const len = st.up + st.hold + st.down;
      for (let t = b.at + span([0.5, 2]); t + len < end; t += len + span(st.every)) {
        for (const [k, v] of Object.entries(st.face)) layer(k, t, st.up, st.hold, st.down, clamp01(v * K));
        events.stirs.push({ t: r4(t), dur: r4(len) });
      }
    }
  });
  // THE TELLS: the upper face's gestures, each laid over the face from its beat (or its own time)
  for (const b of beats) for (const T of b.tell === undefined ? [] : [b.tell].flat()) {
    const G = tellOf(T), t0 = G.at ?? b.at;
    for (const [k, v] of Object.entries(G.units)) layer(k, t0, G.up, G.hold, G.down, clamp01(v * K));
    (events.tells ??= []).push({ t: r4(t0), gesture: G.gesture, dur: r4(G.up + G.hold + G.down) });
  }
  // THE COUPLINGS: the cheek's raise under the lower lid, the brow's weight on the lid, frame by frame (parts.js)
  couple(curves, n);
  // THE LINES: the speech's units over the face's, the face's mouth giving way where the lips cannot do both (mouth.js)
  for (const L of lines) {
    const T = L.take;
    overMouth(curves, L, { fps, n });
    // (the batons: an emphasized word lifts the brows as it is said)
    for (const w of T.events.words) if (w.emph) { const B = SPEAKING.baton, t = L.at + w.t - 0.08; layer('AU1', t, B.rise, B.hold * w.dur, B.fall, B.AU1 * K); layer('AU2', t, B.rise, B.hold * w.dur, B.fall, B.AU2 * K); events.batons.push({ t: r4(t), word: w.w }); }
    const recording = typeof L.say === 'object' ? L.say.recording : undefined;
    events.lines.push({ t: r4(L.at), seconds: T.seconds, ...(recording ? { recording } : {}), words: T.events.words.map((w) => ({ ...w, t: r4(L.at + w.t) })), phonemes: T.events.phonemes.map((q) => ({ ...q, t: r4(L.at + q.t) })) });
  }
  // THE GAZE: per beat a target (its state's default when none), saccades to it with the upper face, drift within a
  // fixation, a speaker's glances away and back
  const stateAt = (t) => { let s = 'listening'; for (const b of beats) if (b.at <= t + 1e-9 && b.state) s = b.state; return s; };
  // (the beat at a moment, and its blinks' rate: an emote's own but while speaking, else the state's)
  const beatAt = (t) => { let c = null; for (const b of beats) if (b.at <= t + 1e-9) c = b; return c; };
  const rateAt = (t) => { const b = beatAt(t), st = stateAt(t); return b?.E && st !== 'speaking' ? b.E.blink.rate : alertBlink({ rate: BLINK.rate[st] }, b?.a ?? 0).rate; };
  // (each fixation its focus `v`, the eyes' convergence in degrees: a target's distance's, gaze.js, else the far point)
  const focus = (g) => ({ yaw: g.yaw, pitch: g.pitch, v: g.v ?? (g.distance ? vergence(g.distance) : 0) });
  const awayTarget = () => ({ yaw: (rnd() < 0.5 ? -1 : 1) * span(GAZE.away.yaw), pitch: span(GAZE.away.pitch), v: 0 });
  const targetOf = (b) => { const g = b.gaze ?? (b.E ? b.E.home : b.state === 'thinking' ? 'away' : undefined); return g === undefined ? null : typeof g === 'object' ? focus(g) : g === 'away' ? awayTarget() : focus(GAZE[g]); };
  const fix = [];   // fixations: { t, yaw, pitch, v }, in time order
  let gz = focus(GAZE.listener);
  fix.push({ t: 0, ...gz });
  beats.forEach((b, bi) => {
    const tgt = targetOf(b);
    if (tgt) { gz = tgt; fix.push({ t: Math.max(0, b.at - DYNAMICS.lead), ...gz }); }
    // (within the beat: drift, and a speaker's glances)
    const end = bi + 1 < beats.length ? beats[bi + 1].at : seconds, home = { ...gz };
    // (an emote's own regard where the beat holds one and names no gaze: its scan, re-fixations or drift, its glances
    // away: emotes.js; else the drift and a speaker's glances)
    if (b.E && b.gaze === undefined) { fix.push(...regardFixations(b.E, Math.max(0, b.at - DYNAMICS.lead), end, rnd)); return; }
    const every = b.E ? b.E.eyes.refix?.every ?? [2, 4] : GAZE.drift.every;
    let t = Math.max(0, b.at - DYNAMICS.lead) + span(every);
    let nextGlance = b.at + span(GAZE.glance.every);
    // (a wary beat CHECKS: glances off to a side, focused on what they check, more often the warier: alert.js)
    const C = ALERT.eyes.check, wary = b.a > 0.15, quick = 1 - ALERT.eyes.quicken * b.a;
    let nextCheck = wary ? b.at + span(C.every) * quick : Infinity;
    while (t < end - 0.1) {
      if (t >= nextCheck) {
        const r = span(C.reach) * (1 + 0.5 * b.a), back = Math.min(end - 0.05, t + span(C.hold));
        fix.push({ t, yaw: home.yaw + (rnd() < 0.5 ? -1 : 1) * r, pitch: home.pitch - r * span([0.05, 0.35]), v: vergence(C.distance) }); fix.push({ t: back, ...home });
        nextCheck = back + span(C.every) * quick; t = back + span(every); continue;
      }
      if (stateAt(t) === 'speaking' && t >= nextGlance) {
        nextGlance = t + span(GAZE.glance.every);
        if (rnd() < GAZE.glance.chance) { const a = awayTarget(), back = Math.min(end - 0.05, t + span(GAZE.glance.hold)); fix.push({ t, ...a }); fix.push({ t: back, ...home }); t = back + span(every); continue; }
      }
      if (b.E?.eyes.refix) { const r = span(b.E.eyes.refix.reach), a = 2 * Math.PI * rnd(); fix.push({ t, yaw: home.yaw + r * Math.cos(a), pitch: home.pitch + 0.6 * r * Math.sin(a), v: home.v }); }
      else { const d = b.E ? b.E.eyes.drift : GAZE.drift.deg; fix.push({ t, yaw: home.yaw + d * (2 * rnd() - 1), pitch: home.pitch + d * (2 * rnd() - 1), v: home.v }); }
      t += span(every);
    }
  });
  fix.sort((a, b) => a.t - b.t);
  const yaw = new Array(n), pitch = new Array(n), verg = new Array(n);
  {
    // (the focus eases from where it is to each fixation's over EYES.verge, slower than the saccade)
    let k = 0, from = { yaw: 0, pitch: 0 }, cur = { yaw: 0, pitch: 0 }, sac = null, vFrom = fix[0].v, vNow = fix[0].v;
    for (let i = 0; i < n; i++) {
      const t = tOf(i);
      while (k < fix.length && fix[k].t <= t) {
        from = { ...cur }; vFrom = vNow; const f = fix[k++], amp = Math.hypot(f.yaw - from.yaw, f.pitch - from.pitch);
        sac = { t0: f.t, dur: GAZE.saccade.base + GAZE.saccade.perDeg * amp, to: f };
        if (amp > 2) events.saccades.push({ t: r4(f.t), dur: r4(sac.dur), amp: r4(amp) });
      }
      if (sac) { const u = (t - sac.t0) / sac.dur; cur = u >= 1 ? { yaw: sac.to.yaw, pitch: sac.to.pitch } : { yaw: lerp(from.yaw, sac.to.yaw, ease(u)), pitch: lerp(from.pitch, sac.to.pitch, ease(u)) }; }
      if (sac) vNow = lerp(vFrom, sac.to.v, ease((t - sac.t0) / EYES.verge));
      yaw[i] = cur.yaw; pitch[i] = cur.pitch; verg[i] = vNow;
    }
  }
  // THE LOOK MOVES THE FACE: the lids and the brows following the eye, a large glance's moment of widened lids, the
  // more the warier (parts.js)
  lookLids(curves, pitch, n);
  lookPulses(events.saccades, (t) => beatAt(t)?.a ?? 0, layer);
  // THE BLINKS: the spontaneous, by the state's rate (thinned the warier); the mind's, at a beat's change and with a
  // large saccade (more the warier); a startle's; none on a face that holds its eyes shut, none closer than the least gap
  const shut = (t) => { const i = Math.min(n - 1, Math.round(t * fps)); return Math.max(curves.AU45?.[i] ?? 0, curves.AU45L?.[i] ?? 0, curves.AU45R?.[i] ?? 0) > 0.9; };
  const wants = [];
  for (const b of beats.slice(1)) if (rnd() < BLINK.beat) wants.push({ t: b.at + 0.05, cause: 'thought' });
  for (const s of events.saccades) if (s.amp > BLINK.shiftDeg && rnd() < BLINK.shift + ALERT.blink.shift * (beatAt(s.t)?.a ?? 0)) wants.push({ t: s.t, cause: 'gaze' });
  // (a sentence's close, in a line's pause at a stop)
  for (const L of events.lines) for (const q of L.phonemes.slice(1, -1)) if (q.p === 'sil' && q.dur >= 0.3 && rnd() < SPEAKING.phrase) wants.push({ t: q.t + 0.05, cause: 'phrase' });
  for (let t = span([0.2, 1.5]); t < seconds; ) {
    wants.push({ t, cause: 'spontaneous' });
    const mean = 60 / rateAt(t);
    t += Math.max(BLINK.gap, mean * (0.35 + 1.3 * rnd()));
  }
  // (a startle's reflex blink is taken whatever else wanted one near it)
  const startles = beats.filter((b) => b.startle).map((b) => ({ t: b.at, cause: 'startle' }));
  wants.splice(0, wants.length, ...wants.filter((w) => !startles.some((x) => Math.abs(w.t - x.t) < BLINK.gap)), ...startles);
  wants.sort((a, b) => a.t - b.t);
  let last = -Infinity;
  for (const w of wants) {
    if (w.cause === 'startle') {
      const X = STARTLE, after = w.t + X.close + X.shut + X.open * 0.5;
      layer('AU45', w.t, X.close, X.shut, X.open, 1);
      for (const [k, v] of Object.entries(X.widen)) layer(k, after, X.rise, X.hold, X.fall, clamp01(v * K));
      events.blinks.push({ t: r4(w.t), dur: r4(X.close + X.shut + X.open), cause: 'startle' });
      last = w.t; continue;
    }
    // (and none in a brow flash, a signal sent with the eyes on the other's: the blink waits for its fall)
    const flash = events.flashes.find((f) => w.t > f.t - 0.15 && w.t < f.t + BROW_FLASH.rise + BROW_FLASH.hold + BROW_FLASH.fall);
    if (flash) w.t = flash.t + BROW_FLASH.rise + BROW_FLASH.hold + BROW_FLASH.fall;
    if (w.t - last < BLINK.gap || w.t > seconds - 0.3 || shut(w.t)) continue;
    const B = beatAt(w.t), slow = B?.E?.blink.slow ?? alertBlink({ rate: 1 }, B?.a ?? 0).slow, c = span(BLINK.close) * slow, s = span(BLINK.shut) * slow, o = span(BLINK.open) * slow;
    layer('AU45', w.t, c, s, o, 1);
    events.blinks.push({ t: r4(w.t), dur: r4(c + s + o), cause: w.cause });
    last = w.t;
  }
  return {
    fps, seconds, frames: n,
    curves: Object.fromEntries(Object.keys(curves).sort().map((k) => [k, curves[k].map(r4)])),
    gaze: { yaw: yaw.map(r4), pitch: pitch.map(r4), ...(verg.some((v) => v > 0) ? { vergence: verg.map(r4) } : {}) }, events,
  };
}

/** A frame of a take as a FACS state ({ AU12: v, AU12R: v, … }: the curves at frame `i`, zeros left out). */
export function captureFrame(take, i) {
  const f = Math.max(0, Math.min(take.frames - 1, i)), st = {};
  for (const [k, c] of Object.entries(take.curves)) if (c[f] > 0) st[k] = c[f];
  return st;
}
