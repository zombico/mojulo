/**
 * delivery — HOW a persona reads: the DELIVERY REGISTERS, each a card, as an emote is (face-acting/emotes.js). A register
 * is the newsreader's or the caster's way with a script, whatever the script says and whoever reads it:
 *
 *   • `rate` the speaking rate (speech.js: 1 about five syllables a second) and `articulation` (0.6 mumbled, 1 plain,
 *     1.4 enunciated: the jaw and the lips together);
 *   • `gap` the silences: after a sentence, after a paragraph (a breath and a look), and a bare `[pause]`'s;
 *   • `stress` the words it leans on unmarked: names (a capitalised word inside a sentence), numbers, `per` at most a
 *     sentence (a word the script marks `*so*` is always stressed and counts);
 *   • `gaze` where it looks: `line` while it reads (`lens`: the camera, the viewer; `away`: the play it calls), `para`
 *     at a paragraph's start (`notes`: down to the desk, then back up), `aside` in a parenthesis;
 *   • `face` its resting face (emotions.js) and `head` its carriage (degrees, head.js);
 *   • `body` the gestures that carry it where there is no face to (figure-emotes.js EMOTES): `stress` on a stressed word,
 *     `aside`, `close` on the last line, each null for none;
 *   • `voice` its voice's dials over the persona's own (voice/voice-register.js: `confidence`, `speed`).
 *
 * Pure data and its checks. A register's numbers are first guesses, tuned by the operator's eyes and ears.
 */

/** the registers; `reads` says what each is */
export const DELIVERY = Object.freeze({
  anchor: Object.freeze({
    reads: 'the newsreader: measured and clear, to the lens, leaning on the names and the numbers; a look down to the notes between stories',
    rate: 0.95, articulation: 1.15, gap: Object.freeze({ sentence: 0.35, para: 0.8, pause: 0.6 }),
    stress: Object.freeze({ names: true, numbers: true, per: 1 }),
    gaze: Object.freeze({ line: 'lens', para: 'notes', aside: 'notes' }), face: 'neutral', head: Object.freeze({ pitch: 0, roll: 0 }),
    body: Object.freeze({ stress: 'nod', aside: null, close: 'nod' }), voice: Object.freeze({ confidence: 0.75 }),
  }),
  briefing: Object.freeze({
    reads: 'the briefing officer: clipped and certain, to the lens, every number marked; short gaps, no smile',
    rate: 1.05, articulation: 1.25, gap: Object.freeze({ sentence: 0.25, para: 0.6, pause: 0.5 }),
    stress: Object.freeze({ names: true, numbers: true, per: 2 }),
    gaze: Object.freeze({ line: 'lens', para: 'notes', aside: 'notes' }), face: 'determined', head: Object.freeze({ pitch: -2, roll: 0 }),
    body: Object.freeze({ stress: 'point', aside: null, close: 'nod' }), voice: Object.freeze({ confidence: 0.95 }),
  }),
  speech: Object.freeze({
    reads: 'the speaker at a podium: slow, every sentence given its room, a look out across the hall between paragraphs',
    rate: 0.85, articulation: 1.2, gap: Object.freeze({ sentence: 0.55, para: 1.2, pause: 0.9 }),
    stress: Object.freeze({ names: true, numbers: false, per: 1 }),
    gaze: Object.freeze({ line: 'lens', para: 'away', aside: 'notes' }), face: 'hopeful', head: Object.freeze({ pitch: 3, roll: 0 }),
    body: Object.freeze({ stress: 'point', aside: 'shrug', close: 'bow' }), voice: Object.freeze({ confidence: 0.85 }),
  }),
  documentary: Object.freeze({
    reads: 'the documentary narrator: unhurried and warm, little stressed, the lens held',
    rate: 0.85, articulation: 1.0, gap: Object.freeze({ sentence: 0.45, para: 1.0, pause: 0.8 }),
    stress: Object.freeze({ names: false, numbers: false, per: 0 }),
    gaze: Object.freeze({ line: 'lens', para: 'lens', aside: 'away' }), face: 'pensive', head: Object.freeze({ pitch: 0, roll: 2 }),
    body: Object.freeze({ stress: null, aside: 'think', close: null }), voice: Object.freeze({ confidence: 0.6 }),
  }),
  'play-by-play': Object.freeze({
    reads: 'the caller: quick, on the play and not the lens, the names hit hard, hardly a breath between calls',
    rate: 1.3, articulation: 1.1, gap: Object.freeze({ sentence: 0.15, para: 0.4, pause: 0.3 }),
    stress: Object.freeze({ names: true, numbers: true, per: 2 }),
    gaze: Object.freeze({ line: 'away', para: 'lens', aside: 'lens' }), face: 'determined', head: Object.freeze({ pitch: 2, roll: 0 }),
    body: Object.freeze({ stress: 'point', aside: null, close: 'cheer' }), voice: Object.freeze({ confidence: 0.9 }),
  }),
});
export const DELIVERY_NAMES = Object.freeze(Object.keys(DELIVERY));
/** where a reader can look: the camera, the desk, off at the play or the room */
export const GAZE_TARGETS = Object.freeze(['lens', 'notes', 'away']);

/** A register: a name, or { from: name, …overrides } (a tune of one); throws on an unknown name */
export function deliveryOf(spec = 'anchor') {
  const name = typeof spec === 'string' ? spec : spec?.from ?? 'anchor', base = DELIVERY[name];
  if (!base) throw new Error(`delivery: '${name}' is not a register (${DELIVERY_NAMES.join(', ')})`);
  if (typeof spec === 'string') return { name, ...base };
  const { from: _f, ...own } = spec;
  return { name, ...base, ...own, ...['gap', 'stress', 'gaze', 'head', 'body', 'voice'].reduce((o, k) => (own[k] ? { ...o, [k]: { ...base[k], ...own[k] } } : o), {}) };
}

/** Error lines for a register spec (empty = valid) */
export function deliveryErrors(spec, at = 'register') {
  if (typeof spec === 'string') return DELIVERY[spec] ? [] : [`${at}: '${spec}' is not a register (${DELIVERY_NAMES.join(', ')})`];
  if (!spec || typeof spec !== 'object') return [`${at}: a register's name (${DELIVERY_NAMES.join(', ')}) or { from, …its tune }`];
  const errs = [];
  if (spec.from !== undefined && !DELIVERY[spec.from]) errs.push(`${at}.from: '${spec.from}' is not a register (${DELIVERY_NAMES.join(', ')})`);
  for (const k of ['rate', 'articulation']) if (spec[k] !== undefined && !(Number.isFinite(spec[k]) && spec[k] > 0 && spec[k] <= 2)) errs.push(`${at}.${k}: more than 0, at most 2`);
  if (spec.gaze) for (const [k, v] of Object.entries(spec.gaze)) if (!GAZE_TARGETS.includes(v)) errs.push(`${at}.gaze.${k}: one of ${GAZE_TARGETS.join(', ')}`);
  return errs;
}
