/**
 * MENUS — what comes up when the figure does something in a map: the sign it reads, the keeper it talks to, the shop
 * counter, the chest, the bed that asks to rest, the save point, the map table. A closed set of game-menu kinds, each
 * a layout over a few fields, opened by a cue (cues.js `{ open }`) from anything a map carries (an anchor) or any
 * happening, and closed by a choice, a cue, or walking away.
 *
 *   play.menus: [{ id, kind, title?, …the kind's fields }]
 *     read     { text | pages: [text…] }                            a sign, a note, a plaque, a book
 *     talk     { who?, lines: [text | { who, say }], choices?: [{ say, then? }] }
 *     confirm  { ask, yes: effect(s), no?: effect(s) }              rest here? save? pull the lever?
 *     shop     { stock: [{ item, price }], currency: '<var>', sell? }
 *     chest    { holds: [{ item, count? }] }
 *     save     { slots? }                                           (3)
 *     map      { }                                                  the map's own rooms and anchors
 *     list     { rows: [{ label, var }] }                           a status page, a quest log
 *
 * A choice, a yes and a no do cue effects (cues.js readEffect: say, show, hide, state, phase, open, close, set, emit, and the cast's);
 * picking one closes its menu unless it opens another. A MENU HAS NO STYLE OF ITS OWN: the world's UI guide
 * (play.ui.guide, drawn from the world's tone and play_hints) dresses it, as it dresses the parts.
 *
 *   MENU_KINDS              kind → { about, fields, example }
 *   readMenus(play)         → [{ id, kind, title, …, picks: [{ say, then }] }] or throws, teaching
 *   lowerMenus(play)        → an events fragment: each pick's effects on `menu-pick:<menu>:<n>`, or null
 *   menuPages(play)         → what the page draws (words and pick labels; the effects stay on the bus)
 *   openers(play)           menu id → what opens it (cue ids and other menus' picks)
 *
 * THE PAGE (scene/channels/events.js) draws the open menu over the play from `events.menus`, in the guide's sheet:
 * up / down move the focus, enter / space / E pick (emitting `menu-pick:<menu>:<n>`), escape closes
 * (`menu-close:<menu>`); a read menu turns its pages and closes after the last.
 *
 * VIEWS (shop, chest, inventory): a menu over a holder of items (items.js), its rows live (a row whose holder holds
 * none is not drawn), each with a verb that accept does (`menu-act:<menu>:<row>`), the menu staying up:
 *   shop       buy: the currency var pays the price (the item's value when the stock names none) into the bag; a stock
 *              row with a count is a holder too (the shop's: `held:<menu>:<item>`), and runs out
 *   chest      take: one of the item from the chest (`held:<menu>:<item>`, filled with its holds) into the bag
 *   inventory  use: one of the item from the bag spent, and its use effects (play.items) done; a row with no use reads
 *   Each says why when its guard fails (a toast): too poor, none left.
 *   viewRows(play, menu)   → [{ item, name, form, count?, price?, verb?, about? }] a view's rows
 */
import { readEffect, effectContext, lowerEffects, emptyFrag, tidy, menuVar, readCues } from './cues.js';
import { readItems, itemOf, itemKey, heldVar, lowerMove, NOWHERE } from './items.js';

export const MENU_KINDS = Object.freeze({
  read: { about: 'words to read: a sign, a note, a plaque, a book (pages turn)', fields: 'text | pages', example: { id: 'plaque', kind: 'read', title: 'Brass plaque', text: 'Here the east wing burned, and was built again.' } },
  talk: { about: 'someone speaks: lines, then choices that lead on', fields: 'who?, lines, choices?', example: { id: 'keeper', kind: 'talk', who: 'Keeper', lines: ['You came by the garden gate.', 'Few do.'], choices: [{ say: 'Who lives here?', then: { open: 'plaque' } }, { say: 'Goodbye' }] } },
  confirm: { about: 'a yes or a no: rest here, save, pull the lever', fields: 'ask, yes, no?', example: { id: 'rest', kind: 'confirm', ask: 'Rest until dawn?', yes: [{ set: 'hp', to: 100 }, { say: 'You wake rested.' }] } },
  shop: { about: 'buy for a currency: accept buys the item in focus when the currency var holds its price (and the stock lasts)', fields: 'stock: [{ item, price?, count? }], currency', example: { id: 'counter', kind: 'shop', title: 'Apothecary', currency: 'gold', stock: [{ item: 'tonic', price: 12 }, { item: 'lamp oil', price: 5 }], sell: true } },
  chest: { about: 'what a container holds: accept takes one of the item in focus into the bag', fields: 'holds', example: { id: 'trunk', kind: 'chest', title: 'Old trunk', holds: [{ item: 'crest key' }, { item: 'candle', count: 3 }] } },
  save: { about: 'save slots at a save point', fields: 'slots?', example: { id: 'typewriter', kind: 'save', title: 'Save your progress', slots: 3 } },
  map: { about: 'the map itself: its rooms and the things in it, where you are', fields: '(none)', example: { id: 'atlas', kind: 'map', title: 'East wing' } },
  inventory: { about: 'what you carry: each item held, with its count; accept uses the one in focus (when it has a use)', fields: 'from? (bag)', example: { id: 'bag', kind: 'inventory', title: 'Bag' } },
  list: { about: 'rows over vars: a status page, a quest log', fields: 'rows', example: { id: 'status', kind: 'list', title: 'Status', rows: [{ label: 'Health', var: 'hp' }, { label: 'Keys', var: 'keys' }] } },
});
export const MENU_IDS = Object.keys(MENU_KINDS);
// what only the guide decides: a menu that tries to carry one is pointed at the guide
const STYLE_KEYS = ['style', 'skin', 'color', 'colour', 'font', 'tokens', 'register', 'border', 'theme', 'css'];
const ID = /^[a-z][a-z0-9-]*$/;
const isStr = (v) => typeof v === 'string' && v.length > 0;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const listOf = (v) => (v === undefined ? [] : Array.isArray(v) ? v : [v]);

/** The menus of a play block, read; shape errors throw and teach. */
export function readMenus(play) {
  const list = play && play.menus;
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error(`play.menus is a list of { id, kind, … }: kinds ${MENU_IDS.join(', ')}`);
  const ctx = effectContext(play), seen = new Set();
  return list.map((m, i) => {
    const where = `play.menus[${i}]`;
    if (!isObj(m)) throw new Error(`${where} is { id, kind, title?, … }`);
    if (!isStr(m.id) || !ID.test(m.id)) throw new Error(`${where}.id '${m.id}' is a lower-case word`);
    if (seen.has(m.id)) throw new Error(`play.menus: two menus called '${m.id}'`);
    seen.add(m.id);
    if (!MENU_KINDS[m.kind]) throw new Error(`${where}.kind is one of: ${MENU_IDS.join(', ')}`);
    const styled = STYLE_KEYS.filter((k) => m[k] !== undefined);
    if (styled.length) throw new Error(`${where}.${styled[0]}: a menu has no look of its own; the world's UI guide dresses it (play.ui: the guide, its register and border)`);
    if (m.title !== undefined && typeof m.title !== 'string') throw new Error(`${where}.title is words`);
    const eff = (v, w) => listOf(v).map((t, k) => readEffect(t, `${w}${Array.isArray(v) ? `[${k}]` : ''}`, ctx));
    const out = { id: m.id, kind: m.kind, title: m.title ?? null, picks: [] };
    if (m.kind === 'read') {
      const pages = m.pages !== undefined ? m.pages : m.text !== undefined ? [m.text] : null;
      if (!(Array.isArray(pages) && pages.length && pages.every(isStr))) throw new Error(`${where}: a read menu has text (words) or pages: [words, …]`);
      out.pages = pages;
    } else if (m.kind === 'talk') {
      if (!(Array.isArray(m.lines) && m.lines.length)) throw new Error(`${where}: a talk has lines: [words | { who, say }, …]`);
      out.who = isStr(m.who) ? m.who : null;
      out.lines = m.lines.map((l, k) => {
        if (isStr(l)) return { who: out.who, say: l };
        if (isObj(l) && isStr(l.say)) return { who: isStr(l.who) ? l.who : out.who, say: l.say };
        throw new Error(`${where}.lines[${k}] is words, or { who, say }`);
      });
      out.picks = (m.choices || []).map((c, k) => {
        if (!isObj(c) || !isStr(c.say)) throw new Error(`${where}.choices[${k}] is { say, then? }`);
        return { say: c.say, then: eff(c.then, `${where}.choices[${k}].then`) };
      });
    } else if (m.kind === 'confirm') {
      if (!isStr(m.ask)) throw new Error(`${where}: a confirm asks something: ask: '<words>'`);
      if (m.yes === undefined) throw new Error(`${where}: a confirm says what yes does: yes: effect | [effect, …]`);
      out.ask = m.ask;
      out.picks = [{ say: 'Yes', then: eff(m.yes, `${where}.yes`) }, { say: 'No', then: eff(m.no, `${where}.no`) }];
    } else if (m.kind === 'shop') {
      if (!isStr(m.currency)) throw new Error(`${where}: a shop names its currency var: currency: '<var>'`);
      if (!(Array.isArray(m.stock) && m.stock.length && m.stock.every((s) => isObj(s) && isStr(s.item) && (s.price === undefined || (Number.isFinite(s.price) && s.price >= 0)) && (s.count === undefined || (Number.isInteger(s.count) && s.count > 0))))) throw new Error(`${where}: a shop's stock is [{ item, price?, count? }, …] (price: the item's value when left out; count: how many it has, else it never runs out)`);
      const items = readItems(play);
      for (const [k, s] of m.stock.entries()) if (s.price === undefined && itemOf(items, s.item).value === null) throw new Error(`${where}.stock[${k}]: '${s.item}' has no price here and no value in play.items`);
      Object.assign(out, { currency: m.currency, stock: m.stock.map((s) => ({ item: s.item, price: s.price ?? itemOf(items, s.item).value, ...(s.count ? { count: s.count } : {}) })), sell: m.sell === true });
    } else if (m.kind === 'chest') {
      if (!(Array.isArray(m.holds) && m.holds.length && m.holds.every((h) => isObj(h) && isStr(h.item) && (h.count === undefined || (Number.isInteger(h.count) && h.count > 0))))) throw new Error(`${where}: a chest holds [{ item, count? }, …]`);
      out.holds = m.holds.map((h) => ({ item: h.item, count: h.count ?? 1 }));
    } else if (m.kind === 'save') {
      if (m.slots !== undefined && !(Number.isInteger(m.slots) && m.slots >= 1 && m.slots <= 12)) throw new Error(`${where}.slots is 1 to 12`);
      out.slots = m.slots ?? 3;
    } else if (m.kind === 'inventory') {
      if (m.from !== undefined && !(isStr(m.from) && ID.test(m.from))) throw new Error(`${where}.from is the holder it shows (bag, or a chest's or a shop's menu id)`);
      out.from = m.from ?? 'bag';
    } else if (m.kind === 'list') {
      if (!(Array.isArray(m.rows) && m.rows.length && m.rows.every((r) => isObj(r) && isStr(r.var)))) throw new Error(`${where}: a list has rows: [{ label, var }, …]`);
      out.rows = m.rows.map((r) => ({ label: isStr(r.label) ? r.label : r.var, var: r.var }));
    }
    return out;
  });
}

/** Each menu's picks onto the bus: picking closes the menu (unless the pick opens another), then does its effects. */
export function lowerMenus(play, { places = [] } = {}) {
  const menus = readMenus(play), ctx = effectContext(play);
  // the items' uses: a use (a view's, or a cue's `use`) says used:<item>, and the item's effects follow
  const items = readItems(play, (t, w) => readEffect(t, w, ctx)), uses = Object.values(items).filter((it) => it.use);
  if (!menus.length && !uses.length) return null;
  const { phases, menuIds } = ctx, frag = emptyFrag();
  for (const it of uses) lowerEffects(it.use, `used:${it.key}`, frag, { phases, menuIds, places });
  for (const m of menus) {
    frag.vars[menuVar(m.id)] = 0;
    frag.reactions.push({ on: `menu-close:${m.id}`, do: 'set', var: menuVar(m.id), to: 0 });   // the page's back / escape
    // a view's rows: accept does the row's verb, the menu staying up
    if (VIEWS.includes(m.kind)) viewRows(play, m).forEach((r, k) => {
      const on = `menu-act:${m.id}:${k}`;
      if (r.verb === 'take') lowerMove({ item: r.item, from: m.id, to: 'bag', on, deny: 'None left' }, frag);
      else if (r.verb === 'use') { const { ok } = lowerMove({ item: r.item, from: m.from, to: NOWHERE, on, deny: `No ${r.name} left` }, frag); frag.reactions.push({ on: ok, do: 'emit', type: `used:${r.item}` }); }
      else if (r.verb === 'buy') {
        const { ok } = lowerMove({ item: r.item, from: r.count ? m.id : NOWHERE, to: 'bag', on, also: [{ var: m.currency, gte: r.price }], deny: r.count ? `Not enough ${m.currency}, or sold out` : `Not enough ${m.currency}` }, frag);
        if (r.price) frag.reactions.push({ on: ok, do: 'inc', var: m.currency, by: -r.price });
      }
    });
    // a chest's holds and a shop's counted stock fill their holders
    if (m.kind === 'chest') for (const h of m.holds) frag.vars[heldVar(m.id, h.item)] = h.count;
    if (m.kind === 'shop') for (const x of m.stock) if (x.count) frag.vars[heldVar(m.id, x.item)] = x.count;
    m.picks.forEach((p, k) => {
      const on = `menu-pick:${m.id}:${k}`;
      frag.reactions.push({ on, do: 'set', var: menuVar(m.id), to: 0 });
      lowerEffects(p.then, on, frag, { phases, menuIds, places });
    });
  }
  return tidy(frag);
}

/** What the page draws for each menu: its words and its picks' labels (the effects are on the bus, keyed by pick). */
export function menuPages(play) {
  return readMenus(play).map(({ picks, ...m }) => ({ ...m, var: menuVar(m.id), ...(picks.length ? { picks: picks.map((p) => p.say) } : {}), ...(VIEWS.includes(m.kind) ? { rows: viewRows(play, m) } : {}) }));
}

export const VIEWS = Object.freeze(['shop', 'chest', 'inventory']);
// the items an inventory may show: the table's, and every item a menu or a cue of the play names
function itemsNamed(play) {
  const keys = new Set(Object.keys(readItems(play)));
  for (const m of (play && play.menus) || []) for (const x of [...((m && m.stock) || []), ...((m && m.holds) || [])]) if (x && isStr(x.item)) keys.add(itemKey(x.item));
  for (const c of (play && play.cues) || []) for (const t of listOf(c && c.then)) if (t && t.give !== undefined) keys.add(itemKey(isStr(t.give) ? t.give : t.give.item));
  return [...keys];
}
/** A view's rows: its items, each with the var counting what its holder holds (none for an endless stock), its price
 * (a shop's), the verb accept does on it, and its words. */
export function viewRows(play, m) {
  const items = readItems(play), row = (id) => { const it = itemOf(items, id); return { item: it.key, name: it.name, form: it.form, ...(it.about ? { about: it.about } : {}) }; };
  if (m.kind === 'shop') return m.stock.map((s) => ({ ...row(s.item), price: s.price, ...(s.count ? { count: heldVar(m.id, s.item) } : {}), verb: 'buy' }));
  if (m.kind === 'chest') return m.holds.map((h) => ({ ...row(h.item), count: heldVar(m.id, h.item), verb: 'take' }));
  return itemsNamed(play).map((k) => ({ ...row(k), count: heldVar(m.from, k), ...(itemOf(items, k).use ? { verb: 'use' } : {}) }));
}

/** What opens each menu: the cues and the other menus' picks that name it. */
export function openers(play) {
  const out = new Map(readMenus(play).map((m) => [m.id, []]));
  const note = (ts, by, self = null) => { for (const t of ts) if (t.kind === 'open' && out.has(t.menu) && t.menu !== self) out.get(t.menu).push(by); };
  for (const c of readCues(play)) note(c.then, `cue ${c.id}`);
  for (const m of readMenus(play)) m.picks.forEach((p) => note(p.then, `${m.id} · ${p.say}`, m.id));
  return out;
}

/**
 * A menu's markup at a focus and a page: ONE source for the board's specimens and the page's overlay (shipped into the
 * page with toString(), so it references nothing outside itself). `m` is a menuPages row; picks carry data-pick.
 */
export function menuHtml(m, focus = 0, page = 0, vars = {}) {
  const e = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const ch = (say, i) => `<span class="pu-ch${i === focus ? ' on' : ''}" data-pick="${i}">${e(say)}</span>`;
  const head = m.title ? `<span class="pu-mt">${e(m.title)}</span>` : '';
  const picks = m.picks && m.picks.length ? `<span>${m.picks.map(ch).join('')}</span>` : '';
  const rows = (xs) => `<table class="pu-tab">${xs.map(([a, b], i) => `<tr><td>${i === focus ? '▸ ' : ''}${e(a)}</td><td class="pu-num">${e(b)}</td></tr>`).join('')}</table>`;
  let body = '';
  if (m.kind === 'read') { const n = m.pages.length, p = Math.min(page, n - 1); body = `<span>${e(m.pages[p])}</span><span class="pu-foot"><span>${n > 1 ? `${p + 1} / ${n} · ${p + 1 < n ? 'next ▸' : 'close'}` : 'close'}</span></span>`; }
  else if (m.kind === 'talk') body = `${m.lines.slice(0, 3).map((l) => `<span>${l.who ? `<span class="pu-who">${e(l.who)}</span> ` : ''}${e(l.say)}</span>`).join('')}${picks}`;
  else if (m.kind === 'confirm') body = `<span>${e(m.ask)}</span>${picks}`;
  else if (m.rows) {
    // a view: its live rows (a holder holding none is not drawn), the one in focus marked and its words under them
    const live = m.rows.filter((r) => !r.count || (vars[r.count] || 0) > 0), f = live[Math.min(focus, live.length - 1)];
    const num = (r) => (m.kind === 'shop' ? `${r.price}${r.count ? ` · ${vars[r.count] || 0} left` : ''}` : `×${vars[r.count] || 0}`);
    const tab = live.length ? `<table class="pu-tab">${live.map((r, i) => `<tr data-pick="${i}"><td>${i === focus ? '▸ ' : ''}${e(r.name)}</td><td class="pu-num">${e(num(r))}</td></tr>`).join('')}</table>` : `<span class="pu-muted">${m.kind === 'chest' ? 'Empty.' : m.kind === 'shop' ? 'Sold out.' : 'Nothing carried.'}</span>`;
    const about = f && f.about ? `<span class="pu-about">${e(f.about)}</span>` : '';
    const verb = f && f.verb ? `<span>accept: ${e(f.verb)}</span>` : '';
    body = `${tab}${about}<span class="pu-foot">${m.kind === 'shop' ? `<span>${e(m.currency)}: ${vars[m.currency] || 0}</span>` : ''}${verb}<span>back: close</span></span>`;
  }
  else if (m.kind === 'save') body = `<span>${Array.from({ length: Math.min(m.slots, 4) }, (_, i) => `<span class="pu-ch${i === focus ? ' on' : ''}">Slot ${i + 1}</span>`).join('')}</span>`;
  else if (m.kind === 'map') body = `<span class="pu-map">${Array.from({ length: 8 }, (_, i) => `<i${i === 5 ? ' class="here"' : ''}></i>`).join('')}</span>`;
  else if (m.kind === 'list') body = rows(m.rows.slice(0, 8).map((r) => [r.label, `{${r.var}}`]));
  return `<div class="moj-w moj-w-menu" data-menu="${e(m.id)}">${head}${body}</div>`;
}
