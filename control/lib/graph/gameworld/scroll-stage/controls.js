/**
 * THE SCROLL STAGE'S CONTROLS (Blaze Gunner): what the ship does and what each device does it with, a shmup's layout.
 * One table read three ways: the HUD's legend and its controls sheet (hud.js), in the glyphs of the device in hand; the
 * page's pad read (scene/channels/controllable/index.js, a scroll page's); and the pause's controls panel a game's shell
 * asks the level for (its legend).
 *
 *   fly     the arrows or WASD; the d-pad or the left stick (eight ways, as the genre's pad)
 *   fire    J or the left mouse; the bottom face or the right trigger
 *   pod     1 or 2 picks a slot; the left face or the left shoulder switches to the other
 *   eject   F held; the right face or the left trigger held
 *   speed   R; the top face or the right shoulder (a tap)
 *   menu    Enter (Esc too where no game's shell holds Esc); start (select where the shell's pause holds start)
 *
 *   SCROLL_CONTROLS              the rows: { id, does, keys: [cap…], pad: [control…] } (a pad control is a position:
 *                                devices.js's gamepad layouts print it per pad; dpad and stick are drawn as their own)
 *   PAD                          the standard-mapping buttons each pad action reads (a scroll page's pad read)
 *   scrollControls({ shell, more }) → { keys: [row], pad: { <layout>: [row] }, sheet: { keys, pad: { <layout> } } }
 *                                the legend's rows per device (a row { actions: [cap…], label }), and the sheet's rows
 *                                ({ does, caps: [cap…] } per device); `shell`: the level plays in a game's shell (the menu on
 *                                select); `more`: a level's further keys line (another mechanic's), keyboard only
 *   scrollLegendRows(family, layout?, { shell }) → [[caps, does]] the pause panel's rows (scene-three's __controlRows)
 *
 * Pure data and strings.
 */
import { DEVICES } from '../../controls/devices.js';
import { keyRowsOf } from '../side-map/hud.js';

export const SCROLL_CONTROLS = Object.freeze([
  { id: 'fly', does: 'fly', keys: ['arrows', 'WASD'], pad: ['dpad', 'left_stick'] },
  { id: 'fire', does: 'fire', keys: ['J', 'click'], pad: ['south', 'rt'] },
  { id: 'pod', does: 'pods', keys: ['1', '2'], pad: ['west', 'lb'] },
  { id: 'eject', does: 'eject (hold)', keys: ['F'], pad: ['east', 'lt'] },
  { id: 'speed', does: 'speed', keys: ['R'], pad: ['north', 'rb'] },
  { id: 'menu', does: 'menu', keys: ['Enter'], pad: ['start'] },
].map((r) => Object.freeze({ ...r, keys: Object.freeze(r.keys), pad: Object.freeze(r.pad) })));

/** The standard-mapping buttons a scroll page's pad reads (W3C Gamepad: 0 south … 15 d-pad right). */
export const PAD = Object.freeze({ fire: [0], eject: [1], pod: [2, 4], speed: [3], menu: [9], menuInShell: [8], up: 12, down: 13, left: 14, right: 15 });

const LAYOUTS = Object.keys(DEVICES.gamepad.layouts);
const OWN = { dpad: '✚', left_stick: 'L stick' };
const capOf = (c, L) => OWN[c] ?? DEVICES.gamepad.layouts[L][c] ?? c;
const rowsOf = (shell) => SCROLL_CONTROLS.map((r) => (r.id === 'menu' && shell ? { ...r, keys: ['Enter'], pad: ['select'] } : r.id === 'menu' ? { ...r, keys: ['Enter', 'Esc'] } : r));

/** The legend's and the sheet's rows, per device (see the header). */
export function scrollControls({ shell = false, more = '' } = {}) {
  const R = rowsOf(shell), extra = keyRowsOf(more);
  const keys = [...R.map((r) => ({ actions: r.keys.slice(), label: r.does })), ...extra];
  const pad = Object.fromEntries(LAYOUTS.map((L) => [L, R.map((r) => ({ actions: r.pad.map((c) => capOf(c, L)), label: r.does }))]));
  const sheet = {
    keys: [...R.map((r) => ({ does: r.does, caps: r.keys.slice() })), ...extra.map((x) => ({ does: x.label, caps: x.actions || [x.action] }))],
    pad: Object.fromEntries(LAYOUTS.map((L) => [L, R.map((r) => ({ does: r.does, caps: r.pad.map((c) => capOf(c, L)) }))])),
  };
  return { keys, pad, sheet };
}

/** The pause panel's rows for a device: [caps, does] (scene-three's __controlRows, the shell's controls). */
export function scrollLegendRows(family = 'keyboard', layout = 'xbox', { shell = false } = {}) {
  return rowsOf(shell).map((r) => [family === 'gamepad' ? r.pad.map((c) => capOf(c, LAYOUTS.includes(layout) ? layout : 'xbox')).join(' / ') : r.keys.join(' / '), r.does]);
}
