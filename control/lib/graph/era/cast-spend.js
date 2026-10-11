/**
 * CAST SPEND: where a figure's triangles go, read against what its target can show. The target's pixel height picks a
 * TIER (T0 … T4: what a figure that tall shows, from a PS1 silhouette to a cinematic close-up) and a budget (about
 * 0.05·H² triangles: one per ~10 px² of the figure's box, the rule that reproduces the eras' heroes). The tier reserves
 * a share of the budget for each region (the body's silhouette first at low tiers; the face, hair and gear as it
 * climbs). The readout says, per region, its triangles, its share and where that sits against the reserve, and the
 * parts that spend most for their size. Advice, never a refusal.
 *
 * The tiers, the budget rule and the shares are starting points synthesised from published characters (Kratos, Drake,
 * MetaHuman's LODs) and practitioners' estimates, to be calibrated on the system's own renders at the eyes gate.
 *
 *   tierOf(figurePx)              the tier a figure that many pixels tall is drawn at
 *   castSpend(mesh, plan, target) regions, shares against the tier's reserve, the budget, the heaviest parts
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
  T0: Object.freeze({ body: [0.5, 0.6], head: [0.15, 0.2], hair: [0.05, 0.1], hands: [0.05, 0.08], clothing: [0.1, 0.15] }),
  T1: Object.freeze({ body: [0.5, 0.6], head: [0.15, 0.2], hair: [0.05, 0.1], hands: [0.05, 0.08], clothing: [0.1, 0.15] }),
  T2: Object.freeze({ body: [0.35, 0.45], head: [0.2, 0.3], hair: [0.1, 0.2], hands: [0.06, 0.1], clothing: [0.15, 0.25] }),
  T3: Object.freeze({ body: [0.28, 0.38], head: [0.25, 0.35], hair: [0.12, 0.3], hands: [0.07, 0.11], clothing: [0.15, 0.3] }),
  T4: Object.freeze({ body: [0.2, 0.3], head: [0.3, 0.4], hair: [0.15, 0.4], hands: [0.08, 0.12], clothing: [0.15, 0.35] }),
});
export const REGIONS = Object.freeze(['body', 'head', 'hair', 'hands', 'clothing']);

const BODY = /^(torso|pelvis|neck|clavicle[RL]?|upperArm[RL]|foreArm[RL]|thigh[RL]|shank[RL]|foot[RL]|toes[RL]|pectoral[RL]|bust[RL])$/;
const HANDS = /^(hand|thumb|index|middle|ring|little)[RL]$/;
const HAIR = /^hair|lock|braid|ponytail|tail[RL]?$|fringe|bang|bun/i;

export const tierOf = (figurePx) => TIERS.find((t) => figurePx < t.upTo);

/** A part's region: the body's, the hands', the hair's, the head's (above the head's base, not hair) or the clothing's. */
function regionOf(part, minZ, headBaseZ) {
  if (BODY.test(part)) return 'body';
  if (HANDS.test(part)) return 'hands';
  if (HAIR.test(part)) return 'hair';
  if (headBaseZ != null && minZ >= headBaseZ - 0.02) return 'head';
  return 'clothing';
}

const r3 = (v) => Math.round(v * 1000) / 1000;

/** The figure's spend under its target: { tier, budget, triangles, regions, heaviest, advice? }. */
export function castSpend(mesh, plan, targetSpec) {
  const target = readTarget(targetSpec), tier = tierOf(target.figurePx);
  const budget = Math.round(BUDGET_PER_PX2 * target.figurePx ** 2);
  const headBaseZ = plan?.joints?.headBase?.[2] ?? null;
  const parts = new Map();
  mesh.faces.forEach((t) => {
    const p = mesh.provenance[t[0]].part, e = parts.get(p) || { tris: 0, minZ: Infinity };
    e.tris++; for (const vi of t) e.minZ = Math.min(e.minZ, mesh.vertices[vi][2]); parts.set(p, e);
  });
  const total = mesh.faces.length, sums = Object.fromEntries(REGIONS.map((r) => [r, 0]));
  for (const [p, e] of parts) sums[regionOf(p, e.minZ, headBaseZ)] += e.tris;
  const reserve = REGION_SHARES[tier.id], advice = [];
  const regions = Object.fromEntries(REGIONS.map((r) => {
    const share = total ? sums[r] / total : 0, [lo, hi] = reserve[r];
    const at = share < lo ? 'under' : share > hi ? 'over' : 'in';
    if (at !== 'in' && sums[r] > 0) advice.push(`${r} spends ${Math.round(share * 100)}% of the figure, ${at} its ${tier.id} reserve of ${Math.round(lo * 100)}–${Math.round(hi * 100)}%`);
    return [r, { triangles: sums[r], share: r3(share), reserve: [lo, hi], at }];
  }));
  if (total > budget * 1.5) advice.push(`the figure spends ${total} triangles; a ${target.figurePx} px figure shows about ${budget}`);
  // the parts that spend most per share of the figure: the first places a tier's gate would cut
  const heaviest = [...parts.entries()].map(([p, e]) => ({ part: p, triangles: e.tris, region: regionOf(p, e.minZ, headBaseZ) }))
    .sort((a, b) => b.triangles - a.triangles).slice(0, 6);
  return { tier: tier.id, reads: tier.reads, figurePx: target.figurePx, budget, triangles: total, regions, heaviest, ...(advice.length ? { advice } : {}) };
}
