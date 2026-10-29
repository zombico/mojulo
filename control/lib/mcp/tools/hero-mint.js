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
import { heroRecord, withRolledFace, withFaceFit } from './layered.js';
import { stampHero, withDefaultWalk, withDefaultForm } from '@/lib/graph/polygonizer/motion-stamp';
import { undeadWords } from '@/lib/graph/undead/tiered';
import { beastWords } from '@/lib/graph/beast/tiered';

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
  // (an undead or a beast-kin walks its own walk, laid before the calibrated one: undead/tiered.js, beast/tiered.js)
  const walked = keep ? { ...order.spec, motion: was.motion } : withDefaultWalk(beastWords(undeadWords(order.spec)));
  // (the body it was stored on, unless the order names one: a hero stored without a form stays on the classic body)
  const spec = was && (walked?.form === undefined || walked?.form === null) ? (was.form !== undefined ? { ...walked, form: was.form } : walked) : withDefaultForm(walked);
  // (a realistic hero's face: kept from the stored hero unless the order names one, else rolled: layered.js withRolledFace)
  // (and its own fit, solved once and stamped: layered.js withFaceFit)
  const ops = [{ op: 'set', path: '/hero', value: heroRecord(stampHero(withFaceFit(withRolledFace(spec, was)), was)) }];
  if (order.mint?.toon) ops.push({ op: 'set', path: '/toon', value: order.mint.toon });
  return ops;
}
