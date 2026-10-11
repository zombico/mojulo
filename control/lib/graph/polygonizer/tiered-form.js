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
 *   tieredJoints(plan)        the plan with a BRIDGE over the elbows and the knees
 *
 * The second piece is the JOINT. A limb's two segments each run past their joint and cross there, each on its own
 * bone: bent, the two tubes scissor (the outside of the knee a beak, the elbow two crossed sticks) and even straight
 * their seam is a saw. Here each segment stops short of its joint (BRIDGE_REACH of its radius) on a flat end, and a
 * BRIDGE spans the gap: rings matched slot to slot with the two ends (the same points, so no seam opens), each
 * weighted along the run from the upper bone through the joint's fold (the helper the structured core already turns
 * half the bend and pushes to the outside) to the lower bone. One surface, deterministic, bending as a sleeve does.
 *
 * The placement and the band's rings are starting points judged at the eyes gate (the character board) and read by the
 * chest critic (hero-style-critic.js chestCritic). */
import { SLOT_FAMILIES, ringPoints, segmentPart, loftPart } from './station-loft-plan.js';
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

// ─── the joints ─────────────────────────────────────────────────────────────
/** The bridged joints (right-hand; the left mirrors by name): the bridge's part, the two limb parts and the fold. */
export const TIERED_JOINTS = Object.freeze([
  Object.freeze({ bridge: 'elbowBridgeR', upper: 'upperArmR', lower: 'foreArmR', fold: 'elbowFoldR' }),
  Object.freeze({ bridge: 'kneeBridgeR', upper: 'thighR', lower: 'shankR', fold: 'kneeFoldR' }),
]);
/** how far each segment stops short of its joint, in its end ring's radii */
export const BRIDGE_REACH = 0.6;
/** the bridge's inner rings along the run (0 the upper end, 1 the lower) and each one's weights: upper, fold, lower */
const BRIDGE_RUN = Object.freeze([[0.25, [0.5, 0.5, 0]], [0.5, [0, 1, 0]], [0.75, [0, 0.5, 0.5]]]);
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit3 = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const tmpl = (n) => n.replace(/R$/, '$S');
const twins = (n) => [n, n.replace(/R$/, 'L')];

/** A segment's or a loft's rings and caps as the plan expands them (station-loft-plan.js expandPlan), unrounded. */
function partRings(plan, seg) {
  const families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) }, style = { slots: 'ring8', limbSlots: 'limb6', e: 2, ...(plan.style || {}) };
  const slots = seg.slots == null ? families[style.limbSlots] : typeof seg.slots === 'string' ? families[seg.slots] : seg.slots, e = seg.e ?? style.e;
  if (seg.kind === 'loft') return loftPart(seg.stations, seg.caps, slots, e, { keep: seg.frame === 'keep' });
  const J = plan.joints;
  return segmentPart(J[seg.from], J[seg.to], seg.rA, seg.rB, { slots, e, over: seg.over, mid: seg.mid, rMid: seg.rMid, ...(seg.cap ? { cap: seg.cap } : {}), ...(seg.shape ? { shape: seg.shape } : {}) });
}
/** the id of a limb's last ring: a segment's st2, a loft's last integer station */
const seamId = (seg) => (seg.kind === 'loft' ? `st${seg.stations.filter((st) => st.u === undefined || Number.isInteger(st.u)).length - 1}` : 'st2');
const familyOf = (plan, seg) => seg.slots ?? (seg.kind === 'loft' ? plan.style?.slots ?? 'ring8' : plan.style?.limbSlots ?? 'limb6');

/** A segment's bind as a blend (its { bone, prev, next } shorthand resolved), copied. */
function blendOf(seg) {
  const b = seg.bind;
  if (b?.blend) return { ...b, blend: { ...b.blend } };
  const blend = {};
  if (b?.prev) Object.assign(blend, { back: { [b.prev]: 1 }, st0: { [b.prev]: 0.5, [b.bone]: 0.5 } });
  if (b?.next) Object.assign(blend, { st2: { [b.bone]: 0.5, [b.next]: 0.5 }, tip: { [b.next]: 1 } });
  return { bone: b.bone, blend };
}

/** The plan with its elbows and knees bridged; a joint whose parts are missing, or not a segment or a loft, as it was. */
export function tieredJoints(plan) {
  let segments = plan.segments.map((s) => ({ ...s }));
  const byName = (n) => segments.find((s) => s.name === n);
  const folds = plan.rig?.folds || {}, added = [];
  for (const J of TIERED_JOINTS) {
    const U = byName(J.upper), D = byName(J.lower);
    if (!U || !D || !['segment', 'loft'].includes(U.kind) || D.kind !== 'segment') continue;
    // the lower segment in the upper's ring family, so the rings match slot to slot
    const fam = familyOf(plan, U); if (familyOf(plan, D) !== fam) D.slots = fam;
    // each stops short of the joint on a flat end
    if (U.kind === 'segment') { U.over = [U.over?.[0] ?? 0.6, -BRIDGE_REACH]; U.cap = [U.cap?.[0] ?? 0.45, 0]; }
    else {
      const S = U.stations.map((s) => ({ ...s })), last = S[S.length - 1], prev = S[S.length - 2], d = unit3(sub3(last.at, prev.at));
      const at = plan.joints[D.from].map((x, k) => r6(x - d[k] * BRIDGE_REACH * rad(last.r)));
      S[S.length - 1] = { ...last, at }; U.stations = S; U.caps = { ...U.caps, tip: at };
    }
    D.over = [-BRIDGE_REACH, D.over?.[1] ?? 0.6]; D.cap = [0, D.cap?.[1] ?? 0.45];
    // their end rings their own bones'
    const ub = blendOf(U), db = blendOf(D), across = (blend, other) => { for (const [k, x] of Object.entries(blend)) if (x[J.fold] || x[other]) delete blend[k]; };
    across(ub.blend, J.lower); across(db.blend, J.upper); U.bind = ub; D.bind = db;
    // the bridge: the upper's last ring to the lower's first, the rings between interpolated slot by slot
    const A = partRings(plan, U), B = partRings(plan, D), a = A.stations[A.stations.length - 1].points, b = B.stations[0].points;
    const slots = Object.keys(a), fold = folds[tmpl(J.fold)] ? J.fold : null;
    const w = ([u, f, l]) => { const o = {}; if (u + (fold ? 0 : f / 2) > 0) o[J.upper] = u + (fold ? 0 : f / 2); if (fold && f > 0) o[fold] = f; if (l + (fold ? 0 : f / 2) > 0) o[J.lower] = l + (fold ? 0 : f / 2); return o; };
    const rings = [a, ...BRIDGE_RUN.map(([t]) => Object.fromEntries(slots.map((sl) => [sl, a[sl].map((x, k) => r6(x + (b[sl][k] - x) * t))]))), b];
    added.push({ name: J.bridge, kind: 'rings', slots: fam, stations: rings.map((pts, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, pts[sl].map(r6)])) })),
      caps: { back: A.caps.tip.map(r6), tip: B.caps.back.map(r6) }, group: U.group, mirror: 'name',
      bind: { bone: fold ?? J.upper, blend: { back: { [J.upper]: 1 }, st0: { [J.upper]: 1 }, ...Object.fromEntries(BRIDGE_RUN.map(([, ws], i) => [`st${i + 1}`, w(ws)])), [`st${rings.length - 1}`]: { [J.lower]: 1 }, tip: { [J.lower]: 1 } } } });
  }
  if (!added.length) return plan;
  // each bridge after its lower part; it takes every dial and every split (slots refined) its limb takes
  for (const g of added) { const J = TIERED_JOINTS.find((x) => x.bridge === g.name), i = segments.findIndex((s) => s.name === J.lower); segments.splice(i + 1, 0, g); }
  const limbOf = new Map(TIERED_JOINTS.flatMap((J) => [J.upper, J.lower].flatMap((p) => [[tmpl(p), tmpl(J.bridge)], ...twins(p).map((n, k) => [n, twins(J.bridge)[k]])])));
  const withBridges = (parts) => { const out = [...parts]; for (const p of parts) { const br = limbOf.get(p); if (br && added.some((g) => tmpl(g.name) === br.replace(/[RL]$/, '$S')) && !out.includes(br)) out.push(br); } return out; };
  const dials = plan.dials && Object.fromEntries(Object.entries(plan.dials).map(([k, d]) => [k, Array.isArray(d.parts) ? { ...d, parts: withBridges(d.parts) } : d]));
  const refine = plan.body?.refine?.map((e) => (e.slots !== false && Array.isArray(e.parts) ? { ...e, parts: withBridges(e.parts) } : e));
  // a volume (the dress's calf, its quadriceps) leaves a limb's ring at the bridge where it is, so the seam stays shut
  const seamOf = new Map(TIERED_JOINTS.filter((J) => added.some((g) => g.name === J.bridge)).flatMap((J) => [J.upper, J.lower].flatMap((p) => twins(p).map((n) => [n, p === J.lower ? 'st0' : seamId(segments.find((x) => x.name === J.upper))]))));
  const volume = plan.body?.volume?.map((v) => { const st = seamOf.get(v[0]); if (!st || !(st in (v[2] || {}))) return v; const { [st]: _gone, ...rest } = v[2]; return [v[0], v[1], rest, ...v.slice(3)]; });
  const body = refine || volume ? { body: { ...plan.body, ...(refine ? { refine } : {}), ...(volume ? { volume } : {}) } } : {};
  return { ...plan, segments, ...(dials ? { dials } : {}), ...body };
}
