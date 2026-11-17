/**
 * THE INPUT MAP — what each of a hero's actions is on each device, read from the pilot scheme (controls/schemes.js) and
 * never written by hand: the one table the level's legend, its lessons and the pause sheet say the same keys from.
 *
 *   inputMap({ moveset?, sidearm?, sprint?, dodge?, lock?, interact? })
 *       → [{ id, what, keys, pad }]   each action the hero has: its word, its key or mouse button, its pad control
 *   movesetLegend({ sidearm? }) → the legend's words for a hero with an arsenal ("click  light · right click  heavy · …")
 *
 * A row is an action the scheme owns; its word is the game's (a sidearm named for what it is: 'bow'). Pure.
 */
import { buildControlsKernel } from '../controls/controls-kernel.js';
import { SCHEMES } from '../controls/schemes.js';
import { DEVICES } from '../controls/devices.js';

const K = buildControlsKernel();
const B = K.resolve(SCHEMES.pilot, { keyboard: DEVICES.keyboard, mouse: DEVICES.mouse, gamepad: DEVICES.gamepad });
const first = (fam, id) => { const c = (B.bind[fam]?.[id] ?? [])[0]; return c ? K.label(DEVICES, fam, c, fam === 'gamepad' ? 'xbox' : undefined) : null; };
// (a mouse button as a player says it)
const MOUSE_WORDS = Object.freeze({ left: 'click', right: 'right click', middle: 'middle click', forward: 'mouse forward', back: 'mouse back' });
const mouseWord = (id) => { const c = (B.bind.mouse?.[id] ?? [])[0]; return c ? MOUSE_WORDS[c] ?? `mouse ${c}` : null; };
/** an action's control on keys and mouse (the key where it has one, else the mouse button) and on a pad */
const row = (id, what) => ({ id, what, keys: first('keyboard', id) ?? mouseWord(id), pad: first('gamepad', id) });

/** The actions a hero has, each on each device (see the header). */
export function inputMap({ moveset = false, sidearm = null, sprint = false, dodge = false, lock = false, interact = false } = {}) {
  return [
    ...(moveset ? [row('light', 'light'), row('heavy', 'heavy'), row('special', sidearm ? `${sidearm} (hold)` : 'special'), row('modifier', 'specials (hold, with an attack)'), row('guard', 'guard (hold)')] : []),
    ...(sprint ? [row('boost', dodge ? 'sprint · twice to dodge' : 'sprint')] : []),
    ...(lock ? [row('lock', 'lock on')] : []),
    ...(interact ? [row('interact', 'use')] : []),
    row('pause', 'pause'),
  ].filter((r) => r.keys || r.pad);
}

/** The legend's words for a hero with an arsenal: its attacks, its sidearm, its specials and its guard, by their keys. */
export function movesetLegend({ sidearm = null } = {}) {
  return inputMap({ moveset: true, sidearm }).filter((r) => r.id !== 'pause' && r.keys).map((r) => `${r.keys}  ${r.what}`).join(' · ');
}
