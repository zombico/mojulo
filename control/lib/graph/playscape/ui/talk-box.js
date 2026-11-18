/**
 * THE TALK BOX — a level's scenes (scenes.js) said in the game's own look: the scene runner's view (scene-runner.js
 * `view`) lowered to what mana-ui's talk presenter reads (mana-ui/idioms-talk.js `talk-box`), so the box a scene speaks
 * through is the game's interface, not a box of its own. The runner keeps the clock (the words typed on so far), the
 * choice in hand and the answer; the page's scene channel keeps the input (the keys, the pointer); the presenter only
 * draws. The host is the level's HUD host (scene/channels/mana-hud.js), on the kernel and the sheet it already carries.
 *
 *   talkSpec()                 → the mana-ui spec the host runs: the talk box bound to `talk.*`
 *   talkState(view, { noSkip? }) → the talk box's state: { show, who, face, text, more, choices: [{ n, say, mark }],
 *                                legend: [{ action | actions, label }] }; `view` the runner's (null: nothing said);
 *                                noSkip: the scene cannot be skipped (a flow's stage that says so), so no skip is offered.
 *                                Self-contained: the page ships it by toString
 *   TALK_GLYPHS                → what the scene channel's controls are called (its keys: it hears no pad)
 *
 * A line shows its words as typed so far; ▼ once they are whole (a press goes on). A choice shows its question as the
 * line and its answers numbered, the one in hand marked. The face's place stays empty until a speaker has a face (the
 * portraits). Pure.
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
  const noSkip = !!(opts && opts.noSkip);
  const L = view && view.on ? view.line : null, C = view && view.on ? view.choice : null;
  if (!L && !C) return { show: false, who: '', face: '', text: '', more: false, choices: [], legend: [] };
  const choices = C ? C.options.map(function (say, k) { return { n: String(k + 1), say: say, mark: k === C.sel ? '▶' : '▷' }; }) : [];
  const legend = C ? [{ actions: ['up', 'down'], label: 'Move' }, { action: 'accept', label: 'Choose' }]
    : [{ action: 'accept', label: 'Next' }].concat(noSkip ? [] : [{ action: 'back', label: 'Skip' }]);
  return { show: true, who: L ? L.name : '', face: '', text: L ? L.text : '', more: !!(L && L.full && !C), choices: choices, legend: legend };
}
