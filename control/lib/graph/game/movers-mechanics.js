/**
 * THE MOVE (an emitter): a mover's house emptied into the truck (gameworld/movers.js; the lifting is the runtime's,
 * worlds/controllable/heave.js), lowered onto the bus:
 *
 *   loaded    each piece carried out to the door (`heave:load`): counted, said
 *   full      the truck full at `load` pieces: the pay into the bag, a banner, once; what is carried out after it is
 *             counted still, and paid nothing more
 *
 *   { kind: 'movers', id?, load, reward?: [{ item, n }], name?, done? }
 *
 * Its vars: `loaded-<id>` (the count, on the HUD), `flag-full-<id>`; `movers:full:<id>` when full.
 */
import { lowerMove, NOWHERE } from '../playscape/ui/items.js';

const BAG = 'bag';
const WORD = /^[a-z][a-z0-9-]{0,47}$/;

export function lowerMovers(p, ctx) {
  const at0 = `movers[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  const id = p.id ?? 'movers';
  if (typeof id !== 'string' || !WORD.test(id)) fail('id is the move\'s name, lower-case');
  if (!Number.isInteger(p.load) || p.load < 1 || p.load > 200) fail('load is the pieces that fill the truck, 1 to 200');
  const reward = p.reward ?? [];
  if (!Array.isArray(reward) || reward.some((r) => !r || typeof r.item !== 'string' || (r.n !== undefined && !(Number.isInteger(r.n) && r.n >= 1)))) fail('reward is [{ item, n? }]: what a full truck pays');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const ev = (w) => `movers:${w}:${id}`, n = `loaded-${id}`, full = `flag-full-${id}`;
  const frag = { vars: { [n]: 0, [full]: 0 }, reactions: [], hud: [] }, R = frag.reactions;
  // LOADED: each piece on the truck counted; the count reaching the load fills it, once
  R.push({ on: 'heave:load', do: 'inc', var: n, by: 1 }, { on: 'heave:load', if: { var: n, gte: p.load }, do: 'emit', type: ev('reached') });
  R.push({ on: ev('reached'), if: { var: full, eq: 0 }, do: 'emit', type: ev('full') });
  for (const r of reward) lowerMove({ item: r.item, n: r.n ?? 1, from: NOWHERE, to: BAG, on: ev('full') }, frag);
  R.push({ on: ev('full'), do: 'set', var: full, to: 1 }, { on: ev('full'), do: 'emit', type: `flag:full-${id}` });
  const pay = reward.map((r) => `${r.n ?? 1} ${String(r.item).replace(/-/g, ' ')}`).join(', ');
  frag.hud.push(
    { var: n, label: `${p.name ?? 'Truck'} · of ${p.load}`, as: 'counter' },
    { on: 'heave:load', as: 'toast', text: 'On the truck', ttl: 1.2 },
    { on: ev('full'), as: 'banner', text: p.done ?? 'Truck full', sub: pay ? `Paid ${pay}` : 'Done' },
  );
  return { world: frag, emits: [ev('full')], produces: reward.length ? [{ type: 'grant', slice: BAG }] : [] };
}
