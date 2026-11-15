/**
 * A LEVEL'S HUD GRAMMAR — the action-adventure's HUD (scene/channels/hud-grammar.js) asked for by a game whose genre
 * row says so (hero-rows.js `hud: 'grammar'`), filled from what the level already is: its hero's health and the hits it
 * takes, its arsenal's weapon and sidearm on the input map's controls (input-map.js), what it collects, where its way
 * ends.
 *
 *   levelGrammar(G, mechanics, { places? }) → the level's `events.grammar`, or null (a world with no row, a level with
 *                                             no health)
 *   mapPlaces(level, zone?)    → a planned map's named places on a page ([{ name, box }]: the plan's key, each
 *                                segment's square), for its place cards; [] for a level with no plan or no names
 *
 * HEARTS: a heart holds two hits (HEART_HITS), so a blow takes half a heart and the row of hearts is short enough to
 * read at a glance; never more than HEARTS_MAX. Pure.
 */
import { genreHero } from './hero-rows.js';
import { arsenalOfGame } from './arsenal.js';
import { inputMap } from './input-map.js';

export const HEART_HITS = 2, HEARTS_MAX = 10;

/** A planned map's named places on a page (see the header): `level` a map level's ({ grid: { tile, plan } }), `zone` the
 * segments its page holds (all of them when none is said). */
export function mapPlaces(level, zone = null) {
  const P = level?.grid?.plan, T = level?.grid?.tile;
  if (!P || !Number.isFinite(T) || !Array.isArray(P.rows) || !Number.isFinite(P.size)) return [];
  const on = zone == null ? null : new Set([zone].flat()), out = [], n = P.size;
  P.rows.forEach((row, r) => String(row).split(/\s+/).filter(Boolean).forEach((S, c) => {
    const name = P.key?.[S]?.name;
    if (S === '.' || typeof name !== 'string' || !name || (on && !on.has(S))) return;
    out.push({ name: name[0].toUpperCase() + name.slice(1), box: [c * n * T, -(r + 1) * n * T, (c + 1) * n * T, -r * n * T].map((v) => v + 0) });   // (+ 0: never a −0)
  }));
  return out;
}

/** The level's HUD grammar (see the header). */
export function levelGrammar(G, mechanics = [], { places = null, quick = null, theme = null } = {}) {
  if (genreHero(G)?.hud !== 'grammar') return null;
  const death = mechanics.find((m) => m && m.kind === 'fail-on-death' && Number.isFinite(m.startHp) && Number.isFinite(m.hits));
  if (!death) return null;
  const per = death.hits * HEART_HITS, max = Math.min(HEARTS_MAX, Math.max(1, Math.ceil(death.startHp / per)));
  const A = arsenalOfGame(G)?.arsenal ?? null, side = A?.ranged?.[0] ?? null;
  const M = Object.fromEntries(inputMap({ moveset: !!A, sidearm: side?.name?.toLowerCase() ?? null, interact: true }).map((r) => [r.id, r]));
  const key = (id) => (M[id] ? { ...(M[id].keys ? { keys: M[id].keys } : {}), ...(M[id].pad ? { pad: M[id].pad } : {}) } : {});
  const M2 = Object.fromEntries(inputMap({ moveset: !!A, sprint: true, lock: true }).map((r) => [r.id, r]));
  const key2 = (id) => (M2[id] ? { ...(M2[id].keys ? { keys: M2[id].keys } : {}), ...(M2[id].pad ? { pad: M2[id].pad } : {}) } : {});
  const slots = A ? [{ id: 'weapon', name: A.weapons[0]?.name ?? 'Weapon', ...key('light') }, ...(side ? [{ id: 'sidearm', name: side.name, ...key('special') }] : [])] : [];
  // (the item on the quick key, inventory.js: its count the bag's own var; a game with no bag, what the level collects,
  // each a slot counted by the level's var of its label)
  if (quick) slots.push({ id: 'item', name: quick.name, keys: quick.key, var: quick.var, ...(quick.icon ? { icon: quick.icon } : {}) });
  else for (const m of mechanics) if (m && m.kind === 'collect') for (const it of [...new Set((m.pickups ?? []).map((p) => p.item).filter((x) => typeof x === 'string'))].slice(0, 2)) slots.push({ id: `item:${it}`, name: it[0].toUpperCase() + it.slice(1), label: it });
  // (what the body does, after what it holds: the guard, the sprint, the lock, each an icon on its control; said
  // here so no line of reminder text is needed on the screen)
  if (A) slots.push({ id: 'guard', name: 'Guard', icon: 'shield', ...key2('guard') });
  slots.push({ id: 'sprint', name: 'Sprint', icon: 'dash', ...key2('boost') }, { id: 'lock', name: 'Lock on', icon: 'target', ...key2('lock') });
  slots.splice(6);
  const exit = mechanics.find((m) => m && m.kind === 'reach-exit' && Array.isArray(m.at));
  const held = exit?.holds || mechanics.some((m) => m && m.kind === 'defeat-all');
  return { hearts: { var: 'hp', per, max }, slots, ...(theme ? { theme } : {}), ...(places?.length ? { places } : {}), ...(exit ? { goal: [exit.at[0], exit.at[1]] } : {}), objective: held ? 'Defeat the foes that hold the way' : 'Follow the way on' };
}
