/**
 * TALK LINES — a scene's lines SAID by whoever speaks them: each plain line (a `line`, a banter's; scenes.js)
 * spoken by a figure whose face plays on the page becomes a small performance (face-acting/perform.js: the
 * line's expression, its words lip-synced by speech.js, the blinks and the gaze a speaking face has), and the line a
 * FACE TAKE on its own clock: the scene runner plays it as it plays a script's take (scene-runner.js `take`), the page's
 * face its track under the take's clip while it runs (scene/channels/controllable: a talking face), and the face goes
 * back to itself once the words are said. A script's lines keep their own takes (scene-takes.js). The talking head needs
 * nothing of the animation studio: a line's words are its whole direction.
 *
 * A RECORDED line (its `voice`, bound where the world is written: face-acting/recordings.js bindSceneVoices) is said on
 * the recording's own timeline: the face's mouth follows its timed phonemes (or its loudness), and the line has a take
 * whoever says it, a face or none, so the page plays the recording as the take begins (scene-channel.js) and stops it as
 * the line goes. Its program line keeps only what the page needs: { recording, at } (the recording begins `at` into the
 * take, where the words begin).
 *
 *   TALK_HEADS                         the heads whose face plays on the page as they speak: `relational` (the realistic
 *                                      face: the visemes on its FACS targets), `anime` (its drawings: the mouth's vowels)
 *                                      and `landmark` (its drawings, the vowels its jaw bone's: face-acting/western-read.js)
 *   talkHeadOf(hero)                   → 'relational' | 'anime' | 'landmark' | null: a hero spec's talking head
 *   linePerform(line)                  → the performance a line plays: { beats: [{ at, say, face? }], seconds }; null for a
 *                                      line with no words and no recording (a placeholder slot, `[Mayor: line 1]`)
 *   talkLines(manifest, program)       → { takes: [{ scene, beat, clip, figure, seconds, voice? }], byFigure: { <figure>:
 *                                      { <clip>: perform } } }: each line with no take whose speaker (an entity's id; `hero`
 *                                      the one a player pilots) wears an inline hero with a talking head, or that is
 *                                      recorded (figure null when its speaker has no talking face)
 *   withTalkTakes(program, takes)      → the program with each such line's take ({ at: 0, end, clip, of }) and a
 *                                      recorded line's voice as the page plays it ({ recording, at }); the same object
 *                                      when there are none
 *
 * A line's clip is talk:<scene>:<beat>. A choice's question has none: the runner plays no take while a choice is up. An
 * expression the face does not know is left out (the words still speak). Pure and deterministic.
 */
import { EMOTION_NAMES } from '../../face-acting/emotions.js';
import { textTimeline } from '../../face-acting/speech.js';

export const TALK_HEADS = Object.freeze(['relational', 'anime', 'landmark']);
/** the line's words begin a breath in, and the face holds a moment after them */
export const TALK_LEAD = 0.12, TALK_TAIL = 0.35;
/** the words a box shows that are expressions under another name */
const EXPRESSION_ALIASES = Object.freeze({ happy: 'happiness', smiling: 'happiness', glad: 'happiness', sad: 'sadness', frowning: 'sadness', angry: 'anger', furious: 'anger', afraid: 'fear', scared: 'fear', fearful: 'fear', surprised: 'surprise', disgusted: 'disgust', contemptuous: 'contempt' });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A hero spec's talking head: the realistic face, the anime face, the landmark face, or none. */
export function talkHeadOf(hero) {
  if (!isObj(hero)) return null;
  // (the faces the World page plays: the realistic head's, named; the anime head's, drawn, never painted; the landmark
  // head's, drawn, its mouth its jaw bone)
  if (hero.head === 'anime') return hero.painterly ? null : 'anime';
  if (hero.head === 'relational') return 'relational';
  return (hero.head ?? 'landmark') === 'landmark' ? 'landmark' : null;
}

/** The performance a line plays (see the header). */
export function linePerform(line) {
  const raw = typeof line?.text === 'string' ? line.text.trim() : '', text = /^\[.*\]$/.test(raw) ? '' : raw;
  const V = isObj(line?.voice) && line.voice.recording ? line.voice : null;
  if (!text && !V) return null;
  const ex = EXPRESSION_ALIASES[line.expression] ?? line.expression;
  const face = typeof ex === 'string' && EMOTION_NAMES.includes(ex) ? ex : null;
  // (a recorded line on the recording's timeline: its timed phonemes, its aligned words, or its loudness)
  if (V) {
    const { recording, seconds, timing, phonemes, envelope, words } = V;
    const say = { ...(text ? { text } : {}), recording, seconds, ...(timing ? { timing } : {}), ...(phonemes ? { phonemes } : {}), ...(envelope ? { envelope } : {}), ...(words ? { words } : {}) };
    return { beats: [{ at: TALK_LEAD, say, ...(face ? { face } : {}) }], seconds: r3(TALK_LEAD + seconds + TALK_TAIL) };
  }
  const words = textTimeline(text).words, end = words.length ? words[words.length - 1].t + words[words.length - 1].dur : 0.5;
  return { beats: [{ at: TALK_LEAD, say: text, ...(face ? { face } : {}) }], seconds: r3(TALK_LEAD + end + TALK_TAIL) };
}

/** The lines a page says with a face (see the header). */
export function talkLines(manifest, program) {
  const out = { takes: [], byFigure: {} };
  const figures = isObj(manifest?.figures) ? manifest.figures : {}, entities = Array.isArray(manifest?.entities) ? manifest.entities : [];
  const figOf = (who) => {
    const E = entities.find((e) => isObj(e) && e.id === who) ?? (who === 'hero' ? entities.find((e) => isObj(e) && e.pilotable) : null);
    const fig = E && isObj(E.body) && typeof E.body.figure === 'string' ? E.body.figure : null;
    return fig && isObj(figures[fig]) && talkHeadOf(figures[fig].hero) ? fig : null;
  };
  for (const sc of Array.isArray(program) ? program : []) (sc.beats || []).forEach((L, beat) => {
    if (!L || L.kind !== 'line' || L.take) return;
    const voice = isObj(L.voice) && L.voice.recording ? L.voice.recording : null, figure = figOf(L.who);
    const P = (figure || voice) && linePerform(L);
    if (!P) return;
    const clip = `talk:${sc.id}:${beat}`;
    out.takes.push({ scene: sc.id, beat, clip, figure, seconds: P.seconds, ...(voice ? { voice } : {}) });
    if (figure) (out.byFigure[figure] ||= {})[clip] = P;
  });
  return out;
}

/** The program with each talking line's take (see the header). */
export function withTalkTakes(program, takes) {
  if (!Array.isArray(takes) || !takes.length) return program;
  const of = new Map(takes.map((T) => [`${T.scene}:${T.beat}`, T]));
  return program.map((sc) => ({ ...sc, beats: sc.beats.map((b, i) => {
    const T = b && b.kind === 'line' ? of.get(`${sc.id}:${i}`) : null;
    if (!T) return b;
    const { voice: _bound, ...rest } = b;
    return { ...rest, take: { at: 0, end: T.seconds, clip: T.clip, of: T.seconds }, ...(T.voice ? { voice: { recording: T.voice, at: TALK_LEAD } } : {}) };
  }) }));
}
