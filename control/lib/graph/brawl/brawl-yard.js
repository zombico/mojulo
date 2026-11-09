/**
 * brawl yard — the practice room's screen: mana-ui over the yard (the brawler's shelf, mana-ui/idioms-brawl.js, and the
 * shared input strip and move list), in the brawler's look (the `brawl-yard` theme card), and the readouts the room
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

const USES = ['line-marks', 'token-marks', 'chain-beats', 'clinch-meter', 'press-log', 'input-display', 'command-list', 'training-settings'];
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
      { use: 'chain-beats', props: { beats: b('beats'), ended: b('ended') } },
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

const PRESS = { attack: 'A', jump: 'J', special: 'S', 'attack + jump': 'A+J', 'attack + special': 'A+S', 'jump + special': 'J+S' };
const nameOf = (slot) => (slot === 'desperate' ? 'Desperation' : slot.split('.').map(cap).join(' '));
/** the chain's blows by name, from its style (brawl-moves.js keeps each blow's source on the move's own `id`) */
const blowName = (slot, F) => {
  const m = F.moves[slot];
  if (m && slot.startsWith('chain.')) return cap(String(m.id ?? 'blow').replace(/-/g, ' '));
  return nameOf(slot);
};

/** The `brawl.practice` state the yard's HUD reads, from the room's readouts (yardRead), the player's fighter and the
 * page's camera. */
export function yardHud(read, F, project, inputs = []) {
  const n = read.chain.of, landed = read.chain.now.length ? read.chain.now : read.chain.last?.steps ?? [];
  const marks = read.line.filter((d) => !d.ko).map((d) => {
    const [x, y] = project(d.at[0], d.at[1], 0);
    return { id: `d${d.id}`, x, y, text: d.lined ? (d.inReach ? 'LINED' : 'LINED · CLOSER') : `${d.dz > 0 ? '+' : '−'}${Math.round(Math.abs(d.dz) / 10)} CM`, kind: d.lined ? 'heal' : 'miss' };
  });
  const heads = read.line.filter((d) => d.token && !d.ko).map((d) => { const [x, y] = project(d.at[0], d.at[1], 2100); return { id: `t${d.id}`, x, y }; });
  const last = read.chain.last;
  const ended = read.chain.now.length ? '' : !last ? '' : last.end === 'finisher' ? 'Finisher' : `Dropped: ${last.why}`;
  const presses = read.log.slice(-6).map((e) => ({
    press: PRESS[e.words] ?? e.words,
    verdict: e.verdict === 'taken' ? `${e.late ? `${e.late}f late: ` : ''}${e.what ? blowName(e.what, F) : 'taken'}${e.note ? ` (${e.note})` : ''}` : `Dropped: ${e.why}`,
    kind: e.verdict === 'taken' ? 'heal' : 'miss',
  }));
  const c = read.clinch;
  return {
    marks, heads,
    beats: Array.from({ length: n }, (_, k) => ({ value: String(k + 1), variant: landed.includes(k + 1) ? 'strong' : 'muted' })),
    ended, presses, inputs,
    clinch: c ? { left: c.left, of: c.of, knees: c.knees, behind: c.back ? 'Suplex' : '', holding: true } : { left: 0, of: 1, knees: 0, behind: '', holding: false },
  };
}

const ARROW = { '-1,-1': '↙', '0,-1': '↓', '1,-1': '↘', '-1,0': '←', '0,0': '•', '1,0': '→', '-1,1': '↖', '0,1': '↑', '1,1': '↗' };
/** The input strip after a frame: a run a direction and its buttons, extended while they stay the same. */
export function inputRun(runs, { x = 0, z = 0, a, j, s } = {}) {
  const dir = ARROW[`${Math.sign(x)},${Math.sign(z)}`], btn = `${a ? 'A' : ''}${j ? 'J' : ''}${s ? 'S' : ''}`;
  const key = `${dir}${btn}`, last = runs[runs.length - 1];
  if (last && last.key === key) return [...runs.slice(0, -1), { ...last, n: last.n + 1, text: `${dir}${btn ? ` + ${btn}` : ''} (${last.n + 1}f)` }];
  if (key === '•' && !btn && last && last.key === '•') return runs;
  return [...runs, { key, n: 1, text: `${dir}${btn ? ` + ${btn}` : ''}` }].slice(-10);
}
