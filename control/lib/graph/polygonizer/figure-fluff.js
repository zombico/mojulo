/**
 * FIGURE-FLUFF — the zdog-principled volume vocabulary (figure-fluff.plan.md).
 *
 * A FLUFF is a named simple volume bound to an armature segment (or node),
 * sampled into the same tagged ring-stacks `buildProtoform` emits
 * (`{ id, rings: [{ center, polyline }] }`, world = STAND × scale), so the
 * garment layer and the vexar renderer eat fluff stacks unchanged. Fluffform
 * is a SIBLING of protoform: the stylized flesh register (chunky named solids,
 * girth contrast by default) vs proto's anatomical one — not a layer on top.
 *
 * The shape table is CLOSED — five profiles, everything else is SUPERPOSITION:
 * fluffs sharing a segment merge by per-ring smooth-max of their radius fields
 * (the vajra smooth-min move, inverted), with ONE `blend` across the whole
 * character. Joints between segments are covered the zdog way — a `bead` at
 * the shared node — not by cross-segment field math.
 *
 *   cone      r(t) = girth → girth·taper (taper > 1 = FLARE, the boot)
 *   football  vesica girth·sin(π·w(t)), `peak` slides the belly, `mouth`
 *             truncates the distal end flat (the cuff / arm-cannon opening)
 *   bead      sphere at a node (the radii-map move, but composable)
 *   bell      flared cosine, `mouth` = the wide distal radius
 *   slab      superellipse cross-section (the one non-round), `depth` + `n`
 *
 * Segment binding is armature-agnostic: a fluff names two landmark keys in
 * whatever positions map it is built against (human `articulate()` output
 * today, the animal armature later). Nothing here is human-specific.
 */

const vsub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const vadd = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const vmul = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const vlen = (a) => Math.hypot(a.x, a.y, a.z);
const vnorm = (a) => { const l = vlen(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const vcross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

// Polynomial smooth-max (the smooth-min mirror): C1, returns ≥ max(a,b)−k/4.
export function smoothMax(a, b, k) {
  if (k <= 0) return Math.max(a, b);
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (a - b)) / k));
  return a * h + b * (1 - h) + k * h * (1 - h);
}

// One softness across the whole character (the armature's single-BLEND spirit),
// in STAND units. Callers may override per build, never per pair.
export const FLUFF_BLEND = 0.012;

// End floor: a profile never collapses to a true point — rings stay real
// (zdog chunk, and no degenerate polylines for the mesher). STAND units.
const MIN_R = 0.004;

// Rounded end caps: a segment fluff is a closed chunk, not an open tube (an
// open end back-face-culls into a hollow read). Each end gets CAP_RINGS extra
// rings — the end cross-section scaled by cos-ease while pushing along the
// axis (a quarter-round). A truncated football MOUTH stays open by design.
export const FLUFF_CAP_RINGS = 3;

// ─── The CLOSED shape table ─────────────────────────────────────────────
// Each entry: dials (name → { def, min, max? }) and a radius profile
// r(t, dials) in STAND units, t ∈ [0,1] proximal → distal. `section` (slab)
// overrides the circular cross-section. `span` may shorten the sampled
// domain (football mouth truncation).
export const FLUFF_SHAPES = {
  cone: {
    binds: 'segment',
    dials: { girth: { def: 0.03, min: 1e-4 }, taper: { def: 0.55, min: 1e-3 } },
    profile: (t, d) => Math.max(MIN_R, d.girth * (1 + (d.taper - 1) * t)),
  },
  football: {
    binds: 'segment',
    dials: {
      girth: { def: 0.03, min: 1e-4 },
      peak: { def: 0.5, min: 0.05, max: 0.95 },   // where the belly sits along the segment
      mouth: { def: 0, min: 0, max: 0.95 },        // distal truncation: opening radius as a girth fraction (0 = closed vesica)
    },
    // vesica: sin(π·w) with the belly slid to `peak` by a piecewise-linear warp.
    profile: (t, d) => {
      const w = t < d.peak ? (0.5 * t) / d.peak : 0.5 + (0.5 * (t - d.peak)) / (1 - d.peak);
      return Math.max(MIN_R, d.girth * Math.sin(Math.PI * w));
    },
    // mouth > 0 cuts the domain where the DISTAL falloff reaches mouth·girth:
    // the stack ends in a flat ring of that radius (the cuff), open-ended.
    span: (d) => {
      if (!(d.mouth > 0)) return 1;
      const y = Math.max(d.mouth, MIN_R / d.girth);
      return d.peak + ((1 - d.peak) * (Math.PI - Math.asin(Math.min(1, y)) * 2)) / Math.PI;
    },
  },
  bead: {
    binds: 'node',
    // `peak` pulls the sphere toward a CONE (0 = round bead · 1 = straight-sided cone rising to
    // an apex → a triangular/tent profile: the camel/bison hump, a dorsal crest). `squash` scales
    // the vertical extent (flatten or heighten). Both node-local; the ring maker blends them.
    dials: { r: { def: 0.03, min: 1e-4 }, peak: { def: 0, min: 0, max: 1 }, squash: { def: 1, min: 0.1 } },
  },
  bell: {
    binds: 'segment',
    dials: { girth: { def: 0.02, min: 1e-4 }, mouth: { def: 0.06, min: 1e-4 } },
    // cosine ease, narrow proximal → `mouth` at the distal hem (flare accelerates).
    profile: (t, d) => Math.max(MIN_R, d.girth + (d.mouth - d.girth) * (1 - Math.cos((Math.PI / 2) * t))),
  },
  slab: {
    binds: 'segment',
    dials: {
      girth: { def: 0.03, min: 1e-4 },            // half-width (local u)
      depth: { def: 0.018, min: 1e-4 },           // half-depth (local v)
      n: { def: 4, min: 2 },                      // superellipse exponent (2 = ellipse, ↑ = boxier)
      taper: { def: 1, min: 1e-3 },
    },
    profile: (t, d) => Math.max(MIN_R, d.girth * (1 + (d.taper - 1) * t)),
    // superellipse polar form: multiplier on the profile radius at ring azimuth,
    // so every shape is a polar radius function and superposition is uniform.
    // (x/1)^n + (y/(depth/girth))^n = 1 → r(θ) = (|cosθ|^n + |sinθ/B|^n)^(-1/n)
    polar: (ang, d) => {
      const B = d.depth / d.girth;
      return (Math.abs(Math.cos(ang)) ** d.n + Math.abs(Math.sin(ang) / B) ** d.n) ** (-1 / d.n);
    },
  },
};

export const FLUFF_SHAPE_NAMES = Object.keys(FLUFF_SHAPES);

// ─── Validation (mint-time; mirrors validateVajras' 400-not-500 posture) ──
export function validateFluffs(fluffs, positions = null) {
  const errors = [];
  if (!Array.isArray(fluffs)) return ['fluffs: must be an array of fluff specs'];
  fluffs.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object') { errors.push(`fluffs[${i}]: must be an object`); return; }
    const shape = FLUFF_SHAPES[spec.shape];
    if (!shape) { errors.push(`fluffs[${i}].shape: must be one of ${FLUFF_SHAPE_NAMES.join(', ')} — got '${spec.shape}'`); return; }
    // binding
    if (shape.binds === 'segment') {
      if (!Array.isArray(spec.segment) || spec.segment.length !== 2 || spec.segment.some((k) => typeof k !== 'string')) {
        errors.push(`fluffs[${i}].segment: '${spec.shape}' binds a segment — two landmark keys [proximal, distal]`);
      } else if (spec.segment[0] === spec.segment[1]) {
        errors.push(`fluffs[${i}].segment: proximal and distal must differ (zero-length segment)`);
      } else if (positions) {
        for (const k of spec.segment) if (!positions[k]) errors.push(`fluffs[${i}].segment: unknown landmark '${k}'`);
      }
      if (spec.node !== undefined) errors.push(`fluffs[${i}]: '${spec.shape}' binds a segment, not a node`);
    } else {
      if (typeof spec.node !== 'string') errors.push(`fluffs[${i}].node: '${spec.shape}' binds a node — one landmark key`);
      else if (positions && !positions[spec.node]) errors.push(`fluffs[${i}].node: unknown landmark '${spec.node}'`);
      if (spec.segment !== undefined) errors.push(`fluffs[${i}]: '${spec.shape}' binds a node, not a segment`);
    }
    // dials — unknown dials are errors (the table is CLOSED)
    for (const key of Object.keys(spec)) {
      if (['shape', 'segment', 'node', 'id', 'bias', 'hex'].includes(key)) continue;
      const dial = shape.dials[key];
      if (!dial) { errors.push(`fluffs[${i}].${key}: not a dial of '${spec.shape}' (dials: ${Object.keys(shape.dials).join(', ')})`); continue; }
      const v = spec[key];
      if (!Number.isFinite(v)) errors.push(`fluffs[${i}].${key}: must be a finite number`);
      else if (v < dial.min) errors.push(`fluffs[${i}].${key}: must be ≥ ${dial.min}`);
      else if (dial.max !== undefined && v > dial.max) errors.push(`fluffs[${i}].${key}: must be ≤ ${dial.max}`);
    }
    if (spec.bias !== undefined) {
      const b = spec.bias;
      if (!b || typeof b !== 'object' || [b.x, b.y, b.z].some((c) => c !== undefined && !Number.isFinite(c))) {
        errors.push(`fluffs[${i}].bias: must be { x?, y?, z? } finite offsets (STAND units)`);
      }
    }
    if (spec.id !== undefined && (typeof spec.id !== 'string' || !spec.id)) errors.push(`fluffs[${i}].id: must be a non-empty string`);
  });
  return errors;
}

// resolve a spec's dials against the shape defaults
function dialsOf(spec) {
  const out = {};
  for (const [k, d] of Object.entries(FLUFF_SHAPES[spec.shape].dials)) out[k] = Number.isFinite(spec[k]) ? spec[k] : d.def;
  return out;
}

// stable ring frame perpendicular to the segment axis
function ringFrame(axis) {
  const ref = Math.abs(axis.z) < 0.99 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const u = vnorm(vcross(ref, axis));      // lateral-ish
  const v = vcross(axis, u);               // forward-ish
  return { u, v };
}

// A node ring-stack: a sphere (bead) blended toward a CONE by `peak`, scaled vertically by
// `squash`. peak 0 → latitude sphere (unchanged); peak 1 → base-down/apex-up cone (straight
// sides = a triangular profile). Blending the two per-ring keeps a rounded base with a peaked top.
function beadRings(c, r, { latRings, samples, peak = 0, squash = 1 }) {
  const rings = [];
  for (let i = 0; i < latRings; i++) {
    const t = i / (latRings - 1);                 // 0 bottom → 1 top
    const th = Math.PI * (t - 0.5);
    const zS = Math.sin(th), radialS = Math.cos(th);   // sphere profile
    const zC = 2 * t - 1, radialC = 1 - t;             // cone: widest at base → apex at top
    const cz = c.z + r * (zS * (1 - peak) + zC * peak) * squash;
    const rr = Math.max(MIN_R * 0.5, r * (radialS * (1 - peak) + radialC * peak));
    const poly = [];
    for (let j = 0; j <= samples; j++) {
      const a = (j / samples) * Math.PI * 2;
      poly.push({ x: c.x + rr * Math.cos(a), y: c.y + rr * Math.sin(a), z: cz });
    }
    rings.push({ center: { x: c.x, y: c.y, z: cz }, polyline: poly });
  }
  return rings;
}

/**
 * Build fluff volumes into proto-shaped tagged ring-stacks.
 *
 * @param {object} positions   landmark map (e.g. `articulate(dof)`), STAND units
 * @param {Array}  fluffs      validated fluff specs
 * @param {object} opts        { scale = 12, rings = 14, samples = 24, blend = FLUFF_BLEND }
 * @returns {Array<{id, rings: [{center, polyline}], hex?}>}  world = STAND × scale
 *
 * SUPERPOSITION: segment fluffs on the same ordered node pair merge into ONE
 * stack — per-ring smooth-max of their radius fields (azimuth-aware, so a slab
 * superposed with a round shape stays a smooth union). `bias` shifts ring
 * centers, weighted by the shape's own profile (fat where the mass is, pinned
 * at thin ends) — the femoral-neck move.
 */
export function buildFluffs(positions, fluffs, opts = {}) {
  const { scale = 12, rings: RING_N = 14, samples = 24, blend = FLUFF_BLEND } = opts;
  const errors = validateFluffs(fluffs, positions);
  if (errors.length) throw new Error(`buildFluffs: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`);
  const toWorld = (q) => ({ x: q.x * scale, y: q.y * scale, z: q.z * scale });

  const stacks = [];
  const segGroups = new Map();   // 'a→b' → specs (superposition group)
  for (const spec of fluffs) {
    if (FLUFF_SHAPES[spec.shape].binds === 'node') {
      const d = dialsOf(spec), c = vadd(positions[spec.node], spec.bias ? { x: spec.bias.x || 0, y: spec.bias.y || 0, z: spec.bias.z || 0 } : { x: 0, y: 0, z: 0 });
      stacks.push({
        id: spec.id || `fluff:${spec.node}`,
        ...(spec.hex ? { hex: spec.hex } : {}),
        rings: beadRings(c, d.r, { latRings: 10, samples, peak: d.peak, squash: d.squash }).map((rg) => ({ center: toWorld(rg.center), polyline: rg.polyline.map(toWorld) })),
      });
    } else {
      const key = `${spec.segment[0]}→${spec.segment[1]}`;
      if (!segGroups.has(key)) segGroups.set(key, []);
      segGroups.get(key).push(spec);
    }
  }

  for (const specs of segGroups.values()) {
    const [aKey, bKey] = specs[0].segment;
    const a = positions[aKey], b = positions[bKey];
    const axis = vnorm(vsub(b, a)), L = vlen(vsub(b, a));
    if (L < 1e-9) throw new Error(`buildFluffs: segment ${aKey}→${bKey} has coincident endpoints`);
    const { u, v } = ringFrame(axis);
    // sampled domain: the longest span among the group (a truncated football
    // superposed with a full cone still needs the cone's full run)
    const members = specs.map((spec) => {
      const shape = FLUFF_SHAPES[spec.shape], d = dialsOf(spec);
      return { spec, shape, d, span: shape.span ? shape.span(d) : 1 };
    });
    const span = Math.max(...members.map((m) => m.span));
    const rings = [];
    for (let i = 0; i <= RING_N; i++) {
      const t = (i / RING_N) * span;
      // per-member profile radius at this station (0 beyond a member's own span —
      // profile is defined on raw t; truncation just stops the sampling early)
      const rs = members.map((m) => (t <= m.span + 1e-9 ? m.shape.profile(t, m.d) : 0));
      // bias: profile-weighted center shift (fat where the mass is, pinned at
      // thin ends — the femoral-neck move), superposed linearly across members
      let center = vadd(a, vmul(axis, t * L));
      for (let k = 0; k < members.length; k++) {
        const bias = members[k].spec.bias;
        if (!bias || rs[k] <= 0) continue;
        const w = rs[k] / (members[k].d.girth || 1);
        center = vadd(center, vmul({ x: bias.x || 0, y: bias.y || 0, z: bias.z || 0 }, w));
      }
      const poly = [];
      for (let j = 0; j <= samples; j++) {
        const ang = (j / samples) * Math.PI * 2;
        // every member is a polar radius function of ring azimuth; superposition
        // is a running smooth-max across them
        let r = 0;
        for (let k = 0; k < members.length; k++) {
          if (rs[k] <= 0) continue;
          const m = members[k];
          const rr = rs[k] * (m.shape.polar ? m.shape.polar(ang, m.d) : 1);
          r = r === 0 ? rr : smoothMax(r, rr, blend);
        }
        if (r <= 0) r = MIN_R;
        poly.push(vadd(center, vadd(vmul(u, r * Math.cos(ang)), vmul(v, r * Math.sin(ang)))));
      }
      rings.push({ center: toWorld(center), polyline: poly.map(toWorld) });
    }
    // rounded end caps (skip a mouth-truncated distal end — the cuff is OPEN)
    const openDistal = members.some((m) => m.d.mouth > 0 && Math.abs(m.span - span) < 1e-9);
    const capOf = (ring, dir) => {
      const caps = [];
      const c = ring.center;
      let meanR = 0;
      for (const q of ring.polyline) meanR += Math.hypot(q.x - c.x, q.y - c.y, q.z - c.z);
      meanR /= ring.polyline.length;
      const depth = meanR * 0.7;
      for (let k = 1; k <= FLUFF_CAP_RINGS; k++) {
        const a = (k / FLUFF_CAP_RINGS) * (Math.PI / 2);
        const scaleR = Math.max(Math.cos(a), 0.04), push = Math.sin(a) * depth;   // world units (meanR is world)
        const cc = { x: c.x + axis.x * dir * push, y: c.y + axis.y * dir * push, z: c.z + axis.z * dir * push };
        caps.push({
          center: cc,
          polyline: ring.polyline.map((q) => ({ x: cc.x + (q.x - c.x) * scaleR, y: cc.y + (q.y - c.y) * scaleR, z: cc.z + (q.z - c.z) * scaleR })),
        });
      }
      return caps;
    };
    rings.unshift(...capOf(rings[0], -1).reverse());
    if (!openDistal) rings.push(...capOf(rings[rings.length - 1], 1));
    const first = specs[0];
    stacks.push({ id: first.id || `fluff:${aKey}-${bKey}`, ...(first.hex ? { hex: first.hex } : {}), rings });
  }
  return stacks;
}
