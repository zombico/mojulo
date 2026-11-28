/**
 * THE CITY'S SHOPS' MECHANICS (gameworld/shops.js: where an open city's money goes). No runtime of their own: a zone, the
 * bag's guarded transfer (playscape/ui/items.js lowerMove), the cast's ops.
 *
 *   respray  (emitter)  a garage on a street: a car driven into it (`watch`, the cars' ids: `car-*`) by a player with stars
 *                       and `price` coin pays, the car it drives is repainted (the cast's `repaint`) and the law loses the player
 *                       (`cleared:wanted`, the wanted level's: law-mechanics.js); with no stars, nothing to hide; short of
 *                       the price, it says so.   { at, price?, radius?, watch?, tints? }
 *   gunshop  (emitter)  a gun shop at a shop front: walked into with `price` coin, a box of `rounds` for the weapon in the
 *                       player's hand (the cast's `rearm`: into its reserve, a reload loading them).
 *                       { at, price?, rounds?, radius?, name? }
 *
 *   forger   (emitter)  a forger at a shop front: walked into with `price` coin and no papers yet, forged papers (`item`,
 *                       fake-id) into the bag, kept; with them, a word that they are had.   { at, price?, item?, name?, radius? }
 *
 *   lowerRespray, lowerGunshop, lowerForger   (game/mechanics.js registers them)
 * Pure, no dice.
 */
import { lowerMove, heldVar, NOWHERE } from '../playscape/ui/items.js';

const isVec = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
const BAG = 'bag';
// a respray's colours (linear rgb, as a car's paint is tinted: gameworld/cars.js): each car taken in comes out the next
export const RESPRAY_TINTS = Object.freeze([[0.0368, 0.0513, 0.2016], [0.4397, 0.0302, 0.0262], [0.0331, 0.1714, 0.0612], [0.8796, 0.8796, 0.855], [0.0144, 0.0144, 0.0168], [0.6038, 0.3712, 0.0331]]);

export function lowerRespray(p, ctx) {
  const at0 = `respray[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (!isVec(p.at)) fail('at is [x, y, z]: where the garage\'s door is, on the street');
  const price = p.price ?? 40;
  if (!(Number.isInteger(price) && price >= 0)) fail('price is the coin a respray costs');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const zone = 'respray', coin = heldVar(BAG, 'coin'), watch = typeof p.watch === 'string' && p.watch ? p.watch : 'car-*';
  const frag = { vars: { [coin]: 0, wanted: 0 }, reactions: [], hud: [] };
  // (driven in: wanted, else nothing to hide)
  frag.reactions.push({ on: 'enter', match: { zone }, if: { var: 'wanted', gte: 1 }, do: 'emit', type: 'respray:try' }, { on: 'enter', match: { zone }, if: { var: 'wanted', eq: 0 }, do: 'emit', type: 'respray:clean' });
  const { ok, no } = lowerMove({ item: 'coin', n: price, from: BAG, to: NOWHERE, on: 'respray:try' }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: 'respray:done' }, { on: no, do: 'emit', type: 'respray:short' });
  frag.reactions.push({ on: 'respray:done', do: 'ctrl', op: 'repaint', who: ctx.player, tints: (p.tints ?? RESPRAY_TINTS).map((t) => t.slice()) }, { on: 'respray:done', do: 'emit', type: 'cleared:wanted' });
  frag.hud.push(
    { on: 'respray:done', as: 'toast', text: `Resprayed (${price}). The police lost you.`, ttl: 3.2 },
    { on: 'respray:short', as: 'toast', text: `A respray costs ${price}.`, ttl: 2.4 },
    { on: 'respray:clean', as: 'toast', text: 'Nothing to hide. Come back when they are after you.', ttl: 2.4 },
  );
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 4, planar: true, watch }] },
    emits: ['respray:done', 'cleared:wanted'], produces: [{ type: 'consume', slice: BAG }],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

export function lowerGunshop(p, ctx) {
  const at0 = `gunshop[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (!isVec(p.at)) fail('at is [x, y, z]: where its counter is, before its door');
  const price = p.price ?? 30, rounds = p.rounds ?? 24;
  if (!(Number.isInteger(price) && price >= 0)) fail('price is the coin a box costs');
  if (!(Number.isInteger(rounds) && rounds >= 1)) fail('rounds is the rounds a box holds');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const zone = 'gunshop', coin = heldVar(BAG, 'coin'), frag = { vars: { [coin]: 0 }, reactions: [], hud: [] };
  frag.reactions.push({ on: 'enter', match: { zone }, do: 'emit', type: 'gunshop:try' });
  const { ok, no } = lowerMove({ item: 'coin', n: price, from: BAG, to: NOWHERE, on: 'gunshop:try' }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: 'gunshop:bought' }, { on: no, do: 'emit', type: 'gunshop:short' });
  frag.reactions.push({ on: 'gunshop:bought', do: 'ctrl', op: 'rearm', who: ctx.player, by: rounds });
  const name = typeof p.name === 'string' && p.name ? p.name : 'Gun shop';
  frag.hud.push(
    { on: 'gunshop:bought', as: 'toast', text: `${name}: ${rounds} rounds (${price}). Hold Q to shoot.`, ttl: 3.6 },
    { on: 'gunshop:short', as: 'toast', text: `${name}: a box of ${rounds} rounds is ${price}.`, ttl: 2.4 },
  );
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2.2, planar: true, watch: ctx.player }] },
    emits: ['gunshop:bought'], produces: [{ type: 'consume', slice: BAG }],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

export function lowerForger(p, ctx) {
  const at0 = `forger[${ctx.i}]`, fail = (m) => { throw new Error(`${at0}: ${m}`); };
  if (!isVec(p.at)) fail('at is [x, y, z]: where the forger\'s door is');
  if (p.papers !== undefined) return lowerForgerPapers(p, ctx, at0, fail);
  const price = p.price ?? 150, item = typeof p.item === 'string' && p.item ? p.item : 'fake-id', name = typeof p.name === 'string' && p.name ? p.name : 'papers';
  if (!(Number.isInteger(price) && price >= 0)) fail('price is the coin the papers cost');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const zone = 'forger', coin = heldVar(BAG, 'coin'), held = heldVar(BAG, item), frag = { vars: { [coin]: 0, [held]: 0 }, reactions: [], hud: [] };
  // (once had, kept: the forger has nothing more to sell)
  frag.reactions.push({ on: 'enter', match: { zone }, if: { var: held, eq: 0 }, do: 'emit', type: 'forger:try' }, { on: 'enter', match: { zone }, if: { var: held, gte: 1 }, do: 'emit', type: 'forger:had' });
  const { ok, no } = lowerMove({ item: 'coin', n: price, from: BAG, to: NOWHERE, on: 'forger:try' }, frag);
  frag.reactions.push({ on: ok, do: 'emit', type: 'forger:bought' }, { on: no, do: 'emit', type: 'forger:short' });
  lowerMove({ item, n: 1, from: NOWHERE, to: BAG, on: 'forger:bought' }, frag);
  frag.hud.push(
    { on: 'forger:bought', as: 'banner', text: 'Papers', sub: `A ${name} (${price}). Nobody will look twice.` },
    { on: 'forger:short', as: 'toast', text: `Forger: a ${name} is ${price}. Come back with the money.`, ttl: 2.6 },
    { on: 'forger:had', as: 'toast', text: `Forger: you have your ${name}. Now go and earn with it.`, ttl: 2.4 },
  );
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2.2, planar: true, watch: ctx.player }] },
    emits: ['forger:bought'], produces: [{ type: 'consume', slice: BAG }, { type: 'grant', slice: BAG }],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}

/** A forger with several papers (`papers: [{ item, name, price, says? }]`, `asks: { <task id>: <paper index> }`): each a
 *  job asks for, sold to the one who walks in with its price. Which: the paper the job last refused asked for (a task's
 *  `task:needs:<id>`); none asked yet, the forger asks what the papers are for. Once had, a paper is kept. */
function lowerForgerPapers(p, ctx, at0, fail) {
  if (!Array.isArray(p.papers) || !p.papers.length || p.papers.some((q) => !q || typeof q.item !== 'string' || !q.item || typeof q.name !== 'string' || !(Number.isInteger(q.price) && q.price >= 0))) fail('papers is [{ item, name, price, says? }]: the papers the forger deals in');
  const asks = p.asks ?? {};
  if (typeof asks !== 'object' || Object.values(asks).some((k) => !Number.isInteger(k) || k < 0 || k >= p.papers.length)) fail('asks is { <task id>: <paper index> }: which paper each job asks for');
  ctx.resolve('inventory', p.slice ?? BAG, at0);
  const zone = 'forger', want = 'forger-want', coin = heldVar(BAG, 'coin');
  const frag = { vars: { [coin]: 0, [want]: 0, ...Object.fromEntries(p.papers.map((q) => [heldVar(BAG, q.item), 0])) }, reactions: [], hud: [] };
  const R = frag.reactions;
  for (const [task, k] of Object.entries(asks)) R.push({ on: `task:needs:${task}`, do: 'set', var: want, to: k + 1 });
  R.push({ on: 'enter', match: { zone }, if: { var: want, eq: 0 }, do: 'emit', type: 'forger:what' });
  frag.hud.push({ on: 'forger:what', as: 'toast', text: 'Forger: papers for what? Find a job that asks for them, then come back.', ttl: 2.8 });
  const emits = [];
  p.papers.forEach((q, k) => {
    const held = heldVar(BAG, q.item), ev = (w) => `forger:${w}:${k + 1}`;
    R.push({ on: 'enter', match: { zone }, if: { var: want, eq: k + 1 }, do: 'emit', type: ev('try') });
    R.push({ on: ev('try'), if: { var: held, eq: 0 }, do: 'emit', type: ev('buy') }, { on: ev('try'), if: { var: held, gte: 1 }, do: 'emit', type: ev('had') });
    const { ok, no } = lowerMove({ item: 'coin', n: q.price, from: BAG, to: NOWHERE, on: ev('buy') }, frag);
    R.push({ on: ok, do: 'emit', type: ev('bought') }, { on: no, do: 'emit', type: ev('short') });
    lowerMove({ item: q.item, n: 1, from: NOWHERE, to: BAG, on: ev('bought') }, frag);
    frag.hud.push(
      { on: ev('bought'), as: 'banner', text: 'Papers', sub: `A ${q.name} (${q.price}). ${q.says ?? 'Nobody will look twice.'}` },
      { on: ev('short'), as: 'toast', text: `Forger: a ${q.name} is ${q.price}. Come back with the money.`, ttl: 2.6 },
      { on: ev('had'), as: 'toast', text: `Forger: you have your ${q.name}. Now go and earn with it.`, ttl: 2.4 },
    );
    emits.push(ev('bought'));
  });
  return {
    world: { ...frag, sources: [{ type: 'zone', zone, at: p.at.slice(), radius: Number.isFinite(p.radius) ? p.radius : 2.2, planar: true, watch: ctx.player }] },
    emits, produces: [{ type: 'consume', slice: BAG }, { type: 'grant', slice: BAG }],
    audit: { kind: 'walkto', target: p.at.slice() },
  };
}
