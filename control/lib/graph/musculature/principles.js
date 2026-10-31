/** musculature/principles.js — THE LAWS the muscle shirt's passes obey, written once: how the definition dial reads a mass's
 * level (the fractal articulation, form to detail), each level's blend, and the smooth union they are summed by.
 *
 * The dial `definition` runs 0 … 1. At 0 the FORM end: each group is its level-0 masses alone, grown (`FORM_GAIN`), under
 * loose blends: a few key shapes in a bodybuilder's proportions (the 3D bodies of David Production's JoJo openings). As it
 * rises each finer level rises out of its parent (level 1 over the first half, level 2 over the second), the parent sunk
 * under its children as they come, so the silhouette holds while the groups break into their muscles and the muscles into
 * their heads; every level's blend tightens and the finest stand a little prouder (`DETAIL_GAIN`). At 1 the DETAIL end:
 * every head separate, the harmony made by the shadows their grooves collect (Tekken's definition). The same rule at
 * every level, so a group may be held at its own definition. Pure; no dice. */

/** the deepest level a card may author (0 a group's silhouette, 1 its muscles, 2 their heads) */
export const LEVELS = 2;

/** the level-0 masses' growth at the form end (their radii and their proud × 1 + FORM_GAIN · (1 − d)) */
export const FORM_GAIN = 0.14;
/** the finest level's growth at the detail end (its proud × 1 + DETAIL_GAIN · d): the grooves read deeper */
export const DETAIL_GAIN = 0.35;
/** how far a parent sinks under its children as they rise (a share of its depth radius, at their full presence) */
export const SINK = 0.45;

/** THE HANDS follow the arms: scaled about the wrist by this share of the forearm's growth in girth (1 + share · (g −
 * 1)), so a fist reads with the forearm the shirt grew without becoming a mitt; a card's `hands` (a number) names its own */
export const HAND_SHARE = 0.75;

/** THE FEET follow the legs: scaled about the ground under the ankle (the sole stays on it) by this share of the
 * shank's growth in girth; a card's `feet` (a number) names its own */
export const FOOT_SHARE = 0.6;

/** THE NIPPLES (the shirt's `nipples: true`): a mark on the muscle's skin, worn after the muscles, seated where a ray from
 * the trunk's axis leaves the displaced chest: the areola a low disc and the papilla a small bump on it (each [across,
 * across, depth] and proud, in W, sized to read at the shirt's grain: a papilla under it barely moved a point), under
 * their own tight blend `k` (m), so the pectoral's blend never washes them out */
export const NIPPLE = Object.freeze({
  areola: Object.freeze({ r: [0.1, 0.1, 0.03], proud: 0.012 }),
  papilla: Object.freeze({ r: [0.042, 0.042, 0.03], proud: 0.032 }),
  k: 0.002,
});

/** each level's blend `k` in metres, [at the form end, at the detail end]: the masses of one level summed by it, then
 * summed with their parent's level by the parent's; and the skin's (`skin`), how the union meets the wearer's skin */
export const BLEND = Object.freeze({
  0: Object.freeze([0.02, 0.01]),
  1: Object.freeze([0.014, 0.006]),
  2: Object.freeze([0.01, 0.004]),
  skin: Object.freeze([0.018, 0.01]),
});

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const mix = ([a, b], d) => a + (b - a) * d;

/** a level's presence at definition `d`: 1 for level 0; level ℓ rises over the ℓ-th share of the dial */
export const presence = (level, d) => (level === 0 ? 1 : clamp01(d * LEVELS - (level - 1)));
/** a level's blend at definition `d` (metres) */
export const blendOf = (level, d) => mix(BLEND[level], d);
/** the blend of the union into the skin at definition `d` (metres) */
export const skinBlendOf = (d) => mix(BLEND.skin, d);

/** a mass's articulation at definition `d`, as the passes read it: `grow` its radii's factor, `proud` its proud's,
 * `bury` how far (of its depth radius plus its proud) it is held under the skin (1 wholly: it adds nothing), `sink`
 * how far (of its depth radius) it is sunk under its children. `finest` is the deepest level its group authors */
export function articulation(level, d, finest) {
  const p = presence(level, d), child = level < finest ? presence(level + 1, d) : 0;
  const grow = level === 0 ? 1 + FORM_GAIN * (1 - d) : 1;
  const proud = grow * (level === finest && level > 0 ? 1 + DETAIL_GAIN * d : 1);
  return { grow, proud, bury: 1 - p, sink: SINK * child };
}

/** the polynomial smooth minimum of two distances, blend `k`: exactly the lesser where they differ by `k` or more, so a
 * mass out of reach adds nothing at all (the skin past every mass's reach keeps its place, byte for byte) */
export function smin(a, b, k) {
  if (!(k > 0)) return a < b ? a : b;
  const h = k - Math.abs(a - b);
  if (h <= 0) return a < b ? a : b;
  return (a < b ? a : b) - (h * h) / (4 * k);
}
