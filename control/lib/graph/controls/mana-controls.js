/**
 * THE CONTROLS AS MANA-UI READS THEM — the bridge from the control schemes (schemes.js: intents, never keys; devices.js:
 * the families and their standards; controls-kernel.js: resolve, label, conflicts, capture) to the game UI runtime
 * (control/lib/mana-ui/), a view that takes intents and reads no device. One truth for both directions:
 *
 *   IN    a scheme resolved onto the keyboard and onto each printed pad layout: what the host (mana-host.js) reads, a key code or a pad's
 *         button or half axis → a menu action (the same shape interact-channel.js menuControls gives the playscape
 *         menus, so the two read a pad alike)
 *   OUT   what each action's control is called on each family (keys, each pad layout, a headset): the glyphs a prompt
 *         and a legend print, switched as the player picks up another device; the rows a controls screen lists; a remap
 *         and the conflicts it makes
 *
 *   manaControls({ scheme?, accept?, over? }) → { keys, pad, padLayout }   (scheme: the menu's; accept: other schemes'
 *                                    actions that also accept in a menu, the pilot's interact by default: the key that
 *                                    opened a menu picks in it; over: a remap, the kernel's override shape)
 *   manaGlyphs(schemes?, { over? }) → { keys, pad: { <layout>: … }, xr } each { <action>: label } (the first control
 *                                    bound; the menu's and the pilot's actions by default, a game's own schemes besides)
 *   controlsRows(scheme, { over?, layout? }) → [{ action, label, group, keys: [keyboard…, pad], conflict? }] for the
 *                                    controls-screen idiom (its keybinds), each as the kernel labels it
 *   remap(scheme, over, { action, family, control, slot? }) → { over, conflicts }: a captured control set in its slot
 *   padLayoutSource()               the kernel's pad-layout reader as page source (the host's padLayout)
 *   kernelSource()                  the whole controls kernel as page source
 *   manaHostSource()                mana-host.js as page source: connect(rt, view, { ...manaControls(), seatOf? }) is
 *                                   the page's input owner driving the UI (mana-ui itself reads no device)
 */
import { buildControlsKernel } from './controls-kernel.js';
import { SCHEMES } from './schemes.js';
import { DEVICES } from './devices.js';
import { buildManaHost } from './mana-host.js';

const K = buildControlsKernel();
const LAYOUTS = Object.keys(DEVICES.gamepad.layouts);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

// a pad's controls (buttons by index, half axes by index and sign) → action, the scheme's order winning a shared button
function padOf(B, extra) {
  const P = { b: {}, a: [] };
  const put = (c, id) => {
    const m = /^([a-zA-Z]+)([+-])$/.exec(c);
    if (m && DEVICES.gamepad.axes[m[1]] !== undefined) { if (!P.a.some(([ax, sg]) => ax === DEVICES.gamepad.axes[m[1]] && sg === (m[2] === '-' ? -1 : 1))) P.a.push([DEVICES.gamepad.axes[m[1]], m[2] === '-' ? -1 : 1, id]); }
    else if (DEVICES.gamepad.buttons[c] !== undefined && P.b[DEVICES.gamepad.buttons[c]] === undefined) P.b[DEVICES.gamepad.buttons[c]] = id;
  };
  for (const id of Object.keys(B)) for (const c of B[id]) put(c, id);
  for (const c of extra) put(c, 'accept');
  return P;
}

/** The menu's scheme resolved for mount: key code → action, and per printed pad layout its buttons and half axes. */
export function manaControls({ scheme = SCHEMES.menu, accept = [{ scheme: SCHEMES.pilot, action: 'interact' }], over = null } = {}) {
  const keys = K.codeMap(K.resolve(scheme, { keyboard: DEVICES.keyboard }, over), 'keyboard');
  for (const A of accept) for (const c of K.resolve(A.scheme, { keyboard: DEVICES.keyboard }).bind.keyboard[A.action] || []) if (!keys[c]) keys[c] = 'accept';
  const pad = {};
  for (const L of LAYOUTS) {
    const B = K.resolve(scheme, { gamepad: DEVICES.gamepad }, over, { layout: L }).bind.gamepad;
    const extra = accept.flatMap((A) => K.resolve(A.scheme, { gamepad: DEVICES.gamepad }, null, { layout: L }).bind.gamepad[A.action] || []);
    pad[L] = padOf(B, extra);
  }
  return { keys, pad, padLayout: K.padLayout };
}

/** What each action's control is called, per family and pad layout: the glyphs a prompt and a legend print. */
export function manaGlyphs(schemes = [SCHEMES.menu, SCHEMES.pilot], { over = null } = {}) {
  const out = { keys: {}, pad: Object.fromEntries(LAYOUTS.map((L) => [L, {}])), xr: {} };
  for (const S of schemes) {
    const own = over && over[S.id] ? over[S.id] : null;
    const kb = K.resolve(S, { keyboard: DEVICES.keyboard }, own).bind.keyboard;
    for (const [a, cs] of Object.entries(kb)) if (cs[0] && out.keys[a] === undefined) out.keys[a] = K.label(DEVICES, 'keyboard', cs[0]);
    for (const L of LAYOUTS) {
      const gp = K.resolve(S, { gamepad: DEVICES.gamepad }, own, { layout: L }).bind.gamepad;
      for (const [a, cs] of Object.entries(gp)) if (cs[0] && out.pad[L][a] === undefined) out.pad[L][a] = K.label(DEVICES, 'gamepad', cs[0], L);
    }
    const xr = K.resolve(S, { xr: DEVICES.xr }, own).bind.xr;
    for (const [a, cs] of Object.entries(xr)) if (cs[0] && out.xr[a] === undefined) out.xr[a] = K.label(DEVICES, 'xr', cs[0]);
  }
  return out;
}

/** A scheme's actions as the controls screen lists them: each with its keys and its pad control, and any clash. */
export function controlsRows(scheme, { over = null, layout = 'xbox' } = {}) {
  const B = K.resolve(scheme, { keyboard: DEVICES.keyboard, gamepad: DEVICES.gamepad }, over, { layout });
  const clash = new Set(K.conflicts(scheme, B).flatMap((c) => c.actions));
  return scheme.actions.map((a) => ({
    action: a.id, label: a.label, group: a.group,
    keys: [...B.bind.keyboard[a.id].map((c) => K.label(DEVICES, 'keyboard', c)), ...B.bind.gamepad[a.id].slice(0, 1).map((c) => K.label(DEVICES, 'gamepad', c, layout))],
    ...(clash.has(a.id) ? { conflict: true } : {}),
  }));
}

/** A captured control set in an action's slot: the new override, and the conflicts it makes (advised, never refused). */
export function remap(scheme, over, { action, family, control, slot = 0 }) {
  if (!scheme.actions.some((a) => a.id === action)) throw new Error(`remap: ${scheme.id} has no action '${action}' (${scheme.actions.map((a) => a.id).join(', ')})`);
  if (!DEVICES[family]) throw new Error(`remap: no device family '${family}' (${Object.keys(DEVICES).join(', ')})`);
  const c = K.capture(family, control);
  if (!K.valid(DEVICES, family, c)) throw new Error(`remap: '${control}' is not a ${family} control`);
  const base = K.resolve(scheme, { [family]: DEVICES[family] }, over).bind[family][action] || [];
  const now = base.slice(0, 2);
  now[slot] = c;
  const next = { ...(isObj(over) ? over : {}), [family]: { ...((isObj(over) && over[family]) || {}), [action]: now.filter(Boolean) } };
  return { over: next, conflicts: K.conflicts(scheme, K.resolve(scheme, { [family]: DEVICES[family] }, next)) };
}

export const padLayoutSource = () => K.padLayout.toString();
export const kernelSource = () => `(${buildControlsKernel.toString()})()`;
export const manaHostSource = () => `(${buildManaHost.toString()})()`;
