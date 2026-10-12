/**
 * ITEMS — what can be held, and where it is. Every inventory action is a TRANSFER of items between HOLDERS, guarded so
 * it never overdraws; every inventory menu is a VIEW of a holder whose rows carry a verb (menus.js).
 *
 *   play.items: { <id>: { name?, form?, kind?, about?, use?: effects, value? } }
 *     name    what the player reads (the id's words when left out)
 *     form    its glyph (game/glyph-forms.js: gem, coin, key, heart, star, orb, flag, skull; guessed from the id)
 *     kind    thing | consumable | key | currency (thing)
 *     about   a line the menu shows under it
 *     use     effects a use has (a cue's effects: heal, add, set, say, emit …): an item with them is consumable
 *     value   what a shop asks for it when its stock names no price
 *   An id the table does not list is still an item, its name and form derived, so every item named today works.
 *
 * HOLDERS are counts on the bus, one var an item: `held:<holder>:<item>`. The player's is `bag`; a chest's or a shop's
 * is its menu's id; `nowhere` is no holder (what a use spends, what a gift comes from). The HUD, a cue's if, a menu's
 * {var} words and the save all read the same numbers.
 *
 *   ITEM_KINDS, ITEM_FORMS
 *   itemKey(id)                  the id as a bus word ('lamp oil' → 'lamp-oil')
 *   heldVar(holder, id)          'held:<holder>:<item>'
 *   readItems(play)              → { <key>: { key, name, form, kind, about, use, value } } the table read; throws, teaching
 *   itemOf(items, id)            the item, the table's or derived
 *   lowerMove({ item, n, from, to, on, deny? }, frag)   a guarded transfer onto the bus: when `on` fires and `from` holds
 *                                n, n go to `to` (`moved:<item>`); else `deny` (a toast's words) and `denied:<item>`
 */
import { formForItem } from '../../game/mechanic-decor.js';
import { GLYPH_IDS } from '../../game/glyph-forms.js';

export const ITEM_KINDS = Object.freeze({
  thing: 'kept: a token, a trinket, a quest piece',
  consumable: 'spent when used: a tonic, a ration, a bomb (an item with use effects is one)',
  key: 'opens something: a door, a gate, a chest (kept, never spent by a use)',
  currency: 'counted to pay with: coin, shells, scrip',
});
export const ITEM_FORMS = GLYPH_IDS;
export const NOWHERE = 'nowhere';

const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export const itemKey = (id) => String(id).trim().toLowerCase().replace(/\s+/g, '-');
export const heldVar = (holder, id) => `held:${holder}:${itemKey(id)}`;
const words = (key) => key.replace(/-/g, ' ');

function derived(key) {
  return { key, name: words(key), form: formForItem(key), kind: 'thing', about: null, use: null, value: null };
}

export function readItems(play, readEffects = null) {
  const T = play && play.items;
  if (T === undefined) return {};
  if (!isObj(T)) throw new Error('play.items is { <id>: { name?, form?, kind?, about?, use?, value? } }');
  const out = {};
  for (const [id, it] of Object.entries(T)) {
    const at = `play.items['${id}']`, key = itemKey(id);
    if (!/^[a-z][a-z0-9-]*$/.test(key)) throw new Error(`${at}: an item's id is words (letters, digits, spaces or hyphens)`);
    if (out[key]) throw new Error(`play.items: '${id}' names the same item as another (${key})`);
    if (!isObj(it)) throw new Error(`${at} is { name?, form?, kind?, about?, use?, value? }`);
    for (const k of Object.keys(it)) if (!['name', 'form', 'kind', 'about', 'use', 'value'].includes(k)) throw new Error(`${at}.${k} is not part of an item (name, form, kind, about, use, value)`);
    if (it.name !== undefined && !isStr(it.name)) throw new Error(`${at}.name is the words the player reads`);
    if (it.form !== undefined && !ITEM_FORMS.includes(it.form)) throw new Error(`${at}.form is a glyph: ${ITEM_FORMS.join(', ')}`);
    if (it.kind !== undefined && !ITEM_KINDS[it.kind]) throw new Error(`${at}.kind is one of ${Object.keys(ITEM_KINDS).join(', ')}`);
    if (it.about !== undefined && !isStr(it.about)) throw new Error(`${at}.about is a line of words`);
    if (it.value !== undefined && !(Number.isFinite(it.value) && it.value >= 0)) throw new Error(`${at}.value is a price, 0 or more`);
    let use = null;
    if (it.use !== undefined) {
      if (it.kind === 'key' || it.kind === 'currency') throw new Error(`${at}.use: a ${it.kind} is not used up; give it a use only as a thing or a consumable`);
      const list = Array.isArray(it.use) ? it.use : [it.use];
      use = readEffects ? list.map((t, k) => readEffects(t, `${at}.use${Array.isArray(it.use) ? `[${k}]` : ''}`)) : list;
    }
    out[key] = {
      key, name: it.name ?? words(key), form: it.form ?? formForItem(key),
      kind: it.kind ?? (use ? 'consumable' : 'thing'), about: it.about ?? null, use, value: it.value ?? null,
    };
  }
  return out;
}

export const itemOf = (items, id) => items[itemKey(id)] ?? derived(itemKey(id));

export function lowerMove({ item, n = 1, from, to, on, deny = null, also = [] }, frag) {
  const key = itemKey(item), ok = `moved:${on}:${key}`, no = `denied:${on}:${key}`;
  for (const h of [from, to]) if (h !== NOWHERE) frag.vars[heldVar(h, key)] ??= 0;
  // the guards: `from` holds n, and each `also` (a price: { var, gte }) holds; the first that fails denies
  const guards = [...(from === NOWHERE ? [] : [{ var: heldVar(from, key), gte: n }]), ...also];
  if (!guards.length) frag.reactions.push({ on, do: 'emit', type: ok });
  guards.forEach((g, k) => {
    const src = k ? `${ok}:${k}` : on, dst = k === guards.length - 1 ? ok : `${ok}:${k + 1}`;
    frag.reactions.push({ on: src, if: g, do: 'emit', type: dst });
    frag.reactions.push({ on: src, if: { var: g.var, lt: g.gte }, do: 'emit', type: no });
  });
  if (from !== NOWHERE) frag.reactions.push({ on: ok, do: 'inc', var: heldVar(from, key), by: -n, min: 0 });
  if (to !== NOWHERE) frag.reactions.push({ on: ok, do: 'inc', var: heldVar(to, key), by: n });
  frag.reactions.push({ on: no, do: 'emit', type: `denied:${key}` });
  if (deny) frag.hud.push({ on: no, as: 'toast', text: deny, slot: 'center', ttl: 2 });
  return { ok, no };
}
