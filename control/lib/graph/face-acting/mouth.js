/**
 * mouth — WHO OWNS THE MOUTH while a line is spoken: the face (an emotion's take, an emote's loop) or the line's driver
 * (speech.js: a text, or the phonemes a voice timed). The driver owns the articulation (the jaw, the lips parted,
 * puckered, funnelled, rolled, pressed shut, spread, the upper lip lifted: `MOUTH.driver`); the face keeps the brows, the
 * eyes and the corners' set, and gives way where the lips cannot do both:
 *
 *   • a ROUNDED lip (the pucker's, the funnel's) draws the face's corners in (the smile, the dimple, the stretch), by
 *     `round` of the rounding;
 *   • the face's CLOSING units and its jaw (the chin raised, the lips tightened, pressed, sucked, the jaw's own drop) let
 *     go by `release` while the line runs, easing in and out over `ease` seconds about its sounds;
 *   • then the driver's units over the face's, the greater of the two.
 *
 * `overMouth` lays a line over a face's curves (perform.js speaks its beats' lines through it); `speakOver` lays a line
 * over any take, an emote's loop among them, played round as long as the line needs. The table is the contract an
 * engine's runtime lip-sync reads (relational-face-rig.js `mouthTargets`: the same in the rig's target names), so a
 * mouth driven live gives the face's loop the same way. Pure and deterministic.
 */
import { auOf } from './facs.js';
import { speak, SPEECH_UNITS } from './speech.js';

/** the mouth's ownership: the driver's units; the face's units a rounded lip draws in, and how far; the face's units a
 * line lets go, how far, and the ease of the line's envelope (s) */
export const MOUTH = Object.freeze({
  driver: SPEECH_UNITS,
  rounded: Object.freeze(['AU12', 'AU14', 'AU20']), round: 0.7, rounding: Object.freeze(['AU18', 'AU22']),
  released: Object.freeze(['AU17', 'AU23', 'AU24', 'AU28', 'AU26']), release: 0.85, ease: 0.15,
});

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (x) => { const t = clamp01(x); return t * t * t * (t * (t * 6 - 15) + 10); };   // smootherstep

/**
 * A spoken line ({ at (s), take: speech.js `speak`'s }) laid over a face's curves ({ AUxx: [per frame] }, `n` frames at
 * `fps`), in place: the face's mouth giving way, the driver's units over it. Returns the curves.
 */
export function overMouth(curves, line, { fps, n }) {
  const T = line.take, o = Math.round(line.at * fps), env = new Array(n).fill(0), tOf = (i) => i / fps;
  const said = T.events.phonemes.filter((q) => q.p !== 'sil');
  // (the line's span: its phonemes', or a line by loudness alone (speech.js's envelope) its whole length)
  const t0 = line.at + (said[0]?.t ?? 0), t1 = line.at + (said.length ? Math.max(...said.map((q) => q.t + q.dur)) : T.seconds);
  for (let i = 0; i < n; i++) { const t = tOf(i); env[i] = t < t0 ? ease(1 - (t0 - t) / MOUTH.ease) : t > t1 ? ease(1 - (t - t1) / MOUTH.ease) : 1; }
  const sp = (u, i) => { const j = i - o; return j >= 0 && j < T.frames ? T.curves[u][j] : 0; };
  for (const [k, c] of Object.entries(curves)) {
    const [au] = auOf(k);
    if (MOUTH.rounded.includes(au)) for (let i = 0; i < n; i++) c[i] *= 1 - MOUTH.round * Math.max(...MOUTH.rounding.map((r) => sp(r, i)));
    else if (MOUTH.released.includes(au)) for (let i = 0; i < n; i++) c[i] *= 1 - MOUTH.release * env[i];
  }
  for (const u of Object.keys(T.curves)) { const c = curves[u] || (curves[u] = new Array(n).fill(0)); for (let i = 0; i < n; i++) c[i] = Math.max(c[i], sp(u, i)); }
  return curves;
}

/**
 * A line spoken over a take (perform.js's, or an emote's loop: emotes.js `emoteTake`): `say` as a beat's (speech.js: a
 * text, or { text | phonemes, rate?, articulation? }, or a recorded line as the door keeps it), from `at` seconds. The take runs on as long as the line
 * needs, a loop played round, another held at its last frame. → a take (no longer a loop) with the line in
 * `events.lines`, as `perform` writes it.
 */
export function speakOver(take, say, { at = 0 } = {}) {
  const fps = take.fps, T = speak(say, { fps });
  const n = Math.max(take.frames, Math.round((at + T.seconds) * fps) + 1), N = take.frames - 1;
  const src = (i) => (i < take.frames ? i : take.loop ? i % N : N);
  const r4 = (v) => Math.round(v * 1e4) / 1e4;
  const curves = Object.fromEntries(Object.entries(take.curves).map(([k, c]) => [k, Array.from({ length: n }, (_, i) => c[src(i)])]));
  overMouth(curves, { at, take: T }, { fps, n });
  const recording = typeof say === 'object' ? say.recording : undefined;
  const line = { t: r4(at), seconds: T.seconds, ...(recording ? { recording } : {}), words: T.events.words.map((w) => ({ ...w, t: r4(at + w.t) })), phonemes: T.events.phonemes.map((q) => ({ ...q, t: r4(at + q.t) })) };
  const { loop, ...rest } = take;
  return {
    ...rest, seconds: r4((n - 1) / fps), frames: n,
    curves: Object.fromEntries(Object.keys(curves).sort().map((k) => [k, curves[k].map(r4)])),
    gaze: Object.fromEntries(Object.entries(take.gaze).map(([k, g]) => [k, Array.from({ length: n }, (_, i) => g[src(i)])])),
    events: { ...take.events, lines: [...(take.events.lines ?? []), line] },
  };
}
