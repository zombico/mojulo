/**
 * PROTOFORM — the parametrized human figure as a pure geometry function.
 *
 * `buildProtoform(positions, proto)` takes the world-space figure landmarks (the
 * articulated manji armature, `articulate()` from figure-vajra.js) and a `proto`
 * tuning config, and returns the FLESH as tagged ring-stacks — no camera, no
 * lighting, no projection. The spike
 * (figure-readable-envelope.spike.gen.test.js) is the renderer over this: it
 * lights each stack's rings with vexar and paints the study sheets.
 *
 * The model (lite-template/integration/0610/figure-proto-params.plan.md):
 *
 *   proto ──▶ geometry (flesh pieces, parametrized)
 *         ──▶ rig      (figure-rig.js, same DIMORPH pole)
 *
 * `proto` has three layers, all defaulting to the canonical hand-sculpted male
 * (`PROTO_DEFAULT`), so `buildProtoform(p)` reproduces `8a-stitched-vexar`:
 *
 *   - GLOBAL knobs: height (overall scale), stockiness (girth about each
 *     centerline, lengths fixed), articulation (jointing tier — `max` here).
 *   - SEX: selects the dimorphic pole DIMORPH[sex] (shared with figure-rig.js).
 *   - PER-REGION knobs: intra-sex multipliers (1 = canonical) layered ON TOP of
 *     the dimorphic baseline — chestWidth, bicep, quad, gluteSize, groinDrop, …
 *
 * The locked manji armature (figure-vajra.js) is never parametrized here — proto
 * scales/collapses the flesh + the rig declaration, not the joint kinematics.
 */
import { sampleVajra } from './vajra.js';
import { lerp, chakras } from './vajra-body.js';
import { DIMORPH } from './figure-rig.js';
import { headRings, neckGirthFactor, HEAD_KNOB_DEFAULTS } from './figure-head.js';

// Canonical config = today's hand-tuned male figure. Per-region knobs are
// intra-sex multipliers (1 = canonical); sex picks the dimorphic baseline.
export const PROTO_DEFAULT = {
  // global
  height: 1.0,
  weight: 1.0,           // ONE number for how heavy the figure reads. Not a uniform scale —
                         //   it distributes across the region dials the way a body actually
                         //   carries mass (belly first and forward, then hips and thighs, the
                         //   waist un-tucking, the forearms barely at all). See WEIGHT_GAIN.
                         //   NOTE: `pose.weight` is a different thing entirely — which foot the
                         //   figure's weight is over. This one is the body; that one is balance.
  stockiness: 1.0,
  headScale: 1.0,        // skull size about the neck join — the dominant child↔adult cue
                         //   (>1 enlarges the cranium; "heads-tall" ages a figure down without armature edits)
  articulation: 'max',
  sex: 'male',
  stitched: true,        // canonical 8a build (pelvis folded in, tank + shirts)
  // per-region (multipliers on the dimorphic baseline; 1 = canonical)
  chestWidth: 1,         // ribcage CROSS-SECTION — breadth and depth together (it always has)
  chestDepth: 1,         // ribcage fore/aft ALONE, on top of chestWidth: > 1 = deep-chested,
                         //   < 1 = a slab. The axis chestWidth could never reach on its own.
  pelvisDepth: 1,        // the lower trunk's fore/aft (hip level) — the pelvis's own depth;
                         //   the waist between them follows, since its depth is their lerp.
  pecProjection: 1,      // pec-plate / breast forward dome
  tankVee: 1,            // lat/oblique V-flare of the side form
  waistTuck: 1,          // waist pinch depth
  dantien: 1,            // lower-belly MASS, uniform (breadth, depth and height together)
  bellyDepth: 1,         // the belly's forward protrusion ALONE, on top of dantien. Grows FORWARD
                         //   only — the back edge stays put — so > 1 is a gut, not a sphere.
  bellyDrop: 0,          // where that mass sits, as a fraction of its OWN height (0 = canonical):
                         //   + sits lower (a low-slung gut), − rides higher (a barrel stomach).
  bellyFill: 0,          // THE TRUNK'S OWN belly swell (0 = canonical). `dantien` is a separate
                         //   ellipsoid unioned on, so growing it enlarges a BALL whose silhouette
                         //   reads as an object stuck to the torso. This swells the trunk itself
                         //   around the belly — one continuous profile — and is what `weight`
                         //   drives. Reach for `dantien` only when you want that distinct mass.
  bicep: 1,              // upper-arm ANTERIOR + posterior lobes — FORE/AFT ONLY. It scales the two
                         //   lobes that add into the arm's `ap` radius and never touches the
                         //   lateral one, so it does not widen the arm from the FRONT at any
                         //   setting. `armWidth` is that axis; this one is the profile.
  armWidth: 1,           // the upper arm's LATERAL breadth, on top of `bicep` — the axis nothing
                         //   could reach (the side radius was bare `baseR`). Eased along the lobe
                         //   profile so the deltoid and elbow caps still cover the ends.
  tricep: 1,             // the POSTERIOR upper-arm lobe alone, on top of `bicep` (which drove both
                         //   lobes together). Muscle reads anterior, gained weight reads posterior
                         //   — welded to one dial, an arm could only ever be a bigger bicep.
  forearm: 1,            // forearm belly volume (BOTH axes — it rides the ring radius itself)
  forearmDrop: 0,        // WHERE that belly sits along the forearm (0 = canonical, peak at 0.40).
                         //   + slides it toward the wrist, − up into the elbow. The volume dial
                         //   could only ever make the same shape bigger.
  wristGirth: 1,         // the wrist's own thickness. `wristTaper` FLATTENS the wrist (it is the
                         //   flipper dial) and moved girth only as a side effect; this is the
                         //   bone-thin ↔ thick-wristed axis, localized at the hand end.
  quad: 1,               // thigh (quad) FRONT lobe — fore/aft only, the leg's mirror of `bicep`
  thighWidth: 1,         // the thigh's LATERAL breadth, on top of `quad`. Localized to the thigh
                         //   band, so it eases to an exact no-op by the calf.
  hamstring: 1,          // the thigh's POSTERIOR lobe — the back of the leg, which had no dial at
                         //   all. The leg's mirror of `tricep`.
  adductor: 1,           // the thigh's MEDIAL lobe (the inner thigh), also undialed until now. It
                         //   is what closes a heavy leg at the top; `thighWidth` opens it outward.
  deltoid: 1,            // the shoulder cap's mass. It and the elbow were the joints with no dial,
                         //   so segments could inflate while the joints they hang from held still.
  elbowCap: 1,           // the elbow cap's mass — the hinge's half of the same gap.
  calf: 1,               // calf lobe volume (both axes)
  calfDrop: 0,           // WHERE the calf belly sits (0 = canonical, the crest at 0.488 of the leg
                         //   against a knee trough at 0.442). + slides it DOWN the shank — measured
                         //   0.488 / 0.512 / 0.535 / 0.581 / 0.605 at 0 / .02 / .08 / .10 / .12, the
                         //   long low calf. − does NOT raise it: the knee pinch bounds the crest, so
                         //   the mass concentrates instead and the calf reads shorter and tighter.
                         //   That bound is anatomy, not a clamp — a gastroc does not sit above the
                         //   joint. Frozen at every dial and every weight until now, and it is the
                         //   axis a calf is actually read on.
  ankleGirth: 1,         // the ankle band's own thickness — the taper the shank makes into the
                         //   foot. Nothing reached it: `calf: 2` moved the measured ankle 1.3 %.
  wristTaper: 1,         // how flat the wrist tapers (for the flipper hand)
  gluteSize: 1,          // glute bun mass (all three axes)
  gluteRear: 1,          // REAR projection alone, on top of the sex pole's own rear scale — the
                         //   shelf↔flat axis in the lateral view, independent of overall size
  hipFlare: 1,           // the hip cap's mass over the ball joint — the one body mass that had
                         //   no dial of its own; widens the hip's own flesh, not the landmark
  scapulaBun: 1,         // upper-back scapula mass
  footLength: 1,         // foot forward reach
  handSize: 1,           // hand paddle scale
  groinDrop: 1,          // male groin orb drop below the glute line
  // head (figure-head.js) — multipliers on the sex pole's skull: browRidge, jawWidth, chinPoint,
  // noseSize, cheekbone, foreheadSlope, neckGirth
  ...HEAD_KNOB_DEFAULTS,
};

// ─── WEIGHT — one dial, distributed ──────────────────────────────────────
// Mass does not go on evenly, so `weight` is not `stockiness`. Each entry is a region's
// RESPONSE to a unit of weight: the effective dial is `base × (1 + (weight − 1) × gain)`, so
// the operator's own dials still multiply on top (weight is a global gain, not a group alias —
// unlike the cast's arm/leg/limb groups, where an explicit dial wins instead).
//
// Because every one of these is a multiplier, weight is inherently RELATIVE to the frame it is
// applied to: the same `weight` reads as the same gain on a broad torso and a narrow one, and
// the belly's added mass scales with the trunk it sits on rather than being a fixed amount.
//
// The shape of the table is the anatomy: the abdomen takes the most and takes it FORWARD, the
// hips and thighs next, the waist un-tucks as it fills, the V-taper flattens, and the forearms
// and calves barely move — which is why a heavy figure reads heavy rather than merely inflated.
export const WEIGHT_GAIN = Object.freeze({
  // The trunk's middle — the most responsive region, and it goes forward. These two look small
  // for the most responsive region because they COMPOUND: `bellyDepth` multiplies the fore/aft
  // that `dantien` already scaled, and `stockiness` multiplies the result again. Driving both at
  // full strength made the belly a detached sphere wider than the trunk by weight 2 (measured
  // 4.77× forward). At these gains the forward extent runs 1.21 / 1.46 / 1.86 at weight
  // 1.3 / 1.6 / 2.0 and never leaves the trunk's silhouette — pinned in figure-torso.test.js.
  dantien: 0.12, bellyDepth: 0.10, waistTuck: -0.85, tankVee: -0.35,
  // the seat
  gluteSize: 0.32, gluteRear: 0.20, hipFlare: 0.50, pelvisDepth: 0.28,
  // The ribcage. Width LEADS depth: a heavier torso reads wider from the front and deeper in
  // profile at roughly the same rate. Depth used to be nearly double the width gain, which built
  // a deep narrow slab — passable head-on and grotesque from the side.
  chestWidth: 0.48, chestDepth: 0.30, scapulaBun: 0.28,
  // The limbs — proximal fills, distal hardly does. The first four are the FORE/AFT lobes and were
  // the only limb entries here; on their own they left `upperArm/bust` falling 0.388 → 0.342 and
  // `thigh/hip` 0.504 → 0.474 across weight 1 → 2, because a limb's LATERAL radius had no dial to
  // gain on and the whole front-view response was the `stockiness` line below. The second row is
  // that axis, plus the lobes where gained mass actually sits (posterior on the arm, posterior and
  // medial on the thigh) and the joints the segments hang from. Solved against the ratio, not
  // chosen: strengths 0.34 (arm set) and 0.14 (leg set) hold both ratios inside +5 / −0 % over
  // weight 1 → 2 on both poles. Pinned in figure-limb.test.js.
  bicep: 0.22, forearm: 0.10, quad: 0.32, calf: 0.14,
  armWidth: 0.34, tricep: 0.34, deltoid: 0.23, elbowCap: 0.14,
  thighWidth: 0.14, hamstring: 0.19, adductor: 0.22,
  // the all-over component (girth about every centerline) and the face
  stockiness: 0.15, neckGirth: 0.25, cheek: 0.70, jawWidth: 0.20,
});
// Dials that are OFFSETS rather than multipliers get the gain added, not multiplied in.
// A heavy belly also sits lower, which is most of why it reads as weight and not as muscle.
export const WEIGHT_OFFSET = Object.freeze({ bellyDrop: 0.30, bellyFill: 0.80 });
const WEIGHT_FLOOR = 0.05;   // nothing inverts or collapses, however lean the figure
// How much of `bellyDepth`'s added fore/aft goes FORWARD (the rest fills the flanks and back).
// 1 pins the back and reads as a ball hung off the front; a real middle carries it mostly forward.
const BELLY_FORWARD_BIAS = 0.6;
// THE BELLY IS PART OF THE BODY, not an ornament on the front of it. The dantien is its own
// ring-stack unioned onto the trunk, so nothing stopped it outgrowing the torso it sits on: at
// weight 2 it stood 31 % of the trunk's own fore/aft proud of it (canonical: 19 %) and the side
// profile read as a ball hung off the chest. `seatBelly` seats it back so its forward reach stays
// the proportion of the trunk it has at canonical, whatever the dials say — a self-limiting rule,
// so a hand-set `dantien: 3` is bounded too, not just a heavy `weight`.
/** Resolve `weight` into the region dials. weight === 1 is an exact no-op, by construction. */
export function applyWeight(P) {
  const w = P.weight;
  if (w === 1) return P;
  const out = { ...P };
  for (const [k, gain] of Object.entries(WEIGHT_GAIN)) {
    out[k] = out[k] * Math.max(WEIGHT_FLOOR, 1 + (w - 1) * gain);
  }
  for (const [k, gain] of Object.entries(WEIGHT_OFFSET)) out[k] = out[k] + (w - 1) * gain;
  return out;
}

// A superposed mass must not grow TWICE. The belly and the seat are separate ring-stacks unioned
// onto the trunk, and each was authored so that its dial scales its radius AND slides its centre
// away from the body — so the reach grew quadratically and the side profile turned into spheres
// bolted to a torso (the seat hit 80 % of the trunk's own depth behind it at weight 2, against a
// canonical 55 %). The centres below are therefore fixed to the SEX POLE, never to the dial: the
// dial scales the mass, the pole places it. At every dial's default this is exactly canonical.
//
// A ratio cap was tried first and thrown away: the canonical ratio is not a constant (the seat
// runs 0.34–0.67 across the poles and stockiness), so any fixed cap clips real figures.
// limb-lobe baselines (the old BUILD=1 adjusters; per-region knobs scale these)
const BUILD = 1.0;
const BICEP_ADJ = 0.0276 * BUILD;   // anterior upper-arm lobe (+15%)
const TRICEP_ADJ = 0.022 * BUILD;   // posterior upper-arm lobe

const vnorm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
const vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

// ─── Breast (sex-aware chest front) — pure STAND-space points so the bust
// study can sample the same surface as ring-WAVES. Exported for that study.
// One point: rr = footprint radius (0 nipple → 1 terminator), a = around-angle.
export function breastPt(p, sgn, rr, a, { dim, breastScale = 1, chestWidth = 1, chestDepth = 1, pecProjection = 1 } = {}) {
  const W = 0.082 * dim.ribW * chestWidth, AP = 0.058 * dim.ribW * chestWidth * chestDepth, cyT = 0.012;
  const nz = lerp(p.navel.z, p.neckHub.z, 0.56), betaN = 44 * Math.PI / 180;
  const proj = 0.045 * breastScale * pecProjection, K = 1.9, hZ = 0.85, dBmax = 30 * Math.PI / 180, dZmax = 0.052 * breastScale;
  const ca = Math.cos(a), sa = Math.sin(a), lower = Math.max(0, -sa), upper = Math.max(0, sa), medial = Math.max(0, -ca), lateral = Math.max(0, ca);
  const denom = 0.45 + 0.34 * lower + 0.26 * upper + 0.30 * medial, kk = K + 0.5 * lower + 0.35 * upper + 0.4 * medial;
  const fwd = proj * Math.exp(-Math.pow(rr / denom, kk)) * (1 + 0.30 * lower * lateral);
  const dB = dBmax + 0.25 * medial, beta = betaN + rr * ca * dB;
  const bx = sgn * W * Math.sin(beta), by = cyT + AP * Math.cos(beta), tip = fwd / proj;
  return { x: bx + fwd * sgn * Math.sin(beta) - sgn * 0.0143 * tip, y: by + fwd * Math.cos(beta), z: nz + rr * sa * dZmax * hZ - 0.016 * tip };
}

// Dimorphic proportion layer — scale the shoulder/hip landmark widths (the
// shoulder:hip ratio), shifting each hanging limb with its girdle. Topology +
// LIMITS untouched; the flesh and the rig slots both follow. dim={1,1}=identity.
export function proportioned(p, dim) {
  const q = {};
  for (const k of Object.keys(p)) q[k] = { ...p[k] };
  for (const s of ['L', 'R']) {
    const dShoulder = q['shoulder' + s].x * (dim.shoulder - 1);
    q['shoulder' + s].x += dShoulder; q['elbow' + s].x += dShoulder; q['wrist' + s].x += dShoulder;
    const dHip = q['hip' + s].x * (dim.hip - 1);
    q['hip' + s].x += dHip;
    const dLeg = dHip * 0.45;
    q['knee' + s].x += dLeg; q['ankle' + s].x += dLeg;
  }
  return q;
}

/**
 * Build the figure's flesh as an array of tagged ring-stacks `{ id, rings }`.
 * Pure: no camera/render. Stockiness is applied here (girth about each
 * centerline), so the renderer just lights the rings.
 *
 * @param {object} positions  armature the flesh is built on (trunk + girdle + arms)
 * @param {object} [proto]     figure tuning ({ sex, height, build knobs … })
 * @param {?object} [legNodes] when given, the leg+foot stacks are built from THESE
 *   armature nodes instead of `positions` — used to build the legs on the balanced
 *   ground-IK solve while the rest of the body stays in the (warped) rest frame, in
 *   one pass. Default null → legs use `positions` (canonical, unchanged).
 */
export function buildProtoform(positions, proto = {}, legNodes = null, footFlex = null, handFlex = null, face = null) {
  const P = applyWeight({ ...PROTO_DEFAULT, ...proto });
  const dim = DIMORPH[P.sex];
  const SCALE = 12 * P.height;
  const toWorld = (q) => ({ x: q.x * SCALE, y: q.y * SCALE, z: q.z * SCALE });

  // ── world-space primitives ──
  const worldRingsVajra = (a, c, b, radii, cs = 36, samples = 18) => sampleVajra({
    proximal: toWorld(a), center: toWorld(c), distal: toWorld(b),
    beads: { proximal: { radius: radii[0] * SCALE }, center: { radius: radii[1] * SCALE }, distal: { radius: radii[2] * SCALE } },
    blend: 0.022 * SCALE, crossSections: cs, samples,
  }).rings;
  const ellipsoidRings = (c, rx, ry, rz, { N = 18, M = 28 } = {}) => {
    const rings = [];
    for (let i = 0; i < N; i++) {
      const v = Math.PI * (i / (N - 1) - 0.5), cz = c.z + rz * Math.sin(v), rr = Math.cos(v);
      const poly = [];
      for (let j = 0; j <= M; j++) { const a = (j / M) * Math.PI * 2; poly.push(toWorld({ x: c.x + rx * rr * Math.cos(a), y: c.y + ry * rr * Math.sin(a), z: cz })); }
      rings.push({ polyline: poly, center: toWorld({ x: c.x, y: c.y, z: cz }) });
    }
    return rings;
  };

  // ── head / neck ── built along their BONES so they follow the neck + head
  // joints (skull rides headBase→headTop; neck column rides neckHub→headBase).
  // `up` runs along the bone, `fwd` is anterior (≈+y), `side` lateral; neutral
  // (bone = +z) reproduces the old centerline build exactly.
  const boneFrame = (P, Q) => {
    const up = vnorm(vsub(Q, P)), yd = up.y;
    let fwd = vnorm({ x: -up.x * yd, y: 1 - up.y * yd, z: -up.z * yd });
    if (Math.hypot(fwd.x, fwd.y, fwd.z) < 1e-6) fwd = { x: 0, y: 1, z: 0 };
    const side = vnorm(vcross(fwd, up));
    return { up, fwd, side };
  };
  const onBone = (anchor, f, a, fw, sd = 0) => ({
    x: anchor.x + f.up.x * a + f.fwd.x * fw + f.side.x * sd,
    y: anchor.y + f.up.y * a + f.fwd.y * fw + f.side.y * sd,
    z: anchor.z + f.up.z * a + f.fwd.z * fw + f.side.z * sd,
  });
  // THE HEAD (figure-head.js): one closed ring stack marched by latitude off a field of named
  // anatomical primitives in the head bone frame, on the sex pole (`dim.head`) × the per-region
  // head knobs, with the jaw/mouth `face` dials. headScale grows it about p.headBase (the
  // neck↔skull join) so the skull scales in place without detaching from the neck (the head
  // is a terminal segment — nothing rides on it). This is the child↔adult lever.
  const hs = P.headScale;
  const headStack = (p) => headRings(p, { hs, dim, knobs: P, face }).map((r) => ({ center: toWorld(r.center), polyline: r.polyline.map(toWorld) }));
  // the neck column: sex-aware girth (female thinner) × the neckGirth knob
  const neckRings = (p) => {
    const f = boneFrame(p.neckHub, p.headBase);
    const len = Math.hypot(p.headBase.x - p.neckHub.x, p.headBase.y - p.neckHub.y, p.headBase.z - p.neckHub.z);
    const base = onBone(p.neckHub, f, len, 0.01);
    const mid = onBone(p.neckHub, f, len * 0.5, 0.005);
    const root = onBone(p.neckHub, f, 0, 0.0);
    const ng = neckGirthFactor(dim, P);
    return worldRingsVajra(base, mid, root, [0.032 * ng, 0.031 * ng, 0.044 * ng], 32, 20);
  };
  const clavicleRings = (p, sgn) => {
    const sh = sgn < 0 ? p.shoulderL : p.shoulderR;
    const notch = { x: 0.004 * sgn, y: 0.034, z: p.neckHub.z + 0.006 };
    const mid = { x: sh.x * 0.45, y: 0.03, z: p.neckHub.z + 0.006 };
    const end = { x: sh.x * 0.9, y: 0.012, z: sh.z + 0.004 };
    return worldRingsVajra(notch, mid, end, [0.012, 0.015, 0.019], 24, 14);
  };

  // ── trunk / torso ──
  const trunkRibRings = (p, stitched = false, { N = 56, M = 32 } = {}) => {
    const costalZ = lerp(p.navel.z, p.neckHub.z, 0.02);
    const T1z = p.neckHub.z + 0.015;
    const pelvZ = p.pelvisHub.z;
    const hipHalf = Math.abs(p.hipL.x);
    const tilt = 18 * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
    const W = 0.088 * dim.ribW * P.chestWidth, AP = 0.060 * dim.ribW * P.chestWidth, t0 = 0.5;
    const g = (x, mu, s) => Math.exp(-Math.pow((x - mu) / s, 2));
    const bez = (a, b, c, d, t) => { const m = 1 - t; return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d; };
    const eggProf = (t) => Math.sin(Math.PI * (t < t0 ? lerp(0.30, 0.5, t / t0) : lerp(0.5, 0.80, (t - t0) / (1 - t0))));
    const rxTop = W * eggProf(0), apTop = AP * eggProf(0);
    const cyTop = bez(-0.005, -0.06, -0.06, 0.005, 0) + apTop * ct;
    const rxHip = 0.058, apHip = 0.052, cyHip = 0.004;
    const rings = [];
    for (let i = 0; i < N; i++) {
      const z = lerp(pelvZ, T1z, i / (N - 1));
      // `ap0` is the canonical fore/aft; `apK` is the depth DIAL at this height (the pelvis's
      // below the ribs, the chest's above, interpolated between). The ring's centre is computed
      // from ap0 and the radius from ap0 × apK, so a depth dial grows the trunk about its own
      // surface centre instead of off a pinned back. The trunk is authored back-anchored
      // (`cy = bez + ap·ct` puts the spine at y = bez), so scaling ap directly sent every
      // millimetre of added depth FORWARD — at weight 2 the front travelled +1.24 and the back
      // −0.20, which is what made the side profile read as a shelf rather than a heavier body.
      let rx, ap0, apK, cy;
      if (z >= costalZ) {
        const tt = (z - costalZ) / (T1z - costalZ), prof = eggProf(tt);
        rx = W * prof; ap0 = AP * prof; apK = P.chestDepth;
        cy = bez(-0.005, -0.06, -0.06, 0.005, tt) + ap0 * ct;
      } else {
        const uu = (z - pelvZ) / (costalZ - pelvZ), waist = g(uu, 0.5, 0.26);
        rx = lerp(rxHip, rxTop, uu) - 0.006 * dim.waist * P.waistTuck * waist;
        // the waist's DEPTH pinch rides `waistTuck` exactly as its width pinch does. It did not,
        // so a heavy figure filled out all round a groove that stayed at full strength — the
        // concave belt between the belly swell and the ribcage in the side view. At waistTuck 1
        // this is the canonical figure unchanged; weight relaxes the tuck and the groove opens.
        ap0 = lerp(apHip, apTop, uu) - 0.005 * P.waistTuck * waist;
        apK = lerp(P.pelvisDepth, P.chestDepth, uu);
        cy = lerp(cyHip, cyTop, uu) + 0.008 * g(uu, 0.45, 0.38);
        // THE BELLY, as part of the trunk. A swell on the trunk's own section around the navel,
        // so a heavy middle is ONE silhouette instead of a sphere overlapping a torso. It
        // deepens more than it widens and carries slightly forward, which is how a middle is
        // actually held; the back still fills, so the side profile stays a body.
        // The swell is centred at uu 0.42 and spread 0.42 so it reaches the ribcage before it
        // falls away. Narrower (0.36 / 0.30) it peaked below the waist and died before the ribs
        // picked up, leaving a concave belt right where a heavy figure should be fullest —
        // measured 0.091 below the lateral outline's own convex hull at weight 1.6, against
        // 0.021 here. That belt was the concavity in the side profile.
        if (P.bellyFill) {
          const bell = g(uu, 0.42, 0.42);
          rx += P.bellyFill * 0.026 * bell;
          ap0 += P.bellyFill * 0.040 * bell;
          cy += P.bellyFill * 0.014 * bell;
        }
        if (stitched) {
          const flare = g(uu, 0.0, 0.30);
          rx += (hipHalf * 0.80 - rxHip) * flare;
          ap0 += 0.006 * flare;
          cy += 0.020 * flare;
        }
      }
      const ap = ap0 * apK;
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2, nx = Math.cos(a), fwd = Math.sin(a);
        poly.push(toWorld({ x: rx * nx, y: cy + ap * fwd * ct, z: z - ap * fwd * st }));
      }
      rings.push({ polyline: poly, center: toWorld({ x: 0, y: cy, z }) });
    }
    return rings;
  };
  const coreSideRings = (p, sgn, { N = 30, M = 26 } = {}) => {
    const armpitZ = lerp(p.shoulderL.z, p.navel.z, 0.26);
    const trochZ = p.hipL.z - 0.02;
    const g = (x, mu, s) => Math.exp(-Math.pow((x - mu) / s, 2));
    const PHI0 = 72 * Math.PI / 180, PHI1 = -88 * Math.PI / 180;
    const rings = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), z = lerp(armpitZ, trochZ, t);
      const rTrunk = 0.064 + 0.020 * g(t, 0.0, 0.34) + 0.030 * g(t, 1.0, 0.26);
      const vFlare = (0.55 * g(t, 0.24, 0.30) + 0.45 * g(t, 0.88, 0.22)) * P.tankVee;
      const vol = vFlare * Math.min(1, t / 0.07);
      const cy = 0.008 + 0.014 * g(t, 0.45, 0.42);
      const depth = 1 - 0.26 * g(t, 0.16, 0.30) - 0.20 * g(t, 0.64, 0.22);
      const phiFront = (t < 0.5 ? lerp(50 * Math.PI / 180, PHI0, t / 0.5) : lerp(PHI0, Math.PI * 0.53, (t - 0.5) / 0.5));
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const f = j / M, phi = lerp(phiFront, PHI1, f);
        const arcEnv = 0.35 + 0.65 * Math.sin(Math.PI * f);
        const R = rTrunk + vol * 0.034 * arcEnv;
        poly.push(toWorld({ x: sgn * R * Math.cos(phi), y: cy + R * depth * Math.sin(phi), z }));
      }
      rings.push({ polyline: poly, center: toWorld({ x: 0, y: cy, z }) });
    }
    return rings;
  };
  const pecShirtRings = (p, sgn, { N = 12, M = 18 } = {}) => {
    const sh = sgn < 0 ? p.shoulderL : p.shoulderR;
    const lerp3 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const A = { x: sgn * Math.abs(sh.x) * 0.86, y: 0.034, z: lerp(p.navel.z, p.neckHub.z, 0.94) };
    const C = { x: sgn * 0.088, y: 0.026, z: lerp(p.navel.z, p.neckHub.z, 0.42) };
    const B1 = { x: sgn * 0.008, y: 0.082, z: lerp(p.navel.z, p.neckHub.z, 0.92) };
    const B2 = { x: sgn * 0.008, y: 0.082, z: lerp(p.navel.z, p.neckHub.z, 0.42) };
    const rings = [];
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1), med = lerp3(B2, B1, v), lat = lerp3(C, A, v);
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const u = j / M, base = lerp3(med, lat, u);
        const top = Math.pow(v, 1.8);
        const dome = Math.sin(Math.PI * u) * Math.sin(Math.PI * Math.min(0.86, 0.10 + 0.9 * v)) * 0.025 * P.pecProjection;
        const roll = top * 0.024 * Math.sin(Math.PI * Math.min(1, 0.25 + 0.75 * u));
        poly.push(toWorld({ x: base.x, y: base.y + dome * (1 - 0.6 * top) - roll * 0.6, z: base.z + roll * 0.6 }));
      }
      rings.push({ polyline: poly, center: toWorld({ x: 0, y: 0.012, z: (med.z + lat.z) / 2 }) });
    }
    return rings;
  };
  const scapulaShirtRings = (p, sgn, { N = 12, M = 18 } = {}) => {
    const sh = sgn < 0 ? p.shoulderL : p.shoulderR;
    const lerp3 = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    const A = { x: sgn * Math.abs(sh.x) * 0.92, y: -0.028, z: lerp(p.navel.z, p.neckHub.z, 0.90) };
    const C = { x: sgn * 0.086, y: -0.024, z: lerp(p.navel.z, p.neckHub.z, 0.44) };
    const B1 = { x: sgn * 0.010, y: -0.062, z: lerp(p.navel.z, p.neckHub.z, 0.80) };
    const B2 = { x: sgn * 0.010, y: -0.062, z: lerp(p.navel.z, p.neckHub.z, 0.44) };
    const rings = [];
    for (let i = 0; i < N; i++) {
      const v = i / (N - 1), med = lerp3(B2, B1, v), lat = lerp3(C, A, v);
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const u = j / M, base = lerp3(med, lat, u);
        const round = Math.sin(Math.PI * Math.min(1, 0.05 + 0.95 * u)) * Math.sin(Math.PI * Math.min(1, 0.08 + 0.92 * v)) * 0.022;
        poly.push(toWorld({ x: base.x, y: base.y - round, z: base.z }));
      }
      rings.push({ polyline: poly, center: toWorld({ x: 0, y: 0.0, z: (med.z + lat.z) / 2 }) });
    }
    return rings;
  };
  const breastRings = (p, sgn) => {
    const nz = lerp(p.navel.z, p.neckHub.z, 0.56), PHI = 1.618, M = 32;
    const opts = { dim, breastScale: dim.breast, chestWidth: P.chestWidth, chestDepth: P.chestDepth, pecProjection: P.pecProjection };
    const rrs = [];
    for (let rr = 1, n = 0; n < 10 && rr > 0.02; rr /= PHI, n++) rrs.push(rr);
    rrs.push(0);
    return rrs.map((rr) => {
      const poly = [];
      for (let j = 0; j <= M; j++) poly.push(toWorld(breastPt(p, sgn, rr, (j / M) * Math.PI * 2, opts)));
      return { polyline: poly, center: toWorld({ x: 0, y: 0.012, z: nz }) };
    });
  };

  // ── pelvis ──
  const pelvisRings = (p, { N = 16, M = 30 } = {}) => {
    const hipHalf = Math.abs(p.hipL.x);
    const floorZ = p.hipL.z - 0.035, rimZ = p.hipL.z + 0.07;
    const tilt = 20 * Math.PI / 180, ct = Math.cos(tilt), st = Math.sin(tilt);
    const rings = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), z = lerp(floorZ, rimZ, t);
      const rx = lerp(hipHalf * 0.92, hipHalf * 0.98, t), apH0 = lerp(0.044, 0.056, t), apH = apH0 * P.pelvisDepth, yBack = lerp(-0.008, -0.024, t);
      const cy = yBack + apH0 * ct, cz = z - apH0 * st;
      const poly = [];
      for (let j = 0; j <= M; j++) { const a = (j / M) * Math.PI * 2, fwd = Math.sin(a); poly.push(toWorld({ x: rx * Math.cos(a), y: cy + apH * fwd * ct, z: cz - apH * fwd * st })); }
      rings.push({ polyline: poly, center: toWorld({ x: 0, y: cy, z: cz }) });
    }
    return rings;
  };
  const diaperRings = (p) => {
    const perineum = { x: 0, y: 0.032, z: p.pelvisHub.z - 0.04 };
    const inL = { x: p.hipL.x * 0.71, y: 0.006, z: p.hipL.z + 0.006 };
    const inR = { x: p.hipR.x * 0.71, y: 0.006, z: p.hipR.z + 0.006 };
    return worldRingsVajra(inL, perineum, inR, [0.04, 0.058, 0.04]);
  };

  // ── limbs ──
  const upperArmRings = (sh, el, { baseR = 0.0345 * (0.78 + 0.22 * dim.limb), bicep = BICEP_ADJ * dim.limb * P.bicep, tricep = TRICEP_ADJ * dim.limb * P.bicep * P.tricep, N = 22, M = 24 } = {}) => {
    const A = toWorld(sh), B = toWorld(el);
    const ax = vnorm({ x: B.x - A.x, y: B.y - A.y, z: B.z - A.z });
    const yd = ax.y;
    const ap = vnorm({ x: -ax.x * yd, y: 1 - ax.y * yd, z: -ax.z * yd });
    const side = vnorm(vcross(ax, ap));
    const rings = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const c = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t };
      const sp = Math.sin(Math.PI * (0.12 + 0.76 * t));
      const elbow = 1 - 0.36 * Math.pow(t, 2.2);
      const r = baseR * (0.5 + 0.5 * sp) * elbow * SCALE;
      // Posterior (tricep) lobe is slimmed and its mass reallocated DOWN the arm toward the
      // elbow: the mid-belly bulge is eased (less bulbous from the back) and a low taper
      // (distalFill, peaking near the elbow) carries that volume into the joint so the cap
      // reads as covered, not a separate bead. Anterior (bicep) gets the same gentle easing.
      const distalFill = Math.exp(-Math.pow((t - 0.86) / 0.18, 2));
      const bA = bicep * sp * elbow * SCALE * 0.86 + bicep * SCALE * 0.34 * distalFill;
      const tA = tricep * sp * elbow * SCALE * 0.72 + tricep * SCALE * 0.40 * distalFill;
      // LATERAL breadth. Both lobes above add into `ap` and nothing else, so until this dial
      // existed the upper arm's width from the FRONT was `baseR` at every setting of every dial —
      // a heavy arm and a lean one measured the same head-on, and only the profile moved. Shaped
      // like the lobes (sp · elbow) so the deltoid and elbow caps still cover the ends. At 1 the
      // factor is exactly 1, so the lateral radius stays `r` to the byte.
      const lr = r * (1 + (P.armWidth - 1) * sp * elbow);
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * Math.PI * 2, lat = Math.cos(th), apc = Math.sin(th);
        const ry = apc >= 0 ? r + bA : r + tA;
        poly.push({ x: c.x + side.x * lr * lat + ap.x * ry * apc, y: c.y + side.y * lr * lat + ap.y * ry * apc, z: c.z + side.z * lr * lat + ap.z * ry * apc });
      }
      rings.push({ polyline: poly, center: c });
    }
    return rings;
  };
  const forearmRings = (p, sgn) => {
    const el = sgn < 0 ? p.elbowL : p.elbowR, wr0 = sgn < 0 ? p.wristL : p.wristR;
    const wr = { x: el.x + (wr0.x - el.x) * 1.4, y: el.y + (wr0.y - el.y) * 1.4, z: el.z + (wr0.z - el.z) * 1.4 };
    const A = toWorld(el), B = toWorld(wr);
    const ax = vnorm({ x: B.x - A.x, y: B.y - A.y, z: B.z - A.z });
    const yd = ax.y;
    const ap = vnorm({ x: -ax.x * yd, y: 1 - ax.y * yd, z: -ax.z * yd });
    const side = vnorm(vcross(ax, ap));
    const N = 26, M = 20, rings = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1);
      const c = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, z: A.z + (B.z - A.z) * t };
      // The flexor belly is eased (less bulbous) and part of its mass reallocated PROXIMALLY
      // toward the elbow (elbowFill) so the forearm meets the joint with a fuller, smoother
      // shoulder into the cap instead of a pinched neck below a fat belly.
      // The belly's PLACE, not just its size. `forearm` scales this lobe and `forearmDrop` slides
      // it: the peak was pinned at 0.40 for every dial and every weight, so a forearm that carries
      // low into the wrist and one that bunches up under the elbow were the same forearm. 0 is the
      // canonical mu exactly, so the default is a no-op to the byte.
      const belly = Math.exp(-Math.pow((t - (0.40 + P.forearmDrop)) / 0.30, 2));
      const elbowFill = Math.exp(-Math.pow((t - 0.06) / 0.16, 2));
      // The wrist's own girth, localized hard at the hand end (t³) so the belly keeps its shape.
      // `wristTaper` is a FLATTENING dial — it squeezes the lateral radius and only moved girth
      // as a side effect — so the thin-wristed ↔ thick-wristed axis had no dial of its own.
      const wristEnd = t * t * t;
      const r = (0.013 + 0.018 * P.forearm * belly * 0.82 + 0.0085 * P.forearm * elbowFill + 0.011 * t * t) * SCALE
        * (1 + (P.wristGirth - 1) * wristEnd);
      const fr = r * 1.05, br = r * 0.92;
      const lr = r * (1 - 0.42 * P.wristTaper * Math.pow(t, 2.5));
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * Math.PI * 2, lat = Math.cos(th), apc = Math.sin(th), ry = apc >= 0 ? fr : br;
        poly.push({ x: c.x + side.x * lr * lat + ap.x * ry * apc, y: c.y + side.y * lr * lat + ap.y * ry * apc, z: c.z + side.z * lr * lat + ap.z * ry * apc });
      }
      rings.push({ polyline: poly, center: c });
    }
    return rings;
  };
  // The leg flesh extends past the ankle node so the lower leg reaches the FLOOR
  // as a hoof-like column (the heel), with the foot paddle attached to its front
  // (~+15% over the old 1.2, bringing the leg-bottom to just below the sole).
  const LEG_EXT = 1.45;
  // Rest flat-foot sole height (STAND): the leg-column bottom at rest (≈ −0.1165) minus the
  // sole offset (−0.026). A PLANTED foot is pinned to this constant floor so it doesn't
  // float/sink as the leg-column bottom rides the shank angle through stance.
  const FOOT_FLOOR = -0.143;
  // Rodrigues rotation of vector v about unit axis k by angle ang.
  const vrot = (v, k, ang) => {
    const c = Math.cos(ang), s = Math.sin(ang), kv = vcross(k, v), kd = k.x * v.x + k.y * v.y + k.z * v.z;
    return { x: v.x * c + kv.x * s + k.x * kd * (1 - c), y: v.y * c + kv.y * s + k.y * kd * (1 - c), z: v.z * c + kv.z * s + k.z * kd * (1 - c) };
  };
  const vlen = (a) => Math.hypot(a.x, a.y, a.z);
  // The leg as a tube swept along hip→knee→ankle with rings oriented to the LIMB
  // (a rotation-minimizing frame), not horizontal slices — so a raised or bent leg
  // follows its bones instead of collapsing. The frame is parallel-transported from
  // the hip, robust to any orientation (incl. a leg raised to horizontal, where a
  // fixed-axis frame degenerates). Same sculpt profile (quad/glute/ham/calf/ankle)
  // as before, just placed in (lateral `side`, anterior `ap`) instead of world x/y.
  const legRings = (hip, knee, ankle, sgn, { baseR = 0.023, quad = 0.026 * BUILD * dim.limb * P.quad, lat = 0.017 * BUILD * dim.limb, med = 0.016 * BUILD * dim.limb * P.adductor, post = 0.046 * BUILD, ham = 0.03 * BUILD * P.hamstring, calf = 0.04 * BUILD * dim.limb * P.calf, N = 44, M = 28 } = {}) => {
    const A0 = toWorld(hip), K0 = toWorld(knee), B0 = toWorld(ankle);
    const A = { x: A0.x * 0.85, y: A0.y, z: A0.z };
    const dz = (K0.z - A.z) * 0.15;
    const K = { x: K0.x, y: K0.y, z: K0.z + dz };
    const B = { x: K.x + (B0.x - K0.x) * LEG_EXT, y: K.y + (B0.y - K0.y) * LEG_EXT, z: K.z + (B0.z - K0.z) * LEG_EXT };
    const d = (u, v) => Math.hypot(u.x - v.x, u.y - v.y, u.z - v.z);
    const L3 = (u, v, t) => ({ x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t, z: u.z + (v.z - u.z) * t });
    const uK = d(A, K) / (d(A, K) + d(K, B));
    const g = (x, mu, s) => Math.exp(-Math.pow((x - mu) / s, 2));
    // centres + per-ring tangents along the bent path
    const cs = [], us = [];
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      us.push(u);
      cs.push(u <= uK ? L3(A, K, u / uK) : L3(K, B, (u - uK) / (1 - uK)));
    }
    const tang = cs.map((_, i) => vnorm(vsub(cs[Math.min(N - 1, i + 1)], cs[Math.max(0, i - 1)])));
    // rotation-minimizing frame: seed side ⟂ tangent at the hip, transport downward
    let side0 = vnorm(vcross(tang[0], { x: 0, y: 1, z: 0 }));
    if (vlen(side0) < 1e-6) side0 = vnorm(vcross(tang[0], { x: 1, y: 0, z: 0 }));
    const frames = [{ side: side0, ap: vnorm(vcross(side0, tang[0])) }];
    for (let i = 1; i < N; i++) {
      const ax = vcross(tang[i - 1], tang[i]), sn = vlen(ax);
      let s = frames[i - 1].side;
      if (sn > 1e-8) s = vrot(s, { x: ax.x / sn, y: ax.y / sn, z: ax.z / sn }, Math.atan2(sn, tang[i - 1].x * tang[i].x + tang[i - 1].y * tang[i].y + tang[i - 1].z * tang[i].z));
      s = vnorm(s);
      frames.push({ side: s, ap: vnorm(vcross(s, tang[i])) });
    }
    const rings = [];
    // Thigh + calf VOLUME factors — same form decision as the arm: ease the bellies so
    // the limb is leaner, the bulk reallocated toward the knee/ankle (the belly profiles
    // already taper there) instead of a fat mid-belly. TH scales the thigh bulges (quad
    // front, lat/med sides, ham), CF the calf. Glute/ankle bands left alone.
    const TH = 0.78, CF = 0.78;
    for (let i = 0; i < N; i++) {
      const u = us[i], c = cs[i], { side, ap } = frames[i];
      // `calfDrop` slides the calf belly along the shank (0 = canonical). It was pinned at
      // uK + 0.1 for every dial and every weight, so the high short calf and the long low one
      // were the same calf at different volumes. Exact no-op at 0.
      const thigh = g(u, 0.3, 0.23), calfB = g(u, uK + 0.1 + P.calfDrop, 0.22), pinch = g(u, uK, 0.05);
      // `ankleGirth` scales the ankle band's OWN contribution to the ring radius — the taper the
      // shank makes into the foot, which nothing reached (`calf: 2` moved the measured ankle by
      // 1.3 %). It rides the same tight band, so it stays out of the calf.
      const ankleHold = g(u, 1, 0.13) * P.ankleGirth;        // tighter band → a slimmer ankle
      const glute = g(u, 0.13, 0.21);
      const hamB = g(u, 0.3, 0.13);
      const r = baseR * (0.5 + 0.55 * thigh * TH + 0.6 * calfB * CF + 0.5 * ankleHold) * (1 - 0.34 * pinch) * SCALE;
      // LATERAL breadth at the thigh — the leg's half of the arm's missing axis. `quad` feeds the
      // FRONT radius alone and the lat/med lobe scales carry no dial, so the thigh's width from
      // the front was fixed at every setting. Localized by the thigh profile, which is ~0 by the
      // calf (measured: a 7 % leak at thighWidth 2, under 1 % at any weight-driven value), so the
      // lower leg keeps its own dial; at 1 the factor is exactly 1 and both radii
      // stay put to the byte.
      const widen = 1 + (P.thighWidth - 1) * thigh;
      const fr = r + quad * thigh * TH * SCALE + calf * calfB * 0.25 * CF * SCALE;
      const br = r + post * glute * SCALE + ham * hamB * TH * SCALE + calf * calfB * CF * SCALE;
      const latR = (r + lat * thigh * TH * SCALE + post * glute * 0.4 * SCALE + calf * calfB * 0.55 * CF * SCALE) * widen;
      const medR = (r + med * thigh * TH * SCALE + ham * hamB * 0.45 * TH * SCALE + post * glute * 0.55 * SCALE + calf * calfB * 0.55 * CF * SCALE) * widen;
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * Math.PI * 2, cx = Math.cos(th), sy = Math.sin(th);
        const xr = cx * sgn > 0 ? latR : medR;
        const yr = sy > 0 ? fr : br;
        poly.push({ x: c.x + side.x * xr * cx + ap.x * yr * sy, y: c.y + side.y * xr * cx + ap.y * yr * sy, z: c.z + side.z * xr * cx + ap.z * yr * sy });
      }
      rings.push({ polyline: poly, center: c });
    }
    return rings;
  };

  // ── masses (glutes / scapula buns) ──
  // Female glute projects less to the REAR (−30%): both the fore-aft radius and the centre's
  // backward offset are scaled, so the buttock bulges less AND sits less far back — the mass
  // that reads in the LATERAL (side) view, distinct from anatomical-lateral (x) width.
  const gluteRearPole = dim.sex === 'female' ? 0.70 : 1;          // the pole: places the mass
  const gluteRear = gluteRearPole * P.gluteRear;                   // the dial: sizes it
  const glute = (p, s) => ellipsoidRings(
    { x: s * Math.abs(p.hipL.x) * 0.47, y: -0.035 * dim.glute * gluteRearPole, z: p.hipL.z - 0.045 },
    0.052 * dim.glute * P.gluteSize, 0.055 * dim.glute * P.gluteSize * gluteRear, 0.062 * dim.glute * P.gluteSize,
  );
  // Hip cap — a rounded mass over the hip ball joint, nudged down the thigh so it
  // follows the leg's aim (the hip socket flesh moves WITH the leg, and the
  // thigh↔pelvis junction stays full through the leg's range — the deltoid trick,
  // for the hip). Built on the posed leg armature so it rides the thigh.
  const hipCap = (p, s) => {
    const hp = s < 0 ? p.hipL : p.hipR, kn = s < 0 ? p.kneeL : p.kneeR;
    const dir = vnorm({ x: kn.x - hp.x, y: kn.y - hp.y, z: kn.z - hp.z });
    const c = { x: hp.x * 0.9 + dir.x * 0.03, y: hp.y + dir.y * 0.03, z: hp.z + dir.z * 0.03 };
    return ellipsoidRings(c, 0.0377 * dim.hip * P.hipFlare, 0.041 * P.hipFlare, 0.0426 * P.hipFlare, { N: 14, M: 22 });
  };
  const scapBun = (p, s) => ellipsoidRings(
    { x: s * Math.abs(p.shoulderL.x) * 0.6, y: -0.032, z: lerp(p.navel.z, p.neckHub.z, 0.82) },
    0.052 * P.scapulaBun, 0.044 * P.scapulaBun, 0.054 * P.scapulaBun,
  );
  // Deltoid cap — a rounded mass seated over the glenohumeral joint, nudged down
  // the upper arm so it follows the arm's aim. Bridges the shoulder yoke and the
  // bicep so the joint stays sealed no matter how the arm swings (the cap rides
  // the shoulder, the upper-arm cylinder rotates under it).
  const deltoidCap = (p, s) => {
    const sh = s < 0 ? p.shoulderL : p.shoulderR, el = s < 0 ? p.elbowL : p.elbowR;
    const dir = vnorm({ x: el.x - sh.x, y: el.y - sh.y, z: el.z - sh.z });
    const c = { x: sh.x + dir.x * 0.026, y: sh.y + dir.y * 0.026 + 0.004, z: sh.z + dir.z * 0.026 };
    return ellipsoidRings(c, 0.040 * dim.shoulder * P.deltoid, 0.040 * P.deltoid, 0.046 * P.deltoid, { N: 16, M: 24 });
  };
  // Elbow cap — a small superposed ball seated at the elbow joint, the deltoid trick
  // for the hinge. As the elbow flexes, the upper-arm and forearm tubes meet at an
  // angle and a gap opens on the OUTER (convex) side of the bend — whitespace leaks
  // through the joint during arm motion. This ball fills that corner. It is nudged
  // toward the elbow point (the bend bisector, away from the crease) by an amount that
  // grows with the flex (≈0 when straight), seated slightly behind with a smaller
  // anterior radius so it does not push the FRONT silhouette. Rides the arm rigidly
  // (RIGID_ARM_STACKS) through the spine warp, like the deltoid/forearm.
  const elbowCap = (p, s) => {
    const sh = s < 0 ? p.shoulderL : p.shoulderR, el = s < 0 ? p.elbowL : p.elbowR, wr = s < 0 ? p.wristL : p.wristR;
    const up = vnorm(vsub(sh, el)), dn = vnorm(vsub(wr, el));         // elbow → shoulder, elbow → wrist
    const bis = { x: up.x + dn.x, y: up.y + dn.y, z: up.z + dn.z };   // 0 when straight (up ≈ −dn), grows as it folds
    const bend = Math.hypot(bis.x, bis.y, bis.z);
    const outer = bend > 1e-6 ? { x: -bis.x / bend, y: -bis.y / bend, z: -bis.z / bend } : { x: 0, y: -1, z: 0 };
    const k = 0.011 * bend;                                           // nudge toward the elbow point, only when bent
    const c = { x: el.x + outer.x * k, y: el.y + outer.y * k - 0.004, z: el.z + outer.z * k };
    const rr = 0.019 * (0.85 + 0.15 * dim.limb) * P.elbowCap;
    return ellipsoidRings(c, rr, rr * 0.85, rr, { N: 12, M: 20 });
  };

  // ── foot / hand ──
  // The leg now descends to the floor as a slim hoof (LEG_EXT); the foot is a
  // forefoot PADDLE attached to the FRONT of that leg-bottom and reaching forward
  // along the ground (toes), with only a small heel rounding behind. No more flat
  // slab floating under a bulbous ankle.
  const footRings = (p, sgn) => {
    const hip = sgn < 0 ? p.hipL : p.hipR, knee = sgn < 0 ? p.kneeL : p.kneeR, ankle = sgn < 0 ? p.ankleL : p.ankleR;
    const dz = (knee.z - hip.z) * 0.15, Kz = knee.z + dz;
    const Ktop = { x: knee.x, y: knee.y, z: Kz };
    const B = { x: knee.x + (ankle.x - knee.x) * LEG_EXT, y: knee.y + (ankle.y - knee.y) * LEG_EXT, z: Kz + (ankle.z - knee.z) * LEG_EXT };
    // Foot frame from the SHANK: the foot is built ⟂ to the lower leg and tracks it, so
    // it no longer floats world-flat and swivel at the ankle as the leg swings (a walk's
    // near-vertical shank still yields a flat forward foot; a sprint's angled shank
    // carries the foot with it). `f` = forefoot forward, `up` = sole→instep, `side` = lateral.
    const fsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const fnorm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const fcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const fdot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
    const down = fnorm(fsub(B, Ktop));                       // down the leg column (shank)
    const ff = footFlex ? (sgn < 0 ? footFlex.L : footFlex.R) : null;
    // Two independent ground weights: `flatten` rotates the sole flat to the floor (a walk's
    // plantigrade stance), `pin` drops the foot's lowest point onto the constant floor
    // (position). A sprint pins (forefoot touches down) without flattening (stays on the ball).
    const flattenW = Math.max(0, Math.min(1, ff ? (ff.flatten != null ? ff.flatten : ff.plant || 0) : 0));
    const pinW = Math.max(0, Math.min(1, ff ? ff.plant || 0 : 0));
    // Shank-relative forward (⟂ to the lower leg) — what a SWING foot tracks.
    const c90 = Math.cos(Math.PI / 2), s90 = Math.sin(Math.PI / 2);
    let fS = { x: down.x, y: down.y * c90 - down.z * s90, z: down.y * s90 + down.z * c90 };
    const fSd = fdot(fS, down); fS = fnorm({ x: fS.x - down.x * fSd, y: fS.y - down.y * fSd, z: fS.z - down.z * fSd });
    const upS = { x: -down.x, y: -down.y, z: -down.z };      // sole → instep, along the shank
    // Blend toward a world-FLAT foot (sole on the ground, toes forward +y) by plantedness, so
    // a PLANTED foot lies flat and the ankle absorbs the shank tilt as the leg vaults over it
    // (instead of the foot rocking with the shank — "no floor"). A swing foot stays shank-relative.
    let up = fnorm({ x: upS.x * (1 - flattenW), y: upS.y * (1 - flattenW), z: upS.z * (1 - flattenW) + flattenW });
    let f = fnorm({ x: fS.x * (1 - flattenW), y: fS.y * (1 - flattenW) + flattenW, z: fS.z * (1 - flattenW) });
    const fud = fdot(f, up); f = fnorm({ x: f.x - up.x * fud, y: f.y - up.y * fud, z: f.z - up.z * fud });   // f ⟂ up
    const side = fnorm(fcross(up, f));                       // medio-lateral
    // ANKLE JOINT (plantar/dorsiflexion): rotate the foot frame about the medio-lateral
    // axis off the neutral perpendicular. + = dorsiflex (toe up, heel-strike); − = plantarflex
    // (toe down — toe-off / running on the balls of the feet). Neutral 0 = ⟂ to the shank.
    const flexDeg = Math.max(-50, Math.min(40, ff ? ff.ankle || 0 : 0));
    if (flexDeg) {
      const ang = -flexDeg * Math.PI / 180, ca = Math.cos(ang), sak = Math.sin(ang);
      const rod = (v) => {                                   // Rodrigues rotation of v about `side`
        const kd = side.x * v.x + side.y * v.y + side.z * v.z;
        const kx = { x: side.y * v.z - side.z * v.y, y: side.z * v.x - side.x * v.z, z: side.x * v.y - side.y * v.x };
        return { x: v.x * ca + kx.x * sak + side.x * kd * (1 - ca), y: v.y * ca + kx.y * sak + side.y * kd * (1 - ca), z: v.z * ca + kx.z * sak + side.z * kd * (1 - ca) };
      };
      f = rod(f); up = rod(up);
    }
    const ptS = (along, lift, wide) => ({   // a foot point in STAND (pre-scale) coords
      x: B.x + f.x * along + up.x * lift + side.x * wide,
      y: B.y + f.y * along + up.y * lift + side.y * wide,
      z: B.z + f.z * along + up.z * lift + side.z * wide,
    });
    // A naturalized foot, swept along the foot frame: heel bulb → instep dome → a lifted
    // medial ARCH → the ball (widest, on the floor) → tapered toes. The TOE (MTP) JOINT
    // dorsiflexes the forefoot past the ball — the foot "breaks" at the ball as the heel
    // lifts (toe-off). `toe` ∈ 0..55° (+ = toes up). Sole `s`, instep `t`, half-width `hw`.
    // FOOT SCALE (footwear). The station numbers below are the foot's SHAPE; this is its size.
    // The canonical foot measured 18.1 % of stature — a EU 47 on a 170 cm figure, where a human
    // foot is about 15 % (and a shoe drafted from that tape would print at that size). `FOOT`
    // scales length, breadth and depth TOGETHER, so the foot keeps its proportions and only its
    // size changes; `footLength` stays what it was, an extra multiplier on forward reach alone.
    // `BREADTH` then trims the width alone: at a uniform scale the foot came out 42 % as broad as
    // it is long, against a human 37–40 %. Length is the dominant error and `FOOT` fixes it;
    // this is the second-order one.
    const FOOT = 0.82, BREADTH = 0.93;
    const toeOff = 0.150 * P.footLength * FOOT, heelOff = -0.050 * FOOT;
    const ballT = 0.60, ballAlong = lerp(heelOff, toeOff, ballT), ballSole = -0.026 * FOOT;
    const toeRad = Math.max(0, Math.min(55, ff ? ff.toe || 0 : 0)) * Math.PI / 180;
    const ct = Math.cos(toeRad), stt = Math.sin(toeRad);
    const bend = (along, lift) => {                          // rotate the forefoot up about the ball
      if (toeRad === 0 || along <= ballAlong) return { along, lift };
      const da = along - ballAlong, dl = lift - ballSole;
      return { along: ballAlong + da * ct - dl * stt, lift: ballSole + da * stt + dl * ct };
    };
    const out = [];
    // One continuous rounded foot heel→toe: heel cap → heel body + instep DOME → a lifted
    // medial ARCH → the BALL (widest, on the floor) → tapered toes → toe cap.
    //
    // THE BIG TOE LEADS (footwear). A real forefoot is not a symmetric spearhead. The hallux is
    // the longest toe and sits MEDIALLY, and the toe line slants BACK from it to the fifth toe —
    // so the foot's point is on its inner edge, and the two feet are mirror images. Two per-
    // station dials say it:
    //   `lead` — how far the LATERAL half of this station falls back, as a fraction of TOE_LEAD.
    //            The medial edge keeps `toeOff`, so the foot's LENGTH (measured to the big toe,
    //            as a shoemaker measures it) is unchanged; only the outer side retreats.
    //   `med`  — how far this station's centre walks toward the big-toe side, as a fraction of
    //            the ball's half-width. At the cap this is what puts the tip on the inner edge.
    // MEDIAL IS `sgn`: the foot frame's `side` axis points along −x for both feet, the left foot
    // sits at −x and the right at +x, so "toward the body's midline" is −side on the left and
    // +side on the right — which is exactly sgn (−1 left, +1 right). The mirroring is therefore
    // free: one set of numbers, each foot pointing inward.
    // A station with neither dial is bit-identical to before, vertices and centre alike.
    //
    // The toe box moved with the dials, and had to. Off a symmetric spearhead the cap was a
    // 3.9 cm-wide wedge jutting 6 cm past the toes ring — blunt enough to read as a rounded toe
    // while it sat on the midline. Walk that same narrow cap medially and it reads as a BLADE.
    // So the forefoot gained two stations instead: a `roll` that keeps the box's width and depth
    // out to 90 % of the foot, and a blunt `box` at 97 % still 64 % as wide as the ball and
    // 2.7 cm deep — where the single old cap had collapsed to 8 % and 0.7 cm, a knife edge.
    //
    // THE CLOSURE. `litFaces` strips quads BETWEEN consecutive rings and caps neither end, so a
    // ring stack is an open tube — the foot always had a hole at the toe, small enough at the old
    // cap's width to pass as a shadow. Widening the box makes that hole a window. The `tip` ring
    // shuts it: tiny in every direction, which means NO `lead` — a slanted ring is spread ~2 cm
    // along the foot and closes nothing however narrow it is cut. Its radius is ≈ 0.2 cm against
    // the box's 3 cm. Not zero, deliberately: a degenerate ring has girth 0, and the foot chart
    // divides by a row's girth.
    // Measured on the leading edge (forward-most point per lateral bin, little toe → big toe):
    // 7.0 14.8 17.0 17.9 18.5 19.7 19.7 19.7 19.7 cm — it never steps back toward the hallux.
    const TOE_LEAD = 0.022 * P.footLength * FOOT, MED_REF = 0.042 * FOOT * BREADTH;   // MED_REF = the ball's half-width
    const stations = [
      { t: 0.00, s: -0.006, t2: 0.008, hw: 0.012 },         // heel cap (rounded back)
      { t: 0.14, s: -0.024, t2: 0.026, hw: 0.030 },         // heel body, instep rising
      { t: 0.30, s: -0.026, t2: 0.030, hw: 0.033 },         // under the ankle: instep dome
      { t: 0.46, s: -0.015, t2: 0.020, hw: 0.031 },         // ARCH: the medial sole lifts off the floor
      { t: 0.60, s: -0.026, t2: 0.006, hw: 0.042, lead: 0.20 },                 // BALL: widest, back on the floor  ← toe hinge; the 1st MTP leads the 5th a little
      { t: 0.80, s: -0.025, t2: -0.001, hw: 0.035, lead: 0.38, med: 0.06 },     // toes: the line starts slanting back toward the little toe
      { t: 0.90, s: -0.024, t2: -0.006, hw: 0.032, lead: 0.60, med: 0.16 },     // toe ROLL: the box keeps its width and its depth this far out
      { t: 0.97, s: -0.023, t2: -0.010, hw: 0.026, lead: 0.78, med: 0.26 },     // toe BOX: the blunt end, still 64 % of the ball's width
      { t: 1.00, s: -0.0195, t2: -0.0175, hw: 0.0015, med: 0.38 },              // toe TIP: tiny and UNSLANTED — see the closure note below
    ].map((st) => ({ ...st, s: st.s * FOOT, t2: st.t2 * FOOT, hw: st.hw * FOOT * BREADTH }));   // shape above, size here
    const M = 24, round = 0.62, raw = [];
    let soleZ = Infinity;
    for (const st of stations) {
      const along0 = lerp(heelOff, toeOff, st.t), cUp0 = (st.s + st.t2) / 2, hUp = (st.t2 - st.s) / 2;
      const lead = st.lead ?? 0, medOff = (st.med ?? 0) * MED_REF * sgn;
      const poly = [];
      let aSum = 0;
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const lift0 = cUp0 + hUp * Math.sign(sa) * Math.pow(Math.abs(sa), round);
        const widef = Math.sign(ca) * Math.pow(Math.abs(ca), round);        // −1 … +1 across the foot
        const along1 = along0 - TOE_LEAD * lead * Math.max(0, -widef * sgn);   // the LATERAL half falls back
        if (j < M) aSum += along1;
        const b = bend(along1, lift0);
        const P = ptS(b.along, b.lift, st.hw * widef + medOff);
        if (P.z < soleZ) soleZ = P.z;
        poly.push(P);
      }
      // the ring's centre follows its own mean reach, so the chart's axis tracks the slanted toe
      const bc = bend(lead ? aSum / M : along0, cUp0);
      raw.push({ polyline: poly, center: ptS(bc.along, bc.lift, medOff) });
    }
    // Pin a PLANTED foot's sole to the constant floor (blended by plantedness), so it stays
    // on the ground through stance instead of riding up/down with the leg-column bottom.
    const footDz = (FOOT_FLOOR - soleZ) * pinW;
    const shifted = (q) => toWorld({ x: q.x, y: q.y, z: q.z + footDz });
    out.push(raw.map((r) => ({ polyline: r.polyline.map(shifted), center: shifted(r.center) })));
    return out;
  };
  const handRings = (p, sgn) => {
    const el = sgn < 0 ? p.elbowL : p.elbowR, wr0 = sgn < 0 ? p.wristL : p.wristR;
    const wr = { x: el.x + (wr0.x - el.x) * 1.4, y: el.y + (wr0.y - el.y) * 1.4, z: el.z + (wr0.z - el.z) * 1.4 };
    const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
    const norm = (v) => { const l = Math.hypot(v.x, v.y, v.z) || 1; return { x: v.x / l, y: v.y / l, z: v.z / l }; };
    const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
    const at = (c, u, su, v, sv) => ({ x: c.x + u.x * su + v.x * sv, y: c.y + u.y * su + v.y * sv, z: c.z + u.z * su + v.z * sv });
    const g = (x, mu, s) => Math.exp(-Math.pow((x - mu) / s, 2));
    // Rodrigues rotation of vector `v` about unit axis `k` by `ang` (radians).
    const rotV = (v, k, ang) => {
      const c = Math.cos(ang), s = Math.sin(ang), kd = k.x * v.x + k.y * v.y + k.z * v.z;
      const kx = { x: k.y * v.z - k.z * v.y, y: k.z * v.x - k.x * v.z, z: k.x * v.y - k.y * v.x };
      return { x: v.x * c + kx.x * s + k.x * kd * (1 - c), y: v.y * c + kx.y * s + k.y * kd * (1 - c), z: v.z * c + kx.z * s + k.z * kd * (1 - c) };
    };
    let d = norm(sub(wr, el));                                // forearm direction (wrist → fingertips)
    const dn = d.y;
    let wAx = norm({ x: -d.x * dn, y: 1 - d.y * dn, z: -d.z * dn });   // across-hand (width) axis
    let tAx = norm(cross(d, wAx));                            // palm normal (palm ↔ back-of-hand)
    // WRIST JOINT — the hand articulates relative to the forearm (the mirror of the ANKLE, which
    // flexes the foot relative to the shank). `flex` rotates the hand about the across-hand axis:
    // + = extension (back of hand / fingers up), − = palmar flexion (fingers down toward the palm).
    // `deviation` rotates about the palm normal: + = radial, − = ulnar. The frame is rotated up
    // front, so the whole palm + thumb swing off the wrist (no hand node — the bend lives here).
    const hf = handFlex ? (sgn < 0 ? handFlex.L : handFlex.R) : null;
    const flexA = (hf ? Math.max(-75, Math.min(75, hf.flex || 0)) : 0) * Math.PI / 180;
    const devA = (hf ? Math.max(-30, Math.min(30, hf.deviation || 0)) : 0) * Math.PI / 180;
    if (flexA) { d = norm(rotV(d, wAx, flexA)); tAx = norm(rotV(tAx, wAx, flexA)); }
    if (devA) { d = norm(rotV(d, tAx, devA)); wAx = norm(rotV(wAx, tAx, devA)); }
    const out = [];
    const L = 0.10 * P.handSize, NL = 8, M = 22, palm = [];
    // FINGER (knuckle/MCP) CURL — the mirror of the toe (MTP) joint: the palm past the knuckle
    // line folds toward the palm about the across-hand axis (a relaxed/closing hand). `curl` ∈
    // 0..90° (+ = closing). Like the foot's forefoot breaking over the ball, the fingers break
    // over the knuckles.
    const curlA = (hf ? Math.max(0, Math.min(90, hf.curl || 0)) : 0) * Math.PI / 180;
    const knT = 0.55;                                         // knuckle line, fraction along the palm
    const Kp = { x: wr.x + d.x * L * knT, y: wr.y + d.y * L * knT, z: wr.z + d.z * L * knT };
    for (let i = 0; i < NL; i++) {
      const t = i / (NL - 1);
      let c = { x: wr.x + d.x * L * t, y: wr.y + d.y * L * t, z: wr.z + d.z * L * t };
      let tx = tAx;
      if (curlA && t > knT) {                                 // fold the fingers down about the knuckle
        const a = -curlA * (t - knT) / (1 - knT);             // − about wAx curls toward the palm
        const off = rotV(sub(c, Kp), wAx, a);
        c = { x: Kp.x + off.x, y: Kp.y + off.y, z: Kp.z + off.z };
        tx = rotV(tAx, wAx, a);
      }
      const ww = (0.016 + 0.020 * g(t, 0.42, 0.40) - 0.012 * t * t) * P.handSize, th = 0.013 * (1 - 0.45 * t) * P.handSize;
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), rd = 0.7;
        poly.push(toWorld(at(c, wAx, ww * Math.sign(ca) * Math.pow(Math.abs(ca), rd), tx, th * Math.sign(sa) * Math.pow(Math.abs(sa), rd))));
      }
      palm.push({ polyline: poly, center: toWorld(c) });
    }
    out.push(palm);
    // thumb — built from the (flexed + deviated) frame so it tracks the wrist.
    const tb = { x: wr.x + d.x * L * 0.20 + wAx.x * 0.016, y: wr.y + d.y * L * 0.20 + wAx.y * 0.016, z: wr.z + d.z * L * 0.20 + wAx.z * 0.016 };
    const med = -sgn;
    const thDir = norm({ x: wAx.x * 0.6 + d.x * 0.5 + tAx.x * med * 0.4, y: wAx.y * 0.6 + d.y * 0.5 + tAx.y * med * 0.4, z: wAx.z * 0.6 + d.z * 0.5 + tAx.z * med * 0.4 });
    const tU = norm(cross(thDir, d)), tV = norm(cross(thDir, tU));
    const TL = 0.044 * P.handSize, NT = 5, thumb = [];
    for (let i = 0; i < NT; i++) {
      const s = i / (NT - 1), cc = { x: tb.x + thDir.x * TL * s, y: tb.y + thDir.y * TL * s, z: tb.z + thDir.z * TL * s }, r = 0.011 * (1 - 0.35 * s) * P.handSize;
      const poly = [];
      for (let j = 0; j <= 18; j++) { const a = (j / 18) * Math.PI * 2; poly.push(toWorld(at(cc, tU, r * Math.cos(a), tV, r * Math.sin(a)))); }
      thumb.push({ polyline: poly, center: toWorld(cc) });
    }
    out.push(thumb);
    return out;
  };

  // ── assemble ──
  const p = proportioned(positions, dim);
  // The legs/feet may ride a different (balanced/ground-IK) armature than the rest
  // of the body; pL is that armature, proportioned the same way. Default → p.
  const pL = legNodes ? proportioned(legNodes, dim) : p;
  // Female pelvis tuned separately: bring the whole leg + hip IN toward the midline by 12%
  // (the flesh that follows them — pelvis/diaper, hip cap, glute root, legs — comes in too).
  if (dim.sex === 'female') {
    for (const m of (pL === p ? [p] : [p, pL])) {
      for (const k of ['hipL', 'hipR', 'kneeL', 'kneeR', 'ankleL', 'ankleR']) m[k].x *= 0.88;
    }
  }
  const ch = chakras(p), dan = ch.find((c) => c.name === 'dantien'), grn = ch.find((c) => c.name === 'groin');
  const pieces = [];
  const add = (id, rings) => pieces.push({ id, rings });

  add('trunk', trunkRibRings(p, P.stitched));
  add('neck', neckRings(p));
  add('shoulderYoke', worldRingsVajra(p.shoulderL, p.neckHub, p.shoulderR, [0.034, 0.030, 0.034]));
  add('clavicleL', clavicleRings(p, -1));
  add('clavicleR', clavicleRings(p, 1));
  add('headEgg', headStack(p));
  if (!P.stitched) {
    add('pelvis', pelvisRings(p));
  } else {
    add('diaper', diaperRings(p));
    add('coreSideL', coreSideRings(p, -1));
    add('coreSideR', coreSideRings(p, 1));
    if (dim.breast) {
      add('breastL', breastRings(p, -1));
      add('breastR', breastRings(p, 1));
    } else {
      add('pecL', pecShirtRings(p, -1));
      add('pecR', pecShirtRings(p, 1));
    }
    add('scapulaL', scapulaShirtRings(p, -1));
    add('scapulaR', scapulaShirtRings(p, 1));
    add('scapBunL', scapBun(p, -1));
    add('scapBunR', scapBun(p, 1));
  }
  // The belly. `dantien` is the uniform mass; `bellyDepth` adds fore/aft and biases it FORWARD —
  // most of the growth goes to the front, the rest fills the flanks and the small of the back.
  // Pinning the back entirely read as a ball hung off the front in the side profile; a real
  // middle carries it mostly, not only, forward. `bellyDrop` slides it along its own height.
  const danRy = dan.r * 0.66 * P.dantien, danRz = dan.r * 0.82 * P.dantien;
  // the forward bias rides the UNDIALLED radius, so `dantien` sizes the mass without also
  // shoving it forward — the same "grow once" rule as the seat.
  const danC = { x: 0, y: dan.c.y + 0.014 + dan.r * 0.66 * (P.bellyDepth - 1) * BELLY_FORWARD_BIAS, z: dan.c.z - danRz * P.bellyDrop };
  add('dantien', ellipsoidRings(danC, dan.r * 0.82 * P.dantien, danRy * P.bellyDepth, danRz));
  // Groin orb reduced — 0.72 overall × an extra 0.72 anterior flatten (and the centre pulled
  // back in y) — so it no longer reads as a big frontal bulge in the lateral profile: smaller
  // from the front, pulled back, smoothed into the diaper. (Dantien left as-is.)
  if (dim.sex === 'male') {
    const grnC = { x: 0, y: grn.c.y * 0.72, z: grn.c.z - 0.04 * P.groinDrop };
    add('groin', ellipsoidRings(grnC, grn.r * 0.576, grn.r * 0.441, grn.r * 0.72));
  } else {
    add('groin', ellipsoidRings({ x: 0, y: 0.0144, z: grn.c.z + 0.006 }, 0.0216, 0.0176, 0.0245));
  }
  add('deltoidL', deltoidCap(p, -1));
  add('deltoidR', deltoidCap(p, 1));
  add('upperArmL', upperArmRings(p.shoulderL, p.elbowL));
  add('upperArmR', upperArmRings(p.shoulderR, p.elbowR));
  add('forearmL', forearmRings(p, -1));
  add('forearmR', forearmRings(p, 1));
  add('elbowCapL', elbowCap(p, -1));
  add('elbowCapR', elbowCap(p, 1));
  for (const rs of handRings(p, -1)) add('handL', rs);
  for (const rs of handRings(p, 1)) add('handR', rs);
  add('hipCapL', hipCap(pL, -1));
  add('hipCapR', hipCap(pL, 1));
  add('legL', legRings(pL.hipL, pL.kneeL, pL.ankleL, -1));
  add('legR', legRings(pL.hipR, pL.kneeR, pL.ankleR, 1));
  add('gluteL', glute(p, -1));
  add('gluteR', glute(p, 1));
  for (const rs of footRings(pL, -1)) add('footL', rs);
  for (const rs of footRings(pL, 1)) add('footR', rs);

  // stockiness — scale each ring's girth about its own centerline (lengths fixed)
  if (P.stockiness === 1) return pieces;
  const s = P.stockiness;
  return pieces.map((pc) => ({
    id: pc.id,
    rings: pc.rings.map((rg) => ({
      center: rg.center,
      polyline: rg.polyline.map((q) => ({ x: rg.center.x + (q.x - rg.center.x) * s, y: rg.center.y + (q.y - rg.center.y) * s, z: rg.center.z + (q.z - rg.center.z) * s })),
    })),
  }));
}
