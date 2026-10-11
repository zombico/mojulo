/** tiered-form.js — the TIERED base form (`hero.form: 'tiered'`, opt-in): a figure whose triangles are spent where the
 * eye reads them, with detail added by tier rather than built at one fixed density.
 *
 * Its first piece is the CHEST. The structured hero's bust is two separate ring20 lens layers cut from the breast's
 * field (breast-field.js), each on its own bone: a quarter of a 5k figure on 3% of its surface, apart from the torso's
 * rings, so it neither deforms with the shoulder nor takes the torso's refinement, and set close (its apexes 1.2 bust
 * radii off the midline, the pair meeting in a filled valley: a supported, garment's shape). Here the SAME FIELD is
 * sampled onto the torso's own rings: every front slot of every ring through the chest takes the field's height at its
 * own place, so the form is smooth however coarse the rings, moves and refines with the torso, and costs only the rings
 * the chest band needs. Its placement is the unsupported chest's (the equilateral rule: the apexes about as far apart as
 * each is from the sternal notch), turned a little out, the pair meeting low at the sternum.
 *
 *   tieredChest(plan, size)   the plan with the field on its torso (size: the bust radius in metres; 0 none)
 *
 * The placement and the band's rings are starting points judged at the eyes gate (the character board) and read by the
 * chest critic (hero-style-critic.js chestCritic). */
import { SLOT_FAMILIES, ringPoints } from './station-loft-plan.js';
import { BREAST_FIELD, breastHeight } from './breast-field.js';

/** The field as the unsupported chest places it: the apex `cleft` bust radii off the midline (the equilateral rule
 * against the hero's notch), the inner reach running just past the midline with a fuller profile, so the pair meet low
 * at the sternum (a valley a quarter of the projection, inside the field's cleft gate: no flat strip between, no filled
 * cleavage); `splay` turns the outside out (dx per unit of height), so the pair point a little apart. The rest is the
 * field's own (its footprint, poles, fold). Of the field's gates, `meridian` reads 0.13 (the apex outward of the mound's
 * middle, as the unsupported breast's sits), past its ±0.06: the placement's, kept. */
export const TIERED_BREAST = Object.freeze({ ...BREAST_FIELD, cleft: -1.95, reach: Object.freeze({ ...BREAST_FIELD.reach, in: 2.4 }), profile: Object.freeze({ ...BREAST_FIELD.profile, in: 1.6 }) });
const SPLAY = 0.18;
/** The crease the tiered figure is shaded smoothly at: its body's own colour groups (the top and the bottom painted on
 * the body) blend like the skin (70°), so a form the field draws across the torso's rings reads as one form, not a ring
 * per band; every other group keeps the studio's (station-loft-shade.js STUDIO_SMOOTH_CREASE). */
export const TIERED_SMOOTH_CREASE = Object.freeze({ Skin: 70, $cloth: 70, Top: 70, Bottom: 70, default: 35 });
/** the apex's height under the chest ring (`st2`), in bust radii: the apex sits low, the lower pole the fuller */
const APEX_DROP = 0.55;
/** the rings the chest band gains (u on the torso's stations): enough to carry the fold, the lower pole and the apex */
const BAND = Object.freeze([1.25, 1.75, 2.25]);
/** the slots the field is sampled on (right-hand; the torso mirrors them) */
const SLOTS = Object.freeze(['front', 'frontR', 'frontSideR', 'sideR']);
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const lerp = (a, b, t) => a + (b - a) * t;
const lerpV = (a, b, t) => (Array.isArray(a) ? a.map((x, k) => r6(lerp(x, Array.isArray(b) ? b[k] : b, t))) : r6(lerp(a, b, t)));

/** A ring between two of the torso's: everything interpolated by u, named as the refine pass names the ring it inserts. */
function between(A, B, u) {
  const t = (u - A.u) / (B.u - A.u), ia = Math.floor(u), ib = ia + 1;
  const id = `st${ia}_st${ib}_${Math.round((u - ia) * 100)}`;
  const push = {}; for (const sl of new Set([...Object.keys(A.push || {}), ...Object.keys(B.push || {})])) push[sl] = lerpV(A.push?.[sl] ?? [0, 0, 0], B.push?.[sl] ?? [0, 0, 0], t);
  return { id, u, z: r6(lerp(A.z, B.z, t)), r: lerpV(A.r, B.r, t), ...(A.yc != null || B.yc != null ? { yc: r6(lerp(A.yc ?? 0, B.yc ?? 0, t)) } : {}), ...(A.e != null || B.e != null ? { e: r6(lerp(A.e ?? 2, B.e ?? 2, t)) } : {}), ...(Object.keys(push).length ? { push } : {}) };
}

/** The plan with the breast's field on its torso; no torso, a torso of another ring family, or size 0 ⇒ the plan as it was. */
export function tieredChest(plan, size) {
  if (!(size > 0)) return plan;
  const torso = plan.segments?.find((s) => s.name === 'torso');
  if (!torso || torso.slots !== 'ring12') return plan;
  const S0 = [...torso.stations].sort((a, b) => a.u - b.u), chest = S0.find((s) => s.id === 'st2');
  if (!chest || S0.some((s) => s.u == null)) return plan;
  // the band's rings, where the torso has none
  const stations = [...S0];
  for (const u of BAND) {
    if (stations.some((s) => Math.abs(s.u - u) < 1e-9)) continue;
    const i = stations.findIndex((s) => s.u > u); if (i <= 0) continue;
    stations.splice(i, 0, between(stations[i - 1], stations[i], u));
  }
  // the field: its apex off the midline and under the chest ring; each ring's slots take its height at their own place,
  // forward, the outside turned out by the splay
  const F = TIERED_BREAST, SF = SLOT_FAMILIES.ring12, e0 = plan.style?.e ?? 2;
  const cx = -F.cleft * size, za = chest.z - APEX_DROP * size;
  const lifted = stations.map((st) => {
    const P = ringPoints([0, st.yc ?? 0, st.z], [0, 0, 1], st.r, SF, st.e ?? e0);
    const push = { ...(st.push || {}) }; let any = false;
    for (const sl of SLOTS) {
      const x = P[sl][0] + (push[sl]?.[0] ?? 0), h = size * breastHeight((x - cx) / size, (st.z - za) / size, F);
      if (!(h > 1e-5)) continue;
      const p = push[sl] || [0, 0, 0]; push[sl] = [r6(p[0] + (sl === 'front' ? 0 : SPLAY * h)), r6(p[1] + h), p[2]]; any = true;
    }
    return any ? { ...st, push } : st;
  });
  return { ...plan, segments: plan.segments.map((s) => (s === torso ? { ...torso, stations: lifted } : s)) };
}
