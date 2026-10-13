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
 *   drawnPlan(plan)                the plan bridged and densified for its target; no `style.drawn` ⇒ the plan itself
 */
import { tieredJoints } from './tiered-form.js';
import { densityPlan, planHeight } from '../era/cast-density.js';
import { readTarget, pxPerMetre, DEFAULT_TARGET } from '../era/target.js';

/** the smallest joint, in its ring's radius on screen, that a bridge shows (below it the bend is a few pixels) */
export const BRIDGE_MIN_PX = 4;
/** how far each limb stops short of a bridged joint, in its end ring's radii (the hero's elbow and knee) */
const REACH = 0.6;

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

export const creatureBodyParts = (plan) => (plan.segments || []).filter((g) => ['trunk', 'segment', 'loft', 'rings'].includes(g.kind) && right(g)).map((g) => g.name);

export function drawnPlan(plan) {
  const target = drawnTarget(plan);
  if (!target) return plan;
  // the ring families as the expansion reads them (station-loft-plan.js expandPlan's defaults), so the outline rule sees
  // the sides every part is built with
  const styled = { ...plan, style: { slots: 'ring8', limbSlots: 'limb6', e: 2, ...plan.style } };
  const joints = creatureJoints(styled, target), bridged = joints.length ? tieredJoints(styled, joints) : styled;
  // a creature colours a part by its own tint where its palette names no group: the bridge wears its upper limb's
  const tintOf = new Map(styled.segments.map((g) => [g.name, g.tint]));
  const tinted = { ...bridged, segments: bridged.segments.map((g) => { const J = joints.find((x) => x.bridge === g.name); return J && !g.tint && tintOf.get(J.upper) ? { ...g, tint: tintOf.get(J.upper) } : g; }) };
  return densityPlan(tinted, target, { parts: creatureBodyParts(tinted), joints });
}
