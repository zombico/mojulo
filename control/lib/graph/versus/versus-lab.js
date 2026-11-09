/**
 * versus lab — THE LAB a fight game's arena carries under its register: mana-ui over the fight (the fight's own
 * language, mana-ui/idioms-fight.js), in the register's look (anime → fight-cel, western → fight-lit), its words the
 * runtime's, so it is said in the game's language. Server side: what the arena's page inlines (scene/channels/versus.js).
 *
 *   labSpec()                   the spec: a training HUD (the inputs along the foot, the frame meter over them when it
 *                               is on) and a screen (`moves`: the command list); only the idioms it uses
 *   labOf({ register })         → { spec, css, theme } for an arena's page, or null without a register (an arena made
 *                               before the register carries none: its canvas overlay as it was)
 *
 * The arena (versus-arena.client.js) feeds it: `lab.inputs` (the first player's inputs as they come, each a run of a
 * direction and its buttons, how long it was held), `lab.frames` and `lab.advantage` (the frame meter of the last move,
 * its startup, active and recovery as marks, and what it left), `lab.showFrames`, and `lab.moves` (the pausing player's
 * move list, versus-movelist.js, in their scheme).
 */
import { IDIOMS } from '../../mana-ui/idioms.js';
import { manaCss } from '../../mana-ui/css.js';
import { themeCss } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';

const USES = ['input-display', 'frame-meter', 'command-list'];
const b = (path) => ({ bind: `lab.${path}` });

export function labSpec() {
  return {
    defs: Object.fromEntries(USES.map((k) => [k, { params: IDIOMS[k].params, node: IDIOMS[k].node }])),
    hud: { use: 'hud', children: [
      { use: 'frame-meter', props: { frames: b('frames'), advantage: b('advantage') }, when: b('showFrames') },
      { use: 'input-display', props: { inputs: b('inputs') }, when: b('training') },
    ] },
    screens: { moves: { use: 'command-list', props: { title: { word: 'moveList' }, kinds: b('moves') } } },
  };
}

export const LAB_LOOKS = Object.freeze({ anime: 'fight-cel', western: 'fight-lit' });
export function labOf({ register = null } = {}) {
  const look = LAB_LOOKS[register];
  if (!look) return null;
  const theme = cardTheme(look);
  return { spec: labSpec(), css: `${manaCss()}\n${themeCss(theme)}`, theme: look };
}
