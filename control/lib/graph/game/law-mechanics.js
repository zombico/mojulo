/**
 * THE LAW'S MECHANIC — the WANTED level (gameworld/law.js: a world the law watches). No runtime of its own: the bus's
 * vars, watches and timer, the cast's spawn and vanish, and the hero's own hits.
 *
 *   wanted   (emitter)  stars, raised by MAYHEM: each of `mayhem`'s events (a street fight started, a car taken from its
 *                       driver, a crash into traffic, a passer-by run down or struck: the page presses `mayhem:carjack`,
 *                       `mayhem:crash`, `mayhem:runover`, `mayhem:assault`) and each
 *                       police body downed, up to `stars`. Each star brings `per` of `police` (the bodies minted asleep),
 *                       set down near the player (the cast's spawn `near`, out of reach), who chase and strike. Every
 *                       `calm` seconds with no mayhem and no police blow on the player, a star is taken off and its police
 *                       sent away; at none the chase is over. `busted` police blows: the player is BUSTED, fined `fine`
 *                       coin when it holds that much, taken out of what it drives, set down at `back`, and wanted no more.
 *                       POLICE CARS (`cars`, the `chaser` rule's bodies minted asleep): the k-th star brings the k-th,
 *                       set down farther off (`carRing`, at a junction), after the player along the streets; one that
 *                       holds a player who stands (`held:<player>`) counts as an officer's blow.
 *                       { police: [entity id], cars?: [entity id], per? (2), stars? (5), calm? (12), busted? (6),
 *                         fine? (0), back?, mayhem?: [event], ring? ([14, 30]), carRing? ([45, 90]) }
 *
 * Its vars: `wanted` (the stars, what the HUD draws), `wanted-calm`, `wanted-hits`. Its events: `wanted:<n>` (the n-th
 * star raised), `wanted-lost` (shaken off), `busted`.
 *
 *   lowerWanted   (game/mechanics.js registers it)
 * Pure, no dice.
 */
import { lowerMove, NOWHERE } from '../playscape/ui/items.js';

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const posInt = (v) => Number.isInteger(v) && v >= 1;
const EVENT = /^[a-z][a-z0-9:-]{0,63}$/;
export const WANTED = Object.freeze({ per: 2, stars: 5, calm: 12, busted: 6, ring: Object.freeze([14, 30]), carRing: Object.freeze([45, 90]), mayhem: Object.freeze(['mayhem:carjack', 'mayhem:crash', 'mayhem:runover', 'mayhem:assault']) });

export function lowerWanted(p, ctx) {
  const at0 = `wanted[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  const police = p.police;
  if (!Array.isArray(police) || !police.length || police.some((x) => typeof x !== 'string' || !x)) fail('police is the bodies that come, by their entity ids, at least one');
  const per = p.per ?? WANTED.per, stars = p.stars ?? WANTED.stars, calm = p.calm ?? WANTED.calm, busted = p.busted ?? WANTED.busted, fine = p.fine ?? 0;
  if (!posInt(per)) fail('per is the police a star brings, a whole number from 1');
  if (!posInt(stars) || stars > 5) fail('stars is the most stars, 1 to 5');
  if (!(Number.isFinite(calm) && calm > 0)) fail('calm is the seconds clear of trouble that take a star off');
  if (!posInt(busted)) fail('busted is the police blows that take the player down');
  if (!(Number.isInteger(fine) && fine >= 0)) fail('fine is the coin a bust costs');
  if (p.back !== undefined && !isVec(p.back)) fail('back is [x, y, z]: where a busted player is set down');
  const cars = p.cars ?? [];
  if (!Array.isArray(cars) || cars.some((x) => typeof x !== 'string' || !x)) fail('cars is the police cars, by their entity ids');
  const mayhem = [...WANTED.mayhem, ...(p.mayhem ?? [])];
  if (mayhem.some((m) => typeof m !== 'string' || !EVENT.test(m))) fail('mayhem is the events that raise a star (encounter:torch)');
  const ringOf = (v, d) => (Array.isArray(v) && v.length === 2 && v.every(Number.isFinite) && v[0] < v[1] ? v.slice() : d.slice()), carRing = ringOf(p.carRing, WANTED.carRing);
  const ring = Array.isArray(p.ring) && p.ring.length === 2 && p.ring.every(Number.isFinite) && p.ring[0] < p.ring[1] ? p.ring.slice() : WANTED.ring.slice();
  const W = 'wanted', C = 'wanted-calm', H = 'wanted-hits', was = 'wanted-was';
  const frag = { vars: { [W]: 0, [C]: 0, [H]: 0, [was]: 0 }, reactions: [], hud: [], timers: [], watches: [] };
  // MAYHEM: a star up (to the most), and the calm starts over
  for (const m of [...new Set(mayhem)]) frag.reactions.push({ on: m, do: 'emit', type: 'raising:wanted' });
  for (const id of police) frag.reactions.push({ on: 'down', match: { entity: id }, do: 'emit', type: 'raising:wanted' });
  frag.reactions.push({ on: 'raising:wanted', do: 'inc', var: W, by: 1, max: stars }, { on: 'raising:wanted', do: 'set', var: C, to: 0 });
  // EACH STAR: its police come as it is raised, and go as it is taken off
  for (let k = 1; k <= stars; k++) {
    const mine = police.slice((k - 1) * per, k * per);
    frag.watches.push({ type: `wanted:${k}`, when: { var: W, gte: k } }, { type: `unwanted:${k}`, when: { var: W, lt: k } });
    for (const id of mine) frag.reactions.push({ on: `wanted:${k}`, do: 'ctrl', op: 'spawn', who: id, fresh: true, near: ctx.player, ring }, { on: `unwanted:${k}`, do: 'ctrl', op: 'vanish', who: id });
    if (cars[k - 1]) frag.reactions.push({ on: `wanted:${k}`, do: 'ctrl', op: 'spawn', who: cars[k - 1], near: ctx.player, ring: carRing }, { on: `unwanted:${k}`, do: 'ctrl', op: 'vanish', who: cars[k - 1] });
  }
  frag.reactions.push({ on: 'wanted:1', do: 'set', var: was, to: 1 });
  // THE CALM: a second at a time while wanted; a police blow starts it over; `calm` of them take a star off
  frag.timers.push({ every: 1, emit: { type: 'calming:wanted' }, while: { var: W, gte: 1 } });
  frag.reactions.push({ on: 'calming:wanted', do: 'inc', var: C, by: 1 });
  frag.watches.push({ type: 'cooling:wanted', when: { var: C, gte: calm } });
  frag.reactions.push({ on: 'cooling:wanted', do: 'inc', var: W, by: -1, min: 0 }, { on: 'cooling:wanted', do: 'set', var: C, to: 0 });
  // (shaken off: none left, from a chase and not a bust)
  frag.reactions.push({ on: 'unwanted:1', if: { var: was, gte: 1 }, do: 'emit', type: 'wanted-lost' }, { on: 'unwanted:1', do: 'set', var: was, to: 0 }, { on: 'unwanted:1', do: 'set', var: H, to: 0 });
  // BUSTED: the police blows counted while wanted
  // (a police car's hold on a player who stands, `held:<player>`: the runtime's chaser, a blow that is no wound)
  for (const id of cars) frag.reactions.push({ on: `held:${ctx.player}`, match: { by: id }, if: { var: W, gte: 1 }, do: 'inc', var: H, by: 1 }, { on: `held:${ctx.player}`, match: { by: id }, do: 'set', var: C, to: 0 });
  for (const id of police) frag.reactions.push({ on: `hit:${ctx.player}`, match: { by: id }, if: { var: W, gte: 1 }, do: 'inc', var: H, by: 1 }, { on: `hit:${ctx.player}`, match: { by: id }, do: 'set', var: C, to: 0 });
  frag.watches.push({ type: 'busted', when: { var: H, gte: busted } });
  // (WASTED, the street's health at none: vitals-mechanics.js. The law lets the player go, as a bust would, unfined)
  // (and a respray, shop-mechanics.js: `cleared:wanted`, the law loses the player)
  frag.reactions.push({ on: 'cleared:wanted', do: 'set', var: was, to: 0 }, { on: 'cleared:wanted', do: 'set', var: W, to: 0 }, { on: 'cleared:wanted', do: 'set', var: H, to: 0 }, { on: 'cleared:wanted', do: 'set', var: C, to: 0 });
  frag.reactions.push({ on: 'wasted', do: 'set', var: was, to: 0 }, { on: 'wasted', do: 'set', var: W, to: 0 }, { on: 'wasted', do: 'set', var: H, to: 0 }, { on: 'wasted', do: 'set', var: C, to: 0 });
  frag.reactions.push({ on: 'busted', do: 'set', var: was, to: 0 }, { on: 'busted', do: 'set', var: W, to: 0 }, { on: 'busted', do: 'set', var: H, to: 0 }, { on: 'busted', do: 'set', var: C, to: 0 });
  // (out of the car first, if it drives one, set down where it is put)
  frag.reactions.push({ on: 'busted', do: 'ctrl', op: 'dismount', who: ctx.player, ...(p.back ? { to: p.back.slice() } : {}) });
  if (p.back) frag.reactions.push({ on: 'busted', do: 'move', target: ctx.player, to: p.back.slice() });
  // (the fine taken only when the player holds it, and said only then)
  if (fine > 0) { ctx.resolve('inventory', p.slice ?? 'bag', at0); const { ok } = lowerMove({ item: 'coin', n: fine, from: 'bag', to: NOWHERE, on: 'busted' }, frag); frag.reactions.push({ on: ok, do: 'emit', type: 'fined:wanted' }); frag.hud.push({ on: 'fined:wanted', as: 'toast', text: `Fined ${fine}`, ttl: 3 }); }
  frag.hud.push(
    { var: W, label: 'wanted', as: 'stars', max: stars, slot: 'top-right' },
    { on: 'wanted:1', as: 'toast', text: 'The police are after you. Lose them.', ttl: 3.2 },
    { on: 'wanted-lost', as: 'toast', text: 'You lost them.', ttl: 3 },
    { on: 'busted', as: 'banner', text: 'BUSTED', ttl: 3 },
  );
  return { world: frag, emits: ['wanted:1', 'wanted-lost', 'busted'], ...(fine > 0 ? { produces: [{ type: 'consume', slice: 'bag' }] } : {}) };
}
