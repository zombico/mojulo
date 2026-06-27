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

// Canonical config = today's hand-tuned male figure. Per-region knobs are
// intra-sex multipliers (1 = canonical); sex picks the dimorphic baseline.
export const PROTO_DEFAULT = {
  // global
  height: 1.0,
  stockiness: 1.0,
  headScale: 1.0,        // skull size about the neck join — the dominant child↔adult cue
                         //   (>1 enlarges the cranium; "heads-tall" ages a figure down without armature edits)
  articulation: 'max',
  sex: 'male',
  stitched: true,        // canonical 8a build (pelvis folded in, tank + shirts)
  // per-region (multipliers on the dimorphic baseline; 1 = canonical)
  chestWidth: 1,         // ribcage / chest-front breadth
  pecProjection: 1,      // pec-plate / breast forward dome
  tankVee: 1,            // lat/oblique V-flare of the side form
  waistTuck: 1,          // waist pinch depth
  dantien: 1,            // lower-belly mass
  bicep: 1,              // upper-arm lobe volume
  forearm: 1,            // forearm belly volume
  quad: 1,               // thigh (quad) lobe volume
  calf: 1,               // calf lobe volume
  wristTaper: 1,         // how flat the wrist tapers (for the flipper hand)
  gluteSize: 1,          // glute bun mass
  scapulaBun: 1,         // upper-back scapula mass
  footLength: 1,         // foot forward reach
  handSize: 1,           // hand paddle scale
  groinDrop: 1,          // male groin orb drop below the glute line
};

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
export function breastPt(p, sgn, rr, a, { dim, breastScale = 1, chestWidth = 1, pecProjection = 1 } = {}) {
  const W = 0.082 * dim.ribW * chestWidth, AP = 0.058 * dim.ribW * chestWidth, cyT = 0.012;
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
export function buildProtoform(positions, proto = {}, legNodes = null, footFlex = null, handFlex = null) {
  const P = { ...PROTO_DEFAULT, ...proto };
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
  // headScale grows the skull about p.headBase (the neck↔skull join): every
  // offset + radius is measured from headBase via onBone, so multiplying them by
  // `hs` scales the head in place without detaching it from the neck (the head is
  // a terminal segment — nothing rides on it). This is the child↔adult lever.
  const hs = P.headScale;
  const headEggRings = (p) => {
    const f = boneFrame(p.headBase, p.headTop);
    const top = onBone(p.headBase, f, 0.081 * hs, -0.012 * hs);
    const cranial = onBone(p.headBase, f, 0.0525 * hs, -0.008 * hs);
    const chin = onBone(p.headBase, f, 0.003 * hs, 0.018 * hs);
    return worldRingsVajra(top, cranial, chin, [0.038 * hs, 0.052 * hs, 0.015 * hs], 40, 22);
  };
  const faceMaskRings = (p) => {
    const f = boneFrame(p.headBase, p.headTop);
    const N = 11, M = 24, rings = [];
    for (let i = 0; i < N; i++) {
      const t = i / (N - 1), along = (0.0525 + lerp(0.024, -0.072, t)) * hs;   // cz±, along the head bone
      const env = Math.sin(Math.PI * (0.2 + 0.64 * t));
      const wx = 0.044 * env * hs, dy = 0.024 * env * hs, cyc = (0.03 + 0.012 * t) * hs;
      const poly = [];
      for (let j = 0; j <= M; j++) { const a = (j / M) * Math.PI * 2; poly.push(toWorld(onBone(p.headBase, f, along, cyc + dy * Math.sin(a), wx * Math.cos(a)))); }
      rings.push({ polyline: poly, center: toWorld(onBone(p.headBase, f, along, cyc, 0)) });
    }
    return rings;
  };
  const neckRings = (p) => {
    const f = boneFrame(p.neckHub, p.headBase);
    const len = Math.hypot(p.headBase.x - p.neckHub.x, p.headBase.y - p.neckHub.y, p.headBase.z - p.neckHub.z);
    const base = onBone(p.neckHub, f, len, 0.01);
    const mid = onBone(p.neckHub, f, len * 0.5, 0.005);
    const root = onBone(p.neckHub, f, 0, 0.0);
    return worldRingsVajra(base, mid, root, [0.032, 0.031, 0.044], 32, 20);
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
      let rx, ap, cy;
      if (z >= costalZ) {
        const tt = (z - costalZ) / (T1z - costalZ), prof = eggProf(tt);
        rx = W * prof; ap = AP * prof;
        cy = bez(-0.005, -0.06, -0.06, 0.005, tt) + ap * ct;
      } else {
        const uu = (z - pelvZ) / (costalZ - pelvZ), waist = g(uu, 0.5, 0.26);
        rx = lerp(rxHip, rxTop, uu) - 0.006 * dim.waist * P.waistTuck * waist;
        ap = lerp(apHip, apTop, uu) - 0.005 * waist;
        cy = lerp(cyHip, cyTop, uu) + 0.008 * g(uu, 0.45, 0.38);
        if (stitched) {
          const flare = g(uu, 0.0, 0.30);
          rx += (hipHalf * 0.80 - rxHip) * flare;
          ap += 0.006 * flare;
          cy += 0.020 * flare;
        }
      }
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
    const opts = { dim, breastScale: dim.breast, chestWidth: P.chestWidth, pecProjection: P.pecProjection };
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
      const rx = lerp(hipHalf * 0.92, hipHalf * 0.98, t), apH = lerp(0.044, 0.056, t), yBack = lerp(-0.008, -0.024, t);
      const cy = yBack + apH * ct, cz = z - apH * st;
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
  const upperArmRings = (sh, el, { baseR = 0.0345 * (0.78 + 0.22 * dim.limb), bicep = BICEP_ADJ * dim.limb * P.bicep, tricep = TRICEP_ADJ * dim.limb * P.bicep, N = 22, M = 24 } = {}) => {
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
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const th = (j / M) * Math.PI * 2, lat = Math.cos(th), apc = Math.sin(th);
        const ry = apc >= 0 ? r + bA : r + tA;
        poly.push({ x: c.x + side.x * r * lat + ap.x * ry * apc, y: c.y + side.y * r * lat + ap.y * ry * apc, z: c.z + side.z * r * lat + ap.z * ry * apc });
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
      const belly = Math.exp(-Math.pow((t - 0.40) / 0.30, 2));
      const elbowFill = Math.exp(-Math.pow((t - 0.06) / 0.16, 2));
      const r = (0.013 + 0.018 * P.forearm * belly * 0.82 + 0.0085 * P.forearm * elbowFill + 0.011 * t * t) * SCALE;
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
  const legRings = (hip, knee, ankle, sgn, { baseR = 0.023, quad = 0.026 * BUILD * dim.limb * P.quad, lat = 0.017 * BUILD * dim.limb, med = 0.016 * BUILD * dim.limb, post = 0.046 * BUILD, ham = 0.03 * BUILD, calf = 0.04 * BUILD * dim.limb * P.calf, N = 44, M = 28 } = {}) => {
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
      const thigh = g(u, 0.3, 0.23), calfB = g(u, uK + 0.1, 0.22), pinch = g(u, uK, 0.05);
      const ankleHold = g(u, 1, 0.13);                       // tighter band → a slimmer ankle
      const glute = g(u, 0.13, 0.21);
      const hamB = g(u, 0.3, 0.13);
      const r = baseR * (0.5 + 0.55 * thigh * TH + 0.6 * calfB * CF + 0.5 * ankleHold) * (1 - 0.34 * pinch) * SCALE;
      const fr = r + quad * thigh * TH * SCALE + calf * calfB * 0.25 * CF * SCALE;
      const br = r + post * glute * SCALE + ham * hamB * TH * SCALE + calf * calfB * CF * SCALE;
      const latR = r + lat * thigh * TH * SCALE + post * glute * 0.4 * SCALE + calf * calfB * 0.55 * CF * SCALE;
      const medR = r + med * thigh * TH * SCALE + ham * hamB * 0.45 * TH * SCALE + post * glute * 0.55 * SCALE + calf * calfB * 0.55 * CF * SCALE;
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
  const gluteRear = dim.sex === 'female' ? 0.70 : 1;
  const glute = (p, s) => ellipsoidRings(
    { x: s * Math.abs(p.hipL.x) * 0.47, y: -0.035 * dim.glute * P.gluteSize * gluteRear, z: p.hipL.z - 0.045 },
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
    return ellipsoidRings(c, 0.0377 * dim.hip, 0.041, 0.0426, { N: 14, M: 22 });
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
    return ellipsoidRings(c, 0.040 * dim.shoulder, 0.040, 0.046, { N: 16, M: 24 });
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
    const rr = 0.019 * (0.85 + 0.15 * dim.limb);
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
    const toeOff = 0.150 * P.footLength, heelOff = -0.050;
    const ballT = 0.60, ballAlong = lerp(heelOff, toeOff, ballT), ballSole = -0.026;
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
    const stations = [
      { t: 0.00, s: -0.006, t2: 0.008, hw: 0.012 },         // heel cap (rounded back)
      { t: 0.14, s: -0.024, t2: 0.026, hw: 0.030 },         // heel body, instep rising
      { t: 0.30, s: -0.026, t2: 0.030, hw: 0.033 },         // under the ankle: instep dome
      { t: 0.46, s: -0.015, t2: 0.020, hw: 0.031 },         // ARCH: the medial sole lifts off the floor
      { t: 0.60, s: -0.026, t2: 0.006, hw: 0.042 },         // BALL: widest, back on the floor  ← toe hinge
      { t: 0.80, s: -0.024, t2: -0.004, hw: 0.034 },        // toes
      { t: 1.00, s: -0.018, t2: -0.013, hw: 0.013 },        // toe cap (tapered, rounded)
    ];
    const M = 24, round = 0.62, raw = [];
    let soleZ = Infinity;
    for (const st of stations) {
      const along0 = lerp(heelOff, toeOff, st.t), cUp0 = (st.s + st.t2) / 2, hUp = (st.t2 - st.s) / 2;
      const poly = [];
      for (let j = 0; j <= M; j++) {
        const a = (j / M) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
        const lift0 = cUp0 + hUp * Math.sign(sa) * Math.pow(Math.abs(sa), round);
        const b = bend(along0, lift0);
        const P = ptS(b.along, b.lift, st.hw * Math.sign(ca) * Math.pow(Math.abs(ca), round));
        if (P.z < soleZ) soleZ = P.z;
        poly.push(P);
      }
      const bc = bend(along0, cUp0);
      raw.push({ polyline: poly, center: ptS(bc.along, bc.lift, 0) });
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
  add('headEgg', headEggRings(p));
  add('faceMask', faceMaskRings(p));
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
  const danC = { x: 0, y: dan.c.y + 0.014, z: dan.c.z };
  add('dantien', ellipsoidRings(danC, dan.r * 0.82 * P.dantien, dan.r * 0.66 * P.dantien, dan.r * 0.82 * P.dantien));
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
