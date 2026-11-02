/**
 * THE ERRAND'S MECHANICS — sent out with a list, home with the goods (the escape room's opposite pole). Three verbs, each
 * lowered onto the bag's guarded transfer (playscape/ui/items.js lowerMove: `held:bag:<item>` on the bus, `in:` / `out:`
 * said for the store to keep, so what is carried rides from level to level), no runtime of their own:
 *
 *   trade    (emitter)  a place where an item is had: walk in holding its `needs` and they are spent for it (`count` of
 *                       it into the bag). With no needs it is a source (a shelf, a crate). It gives again only once the
 *                       bag holds none of it, so a spoiled cargo is fetched again (the shelf restocks).
 *                       { item, at, count? (1), needs?: [{ item, n? (1) }], radius? }
 *   cargo    (emitter)  what a carried item's condition is: its count in the bag. Fragile: each hit the carrier takes and
 *                       each fall (the fall policy's catch) loses one; perishable: one every `perishable` seconds while
 *                       any is held. A bar on the HUD; `cargo:lost:<item>` a unit, said as a toast.
 *                       { item, fragile?: true, perishable?: <seconds>, max? (the bar's top) }
 *   deliver  (terminal) the giver's hand-in: walk in holding each asked item, at least its `min`, and the `min` of each is
 *                       handed over, ending the level (`errand:done:<id>` → success); short of any, a toast says so
 *                       (`errand:short:<id>`) and nothing is taken.
 *                       { id?, at, wants: [{ item, min? (1) }], radius?, planar? }
 *
 * Names (recipe-derived, for a handoff): a trade's zone and marker `trade-<item>`, a deliver's zone `deliver-<id>`.
 * A deliver's audit is the walk to it (what the walk must hold first is the errand's order: gameworld/errand.js).
 *
 *   lowerTrade, lowerCargo, lowerDeliver   (game/mechanics.js registers them)
 *
 * Pure, no dice.
 */
import { lowerMove, heldVar, itemKey, NOWHERE } from '../playscape/ui/items.js';

const BAG = 'bag';
const WORD = /^[a-z][a-z0-9-]{0,31}$/;
const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const posInt = (v) => Number.isInteger(v) && v >= 1;

// one guard after another (the bus's `if` takes one predicate): `on` → … → `ok` when every guard holds; each failing guard
// emits `no`
function chain(reactions, on, guards, ok, no) {
  guards.forEach((g, k) => {
    const src = k ? `${ok}:${k}` : on, dst = k === guards.length - 1 ? ok : `${ok}:${k + 1}`;
    reactions.push({ on: src, if: g, do: 'emit', type: dst });
    if (no) reactions.push({ on: src, if: { var: g.var, lt: g.gte }, do: 'emit', type: no });
  });
}

export function lowerTrade(p, ctx) {
  const at0 = `trade[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  if (typeof p.item !== 'string' || !WORD.test(itemKey(p.item))) fail('item is what is had here, one lower-case word (eggs, coin, a rune-key)');
  if (!isVec(p.at)) fail('at is [x, y, z]: where it is had');
  const count = p.count === undefined ? 1 : p.count;
  if (!posInt(count)) fail('count is how many are had, a whole number from 1');
  const needs = p.needs === undefined ? [] : p.needs;
  if (!Array.isArray(needs) || needs.some((n) => !n || typeof n.item !== 'string' || (n.n !== undefined && !posInt(n.n)))) fail('needs is [{ item, n? }]: what is spent for it');
  if (needs.some((n) => itemKey(n.item) === itemKey(p.item))) fail('an item cannot be its own price');
  const key = itemKey(p.item), zone = `trade-${key}`, frag = { vars: { [heldVar(BAG, key)]: 0 }, reactions: [], hud: [] };
  const want = `trade:${key}`;
  frag.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: `${want}:try` });
  // only while the bag holds none of it (a shelf restocks for a carton spoiled on the way)
  frag.reactions.push({ on: `${want}:try`, if: { var: heldVar(BAG, key), eq: 0 }, do: 'emit', type: want });
  let paid = want;
  if (needs.length) {
    const guards = needs.map((n) => ({ var: heldVar(BAG, n.item), gte: n.n ?? 1 }));
    for (const n of needs) frag.vars[heldVar(BAG, n.item)] ??= 0;
    paid = `${want}:paid`;
    chain(frag.reactions, want, guards, paid, `${want}:short`);
    frag.hud.push({ on: `${want}:short`, as: 'toast', text: `${key.replace(/-/g, ' ')} costs ${needs.map((n) => `${n.n ?? 1} ${itemKey(n.item).replace(/-/g, ' ')}`).join(', ')}`, ttl: 1.6 });
    // the price spent (each guard held, so each move goes through), then the item given
    for (const n of needs) lowerMove({ item: n.item, n: n.n ?? 1, from: BAG, to: NOWHERE, on: paid }, frag);
  }
  lowerMove({ item: key, n: count, from: NOWHERE, to: BAG, on: paid }, frag);
  frag.reactions.push({ on: paid, do: 'emit', type: `pickup:${key}` });
  return {
    world: {
      ...frag,
      sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 1.6, planar: p.planar !== false, watch: ctx.player }],
      entities: [{ id: zone, type: 'trade', on: true, position: p.at.slice(), radius: 0.4, color: '#e0a03a' }],
    },
    produces: [{ type: 'grant', slice: BAG }, ...(needs.length ? [{ type: 'consume', slice: BAG }] : [])],
    emits: [`pickup:${key}`],
  };
}

export function lowerCargo(p, ctx) {
  const at0 = `cargo[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  if (typeof p.item !== 'string' || !WORD.test(itemKey(p.item))) fail('item is the carried thing, one lower-case word');
  if (p.fragile === undefined && p.perishable === undefined) fail('a cargo is fragile: true, or perishable: <seconds a unit lasts>, or both');
  if (p.fragile !== undefined && p.fragile !== true) fail('fragile is true');
  if (p.perishable !== undefined && !(Number.isFinite(p.perishable) && p.perishable > 0)) fail('perishable is the seconds a unit lasts while carried, above 0');
  const key = itemKey(p.item), held = heldVar(BAG, key), jolt = `cargo:jolt:${key}`, frag = { vars: { [held]: 0 }, reactions: [], hud: [], timers: [] };
  if (p.fragile) {
    frag.reactions.push({ on: `hit:${ctx.player}`, do: 'emit', type: jolt });
    // the fall policy's catch (game/mechanics.js composeMechanics): a fall is a jolt too
    frag.reactions.push({ on: 'enter', match: { zone: '__catch__' }, do: 'emit', type: jolt });
  }
  // a perishable unit goes off each period while any is carried
  if (p.perishable) frag.timers.push({ every: p.perishable, emit: { type: jolt }, while: { var: held, gte: 1 } });
  const { ok } = lowerMove({ item: key, n: 1, from: BAG, to: NOWHERE, on: jolt }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: `cargo:lost:${key}` });
  frag.hud.push(
    { var: held, label: key.replace(/-/g, ' '), as: 'bar', max: posInt(p.max) ? p.max : 12 },
    { on: `cargo:lost:${key}`, as: 'toast', text: p.perishable && !p.fragile ? `the ${key.replace(/-/g, ' ')} spoils a little` : `some ${key.replace(/-/g, ' ')} broke`, ttl: 1.2 },
  );
  return { world: frag, produces: [{ type: 'consume', slice: BAG }], emits: [`cargo:lost:${key}`] };
}

export function lowerDeliver(p, ctx) {
  const at0 = `deliver[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const id = p.id === undefined ? 'errand' : p.id;
  if (typeof id !== 'string' || !WORD.test(id)) fail('id is the errand\'s name, lower-case');
  if (!isVec(p.at)) fail('at is [x, y, z]: where the giver takes it');
  const wants = Array.isArray(p.wants) ? p.wants : [];
  if (!wants.length || wants.some((w) => !w || typeof w.item !== 'string' || (w.min !== undefined && !posInt(w.min)))) fail('wants is [{ item, min? }], at least one: what the giver asked for');
  const zone = `deliver-${id}`, frag = { vars: {}, reactions: [], hud: [] }, done = `errand:done:${id}`, short = `errand:short:${id}`, ok = `${done}:ok`;
  for (const w of wants) frag.vars[heldVar(BAG, w.item)] ??= 0;
  frag.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: `${zone}:try` });
  chain(frag.reactions, `${zone}:try`, wants.map((w) => ({ var: heldVar(BAG, w.item), gte: w.min ?? 1 })), ok, short);
  for (const w of wants) lowerMove({ item: w.item, n: w.min ?? 1, from: BAG, to: NOWHERE, on: ok }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: done });
  frag.hud.push({ on: short, as: 'toast', text: `bring ${wants.map((w) => `${w.min ?? 1} ${itemKey(w.item).replace(/-/g, ' ')}`).join(', ')}`, ttl: 1.8 });
  const shape = Array.isArray(p.half) ? { half: p.half } : { radius: Number.isFinite(p.radius) ? p.radius : 2 };
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), ...shape, planar: p.planar !== false, watch: ctx.player }] },
    on: { [done]: { end: 'success' } },
    produces: [{ type: 'consume', slice: BAG }],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}
