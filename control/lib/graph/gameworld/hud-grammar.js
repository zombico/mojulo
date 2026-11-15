/**
 * A LEVEL'S HUD GRAMMAR — the action-adventure's HUD (scene/channels/hud-grammar.js) asked for by a game whose genre
 * row says so (hero-rows.js `hud: 'grammar'`), filled from what the level already is: its hero's health and the hits it
 * takes, its arsenal's weapon and sidearm on the input map's controls (input-map.js), what it collects, where its way
 * ends.
 *
 *   levelGrammar(G, mechanics) → the level's `events.grammar`, or null (a world with no row, a level with no health)
 *
 * HEARTS: a heart holds two hits (HEART_HITS), so a blow takes half a heart and the row of hearts is short enough to
 * read at a glance; never more than HEARTS_MAX. Pure.
 */
import { genreHero } from './hero-rows.js';
import { arsenalOfGame } from './arsenal.js';
import { inputMap } from './input-map.js';

export const HEART_HITS = 2, HEARTS_MAX = 10;

/** The level's HUD grammar (see the header). */
export function levelGrammar(G, mechanics = []) {
  if (genreHero(G)?.hud !== 'grammar') return null;
  const death = mechanics.find((m) => m && m.kind === 'fail-on-death' && Number.isFinite(m.startHp) && Number.isFinite(m.hits));
  if (!death) return null;
  const per = death.hits * HEART_HITS, max = Math.min(HEARTS_MAX, Math.max(1, Math.ceil(death.startHp / per)));
  const A = arsenalOfGame(G)?.arsenal ?? null, side = A?.ranged?.[0] ?? null;
  const M = Object.fromEntries(inputMap({ moveset: !!A, sidearm: side?.name?.toLowerCase() ?? null, interact: true }).map((r) => [r.id, r]));
  const key = (id) => (M[id] ? { ...(M[id].keys ? { keys: M[id].keys } : {}), ...(M[id].pad ? { pad: M[id].pad } : {}) } : {});
  const slots = A ? [{ id: 'weapon', name: A.weapons[0]?.name ?? 'Weapon', ...key('light') }, ...(side ? [{ id: 'sidearm', name: side.name, ...key('special') }] : [])] : [];
  // (what it collects: each item a slot, its count the level's own var, found by its label on the page)
  for (const m of mechanics) if (m && m.kind === 'collect') for (const it of [...new Set((m.pickups ?? []).map((p) => p.item).filter((x) => typeof x === 'string'))].slice(0, 2)) slots.push({ id: `item:${it}`, name: it[0].toUpperCase() + it.slice(1), label: it });
  const exit = mechanics.find((m) => m && m.kind === 'reach-exit' && Array.isArray(m.at));
  const held = exit?.holds || mechanics.some((m) => m && m.kind === 'defeat-all');
  return { hearts: { var: 'hp', per, max }, slots, ...(exit ? { goal: [exit.at[0], exit.at[1]] } : {}), objective: held ? 'Defeat the foes that hold the way' : 'Follow the way on' };
}
