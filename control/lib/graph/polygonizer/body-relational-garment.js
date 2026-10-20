/** body-relational-garment.js — a garment TAILORED TO BODY PARTS on the realistic body. A piece names the body parts it
 * covers (the body-part map's: a tee the chest, the abdomen, the flanks, the back, the shoulders and the upper arms), not
 * the segments it lies on; the segments that carry those parts are found from the map, and on each the rings the parts
 * mostly cover (or down a limb to its `limit`). Its surface is one CLOTH FIELD: the body's own field blended `looser`
 * (the grooves between the masses spanned, as cloth spans them) and pushed out by the `ease`, each point cast onto it
 * along the skin's own ray (from its ring's middle through the skin's point), then carried over its ring's hollows and
 * the dips along the piece (the envelope: the cleft between the breasts, the abdomen's segments). So the torso's piece
 * and the sleeves meet on one surface as the skin's parts do, and each cloth point keeps its skin point's address
 * (station and slot): it takes the skin's bind and the skin's correctives (a raised arm's pauldron lifts the sleeve).
 * Pure and deterministic. */
import { add, sub, scl, len, unit, r6 } from './body-relational-vec.js';
import { bodyField, limbField, crossing } from './body-relational-field.js';
import { BODY_BUILDS } from './body-relational-builds.js';
import { envelopePart } from './body-relational-envelope.js';

/** the field garments: a word's body parts, its cut down the limbs (a share of the segment's rings), its ease and group,
 * and its cloth: how much looser than the body its field blends, and its envelope (`reach`, `taut`, `along`, `soft`:
 * body-relational-envelope.js). The tee hangs from the chest (taut, 40 mm); a SKIN-FITTING shirt lies close (half again
 * looser, 2.5 mm out), over each ring's hollows and straight over any dip shorter than 9 cm along it (the grooves
 * between the muscles, the fold under the bust, the elbow's hollows), not from the chest to the hip, at most 45 mm off
 * by a soft cap */
const TOP = ['collar', 'shoulderTop', 'chest', 'breast', 'armpit', 'flank', 'abdomen', 'upperBack', 'back', 'lowerBack', 'shoulderCap', 'upperArm'];
const FITTED = { ease: 0.0025, looser: 1.5, reach: 0.045, taut: false, span: 0.09, along: 2, soft: true, group: 'Top' };
export const FIELD_GARMENTS = Object.freeze({
  tee: { covers: TOP, limit: { upperArm: 0.45 }, ease: 0.008, group: 'Top' },
  fittedTee: { covers: TOP, limit: { upperArm: 0.45 }, ...FITTED },
  fittedShirt: { covers: [...TOP, 'elbow', 'forearm', 'wrist'], limit: { foreArm: 0.92 }, ...FITTED },
});

const TRUNK = new Set(['torso', 'neck', 'pelvis']);

/** the parts of a garment `id` on the realistic body (`recipe`, sliced; `map`, its body-part map), as layer-1 parts named
 * `<id>_<segment>`: { parts } */
export function fieldGarment(recipe, R, build, map, { id, covers, limit = {}, ease = 0.008, looser = 3, group = 'Top', reach = 0.04, taut = true, span = 0, along = 2, soft = false }) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build, B1 = { ...B, kMuscle: B.kMuscle * looser, kLimb: B.kLimb * looser };
  const want = new Set(covers), arm = limbField(R, B1, 'upperArm');
  // the CLOTH FIELD: the body's own, blended looser (the shoulder's cap with it), eased out; a limb's the limb's
  const trunk = bodyField(R, B1, { extra: arm.prims.filter((p) => /^deltoid/.test(p.id)) });
  const cloth = (seg) => (TRUNK.has(seg) ? (q) => trunk.sd(q) - ease : ((L) => (q) => L.sd([Math.abs(q[0]), q[1], q[2]]) - ease)(limbField(R, B1, seg.replace(/[RL]$/, ''))));
  const parts = {};
  for (const [seg, P] of Object.entries(recipe.parts)) {
    if (P.layer !== 1 || !P.stations?.length || P.garment) continue;
    const base = seg.replace(/[RL]$/, '');
    // the rings the piece's parts mostly cover (of the points any part shows), in one run from the first to the last
    const covered = P.stations.map((st) => {
      const seen = P.slots.map((sl) => map.part[`${seg}/${st.id}.${sl}`]).filter((p) => p && p !== 'hidden');
      return seen.length > 0 && seen.filter((p) => want.has(p)).length >= seen.length / 2;
    });
    let i0 = covered.indexOf(true), i1 = covered.lastIndexOf(true); if (i0 < 0) continue;
    if (limit[base] !== undefined) i1 = Math.min(i1, Math.round(limit[base] * (P.stations.length - 1)));
    if (i1 - i0 < 1) continue;
    const sd = cloth(seg), stations = P.stations.slice(i0, i1 + 1).map((st) => {
      const c = scl(P.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / P.slots.length);
      return { ...st, points: Object.fromEntries(P.slots.map((sl) => {
        const p = st.points[sl], d = sub(p, c), hit = crossing(sd, c, unit(d), 2 * len(d) + 0.05);
        // (a ray that finds no cloth, the skin's point eased straight out)
        return [sl, (hit && len(sub(hit, c)) >= len(d) ? hit : add(p, scl(unit(d), ease))).map(r6)];
      })) };
    });
    // (its ends closed a third of their ring's radius on beyond it, along the piece, as the skin's are: in the ring's
    // own plane a cap's fan could face either way)
    const mid = (st) => scl(P.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / P.slots.length);
    const end = (st, nb) => { const c = mid(st), r = P.slots.reduce((a, sl) => a + len(sub(st.points[sl], c)), 0) / P.slots.length; return add(c, scl(unit(sub(c, mid(nb))), r / 3)).map(r6); };
    const ids = new Set(stations.map((s) => s.id)), blend = Object.fromEntries(Object.entries(P.bind?.blend || {}).filter(([k]) => ids.has(k.split('.')[0])));
    const piece = { layer: 1, closure: 'closed', garment: true, slots: P.slots, ...(P.slotT ? { slotT: P.slotT } : {}), stations, caps: { back: end(stations[0], stations[1]), tip: end(stations[stations.length - 1], stations[stations.length - 2]) }, group, bind: { ...P.bind, blend } };
    // (the tee's cloth taut along the piece, spanning deeper than the skin's envelope: from the bust's apex over the
    // fold under it, 2 to 3 cm; a fitted shirt's close)
    parts[`${id}_${seg}`] = envelopePart(piece, { reach, taut, along, ...(span ? { span } : {}), ...(soft ? { soft } : {}) });
  }
  return { parts };
}
