/**
 * THE REQUEST (an emitter): a constituent's infra request done by the player in a city worker's ID (gameworld/municipal.js),
 * a combination of what the city already does, lowered onto the bus:
 *
 *   taken     on its app (a `task`, its flag the request's `after`): the constituent's letter said
 *   approved  a WORK ORDER in the bag (`order`: had at City Hall's clerk desk, a Deskwork shift won; carried in the bag
 *             from that page to this one)
 *   delivered its MATERIAL had at the works yard (`yard`'s zone), taken, a work order in hand and none had yet: into the
 *             bag; without a work order the yard says where one is had
 *   fixed     each of its `spots` fixed, as the page says (`request:fix:<id>:<k>`, scene/channels/fix-sites.js: at the spot,
 *             F held, then tapped), its material in hand; every spot fixed, it is DONE: the material and the work order
 *             used, the reward into the bag, a card with the constituent's thanks
 *
 *   { kind: 'request', id, job, name?, from?, says?, thanks?, where?, done?, spots: [{ at, N? }], yard: { at, half | radius },
 *     material: { item, name }, order?: { item, name }, reward?: [{ item, n }], after? }
 *
 * Its flags: `picked-<id>` (the material had), `fixed-<id>-<k>` (a spot), `done-<id>`; `request:done:<id>` when done.
 */
import { lowerMove, heldVar, NOWHERE } from '../playscape/ui/items.js';

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const BAG = 'bag';
const WORD = /^[a-z][a-z0-9-]{0,47}$/;
const itemOk = (x) => !!x && typeof x.item === 'string' && WORD.test(x.item) && typeof x.name === 'string' && !!x.name;

export function lowerRequest(p, ctx) {
  const at0 = `request[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (typeof p.id !== 'string' || !WORD.test(p.id)) fail('id is the request\'s name, lower-case');
  if (!Array.isArray(p.spots) || !p.spots.length || p.spots.some((q) => !q || !isVec(q.at))) fail('spots is [{ at: [x, y, z] }], at least one: where it is fixed');
  if (!p.yard || !isVec(p.yard.at)) fail('yard is { at: [x, y, z], half? | radius? }: where its material is had');
  if (!itemOk(p.material)) fail('material is { item, name }: what is had at the yard and used to fix it');
  if (p.order !== undefined && !itemOk(p.order)) fail('order is { item, name }: the work order it asks for (City Hall\'s)');
  const reward = p.reward ?? [];
  if (!Array.isArray(reward) || reward.some((r) => !r || typeof r.item !== 'string' || (r.n !== undefined && !(Number.isInteger(r.n) && r.n >= 1)))) fail('reward is [{ item, n? }]: what it pays');
  if (p.after !== undefined && (typeof p.after !== 'string' || !WORD.test(p.after))) fail('after is the flag taking it sets (took-pothole-elm)');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const id = p.id, ev = (w) => `request:${w}:${id}`, took = p.after ? `flag-${p.after}` : null, order = p.order ?? { item: 'work-order', name: 'work order' };
  const picked = `flag-picked-${id}`, done = `flag-done-${id}`, n = `fixed-${id}`, mat = heldVar(BAG, p.material.item), ord = heldVar(BAG, order.item), N = p.spots.length;
  const frag = { vars: { [`flag-order-${id}`]: 0, [picked]: 0, [done]: 0, [n]: 0, [mat]: 0, [ord]: 0, ...Object.fromEntries(p.spots.map((_, k) => [`flag-fixed-${id}-${k + 1}`, 0])), ...(took ? { [took]: 0 } : {}) }, reactions: [], hud: [] };
  const R = frag.reactions, thing = p.name ?? 'it', where = p.where ? ` at ${p.where}` : '';
  // (its letter, as it is taken)
  if (took && p.from && p.says) frag.hud.push({ on: `flag:${p.after}`, as: 'toast', text: `${p.from}: ${p.says}`, ttl: 6 });
  // THE YARD: its material had, the request taken and not done, none had yet, a work order in hand
  const yz = `req-${id}-yard`;
  R.push(took ? { on: 'enter', match: { zone: yz }, if: { var: took, gte: 1 }, do: 'emit', type: ev('yard') } : { on: 'enter', match: { zone: yz }, do: 'emit', type: ev('yard') });
  R.push({ on: ev('yard'), if: { var: done, eq: 0 }, do: 'emit', type: ev('yard:1') }, { on: ev('yard:1'), if: { var: picked, eq: 0 }, do: 'emit', type: ev('yard:2') });
  R.push({ on: ev('yard:2'), if: { var: ord, gte: 1 }, do: 'emit', type: ev('pick') }, { on: ev('yard:2'), if: { var: ord, eq: 0 }, do: 'emit', type: ev('no-order') });
  lowerMove({ item: p.material.item, n: 1, from: NOWHERE, to: BAG, on: ev('pick') }, frag);
  R.push({ on: ev('pick'), do: 'set', var: picked, to: 1 }, { on: ev('pick'), do: 'emit', type: `flag:picked-${id}` });
  // (signed out on a work order: its order step is done in the journal, `order-<id>`)
  R.push({ on: ev('pick'), do: 'set', var: `flag-order-${id}`, to: 1 }, { on: ev('pick'), do: 'emit', type: `flag:order-${id}` });
  frag.hud.push(
    { on: ev('pick'), as: 'toast', text: `Works yard: one ${p.material.name}, signed out on your work order. Now ${thing}${where}.`, ttl: 3.6 },
    { on: ev('no-order'), as: 'toast', text: `Works yard: no ${order.name}, no ${p.material.name}. The clerk at City Hall makes those.`, ttl: 3.6 },
  );
  // THE SPOTS: each fixed as the page says, its material in hand, once
  p.spots.forEach((_, k) => {
    const f = `flag-fixed-${id}-${k + 1}`, fx = ev(`fix:${k + 1}`);
    R.push({ on: `request:fix:${id}:${k + 1}`, if: { var: picked, gte: 1 }, do: 'emit', type: `${fx}:1` }, { on: `${fx}:1`, if: { var: f, eq: 0 }, do: 'emit', type: fx });
    R.push({ on: fx, do: 'set', var: f, to: 1 }, { on: fx, do: 'emit', type: `flag:fixed-${id}-${k + 1}` }, { on: fx, do: 'inc', var: n, by: 1 }, { on: fx, do: 'emit', type: ev('fixed') });
  });
  if (N > 1) frag.hud.push({ on: ev('fixed'), as: 'toast', text: `${p.name ? p.name[0].toUpperCase() + p.name.slice(1) : 'It'}: a part done`, ttl: 1.4 });
  // DONE: every spot fixed: the material and the work order used, the pay, the constituent's thanks
  R.push({ on: ev('fixed'), if: { var: n, gte: N }, do: 'emit', type: ev('all') }, { on: ev('all'), if: { var: done, eq: 0 }, do: 'emit', type: ev('paid') });
  lowerMove({ item: p.material.item, n: 1, from: BAG, to: NOWHERE, on: ev('paid') }, frag);
  lowerMove({ item: order.item, n: 1, from: BAG, to: NOWHERE, on: ev('paid') }, frag);
  for (const r of reward) lowerMove({ item: r.item, n: r.n ?? 1, from: NOWHERE, to: BAG, on: ev('paid') }, frag);
  R.push({ on: ev('paid'), do: 'set', var: done, to: 1 }, { on: ev('paid'), do: 'emit', type: `flag:done-${id}` }, { on: ev('paid'), do: 'emit', type: `request:done:${id}` });
  const pay = reward.map((r) => `${r.n ?? 1} ${String(r.item).replace(/-/g, ' ')}`).join(', ');
  frag.hud.push({ on: ev('paid'), as: 'banner', text: p.done ?? 'Request done', sub: `${pay ? `Paid ${pay}` : 'Done'}${p.from && p.thanks ? ` · ${p.from}: ${p.thanks}` : ''}` });
  const half = Array.isArray(p.yard.half) ? { half: p.yard.half.slice(0, 2) } : { radius: Number.isFinite(p.yard.radius) ? p.yard.radius : 9 };
  return {
    world: { ...frag, sources: [{ type: 'zone', zone: yz, at: p.yard.at.slice(), ...half, planar: true, watch: ctx.player }] },
    emits: [ev('pick'), `request:done:${id}`], produces: [{ type: 'consume', slice: BAG }, { type: 'grant', slice: BAG }],
    audit: { kind: 'walkto', target: p.spots[0].at.slice() },
  };
}
