/**
 * interpret — the actor's choices: a script read in its register (persona/read.js), then played in a STYLE (style.js) by
 * a ROLE (role.js). The interpretation writes only the words the channels already take: the delivery's dials, the face's
 * beats (perform.js: onset, a brow flash, a tell, a glance off and back, the emote under them), the take's intensity, and
 * the body's gesture cues. Phase 1 plays the face and the voice; the cues wait for the body (phase 2).
 *
 *   actRead({ script, register, style?, role?, seed? }) → the read (readScript's shape) with `role` resolved where one is
 *     given, and `style` its name and `intensity` the face's where a style is given. A role alone is the register's own
 *     way played by that role (its face, its emote, its status); neither given: readScript's read, byte for byte (the
 *     persona's path: the actor adds, it never replaces it)
 *
 * Seeded by the read's seed (its own stream, not the face's), pure and deterministic.
 */
import { readScript, READ_GAZE } from '../persona/read.js';
import { deliveryOf } from '../persona/delivery.js';
import { mulberry32 } from '../polygonizer/floorplan-glyphs.js';
import { styleOf } from './style.js';
import { roleOf } from './role.js';

/** a glance: off to the room (or down, for a reader already looking off) a little before the line's middle, held about
 * half a second, and back; never on a line shorter than `shortest` seconds */
export const GLANCE = Object.freeze({ at: 0.45, hold: 0.5, shortest: 1.2 });
const r3 = (v) => Math.round(v * 1000) / 1000;

/** the register as the style and the role read it: its rate and articulation scaled by the style's voice, its look the
 * style's where it names one, its resting face the role's, its head carried by the role's status; with a style, no body
 * (the style chooses the gestures after) */
function tunedRegister(D, S, Rl) {
  const { name, reads: _r, ...dials } = D;
  return {
    from: name, ...dials,
    ...(S ? { rate: r3(D.rate * S.voice.rate), articulation: r3(D.articulation * S.voice.articulation), body: { stress: null, aside: null, close: null } } : {}),
    gaze: { ...D.gaze, ...(S ? Object.fromEntries(['line', 'para', 'aside'].filter((k) => S.gaze[k]).map((k) => [k, S.gaze[k]])) : {}) },
    face: Rl.face ?? D.face, head: { ...D.head, pitch: D.head.pitch + Rl.pitch },
  };
}

/** The read of a script played in a style by a role (see the header) */
export function actRead({ script, register = 'anchor', style, role, seed = 1 } = {}) {
  if (style === undefined && role === undefined) return readScript({ script, register });
  const D = deliveryOf(register), S = style === undefined ? null : styleOf(style), Rl = roleOf(role);
  const read = readScript({ script, register: tunedRegister(D, S, Rl) });
  const emote = Rl.emote ? { emote: Rl.emote } : {};
  if (!S) return { ...read, beats: read.beats.map((b) => ({ ...b, ...emote })), role: Rl };

  const rnd = mulberry32(((seed >>> 0) * 7919 + 13) >>> 0), pick = (xs) => xs[Math.floor(rnd() * xs.length) % xs.length];
  const F = S.face, X = S.gesture, glance = Math.min(1, S.gaze.glance * Rl.glance), onset = { onset: F.onset };

  // ─── the face: each spoken line's beat given the style's onset, perhaps a brow flash and a tell, perhaps a glance ──
  const beats = [], says = read.beats.filter((b) => b.say !== undefined);
  for (const b of read.beats) {
    const B = { ...b, ...onset, ...emote }, k = says.indexOf(b), L = k >= 0 ? read.lines[k] : null;
    if (L && rnd() < F.flash) B.flash = true;
    if (L && F.tells.length && rnd() < F.tell) { const w = L.words.find((x) => x.emph) ?? L.words[Math.floor(L.words.length / 2)]; B.tell = { gesture: pick(F.tells), at: w.t }; }
    beats.push(B);
    if (L && L.end - L.at >= GLANCE.shortest && rnd() < glance) {
      const off = b.gaze === READ_GAZE.away ? READ_GAZE.notes : READ_GAZE.away, at = r3(L.at + GLANCE.at * (L.end - L.at));
      const keep = { face: b.face, state: 'speaking', head: b.head, ...onset, ...emote };
      beats.push({ at, ...keep, gaze: off }, { at: r3(Math.min(L.end, at + GLANCE.hold)), ...keep, gaze: b.gaze });
    }
  }
  // (the read closes on the lens; a style that names its own look closes on that)
  const close = beats.at(-1);
  if (S.gaze.line && close.say === undefined) beats[beats.length - 1] = { ...close, gaze: READ_GAZE[S.gaze.line] };
  beats.sort((a, b) => a.at - b.at);

  // ─── the body: the moments the style marks, each a word from its vocabulary (the register's own where it has one) ─
  const body = [], has = (g) => g && X.vocab.includes(g), prefer = (...gs) => gs.find(has) ?? pick(X.vocab);
  if (X.vocab.length) {
    for (const L of read.lines) {
      if (L.aside) { if (X.aside) body.push({ t: L.at, gesture: prefer(D.body.aside, 'think', 'shrug'), cause: 'aside' }); continue; }
      if (rnd() < X.line) body.push({ t: L.at, gesture: pick(X.vocab), cause: 'line' });
      for (const w of L.words) if (w.emph && rnd() < X.stress) body.push({ t: w.t, gesture: prefer(D.body.stress, 'beat', 'point', 'nod'), cause: 'stress' });
    }
    if (X.close) { const last = read.lines.at(-1); body.push({ t: r3(Math.max(last.at, last.end - 0.3)), gesture: prefer(D.body.close, 'nod', 'bow'), cause: 'close' }); }
    body.sort((a, b) => a.t - b.t);
  }
  return { ...read, beats, body, style: S.name, intensity: F.intensity, role: Rl };
}
