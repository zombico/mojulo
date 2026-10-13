/**
 * ITEMS — what can be held, and where it is. Every inventory action is a TRANSFER of items between HOLDERS, guarded so
 * it never overdraws; every inventory menu is a VIEW of a holder whose rows carry a verb (menus.js).
 *
 *   play.items: { <id>: { name?, form?, kind?, about?, use?: effects, equip?: { slot, on?, off? }, value? } }
 *     name    what the player reads (the id's words when left out)
 *     form    its glyph (game/glyph-forms.js: gem, coin, key, heart, star, orb, flag, skull; guessed from the id)
 *     kind    thing | consumable | key | currency (thing)
 *     about   a line the menu shows under it
 *     use     effects a use has (a cue's effects: heal, add, set, say, emit …): an item with them is consumable
 *     equip   worn in a slot (one item a slot; equipping another sends the first back to the bag): `on` effects as it
 *             goes on, `off` as it comes off (add atk 2 / add atk -2); an item with it is equipment
 *     value   what a shop asks for it when its stock names no price
 *   An id the table does not list is still an item, its name and form derived, so every item named today works.
 *
 * HOLDERS are counts on the bus, one var an item: `held:<holder>:<item>`. The player's is `bag`, what it wears `worn`; a
 * chest's or a shop's is its menu's id; `nowhere` is no holder (what a use spends, what a gift comes from). The HUD, a cue's if, a menu's
 * {var} words and the save all read the same numbers.
 *
 *   ITEM_KINDS, ITEM_FORMS
 *   itemKey(id)                  the id as a bus word ('lamp oil' → 'lamp-oil')
 *   heldVar(holder, id)          'held:<holder>:<item>'
 *   readItems(play)              → { <key>: { key, name, form, kind, about, use, value } } the table read; throws, teaching
 *   itemOf(items, id)            the item, the table's or derived
 *   lowerMove({ item, n, from, to, on, deny? }, frag)   a guarded transfer onto the bus: when `on` fires and `from` holds
 *                                n, n go to `to` (`moved:<item>`); else `deny` (a toast's words) and `denied:<item>`.
 *                                Each holder it touches says `in:<holder>:<item>:<n>` / `out:<holder>:<item>:<n>` (the
 *                                store keeps them: game channel, the bag mechanic)
 *   lowerEquips(items, frag, lower)   each equipment item's equip / unequip onto the bus: `equip:<item>` moves it from
 *                                the bag to `worn` (what wore its slot back to the bag first) and does its on effects;
 *                                `unequip:<item>` moves it back and does its off effects. `lower(effects, on)` lowers
 *                                effects (the cues' lowerEffects)
 */
import { formForItem } from '../../game/mechanic-decor.js';
import { GLYPH_IDS } from '../../game/glyph-forms.js';

export const ITEM_KINDS = Object.freeze({
  thing: 'kept: a token, a trinket, a quest piece',
  consumable: 'spent when used: a tonic, a ration, a bomb (an item with use effects is one)',
  key: 'opens something: a door, a gate, a chest (kept, never spent by a use)',
  equipment: 'worn in a slot: a sword in the hand, a cloak on the back (an item with equip is one)',
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
  return { key, name: words(key), form: formForItem(key), kind: 'thing', about: null, use: null, equip: null, value: null };
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
    for (const k of Object.keys(it)) if (!['name', 'form', 'kind', 'about', 'use', 'equip', 'value'].includes(k)) throw new Error(`${at}.${k} is not part of an item (name, form, kind, about, use, equip, value)`);
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
    let equip = null;
    if (it.equip !== undefined) {
      const E = it.equip;
      if (!isObj(E) || !(isStr(E.slot) && /^[a-z][a-z0-9-]*$/.test(E.slot))) throw new Error(`${at}.equip is { slot: '<word>' (hand, head, back…), on?: effects, off?: effects }`);
      for (const k of Object.keys(E)) if (!['slot', 'on', 'off'].includes(k)) throw new Error(`${at}.equip.${k} is not part of equipping (slot, on, off)`);
      if (use) throw new Error(`${at}: an item is used up or worn, not both (use or equip)`);
      const fx = (v, w) => (v === undefined ? [] : (Array.isArray(v) ? v : [v]).map((t, k) => (readEffects ? readEffects(t, `${w}${Array.isArray(v) ? `[${k}]` : ''}`) : t)));
      equip = { slot: E.slot, on: fx(E.on, `${at}.equip.on`), off: fx(E.off, `${at}.equip.off`) };
    }
    out[key] = {
      key, name: it.name ?? words(key), form: it.form ?? formForItem(key),
      kind: it.kind ?? (use ? 'consumable' : equip ? 'equipment' : 'thing'), about: it.about ?? null, use, equip, value: it.value ?? null,
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
  // a holder's changes, said: a game that carries them (the bag mechanic) keeps them in its store (the holder, the item
  // and how many ride in the name: the bus's log keeps an event's type, not its fields)
  if (to !== NOWHERE) frag.reactions.push({ on: ok, do: 'emit', type: `in:${to}:${key}:${n}` });
  if (from !== NOWHERE) frag.reactions.push({ on: ok, do: 'emit', type: `out:${from}:${key}:${n}` });
  frag.reactions.push({ on: no, do: 'emit', type: `denied:${key}` });
  if (deny) frag.hud.push({ on: no, as: 'toast', text: deny, slot: 'center', ttl: 2 });
  return { ok, no };
}

export const WORN = 'worn';
export function lowerEquips(items, frag, lower) {
  const gear = Object.values(items).filter((it) => it.equip);
  for (const it of gear) {
    // its slot's other wearer comes off first (the slot holds one)
    for (const o of gear) if (o !== it && o.equip.slot === it.equip.slot) frag.reactions.push({ on: `equip:${it.key}`, if: { var: heldVar(WORN, o.key), gte: 1 }, do: 'emit', type: `unequip:${o.key}` });
    const on = lowerMove({ item: it.key, from: 'bag', to: WORN, on: `equip:${it.key}`, deny: `No ${it.name} to wear` }, frag);
    frag.reactions.push({ on: on.ok, do: 'emit', type: `equipped:${it.key}` });
    const off = lowerMove({ item: it.key, from: WORN, to: 'bag', on: `unequip:${it.key}` }, frag);
    frag.reactions.push({ on: off.ok, do: 'emit', type: `unequipped:${it.key}` });
    if (it.equip.on.length) lower(it.equip.on, `equipped:${it.key}`);
    if (it.equip.off.length) lower(it.equip.off, `unequipped:${it.key}`);
  }
}
