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
 *   lowerRespray, lowerGunshop   (game/mechanics.js registers them)
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
