/** body-relational.js — the BODY as a form field: the realistic register's vertical slice. The hero's trunk read the way
 * head-relational.js reads the head: bone where it shows and the muscle masses placed from the hero's REST JOINTS (so the
 * field rides any cast and any tune), summed into one skin (log-sum-exp: each mass a bump in one wave, the valleys
 * between them the grooves an artist cuts), and the hero's torso cage re-sampled onto it, denser.
 *
 *   positions  x and y in W (the half biacromial: the shoulder joint's x), z as t along the torso bone (0 the navel,
 *              1 the neck hub); every length in W
 *   the base   the core (the spine's column, so every ring's centre sits inside), the ribcage's egg, the abdomen, the
 *              seat round the pelvis, the neck's column: summed with a wide blend (`kBase`)
 *   muscles    each a belly (an ellipsoid) SEATED on the base: cast from the trunk's axis toward the front, the back or an
 *              azimuth, its centre on the base's surface pushed out by `proud` less its depth, its fibre laid in the
 *              surface's tangent plane; or a cone between two points (the clavicle, the upper trapezius). A mass off the
 *              midline is mirrored; summed onto the base with a tight blend (`kMuscle`), so where two meet a groove
 *   dimples    smooth subtractions (the navel)
 *
 * formSlice(recipe, R, build) re-samples the torso: rings between the authored stations (the address keeps its u), more
 * slots round each (the front slot 0, the back half way), each slot pushed along its ring's radial line (from the ring's
 * centre through the authored cage's point there) to the field's first crossing outward. The bind follows the authored
 * one (its station and slot shares interpolated), the dials' station blends by u, so the rig poses it unchanged. The
 * pectoral and bust parts leave: the field carries their form. The hero door's `form: 'realistic'` (layered.js) and the
 * body lane (`body-study --form`) read it. Pure and deterministic (dmath). */
import { add, sub, scl, dot, cross, len, unit, r6 } from './body-relational-vec.js';
import { BODY_BUILDS } from './body-relational-builds.js';
import { sdPrim, lse, bodyFrame, bodyField, limbField, crossing } from './body-relational-field.js';
import { ringSlots, resamplePart, mixW, four, swapRL, mirrorPart } from './body-relational-resample.js';
import { correctiveRest, shoulderBlend } from './body-relational-correctives.js';
import { feetFrame, feetFields, footPart } from './body-relational-feet.js';

// the form field's modules, read from here as one: body-relational-builds (the builds and the physique), -field (the
// distances, the fields and the ways onto them), -resample (a part re-sampled), -correctives (the correctives)
export { BODY_BUILDS, PHYSIQUES, PHYSIQUE_DIALS, physique } from './body-relational-builds.js';
export { bodyFrame, bodyField, limbField, crossing, project } from './body-relational-field.js';
export { ringSlots, resamplePart } from './body-relational-resample.js';
export { correctiveRest } from './body-relational-correctives.js';

/** the slice: the torso and the arms re-sampled onto the build's field (the torso `around` × `rings`, each limb
 * `limbAround` × its build's rings), the pectoral and bust parts gone (the field carries their form), the dials' station
 * blends extended by u. Returns { recipe, field, removed, landmarks, fields } (`landmarks`: the crotch's and the navel's
 * heights; `fields`: each re-sampled shell's signed distance,
 * its handovers' set-ins included, by part: what a seam's diagnosis reads) */
export function formSlice(recipe, R, build, opts = {}) {
  const B = typeof build === 'string' ? BODY_BUILDS[build] : build;
  if (!B) throw new Error(`body-relational: unknown build '${build}' (have ${Object.keys(BODY_BUILDS).join(', ')})`);
  // the torso's density: the build's own (`cage`: a bust's fold wants finer rings), else 48 round by 37 rings
  const { around = 48, rings = 37, limbAround = 24 } = { ...B.cage, ...opts };
  // the limbs' fields first: the arm's deltoid heads are the shoulder's cap on the torso too, so the two shells agree
  const limbs = Object.fromEntries(Object.keys(B.limbs || {}).map((k) => [k, limbField(R, B, k)]));
  // THE DELTOID SHARED between the two shells and handed over along one cone round the trunk's axis (`clip`, rising
  // outward from above the armpit): above it the torso's skin shows (the shoulder's cap), below it the arm's. On the
  // torso the heads are cut under the cone (torso rays had slipped between the chest and the arm); the arm keeps them
  // all, set `tuck` inside above the cone (eased in over `band`), so its top ring and its cap sit under the torso's. Both
  // from the same masses, so the skins meet along the cone: the arm standing out of a smaller cap left a ledge on the
  // shoulder, the two on one surface z-fought in a sawtooth, and an arm cut away where the torso's field lay left it
  // hanging from a stalk. The torso's cut is sharp (`k`) and the arm's inset begins `gap` above it, so across the
  // handover only the arm's skin shows: two fades over one band crossed back and forth a few millimetres apart, a sawtooth
  const F0 = bodyFrame(R, B), W0 = F0.W, clip = { rho: 0.9 * W0 * F0.Sx, z: R.joints.shoulderR[2] - 0.6 * W0, slope: 1, k: 0.02 * W0 }, tuck = 0.003, band = 0.01, gap = 0.004;
  const ease = (x) => { const y = Math.max(0, Math.min(1, x)); return y * y * (3 - 2 * y); };
  // A LIMB'S TWO SEGMENTS share one field (both segments' masses, the knee's and the elbow's from each side) and hand over
  // by the plane through the joint square to the upper bone, the deltoid's pattern: past it the lower segment's skin
  // shows, the upper's set `tuck` inside; before it the reverse (each segment's own knee mass, of its own size, met the
  // other's in a step). One crossing at the plane: each fades in from it, so the two skins meet there only (two fades
  // begun `gap` either side of it left both on one skin between, and the elbow and the knee wore a line)
  const chain = (a, b, joint) => {
    if (!limbs[a] || !limbs[b]) return;
    const J = R.joints[joint], n = unit(sub(J, R.joints[B.limbs[a].from])), past = (q) => dot(sub(q, J), n);
    // (the fat the upper segment's to the joint's plane, the lower's past it: the two meet at the joint's value)
    const fa = limbs[a].fat, fb = limbs[b].fat, all = [...limbs[a].prims, ...limbs[b].prims], k = B.kLimb * W0, both = (q) => lse(all.map((p) => sdPrim(p, q)), k) - (past(q) < 0 ? fa(q) : fb(q));
    limbs[a].sd = (q) => both(q) + tuck * ease(past(q) / band);
    limbs[b].sd = (q) => both(q) + tuck * ease(-past(q) / band);
  };
  chain('upperArm', 'foreArm', B.limbs?.upperArm?.to); chain('thigh', 'shank', B.limbs?.thigh?.to);
  // THE FEET (body-relational-feet.js): the foot and the toes on one field with the shank's skin, the sole on the ground
  const feet = limbs.foot ? feetFrame(R, recipe, W0) : null;
  if (feet) feetFields(R, B, limbs, feet, W0);
  const shared = (limbs.upperArm?.prims || []).filter((p) => /^deltoid/.test(p.id)).map((p) => ({ ...p, clip }));
  // THE HIP'S HANDOVER, on one field and one level (`zp`, a little over the crotch, the skin's lowest point on the
  // midline): the pelvis samples the body's field carrying the thighs' masses whole, and about the level the thigh
  // samples the same field, cut at the midline (`hip`), easing back to its own masses over `bz` above the level and
  // down the femur. The pelvis ends at the crotch and is set `deep` inside under the level, the thigh over it, each
  // faded in from the level over `bp`, a ring or so: so the two skins meet at the level only, on one surface, and the
  // skin that shows either side of it is the field's (a thigh faded in slowly stayed within a mesh's error of the
  // pelvis's skin, and poked through it in spikes). Under the level the thighs take the seat's fold, the crotch and the
  // groin.
  // (A seam by which masses own the skin wandered where the thigh and the belly blend shallowly, in teeth; one by
  // height with a gap between the two fades left both on one skin, a sawtooth across the thigh's front; rings of the
  // pelvis under the crotch, cast from inside it, all left through its underside and folded in flaps)
  const ramp = (x) => Math.max(0, Math.min(1, x)), deep = 0.004, bz = 0.04, bp = 0.012;
  const pelvicB = B.base.some((m) => m.id === 'seatLobe');
  let pelvisSd = null, zp = null, crotch = null;
  if (pelvicB && limbs.thigh) {
    const th = limbs.thigh.sd, pf = bodyField(R, B, { extra: limbs.thigh.prims }).sd, zh = R.joints.hipR[2];
    crotch = zh;
    // (under a physique no lower than `0.6 W` under the hip's joint: thighs bulked or fat enough meet on the midline, and
    // the crotch, the lowest skin there, fell to the knees; below it they touch, each cut at the midline)
    const floor = zh - (B.physique ? 0.6 : 2) * W0;
    for (let y = -0.1; y <= 0.15; y += 0.01) for (let z = floor; z < crotch; z += 0.002) if (pf([0, y, z]) < 0) { crotch = z; break; }
    zp = crotch + 0.005 + bp + 0.003;
    const hip = (q) => Math.max(pf(q), -q[0]), w = (z) => ramp((zp + bz - z) / bz) * ramp((z - zp + 0.14) / bz);
    pelvisSd = (q) => pf(q) + deep * ramp((zp - q[2]) / bp);
    limbs.thigh.sd = (q) => { const a = w(q[2]); return (a < 1 ? th(q) * (1 - a) : 0) + (a > 0 ? hip(q) * a : 0) + deep * ramp((q[2] - zp) / bp); };
  }
  const field = bodyField(R, B, { extra: shared }), r = structuredClone(recipe), P = r.parts.torso;
  // THE HANDS (a physique's `hands`): the authored hand and its digits scaled about the wrist, their joints with them, so
  // the fingers still turn in their knuckles; the forearm's wrist mass grown the same, so the cuff and the hand agree
  if (B.hands && B.hands !== 1) for (const S of ['R', 'L']) {
    const w = R.joints[`wrist${S}`]; if (!w) continue;
    const at = (p) => add(w, scl(sub(p, w), B.hands)).map(r6), re = new RegExp(`^(hand|thumb|index|middle|ring|little)${S}$`);
    for (const [k, Pt] of Object.entries(r.parts)) if (re.test(k)) {
      for (const st of Pt.stations) for (const sl of Object.keys(st.points)) st.points[sl] = at(st.points[sl]);
      if (Pt.caps) for (const c of Object.keys(Pt.caps)) Pt.caps[c] = at(Pt.caps[c]);
    }
    for (const j of Object.keys(r.rig.joints)) if (new RegExp(`^(knuckles|fingerAxis|thumb|index|middle|ring|little)[A-Za-z]*${S}$`).test(j)) { const v = r.rig.joints[j]; r.rig.joints[j] = Array.isArray(v) ? at(v) : { ...v, at: at(v.at) }; }
  }
  const under = (q) => (clip.slope * (Math.hypot(q[0], q[1]) - clip.rho) - (q[2] - clip.z)) / Math.hypot(1, clip.slope);
  if (limbs.upperArm) { const arm = limbs.upperArm.sd; limbs.upperArm.sd = (q) => arm(q) + tuck * ease((-under(q) - gap) / band); }
  // the torso: above the chest the rays fan from one point on the trunk's axis (a ring's own radial line grazes the
  // shoulder's slope and the neck's root, where the authored rings tilt; rays from one origin never cross), and under
  // the navel, on a build without a seat, it lands on the authored pelvis's top, the field easing in from the waist's
  // first station
  const bottom = P.stations.find((s) => s.id === 'st1')?.u ?? 1, zFan = R.joints.shoulderR[2] - 0.35 * field.frame.W;
  // and round an undercut (`lift`: the fold under the bust) they come down from a point raised above the ring, so they
  // meet the underside face on (level rays left one ring on the bust's underside and the next on the chest's wall, and
  // the band between them shaded in a sawtooth)
  const Fr = field.frame, L = B.lift, raise = (z) => { if (!L) return 0; const x = Math.min(1, Math.abs(Fr.tOf(z) - L.t) / L.w); return L.h * Fr.W * (1 - x * x * (3 - 2 * x)); };
  // THE PELVIS on the field too (a build with a seat): the torso no longer eases onto the authored pelvis, and the two
  // hand over by height at the middle of their overlap (`zH`), in one crossing: below it the pelvis's skin shows (the
  // torso's set `deep` inside, faded in over `bz` from zH), above it the torso's
  const cz = (st, Pt) => Pt.slots.reduce((a, sl) => a + st.points[sl][2], 0) / Pt.slots.length;
  const pelvic = !!r.parts.pelvis && B.base.some((m) => m.id === 'seatLobe');
  const zH = pelvic ? (cz(P.stations[0], P) + cz(r.parts.pelvis.stations.at(-1), r.parts.pelvis)) / 2 : null;
  const handed = (sd, sign) => (q) => sd(q) + deep * ramp((sign * (zH - q[2])) / bz);
  const torsoOpts = { around, rings, origin: (c) => (c[2] > zFan ? [c[0], c[1], zFan] : [c[0], c[1], c[2] + raise(c[2])]), ease: pelvic ? () => 1 : (u) => { const e = Math.min(1, u / (bottom || 1)); return e * e * (3 - 2 * e); }, relax: 4 };
  const T0 = r.parts.torso = resamplePart(P, pelvic ? handed(field.sd, 1) : field.sd, torsoOpts);
  if (pelvic) {
    // its lowest station set on the crotch (`crotch`), wholly under the level. Its centre lies on the crotch's skin, so a
    // ring's rays cast from the first point inside straight above (`up`)
    // (under a physique the rings under the level, hidden inside the thighs, drawn in to a cone round the crotch, a
    // point at it and wide at the level: where the thighs nearly meet, their rays crossed the thigh and left it at its
    // front or side, and the rings folded in a zigzag)
    const psd0 = handed(pelvisSd ?? field.sd, -1), P0 = structuredClone(r.parts.pelvis), s0 = P0.stations[0];
    const psd = B.physique && crotch !== null ? (q) => { if (q[2] >= zp) return psd0(q); const t = ramp((q[2] - crotch) / (zp - crotch)); return Math.max(psd0(q), Math.hypot(q[0], q[1]) - (0.01 + 1.5 * W0 * t * t * t)); } : psd0;
    if (crotch !== null) for (const k of P0.slots) s0.points[k] = [s0.points[k][0], s0.points[k][1], crotch + 0.005];
    const up = (c) => { if (psd(c) < 0) return c; for (let t = 0.002; t <= 0.12; t += 0.002) { const q = [c[0], c[1], c[2] + t]; if (psd(q) < -0.004) return q; } return c; };
    // (its relaxing projected centred: at the crotch's level the skin's two walls stand close; see project)
    const Pp = r.parts.pelvis = resamplePart(P0, psd, { around, rings: B.pelvisRings ?? 33, origin: up, relax: 2, forward: false });
    // its lowest cap on the crotch's skin, over the lowest ring's centre (the authored pole hung a nub between the thighs)
    const ring = Pp.slots.map((k) => Pp.stations[0].points[k]), o = up(scl(ring.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / ring.length));
    const hit = Pp.caps?.back && psd(o) < 0 ? crossing(psd, o, [0, 0, -1], 0.15) : null;
    if (hit) Pp.caps = { ...Pp.caps, back: [0, r6(hit[1]), r6(hit[2])] };
  }
  // the neck on its own masses of the same field (its column, the sternocleidomastoids, the trapezius's climb), so the
  // torso's top and the neck's root agree
  if (r.parts.neck) r.parts.neck = resamplePart(r.parts.neck, field.only(['neck', 'sternocleidomastoid', 'trapeziusUpper']), { around: 32, rings: 15, relax: 2 });
  // the midline exactly on it, the left the right's mirror (a midline part's contract)
  for (const T of [r.parts.torso, r.parts.neck, pelvic && r.parts.pelvis].filter(Boolean)) for (const s of T.stations) { s.points.front[0] = 0; s.points.back[0] = 0; for (const sl of T.slots) if (sl.endsWith('L')) { const p = s.points[`${sl.slice(0, -1)}R`]; s.points[sl] = [-p[0], p[1], p[2]]; } }
  // THE PAULDRON (a build's `pauldron`: stages, each a mass of the field like the rest and its `drive`): what a raised
  // arm bunches over the shoulder, absent from the bind. The torso sampled again with each stage's mass, the same rings
  // and slots, and the difference kept as a CORRECTIVE per side (`recipe.correctives`: a point's offset at full weight,
  // the weight the arm's raise past `from` degrees, whole at `full`; a stage with `arm` samples the arm's top too), which
  // correctiveRest adds to the rest before the skin poses it (an engine's morph target). Raised, the shoulder had no
  // stuff to fill what the arm leaves: the skin there could only hollow, crease or fold
  r.correctives = [];
  const pauldronPrim = {};
  for (const stg of B.pauldron || []) {
    const { drive, arm, ...mass } = stg, fieldP = bodyField(R, { ...B, muscles: [...B.muscles, mass] }, { extra: shared });
    pauldronPrim[mass.id] = fieldP.masses.muscles.find((p) => p.id === mass.id && (p.c?.[0] ?? 0) > 0);
    // (only the rays the stage's mass reaches cast again: a point further from it than 12 of the muscles' blend widths
    // takes a share of it under e^-12 of a blend, a ten-thousandth of a millimetre)
    const reach = fieldP.masses.muscles.filter((p) => p.id === mass.id), kM = B.kMuscle * fieldP.frame.W;
    const near = (q) => reach.some((p) => sdPrim(p, q) < 12 * kM);
    const T2 = resamplePart(P, pelvic ? handed(fieldP.sd, 1) : fieldP.sd, { ...torsoOpts, reuse: { from: T0, near } }), T = r.parts.torso, d = { R: {}, L: {} };
    for (const st of T2.stations) for (const sl of T2.slots) if (sl.endsWith('R')) {
      const a = T.stations.find((x) => x.id === st.id)?.points[sl], b = st.points[sl]; if (!a) continue;
      const v = sub(b, a); if (len(v) < 1e-4) continue;
      d.R[`torso/${st.id}.${sl}`] = v.map(r6); d.L[`torso/${st.id}.${sl.slice(0, -1)}L`] = [r6(-v[0]), r6(v[1]), r6(v[2])];
    }
    for (const S of ['R', 'L']) r.correctives.push({ id: `${mass.id}${S}`, driver: { joint: `shoulder${S}`, to: `elbow${S}`, ...drive }, d: d[S], ...(arm ? { arm: true } : {}) });
  }
  // the limbs: the right one sampled on its field, the left its mirror
  const done = ['torso', 'neck', ...(pelvic ? ['pelvis'] : [])];
  // THE DELTOID RIDES THE ARM: a point's share of the upper arm's bone by how near it lies to the deltoid's heads (on
  // them, the arm's; `dBand` off them, none), read the same by the torso's cap and the arm's top under it, so the two
  // skins, one over the other at rest, move as one. The cap had been bound to the trunk and the collarbone, the arm's top
  // half to the collarbone: a raised arm swung up out from under its own deltoid, the cap left hanging at the side
  const delt = (limbs.upperArm?.prims || []).filter((p) => /^deltoid/.test(p.id)), dBand = 0.5 * W0;
  // (and none under the armpit: its folds, the pectoral's and the latissimus's, follow the arm, the flank under them
  // does not; a share by nearness alone carried the flank up in a web under a raised arm)
  // (and by how far down the humerus it lies, `down`: none above the joint, the deltoid's origin on the acromion and
  // the collarbone, which stays with the girdle; wholly from its belly down. The whole cap on the arm's bone swung its
  // top in and down about the joint and its side up, a trough over the collarbone and a hump over the arm)
  const sj = R.joints.shoulderR, armDir = unit(sub(R.joints.elbowR, sj)), zAx = sj[2];
  const sm = (v) => { const y = Math.max(0, Math.min(1, v)); return y * y * (3 - 2 * y); };
  // (over a band from a little above the joint to a hand's breadth down: one narrower folded the skin in a ring at the
  // joint's height when the arm swung fore and aft, the sprint's)
  // (with a blade (the scapula, below) the band is short, whole 8 cm down the humerus: the humerus is rigid, and the blade
  // carries the girdle's part of a raise; the collarbone's long band, 16 cm, had held the arm's upper third off its bone
  // by up to 4.5 cm overhead, the skin sagging toward the body while the bone rose)
  const DOWN = [0.2, 0.6], down = (q) => sm((dot(sub([Math.abs(q[0]), q[1], q[2]], sj), armDir) + DOWN[0] * W0) / (DOWN[1] * W0));
  const deltoidShare = (q, byDown = true) => {
    const d = Math.min(...delt.map((p) => sdPrim(p, [Math.abs(q[0]), q[1], q[2]])));
    return sm(1 - Math.max(0, d) / dBand) * sm((q[2] - zAx + 1.1 * W0) / (0.6 * W0)) * (byDown ? down(q) : 1);
  };
  // THE SCAPULA: the blade the arm's raise turns (figure-vajra.js, the scapulohumeral rhythm: the glenoid rides it, so
  // the shoulder rises because the blade turns), its acromion over the shoulder's joint and a little behind, its
  // superior angle level with the joint and its inferior angle 15 cm under it, both 1.5 cm under the back's skin (the
  // form field's) and 0.45 and 0.5 of the way out to the joint; a bone framed by the three (`scapula<S>`), the shoulder
  // fold and the arm's root turning from it. The shoulder's girdle had a collarbone and no blade: the arm rose in a
  // socket that never turned, and the skin round its root took the whole raise
  for (const S of ['R', 'L']) {
    const J = R.joints; if (!J[`clavicle${S}`]) continue;
    const sg = S === 'R' ? 1 : -1, s0 = J.shoulderR, onBack = (x, z) => { const c = crossing(field.sd, [x, 0, z], [0, -1, 0], 0.4); return r6((c ? c[1] : -0.1) + 0.015); };
    const pts = { scapulaAcr: [s0[0] - 0.01, s0[1] - 0.015, s0[2] + 0.035], scapulaSup: [0.45 * s0[0], onBack(0.45 * s0[0], s0[2]), s0[2]], scapulaInf: [0.5 * s0[0], onBack(0.5 * s0[0], s0[2] - 0.15), s0[2] - 0.15] };
    for (const [k, p] of Object.entries(pts)) r.rig.joints[`${k}${S}`] = [r6(sg * p[0]), r6(p[1]), r6(p[2])];
    r.rig.bones.push({ id: `scapula${S}`, head: `scapulaAcr${S}`, tail: `scapulaInf${S}`, aux: [`scapulaAcr${S}`, `scapulaSup${S}`] });
  }
  // THE SHOULDER'S FOLD: a helper at the shoulder's joint turned half the arm's swing (the rig's fold, as the hip's: the
  // arm's rest line carried by the collarbone into the socket; unpushed: pushed to the armpit's side, a raised arm's
  // underside swelled there in a lobe over the chest's wall). The arm's own top goes from the collarbone to the arm's
  // bone THROUGH it, by `down`: straight from one to the other, a raised arm's top rings, by turns the collarbone's and
  // the arm's, pinched the arm's root to a point at the armpit
  for (const S of ['R', 'L']) {
    const J = R.joints, id = `shoulderFold${S}`; if (!J[`clavicle${S}`] || !r.rig.folds) continue;
    r.rig.folds[id] = { joint: `shoulder${S}`, inAxis: [0, 1, 2].map((k) => r6(J[`elbow${S}`][k] - J[`shoulder${S}`][k])), to: `elbow${S}`, front: [0, 1, 0], push: 0, bones: [r.rig.joints[`scapulaAcr${S}`] ? `scapula${S}` : `clavicle${S}`, `upperArm${S}`], head: id, tail: `shoulderFoldTip${S}`, aim: `shoulderFoldAim${S}` };
    r.rig.bones.push({ id, head: id, tail: `shoulderFoldTip${S}`, aux: [id, `shoulderFoldAim${S}`] });
  }
  // THE FOREARM BENDS FROM THE UPPER ARM: framed from the upper arm's frame by the elbow's bend alone (the rig's `parent`),
  // so the elbow never twists. Each framed by the shortest turn to its own line, the two disagreed about their roll by
  // as much as the arm had swung, the elbow wrung 47 degrees with the forearms reaching behind the head. (Framing both
  // by the shoulder's roll instead, the skin had a turn of up to 110 degrees to lose somewhere between the collarbone
  // and the elbow, and blended skin can only lose it in a candy wrapper or a spiral)
  for (const S of ['R', 'L']) { const b = r.rig.bones.find((x) => x.id === `foreArm${S}`); if (b && !b.aux && R.joints[`clavicle${S}`]) b.parent = `upperArm${S}`; }
  const viaFold = (S, f) => {
    const cl = { [r.rig.joints[`scapulaAcr${S}`] ? `scapula${S}` : `clavicle${S}`]: 1 }, arm = { [`upperArm${S}`]: 1 }, F = `shoulderFold${S}`;
    return !r.rig.folds?.[F] ? mixW(cl, arm, f) : f < 0.5 ? mixW(cl, { [F]: 1 }, 2 * f) : mixW({ [F]: 1 }, arm, 2 * f - 1);
  };
  // (`ownArm`: the arm's own top, from the collarbone through the shoulder's fold to the arm's bone by `down` alone; the
  // torso's cap over the deltoid mixed toward that same chain by its nearness to the deltoid's heads, so the two skins,
  // one over the other at rest, move as one: mixed toward the arm's bone outright, a raised arm folded the cap up beside
  // the arm's root in a horn, the shoulders square, the arm leaving each from its corner)
  const rideDeltoid = (P, ownArm) => {
    if (!delt.length) return P;
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      if (p[0] === 0) return;
      const S = p[0] < 0 ? 'L' : 'R', arm = `upperArm${S}`;
      if (ownArm) { const f = down(p); if (f < 0.999) blend[key] = viaFold(S, f); return; }
      const f = deltoidShare(p, false); if (f < 1e-3) return;
      const w = mixW(blend[key] || fallback || own, viaFold(S, down(p)), f);
      blend[key] = four(w);
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    return { ...P, bind: { ...b, blend } };
  };
  // THE GIRDLE RIDES THE COLLARBONE: the skin over the shoulder's girdle (the collarbone, the acromion, the trapezius's
  // fall to it, the scapula's top) bound to the collarbone's bone by its nearness to it (within `gIn`, wholly; `gOut`,
  // not at all), so a raised arm, which lifts the collarbone, levels the shoulder's top from the neck out to the arm.
  // The torso had given the collarbone half a share or less in one band of rings: the joint rose under a shoulder that
  // stayed down
  const c0 = R.joints.clavicleR, c1 = R.joints.shoulderR, gIn = 0.35 * W0, gOut = 0.8 * W0;
  const girdleShare = (q) => {
    if (!c0) return 0;
    const p = [Math.abs(q[0]), q[1], q[2]], ab = sub(c1, c0), t = Math.max(0, Math.min(1, dot(sub(p, c0), ab) / dot(ab, ab))), d = len(sub(p, add(c0, scl(ab, t))));
    // (none inside the collarbone's pivot, its sternal end: rising, the bone turns that side down, and the skin at the
    // neck's root split at the midline)
    // (and faded in over a wider run off the neck: the trapezius at the neck's root, carried by a swinging arm's
    // collarbone while the neck stood, opened a notch there)
    const x = Math.max(0, Math.min(1, (gOut - d) / (gOut - gIn))), m = Math.max(0, Math.min(1, (p[0] - c0[0] - 0.1 * W0) / (0.5 * W0)));
    return x * x * (3 - 2 * x) * m * m * (3 - 2 * m);
  };
  // (the girdle's share taken by the BLADE where the rig has one: toward the collarbone's outer end, the acromion, and
  // behind the shoulder's midplane, over the blade; the collarbone keeps its own inner run in front. All the girdle's
  // skin on the collarbone rose with it, 6 cm at a full raise, past the acromion under it (3.4): a raised arm's
  // shoulder top floated 2 to 3 cm over its bone, a blob filling the corner between the neck and the arm)
  const bladeShare = (q) => {
    const p = [Math.abs(q[0]), q[1], q[2]], ab = sub(c1, c0), t = dot(sub(p, c0), ab) / dot(ab, ab);
    return Math.max(sm((t - 0.4) / 0.45), sm((-p[1] - 0.05 * W0) / (0.25 * W0)));
  };
  // THE SHOULDER'S EDGES BLENDED: the shares round the arm's root (a point carried by the arm's chain, or beside one)
  // eased toward their four neighbours' mean, a few times over the grid, both sides alike. Each share is a smooth
  // function of where the point lies, but round the armpit's pocket the rings land by turns on its two walls, a
  // point on the cap beside one on the chest: a raised arm carried one and left the next, and the torso's skin stood
  // through the arm's in a sawtooth of spikes
  const ARMS = /^(upperArm|shoulderFold)[RL]$/;
  const smoothShoulder = (P, iters = 6) => {
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 }, SL = P.slots, st = P.stations, n = SL.length;
    const wAt = (i, j) => blend[`${st[i].id}.${SL[j]}`] || blend[st[i].id] || own, army = (w) => Object.keys(w).some((k) => ARMS.test(k));
    for (let it = 0; it < iters; it++) {
      const next = {};
      for (let i = 1; i < st.length - 1; i++) for (let j = 0; j < n; j++) {
        if (st[i].points[SL[j]][0] === 0) continue;
        const nb = [wAt(i, (j + 1) % n), wAt(i, (j + n - 1) % n), wAt(i + 1, j), wAt(i - 1, j)], w = wAt(i, j);
        if (!army(w) && !nb.some(army)) continue;
        let mean = nb[0]; for (let k = 1; k < 4; k++) mean = mixW(mean, nb[k], 1 / (k + 1));
        next[`${st[i].id}.${SL[j]}`] = four(mixW(w, mean, 0.5));
      }
      Object.assign(blend, next);
    }
    return { ...P, bind: { ...b, blend } };
  };
  const rideGirdle = (P) => {
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    for (const st of P.stations) for (const sl of P.slots) {
      const p = st.points[sl]; if (p[0] === 0) continue;
      const f = girdleShare(p); if (f < 1e-3) continue;
      const S = p[0] < 0 ? 'L' : 'R', key = `${st.id}.${sl}`, w0 = blend[key] || blend[st.id] || own, cl = `clavicle${S}`, sc = r.rig.joints[`scapulaAcr${S}`] ? `scapula${S}` : null;
      const cur = (w0[cl] ?? 0) + (sc ? w0[sc] ?? 0 : 0);
      if (f <= cur) continue;
      const w = mixW(w0, sc ? mixW({ [cl]: 1 }, { [sc]: 1 }, bladeShare(p)) : { [cl]: 1 }, (f - cur) / (1 - cur));
      blend[key] = four(w);
    }
    return { ...P, bind: { ...b, blend } };
  };
  r.parts.torso = smoothShoulder(rideDeltoid(rideGirdle(r.parts.torso), false));
  // THE GROIN STRETCHES: a point's share of the thigh's bone by how far down the femur it lies (`downHip`: none at the
  // hip's joint, the groin, the crotch and the seat's fold staying with the pelvis; wholly a hand's breadth down), through
  // the hip's fold bone (the rig's helper turned half the leg's swing) in the middle, read the same by the pelvis and the
  // thigh's top, so the two stretch as one skin. The thigh's top had been the thigh's bone's from its first rings: an
  // opened leg swung its root away from the pelvis, a notch at the crotch and the seat's edge left as a shelf
  const hj = R.joints.hipR, femDir = unit(sub(R.joints.kneeR, hj)), fold = !!R.joints.hipFoldR;
  const downHip = (q) => sm((dot(sub([Math.abs(q[0]), q[1], q[2]], hj), femDir) - 0.05 * W0) / (0.55 * W0));
  const hipShare = (f, S) => (f <= 0 ? { pelvis: 1 } : !fold ? mixW({ pelvis: 1 }, { [`thigh${S}`]: 1 }, f) : f < 0.5 ? mixW({ pelvis: 1 }, { [`hipFold${S}`]: 1 }, 2 * f) : mixW({ [`hipFold${S}`]: 1 }, { [`thigh${S}`]: 1 }, 2 * f - 1));
  const rideHip = (P, all) => {
    const b = P.bind, blend = { ...(b.blend || {}) }, own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      if (p[0] === 0) return;
      const f = downHip(p), w0 = blend[key] || fallback || own;
      if (f >= 0.999 || (!all && Object.keys(w0).some((k) => !/^(pelvis|lumbar)$/.test(k)))) return;
      // (the pelvis's own skin: its share mixed in by nearness to the leg, the trunk above the hip's crest its own)
      const w = all ? hipShare(f, p[0] < 0 ? 'L' : 'R') : mixW(w0, hipShare(f, p[0] < 0 ? 'L' : 'R'), sm((hj[2] - p[2] + 0.1 * W0) / (0.5 * W0)));
      if (Object.keys(w).length <= 4) blend[key] = w;
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    return { ...P, bind: { ...b, blend } };
  };
  if (pelvic && limbs.thigh) r.parts.pelvis = rideHip(r.parts.pelvis, false);
  // THE KNEE AND THE ELBOW BEND AS ONE SKIN: across a band either side of the joint (`hb`, along the lower bone), the
  // upper segment's and the lower's points alike take the upper bone, the fold's (the rig's helper turned half the bend)
  // and the lower bone by where they lie, so the two shells handed over at the joint's plane move together. Each had
  // been its own bone's nearly to the plane: bent deep (the sprint's knee), the thigh's end swung out from under the
  // shank's top behind the knee, a lobe with an edge
  // THE CREASE'S HELPER (the deep knee's corrective): beside each hinge's fold, which pushes its head to the bend's
  // outside to keep the kneecap's and the elbow's point, a CREASE bone turned the same half the bend and pushed not at
  // all, for the bend's inside: there the fold's push had drawn the skin in toward the bone, the back of a deep knee to
  // 0.6 of its ring and the thigh's end a lobe over it. A point's middle share goes to the fold on the outside and the
  // crease on the inside, by its side of the limb (the fold's rest `front` the outside)
  const creaseOf = {};
  for (const [fold, crease] of [['kneeFold', 'kneeCrease'], ['elbowFold', 'elbowCrease']]) for (const S of ['R', 'L']) {
    const F = r.rig.folds?.[`${fold}${S}`]; if (!F) continue;
    const id = `${crease}${S}`, tip = `${crease}Tip${S}`, aim = `${crease}Aim${S}`;
    r.rig.folds[id] = { ...F, push: 0, head: id, tail: tip, aim };
    r.rig.bones.push({ id, head: id, tail: tip, aux: [id, aim] });
    creaseOf[`${fold}${S}`] = { id, front: unit(F.front) };
  }
  const hingeBand = (P, joint, toward, upper, fold, lower, hb) => {
    const J0 = R.joints[`${joint}R`], dirL = unit(sub(R.joints[`${toward}R`], J0)), b = P.bind, blend = { ...(b.blend || {}) };
    const mine = new RegExp(`^(${upper}|${fold}|${lower})[RL]$`), own = { [b.bone]: 1 };
    const ride = (key, fallback, p) => {
      const q = [Math.abs(p[0]), p[1], p[2]], t = dot(sub(q, J0), dirL); if (Math.abs(t) >= hb) return;
      const w0 = blend[key] || fallback || own; if (!Object.keys(w0).every((k) => mine.test(k))) return;
      const S = p[0] < 0 ? 'L' : 'R', f = sm((t + hb) / (2 * hb)), F = R.joints[`${fold}R`] ? `${fold}${S}` : null, C = F && creaseOf[F];
      // (the middle: the fold on the bend's outside, the crease on its inside, eased round the limb)
      let mid = F ? { [F]: 1 } : null;
      if (C) { const rad = sub(sub(q, J0), scl(dirL, t)), side = len(rad) > 1e-9 ? dot(unit(rad), C.front) : 0, c = r6(sm(0.5 + side)); mid = c >= 1 ? { [F]: 1 } : c <= 0 ? { [C.id]: 1 } : { [F]: c, [C.id]: r6(1 - c) }; }
      blend[key] = !mid ? mixW({ [`${upper}${S}`]: 1 }, { [`${lower}${S}`]: 1 }, f) : f < 0.5 ? mixW({ [`${upper}${S}`]: 1 }, mid, 2 * f) : mixW(mid, { [`${lower}${S}`]: 1 }, 2 * f - 1);
    };
    for (const st of P.stations) for (const sl of P.slots) ride(`${st.id}.${sl}`, blend[st.id], st.points[sl]);
    for (const [k, q] of Object.entries(P.caps || {})) ride(k, null, q);
    // (a hard limb's zone eases its station shares by the joint ring: the band's own shares stand per slot over it)
    return { ...P, bind: { ...b, blend } };
  };
  const HINGES = { thigh: ['knee', 'ankle', 'thigh', 'kneeFold', 'shank'], shank: ['knee', 'ankle', 'thigh', 'kneeFold', 'shank'], upperArm: ['elbow', 'wrist', 'upperArm', 'elbowFold', 'foreArm'], foreArm: ['elbow', 'wrist', 'upperArm', 'elbowFold', 'foreArm'],
    // (the toe base a hinge with no fold: the foot's bone and the toes' mixed straight across its band)
    foot: ['toeBase', 'toeTip', 'foot', 'toeFold', 'toes'], toes: ['toeBase', 'toeTip', 'foot', 'toeFold', 'toes'] };
  const hingeBands = { foot: 0.1 * W0, toes: 0.1 * W0 };
  const limbOpts = {};
  for (const [limb, Lb] of Object.entries(B.limbs || {})) {
    const pr = `${limb}R`, pl = `${limb}L`; if (!r.parts[pr]) continue;
    // (a foot: its own cage, laid out by the field, and the ankle's bind; body-relational-feet.js)
    if (Lb.foot) {
      r.parts[pr] = hingeBand(footPart(r.parts[pr], limbs[limb].sd, { R, B, limb, frame: feet, W: W0, shank: r.parts.shankR, shankSd: limbs.shank?.sd }), ...HINGES[limb], hingeBands[limb]);
      if (r.parts[pl]) r.parts[pl] = mirrorPart(r.parts[pr], r.parts[pl]);
      done.push(pr, pl); continue;
    }
    // (each ring's rays from its centre, or where the field does not hold that, from the first point the field holds on
    // the way to the bone, a few millimetres in: the thigh's top rings are centred behind the hip's joint, outside the
    // leg's masses, and their rays found nothing to land on; from the bone itself, the joint at those rings' edge, they
    // wrapped the ring's far side backward)
    const a0 = R.joints[Lb.from], ab = sub(R.joints[Lb.to], a0), l2 = dot(ab, ab), lsd = limbs[limb].sd;
    const onBone = (c) => {
      if (lsd(c) < 0) return c;
      const bp = add(a0, scl(ab, Math.max(0, Math.min(1, dot(sub(c, a0), ab) / l2)))), d = sub(bp, c), L = len(d);
      for (let t = 0; t <= L; t += 0.002) { const q = add(c, scl(d, t / L)); if (lsd(q) < -0.004) return q; }
      return null;   // (the bone itself not in the skin: the thigh's top rings above the hip's joint)
    };
    limbOpts[limb] = { around: Lb.around ?? limbAround, rings: Lb.rings, capsAlong: unit(ab), origin: onBone, shrinkOutside: 0.7 };
    r.parts[pr] = resamplePart(r.parts[pr], limbs[limb].sd, limbOpts[limb]);
    if (limb === 'upperArm') r.parts[pr] = rideDeltoid(r.parts[pr], true);
    if (limb === 'thigh' && pelvic) r.parts[pr] = rideHip(r.parts[pr], true);
    if (HINGES[limb]) r.parts[pr] = hingeBand(r.parts[pr], ...HINGES[limb], 0.35 * W0);
    if (r.parts[pl]) r.parts[pl] = mirrorPart(r.parts[pr], r.parts[pl]);
    done.push(pr, pl);
  }
  // (a stage over the arm's top: the arm sampled again with the stage's mass in its field, the same rays, the difference
  // its own offsets; the left the right's mirror, slot for slot)
  for (const c of r.correctives) if (c.arm && c.id.endsWith('R') && limbOpts.upperArm && recipe.parts.upperArmR) {
    const prim = pauldronPrim[c.id.slice(0, -1)]; if (!prim) continue;
    const A2 = resamplePart(recipe.parts.upperArmR, limbField(R, B, 'upperArm', [prim]).sd, limbOpts.upperArm), A = r.parts.upperArmR, cl = r.correctives.find((x) => x.id === `${c.id.slice(0, -1)}L`);
    for (const st of A2.stations) for (const sl of A2.slots) {
      const a = A.stations.find((x) => x.id === st.id)?.points[sl], b = st.points[sl]; if (!a) continue;
      const v = sub(b, a); if (len(v) < 1e-4) continue;
      c.d[`upperArmR/${st.id}.${sl}`] = v.map(r6); cl.d[`upperArmL/${st.id}.${swapRL(sl)}`] = [r6(-v[0]), r6(v[1]), r6(v[2])];
    }
  }
  for (const c of r.correctives) delete c.arm;
  if (r.correctives.length && limbs.upperArm && r.parts.upperArmR) shoulderBlend(r);
  if (!r.correctives.length) delete r.correctives;
  const gone = Object.keys(r.parts).filter((k) => /^(pectoral|bust)[RL]$/.test(k));
  for (const k of gone) delete r.parts[k];
  for (const d of Object.values(r.dials || {})) {
    if (Array.isArray(d.parts)) d.parts = d.parts.filter((p) => !gone.includes(p));
    if (d.blend && d.parts?.some((p) => done.includes(p))) for (const pn of done) for (const s of r.parts[pn]?.stations || []) if (d.blend[s.id] === undefined) { const lo = d.blend[`st${Math.floor(s.u)}`] ?? 0, hi = d.blend[`st${Math.ceil(s.u)}`] ?? 0, t = s.u - Math.floor(s.u); d.blend[s.id] = r6(lo * (1 - t) + hi * t); }
  }
  return { recipe: r, field, removed: gone, landmarks: { crotch, navel: field.masses.dimples.find((d) => d.id === 'navel')?.c[2] ?? null }, fields: Object.fromEntries([['torso', pelvic ? handed(field.sd, 1) : field.sd], ...(pelvic ? [['pelvis', handed(pelvisSd ?? field.sd, -1)]] : []), ...Object.entries(limbs).map(([k, l]) => [k, l.sd])]) };
}
