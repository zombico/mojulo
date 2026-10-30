/**
 * THE GENERIC SOCKET: where a limb leaves a trunk that has no ring of its own to meet, a FILLET of skin from inside the
 * trunk's section to the limb's own ring, so the two read as one surface. It is the shoulder web's principle
 * (tiered-form.js SHOULDER_WEB: a sleeve that ENDS ON the limb's ring, the same points, so the two weld, where an overlap
 * would show its crossing as a crease) with nothing of the human in it: the trunk, the limb, its ring and the bones are
 * named by the caller, and every place is derived from the parts as the plan builds them.
 *
 *   rootWeb(plan, { trunk, limb, ring?, trunkBone, limbBone, name, group? })
 *        → a rings part: a BASE ring, the limb's ring spread wide (SOCKET.spread) and sunk back along the limb's axis
 *          (SOCKET.sink of its radius), each point then held inside the trunk's section at its height (SOCKET.inside of
 *          the way to the outline: tiered-form.js torsoSection), so the base never shows; rings between it and the
 *          limb's, eased in and swelled a little (SOCKET.rings); and the limb's ring itself, point for point. Its slots
 *          are the limb's (a limb of any ring family), its group the limb's. It rides the trunk's bone at the base,
 *          handing it to the limb's over its length (never at once: the shoulder cone's lesson). Null when the trunk or
 *          the limb is missing or the limb's ring cannot be read.
 *
 * Used by the beast-kin for the tail's root on the pelvis and the second pair of arms on the torso (./topology.js).
 * The hero's shoulder keeps its own web, ball and cone (tiered-form.js tieredSockets), byte for byte. Pure.
 */
import { partRings, torsoSection } from '../polygonizer/tiered-form.js';
import { SLOT_FAMILIES } from '../polygonizer/station-loft-plan.js';

const r6 = (x) => Math.round(x * 1e6) / 1e6 + 0;
const sub = (a, b) => a.map((x, i) => x - b[i]);
const unit = (a) => { const l = Math.hypot(...a) || 1; return a.map((x) => x / l); };
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };

/** the fillet's base (the limb's ring spread and sunk into the trunk, held inside its section) and its rings toward the
 * limb's: `t` the share of the way from the base to the limb's ring, `swell` over that, `w` the trunk's share of the skin */
export const SOCKET = Object.freeze({ spread: 1.7, sink: 0.9, inside: 0.88,
  rings: Object.freeze([Object.freeze({ t: 0, swell: 1, w: 1 }), Object.freeze({ t: 0.4, swell: 1.06, w: 0.65 }), Object.freeze({ t: 0.75, swell: 1.03, w: 0.3 })]) });

export function rootWeb(plan, { trunk, limb, ring = 'st1', trunkBone, limbBone, name, group }) {
  const T = plan.segments.find((s) => s.name === trunk), L = plan.segments.find((s) => s.name === limb);
  if (!T || !L) return null;
  const rings = partRings(plan, L).stations, at = rings.findIndex((st) => st.id === ring), end = rings[at];
  if (!end || rings.length < 2) return null;
  // (the limb's way out at its ring: from the ring before it, or toward the one after it when it is the first)
  const slots = Object.keys(end.points), c = centre(end.points), axis = unit(at > 0 ? sub(c, centre(rings[at - 1].points)) : sub(centre(rings[at + 1].points), c));
  const r = Math.max(...slots.map((sl) => Math.hypot(...sub(end.points[sl], c))));
  const hold = torsoSection(plan, plan.segments, trunk).hold;
  // the base: each point spread out from the ring's centre, sunk back along the limb's axis into the trunk, held inside
  const base = Object.fromEntries(slots.map((sl) => { const p = end.points[sl], q = p.map((x, k) => c[k] + (x - c[k]) * SOCKET.spread - axis[k] * SOCKET.sink * r); return [sl, hold(q, SOCKET.inside)]; }));
  const between = SOCKET.rings.slice(1).map(({ t, swell }) => { const pts = Object.fromEntries(slots.map((sl) => [sl, base[sl].map((x, k) => x + (end.points[sl][k] - x) * t)])), m = centre(pts);
    return Object.fromEntries(slots.map((sl) => [sl, pts[sl].map((x, k) => m[k] + (x - m[k]) * swell)])); });
  const all = [base, ...between, end.points];
  const fam = Object.entries(SLOT_FAMILIES).find(([, f]) => f.length === slots.length && f.every((x, i) => x === slots[i]))?.[0] ?? slots;
  const w = (trunkShare) => (trunkShare >= 1 ? { [trunkBone]: 1 } : trunkShare <= 0 ? { [limbBone]: 1 } : { [trunkBone]: trunkShare, [limbBone]: r6(1 - trunkShare) });
  const ws = [...SOCKET.rings.map((x) => x.w), 0];
  const cb = centre(base);
  return { name, kind: 'rings', slots: fam, stations: all.map((P, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) })),
    caps: { back: cb.map((x, k) => r6(x - axis[k] * 0.2 * r)), tip: c.map((x, k) => r6(x - axis[k] * 0.15 * r)) }, group: group ?? L.group, ...(L.mirror === 'name' ? { mirror: 'name' } : {}),   // (a midline limb's socket is one part: a rings part is never mirrored by the plane)

    bind: { bone: limbBone, blend: { back: w(1), ...Object.fromEntries(ws.map((x, i) => [`st${i}`, w(x)])), tip: w(0) } } };
}
