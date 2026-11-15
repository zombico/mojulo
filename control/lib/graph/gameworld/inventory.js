/**
 * A GAME'S ITEMS AND ITS BAG — the items a genre's hero carries (hero-rows.js `items`), wired onto each level as
 * playscape's own inventory (playscape/ui/items.js: an item with `use` effects is a consumable; cues.js: `use` spends one
 * from the bag; menus.js: the `inventory` menu is a view of the bag), and carried from level to level by the bag
 * mechanic (game/mechanics.js `bag`).
 *
 *   rowInventory(G, mechanics) → { play: { items, menus, cues }, inputs, mechanics, quick } | null
 *     items     the row's table in playscape's words: a healing item's `hearts` lowered to hp on the level's own health
 *     menus     the bag, an inventory menu
 *     cues      the quick item used on its key; the bag opened on its key
 *     inputs    those keys (ITEM_KEYS)
 *     mechanics the bag carried (none added where the level already carries one)
 *     quick     { item, name, var, key, icon? }: the item on the quick key, for the HUD's slot
 *   bagStart(G) → the items a new game's bag holds ({ <item>: n }), or null
 *
 * A world with no row, or a level whose hero has no health to heal: null, and the level is as it was. Pure.
 */
import { genreHero } from './hero-rows.js';
import { heldVar } from '../playscape/ui/items.js';
import { HEART_HITS } from './hud-grammar.js';

/** The keys: the quick item, the bag (a keyboard's; a pad's are the pause menu's until the menus are mana-ui's). */
export const ITEM_KEYS = Object.freeze({ quick: 'x', bag: 'i' });
const cap = (k) => k.toUpperCase();

/** The items a new game's bag holds, or null. */
export const bagStart = (G) => { const s = genreHero(G)?.items?.start; return s && Object.keys(s).length ? { ...s } : null; };

/** A level's items and bag (see the header). */
export function rowInventory(G, mechanics = []) {
  const R = genreHero(G)?.items;
  if (!R || !R.table) return null;
  const death = mechanics.find((m) => m && m.kind === 'fail-on-death' && Number.isFinite(m.startHp) && Number.isFinite(m.hits));
  if (!death) return null;
  const items = {};
  for (const [id, it] of Object.entries(R.table)) {
    const { hearts, ...rest } = it;
    // (a healing item: its hearts as hp on the level's health, never past its full; said as it is used)
    items[id] = Number.isFinite(hearts) ? { ...rest, kind: 'consumable', use: [{ add: 'hp', by: hearts * death.hits * HEART_HITS, max: death.startHp }, { say: `${rest.name ?? id}: ${hearts} heart${hearts === 1 ? '' : 's'} restored`, as: 'toast' }] } : { ...rest };
  }
  const q = R.quick && items[R.quick] ? R.quick : null;
  return {
    play: {
      items,
      menus: [{ id: 'bag', kind: 'inventory', title: 'Bag' }],
      cues: [{ id: 'open-bag', when: { on: 'bag' }, then: { open: 'bag' } }, ...(q ? [{ id: 'quick-item', when: { on: 'quick-item' }, then: { use: q } }] : [])],
    },
    inputs: [{ on: 'key', key: ITEM_KEYS.bag, once: true, emit: { type: 'bag' } }, ...(q ? [{ on: 'key', key: ITEM_KEYS.quick, once: true, emit: { type: 'quick-item' } }] : [])],
    mechanics: mechanics.some((m) => m && m.kind === 'bag') ? [] : [{ kind: 'bag', slice: 'bag' }],
    quick: q ? { item: q, name: items[q].name ?? q, var: heldVar('bag', q), key: cap(ITEM_KEYS.quick), ...(items[q].icon ? { icon: items[q].icon } : {}) } : null,
  };
}
