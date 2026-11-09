/**
 * brawl yard — the practice room's screen: mana-ui over the yard (the brawler's shelf, mana-ui/idioms-brawl.js, and the
 * shared input strip and move list; on the run & gun's range the gun meter in the chain's place), in the brawler's look (the `brawl-yard` theme card), and the readouts the room
 * keeps (brawl-practice.js yardRead) turned into what that screen reads. Server side: what the yard's page inlines.
 *
 *   yardSpec()                 the spec: the HUD (line marks at the dummies' feet, token marks over their heads, the
 *                              chain's blows, the clinch, the press log, the inputs along the foot) and its screens
 *                              (`moves` the brawler's move list, `settings` the dummies and the display)
 *   yardOf()                   → { spec, css, theme } for the yard's page
 *   yardHud(read, F, project, inputs?) → the `brawl.practice` state the spec reads: `project(x, z, y)` (mm on the belt)
 *                              → [0..1, 0..1] on the screen, the page's camera
 *   inputRun(runs, buttons)    → the input strip's runs after a frame's buttons (a direction and its buttons, how long
 *                              held; the newest at the right, ten at most)
 *   YARD_SETTINGS              the settings screen's fields (each bound to the var it sets)
 *
 * Pure: no clock, no dice.
 */
import { IDIOMS } from '../../mana-ui/idioms.js';
import { manaCss } from '../../mana-ui/css.js';
import { themeCss } from '../../mana-ui/theme.js';
import { cardTheme } from '../playscape/ui/theme-cards/loader.js';
import { PRACTICE_MODE_IDS } from './brawl-practice.js';
import { CROWD_TYPES } from './brawl-crowd.js';
export { yardHud, inputRun } from './brawl-yard-read.js';

const USES = ['line-marks', 'token-marks', 'chain-beats', 'clinch-meter', 'gun-meter', 'press-log', 'input-display', 'command-list', 'training-settings'];
const b = (path) => ({ bind: `brawl.practice.${path}` });
const cap = (w) => w[0].toUpperCase() + w.slice(1);

/** the settings: each dummy's mode and type, their health, the readouts shown */
export const YARD_SETTINGS = Object.freeze([
  { kind: 'cycler', label: 'Dummies', var: 'brawl.practice.set.mode', options: PRACTICE_MODE_IDS.map(cap) },
  { kind: 'cycler', label: 'Type', var: 'brawl.practice.set.type', options: Object.keys(CROWD_TYPES).map(cap) },
  { kind: 'cycler', label: 'How many', var: 'brawl.practice.set.count', options: ['1', '2', '3', '4', '6'] },
  { kind: 'cycler', label: 'Health', var: 'brawl.practice.set.health', options: ['Chains', 'Refill'] },
  { kind: 'toggle', label: 'Line marks', var: 'brawl.practice.set.marks' },
  { kind: 'toggle', label: 'Press log', var: 'brawl.practice.set.log' },
]);

export function yardSpec() {
  return {
    defs: Object.fromEntries(USES.map((k) => [k, { params: IDIOMS[k].params, node: IDIOMS[k].node }])),
    hud: { use: 'hud', children: [
      { use: 'line-marks', props: { marks: b('marks') }, when: b('set.marks') },
      { use: 'token-marks', props: { heads: b('heads') } },
      { use: 'chain-beats', props: { beats: b('beats'), ended: b('ended') }, when: b('melee') },
      { use: 'gun-meter', props: { name: b('gun.name'), ammo: b('gun.ammo'), of: b('gun.of'), grenades: b('gun.grenades'), shots: b('gun.shots'), on: b('gun.on') } },
      { use: 'clinch-meter', props: { left: b('clinch.left'), of: b('clinch.of'), knees: b('clinch.knees'), behind: b('clinch.behind'), holding: b('clinch.holding') } },
      { use: 'press-log', props: { presses: b('presses') }, when: b('set.log') },
      { use: 'input-display', props: { inputs: b('inputs') } },
    ] },
    screens: {
      moves: { use: 'command-list', props: { title: 'Moves', kinds: b('moves') } },
      settings: { use: 'training-settings', props: { title: 'Practice', fields: b('settings') } },
    },
  };
}

export function yardOf() {
  return { spec: yardSpec(), css: `${manaCss()}\n${themeCss(cardTheme('brawl-yard'))}`, theme: 'brawl-yard' };
}
