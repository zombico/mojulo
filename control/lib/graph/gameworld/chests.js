/**
 * CHESTS — the treasure a party RPG's levels keep off the path (RPG Maker's treasure event): a chest on the map, walked
 * up to and opened (E), everything in it taken into the bag at once and the find said, standing open after. Opened, it
 * stays opened: what it held is a holder's count (playscape/ui/items.js), and the bag mechanic keeps each chest's in a
 * flags slice of the store (CHEST_SLICE, game/mechanics.js bag `holders`), so a level gone back to, a save loaded, finds
 * it empty and open.
 *
 * Composed of what is already there: a CHEST MENU looted whole (playscape/ui/menus.js `loot: 'all'`) is what it holds and
 * what opening it does; a cue opens it where it stands (`use`, E in reach); its bodies are the glyph shelf's `chest` and
 * `chest-open` (game/glyph-forms.js), the open one asleep until the chest is empty, when a cue on its count swaps them
 * (`vanish` and `spawn`, playscape/ui/cast.js); the sound the shelf's `chest-open`.
 *
 *   battles.chests: n (0 to 4) | false    how many chests each fighting stage keeps (a book's battles; none unsaid)
 *   CHEST_LOOT         by how far on (tierOf, the shops' tiers), what a chest may hold: rows of [{ item, count }]
 *   chestLoot(G, tier, n, seed)   → the n chests' holds, picked from the tier's rows on a seed, no two alike in a stage
 *   chestCast(G, spots, { tier, from, n }) → { entities, play: { menus, cues } } (a stage's extra, battles.js battleCast)
 *
 * The place each stands: a beat the stage's packs leave free, a step aside from the way (CHEST.aside), turned to face it.
 * Pure and deterministic.
 */
import { mulberry32 } from '../equipment/shapes.js';
import { heldVar } from '../playscape/ui/items.js';

export const CHEST_SLICE = 'chests';
export const CHEST = Object.freeze({ reach: 1.8, aside: 2.2, most: 4, sound: 'chest-open' });
// (the bag's gold is an item like the rest: the battles' rules.gold is held:bag:gold)
export const CHEST_LOOT = Object.freeze([
  Object.freeze([[{ item: 'potion', count: 2 }], [{ item: 'antidote', count: 1 }, { item: 'potion', count: 1 }], [{ item: 'gold', count: 60 }], [{ item: 'leather-armor', count: 1 }]]),
  Object.freeze([[{ item: 'ether', count: 1 }], [{ item: 'firebomb', count: 2 }], [{ item: 'gold', count: 120 }], [{ item: 'swift-ring', count: 1 }]]),
  Object.freeze([[{ item: 'hi-potion', count: 2 }], [{ item: 'remedy', count: 1 }, { item: 'feather', count: 1 }], [{ item: 'gold', count: 200 }], [{ item: 'mana-charm', count: 1 }]]),
]);

const r3 = (v) => Math.round(v * 1000) / 1000;

/** How many chests a fighting stage keeps: the book's `battles.chests`, none unsaid. */
export const chestsPer = (G) => (G.battles && Number.isInteger(G.battles.chests) ? G.battles.chests : 0);

/** The book's `battles.chests` read: a count, 0 to CHEST.most, or false. */
export function readChests(v, err) {
  if (v === undefined || v === false) return;
  if (!(Number.isInteger(v) && v >= 0 && v <= CHEST.most)) throw err(`.chests is how many treasure chests each fighting stage keeps off its path, 0 to ${CHEST.most} (or false)`);
}

/** The n chests' holds at a tier, picked on a seed, no row twice in a stage while the tier has rows to spare. */
export function chestLoot(tier, n, seed) {
  const rows = CHEST_LOOT[Math.max(0, Math.min(CHEST_LOOT.length - 1, tier))], rand = mulberry32(((seed >>> 0) ^ 0x6a09e667) >>> 0), left = rows.map((_, i) => i), out = [];
  for (let k = 0; k < n; k++) {
    if (!left.length) left.push(...rows.map((_, i) => i));
    const i = left.splice(Math.floor(rand() * left.length), 1)[0];
    out.push(rows[i].map((h) => ({ ...h })));
  }
  return out;
}

/**
 * A stage's chests: each at a spot (`{ at, toward }`: a free beat and the way it stands beside), its id numbered across
 * the game (`from`), its holds the tier's. → { entities, play: { menus, cues } }
 */
export function chestCast(spots, { tier = 0, from = 0, seed = 1, named = () => null } = {}) {
  const holds = chestLoot(tier, spots.length, seed + from * 7919), entities = [], menus = [], cues = [], items = {};
  spots.forEach((s, k) => {
    const id = `chest-${from + k + 1}`, open = `${id}-open`, H = holds[k];
    // (a step aside from the way, facing it: the way runs from the beat toward `toward`)
    const dx = s.toward[0] - s.at[0], dy = s.toward[1] - s.at[1], L = Math.hypot(dx, dy) || 1, side = k % 2 ? 1 : -1;
    const at = [r3(s.at[0] - (dy / L) * CHEST.aside * side), r3(s.at[1] + (dx / L) * CHEST.aside * side), s.at[2]];
    const heading = r3(Math.atan2(s.at[1] - at[1], s.at[0] - at[0]));
    entities.push({ id, transform: { pos: at, heading }, rule: { type: 'clock', rate: 0 }, body: { type: 'glyph', form: 'chest' } });
    entities.push({ id: open, transform: { pos: at.slice(), heading }, rule: { type: 'clock', rate: 0 }, body: { type: 'glyph', form: 'chest-open' }, dormant: true });
    menus.push({ id, kind: 'chest', title: 'Treasure chest', holds: H, loot: 'all' });
    // (each thing found by the name the world gives it, where it gives one: the find is said in it)
    for (const h of H) { const n = named(h.item); if (n) items[h.item] = { name: n }; }
    // (opened where it stands; empty, its body swapped for the open one, as the level starts too where the store left it so)
    cues.push({ id: `${id}-opened`, when: { use: { at: [at[0], at[1]], r: CHEST.reach }, prompt: 'open' }, then: [{ open: id }, { sound: CHEST.sound }] });
    cues.push({ id: `${id}-empty`, when: { var: heldVar(id, H[0].item), eq: 0 }, then: [{ vanish: id }, { spawn: open }] });
  });
  return { entities, play: { menus, cues, ...(Object.keys(items).length ? { items } : {}) } };
}
