/**
 * vehicle-registry/tier — the fidelity a game's vehicles are drawn at, read from what the game already says, never asked.
 *
 * A vehicle is a registry row; a build is that row at a tier (builds.js: toy, stylised, realistic). Which tier a game
 * draws its vehicles at is read here, in order, the first that speaks winning:
 *
 *   1. the game's own word          quick.tier (the operator's)
 *   2. a realistic hero             the hero's `form: 'realistic'` (the quick hero, the book's hero, or an adopted hero's
 *                                   spec the caller passes): realistic characters drive realistic vehicles; or the
 *                                   people's body rail (the quick game's `body`, the book's direction) laying the
 *                                   realistic body in the world's tradition and look (gameworld/game-bodies.js)
 *   3. the juice's drawing          the world's written juice fidelity: form → realistic, voxel → toy
 *   4. the shooter pole             a pole on the realistic side (0 to 0.25) → realistic
 *   5. a voxel kit or venue         → toy
 *   6. a field of karts             a quick race of cartoon racers → toy
 *   (none)                          stylised: the builds games drew before the tier was read
 *
 *   vehicleTierOf(G, { heroSpec? }) → { tier, from, why }
 *   stampedTier(G, { heroSpec? })    → the tier a NEW quick world is stamped with at mint (quick.js quickWorld), or null
 *                                   for stylised: a world minted before the read carries none and keeps its vehicles, a
 *                                   world minted after carries what was read when it was made
 *
 * Pure: reads the world record, never writes it.
 */
import { TIER_IDS } from './builds.js';
import { readPole } from '../gameworld/shooter-pole.js';
import { railOfWord, bookRail, gameBody } from '../gameworld/game-bodies.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const said = (tier, from, why) => ({ tier, from, why });

export function vehicleTierOf(G, { heroSpec } = {}) {
  const Q = isObj(G?.quick) ? G.quick : {};
  if (Q.tier !== undefined) {
    if (!TIER_IDS.includes(Q.tier)) throw new Error(`gameworld: quick.tier is one of ${TIER_IDS.join(', ')}`);
    return said(Q.tier, 'operator', 'the game\'s own word');
  }
  const heroes = [heroSpec, Q.hero, G?.characters?.hero].filter(isObj);
  if (heroes.some((h) => h.form === 'realistic')) return said('realistic', 'hero', 'its hero is the realistic body: its vehicles are drawn to match');
  // (its people's body rail, the quick game's `body` or the book's: a rail that lays the realistic body on its people,
  // in the world's tradition and look, is realistic characters as surely as a hero who names it: game-bodies.js)
  const rail = Q.body !== undefined ? railOfWord(Q.body, { goal: Q.goal ?? null, genre: G?.intent?.from ?? null }) : bookRail(G);
  if (rail) {
    const B = gameBody(rail.rail, 'hero', { tradition: G?.characters?.direction?.tradition ?? null, look: isObj(G?.juice) ? G.juice.look ?? null : null, ...(rail.style ? { style: rail.style } : {}) });
    if (B.spec.form === 'realistic') return said('realistic', 'body', `its people are the ${rail.rail} rail's realistic body: its vehicles are drawn to match`);
  }
  const fid = isObj(G?.juice) ? G.juice.fidelity : undefined;
  if (fid === 'form') return said('realistic', 'juice', 'its effects are drawn in the form render');
  if (fid === 'voxel') return said('toy', 'juice', 'its effects are drawn in voxels');
  if (Q.pole !== undefined) {
    let p; try { p = readPole(Q.pole); } catch { p = undefined; }
    if (p !== undefined && p <= 0.25) return said('realistic', 'pole', 'its shooter pole is on the realistic side');
  }
  if (G?.style?.kit?.pole === 'voxel') return said('toy', 'kit', 'its kit is drawn in voxels');
  if (Q.racers !== undefined) return said('toy', 'racers', 'a field of cartoon racers');
  return said('stylised', 'default', 'nothing in the game asks for another tier');
}

/** The tier a new quick world is stamped with, or null when the read is the default (stylised: nothing to stamp). */
export function stampedTier(G, opts = {}) {
  const read = vehicleTierOf(G, opts);
  return read.from === 'operator' || read.tier === 'stylised' ? null : read.tier;
}
