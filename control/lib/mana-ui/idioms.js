/**
 * MANA-UI's IDIOMS — the screens and HUD parts games share, as compositions of the components (defs: data, never code).
 * A game uses one by name and passes what it reads; the idiom says what it emits through the effects its rows and
 * inputs carry. A new idiom is a def first, a component only when no composition can draw it.
 *
 *   idioms-front.js   the front and the menus: attract, title, loading, mode / character / arena select, pause,
 *                     options, controls, confirm, results, save
 *   idioms-rpg.js     the deep menus: party, skill tree, level up, loadout, inventory, shop, quest log, dialogue
 *   idioms-hud.js     in-game: vitals, objective, compass, minimap, ammo, score, prompt, feed, crosshair, a moment, the
 *                     party strip; the enemies: plates, a boss bar, a target frame, damage numbers
 *   idioms-fight.js   a fighting game's own language: the top frame, the meters, a side's combo and callouts, the
 *                     announcer, training's readouts; the face-off, fighter select, the fight's pause, the command list,
 *                     training's settings, the match's results
 *   idioms-brawl.js   a beat-'em-up's own readouts, its practice room's: the line at each body's feet, the attack tokens,
 *                     the chain's blows, the clinch, the press log
 *   idioms-table.js   a board game's own language: the seats, the hand, a row of cards, the prompt and its actions, the
 *                     log; one question at a time, an offer across the table; the places at the end
 *   idioms-live.js    the live game by kind of game: a fight, a race, a firefight, survival, strategy, a match, a
 *                     cutscene, stealth, quests, a phone; and the menus that come up mid-play (a battle's commands, a
 *                     unit's actions, the scoreboard, a strategy game's orders)
 *
 *   IDIOMS        name → { kind: 'screen' | 'hud', shelf: 'front' | 'rpg' | 'hud' | 'live' | 'fight' | 'brawl' | 'table', about, reads, emits, params, node,
 *                 example, waits? } (waits: the param
 *                 that must be true before a screen has anything to press, a loading screen's ready)
 *                 coverage: a HUD part a TV coverage draws on a covered page (a sport's broadcast: the bug, the strap,
 *                 the call plate), so a covered page asks for it from the coverage, not from here
 *   IDIOM_IDS · SCREEN_IDIOMS · HUD_IDIOM_IDS
 *   coverageOverlap(spec) → the coverage idioms a spec's HUD uses (a host whose page a broadcast covers advises on them)
 *   withIdioms(spec)   → the spec with the idioms among its defs (its own defs win on a shared name)
 */
import { FRONT_IDIOMS } from './idioms-front.js';
import { RPG_IDIOMS } from './idioms-rpg.js';
import { HUD_IDIOMS } from './idioms-hud.js';
import { LIVE_IDIOMS } from './idioms-live.js';
import { FIGHT_IDIOMS } from './idioms-fight.js';
import { BRAWL_IDIOMS } from './idioms-brawl.js';
import { TABLE_IDIOMS } from './idioms-table.js';

const shelf = (name, set) => Object.fromEntries(Object.entries(set).map(([k, v]) => [k, Object.freeze({ ...v, shelf: name })]));
export const IDIOMS = Object.freeze({ ...shelf('front', FRONT_IDIOMS), ...shelf('rpg', RPG_IDIOMS), ...shelf('hud', HUD_IDIOMS), ...shelf('live', LIVE_IDIOMS), ...shelf('fight', FIGHT_IDIOMS), ...shelf('brawl', BRAWL_IDIOMS), ...shelf('table', TABLE_IDIOMS) });
export const IDIOM_IDS = Object.keys(IDIOMS);
export const SCREEN_IDIOMS = IDIOM_IDS.filter((k) => IDIOMS[k].kind === 'screen');
export const HUD_IDIOM_IDS = IDIOM_IDS.filter((k) => IDIOMS[k].kind === 'hud');

/** The spec with the idioms among its defs; the spec's own defs win on a shared name. */
export function withIdioms(spec) {
  const defs = {};
  for (const [k, v] of Object.entries(IDIOMS)) defs[k] = { params: v.params, node: v.node };
  return { ...spec, defs: { ...defs, ...(spec && spec.defs) } };
}

/** The coverage idioms a spec's HUD uses: on a page a broadcast covers, the broadcast draws them (one bug, one strap). */
export function coverageOverlap(spec) {
  const hud = spec && spec.hud && Array.isArray(spec.hud.children) ? spec.hud.children : [];
  return hud.map((c) => c && c.use).filter((u) => IDIOMS[u] && IDIOMS[u].coverage);
}
