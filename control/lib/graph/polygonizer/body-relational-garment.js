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
import { smin } from './vajra.js';

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
  // (TROUSERS: the seat from where the pelvis's rings start to rise, so it closes over the crotch by its cap instead of
  // copying the floor the pelvis's lowest rings lay flat at the crotch; the trunk's cloth takes the thighs in, so the
  // seat wraps their tops, and the legs' tops tuck under the seat)
  // (their cloth the skin-fitting shirt's, so a shirt and trousers read at one thickness)
  // (and on the pelvis up to the waist, over the crest: `on` keeps the abdomen's and the back's names to the pelvis)
  trousers: { covers: ['hip', 'groin', 'seat', 'thigh', 'knee', 'shin', 'calf', 'abdomen', 'lowerBack', 'flank'], on: ['pelvis', 'thigh', 'shank'], limit: { shank: 0.94 }, ...FITTED, floor: true, join: 'thigh', group: 'Bottom' },
});

const TRUNK = new Set(['torso', 'neck', 'pelvis']);

/** the parts of a garment `id` on the realistic body (`recipe`, sliced; `map`, its body-part map), as layer-1 parts named
 * `<id>_<segment>`: { parts } */
/** how near a limb a piece worn `under` it lies on the skin (m): the band its edge eases down over */
export const UNDER_BAND = 0.025;

export function fieldGarment(recipe, R, build, map, { id, covers, limit = {}, ease = 0.008, looser = 3, group = 'Top', reach = 0.04, taut = true, span = 0, along = 2, soft = false, floor = false, join = null, on = null, window = null, stand = null, shoulders = true, under = null }) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build, B1 = { ...B, kMuscle: B.kMuscle * looser, kLimb: B.kLimb * looser };
  // (`covers` null: every ring of the segments `on` names, a boot over the whole foot)
  const want = covers ? new Set(covers) : null, arm = limbField(R, B1, 'upperArm');
  // the CLOTH FIELD: the body's own, blended looser (the shoulder's cap with it, unless `shoulders` is false: a plate that
  // ends inboard of the shoulder, the pauldron's), eased out; a limb's the limb's
  const trunk = bodyField(R, B1, { extra: shoulders ? arm.prims.filter((p) => /^deltoid/.test(p.id)) : [] });
  // (`join`: a limb taken into the trunk's cloth, both sides, so a trunk piece wraps the limb's top)
  const J = join ? limbField(R, B1, join) : null, trunkSd = J ? (q) => smin(trunk.sd(q), J.sd([Math.abs(q[0]), q[1], q[2]]), B1.kMuscle) : (q) => trunk.sd(q);
  const cloth = (seg) => (TRUNK.has(seg) ? (q) => trunkSd(q) - ease : ((L) => (q) => L.sd([Math.abs(q[0]), q[1], q[2]]) - ease)(limbField(R, B1, seg.replace(/[RL]$/, ''))));
  // (`under`: a limb the piece is worn under, its field the body's own, not loosened: where the piece comes within
  // `UNDER_BAND` of it, the piece lies on the skin at its own clearance, eased from where it stands, so the limb passes
  // over the piece's edge, never out of it: a breastplate's armhole under the arm and the shoulder's ball)
  const U = under ? limbField(R, B, under) : null, onSkin = U ? (q) => { const t = Math.max(0, Math.min(1, U.sd([Math.abs(q[0]), q[1], q[2]]) / UNDER_BAND)); return 1 - t * t * (3 - 2 * t); } : null;
  const parts = {};
  for (const [seg, P] of Object.entries(recipe.parts)) {
    if (P.layer !== 1 || !P.stations?.length || P.garment) continue;
    const base = seg.replace(/[RL]$/, '');
    if (on && !on.includes(base)) continue;
    // the rings the piece's parts mostly cover (of the points any part shows), in one run from the first to the last
    const covered = !want ? P.stations.map(() => true) : P.stations.map((st) => {
      const seen = P.slots.map((sl) => map.part[`${seg}/${st.id}.${sl}`]).filter((p) => p && p !== 'hidden');
      return seen.length > 0 && seen.filter((p) => want.has(p)).length >= seen.length / 2;
    });
    let i0 = covered.indexOf(true), i1 = covered.lastIndexOf(true); if (i0 < 0) continue;
    if (limit[base] !== undefined) i1 = Math.min(i1, Math.round(limit[base] * (P.stations.length - 1)));
    // (`window`: { <segment>: [u0, u1] }, the rings between two of the segment's stations by their `u`: an armour's
    // window, which its style sets)
    if (window?.[base]) { const [u0, u1] = window[base], U = P.stations.map((st, i) => st.u ?? i); i0 = Math.max(i0, U.findIndex((u) => u >= u0 - 1e-9)); i1 = Math.min(i1, U.findLastIndex((u) => u <= u1 + 1e-9)); }
    // (`floor`: a trunk piece starts where its rings rise, past those lying flat, widening at one height: a band of
    // cloth laid flat has no outside to wind by)
    if (floor && TRUNK.has(seg)) {
      const at = (st) => { const c = scl(P.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / P.slots.length); return { z: c[2], r: P.slots.reduce((a, sl) => a + len(sub(st.points[sl], c)), 0) / P.slots.length }; };
      while (i0 < i1 - 1) { const a = at(P.stations[i0]), b = at(P.stations[i0 + 1]); if (Math.abs(b.z - a.z) >= 0.5 * Math.abs(b.r - a.r)) break; i0++; }
    }
    if (i1 - i0 < 1) continue;
    const sd = cloth(seg), stations = P.stations.slice(i0, i1 + 1).map((st) => {
      const c = scl(P.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / P.slots.length);
      return { ...st, points: Object.fromEntries(P.slots.map((sl) => {
        const p = st.points[sl], d = sub(p, c), hit = crossing(sd, c, unit(d), 2 * len(d) + 0.05);
        // (a ray that finds no cloth, the skin's point eased straight out; with `stand`, a cloth point farther than that past
        // the skin held there: at the armpit the trunk's field runs on out over the arm the deltoid is blended with, and
        // a garment's side ends at the armpit, the sleeve over the arm)
        const q = hit && len(sub(hit, c)) >= len(d) ? hit : add(p, scl(unit(d), ease));
        return [sl, (stand !== null && len(sub(q, c)) > len(d) + stand ? add(p, scl(unit(d), stand)) : q).map(r6)];
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
    const made = envelopePart(piece, { reach, taut, along, ...(span ? { span } : {}), ...(soft ? { soft } : {}) });
    // (worn `under` a limb: by it, the piece eased down onto the skin at its clearance, after the envelope's lift)
    if (onSkin) made.stations = made.stations.map((st) => {
      const S = P.stations.find((s0) => s0.id === st.id); if (!S) return st;
      const c = scl(P.slots.reduce((a, sl) => add(a, S.points[sl]), [0, 0, 0]), 1 / P.slots.length);
      return { ...st, points: Object.fromEntries(Object.entries(st.points).map(([sl, q]) => {
        const p = S.points[sl], w = p ? onSkin(q) : 0; if (!(w > 0)) return [sl, q];
        const hug = add(p, scl(unit(sub(p, c)), ease));
        return [sl, add(scl(q, 1 - w), scl(hug, w)).map(r6)];
      })) };
    });
    parts[`${id}_${seg}`] = made;
  }
  // THE HANDOVER (`join`): the trunk's piece and the joined limb's cross a few centimetres over the level the trunk's
  // first ring closes at (the seat's lowest ring over the thighs' tops): under it the trunk's piece is let down under the
  // limb's, over it the limb's under the trunk's, each point drawn in toward its ring's middle (no lip at the seat's edge)
  const over = join && Object.entries(parts).find(([k]) => TRUNK.has(k.slice(id.length + 1)));
  if (over) {
    const st0 = over[1].stations[0], z0 = Object.values(st0.points).reduce((a, p) => a + p[2], 0) / over[1].slots.length;
    const ease3 = (x) => { const w = Math.max(0, Math.min(1, x)); return w * w * (3 - 2 * w); };
    const letDown = (G, by) => G.stations.map((st) => {
      const c = scl(G.slots.reduce((a, sl) => add(a, st.points[sl]), [0, 0, 0]), 1 / G.slots.length);
      return { ...st, points: Object.fromEntries(G.slots.map((sl) => { const p = st.points[sl], s = by(p[2] - z0); return [sl, (s > 0 ? add(p, scl(unit(sub(c, p)), s)) : p).map(r6)]; })) };
    });
    over[1].stations = letDown(over[1], (h) => 0.005 * (1 - ease3(h / 0.04)));
    for (const [k, G] of Object.entries(parts)) if (k.slice(id.length + 1).replace(/[RL]$/, '') === join) G.stations = letDown(G, (h) => 0.004 * ease3((h - 0.02) / 0.03));
  }
  return { parts };
}
