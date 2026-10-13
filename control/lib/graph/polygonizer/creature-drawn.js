/**
 * THE DRAWN CREATURE: a ring plan compiled by the principles the tiered hero is drawn by, on the creature's OWN body.
 * Nothing about its shape changes (the joints, the radii, the masses, the posture are the plan's); what changes is how
 * that shape is built for its target: a bridge over every joint its bind chains name, so a bend rounds instead of
 * folding two prisms into each other, and its rings set by the target's outline rule (cast-density.js), so each part
 * has the sides its size on screen asks for. Built at the target directly: no coarse stage.
 *
 * The opt-in is the plan's own: `style: { drawn: true | { target } }` (the target a target.js spec; 1080p third-person
 * by default). Absent, the plan is as it was, byte for byte.
 *
 *   creatureJoints(plan, target)   the joints to bridge: each pair of a part and the next its bind names, where the
 *                                  smaller of the two rings meeting there stands at least BRIDGE_MIN_PX in radius at the
 *                                  target (a joint too small to show its bend, a claw's knuckle, keeps the shared
 *                                  overshoot ring)
 *   creatureBodyParts(plan)        the parts the outline rule sets: the trunks, segments and lofts (right-hand and midline)
 *   headAtTier(head, ppm)          a head plan's details kept by what reads at `ppm` pixels a metre (below)
 *   drawnPlan(plan)                the plan bridged, densified and its details spent for its target; no `style.drawn`
 *                                  ⇒ the plan itself
 *
 * SPEND BY WHAT READS: the triangles a detail costs buy nothing when it is too small to read at the target, so the drawn
 * creature builds only what reads, and its body (bridged, densified) takes the share they freed:
 *   - a stroke thinner than READ_PX never reads: whiskers (by their thickness), wrinkles (by their width);
 *   - a fur tuft shorter than TUFT_MIN_PX reads as a bump, not a tuft (a body or head tile region by its height): the
 *     tall ones (a ruff, a tail's brush) are its outline and stay, the short ones are paint's (the body tint);
 *   - teeth whose largest is under TOOTH_MIN_PX are the lip line;
 *   - the eye's surround takes the sides its outline wants at the target (target.js sidesFor), 8 at least, 20 at most;
 *   - a bridge keeps its five rings (they carry the bend) and takes only its chain's sides, not its stations halved;
 *   - what it WEARS by the same outline rule: a ribbon's rows and columns by its length and width on screen (a stroke
 *     every RIBBON_PX), a chain's links by their loop and wire, a disc's sides by its radius.
 * A closer target keeps more: the same plan at a close-up builds every whisker.
 */
import { tieredJoints } from './tiered-form.js';
import { densityPlan, planHeight } from '../era/cast-density.js';
import { readTarget, pxPerMetre, sidesFor, DEFAULT_TARGET } from '../era/target.js';

/** the smallest joint, in its ring's radius on screen, that a bridge shows (below it the bend is a few pixels) */
export const BRIDGE_MIN_PX = 4;
/** how far each limb stops short of a bridged joint, in its end ring's radii (the hero's elbow and knee) */
const REACH = 0.6;
/** what reads at the target, in its pixels: a stroke's thickness, a tuft's height, a tooth's size */
export const READ_PX = 1, TUFT_MIN_PX = 6, TOOTH_MIN_PX = 3, RIBBON_PX = 4;
const evenIn = (n, lo, hi) => Math.min(hi, Math.max(lo, 2 * Math.ceil(n / 2)));

const rad = (r) => (Array.isArray(r) ? Math.max(...r.flat(Infinity)) : r);
const boneOf = (g) => (typeof g.bind === 'string' ? g.bind : g.bind?.bone ?? g.name);
const right = (g) => g.mirror === 'name' ? /R$/.test(g.name) : !/L$/.test(g.name);
/** the radius of a part's ring at its lower end (a segment's rB, a loft's last station), and at its upper (rA, the first) */
const endRadius = (g) => (g.kind === 'segment' ? rad(g.rB) : g.kind === 'loft' ? rad(g.stations[g.stations.length - 1].r) : 0);
const startRadius = (g) => (g.kind === 'segment' ? rad(g.rA) : g.kind === 'rings' ? Infinity : 0);

export const drawnTarget = (plan) => {
  const d = plan.style?.drawn;
  return d === true ? DEFAULT_TARGET : d && typeof d === 'object' ? d.target ?? DEFAULT_TARGET : null;
};

export function creatureJoints(plan, targetSpec = DEFAULT_TARGET) {
  const target = readTarget(targetSpec), ppm = pxPerMetre(target, planHeight(plan));
  const segs = plan.segments || [], byBone = new Map(segs.map((g) => [boneOf(g), g]));
  const out = [];
  for (const U of segs) {
    if (!['segment', 'loft'].includes(U.kind) || !right(U) || typeof U.bind !== 'object' || !U.bind?.next) continue;
    const D = byBone.get(U.bind.next);
    if (!D || !['segment', 'rings'].includes(D.kind) || (typeof D.bind === 'object' && D.bind.prev && D.bind.prev !== boneOf(U))) continue;
    // the joint reads by the smaller of the two rings that meet there (a claw on a toe: the claw's)
    if (Math.min(endRadius(U), startRadius(D)) * ppm < BRIDGE_MIN_PX) continue;
    out.push(Object.freeze({ bridge: `${D.name.replace(/R$/, '')}Bridge${/R$/.test(D.name) ? 'R' : ''}`, upper: U.name, lower: D.name, fold: null, reach: REACH }));
  }
  return out;
}

export function headAtTier(head, ppm) {
  const Rg = { ...head.regions };
  if (Rg.whiskers && 2 * Rg.whiskers.r * ppm < READ_PX) delete Rg.whiskers;
  if (Rg.wrinkles) { const kept = Rg.wrinkles.filter((D) => D.w * ppm >= READ_PX); if (kept.length) Rg.wrinkles = kept; else delete Rg.wrinkles; }
  if (Rg.tiles) { const kept = Rg.tiles.filter((T) => (T.height ?? 0) * ppm >= TUFT_MIN_PX); if (kept.length) Rg.tiles = kept; else delete Rg.tiles; }
  if (Rg.orbit && Rg.eye) { const outer = Rg.eye.R + Math.max(...[Rg.orbit.reach ?? 0].flat()); Rg.orbit = { ...Rg.orbit, sections: evenIn(sidesFor(outer * ppm, 1), 8, 20) }; }
  const ornaments = (head.ornaments || []).filter((o) => o.kind !== 'teeth' || Math.max(...o.sizes) * ppm >= TOOTH_MIN_PX);
  return { ...head, regions: Rg, ornaments };
}

/** an adornment's signature built for `ppm` pixels a metre (station-loft-adorn.js reads these fields; absent, its own) */
export function adornAtTier(A, ppm) {
  const S = A.signature; if (!S) return A;
  const out = { ...S };
  if (S.kind === 'ribbon' && Array.isArray(S.spine)) {
    let L = 0; for (let i = 1; i < S.spine.length; i++) L += Math.hypot(...S.spine[i].map((x, k) => x - S.spine[i - 1][k]));
    out.rows = Math.min(S.rows ?? 12, Math.max(2, Math.ceil(L * ppm / RIBBON_PX))); out.cols = Math.min(S.cols ?? 5, Math.max(2, Math.ceil((S.width ?? 0.03) * ppm / RIBBON_PX)));
  }
  if (Number.isFinite(S.links) && Number.isFinite(S.len) && Number.isFinite(S.link)) out.linkSides = [evenIn(sidesFor(0.55 * S.len * ppm, 1), 4, 10), Math.min(5, Math.max(3, Math.ceil(sidesFor(S.link * ppm, 1))))];
  if (S.kind === 'medallion' && Number.isFinite(S.r)) out.m = Math.min(S.m ?? 14, evenIn(sidesFor(S.r * ppm, 1), 6, 14));
  return { ...A, signature: out };
}

export const creatureBodyParts = (plan) => (plan.segments || []).filter((g) => ['trunk', 'segment', 'loft', 'rings'].includes(g.kind) && right(g)).map((g) => g.name);

export function drawnPlan(plan) {
  const target = drawnTarget(plan);
  if (!target) return plan;
  // the ring families as the expansion reads them (station-loft-plan.js expandPlan's defaults), so the outline rule sees
  // the sides every part is built with
  // and the density the TARGET's, not the author's: a hand-written refine of a part the outline rule sets is dropped
  // (its rings halved by hand for a console it no longer names), and the rule splits what its target asks
  const ruled = new Set(creatureBodyParts(plan).flatMap((n) => [n, n.replace(/R$/, 'L')]));
  const refine = plan.body?.refine?.map((e) => (Array.isArray(e.parts) ? { ...e, parts: e.parts.filter((p) => !ruled.has(p)) } : e)).filter((e) => !Array.isArray(e.parts) || e.parts.length);
  const styled = { ...plan, style: { slots: 'ring8', limbSlots: 'limb6', e: 2, ...plan.style }, ...(plan.body?.refine ? { body: { ...plan.body, refine } } : {}) };
  const joints = creatureJoints(styled, target), bridged = joints.length ? tieredJoints(styled, joints) : styled;
  // a creature colours a part by its own tint where its palette names no group: the bridge wears its upper limb's
  const tintOf = new Map(styled.segments.map((g) => [g.name, g.tint]));
  const tinted = { ...bridged, segments: bridged.segments.map((g) => { const J = joints.find((x) => x.bridge === g.name); return J && !g.tint && tintOf.get(J.upper) ? { ...g, tint: tintOf.get(J.upper) } : g; }) };
  const dense = densityPlan(tinted, target, { parts: creatureBodyParts(tinted), joints });
  // the spend: the head's details and the body's tufts by what reads, the bridges' stations as built
  const ppm = pxPerMetre(readTarget(target), planHeight(plan)), bridges = new Set(joints.flatMap((J) => [J.bridge, J.bridge.replace(/R$/, 'L')]));
  const body = dense.body && {
    ...dense.body,
    ...(dense.body.tiles ? { tiles: dense.body.tiles.filter((T) => (T.height ?? 0) * ppm >= TUFT_MIN_PX) } : {}),
    ...(dense.body.refine ? { refine: dense.body.refine.flatMap((e) => {
      if (e.stations === false || !Array.isArray(e.parts) || !e.parts.some((p) => bridges.has(p))) return [e];
      const own = e.parts.filter((p) => !bridges.has(p)), mine = e.parts.filter((p) => bridges.has(p));
      return [...(own.length ? [{ ...e, parts: own }] : []), ...(e.slots === false ? [] : [{ ...e, parts: mine, stations: false }])];
    }) } : {}),
  };
  return { ...dense, ...(body ? { body } : {}), ...(Array.isArray(dense.adorn) ? { adorn: dense.adorn.map((A) => adornAtTier(A, ppm)) } : {}), ...(dense.heads ? { heads: dense.heads.map((h) => (h.plan && typeof h.plan === 'object' ? { ...h, plan: headAtTier(h.plan, ppm) } : h)) } : {}) };
}
