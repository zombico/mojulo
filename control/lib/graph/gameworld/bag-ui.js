/**
 * THE BAG AS A SCREEN — what a level's hero carries, laid for mana-ui's inventory (control/lib/mana-ui: a grid of what
 * is held by category, each an icon, its count, and what it is for). The page hosts it (scene/channels/bag-channel.js),
 * opened with a key; what is in it is read off the level's own mechanics (its errand's goods, their prices, what its
 * jobs pay), so it never lists a thing the level cannot hold. How it is dressed is the interface's to say (a
 * gameworld's `ui.inventory`), every word optional and none a colour: the look is the game's theme.
 *
 *   ui.inventory: false | { title?: 'Inventory', icons?: { <item>: '<pictogram>' } }
 *       icons   a pictogram's name (mana-ui/icons.js) for an item by its name; unnamed, an item is drawn by its own
 *               word where the shelf has one (coin, key, potion), else by what it is: money a coin, a job's goods a
 *               parcel, someone carried a person
 *
 *   BAG_UI                         the defaults
 *   readBagUi(v, where?)           → errors[] (teaching)
 *   bagUi(manifest, ui?)           → { title, slice, items: [{ id, var, name, icon, kind, about, category }], money: var | null } | null
 *                                    null for a level with no bag, or `ui.inventory: false`
 * Pure.
 */
import { iconOf } from '../../mana-ui/icons.js';
import { jobsOf } from './city-guide.js';

export const BAG_UI = Object.freeze({ title: 'Inventory', person: /^(passenger|rider|fare|guest|patient|client|hostage|captive|child|friend)s?$/ });
const KEYS = ['title', 'icons'];
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const words = (s) => String(s).replace(/-/g, ' ');
const cap = (s) => `${words(s)[0].toUpperCase()}${words(s).slice(1)}`;

export function readBagUi(v, where = 'ui.inventory') {
  if (v === undefined || v === false) return [];
  if (!isObj(v)) return [`${where} is false (no inventory screen) or { ${KEYS.join('?, ')}? }`];
  const errors = [];
  for (const k of Object.keys(v)) if (!KEYS.includes(k)) errors.push(`${where}.${k}: not an inventory setting (${KEYS.join(', ')})`);
  if (v.title !== undefined && !(typeof v.title === 'string' && v.title.trim() && v.title.length <= 40)) errors.push(`${where}.title is what the screen is called, in words`);
  if (v.icons !== undefined) {
    if (!isObj(v.icons)) errors.push(`${where}.icons is { <item>: '<pictogram>' }`);
    else for (const [k, name] of Object.entries(v.icons)) if (typeof name !== 'string' || !iconOf(name)) errors.push(`${where}.icons.${k} '${name}' is not a pictogram mana-ui draws (mana-ui/icons.js: coin, box, person, key, potion, ticket…)`);
  }
  return errors;
}

export function bagUi(manifest, ui = undefined) {
  const M = Array.isArray(manifest?.game?.mechanics) ? manifest.game.mechanics : [], bag = M.find((m) => m && m.kind === 'bag');
  if (ui === false || !bag) return null;
  const U = isObj(ui) ? ui : {}, slice = bag.slice ?? 'bag', jobs = jobsOf(M);
  // every item the level can put in the bag: what is had, what is spent for it, what is asked for, what is paid
  const seen = new Map(), note = (item, role) => { if (typeof item !== 'string') return; const r = seen.get(item) ?? new Set(); r.add(role); seen.set(item, r); };
  for (const m of M) {
    if (m?.kind === 'trade') { note(m.item, 'had'); for (const n of m.needs ?? []) note(n.item, 'price'); }
    if (m?.kind === 'deliver') { for (const w of m.wants ?? []) note(w.item, 'asked'); for (const r of m.reward ?? []) note(r.item, 'pay'); }
    if (m?.kind === 'shift') for (const r of m.reward ?? []) note(r.item, 'pay');
    if (m?.kind === 'collect') for (const p of m.pickups ?? []) note(p.item, 'found');
  }
  // (money: what is only ever paid, never had from a trade or asked for)
  const money = [...seen].filter(([, r]) => r.has('pay') && !r.has('had') && !r.has('asked')).map(([k]) => k);
  const aboutOf = (item) => {
    for (const J of jobs) {
      const hand = J.steps[J.steps.length - 1], pick = J.steps.find((s) => s.id === `pick-${item}`);
      const T = M.find((m) => m?.kind === 'trade' && (m.needs ?? []).some((n) => n.item === item));
      if (T && J.steps.some((s) => s.id === `pick-${T.item}`)) return `${J.name}: the price of the ${words(T.item)}`;
      if (pick && M.some((m) => m?.kind === 'deliver' && (m.id ?? 'errand') === J.id && (m.wants ?? []).some((w) => w.item === item))) return `${J.name}: ${hand.say.toLowerCase()}`;
    }
    return money.includes(item) ? 'What your jobs have paid' : '';
  };
  const iconFor = (item) => U.icons?.[item] ?? (iconOf(item) ? item : money.includes(item) ? 'coin' : BAG_UI.person.test(item) ? 'person' : 'box');
  const items = [...seen.keys()].map((item) => ({ id: item, var: `held:${slice}:${item}`, name: cap(item), icon: iconFor(item), kind: money.includes(item) ? 'Money' : BAG_UI.person.test(item) ? 'Passenger' : 'Goods', about: aboutOf(item), category: money.includes(item) ? 'Money' : 'Carried' }));
  return { title: U.title ?? BAG_UI.title, slice, items, money: money.length ? `held:${slice}:${money[0]}` : null };
}
