/**
 * cloth-flow — dynamic drape as a BEHAVIOR over garments (not a new garment kind).
 *
 * The garment catalog (`GARMENTS` in figure-garments.js) is static — `buildGarment`
 * is a pure function of the pose, with no time. `flowDrape` is the missing third axis:
 * it displaces a draped garment's OUTER cloth (`*:drape` stacks) by a phase-driven wave,
 * so a cape / gown / skirt / dress flows with the gait. Pure (stacks → stacks), no
 * renderer dependency — a spike drives it per frame today; the renderer threads phase
 * later (see cloth-flow.plan.md).
 *
 * The wave model (carried from the cape proto):
 *   • PIN → FREE  env = smoothstep(1 − zf): 0 at the anchor (sewn to the body) → 1 at
 *     the hem (free to swing). The wave only ever moves the free part.
 *   • WAVE        w = Σ ampₖ·sin(azₖ·θ + zcₖ·zf·2π + phase) over azimuth θ + height zf —
 *     superposition gives a primary swing + micro-folds. Displaced along the outward radial.
 *   • SAG         a constant outward+down hem relaxation (gravity flare), × env.
 *   • TRAIL/SWAY  gait coupling: the hem streams backward (−y) and sways laterally with the
 *     step gusts, × env. Phase advances with the gait, so crests travel down the drape.
 *
 * The anchor tracks the body for free — the rings come from the already-posed garment, which
 * rides the gait's girdle counter-rotation.
 */

const TAU = 2 * Math.PI;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

export const FLOW_DEFAULTS = {
  amp: 0.6,                                   // primary billow amplitude (PROTO units)
  waves: [                                    // azimuth (az) + down-length (zc) wave components
    { amp: 1.00, az: 3, zc: 1.4 },            //   primary swing — 3 lobes around, ~1.4 down the fall
    { amp: 0.40, az: 6, zc: 2.6 },            //   secondary folds
    { amp: 0.18, az: 11, zc: 4.0 },           //   micro chop
  ],
  sag: 0.40,                                  // hem flares outward + sinks (gravity), × env
  trail: 0.60,                                // hem streams backward (−y), × env
  sway: 0.50,                                 // lateral sway, coupled to the step, × env
  cadence: 1,                                 // strides per loop (matches the gait)
  match: (id) => id.endsWith(':drape'),       // which stacks are the OUTER flowing cloth
};

/**
 * Displace a posed garment's outer drape stacks by the flow wave.
 * @param {Array} stacks  ring-stacks from buildPosedFigure (flesh + garment)
 * @param {object} opts   { phase, step?, ...FLOW_DEFAULTS } — phase ∈ [0,1) advances with the gait;
 *                         `step` (−1..1, e.g. the dof weight-shift) couples sway/gust to the stride,
 *                         else it's derived from phase.
 * @returns {Array} stacks with the matched `*:drape` stacks waved (others passed through)
 */
export function flowDrape(stacks, opts = {}) {
  const p = { ...FLOW_DEFAULTS, ...opts };
  const phase = opts.phase ?? 0;
  const stepSig = p.step != null ? p.step : Math.sin(TAU * phase * p.cadence * 2);   // step/gust signal
  const gust = 0.6 + 0.4 * Math.abs(stepSig);                                         // amplitude pulses on foot-plant
  return stacks.map((st) => {
    if (!p.match(st.id)) return st;
    let zMin = Infinity, zMax = -Infinity;
    for (const r of st.rings) for (const v of r.polyline) { if (v.z < zMin) zMin = v.z; if (v.z > zMax) zMax = v.z; }
    const span = (zMax - zMin) || 1;
    const rings = st.rings.map((r) => {
      const c = r.center;
      const polyline = r.polyline.map((v) => {
        const zf = (v.z - zMin) / span;                       // 0 hem … 1 anchor
        const env = smooth(1 - zf);                           // pinned at the top
        if (env <= 1e-4) return v;
        const dx = v.x - c.x, dy = v.y - c.y, rad = Math.hypot(dx, dy) || 1e-6;
        const rx = dx / rad, ry = dy / rad, th = Math.atan2(dy, dx);
        let w = 0;
        for (const cw of p.waves) w += cw.amp * Math.sin(cw.az * th + cw.zc * zf * TAU + phase);
        const out = env * (p.amp * w * gust + p.sag);         // billow + flare, along the radial
        return {
          x: v.x + rx * out + env * p.sway * stepSig,         // + lateral step sway
          y: v.y + ry * out - env * p.trail,                  // − backward stream
          z: v.z - env * p.sag * 0.4,                         // hem sinks a touch
        };
      });
      return { center: c, polyline };
    });
    return { ...st, rings };
  });
}

const meanRadius = (ring) => {
  const c = ring.center; let s = 0, n = 0;
  for (const p of ring.polyline) { s += Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z); n++; }
  return n ? s / n : 0.1;
};
// nearest point on segment a→b to p, with the capsule radius interpolated along it
const segPush = (p, a, b, ra, rb) => {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
  const ab2 = abx * abx + aby * aby + abz * abz || 1e-9;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / ab2));
  const cx = a.x + abx * t, cy = a.y + aby * t, cz = a.z + abz * t;   // nearest axis point
  const dx = p.x - cx, dy = p.y - cy, dz = p.z - cz;
  const d = Math.hypot(dx, dy, dz) || 1e-9, r = ra + (rb - ra) * t;
  return { d, r, ax: cx, ay: cy, az: cz, ux: dx / d, uy: dy / d, uz: dz / d };
};

/**
 * Push a draped garment's cloth OUT of the body's limbs — real collision, so the
 * swinging leg physically kicks the skirt (and the stepping knee stops poking through).
 * Each named body part is a capsule (centerline = ring centers, radius = mean ring radius);
 * any drape vertex inside one is moved to its surface. A pure transform (stacks → stacks),
 * composed AFTER flowDrape so it always resolves penetration.
 * @param {Array} stacks   the (already flowed) ring-stacks
 * @param {Array} body     the figure stacks (to read limb capsules from)
 * @param {object} opts    { parts?, margin?, kick?, match? }
 */
export function drapeCollide(stacks, body, { parts = ['legL', 'legR', 'footL', 'footR'], margin = 0.12, kick = 0.35, match = (id) => id.endsWith(':drape') } = {}) {
  const caps = parts.map((id) => body.find((s) => s.id === id)).filter(Boolean)
    .map((st) => st.rings.map((r) => ({ c: r.center, r: meanRadius(r) })));
  return stacks.map((st) => {
    if (!match(st.id)) return st;
    const rings = st.rings.map((r) => ({
      center: r.center,
      polyline: r.polyline.map((v) => {
        let best = null;
        for (const cap of caps) for (let i = 0; i < cap.length - 1; i++) {
          const h = segPush(v, cap[i].c, cap[i + 1].c, cap[i].r, cap[i + 1].r);
          if (h.d < h.r + margin && (!best || (h.r + margin - h.d) > best.push)) best = { ...h, push: h.r + margin - h.d };
        }
        if (!best) return v;
        // move to the capsule surface, then nudge a touch further along the push (the kick).
        const reach = best.push * (1 + kick);
        return { x: v.x + best.ux * reach, y: v.y + best.uy * reach, z: v.z + best.uz * reach };
      }),
    }));
    return { ...st, rings };
  });
}
