/**
 * FOE STATES — base states a foe is BORN in, carried by layer 0 (the skeleton under every foe) and so by every mode above
 * it: a state is a status the body starts under (worlds/controllable/cast.js `e.statuses`, a look from
 * playscape/elements), so whatever draws that look on a body draws it on this one, on whichever figure it wears now.
 * A bestiary entry names its states (`states: { flaming: true }`); no foe is listed anywhere for one.
 *
 *   FOE_STATES   the states, each the status it carries, its element, and how it marks the body
 *     flaming    a column of fire up the body (the `blaze` look, as the fire channel's flames on it, lighting the world): a
 *                lick at its legs, the widest at its chest, a narrower peak round its head that leaves the head seen (its
 *                look's coat left off, `coat: false`: the fire is the look); its
 *                body darkened as it burns (`char`, 0 … 1 of its own colour kept; 1 none)
 *
 *   readStates(v, at)   → the entry's states read: { <state>: true | { color?, elemental?, char? } } (throws teaching them)
 *     color      the flame's colour: a colorant (fire/fire.js FIRE_COLORANTS: sodium, strontium, copper …), a plain word
 *                (FLAME_COLORS: blue, green, red, crimson, purple, orange, yellow), a mix or '#rrggbb'; absent, the
 *                element's own
 *     elemental  true: the state is the foe's ELEMENT (`e.element`: what its blows carry, what a system may read: a
 *                fire foe burns what it strikes, shrugs off fire); false (the default): only the look
 *   stateBirth(states, { height })  → { statuses, element? }: what the body is born carrying (its statuses on the world clock at 0), laid
 *                         on the entity's body as `body.born` (worlds/controllable/vanish.js gives it at the first step); a
 *                         body's `height` (m) stands each of its fires where the state says (`fires`: each its `lift`, metres
 *                         over its feet, its kind and size)
 *
 * Pure.
 */
import { FIRE_COLORANTS } from '../fire/fire.js';

export const FOE_STATES = Object.freeze({
  // (its fire a COLUMN up the body, each [at, kind, size]: `at` the share of its height a fire stands at; the legs lick, the
  // chest burns widest, the flames peak at the head narrower, the head seen through them)
  flaming: Object.freeze({ status: 'blaze', element: 'fire', char: 0.35, coat: false, fires: Object.freeze([[0.06, 'brazier', 0.55], [0.4, 'campfire', 1.15], [0.72, 'brazier', 0.8]]), reads: 'licking at its legs, burning up its chest and peaking narrow round its head, its body charred as it burns' }),
});
/** plain words for a flame's colour, as the colorant that burns it */
export const FLAME_COLORS = Object.freeze({ blue: 'copper', green: 'barium', red: 'strontium', crimson: 'lithium', purple: 'potassium', orange: 'calcium', yellow: 'sodium' });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const colorOf = (c) => (typeof c === 'string' && FLAME_COLORS[c] ? FLAME_COLORS[c] : c);
const colorOk = (c) => (typeof c === 'string' ? !!FIRE_COLORANTS[c] || /^#[0-9a-fA-F]{6}$/.test(c) : isObj(c) && Object.keys(c).length > 0 && Object.entries(c).every(([k, w]) => FIRE_COLORANTS[k] && Number.isFinite(w) && w >= 0));

export function readStates(v, at) {
  const names = Object.keys(FOE_STATES).join(', ');
  if (!isObj(v)) throw new Error(`${at} is the states the foe is born in: { ${names}: true | { color?, elemental?, char? } }`);
  const out = {};
  for (const [name, s] of Object.entries(v)) {
    if (!FOE_STATES[name]) throw new Error(`${at}.${name} is not a state (${names})`);
    if (s === false) continue;
    if (s !== true && !isObj(s)) throw new Error(`${at}.${name} is true, or { color?, elemental?, char? }`);
    const o = s === true ? {} : s;
    for (const k of Object.keys(o)) if (!['color', 'elemental', 'char'].includes(k)) throw new Error(`${at}.${name}.${k} is not a state setting (color, elemental, char)`);
    if (o.color !== undefined && !colorOk(colorOf(o.color))) throw new Error(`${at}.${name}.color is a flame's colour: ${Object.keys(FLAME_COLORS).join(', ')}, a colorant (${Object.keys(FIRE_COLORANTS).join(', ')}), a mix or '#rrggbb'`);
    if (o.elemental !== undefined && typeof o.elemental !== 'boolean') throw new Error(`${at}.${name}.elemental is true (the state is its element) or false (only the look)`);
    if (o.char !== undefined && !(Number.isFinite(o.char) && o.char >= 0 && o.char <= 1)) throw new Error(`${at}.${name}.char is how much of its colour the body keeps as it burns, 0 … 1`);
    out[name] = { ...(o.color !== undefined ? { color: colorOf(o.color) } : {}), ...(o.elemental !== undefined ? { elemental: o.elemental } : {}), ...(o.char !== undefined ? { char: o.char } : {}) };
  }
  return out;
}

export function stateBirth(states, { height = null } = {}) {
  const statuses = {};
  let element = null;
  for (const [name, o] of Object.entries(states || {})) {
    const S = FOE_STATES[name];
    statuses[S.status] = { t0: 0, until: null, ...(o.color !== undefined ? { color: o.color } : {}), char: o.char ?? S.char, ...(S.coat === false ? { coat: false } : {}), ...(S.fires && Number.isFinite(height) && height > 0 ? { fires: S.fires.map(([at, kind, size]) => ({ lift: Math.round(at * height * 1000) / 1000, kind, size })) } : {}) };
    if (o.elemental) element = S.element;
  }
  return { statuses, ...(element ? { element } : {}) };
}
