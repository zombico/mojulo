/**
 * CAST SPEND: where a figure's triangles go, read against what its target can show. The target's pixel height picks a
 * TIER (T0 … T4: what a figure that tall shows, from a PS1 silhouette to a cinematic close-up) and a budget (about
 * 0.05·H² triangles: one per ~10 px² of the figure's box, the rule that reproduces the eras' heroes). The tier reserves
 * a share of the budget for each region (the body's silhouette first at low tiers; the face, hair and gear as it
 * climbs). The readout says, per region, its triangles, its share and where that sits against the reserve, and the
 * parts that spend most for their size. Advice, never a refusal.
 *
 * What the hero WEARS is clothing wherever it sits (an armour's `adorn.*` piece, a garment `<id>_<part>`: a helm is not
 * the head). What it CARRIES (hero-gear.js, drawn beside the figure's mesh) is the GEAR region, read only when the
 * caller passes it: its reserve starts at zero, since a hero may carry nothing.
 *
 * A CREATURE (a ring plan through the creature door) is read the same way, by its own part names: the shin and the
 * metatarsal, the tail's links, the paw's fingers, pads and claws, and the muzzle's parts (whiskers, teeth, the tongue,
 * the eye's surround), which hang below the head's base, so its height alone would file them as clothing. With `cover`
 * its tiles (`tile.*`: fur, scale, feather and plate) are its COVER, their own region: the reserve starts at zero and
 * tops out at the hair's. A hero's tiles are a garment's (a quilted back), so without `cover` they stay clothing.
 *
 * The tiers, the budget rule and the shares are starting points synthesised from published characters (Kratos, Drake,
 * MetaHuman's LODs) and practitioners' estimates, to be calibrated on the system's own renders at the eyes gate.
 *
 *   tierOf(figurePx)              the tier a figure that many pixels tall is drawn at
 *   castSpend(mesh, plan, target, { gear?, cover? })  regions, shares against the tier's reserve, the budget, the heaviest parts
 *                                            (gear: [{ slot, item, triangles }], hero-gear.js gearTriangles)
 */
import { readTarget } from './target.js';

/** The tiers by the figure's height in pixels (below `upTo`). */
export const TIERS = Object.freeze([
  Object.freeze({ id: 'T0', upTo: 150, reads: 'a PS1 silhouette' }),
  Object.freeze({ id: 'T1', upTo: 300, reads: 'a PS2 hero' }),
  Object.freeze({ id: 'T2', upTo: 600, reads: 'a PS3 hero' }),
  Object.freeze({ id: 'T3', upTo: 1200, reads: 'a late PS3 / PS4 hero' }),
  Object.freeze({ id: 'T4', upTo: Infinity, reads: 'a current hero or a close-up' }),
]);
export const BUDGET_PER_PX2 = 0.05;

/** Each region's reserved share of the budget per tier, [low, high]. */
export const REGION_SHARES = Object.freeze({
  T0: Object.freeze({ body: [0.5, 0.6], head: [0.15, 0.2], hair: [0.05, 0.1], hands: [0.05, 0.08], clothing: [0.1, 0.15], gear: [0, 0.08] }),
  T1: Object.freeze({ body: [0.5, 0.6], head: [0.15, 0.2], hair: [0.05, 0.1], hands: [0.05, 0.08], clothing: [0.1, 0.15], gear: [0, 0.1] }),
  T2: Object.freeze({ body: [0.35, 0.45], head: [0.2, 0.3], hair: [0.1, 0.2], hands: [0.06, 0.1], clothing: [0.15, 0.25], gear: [0, 0.12] }),
  T3: Object.freeze({ body: [0.28, 0.38], head: [0.25, 0.35], hair: [0.12, 0.3], hands: [0.07, 0.11], clothing: [0.15, 0.3], gear: [0, 0.15] }),
  T4: Object.freeze({ body: [0.2, 0.3], head: [0.3, 0.4], hair: [0.15, 0.4], hands: [0.08, 0.12], clothing: [0.15, 0.35], gear: [0, 0.2] }),
});
/** a creature's COVER (its tiles), per tier: from nothing up to the hair's top share */
const COVER_SHARE = (tierId) => [0, REGION_SHARES[tierId].hair[1]];
/** the figure's own regions (its mesh); GEAR is read beside them when the caller passes it */
export const REGIONS = Object.freeze(['body', 'head', 'hair', 'hands', 'clothing']);

// the tiered form's joints (tiered-form.js) are the body's: the bridges over the elbows, knees and wrists, the shoulders'
// balls and folds, and over the balls their webs and cones (hero laws 8 and 9: skin in the arm's colour, never a garment)
// (a creature's: the shin, the metatarsal, the tail's links, the foot's pads and claws, and the bridge over any joint
// its chains name, creature-drawn.js)
const BODY = /^(torso|pelvis|neck|clavicle[RL]?|upperArm[RL]|foreArm[RL]|thigh[RL]|shank[RL]|foot[RL]|toes[RL]|pectoral[RL]|bust[RL]|(elbow|knee|wrist)Bridge[RL]|shoulder(Ball|Fold|Web|Cone)[RL]|(elbow|knee|hip)Fold[RL]|shin[RL]|meta[RL]|tail\d+|pad\.toes[RL]|clawF\d+[RL]|[a-z]+Bridge[RL])$/;
// (a creature's paw: its fingers, pads and claws)
const HANDS = /^((hand|thumb|index|middle|ring|little)[RL]|finger[A-Z]\d[RL]|pad\.hand[RL]|clawH\d+[RL])$/;
// the head's own parts that reach below its base (the jaw hangs about 4 cm under it; a creature's muzzle further; the anime
// head's face, its heaviest part, wraps the chin)
const HEAD = /^(cranium|jaw|face|surround[RL]|whisker\d+[RL]|wrinkle\d+[RL]|tooth[LU]\.\d+[RL]|tongue\.\d+|web[RL]|fold[RL]|catch[RL])$/;
const COVER = /^tile[.\d]/;
const HAIR = /^(hair|lock|braid|ponytail|fringe|bang|bun|tail[RL]?$)/i;
// what is worn: an adornment's pieces (station-loft-adorn.js) and a garment copied off a body part (body-garment.js)
const WORN = /^adorn\.|_/;

export const tierOf = (figurePx) => TIERS.find((t) => figurePx < t.upTo);
/** The tiers dense enough for a feature's full detail (the tiered ear, the painted face's dense sheet): one list. */
export const DENSE_TIERS = Object.freeze(['T3', 'T4']);

/** A part's region: the body's, the hands', the hair's, the head's (above the head's base, not hair) or the clothing's. */
function regionOf(part, minZ, headBaseZ, cover = false) {
  if (cover && COVER.test(part)) return 'cover';
  if (WORN.test(part)) return 'clothing';
  if (BODY.test(part)) return 'body';
  if (HANDS.test(part)) return 'hands';
  if (HAIR.test(part)) return 'hair';
  if (HEAD.test(part)) return 'head';
  if (headBaseZ != null && minZ >= headBaseZ - 0.02) return 'head';
  return 'clothing';
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/** The figure's spend under its target: { tier, budget, triangles, regions, heaviest, advice? }; with `gear`, the carried
 * items are counted in the triangles and read as their own region. */
export function castSpend(mesh, plan, targetSpec, { gear = null, cover = false } = {}) {
  const target = readTarget(targetSpec), tier = tierOf(target.figurePx);
  const budget = Math.round(BUDGET_PER_PX2 * target.figurePx ** 2);
  // a hero's plan names its joints; a creature's recipe names its rig's (`rig.joints.headBase.at`)
  const headBaseZ = plan?.joints?.headBase?.[2] ?? plan?.rig?.joints?.headBase?.at?.[2] ?? null;
  const parts = new Map();
  mesh.faces.forEach((t) => {
    const p = mesh.provenance[t[0]].part, e = parts.get(p) || { tris: 0, minZ: Infinity };
    e.tris++; for (const vi of t) e.minZ = Math.min(e.minZ, mesh.vertices[vi][2]); parts.set(p, e);
  });
  const carried = gear?.length ? gear : null, covered = cover && [...parts.keys()].some((p) => COVER.test(p));
  const read = [...REGIONS, ...(covered ? ['cover'] : []), ...(carried ? ['gear'] : [])];
  const sums = Object.fromEntries(read.map((r) => [r, 0]));
  for (const [p, e] of parts) sums[regionOf(p, e.minZ, headBaseZ, covered)] += e.tris;
  for (const g of carried || []) sums.gear += g.triangles;
  const total = mesh.faces.length + (carried ? sums.gear : 0);
  const reserve = covered ? { ...REGION_SHARES[tier.id], cover: COVER_SHARE(tier.id) } : REGION_SHARES[tier.id], advice = [];
  const regions = Object.fromEntries(read.map((r) => {
    const share = total ? sums[r] / total : 0, [lo, hi] = reserve[r];
    const at = share < lo ? 'under' : share > hi ? 'over' : 'in';
    if (at !== 'in' && sums[r] > 0) advice.push(`${r} spends ${Math.round(share * 100)}% of the figure, ${at} its ${tier.id} reserve of ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
    return [r, { triangles: sums[r], share: r3(share), reserve: [lo, hi], at }];
  }));
  if (total > budget * 1.5) advice.push(`the figure spends ${total} triangles; a ${target.figurePx} px figure shows about ${budget}`);
  // the parts that spend most per share of the figure: the first places a tier's gate would cut
  const heaviest = [...parts.entries()].map(([p, e]) => ({ part: p, triangles: e.tris, region: regionOf(p, e.minZ, headBaseZ, covered) }))
    .concat((carried || []).map((g) => ({ part: `gear.${g.slot}`, item: g.item, triangles: g.triangles, region: 'gear' })))
    .sort((a, b) => b.triangles - a.triangles).slice(0, 6);
  return { tier: tier.id, reads: tier.reads, figurePx: target.figurePx, budget, triangles: total, regions, heaviest, ...(advice.length ? { advice } : {}) };
}
