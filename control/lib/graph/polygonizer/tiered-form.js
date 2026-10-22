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
 *   tieredKit(kit, plan)      an adornment kit over the joints: a piece over a joint rides its bridge, a pauldron its ball
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
import { SLOT_FAMILIES, ringPoints, segmentPart, loftPart } from './station-loft-plan.js';
import { BREAST_FIELD, breastHeight } from './breast-field.js';
import { castOf } from './hero-form.js';
import { heroTarget } from '../era/cast-light.js';
import { readTarget } from '../era/target.js';
import { tierOf, DENSE_TIERS } from '../era/cast-spend.js';
import { STUDIO_SMOOTH_CREASE } from './station-loft-shade.js';

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
const centre = (pts) => { const v = Object.values(pts); return [0, 1, 2].map((k) => v.reduce((t, p) => t + p[k], 0) / v.length); };

/** A part's rings and caps as the plan expands them (station-loft-plan.js expandPlan), unrounded; a rings part's its own. */
function partRings(plan, seg) {
  if (seg.kind === 'rings') return { stations: seg.stations, caps: seg.caps };
  const families = { ...SLOT_FAMILIES, ...(plan.slotFamilies || {}) }, style = { slots: 'ring8', limbSlots: 'limb6', e: 2, ...(plan.style || {}) };
  const slots = seg.slots == null ? families[style.limbSlots] : typeof seg.slots === 'string' ? families[seg.slots] : seg.slots, e = seg.e ?? style.e;
  if (seg.kind === 'loft') return loftPart(seg.stations, seg.caps, slots, e, { keep: seg.frame === 'keep' });
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
  for (const n of names) { if (!n.startsWith('shoulderWeb') || !n.endsWith('R')) continue; const arm = of.get(n.replace(/^shoulderWeb/, 'upperArm')); if (arm && !arm.includes(n)) { arm.push(n); of.set(n, arm); } }
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

export function tieredSockets(plan, { web = false } = {}) {
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
    const stations = lat.map((deg, i) => { const t = (deg * Math.PI) / 180, P = ringPoints(c.map((x, k) => x + d[k] * r * Math.sin(t)), d, r * Math.cos(t), slots);
      return { id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) }; });
    balls.push({ name: K.ball && K.limb.replace(/^upperArm/, 'shoulderBall'), kind: 'rings', slots: 'ring8', stations, caps: { back: c.map((x, k) => r6(x - d[k] * r)), tip: c.map((x, k) => r6(x + d[k] * r)) },
      group: seg.group, mirror: 'name', bind: K.fold });
  }
  // (`web`: each ball's web, on the ball's axis and ring family, ending on its arm's own st1 ring)
  if (web) for (const b of [...balls]) {
    const K = TIERED_SOCKETS.find((x) => x.limb === b.name.replace(/^shoulderBall/, 'upperArm')), seg = segments.find((g) => g.name === K.limb), slots = SLOT_FAMILIES.ring8;
    const arm = familyOf(plan, seg) === 'ring8' ? partRings({ ...plan, segments }, seg).stations.find((st) => st.id === 'st1') : null; if (!arm) continue;
    const c = centre(b.stations[2].points), d = unit3(sub3(J[K.to], J[K.joint])), r = r6(K.ball * rad(seg.rMid ?? seg.rA)), role = (x) => (x === 'trunk' ? K.trunk : x === 'limb' ? K.limb : K.fold);
    const rings = [];
    for (const W of SHOULDER_WEB) {
      if (W.toArm === undefined) { rings.push(ringPoints(c.map((x, k) => x + d[k] * r * W.at), d, r * W.r, slots)); continue; }
      const e = rings[rings.length - 1], P = Object.fromEntries(slots.map((sl) => [sl, e[sl].map((x, k) => x + (arm.points[sl][k] - x) * W.toArm)])), m = centre(P);
      rings.push(Object.fromEntries(slots.map((sl) => [sl, P[sl].map((x, k) => m[k] + (x - m[k]) * W.swell)])));
    }
    rings.push(arm.points);
    const stations = rings.map((P, i) => ({ id: `st${i}`, points: Object.fromEntries(slots.map((sl) => [sl, P[sl].map(r6)])) }));
    const wOf = (w) => Object.fromEntries(Object.entries(w).map(([k, x]) => [role(k), x])), last = { limb: 1 }, mid = centre(arm.points);
    balls.push({ name: b.name.replace(/^shoulderBall/, 'shoulderWeb'), kind: 'rings', slots: 'ring8', stations,
      caps: { back: c.map((x, k) => r6(x + d[k] * r * (SHOULDER_WEB[0].at - 0.15))), tip: mid.map((x, k) => r6(x - d[k] * r * 0.15)) },
      group: seg.group, mirror: 'name', bind: { bone: K.fold, blend: { back: wOf(SHOULDER_WEB[0].w), ...Object.fromEntries(SHOULDER_WEB.map((W, i) => [`st${i}`, wOf(W.w)])), [`st${SHOULDER_WEB.length}`]: wOf(last), tip: wOf(last) } } });
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
  const withBall = (parts) => { const out = [...parts]; for (const b of balls) for (const S of ['R', 'L', '$S']) { const arm = b.name.replace(/^shoulder(Ball|Web)/, 'upperArm').replace(/R$/, S), n = b.name.replace(/R$/, S); if (out.includes(arm) && !out.includes(n)) out.push(n); } return out; };
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
 * landmark head's ellipsoid weight on the tiered form; every other hero the studio's crease, no ellipsoid */
export const heroShade = (hero) => (hero?.form === 'tiered'
  ? { crease: TIERED_SMOOTH_CREASE, ellipsoid: (hero.head ?? 'landmark') === 'landmark' ? TIERED_FACE_SMOOTH : 0 }
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
 * lean one unless the hero's target is a TIERED_FULL_EAR_TIERS tier. */
export function tieredFace(hero, pole) {
  if ((hero.head ?? 'landmark') !== 'landmark') return hero;
  const F = TIERED_FACE[pole] ?? TIERED_FACE.male, own = hero.face == null ? [] : Array.isArray(hero.face) ? hero.face : [hero.face];
  const target = heroTarget(hero), fullEar = !!target && TIERED_FULL_EAR_TIERS.includes(tierOf(readTarget(target).figurePx).id);
  return { ...hero, face: [F.face, ...own], faceFeatures: fullEar ? F.features : { ...F.features, earLean: true } };
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
 */
export function tieredKit(kit, plan) {
  if (!Array.isArray(kit) || !kit.length) return kit;
  const seg = (n) => (plan.segments || []).find((s) => s.name === n.replace(/L$/, 'R'));
  const sideOf = (n) => (/L$/.test(n) ? 'L' : /R$/.test(n) ? 'R' : null);
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
    // the balls stand out of the torso at the shoulder: what the torso or the neck carries stands off them
    if ((A.part === 'torso' || A.part === 'neck') && seg('shoulderBallR')) B = { ...B, over: [...new Set([...(B.over || []), 'shoulderBallR', 'shoulderBallL', ...(seg('shoulderWebR') ? ['shoulderWebR', 'shoulderWebL'] : [])])] };
    return B;
  });
}
