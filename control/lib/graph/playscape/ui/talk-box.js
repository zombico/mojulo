/**
 * THE TALK BOX — a level's scenes (scenes.js) said in the game's own look: the scene runner's view (scene-runner.js
 * `view`) lowered to what mana-ui's talk presenter reads (mana-ui/idioms-talk.js `talk-box`), so the box a scene speaks
 * through is the game's interface, not a box of its own. The runner keeps the clock (the words typed on so far), the
 * choice in hand and the answer; the page's scene channel keeps the input (the keys, the pointer); the presenter only
 * draws. The host is the level's HUD host (scene/channels/mana-hud.js), on the kernel and the sheet it already carries.
 *
 *   talkSpec()                 → the mana-ui spec the host runs: the talk box bound to `talk.*`
 *   talkState(view, { noSkip?, face? }) → the talk box's state: { show, who, face, text, more, choices: [{ n, say,
 *                                mark }], legend: [{ action | actions, label }] }; `view` the runner's (null: nothing
 *                                said); noSkip: the scene cannot be skipped (a flow's stage that says so), so no skip is
 *                                offered; face: the speaker has a face to show (its place is drawn, named for them).
 *                                Self-contained: the page ships it by toString
 *   TALK_GLYPHS                → what the scene channel's controls are called (its keys: it hears no pad)
 *   readSpeakers(play)         → the speakers sheet read: { <who>: { portrait } }, or throws, teaching (below)
 *
 * A line shows its words as typed so far; ▼ once they are whole (a press goes on). A choice shows its question as the
 * line and its answers numbered, the one in hand marked.
 *
 * THE SPEAKERS SHEET, `play.speakers: { <who>: { portrait?: 'live' | 'none', voice? } }`, `who` a scene's speaker (an
 * entity's id, `hero` the player's): how each is shown as they speak. `live` (the default for anyone with a body on the
 * page): their own figure, head and shoulders, drawn live in the box's face (scene/channels/talk-face.js); `none`: the
 * box alone. A level with no sheet shows everyone live. `voice`: the voice their recorded lines are made in (a voice
 * worker's voice, `am_adam`, or a person's name): the casting, kept with the level so every line of theirs is recorded
 * alike; the lines themselves carry the recordings (scenes.js `voice`). Pure.
 */
import { TALK_IDIOMS } from '../../../mana-ui/idioms-talk.js';

/** The spec the host runs: the talk box alone, bound to the state talkState writes under `talk`. */
export function talkSpec() {
  const I = TALK_IDIOMS['talk-box'], b = (k) => ({ bind: `talk.${k}` });
  return {
    screens: {},
    defs: { 'talk-box': { params: I.params, node: I.node } },
    hud: { use: 'hud', children: [{ use: 'talk-box', props: Object.fromEntries(I.params.map((k) => [k, b(k)])) }] },
  };
}

/** The scene channel's controls by their names (scene-channel.js: Space, Enter or E go on, Esc or holding skips). */
export const TALK_GLYPHS = Object.freeze({ keys: Object.freeze({ accept: 'Space', back: 'Esc', up: '↑', down: '↓' }) });

/** The talk box's state from the runner's view (see the header). Self-contained: shipped to the page by toString. */
export function talkState(view, opts) {
  const noSkip = !!(opts && opts.noSkip), face = !!(opts && opts.face);
  const L = view && view.on ? view.line : null, C = view && view.on ? view.choice : null;
  if (!L && !C) return { show: false, who: '', face: '', text: '', more: false, choices: [], legend: [] };
  const choices = C ? C.options.map(function (say, k) { return { n: String(k + 1), say: say, mark: k === C.sel ? '▶' : '▷' }; }) : [];
  const legend = C ? [{ actions: ['up', 'down'], label: 'Move' }, { action: 'accept', label: 'Choose' }]
    : [{ action: 'accept', label: 'Next' }].concat(noSkip ? [] : [{ action: 'back', label: 'Skip' }]);
  return { show: true, who: L ? L.name : '', face: face && L ? L.name : '', text: L ? L.text : '', more: !!(L && L.full && !C), choices: choices, legend: legend };
}

/** How a speaker is shown as they speak: their own figure live, or the box alone. */
export const SPEAKER_PORTRAITS = Object.freeze(['live', 'none']);
const WHO = /^[a-z][a-z0-9_-]*$/;

/** The speakers sheet (see the header): { <who>: { portrait } }, or throws a message that teaches. */
export function readSpeakers(play) {
  const S = play && play.speakers;
  if (S === undefined) return {};
  const err = (m) => new Error(`play.speakers${m}`);
  if (!S || typeof S !== 'object' || Array.isArray(S)) throw err(` is { <who>: { portrait?: ${SPEAKER_PORTRAITS.join(' | ')} } }: how each speaker is shown as they speak`);
  const out = {};
  for (const [who, v] of Object.entries(S)) {
    if (!WHO.test(who)) throw err(`.${who}: a speaker is an entity's id (lowercase), or hero`);
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw err(`.${who} is { portrait?: ${SPEAKER_PORTRAITS.join(' | ')} }`);
    for (const k of Object.keys(v)) if (!['portrait', 'voice'].includes(k)) throw err(`.${who}.${k} is not part of a speaker (portrait, voice)`);
    if (v.portrait !== undefined && !SPEAKER_PORTRAITS.includes(v.portrait)) throw err(`.${who}.portrait is ${SPEAKER_PORTRAITS.join(' or ')}: their own figure live in the box, or the box alone`);
    if (v.voice !== undefined && !(typeof v.voice === 'string' && v.voice.trim() && v.voice.length <= 64)) throw err(`.${who}.voice is the voice their lines are recorded in: a voice worker's voice (am_adam) or a person's name`);
    out[who] = { portrait: v.portrait ?? 'live', ...(v.voice !== undefined ? { voice: v.voice.trim() } : {}) };
  }
  return out;
}
