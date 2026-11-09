/**
 * schedule — a mount posed from a SCHEDULE of stances on a timeline (seconds), the poser every one-shot shares (the
 * warped changes of gait in motion.js, the jump in jump.js). Each limb's stances are { on, off, y, x }: planted at world
 * y (the root's travel taken off to give the body-following frame) on the line x, between on and off. Between two
 * stances the leg swings, laid as the cycles lay it (legs.js) from the stance it leaves to the one it lands in.
 *
 *   schedulePoser(B, { stances, rootAt, bodyAt, limbAt, loadOf, etaOf, swingParams })
 *     → { rig, stanceState(id, st, t, bd?), poseAt(t) }
 *   rootAt(t) the root's travel; bodyAt(t) the body's state (pose.js); limbAt(id, t) { pair, side, x, … }; loadOf(id, st,
 *   t) a stance's vertical force (body weights); etaOf(id, st, t) its hoof's breakover pitch; swingParams(id, a, b) the
 *   swing from stance a to stance b: { lift, fold, warp?, follow? } (warp: v → v, slope 1 at both ends, to time the
 *   swing's path; follow: the path rides its girdle's departure from its course, as a leg in a flight does).
 */
import { standOn } from './build.js';
import { assemble } from './pose.js';
import { legRig, swingEnds, swingLeg } from './legs.js';
import { NECK } from './reference.js';

const IDS = ['LF', 'RF', 'LH', 'RH'];
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function schedulePoser(B, { stances, rootAt, bodyAt, limbAt, loadOf, etaOf, swingParams }) {
  const rig = legRig(B);
  const stanceState = (id, st, t, bd = bodyAt(t)) => {
    const l = { ...limbAt(id, t), x: st.x };
    return standOn(B, l.pair, st.y - rootAt(t), loadOf(id, st, t), etaOf(id, st, t), (F) => rig.solve(l, bd, F, 0, st.x));
  };
  const swingCache = new Map();
  const swingOf = (id, k) => {
    const key = `${id}:${k}`;
    if (swingCache.has(key)) return swingCache.get(key);
    const a = stances[id][k], b = stances[id][k + 1], h = 1e-4;
    const tLo = a.off - 1e-7, tTd = b.on + 1e-7;
    const sw = swingEnds(stanceState(id, a, tLo), stanceState(id, a, tLo - h), stanceState(id, b, tTd), stanceState(id, b, tTd + h), (b.on - a.off) / h);
    swingCache.set(key, sw);
    return sw;
  };
  const poseAt = (t) => {
    const bd = bodyAt(t), legs = {}, contact = {}, clamps = [];
    for (const id of IDS) {
      const list = stances[id];
      let k = list.findIndex((st) => t >= st.on - 1e-9 && t < st.off - 1e-9);
      let sol, distal, xh;
      if (k >= 0) {
        const st = stanceState(id, list[k], t, bd);
        sol = st.solve; distal = st.distal; xh = list[k].x; contact[id] = true;
      } else {
        k = list.findIndex((st, i) => st.off - 1e-9 <= t && list[i + 1] && t < list[i + 1].on - 1e-9);
        const a = list[k], b = list[k + 1];
        const p = swingParams(id, a, b);
        const vv0 = clamp01((t - a.off) / (b.on - a.off)), vv = p.warp ? p.warp(vv0) : vv0;
        const l = { ...limbAt(id, t), x: a.x };
        // a swing that follows its girdle (a flight): the girdle's departure from its straight course, lift-off to landing
        let follow = [0, 0];
        if (p.follow) {
          const g0 = rig.girdle(l, bodyAt(a.off), a.x), g1 = rig.girdle(l, bodyAt(b.on), b.x), g = rig.girdle(l, bd, a.x);
          // faded in and out over a quarter of the swing at each end, so the lift-off and the landing stay C1
          const S5 = (u) => { u = clamp01(u); return u * u * u * (10 - 15 * u + 6 * u * u); };
          const S = S5(vv0), w = S5(vv0 / 0.25) * S5((1 - vv0) / 0.25);
          follow = [(g[0] - (g0[0] + (g1[0] - g0[0]) * S)) * w, (g[1] - (g0[1] + (g1[1] - g0[1]) * S)) * w];
        }
        ({ sol, distal, xh } = swingLeg(B, rig, l, bd, swingOf(id, k), vv, { lift: p.lift, fold: p.fold, x0: a.x, x1: b.x, follow, hold: p.hold ?? 0, forward: p.forward ?? 0, floor: p.floor ?? false }));
        contact[id] = false;
      }
      if (sol.clamped) clamps.push(id);
      legs[id] = { solve: sol, distal, plane: rig.planeOf({ ...limbAt(id, t) }, bd, xh) };
    }
    const { bones, points } = assemble(B, { ...bd, headCounter: bd.headCounter ?? NECK.headCounter, legs });
    return { t, bones, points, legs, contact, clamps, body: bd, ground: -rootAt(t), root: rootAt(t) };
  };
  return { rig, stanceState, poseAt };
}
