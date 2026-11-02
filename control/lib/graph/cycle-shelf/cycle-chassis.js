/**
 * cycle-chassis — a machine's steering geometry and its key points, solved from its physics row and its chassis card,
 * never restated: the wheelbase is its class's (roads/vehicles.js), the wheels' radii are its wheel rows', the trail is
 * derived from the rake, the fork's offset and the front wheel. Every part builder draws from the solve, so a frame, a
 * fork and a swingarm meet where the geometry says they do.
 *
 * Machine frame (cycle-common.js): +y forward, +z up, +x right, the ground z = 0, the rear tyre's contact at the origin,
 * the front's at y = wheelbase.
 *
 *   solveChassis(card, physicsRow, { front, rear })   → G
 *     G.wb, G.rake (rad), G.offset, G.trail, G.rF, G.rR
 *     G.frontAxle, G.rearAxle, G.contacts { front, rear }
 *     G.axis { d (up the steering axis), n (square to it, forward), at(s) a point on it }, G.head { lo, hi }
 *     G.fork { half, length, sLo, sHi, leg(s, side) }, G.bars, G.pivot, G.swingarm { length }
 *     the card's own points (seat, tank, engine, pegs, stand, sprockets, …) passed through as placed
 *
 * Pure: no clock, no dice.
 */
import { DEG, add, mul, sub, unit } from './cycle-common.js';

const need = (card, key) => {
  if (card[key] === undefined) throw new Error(`cycle chassis: the card has no '${key}'`);
  return card[key];
};

export function solveChassis(card, physics, wheels) {
  if (!physics) throw new Error('cycle chassis: no physics row');
  const wb = physics.wheelbase;
  const rF = wheels.front.radius, rR = wheels.rear.radius;
  const rake = need(card, 'rake') * DEG, offset = need(card, 'offset');
  const frontAxle = [0, wb, rF], rearAxle = [0, 0, rR];
  // up the steering axis (raked back), and square to it in the machine's plane (forward)
  const d = [0, -Math.sin(rake), Math.cos(rake)], n = [0, Math.cos(rake), Math.sin(rake)];
  const base = sub(frontAxle, mul(n, offset));
  const at = (s) => add(base, mul(d, s));
  // where the axis meets the ground, ahead of the front contact by the trail
  const s0 = -base[2] / d[2], ground = at(s0);
  const trail = ground[1] - wb;
  const fork = need(card, 'fork');
  const leg = (s, side = 'r') => add(add(frontAxle, mul(d, s)), [side === 'l' ? -fork.half : fork.half, 0, 0]);
  const sw = need(card, 'swingarm');
  const pivot = [0, Math.sqrt(sw.length ** 2 - (sw.height - rR) ** 2), sw.height];
  const head = { lo: at(fork.sLo), hi: at(fork.sHi) };
  // the bars' clamp: atop the upper triple clamp, a riser up the axis, set forward of it
  const bars = add(add(at(fork.sHi + 0.02), mul(d, card.bars?.rise ?? 0.04)), mul(n, card.bars?.forward ?? 0.02));
  return {
    ...card,
    physics: physics.words,
    wb, rake, offset, trail, rF, rR,
    frontAxle, rearAxle, contacts: { front: [0, wb, 0], rear: [0, 0, 0] },
    axis: { d, n, at, ground }, head,
    fork: { ...fork, leg },
    barsAt: bars,
    pivot, swingarm: { ...sw },
    steerAxis: unit(d),
  };
}
