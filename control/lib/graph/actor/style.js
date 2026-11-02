/**
 * style — HOW MUCH an actor does, and when: the performer's way with any role and any script, as a card (the shape of a
 * delivery register, persona/delivery.js). A style never says who the character is (that is its role, role.js) nor how
 * it is drawn (the keying and the look are the render's); a thespian shaded anime is a thespian.
 *
 *   • `face`    `intensity` (perform.js: every unit scaled), `onset` ('spontaneous' eases in over a third of a second
 *               and more, 'posed' snaps in within a fifth), `flash` the share of lines opened by a brow flash, `tells`
 *               the upper-face gestures it lets show (parts.js UPPER_GESTURES) and `tell` the share of lines that show one
 *   • `gaze`    `glance` the share of lines broken by a glance off and back; a `line`, `para` or `aside` target
 *               (persona/delivery.js GAZE_TARGETS) over the register's own
 *   • `gesture` which moments a gesture marks (`stress` the share of stressed words, `line` the share of lines that
 *               open with one, `aside`, `close`) and from which words (`vocab`, GESTURE_WORDS); an empty
 *               vocabulary gestures nowhere
 *   • `voice`   `rate` and `articulation`, each a factor on the register's
 *   • `body`    the body's dials (figure-posing.js performance(): `exaggerate`, `anticipation`, `followThrough`, `idle`;
 *               `stillness` 0 restless … 1 still between gestures; `hold` seconds a pose is held at a line's end), and
 *               `time` the feel flavor its moves take (gameworld/feel/flavor.js FLAVORS): read by the body from phase 2
 *
 * A style is a name or { from: name, …overrides } (each nested key merged one level, as deliveryOf merges). No style at
 * all is the persona's read as it was (actor/interpret.js adds nothing): the styles add, they never replace that path.
 *
 * Pure data and its checks. The numbers are first guesses, tuned by the operator's eyes.
 */
import { UPPER_GESTURE_NAMES } from '../face-acting/parts.js';
import { GAZE_TARGETS } from '../persona/delivery.js';

/** the feel flavors a style's moves may take (gameworld/feel/flavor.js FLAVORS' names, held equal by style.test.js: that
 * module carries the hero's solvers, too heavy for a card's check) */
export const STYLE_FLAVORS = Object.freeze(['realistic', 'action', 'platformer', 'pinball']);
/** the gestures a style may name: the body's (actor/gestures.js GESTURES, held equal by a test: that module carries the
 * arm's solver, too heavy for a card's check), the body's emotes' names among them (figure-emotes.js EMOTES, as a
 * delivery register's `body` names them) */
export const GESTURE_WORDS = Object.freeze(['beat', 'offer', 'point', 'shrug', 'cheer', 'clap', 'think', 'nod', 'headshake', 'bow']);

const card = (o) => Object.freeze(Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? Object.freeze(v) : Array.isArray(v) ? Object.freeze(v) : v])));

export const STYLES = Object.freeze({
  thespian: card({
    reads: 'the stage actor: big and readable, every stressed word carried by the hands, lines opened with the brows, the eyes held on whoever is listening; crisp and unhurried',
    face: { intensity: 1.25, onset: 'spontaneous', flash: 0.4, tells: ['eyeSmile', 'knit', 'widen'], tell: 0.3 },
    gaze: { glance: 0.1 },
    gesture: { stress: 1, line: 0.5, aside: true, close: true, vocab: ['beat', 'point', 'offer', 'shrug', 'nod', 'bow'] },
    voice: { rate: 0.92, articulation: 1.15 },
    body: { exaggerate: 1.3, anticipation: 0.35, followThrough: 1.2, idle: 1, stillness: 0.2, hold: 0.3 }, time: 'realistic',
  }),
  'action-star': card({
    reads: 'the action lead: economy and stillness, little on the face but a tell, the eyes steady; when it moves it is sudden and short, and settles at once',
    face: { intensity: 0.6, onset: 'spontaneous', flash: 0, tells: ['oneBrow', 'appraise'], tell: 0.25 },
    gaze: { glance: 0 },
    gesture: { stress: 0.25, line: 0, aside: false, close: false, vocab: ['nod'] },
    voice: { rate: 0.95, articulation: 0.95 },
    body: { exaggerate: 0.85, anticipation: 0.15, followThrough: 0.8, idle: 0.5, stillness: 0.85, hold: 0 }, time: 'action',
  }),
  'anime-mocap': card({
    reads: 'the anime game\'s captured cutscene: a big clear face that snaps into place, a gesture a line held at its end, every line lifted',
    face: { intensity: 1.4, onset: 'posed', flash: 0.4, tells: ['widen', 'eyeSmile'], tell: 0.35 },
    gaze: { glance: 0.05 },
    gesture: { stress: 0.5, line: 1, aside: true, close: true, vocab: ['point', 'cheer', 'think', 'offer', 'shrug', 'nod'] },
    voice: { rate: 1.05, articulation: 1.2 },
    body: { exaggerate: 1.4, anticipation: 0.3, followThrough: 1, idle: 0.8, stillness: 0.4, hold: 0.5 }, time: 'action',
  }),
  extra: card({
    reads: 'the background player: small and quiet, never the lens, eyes wandering, no gesture to draw the eye; alive but not acting',
    face: { intensity: 0.45, onset: 'spontaneous', flash: 0, tells: [], tell: 0 },
    gaze: { glance: 0.3, line: 'away', para: 'away', aside: 'away' },
    gesture: { stress: 0, line: 0, aside: false, close: false, vocab: [] },
    voice: { rate: 1, articulation: 0.8 },
    body: { exaggerate: 0.7, anticipation: 0.1, followThrough: 0.8, idle: 1.2, stillness: 0.5, hold: 0 }, time: 'realistic',
  }),
});
export const STYLE_NAMES = Object.freeze(Object.keys(STYLES));
const NESTED = ['face', 'gaze', 'gesture', 'voice', 'body'];
const ONSETS = ['spontaneous', 'posed'];

/** A style: a name, or { from: name, …overrides }; throws on an unknown name */
export function styleOf(spec) {
  const name = typeof spec === 'string' ? spec : spec?.from;
  const base = STYLES[name];
  if (!base) throw new Error(`style: '${name}' is not a style (${STYLE_NAMES.join(', ')})`);
  if (typeof spec === 'string') return { name, ...base };
  const { from: _f, ...own } = spec;
  return { name, ...base, ...own, ...NESTED.reduce((o, k) => (own[k] ? { ...o, [k]: { ...base[k], ...own[k] } } : o), {}) };
}

const share = (v) => Number.isFinite(v) && v >= 0 && v <= 1;
const factor = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

/** Error lines for a style spec (empty = valid) */
export function styleErrors(spec, at = 'style') {
  if (typeof spec === 'string') return STYLES[spec] ? [] : [`${at}: '${spec}' is not a style (${STYLE_NAMES.join(', ')})`];
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return [`${at}: a style's name (${STYLE_NAMES.join(', ')}) or { from, …its tune }`];
  if (!STYLES[spec.from]) return [`${at}.from: a style's name (${STYLE_NAMES.join(', ')})`];
  const errs = [], known = ['from', 'reads', 'time', ...NESTED];
  const extra = Object.keys(spec).filter((k) => !known.includes(k));
  if (extra.length) errs.push(`${at}: a style takes ${known.join(', ')} (not ${extra.join(', ')})`);
  for (const k of NESTED) if (spec[k] !== undefined && (!spec[k] || typeof spec[k] !== 'object' || Array.isArray(spec[k]))) errs.push(`${at}.${k}: an object of its dials`);
  if (errs.length) return errs;
  const S = styleOf(spec), F = S.face, G = S.gaze, X = S.gesture, V = S.voice, B = S.body;
  if (!factor(F.intensity, 0, 2)) errs.push(`${at}.face.intensity: 0 … 2`);
  if (!ONSETS.includes(F.onset)) errs.push(`${at}.face.onset: ${ONSETS.join(' | ')}`);
  if (!share(F.flash)) errs.push(`${at}.face.flash: a share, 0 … 1`);
  if (!share(F.tell)) errs.push(`${at}.face.tell: a share, 0 … 1`);
  if (!Array.isArray(F.tells) || F.tells.some((t) => !UPPER_GESTURE_NAMES.includes(t))) errs.push(`${at}.face.tells: a list of ${UPPER_GESTURE_NAMES.join(', ')}`);
  if (!share(G.glance)) errs.push(`${at}.gaze.glance: a share, 0 … 1`);
  for (const k of ['line', 'para', 'aside']) if (G[k] !== undefined && !GAZE_TARGETS.includes(G[k])) errs.push(`${at}.gaze.${k}: ${GAZE_TARGETS.join(' | ')}`);
  for (const k of ['stress', 'line']) if (!share(X[k])) errs.push(`${at}.gesture.${k}: a share, 0 … 1`);
  for (const k of ['aside', 'close']) if (typeof X[k] !== 'boolean') errs.push(`${at}.gesture.${k}: true | false`);
  if (!Array.isArray(X.vocab) || X.vocab.some((g) => !GESTURE_WORDS.includes(g))) errs.push(`${at}.gesture.vocab: a list of ${GESTURE_WORDS.join(', ')}`);
  for (const k of ['rate', 'articulation']) if (!factor(V[k], 0.5, 1.5)) errs.push(`${at}.voice.${k}: a factor on the register's, 0.5 … 1.5`);
  for (const [k, lo, hi] of [['exaggerate', 0.5, 2], ['anticipation', 0, 1], ['followThrough', 0, 2], ['idle', 0, 2], ['stillness', 0, 1], ['hold', 0, 2]]) if (!factor(B[k], lo, hi)) errs.push(`${at}.body.${k}: ${lo} … ${hi}`);
  if (!STYLE_FLAVORS.includes(S.time)) errs.push(`${at}.time: a feel flavor (${STYLE_FLAVORS.join(', ')})`);
  return errs;
}
