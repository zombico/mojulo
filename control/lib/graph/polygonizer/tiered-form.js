/** tiered-form.js — the TIERED base form (`hero.form: 'tiered'`, the game body: stamped at mint when a hero names no form): a figure whose triangles are spent where the
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
 *   tieredJoints(plan)        the plan with a BRIDGE over the elbows, the knees and the wrists
 *   tieredSockets(plan)       the plan with the shoulders and the hips turning their limb's root through a fold
 *   tieredGarments(plan)      the plan's garments over its bridges, and split wherever their body part is split
 *   tieredKit(kit, plan, { laws })  an adornment kit over the joints: a piece over a joint rides its bridge, a pauldron its
 *                                   ball, a trunk plate keeps off the shoulder (laws 18)
 *   TIERED_FACE[pole]         the landmark head's defaults by sex: face words, hair, features (humanoid-head.js)
 *   TIERED_FACE_SMOOTH        the landmark head's normals blended toward its ellipsoid
 *   TIERED_FACE_TINT[pole]    the head skin's occlusion and blush (face-tint.js); tieredPole(hero) the head's sex
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
import { SLOT_FAMILIES, ringPoints, segmentPart, loftPart, trunkPart } from './station-loft-plan.js';
import { BREAST_FIELD, breastHeight } from './breast-field.js';
import { castOf } from './hero-form.js';
import { heroTarget } from '../era/cast-light.js';
import { readTarget } from '../era/target.js';
import { tierOf, DENSE_TIERS } from '../era/cast-spend.js';
import { STUDIO_SMOOTH_CREASE } from './station-loft-shade.js';
import { childRound } from './anime-looks.js';

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
/** THE CHILD'S SHADING (hero laws 14, the child form; hero-form.js CHILD_FORM): read as round. Its body and its clothes
 * blend across `crease` (wider than the tiered crease, so a ring's or a seam's facet never reads as a fold), and its
 * anime face leans `face` of the way toward the head's capsule (the proxy's floor, 0.5 on any other face), so the cheeks
 * and the jaw take the light as one round form, facet lines and all. */
export const CHILD_SHADE = Object.freeze({ crease: Object.freeze({ Skin: 85, $cloth: 85, Top: 85, Bottom: 85, Shoes: 85, default: 35 }), face: 0.85 });
/** the apex's height under the chest ring (`st2`), in bust radii: the apex sits low, the lower pole the fuller */
const APEX_DROP = 0.55;
/** the rings the chest band gains (u on the torso's stations): enough to carry the fold, the lower pole and the apex */
const BAND = Object.freeze([1.25, 1.75, 2.25]);
/** the slots the field is sampled on (right-hand; the torso mirrors them) */
const SLOTS = Object.freeze(['front', 'frontR', 'frontSideR', 'sideR']);
const r6 = (v) => Math.round(v * 1e6) / 1e6 + 0;   // (+ 0: a −0 is 0, as a stored plan reads it back)
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
/** The bridged joints (right-hand; the left mirrors by name): the bridge's part, the two limb parts, the fold (null: the
 * joint has none, the bridge's middle ring is the two bones' halves) and how far each limb stops short of the joint, in
 * its end ring's radii. The wrist's span is longer: the hand turns through its whole run. */
export const TIERED_JOINTS = Object.freeze([
  Object.freeze({ bridge: 'elbowBridgeR', upper: 'upperArmR', lower: 'foreArmR', fold: 'elbowFoldR', reach: 0.6 }),
  Object.freeze({ bridge: 'kneeBridgeR', upper: 'thighR', lower: 'shankR', fold: 'kneeFoldR', reach: 0.6 }),
  Object.freeze({ bridge: 'wristBridgeR', upper: 'foreArmR', lower: 'handR', fold: null, reach: 1.2 }),
]);
/** the bridge's inner rings along the run (0 the upper end, 1 the lower) and each one's weights: upper, fold, lower */
const BRIDGE_RUN = Object.freeze([[0.25, [0.5, 0.5, 0]], [0.5, [0, 1, 0]], [0.75, [0, 0.5, 0.5]]]);
const rad = (r) => (Array.isArray(r) ? Math.max(...r) : r);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const unit3 = (a) => { const l = Math.hypot(...a); return a.map((x) => x / l); };
const tmpl = (n) => n.replace(/[RL]$/, '$S');
const twins = (n) => [n, n.replace(/R$/, 'L')];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };

/** A part's rings and caps as the plan expands them (station-loft-plan.js expandPlan), unrounded; a rings part's its own. */
function partRings(plan, seg) {
  if (seg.kind === 'rings') return { stations: seg.stations, caps: seg.caps };
  const families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) }, style = { slots: 'ring8', limbSlots: 'limb6', e: 2, ...(plan.style || {}) };
  const slots = seg.slots == null ? families[style.limbSlots] : typeof seg.slots === 'string' ? families[seg.slots] : seg.slots, e = seg.e ?? style.e;
  if (seg.kind === 'loft') return loftPart(seg.stations, seg.caps, slots, e, { keep: seg.frame === 'keep' });
  if (seg.kind === 'trunk') { const f = seg.slots ?? style.slots, fam = typeof f === 'string' ? families[f] : f; return trunkPart(seg.stations, seg.caps, fam, e); }
  const J = plan.joints;
  return segmentPart(J[seg.from], J[seg.to], seg.rA, seg.rB, { slots, e, over: seg.over, mid: seg.mid, rMid: seg.rMid, ...(seg.cap ? { cap: seg.cap } : {}), ...(seg.shape ? { shape: seg.shape } : {}) });
}
const familyOf = (plan, seg) => seg.slots ?? (seg.kind === 'segment' ? plan.style?.limbSlots ?? 'limb6' : plan.style?.slots ?? 'ring8');
/** the id of a limb's last ring: a segment's st2, a loft's or a rings part's last integer station */
const seamId = (seg) => (seg.kind === 'segment' ? 'st2' : seg.stations[seg.stations.length - 1].id ?? `st${seg.stations.filter((st) => st.u === undefined || Number.isInteger(st.u)).length - 1}`);

/** A segment with new overshoots, its shaping rings kept at their addresses: each slides within its span as the span
 * moves, so a cuff or a wrap named at `st1_st2_50` still finds its ring. */
function overshoot(plan, seg, over) {
  if (!seg.shape?.length) return { ...seg, over };
  const J = plan.joints, L = Math.hypot(...sub3(J[seg.to], J[seg.from])), mid = seg.mid ?? 0.5;
  const T = (o) => [-o[0] * rad(seg.rA), mid * L, L + o[1] * rad(seg.rB)], T0 = T(seg.over ?? [0.6, 0.6]), T1 = T(over);
  const shape = seg.shape.map((sh) => { const t = sh.at * L, i = t < T0[1] ? 0 : 1, f = (t - T0[i]) / (T0[i + 1] - T0[i]); return { ...sh, at: r6((T1[i] + f * (T1[i + 1] - T1[i])) / L) }; });
  return { ...seg, over, shape };
}

/** A segment's bind as a blend (its { bone, prev, next } shorthand resolved), copied. */
function blendOf(seg) {
  const b = seg.bind;
  if (b?.blend) return { ...b, blend: { ...b.blend } };
  const blend = {};
  if (b?.prev) Object.assign(blend, { back: { [b.prev]: 1 }, st0: { [b.prev]: 0.5, [b.bone]: 0.5 } });
  if (b?.next) Object.assign(blend, { st2: { [b.bone]: 0.5, [b.next]: 0.5 }, tip: { [b.next]: 1 } });
  return { bone: b.bone, blend };
}

/** The lower ring's slot for each of the upper's: the turn (and the sense) round the ring that lines their points up
 * best, so a ring framed from the back of the hand meets one framed from the front of the arm. Same names when they line
 * up (the elbow, the knee). */
function slotMap(a, b, family) {
  const ca = centre(a), cb = centre(b), n = family.length, dir = (p, c) => unit3(sub3(p, c));
  const A = family.map((sl) => dir(a[sl], ca)), B = family.map((sl) => dir(b[sl], cb));
  let best = null;
  for (const sense of [1, -1]) for (let k = 0; k < n; k++) {
    let cost = 0; for (let i = 0; i < n; i++) { const j = (((k + sense * i) % n) + n) % n; cost += A[i].reduce((t, x, q) => t + (x - B[j][q]) ** 2, 0); }
    if (!best || cost < best.cost - 1e-9) best = { cost, k, sense };
  }
  return Object.fromEntries(family.map((sl, i) => [sl, family[(((best.k + best.sense * i) % n) + n) % n]]));
}

/** The limb chains the bridges join (elbow and wrist: the arm; the knee: the leg), each a list of right-hand part names. */
function chainsOf(joints) {
  const of = new Map();
  for (const J of joints) { const c = [...new Set([...(of.get(J.upper) ?? [J.upper]), ...(of.get(J.lower) ?? [J.lower]), J.bridge])]; for (const p of c) of.set(p, c); }
  return of;
}
/** The bridged joints a plan carries, and each part's chain (right-hand names); cast-density.js splits a chain as one.
 * `list`: the joints to look for (the hero's by default; a creature's from its own chains, creature-drawn.js). */
export function bridgedChains(plan, list = TIERED_JOINTS) {
  const names = new Set((plan.segments || []).map((s) => s.name)), of = chainsOf(list.filter((J) => names.has(J.bridge)));
  // (a shoulder web ends on its arm's ring: it splits with the arm's chain, or it would end on half the arm's points)
  // (the cone ends on its web's ring: it splits with them)
  for (const n of names) { if (!/^shoulder(Web|Cone)R$/.test(n)) continue; const arm = of.get('upperArmR'); if (arm && !arm.includes(n)) { arm.push(n); of.set(n, arm); } }
  return of;
}

/** The plan with its elbows, knees and wrists bridged; a joint whose parts are missing or of a kind it cannot meet, as it was.
 * `list`: the joints (TIERED_JOINTS, the hero's; a creature's own, creature-drawn.js creatureJoints). */
export function tieredJoints(plan, list = TIERED_JOINTS, { respace = false } = {}) {
  const segments = plan.segments.map((s) => ({ ...s, ...(s.stations ? { stations: s.stations.map((st) => ({ ...st })) } : {}) }));
  const byName = (n) => segments.find((s) => s.name === n);
  const folds = plan.rig?.folds || {}, families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) };
  const joints = list.filter((J) => { const U = byName(J.upper), D = byName(J.lower); return U && D && ['segment', 'loft'].includes(U.kind) && ['segment', 'rings'].includes(D.kind); });
  if (!joints.length) return plan;
  // one ring family per chain: a part given point by point (the palm) or a loft (the thigh) sets it; the segments take it
  for (const chain of new Set(chainsOf(joints).values())) {
    const parts = chain.map(byName).filter(Boolean), fixed = parts.find((g) => g.kind !== 'segment'), fam = familyOf(plan, fixed ?? parts[0]);
    for (const g of parts) if (g.kind === 'segment' && familyOf(plan, g) !== fam) g.slots = fam;
  }
  const added = [];
  for (const J of joints) {
    const U = byName(J.upper), D = byName(J.lower), fam = familyOf(plan, U);
    // each stops short of the joint on a flat end (a part given point by point keeps its rings, its back cap flat)
    if (U.kind === 'segment') { Object.assign(U, overshoot(plan, U, [U.over?.[0] ?? 0.6, -J.reach])); U.cap = [U.cap?.[0] ?? 0.45, 0]; }
    else {
      const S = U.stations, last = S[S.length - 1], prev = S[S.length - 2], d = unit3(sub3(last.at, prev.at));
      const at = plan.joints[D.from ?? J.lower.replace(/R$/, '')].map((x, k) => r6(x - d[k] * J.reach * rad(last.r)));
      // (`respace`, hero laws 7: the shaping rings past the last whole station move with the end by their share of the
      // run, so the end's last span keeps its length; laws 1 to 6 left them, and a short limb's last span, the knee's
      // under a poleyn, closed to a centimetre)
      if (respace) {
        const uOf = (i) => S[i].u ?? S.slice(0, i).filter((x) => x.u === undefined).length, n = S.length - 1, shift = sub3(at, last.at);
        let k = n - 1; while (k > 0 && S[k].u !== undefined && !Number.isInteger(S[k].u)) k--;
        for (let j = k + 1; j < n; j++) { const f = (uOf(j) - uOf(k)) / (uOf(n) - uOf(k)); S[j] = { ...S[j], at: S[j].at.map((x, q) => r6(x + shift[q] * f)) }; }
      }
      S[S.length - 1] = { ...last, at }; U.caps = { ...U.caps, tip: at };
    }
    if (D.kind === 'segment') { Object.assign(D, overshoot(plan, D, [-J.reach, D.over?.[1] ?? 0.6])); D.cap = [0, D.cap?.[1] ?? 0.45]; }
    else D.caps = { ...D.caps, back: centre(D.stations[0].points).map(r6) };
    // their end rings their own bones'
    const ub = blendOf(U), db = blendOf(D), across = (blend, other) => { for (const [k, x] of Object.entries(blend)) if ((J.fold && x[J.fold]) || x[other]) delete blend[k]; };
    across(ub.blend, J.lower); across(db.blend, J.upper); U.bind = ub; D.bind = db;
    // the bridge: the upper's last ring to the lower's first (its slots turned to line up), the rings between interpolated
    const A = partRings(plan, U), B = partRings(plan, D), a = A.stations[A.stations.length - 1].points, b0 = B.stations[0].points;
    const slots = typeof fam === 'string' ? families[fam] : fam, turn = slotMap(a, b0, slots), b = Object.fromEntries(slots.map((sl) => [sl, b0[turn[sl]]]));
    const fold = J.fold && folds[tmpl(J.fold)] ? J.fold : null;
    const w = ([u, f, l]) => { const o = {}; if (u + (fold ? 0 : f / 2) > 0) o[J.upper] = u + (fold ? 0 : f / 2); if (fold && f > 0) o[fold] = f; if (l + (fold ? 0 : f / 2) > 0) o[J.lower] = l + (fold ? 0 : f / 2); return o; };
    const rings = [a, ...BRIDGE_RUN.map(([t]) => Object.fromEntries(slots.map((sl) => [sl, a[sl].map((x, k) => x + (b[sl][k] - x) * t)]))), b];
    added.push({ name: J.bridge, kind: 'rings', slots: fam, stations: rings.map((pts, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, pts[sl].map(r6)])) })),
      caps: { back: (U.kind === 'segment' ? A.caps.tip : U.caps.tip).map(r6), tip: (D.kind === 'segment' ? B.caps.back : D.caps.back).map(r6) }, group: U.group, mirror: 'name',
      bind: { bone: fold ?? J.upper, blend: { back: { [J.upper]: 1 }, st0: { [J.upper]: 1 }, ...Object.fromEntries(BRIDGE_RUN.map(([, ws], i) => [`st${i + 1}`, w(ws)])), [`st${rings.length - 1}`]: { [J.lower]: 1 }, tip: { [J.lower]: 1 } } } });
  }
  // each bridge after its lower part
  for (const g of added) { const J = list.find((x) => x.bridge === g.name), i = segments.findIndex((s) => s.name === J.lower); segments.splice(i + 1, 0, g); }
  // a bridge takes every dial its limbs take; a split (slots refined) takes the whole chain, so its seams stay shut
  const chains = chainsOf(joints), sideOf = (n) => (n.endsWith('$S') ? '$S' : n.endsWith('L') ? 'L' : 'R'), asSide = (r, S) => r.replace(/R$/, S);
  const withChain = (parts, all) => { const out = [...parts]; for (const p of parts) { const S = sideOf(p), r = p.replace(/(\$S|[RL])$/, 'R'), c = chains.get(r); if (!c) continue;
    for (const q of all ? c : c.filter((x) => added.some((g) => g.name === x))) { const n = asSide(q, S); if (!out.includes(n)) out.push(n); } } return out; };
  const withBridges = (parts) => { const out = [...parts]; for (const p of parts) { const S = sideOf(p), r = p.replace(/(\$S|[RL])$/, 'R');
    for (const J of joints) if (J.upper === r || J.lower === r) { const n = asSide(J.bridge, S); if (!out.includes(n)) out.push(n); } } return out; };
  const dials = plan.dials && Object.fromEntries(Object.entries(plan.dials).map(([k, d]) => [k, Array.isArray(d.parts) ? { ...d, parts: withBridges(d.parts) } : d]));
  const refine = plan.body?.refine?.map((e) => (e.slots !== false && Array.isArray(e.parts) ? { ...e, parts: withChain(e.parts, true) } : e));
  // a volume (the dress's calf, its quadriceps) leaves a limb's ring at a bridge where it is, so the seam stays shut
  const seamOf = new Map(joints.flatMap((J) => [...twins(J.lower).map((n) => [n, ['st0']]), ...twins(J.upper).map((n) => [n, [seamId(byName(J.upper))]])]));
  const volume = plan.body?.volume?.map((v) => { const keep = Object.fromEntries(Object.entries(v[2] || {}).filter(([st]) => !(seamOf.get(v[0]) || []).includes(st))); return Object.keys(keep).length === Object.keys(v[2] || {}).length ? v : [v[0], v[1], keep, ...v.slice(3)]; });
  const body = refine || volume ? { body: { ...plan.body, ...(refine ? { refine } : {}), ...(volume ? { volume } : {}) } } : {};
  return { ...plan, segments, ...(dials ? { dials } : {}), ...body };
}

// ─── the sockets ────────────────────────────────────────────────────────────
/** The ball joints, where a limb leaves the trunk: no ring of the trunk to meet, so no bridge. The limb's root rings
 * ride a FOLD (the helper the elbow's and the knee's are: turned half the limb's swing from its rest line, pushed out to
 * the convex side) instead of a blend of the trunk's bone and the limb's, which draws the swung root inside the joint (an
 * arm raised over the head thinned to a stalk, a thigh raised to the chest crumpled at the groin). The shoulder gains its
 * fold; the hip has one, and its ring rides it whole. `rings`: the limb's ring ids and each one's weights. */
export const TIERED_SOCKETS = Object.freeze([
  Object.freeze({ limb: 'upperArmR', trunk: 'clavicleR', fold: 'shoulderFoldR', joint: 'shoulder', to: 'elbow', front: [1, 0, 0], push: 0.3,
    rings: Object.freeze({ back: { trunk: 0.2, limb: 0.8 }, st0: { limb: 1 } }), shell: 'torso', ball: 0.85, forward: 0.1 }),
  Object.freeze({ limb: 'thighR', trunk: 'pelvis', fold: 'hipFoldR', joint: 'hip', to: 'knee', front: [0, 1, 0], push: null,
    rings: Object.freeze({ st1: { fold: 1 } }) }),
]);

/** The plan with its sockets' folds: a fold the rig lacks is added (its rest line the limb's), the limb's root rings bound. */
/** THE SHOULDER WEB (hero laws 8, `web`): a sleeve of skin in the arm's own colour group over the ball, from inside the
 * torso's shoulder through the ball's equator to the arm's own `st1` ring (its belly), so the ball reads as the
 * deltoid's swell instead of a knob, and the web stretches as the arm swings. It ENDS ON the arm's ring, the same points
 * riding the arm alone, so the two weld into one surface there (an overlap would show its crossing as a crease). Each
 * ring before it at `at` (shares of the ball's radius along the arm from the ball's centre) with its radius `r` (of the
 * ball's), or `toArm` (that share of the way from the equator to the arm's ring, swelled by `swell`), and its weights by
 * role: the trunk's bone (the collarbone), the fold (the ball's), the limb. */
export const SHOULDER_WEB = Object.freeze([
  Object.freeze({ at: -1.25, r: 0.7, w: { trunk: 0.2, fold: 0.8 } }),
  Object.freeze({ at: -0.6, r: 0.92, w: { fold: 1 } }),
  Object.freeze({ at: 0, r: 1.06, w: { fold: 1 } }),
  Object.freeze({ toArm: 0.5, swell: 1.04, w: { fold: 0.5, limb: 0.5 } }),
]);
/** THE WEB'S ARMPIT (hero laws 10, `web: 3`): the web's points on the inside of the arm's bend (its medial slots, toward
 * the armpit) follow the arm more than its ring does, at its equator and the ring hugging the arm, so a raised arm
 * stretches the web's armpit side instead of folding it; the deltoid's outer side rides the fold as it did. Laws 9's
 * web folded behind a raised arm's armpit. The cone's tucked underside between its base and the ball stays with the
 * trunk by how far it is tucked, and its points over the torso's skin by `overTrunk` of how far they ride over; its rings hand the trunk to the fold more evenly along it (`cone`); its ring is turned half a slot (`turn`), so no point sits on the line the fold turns
 * about (there the faces either side of it sheared over), it reaches less far toward the neck (`reach`), and its rings
 * into the arm are its ball ring turned into the arm's way, untwisted, drawn in to `inArm` (round, inside the arm's oval). So the fold's turn never folds the cone over or
 * swings it out of the torso's back as a fin. */
export const WEB_ARMPIT = Object.freeze({ slots: Object.freeze(['sideL', 'backL', 'frontL']), rings: Object.freeze({ st2: { fold: 0.55, limb: 0.45 }, st3: { fold: 0.2, limb: 0.8 } }),
  turn: 0.5, reach: 0.45, inside: 0.55, inArm: 0.85, overTrunk: 0.7, cone: Object.freeze([{ trunk: 1 }, { trunk: 0.75, fold: 0.25 }, { trunk: 0.45, fold: 0.55 }, { trunk: 0.15, fold: 0.85 }]) });
/** THE SHOULDER CONE (hero laws 9, `web: 2`): the web's INNER fairing, in its group and stretching as it does: its
 * rings square to the way from the ball toward the neck's root, from one hidden inside the ball (`start` of its radius)
 * to a wide, flattened base inside the torso (`reach` of the way to the neck hub, `across` the ball's radius front to
 * back and `up` top to bottom, each point held `inside` the torso's own section at its height). It comes out of the web's
 * inner side and goes into the torso over the shoulder's top, front and back, so the torso's shoulder corner (the
 * pectoral's top, the trapezius' slope, the shoulder blade) runs into the ball closed, not at a facet: a ring between
 * rides `skin` (of the ball's radius) over the torso where it would sink under it, at most `most`, on its upper half
 * (fully from `top` of its radius up), its sides held under the skin (`sink` of the way to it), and draws in by `tuck` toward its centre on its
 * lower half (fully from `under` down), so it never spans the armpit and never steps. Rings at `t` (0
 * in the ball, 1 the base) with their weights by role. Past the ball it runs on INTO THE ARM (`arm`: rings round the
 * arm's axis at `at` of the ball's radius from its centre with radius `r` of it, then the arm's belly ring drawn in to
 * `belly`), inside the web at rest, its weights handing the fold to the arm more slowly than the web's, so a raised arm
 * keeps it round where the web and the ball bunch at the armpit. The ball itself is drawn in to `ball` of its radius
 * under them (its centre kept), so a raised arm never shows it. At laws 9 the web also HUGS the arm before it ends (`hug`: its last ring before the
 * arm's the arm's own section that share of the way down to the belly ring, `swell` over it), where laws 8 met the arm at
 * an angle and showed the meeting as a crease. */
export const SHOULDER_CONE = Object.freeze({ ball: 0.7, reach: 0.55, start: 0.9, across: 2.1, up: 1.35, inside: 0.85, top: 0.7, under: 0.7, sink: 0.97, tuck: 0.6, most: 0.8, hug: 0.55, swell: 1.05,
  rings: Object.freeze([Object.freeze({ t: 1, w: { trunk: 1 } }), Object.freeze({ t: 0.66, skin: 0.08, w: { trunk: 0.65, fold: 0.35 } }), Object.freeze({ t: 0.33, skin: 0.06, w: { trunk: 0.3, fold: 0.7 } }), Object.freeze({ t: 0, w: { fold: 1 } })]),
  arm: Object.freeze([Object.freeze({ at: 0.7, r: 0.9, w: { fold: 0.45, limb: 0.55 } }), Object.freeze({ at: 1.4, r: 0.82, w: { fold: 0.15, limb: 0.85 } }), Object.freeze({ belly: 0.88, w: { limb: 1 } })]) });


/** The torso's section at a height (its rings blended, read as an outline in plan, its points in angular order round its
 * centre): `hold(p, hi)` moves a point toward that centre until it is at most `hi` of the way to the outline (a point
 * above the top ring first set on it); `clear(p, dir, gap, most)` moves it along `dir` until it stands `gap` outside the
 * outline, at most `most` (a point already outside, or one that cannot clear, as it was). A plan without a torso leaves
 * every point. */
function torsoSection(plan, segments) {
  const T = segments.find((g) => g.name === 'torso'); if (!T) return { hold: (p) => p, clear: (p) => p };
  const S = partRings({ ...plan, segments }, T).stations.map((st) => ({ z: centre(st.points)[2], pts: Object.values(st.points), c: centre(st.points) })).sort((a, b) => a.z - b.z);
  const at = (z0) => {
    const z = Math.min(Math.max(z0, S[0].z), S[S.length - 1].z - 1e-6), i = Math.max(0, S.findIndex((r) => r.z > z) - 1), A = S[i], B = S[Math.min(i + 1, S.length - 1)];
    const t = B.z > A.z ? (z - A.z) / (B.z - A.z) : 0, cc = A.c.map((x, q) => x + (B.c[q] - x) * t);
    const poly = A.pts.map((a, k) => [a[0] + (B.pts[k][0] - a[0]) * t - cc[0], a[1] + (B.pts[k][1] - a[1]) * t - cc[1]]).sort((a, b) => Math.atan2(a[1], a[0]) - Math.atan2(b[1], b[0]));
    return { z, cc, poly };
  };
  // (the outline's reach along a ray from the centre: its farthest crossing)
  const reachOf = (poly, u) => { let reach = 0; for (let k = 0; k < poly.length; k++) { const a = poly[k], b = poly[(k + 1) % poly.length], e = [b[0] - a[0], b[1] - a[1]], den = u[0] * e[1] - u[1] * e[0]; if (Math.abs(den) < 1e-12) continue;
    const s0 = (a[0] * e[1] - a[1] * e[0]) / den, s1 = (a[0] * u[1] - a[1] * u[0]) / den; if (s0 > 0 && s1 >= 0 && s1 <= 1) reach = Math.max(reach, s0); } return reach; };
  const depth = (p) => { const { cc, poly } = at(p[2]), v = [p[0] - cc[0], p[1] - cc[1]], L = Math.hypot(...v); if (L < 1e-9 || p[2] > S[S.length - 1].z) return L < 1e-9 ? -1 : 1; return L / reachOf(poly, [v[0] / L, v[1] / L]) - 1; };
  const hold = (p, hi) => {
    const { z, cc, poly } = at(p[2]), v = [p[0] - cc[0], p[1] - cc[1]], L = Math.hypot(...v); if (L < 1e-9) return [p[0], p[1], z];
    const u = [v[0] / L, v[1] / L], reach = reachOf(poly, u), keep = reach > 0 ? Math.min(L, hi * reach) : L;
    return [cc[0] + u[0] * keep, cc[1] + u[1] * keep, z];
  };
  const clear = (p, dir, gap, most) => {
    if (depth(p) >= 0) return p;
    const step = most / 40; for (let s = step; s <= most + 1e-12; s += step) { const q = p.map((x, k) => x + dir[k] * s); if (depth(q) >= 0) return p.map((x, k) => x + dir[k] * Math.min(most, s + gap)); }
    return p;
  };
  return { hold, clear };
}

export function tieredSockets(plan, { web = 0 } = {}) {
  const folds = plan.rig?.folds; if (!folds || !plan.rig.joints) return plan;
  const J = plan.joints, newFolds = { ...folds }; let any = false;
  const segments = plan.segments.map((seg) => {
    const K = TIERED_SOCKETS.find((x) => x.limb === seg.name); if (!K || !seg.bind?.blend) return seg;
    const ft = tmpl(K.fold), S = (n) => `${n}$S`;
    if (newFolds[ft] && K.push != null) newFolds[ft] = { ...newFolds[ft], push: r6(K.push * rad(seg.rA ?? seg.stations?.[1]?.r ?? 0.04)) };
    if (!newFolds[ft]) {
      if (!J[K.joint] || !J[K.to] || K.push == null) return seg;
      newFolds[ft] = { joint: S(K.joint), inAxis: J[K.to].map((x, k) => r6(x - J[K.joint][k])), to: S(K.to), front: [...K.front], push: r6(K.push * rad(seg.rA ?? seg.stations?.[0]?.r ?? 0.04)),
        bones: [tmpl(K.trunk) === K.trunk ? K.trunk : tmpl(K.trunk), tmpl(K.limb)], head: ft, tail: ft.replace('$S', 'Tip$S'), aim: ft.replace('$S', 'Aim$S') };
    }
    const name = (role) => (role === 'trunk' ? K.trunk : role === 'limb' ? K.limb : K.fold);
    const blend = { ...seg.bind.blend };
    for (const [st, ws] of Object.entries(K.rings)) blend[st] = Object.fromEntries(Object.entries(ws).map(([role, x]) => [name(role), x]));
    any = true;
    return { ...seg, bind: { ...seg.bind, blend } };
  });
  if (!any) return plan;
  // the BALL (the vajra's ball-in-socket): a shoulder is a large head on a shallow socket, so its ball shows. A sphere
  // at the joint, as wide as the arm at its root, rides the fold (half the arm's swing): whichever way the arm goes, it
  // fills between the shoulder's corner and the arm. The hip's head sits deep in its socket (the pelvis hides it): none.
  const balls = [];
  for (const K of TIERED_SOCKETS.filter((x) => x.ball)) {
    const seg = segments.find((g) => g.name === K.limb); if (!seg || !newFolds[tmpl(K.fold)] || !J[K.joint] || !J[K.to]) continue;
    const r = r6(K.ball * rad(seg.rMid ?? seg.rA)), d = unit3(sub3(J[K.to], J[K.joint])), c = J[K.joint].map((x, k) => x + (K.forward ?? 0) * r * (k === 1 ? 1 : 0));
    const slots = SLOT_FAMILIES.ring8, lat = [-60, -30, 0, 30, 60];
    // (laws 9: the ball drawn in under its web and cone, which close the shoulder now, so a raised arm never shows it;
    // its centre stays, and the web and cone are measured off its full radius)
    const rb = web >= 2 ? r * SHOULDER_CONE.ball : r;
    const stations = lat.map((deg, i) => { const t = (deg * Math.PI) / 180, P = ringPoints(c.map((x, k) => x + d[k] * rb * Math.sin(t)), d, rb * Math.cos(t), slots);
      return { id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) }; });
    balls.push({ name: K.ball && K.limb.replace(/^upperArm/, 'shoulderBall'), kind: 'rings', slots: 'ring8', stations, caps: { back: c.map((x, k) => r6(x - d[k] * rb)), tip: c.map((x, k) => r6(x + d[k] * rb)) },
      group: seg.group, mirror: 'name', bind: K.fold });
  }
  // (`web`: each ball's web, on the ball's axis and ring family, ending on its arm's own st1 ring)
  if (web) for (const b of [...balls]) {
    const K = TIERED_SOCKETS.find((x) => x.limb === b.name.replace(/^shoulderBall/, 'upperArm')), seg = segments.find((g) => g.name === K.limb), slots = SLOT_FAMILIES.ring8;
    const armRings = familyOf(plan, seg) === 'ring8' ? partRings({ ...plan, segments }, seg).stations : [], arm = armRings.find((st) => st.id === 'st1'), arm0 = armRings.find((st) => st.id === 'st0'); if (!arm) continue;
    const c = centre(b.stations[2].points), d = unit3(sub3(J[K.to], J[K.joint])), r = r6(K.ball * rad(seg.rMid ?? seg.rA)), role = (x) => (x === 'trunk' ? K.trunk : x === 'limb' ? K.limb : K.fold);
    const rings = [];
    for (const W of SHOULDER_WEB) {
      if (W.toArm === undefined) { rings.push(ringPoints(c.map((x, k) => x + d[k] * r * W.at), d, r * W.r, slots)); continue; }
      // (laws 9: the arm's own section on its way to the belly ring, a little over it; laws 8: halfway from the equator)
      const C = SHOULDER_CONE, e = rings[rings.length - 1], hug = web >= 2 && arm0;
      const P = hug ? Object.fromEntries(slots.map((sl) => [sl, arm0.points[sl].map((x, k) => x + (arm.points[sl][k] - x) * C.hug)])) : Object.fromEntries(slots.map((sl) => [sl, e[sl].map((x, k) => x + (arm.points[sl][k] - x) * W.toArm)])), m = centre(P);
      rings.push(Object.fromEntries(slots.map((sl) => [sl, P[sl].map((x, k) => m[k] + (x - m[k]) * (hug ? C.swell : W.swell))])));
    }
    rings.push(arm.points);
    const stations = rings.map((P, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) }));
    const wOf = (w) => Object.fromEntries(Object.entries(w).map(([k, x]) => [role(k), x])), last = { limb: 1 }, mid = centre(arm.points);
    // the CONE (laws 9): rings square to the way from the ball to the neck's root, from one hidden inside the ball to a
    // wide, flattened base inside the torso
    if (web >= 2 && J.neckHub) {
      const C = SHOULDER_CONE, to = J.neckHub.map((x, k) => c[k] + (x - c[k]) * (web >= 3 ? WEB_ARMPIT.reach : C.reach)), ax = unit3(sub3(to, c));
      const fy = unit3([0, 1, 0].map((x, i) => x - ax[i] * ax[1])), up = cross3(ax, fy), uz = up[2] < 0 ? up.map((x) => -x) : up;   // front-back, then the ring's up
      const torso = torsoSection(plan, segments), ang = slots.map((_, i) => (2 * Math.PI * (i + (web >= 3 ? WEB_ARMPIT.turn : 0))) / slots.length);
      const ringAt = (t, ry, rz) => { const m = c.map((x, i) => x + (to[i] - x) * t); return Object.fromEntries(slots.map((sl, i) => [sl, m.map((x, q) => x + fy[q] * Math.cos(ang[i]) * ry + uz[q] * Math.sin(ang[i]) * rz)])); };
      // (how far a slot rides over the skin: fully at and over the ring's middle, falling to tucked at its bottom)
      const sinOf = (sl) => Math.sin(ang[slots.indexOf(sl)]), over = (sl) => Math.min(1, Math.max(0, sinOf(sl) / C.top)), tuckOf = (sl) => Math.min(1, Math.max(0, -sinOf(sl) / C.under));
      const cone = C.rings.map((R) => {
        const P = ringAt(R.t, r * (C.start + (C.across - C.start) * R.t), r * (C.start + (C.up - C.start) * R.t)), m = c.map((x, i) => x + (to[i] - x) * R.t);
        if (R.t === 1) return Object.fromEntries(slots.map((sl) => [sl, torso.hold(P[sl], web >= 3 ? WEB_ARMPIT.inside : C.inside)]));
        // (a ring between rides just over the torso's skin where it would sink under it, over the shoulder's top and its
        // front and back; under the shoulder it draws in toward its centre, so it never spans the armpit)
        return Object.fromEntries(slots.map((sl) => { const w = R.skin ? over(sl) : 0, under = torso.hold(P[sl], C.sink), outer = w > 0 ? torso.clear(P[sl], unit3(sub3(P[sl], m)), R.skin * r, C.most * r) : P[sl];
          const out = R.skin ? under.map((x, i) => x + (outer[i] - x) * w) : P[sl], tk = tuckOf(sl);
          return [sl, out.map((x, i) => x + (m[i] + (P[sl][i] - m[i]) * C.tuck - x) * tk)]; }));
      });
      // INTO THE ARM: past the ball the cone runs on round the arm's own axis, a little inside the web and the arm at rest
      // (so it shows nothing there), its weights handing the fold to the arm more slowly than the web's, so a raised arm
      // keeps it round where the web and the ball bunch at the armpit; it ends inside the arm's belly ring. Its rings
      // are lined up slot by slot with the one in the ball (slotMap), as a bridge's are, so the bend never twists.
      const ringW = (R, i) => (web >= 3 ? WEB_ARMPIT.cone[i] : R.w), ws = [...C.rings.map(ringW)];
      const inBall = cone[cone.length - 1];
      for (const E of C.arm) {
        if (web >= 3) {
          // (laws 10: the ball's ring itself turned from the cone's way into the arm's, so its slots run on untwisted)
          const kx = cross3(ax, d), kl = Math.hypot(...kx), kk = kx.map((x) => x / kl), th = Math.atan2(kl, dot3(ax, d)), co = Math.cos(th), si = Math.sin(th);
          const turn = (o) => { const kd = dot3(kk, o), ko = cross3(kk, o); return [0, 1, 2].map((i) => o[i] * co + ko[i] * si + kk[i] * kd * (1 - co)); };
          const m0 = centre(inBall), at = E.belly ? centre(arm.points) : c.map((x, i) => x + d[i] * r * E.at), rr = WEB_ARMPIT.inArm * (E.belly ? E.belly * Math.min(...slots.map((sl) => Math.hypot(...sub3(arm.points[sl], at)))) : r * E.r);
          cone.push(Object.fromEntries(slots.map((sl) => { const o = unit3(turn(sub3(inBall[sl], m0))); return [sl, at.map((x, i) => x + o[i] * rr)]; }))); ws.push(E.w); continue;
        }
        const P = E.belly ? Object.fromEntries(slots.map((sl) => { const m = centre(arm.points); return [sl, arm.points[sl].map((x, i) => m[i] + (x - m[i]) * E.belly)]; }))
          : ringPoints(c.map((x, i) => x + d[i] * r * E.at), d, r * E.r, slots);
        const turnTo = slotMap(inBall, P, slots); cone.push(Object.fromEntries(slots.map((sl) => [sl, P[turnTo[sl]]]))); ws.push(E.w);
      }
      // (laws 10: a tucked point between the base and the ball stays with the trunk by how far it is tucked, so a raised
      // arm's turn of the fold never swings the cone's underside out of the torso's back as a fin)
      const tuckedToTrunk = () => Object.fromEntries(C.rings.flatMap((R, i) => (R.skin ? slots.filter((sl) => tuckOf(sl) > 0 || over(sl) > 0).map((sl) => {
        // (a point over the torso's skin stays with it too, by how far it rides over: a raised arm never lifts it off the chest)
        const tk = Math.max(tuckOf(sl), WEB_ARMPIT.overTrunk * over(sl)), Rw = ringW(R, i), w = Object.fromEntries([...new Set([...Object.keys(Rw), 'trunk'])].map((k) => [k, r6((Rw[k] ?? 0) * (1 - tk) + (k === 'trunk' ? tk : 0))]));
        return [`st${i}.${sl}`, wOf(w)]; }) : [])));
      const endC = centre(cone[cone.length - 1]);
      balls.push({ name: b.name.replace(/^shoulderBall/, 'shoulderCone'), kind: 'rings', slots: 'ring8', stations: cone.map((P, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) })),
        caps: { back: to.map((x, i) => r6(x + ax[i] * r * 0.2)), tip: endC.map((x, i) => r6(x + d[i] * r * 0.15)) }, group: seg.group, mirror: 'name',
        bind: { bone: K.fold, blend: { back: wOf(ws[0]), ...Object.fromEntries(ws.map((w, i) => [`st${i}`, wOf(w)])), tip: wOf(ws[ws.length - 1]), ...(web >= 3 ? tuckedToTrunk() : {}) } } });
    }
    balls.push({ name: b.name.replace(/^shoulderBall/, 'shoulderWeb'), kind: 'rings', slots: 'ring8', stations,
      caps: { back: c.map((x, k) => r6(x + d[k] * r * (SHOULDER_WEB[0].at - 0.15))), tip: mid.map((x, k) => r6(x - d[k] * r * 0.15)) },
      group: seg.group, mirror: 'name', bind: { bone: K.fold, blend: { back: wOf(SHOULDER_WEB[0].w), ...Object.fromEntries(SHOULDER_WEB.map((W, i) => [`st${i}`, wOf(W.w)])), [`st${SHOULDER_WEB.length}`]: wOf(last), ...(web >= 3 ? Object.fromEntries(Object.entries(WEB_ARMPIT.rings).flatMap(([st, w]) => WEB_ARMPIT.slots.map((sl) => [`${st}.${sl}`, wOf(w)]))) : {}), tip: wOf(last) } } });
  }
  if (balls.length) { const i = segments.findIndex((g) => g.name === balls[0].name.replace(/^shoulderBall/, 'upperArm')); segments.splice(i + 1, 0, ...balls); }
  // the SHELL round a socket (the torso's shoulder): a point that shares the trunk bone's lift (the collarbone's) keeps
  // half of that share and gives the fold as much again from the torso's, so the shoulder's corner goes up with a raised
  // arm instead of standing beside its root
  for (const K of TIERED_SOCKETS.filter((x) => x.shell)) {
    const i = segments.findIndex((g) => g.name === K.shell), g = segments[i]; if (!g?.bind?.blend || !newFolds[tmpl(K.fold)]) continue;
    const blend = { ...g.bind.blend };
    for (const S of ['R', 'L']) { const trunk = K.trunk.replace(/R$/, S), fold = K.fold.replace(/R$/, S);
      for (const [k, w] of Object.entries(blend)) { const t = w[trunk]; if (!k.includes('.') || !t) continue;
        const rest = Object.entries(w).filter(([b]) => b !== trunk), sum = rest.reduce((a, [, x]) => a + x, 0), keep = 1 - 1.5 * t;
        const o = Object.fromEntries(rest.map(([b, x]) => [b, r6((x / sum) * keep)])); o[trunk] = r6(t / 2); o[fold] = r6(1 - Object.values(o).reduce((a, x) => a + x, 0)); blend[k] = o; } }
    segments[i] = { ...g, bind: { ...g.bind, blend } };
  }
  // a fold the rig gained is a bone too (its head, tail and aim the fold's own joints), after the rig's own
  const gained = Object.keys(newFolds).filter((ft) => !folds[ft]).map((ft) => ({ id: ft, head: newFolds[ft].head, tail: newFolds[ft].tail, aux: [newFolds[ft].head, newFolds[ft].aim] }));
  const bones = [...plan.rig.bones, ...(gained.length ? [{ perSide: gained }] : [])];
  // a ball takes the dials and the splits its arm takes
  const withBall = (parts) => { const out = [...parts]; for (const b of balls) for (const S of ['R', 'L', '$S']) { const arm = b.name.replace(/^shoulder(Ball|Web|Cone)/, 'upperArm').replace(/R$/, S), n = b.name.replace(/R$/, S); if (out.includes(arm) && !out.includes(n)) out.push(n); } return out; };
  const dials = plan.dials && Object.fromEntries(Object.entries(plan.dials).map(([k, x]) => [k, Array.isArray(x.parts) ? { ...x, parts: withBall(x.parts) } : x]));
  const refine = plan.body?.refine?.map((e) => (e.slots !== false && Array.isArray(e.parts) ? { ...e, parts: withBall(e.parts) } : e));
  return { ...plan, segments, rig: { ...plan.rig, folds: newFolds, bones }, ...(dials ? { dials } : {}), ...(refine ? { body: { ...plan.body, refine } } : {}) };
}

// ─── the face ───────────────────────────────────────────────────────────────
/** The landmark head's defaults on the tiered form, by the head's sex, read at the eyes gate on the character board
 * (spikes 1–3): the FACE words under the operator's own (ratios compose by product, so a word the operator gives moves
 * from here), the female's longer HAIR (the short swept cut was both sexes'), and the FEATURES the fitted head's words do
 * not reach: eyes 0.85 (36 mm wide was past a real eye's 30), lighter brows, smaller ears set in (they stood out from a
 * head they were a third of), a lower lip and the lips' tint of the skin (the lip was the skin at 0.96: no mouth), and
 * the nose's WINGS as bulbs on its sides (`wing`: the side of the nostril the cheek meets, seen from every angle; the
 * crease round them is the tint's `groove`), the NOSE forward from a fuller root (`bridge`: the nasion and the bridge come forward, so in profile the eye sits
 * back from the nose's front), the BROWS arched, thickest by the nose and tapering to a fine tail, close to the skin and a
 * shade softer than the hair, and
 * the EYE as an eyeball under a lid: the white a shallow dome sunk in its socket, the upper lid down over the iris's top
 * and a lower lid (the flat stack read as a sticker), the male's lid the heavier.
 * The female: a narrower jaw and nose, a smaller mouth, fuller cheekbones, the chin a little forward (at 0.94 it fell
 * behind her lips in profile) and rounder (chinPoint; a sharper point read too prominent in three-quarter and profile); the male: a broader jaw, a heavier brow, the chin forward. */
/** How a hero's figure is shaded smooth (world-kinds.js, and the body study as the World draws it): the crease, and the
 * landmark head's ellipsoid weight on the tiered form (the child form: its own, CHILD_SHADE, and its face's lean); every
 * other hero the studio's crease, no ellipsoid */
export const heroShade = (hero) => (hero?.form === 'tiered'
  ? (childRound(hero) ? { crease: CHILD_SHADE.crease, ellipsoid: (hero.head ?? 'landmark') === 'landmark' ? TIERED_FACE_SMOOTH : 0, face: CHILD_SHADE.face }
    : { crease: TIERED_SMOOTH_CREASE, ellipsoid: (hero.head ?? 'landmark') === 'landmark' ? TIERED_FACE_SMOOTH : 0 })
  : { crease: STUDIO_SMOOTH_CREASE, ellipsoid: 0 });

export const TIERED_FACE = Object.freeze({
  female: Object.freeze({
    face: Object.freeze({ jawWidth: 0.88, chinProjection: 1.003, chinPoint: 1.06, noseSize: 1.265, noseWidth: 0.9, mouthWidth: 0.92, cheekbone: 1.08 }),
    hair: 'bob',
    features: Object.freeze({ eye: 0.85, brow: 0.6, brows: Object.freeze({ arch: 0.07, head: 1.2, tail: 0.25, lift: 0.6, soft: 0.3 }), bridge: 2.2, wing: Object.freeze({ r: 0.0062, dome: 0.003 }), ear: 0.82, earLift: 0.08, lowerLip: 1, lipTint: Object.freeze([0.866, 0.659, 0.762]), eyeDome: 0.003, lid: Object.freeze({ drop: 0.25, fold: 1.6, lower: 1 }), ridge: Object.freeze({ f: 0.55, h: 0.003, socket: 0.002, temple: 0.002 }) }),
  }),
  male: Object.freeze({
    face: Object.freeze({ jawWidth: 1.08, chinProjection: 1.12, noseSize: 1.242, browRidge: 1.15, noseWidth: 1.05 }),
    hair: null,
    features: Object.freeze({ eye: 0.85, brow: 1, brows: Object.freeze({ arch: 0.035, head: 1.3, tail: 0.35, lift: 0.7, soft: 0.18 }), bridge: 2.2, wing: Object.freeze({ r: 0.0062, dome: 0.003 }), ear: 0.85, earLift: 0.1, lowerLip: 0.8, lipTint: Object.freeze([0.811, 0.713, 0.778]), eyeDome: 0.004, lid: Object.freeze({ drop: 0.32, fold: 2.2, lower: 1.2 }), ridge: Object.freeze({ f: 0.55, h: 0.005, socket: 0.003, temple: 0.003 }) }),
  }),
});
/** THE SKULL'S BACK (hero laws 16, the landmark head's `features.occiput`, humanoid-head-fit.js): the male fit's skull stood
 * short behind the ear (18.5 cm long, the ear canal at 0.41 of its length from the back, people about 0.45), so in
 * profile the back of the skull barely cleared the nape (2.2 cm; people 4 to 5) and the head read hung forward off its
 * neck; his skull's back deeper by this share of the head's height. The female fit's stands as people's. */
export const TIERED_OCCIPUT = Object.freeze({ male: 1.066 });
/** The FACE TINT (face-tint.js): a soft occlusion in the skin's folds and a warm blush on the cheeks, the nose's tip
 * and the ears, the female's warmer; the vertex colour a shipped face paints where a texture would. The SOCKET: the
 * brow's shadow over the eye, which a western face always has (the deeper set the male's, on his heavier ridge); its
 * shade keeps the skin's red, so the socket reads warm-dark, not grey. */
export const TIERED_FACE_TINT = Object.freeze({
  female: Object.freeze({ ao: Object.freeze({ k: 0.3, lo: 0.04, hi: 0.35 }), groove: Object.freeze({ k: 0.35, r: 0.008, band: 0.0035 }), blush: Object.freeze({ amount: 0.77, tint: Object.freeze([1.0, 0.86, 0.85]) }), socket: Object.freeze({ k: 0.32, lower: 0.4, shade: Object.freeze([0.85, 1, 0.95]) }) }),
  male: Object.freeze({ ao: Object.freeze({ k: 0.32, lo: 0.04, hi: 0.35 }), groove: Object.freeze({ k: 0.35, r: 0.008, band: 0.0035 }), blush: Object.freeze({ amount: 0.45, tint: Object.freeze([1.0, 0.88, 0.86]) }), socket: Object.freeze({ k: 0.4, lower: 0.4, shade: Object.freeze([0.85, 1, 0.95]) }) }),
});
/** the head's sex for the tiered face: the head preset if named, else the cast's silhouette */
export const tieredPole = (hero) => hero.headPreset ?? (castOf(hero.cast, hero.proportions ?? (hero.head === 'anime' ? 'anime' : 'hero'))?.silhouette === 'female' ? 'female' : 'male');

/** the landmark head's normals toward its ellipsoid (station-loft-shade.js headEllipsoidNormals): 0.45 left the crease
 * down the forehead and the nose, 0.7 reads as one form; round the nose the blend falls to a quarter (`nose`), so its
 * sides and wings keep the light the sphere smoothed away */
export const TIERED_FACE_SMOOTH = Object.freeze({ w: 0.7, nose: 0.25, brow: 0.35 });

/** The tiers (era/cast-spend.js) whose figure is tall enough on screen to show the ear's fold and antihelix: below them
 * the ear is the lean one (head-ear.js), 80 triangles against 280, its outline, rim and bowl. A hero with no target is
 * drawn for the default (1080p third-person, T2). */
export const TIERED_FULL_EAR_TIERS = DENSE_TIERS;

/** The hero with the tiered face's defaults under its own words: the landmark head only (the anime head has its own).
 * The hair default is the record's (layered.js heroRecord stores the female's `bob` when she names none). The ear is the
 * lean one unless the hero's target is a TIERED_FULL_EAR_TIERS tier. Under hero laws 16 the skull's back
 * (TIERED_OCCIPUT). */
export function tieredFace(hero, pole) {
  if ((hero.head ?? 'landmark') !== 'landmark') return hero;
  const F = TIERED_FACE[pole] ?? TIERED_FACE.male, own = hero.face == null ? [] : Array.isArray(hero.face) ? hero.face : [hero.face];
  const target = heroTarget(hero), fullEar = !!target && TIERED_FULL_EAR_TIERS.includes(tierOf(readTarget(target).figurePx).id);
  const occiput = (hero.laws ?? 1) >= 16 && TIERED_OCCIPUT[pole] ? { occiput: TIERED_OCCIPUT[pole] } : {};
  return { ...hero, face: [F.face, ...own], faceFeatures: { ...F.features, ...(fullEar ? {} : { earLean: true }), ...occiput } };
}

/** The joints a garment crosses (upper limb, lower limb, the bridge between): a piece running to the upper limb's end
 * over a piece starting at the lower limb's start covers the bridge too, so a sleeve and its cuff bend as one cloth. */
export const GARMENT_BRIDGES = Object.freeze([['upperArm', 'foreArm', 'elbowBridge', 'Elbow'], ['thigh', 'shank', 'kneeBridge', 'Knee'], ['foreArm', 'hand', 'wristBridge', 'Wrist']]);
const baseOf = (n) => n.replace(/[RL]$/, '');
/** a garment's part names (a word or a list of them, as body-garment.js reads it) */
const partsOf = (g) => (Array.isArray(g.part) ? g.part : [g.part]).filter((n) => typeof n === 'string');
/** a garment copied ring by ring off its parts (not a shoe or a skirt, which are built hulls), and whether its window
 * reaches the part's end (`end`) or starts at its start */
const copied = (g) => !g.fit;
const reaches = (g, end) => copied(g) && g.u === undefined && (!g.run || (end ? g.run[1] >= 1 - 1e-9 : g.run[0] <= 1e-9));

/**
 * The tiered form's garments (body-garment.js). A garment is a copy of its part's rings, so it should be drawn as that
 * part is:
 *   - a BRIDGE between two limbs a garment covers end to start takes a piece of its own (`<id><Joint>`, the upper
 *     piece's group, the larger of the two eases at the joint), worn just after the upper piece; else the bridge's skin
 *     shows between a sleeve and its cuff, a trouser leg and its shin;
 *   - each garment joins every refine entry that names its part (the dress's, a bridged chain's, the target's split), so
 *     it keeps its part's sides and the skin's extra ring never stands between two of the cloth's.
 * No garments ⇒ the plan as it was.
 */
export function tieredGarments(plan) {
  const G = plan.garments;
  if (!G?.length) return plan;
  const has = (n) => (plan.segments || []).some((s) => baseOf(s.name) === n);
  const garments = [];
  for (const g of G) {
    garments.push(g);
    for (const [up, low, bridge, joint] of GARMENT_BRIDGES) {
      if (!partsOf(g).some((n) => baseOf(n) === up) || !reaches(g, true) || !has(bridge)) continue;
      const h = G.find((x) => partsOf(x).some((n) => baseOf(n) === low) && reaches(x, false));
      if (!h) continue;
      const ease = Math.max(g.ease + (g.flare?.[1] ?? 0), h.ease + (h.flare?.[0] ?? 0));
      garments.push({ id: `${g.id}${joint}`, part: [bridge], ease: r6(ease), group: g.group, ...(g.rigidity !== undefined ? { rigidity: g.rigidity } : {}) });
    }
  }
  // the parts each garment copies: its part's twins as the compile names them (body-garment.js `<id>_<part>`)
  const onPart = (p) => garments.filter((g) => copied(g) && partsOf(g).some((n) => n === p || n === baseOf(p))).map((g) => `${g.id}_${p}`);
  const refine = plan.body?.refine?.map((e) => (e.parts ? { ...e, parts: [...new Set([...e.parts, ...e.parts.flatMap(onPart)])] } : e));
  return { ...plan, garments, ...(refine ? { body: { ...plan.body, refine } } : {}) };
}

/**
 * An adornment KIT (station-loft-adorn.js) on the tiered joints. A rigid piece over a joint (a couter on the upper arm
 * standing off the forearm, a poleyn on the thigh off the shin) stands off the BRIDGE between them too, and is pinned at
 * the bridge's middle, whose weights run through the joint's fold: it turns half the bend, as the cloth over the joint
 * does, instead of riding the upper bone while the bridge bends under it. A piece on the torso or the neck (a pauldron,
 * a gorget) stands off the shoulders' BALLS as well, which stand out of the torso there. A piece its author
 * pinned keeps its pin. No bridges or balls ⇒ the kit as it was.
 *
 * THE SHOULDER IS NOT THE TORSO'S: the torso's top rings run out to the shoulders (the arms hang from their sides), so a
 * plate on the torso that reaches up there stood off the balls and wrapped the shoulder in a yoke. Above the ball's
 * lowest point the torso's sides are the shoulder's: a trunk plate that is not a shoulder piece (one that spans the
 * upper arm: a pauldron's anchor) keeps off them, a front or back plate cut in under the arm (its `armhole`), a wrap (a band, a row,
 * a hoop) ending under the arm, and it lies under the arm instead of standing off the balls, as the realistic body's
 * cuirass does (body-relational-armour.js PLATE_STAND). A pinned piece (a skirt's board) and the neck's (a gorget) as
 * they were. Hero laws 18 (hero-form.js); a hero minted under 1 to 17 keeps its plates standing off the balls.
 */
export function tieredKit(kit, plan, { laws = 1 } = {}) {
  if (!Array.isArray(kit) || !kit.length) return kit;
  const seg = (n) => (plan.segments || []).find((s) => s.name === n.replace(/L$/, 'R'));
  const sideOf = (n) => (/L$/.test(n) ? 'L' : /R$/.test(n) ? 'R' : null);
  // (the ball's lowest point as a torso station s, by the height of the torso's own stations st0, st1, …, and its inner
  // edge, the nearest the ball comes to the body's middle: above that point a plate keeps inside it)
  const T = seg('torso'), ball = seg('shoulderBallR'), Ht = (SLOT_FAMILIES[plan.style?.slots ?? 'ring8'] ?? SLOT_FAMILIES.ring8).length / 2;
  const sOf = (id) => { const m = /^st(\d+)(?:_st(\d+)_(\d+))?$/.exec(id); return m ? (m[2] === undefined ? +m[1] : +m[1] + ((+m[2] - +m[1]) * +m[3]) / 100) : null; };
  const rings = (T?.stations || []).map((st) => ({ s: sOf(st.id), z: st.z, rx: st.r?.[0] })).filter((q) => q.s != null && Number.isFinite(q.z) && Number.isFinite(q.rx)).sort((a, b) => a.s - b.s);
  const ballPts = (ball?.stations || []).flatMap((st) => Object.values(st.points || {}));
  const sBall = (() => { if (rings.length < 2 || !ballPts.length) return null; const zb = Math.min(...ballPts.map((p) => p[2]));
    for (let i = 0; i + 1 < rings.length; i++) { const a = rings[i], b = rings[i + 1]; if (zb >= a.z && zb <= b.z && b.z > a.z) return r6(a.s + ((b.s - a.s) * (zb - a.z)) / (b.z - a.z)); } return null; })();
  const xIn = ballPts.length ? Math.min(...ballPts.map((p) => Math.abs(p[0]))) * 0.92 : null, e = T?.e ?? 2;
  // the furthest round from the front (in the ring's t) a plate may reach and stay inside the ball over rings s0 → s1:
  // the torso's ring a superellipse (x = rx·sinθ^(2/e)), t uniform in θ over the ring half
  const tReach = (s0, s1) => { const rx = Math.max(...rings.filter((q) => q.s >= s0 - 1e-9 && q.s <= s1 + 0.5).map((q) => q.rx), 1e-9);
    const sn = Math.min(1, (xIn / rx) ** (e / 2)); return r6((Math.asin(sn) / Math.PI) * Ht); };
  const trunkPlate = (A) => A.part === 'torso' && (A.mode === 'shell' || A.mode === 'band') && !A.pin && !(A.over || []).some((o) => /^upperArm/.test(o));
  const offShoulder = (A) => { if (sBall == null || !Array.isArray(A.s) || A.s[1] <= sBall) return A;
    const reach = tReach(Math.max(A.s[0], sBall), A.s[1]);
    if (Array.isArray(A.t)) { const [t0, t1] = A.t[0] <= A.t[1] ? A.t : [A.t[1], A.t[0]];
      if (t1 <= reach || t0 >= Ht - reach) return A;                                        // clear of the shoulder
      // a front or back plate cut in under the arm: its side edge eased in above the ball (station-loft-adorn.js armhole)
      const edge = A.t[1] >= A.t[0] ? 1 : 0;   // (the window's end toward the side: its t end, unless it runs back to front)
      if (t0 < reach && t1 <= Ht - reach + 1e-9 && t0 < Ht / 2) return { ...A, armhole: { from: sBall, edge, t: reach } };
      if (t1 > Ht - reach && t0 >= reach - 1e-9 && t1 > Ht / 2) return { ...A, armhole: { from: sBall, edge: 1 - edge, t: r6(Ht - reach) } }; }
    // a wrap, or a window across the side: it ends under the arm (its support with it)
    const top = r6(Math.max(A.s[0] + 0.1, sBall)); return { ...A, s: [A.s[0], top], ...(A.support > top ? { support: top } : {}) }; };
  return kit.map((A) => {
    const S = sideOf(A.part ?? ''), over = A.over || [];
    let B = A;
    for (const [up, low, bridge] of GARMENT_BRIDGES) {
      if (!S || A.part !== `${up}${S}` || !over.includes(`${low}${S}`)) continue;
      const br = seg(`${bridge}R`);
      if (!br) continue;
      const mid = r6(((br.stations?.length ?? 2) - 1) / 2), t = Array.isArray(A.t) ? r6((A.t[0] + A.t[1]) / 2) : null;
      B = { ...B, over: [...new Set([...(B.over || []), `${bridge}${S}`])], ...(A.rigid && !A.pin && t != null ? { pin: [mid, t, A.side || S, `${bridge}${S}`] } : {}) };
    }
    // the balls stand out of the torso at the shoulder: what the torso or the neck carries stands off them, but a trunk
    // plate, which keeps off the shoulder instead
    if (laws >= 18 && trunkPlate(A) && sBall != null) return offShoulder(B);
    if ((A.part === 'torso' || A.part === 'neck') && seg('shoulderBallR')) B = { ...B, over: [...new Set([...(B.over || []), 'shoulderBallR', 'shoulderBallL', ...(seg('shoulderWebR') ? ['shoulderWebR', 'shoulderWebL'] : []), ...(seg('shoulderConeR') ? ['shoulderConeR', 'shoulderConeL'] : [])])] };
    return B;
  });
}
