/**
 * THE STREET'S HEALTH — the player's health in an open city, and WASTED (the bust's sibling: the law's mechanic is
 * law-mechanics.js). No runtime of its own: the bus's vars, a watch and a timer, the cast's dismount, the hero's hits.
 *
 *   vitals   (emitter)  `health`, from `hp`: each blow the player takes (`hit:<player>`) costs `hit`; clear of blows
 *                       `after` seconds it mends `mend` a second, to `hp`. At none the player is WASTED: out of what it
 *                       drives, a hospital bill (`bill` coin, when it holds that much) paid, set down at `back`, its
 *                       health whole again. A fight under way (an encounter, lowerAct `fight.wasted`) is lost with it,
 *                       and the law (lowerWanted) lets it go.
 *                       { hp? (100), hit? (10), mend? (2), after? (5), bill? (0), back? }
 *
 * Its vars: `health` (what the HUD draws), `health-quiet` (seconds since the last blow). Its event: `wasted`.
 *
 *   lowerVitals   (game/mechanics.js registers it)
 * Pure, no dice.
 */
import { lowerMove, NOWHERE } from '../playscape/ui/items.js';

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
export const VITALS = Object.freeze({ hp: 100, hit: 10, mend: 2, after: 5 });

export function lowerVitals(p, ctx) {
  const at0 = `vitals[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  const hp = p.hp ?? VITALS.hp, hit = p.hit ?? VITALS.hit, mend = p.mend ?? VITALS.mend, after = p.after ?? VITALS.after, bill = p.bill ?? 0;
  if (!(Number.isInteger(hp) && hp >= 1)) fail('hp is the player\'s whole health, a whole number from 1');
  if (!(Number.isFinite(hit) && hit > 0)) fail('hit is what a blow costs, above 0');
  if (!(Number.isFinite(mend) && mend >= 0)) fail('mend is the health a quiet second gives back, 0 or more');
  if (!(Number.isFinite(after) && after >= 0)) fail('after is the seconds clear of blows before it mends');
  if (!(Number.isInteger(bill) && bill >= 0)) fail('bill is the coin being wasted costs');
  if (p.back !== undefined && !isVec(p.back)) fail('back is [x, y, z]: where a wasted player wakes');
  const V = 'health', Q = 'health-quiet';
  const frag = { vars: { [V]: hp, [Q]: 0 }, reactions: [], hud: [], timers: [], watches: [] };
  // A BLOW: health off it (to none), the quiet over
  frag.reactions.push({ on: `hit:${ctx.player}`, do: 'inc', var: V, by: -hit, min: 0 }, { on: `hit:${ctx.player}`, do: 'set', var: Q, to: 0 });
  // MENDING: a second at a time while hurt; after `after` of them, `mend` a second back
  frag.timers.push({ every: 1, emit: { type: 'mending:health' }, while: { var: V, lt: hp } });
  frag.reactions.push({ on: 'mending:health', do: 'inc', var: Q, by: 1 }, { on: 'mending:health', if: { var: Q, gte: after + 1 }, do: 'inc', var: V, by: mend, max: hp });
  // WASTED: out of the car, the bill, set down, whole again
  frag.watches.push({ type: 'wasted', when: { var: V, lte: 0 } });
  frag.reactions.push({ on: 'wasted', do: 'ctrl', op: 'dismount', who: ctx.player, ...(p.back ? { to: p.back.slice() } : {}) });
  if (p.back) frag.reactions.push({ on: 'wasted', do: 'move', target: ctx.player, to: p.back.slice() });
  frag.reactions.push({ on: 'wasted', do: 'set', var: V, to: hp }, { on: 'wasted', do: 'set', var: Q, to: 0 });
  if (bill > 0) { ctx.resolve('inventory', p.slice ?? 'bag', at0); const { ok } = lowerMove({ item: 'coin', n: bill, from: 'bag', to: NOWHERE, on: 'wasted' }, frag); frag.reactions.push({ on: ok, do: 'emit', type: 'billed:health' }); frag.hud.push({ on: 'billed:health', as: 'toast', text: `Hospital bill ${bill}`, ttl: 3 }); }
  frag.hud.push({ var: V, label: 'health', as: 'bar', max: hp, slot: 'top-left' }, { on: 'wasted', as: 'banner', text: 'WASTED', ttl: 3 });
  return { world: frag, emits: ['wasted'], ...(bill > 0 ? { produces: [{ type: 'consume', slice: 'bag' }] } : {}) };
}
