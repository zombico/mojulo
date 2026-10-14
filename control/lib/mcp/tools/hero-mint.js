/**
 * hero-mint — the one way a run mints or remakes a hero, whichever step asks: design_game's book hero, its cast, a
 * quick game's figures (guard, foe, tower, farmhand) and the hero equipped. Each order is `{ spec, mint }`, `mint` the
 * mint_solid call (`kind: 'layered', via: 'hero', title`, the hero spec, and the character light `toon` beside it).
 *
 *   heroMintArgs(mint)        the mint_solid call as the door reads it: `toon` folded into the spec, since mint_solid
 *                             spreads only the spec (a `toon` beside it was dropped, and the anime hero lost its light)
 *   heroRemakeOps(order, prev) the update_sketch ops that remake a stored hero from its order: the hero record whole, the
 *                             walk it was stored with carried over when the order names none (a remake used to drop
 *                             it and fall back to the stock four keys), and the character light
 */
import { heroRecord } from './layered.js';
import { stampHero, withDefaultWalk } from '@/lib/graph/polygonizer/motion-stamp';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

/** The mint_solid call for a hero order's `mint`. */
export function heroMintArgs(mint) {
  const { toon, spec, ...rest } = mint;
  return { ...rest, spec: toon ? { ...spec, toon } : spec };
}

/** The ops that remake the hero stored as `prev` (its manifest, or null) from `order`. */
export function heroRemakeOps(order, prev = null) {
  const was = isObj(prev?.hero) ? prev.hero : null;
  // the base is remade as a mint makes it (the calibrated walk) when a motion page follows (the book's hero and cast);
  // a figure with no motion page keeps the walk it was stored with, or gets the calibrated one
  const keep = !order.motion && !isObj(order.spec?.motion) && was && isObj(was.motion);
  const spec = keep ? { ...order.spec, motion: was.motion } : withDefaultWalk(order.spec);
  const ops = [{ op: 'set', path: '/hero', value: heroRecord(stampHero(spec, was)) }];
  if (order.mint?.toon) ops.push({ op: 'set', path: '/toon', value: order.mint.toon });
  return ops;
}
