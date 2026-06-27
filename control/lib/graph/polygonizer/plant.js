/**
 * plant — a generative MACRO over the taiji primitive.
 *
 * Not a new render primitive: a plant spec carries a handful of high-level
 * botanical parameters and COMPILES to a list of taiji specs at mint time
 * (see `expandPlant`). Everything downstream is the existing taiji pipeline
 * — `validateTaijis`, the manji-svg taiji paint pass, the shared camera. The
 * substrate already renders `manifest.taijis`; this module just generates
 * that array from ~8 numbers instead of hand-authored coordinates.
 *
 * The mapping the spike validated
 * (lite-template/integration/0609/spike-output/taiji-plants/):
 *   - a SPINDLE taiji is a leaf / petal (teardrop tips; the rotating
 *     partition reads as venation),
 *   - a CAPSULE taiji is a stem / rachis / tongue-leaf (blunt, constant
 *     width; the partition reads as nodes/banding),
 *   - a plant is those placed by two DETERMINISTIC rules: golden-angle
 *     divergence around the growth axis + self-similar taper per node.
 *
 * Fully deterministic — no seeds (matching taiji). Same spec → identical
 * taijis, byte for byte.
 *
 * v1 scope: axis/center points are inline {x,y,z} only (a free-standing
 * plant in world space), so expansion happens pre-walk and the emitted
 * taijis need no endpoint-path resolution. Endpoint-path axes + an in-tree
 * `{ kind: 'plant' }` leaf with slot-binding are phase-2 follow-ups.
 *
 * Design: lite-template/integration/0609/plant-primitive.plan.md.
 * Dual reference: taiji.js (the primitive this compiles to).
 */

const PROFILES = new Set(['spindle', 'capsule']);
const FORMS = new Set(['shoot', 'frond', 'flower', 'rosette', 'tree', 'disc', 'grove', 'palm', 'tulip', 'bed']);

// A grove scatters many trees, so it gets a larger taiji ceiling than a single
// plant — but the scene segment budget (in the renderer) is the real guard.
// (Brush/silhouette taijis are cheap per object, so the object cap can be
// generous; heavy scenes are still caught by the segment budget at mint.)
const GROVE_MAX_TAIJIS = 2400;
// A bed scatters MANY small plants (tulips/shrubs/grass), but each is far
// lighter than a tree, so it shares the grove-scale ceiling.
const BED_MAX_TAIJIS = 2400;
// Default small-plant template for a bed: a short tulip, cheap to repeat.
const BED_PLANT_DEFAULTS = { form: 'tulip', height: 1.4 };
// Tulip-bed bloom colours, cycled per plant so a clump reads as mixed cultivars.
const BLOOM_PALETTE = ['#d6433a', '#e8902f', '#e85d8e', '#b07cd8', '#e8d24a', '#f2f2f2'];
// Default tree template for a grove: small, wigged, cheap to repeat.
const GROVE_TREE_DEFAULTS = { depth: 3, branches: 2, foliage: 'cluster', height: 5 };
// A few green shades cycled across trees so a grove isn't a flat single green.
const FOLIAGE_GREENS = [
  { partitionStroke: '#4a7c3a', yinStroke: '#7cb342', yangStroke: '#33691e' },
  { partitionStroke: '#5b8a44', yinStroke: '#84bd4a', yangStroke: '#3d7320' },
  { partitionStroke: '#3f6e34', yinStroke: '#6ea53a', yangStroke: '#2e5e1b' },
];

// Turns per node for golden-angle phyllotaxis: 1 - 1/φ ≈ 0.381966 of a
// full turn (the 137.5° divergence). The single constant that makes the
// spiral non-repeating; no two leaves stack.
const GOLDEN = 0.3819660112501051;

// Bound the compiled taiji count so a runaway `count`/`discCount` can't
// produce a multi-thousand-segment manifest.
const MAX_TAIJIS_PER_PLANT = 600;

// Browser-budget primitive. A taiji's rendered cost is ~crossSections×samples
// line segments; a plant has many taijis. AUTO_DETAIL_TARGET is the soft
// per-plant ceiling: if a plant expanded at its chosen detail would exceed it
// and the author did NOT pin detail/crossSections/samples, expandPlant
// silently drops to 'low' so the default path is always browser-safe. The
// hard scene-level backstop (a mint-time throw) lives in manji-trees.js.
const AUTO_DETAIL_TARGET = 6000;

// Mesh density per emitted taiji. A plant emits MANY taijis, so it defaults
// far lighter than a single hero taiji (whose own defaults are 24×48 ≈ 1150
// segments each — overkill repeated 14–110×). Each taiji's segment count is
// roughly crossSections × samples; these presets keep a whole plant in the
// low thousands of segments instead of tens of thousands. `detail` selects a
// preset; explicit `crossSections` / `samples` on the spec override it.
// Disc florets are tiny dots, so they get the coarsest mesh of all.
const DETAIL_PRESETS = {
  low: { leaf: { cs: 6, samples: 12 }, stem: { cs: 8, samples: 10 }, disc: { cs: 3, samples: 8 } },
  medium: { leaf: { cs: 8, samples: 18 }, stem: { cs: 12, samples: 14 }, disc: { cs: 4, samples: 8 } },
  high: { leaf: { cs: 16, samples: 32 }, stem: { cs: 20, samples: 24 }, disc: { cs: 6, samples: 12 } },
};

const DEFAULTS = {
  form: 'shoot',
  count: 13,
  divergence: GOLDEN,
  leafProfile: 'spindle',
  leafTwist: 0.1,
  leafLength: 1.8,
  leafWidth: 0.42,
  stemRadius: 0.16,
  stemTwist: 2,
  taper: 0.93,
  arch: 0.25,
};

/**
 * Validate a list of plant specs. Mirrors validateTaijis: returns an array
 * of error strings (empty when valid) so the MCP tool can surface them at
 * mint time, not at render.
 */
export function validatePlants(plants) {
  const errors = [];
  if (!Array.isArray(plants)) return errors;
  plants.forEach((spec, i) => {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      errors.push(`plants[${i}]: must be an object`);
      return;
    }
    const at = `plants[${i}]`;
    if (spec.form !== undefined && !FORMS.has(spec.form)) {
      errors.push(`${at}.form: must be one of ${Array.from(FORMS).join(', ')}`);
    }
    for (const key of ['base', 'tip', 'center', 'normal']) {
      if (spec[key] !== undefined && spec[key] !== null && !isFiniteVec(spec[key])) {
        errors.push(`${at}.${key}: must be {x,y,z} with finite numbers`);
      }
    }
    const base = isFiniteVec(spec.base) ? spec.base : (isFiniteVec(spec.center) ? spec.center : null);
    const tip = isFiniteVec(spec.tip) ? spec.tip : null;
    if (base && tip && sameVec(base, tip)) {
      errors.push(`${at}: base and tip must differ (zero-length growth axis)`);
    }
    if (spec.leafProfile !== undefined && !PROFILES.has(spec.leafProfile)) {
      errors.push(`${at}.leafProfile: must be 'spindle' or 'capsule'`);
    }
    if (spec.elementProfile !== undefined && !PROFILES.has(spec.elementProfile)) {
      errors.push(`${at}.elementProfile: must be 'spindle' or 'capsule'`);
    }
    if (spec.foliage !== undefined && typeof spec.foliage !== 'boolean'
      && !['leaves', 'cluster', 'wig', 'conifer', 'pine', 'fir',
        'canopy', 'umbrella', 'dome', 'spread', 'shade',
        'weeping', 'willow', 'pendant', 'droop'].includes(spec.foliage)) {
      errors.push(`${at}.foliage: must be a boolean or one of 'leaves', 'cluster', 'wig', 'conifer', 'pine', 'fir', 'canopy', 'umbrella', 'dome', 'spread', 'shade', 'weeping', 'willow', 'pendant', 'droop'`);
    }
    if (spec.detail !== undefined && !DETAIL_PRESETS[spec.detail]) {
      errors.push(`${at}.detail: must be one of ${Object.keys(DETAIL_PRESETS).join(', ')}`);
    }
    if (spec.paint !== undefined && !['lines', 'silhouette', 'fibers', 'brush'].includes(spec.paint)) {
      errors.push(`${at}.paint: must be one of 'lines', 'silhouette', 'fibers', 'brush'`);
    }
    for (const key of ['divergence', 'leafTwist', 'leafLength', 'leafWidth', 'stemRadius', 'stemTwist', 'taper', 'arch', 'branchAngle', 'lengthRatio', 'radiusRatio', 'crook', 'upBias', 'radius', 'dome', 'length', 'discRadius', 'elementSize', 'elementTwist', 'clusterSize', 'groundAmplitude', 'variation', 'frondLength', 'droop', 'frondRise', 'bend', 'pinnaLength', 'lift', 'trunkBulge', 'fanSpread', 'open', 'bloomLength']) {
      if (spec[key] !== undefined && !Number.isFinite(Number(spec[key]))) {
        errors.push(`${at}.${key}: must be a finite number`);
      }
    }
    for (const key of ['leafLength', 'leafWidth', 'stemRadius']) {
      if (spec[key] !== undefined && Number(spec[key]) <= 0) {
        errors.push(`${at}.${key}: must be positive`);
      }
    }
    if (spec.forkStyle !== undefined && !['spiral', 'planar'].includes(spec.forkStyle)) {
      errors.push(`${at}.forkStyle: must be 'spiral' or 'planar'`);
    }
    if (spec.frondType !== undefined && !['feather', 'fan', 'pinnate', 'palmate'].includes(spec.frondType)) {
      errors.push(`${at}.frondType: must be 'feather' or 'fan'`);
    }
    for (const key of ['count', 'discCount', 'crossSections', 'samples', 'depth', 'branches', 'leafCount', 'foliageTiers', 'foliageLevels', 'fronds', 'pinnae', 'coconuts', 'upFronds', 'trunkSegments', 'petals', 'leaves']) {
      if (spec[key] !== undefined && spec[key] !== null) {
        const n = Number(spec[key]);
        if (!Number.isInteger(n) || n < 0) {
          errors.push(`${at}.${key}: must be a non-negative integer`);
        }
      }
    }
    let total;
    let cap = MAX_TAIJIS_PER_PLANT;
    let what = 'count + discCount';
    if (spec.form === 'tree') {
      total = estimateTreeTaijis(spec); what = 'tree depth/branches/leafCount';
    } else if (spec.form === 'palm') {
      total = estimatePalmTaijis(spec); what = 'palm fronds × pinnae';
    } else if (spec.form === 'bed') {
      total = estimateBedTaijis(spec); cap = BED_MAX_TAIJIS; what = 'bed count × plant size';
    } else if (spec.form === 'grove') {
      total = estimateGroveTaijis(spec); cap = GROVE_MAX_TAIJIS; what = 'grove count × tree size';
    } else {
      total = Number(spec.count ?? DEFAULTS.count) + Number(spec.discCount ?? 0) + 1;
    }
    if (Number.isFinite(total) && total > cap) {
      errors.push(`${at}: ${what} too large (compiles to ~${total} taijis; max ${cap}). Reduce count/depth or split the scene.`);
    }
  });
  return errors;
}

/** Expand a list of plant specs into a flat list of taiji specs. */
export function expandPlants(plants) {
  if (!Array.isArray(plants)) return [];
  return plants.flatMap((spec) => expandPlant(spec));
}

/**
 * Expand one plant spec into the taiji specs that draw it. Pure and
 * deterministic.
 *
 * Browser-budget guard (the "don't go crazy" primitive): expand at the
 * chosen detail, and if the result would exceed AUTO_DETAIL_TARGET segments
 * while the author has NOT pinned `detail` / `crossSections` / `samples`,
 * re-expand at 'low'. Expansion is pure arithmetic, so the throwaway first
 * pass is cheap. Explicit settings are always honored.
 */
export function expandPlant(spec = {}) {
  const explicit = !!(spec && (
    (spec.detail && DETAIL_PRESETS[spec.detail])
    || Number.isInteger(spec.crossSections)
    || Number.isInteger(spec.samples)
  ));
  // `paint` lowers every emitted taiji to filled matter at render time.
  // Default 'silhouette' (solid + light); 'fibers' painterly; 'brush' thin
  // strokes; 'lines' the wireframe vein/banding look. Taijis that already
  // carry their own `matter` keep it (a per-element override wins).
  const paint = spec?.paint === 'lines' ? null
    : (spec?.paint === 'fibers' ? 'fibers'
      : (spec?.paint === 'brush' ? 'brush' : 'silhouette'));
  const withMatter = (ts) => ts.map((t) => (t.matter ? t : (paint ? { ...t, matter: { fill: paint } } : t)));
  const first = withMatter(expandPlantAt(spec));
  if (explicit || estimatePlantSegments(first) <= AUTO_DETAIL_TARGET) return first;
  return withMatter(expandPlantAt({ ...spec, detail: 'low' }));
}

/** Dispatch on `form` at a fixed detail (no budget adjustment). */
function expandPlantAt(spec = {}) {
  const form = FORMS.has(spec?.form) ? spec.form : DEFAULTS.form;
  switch (form) {
    case 'frond': return expandFrond(spec);
    case 'flower': return expandFlower(spec);
    case 'rosette': return expandRosette(spec);
    case 'tree': return expandTree(spec);
    case 'palm': return expandPalm(spec);
    case 'tulip': return expandTulip(spec);
    case 'disc': return expandDisc(spec);
    case 'grove': return expandGrove(spec);
    case 'bed': return expandBed(spec);
    case 'shoot':
    default: return expandShoot(spec);
  }
}

/**
 * Estimate the rendered SVG line-segment count for a list of taiji specs.
 * The partition mesh (crossSections × samples) dominates; the two strands add
 * ~2·crossSections. Used by the auto-detail guard here and the hard scene
 * budget in manji-trees.js. Mirrors taiji's own defaults (24 × 48).
 */
export function estimatePlantSegments(taijis) {
  if (!Array.isArray(taijis)) return 0;
  return taijis.reduce((n, t) => {
    const cs = Number.isInteger(t?.crossSections) ? t.crossSections : 24;
    const s = Number.isInteger(t?.samples) ? t.samples : 48;
    // Matter forms print far lighter than the wireframe mesh: a silhouette is
    // one ribbon (~2·crossSections segments); fibers add ~density strings.
    const fill = t?.matter?.fill;
    if (fill === 'silhouette') return n + 2 * cs;
    if (fill === 'brush') return n + 2 * cs; // two strand strokes
    if (fill === 'fibers') {
      const density = Number.isInteger(t.matter?.density) ? t.matter.density : 10;
      return n + 2 * cs + density * 22;
    }
    return n + cs * s + 2 * cs;
  }, 0);
}

// ─── form generators ────────────────────────────────────────────────────

/**
 * shoot — a stem (capsule taiji) bearing `count` leaves on the golden-angle
 * spiral, climbing the growth axis, shrinking by `taper` per node.
 */
function expandShoot(spec) {
  const p = resolve(spec, { stemTwist: 2, leafProfile: 'spindle', stemRadius: 0.16 });
  const axis = sub(p.tip, p.base);
  const L = norm(axis);
  const axisU = normalize(axis);
  const [e1, e2] = perpBasis(axisU);
  const out = [];

  // The stem itself: a thin twisting capsule taiji (chirality → spiral grain).
  out.push(taiji(p.base, p.tip, null, {
    twist: p.stemTwist, radius: p.stemRadius, profile: 'capsule',
    crossSections: p.stemCS, samples: p.stemSamples, style: p.stemStyle,
  }));

  for (let k = 0; k < p.count; k += 1) {
    const frac = (k + 0.5) / p.count;
    const theta = 2 * Math.PI * p.divergence * k;
    const s = Math.pow(p.taper, k);
    const len = p.leafLength * s;
    const wid = p.leafWidth * s;
    const radial = add(scale(e1, Math.cos(theta)), scale(e2, Math.sin(theta)));
    const node = add(p.base, scale(axisU, frac * L));
    const yin = add(node, scale(radial, p.stemRadius));
    const yang = add(add(node, scale(radial, p.stemRadius + len)), scale(axisU, 0.55 * len));
    const center = add(midpoint(yin, yang), scale(axisU, p.arch * len));
    out.push(taiji(yin, yang, center, {
      twist: p.leafTwist, radius: wid, profile: p.leafProfile,
      crossSections: p.leafCS, samples: p.leafSamples, style: p.leafStyle,
    }));
  }
  return out;
}

/**
 * frond — an arching rachis (capsule taiji, bent center) bearing `count`
 * pinnae on alternating sides along its Bézier, shrinking toward the tip.
 */
function expandFrond(spec) {
  const p = resolve(spec, {
    stemTwist: 1, leafProfile: 'spindle', stemRadius: 0.08,
    leafLength: 1.35, leafWidth: 0.18, leafTwist: 0.07, taper: 0.55, arch: 0.5,
  });
  const axisU = normalize(sub(p.tip, p.base));
  const [lateral, up] = perpBasis(axisU);
  // Bend the rachis: lift the control point off the base→tip chord along `up`.
  const chordLen = norm(sub(p.tip, p.base));
  const rachisCenter = add(midpoint(p.base, p.tip), scale(up, p.arch * chordLen));
  const out = [];
  out.push(taiji(p.base, p.tip, rachisCenter, {
    twist: p.stemTwist, radius: p.stemRadius, profile: 'capsule',
    crossSections: p.stemCS, samples: p.stemSamples, style: p.stemStyle,
  }));

  const M = p.count;
  for (let k = 0; k < M; k += 1) {
    const t = 0.06 + (M > 1 ? (k / (M - 1)) * 0.88 : 0.44);
    const P = bezier3(p.base, rachisCenter, p.tip, t);
    const side = (k % 2 === 0) ? 1 : -1;
    const grow = 1 - p.taper * t; // pinnae shrink toward the tip
    const len = p.leafLength * grow;
    const wid = p.leafWidth * grow;
    const yang = add(add(P, scale(lateral, side * len)), scale(up, 0.25 * len));
    const center = add(add(midpoint(P, yang), scale(lateral, side * 0.12 * len)), scale(up, 0.18 * len));
    out.push(taiji(P, yang, center, {
      twist: p.leafTwist, radius: wid, profile: p.leafProfile,
      crossSections: p.leafCS, samples: p.leafSamples, style: p.leafStyle,
    }));
  }
  return out;
}

/**
 * flower — `count` petals radiating from a bloom centre in the plane ⊥ to its
 * normal, plus an optional dense golden-angle disc of florets (the sunflower
 * head). Two placements: a FREE head (pass `center` + `tip` → bloom at center
 * facing center→tip, the original behaviour) or a STEMMED bloom (pass `base` +
 * `tip`, no `center` → a green stalk from base to a bloom at the top, facing up,
 * with bladelike leaves) so a `bed` can stand a clump of them up off the ground.
 * `petalColor` paints the petals (default green), `discColor` the floret centre;
 * petal `arch` cups them (flat ray daisy → deep poppy bowl), `count`/`leafWidth`
 * set the shape (many narrow rays = sunflower, few broad = pansy/poppy).
 */
function expandFlower(spec) {
  const hasCenter = isFiniteVec(spec?.center);
  const hasBase = isFiniteVec(spec?.base);
  const stemmed = !hasCenter && hasBase;   // bed-style: a bloom raised on a stalk
  const p = resolve(spec, {
    leafProfile: 'spindle', leafLength: 1.2, leafWidth: 0.5, leafTwist: 0.06, arch: 0.18,
  });
  let center;
  let normalU;
  let stemBase = null;
  if (stemmed) {
    stemBase = spec.base;
    const top = isFiniteVec(spec?.tip) ? spec.tip : add(stemBase, v(0, 0, 1));
    normalU = normalize(sub(top, stemBase));
    center = top;                          // bloom sits at the stem top, facing up the axis
  } else {
    center = hasCenter ? spec.center : v(0, 0, 0);
    const tip = isFiniteVec(spec?.tip) ? spec.tip : add(center, v(0, 0, 1));
    normalU = normalize(sub(tip, center));
  }
  const [u, w] = perpBasis(normalU);
  const innerR = Math.max(p.stemRadius, 0.08);
  const discCount = Number.isInteger(spec?.discCount) ? spec.discCount : 0;
  const discR = Number.isFinite(Number(spec?.discRadius)) ? Number(spec.discRadius) : innerR * 1.4;
  const solid = (hex) => ({ partitionStroke: hex, yinStroke: hex, yangStroke: hex, width: 0.6, strandWidth: 0.9 });
  const petalStyle = spec?.petalColor ? { ...solid(spec.petalColor), ...(spec?.style?.petal || {}) } : p.leafStyle;
  const discStyle = spec?.discColor ? solid(spec.discColor) : p.leafStyle;
  const out = [];

  // Stemmed: a green stalk + a couple of bladelike leaves so the bloom stands.
  if (stemmed) {
    const stemStyle = { partitionStroke: '#3f6e34', yinStroke: '#5b8a44', yangStroke: '#2e5e1b', width: 0.7, strandWidth: 1, ...(spec?.style?.stem || {}) };
    out.push(taiji(stemBase, center, null, {
      twist: 0.05, radius: Math.max(p.stemRadius, 0.04), profile: 'capsule',
      crossSections: p.stemCS, samples: p.stemSamples, style: stemStyle,
    }));
    const leaves = clampInt(spec?.leaves, 0, 4, 2);
    const lr = norm(sub(center, stemBase)) * 0.7;
    for (let l = 0; l < leaves; l += 1) {
      const sgn = (l % 2 === 0) ? 1 : -1;
      const radial = normalize(l >= 2 ? scale(w, sgn) : scale(u, sgn));
      out.push(bladeLeaf(stemBase, normalU, radial, lr * (0.95 + 0.1 * hash(l + 1, 7)), p.leafWidth * 0.45, p.leafCS, p.leafSamples, p.leafStyle));
    }
  }

  for (let k = 0; k < p.count; k += 1) {
    const theta = (2 * Math.PI * k) / p.count; // even whorl for a clean flower
    const radial = add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta)));
    const yin = add(center, scale(radial, innerR));
    const yang = add(center, scale(radial, innerR + p.leafLength));
    // Cup the petal: lift its mid control point along the normal.
    const petalCenter = add(midpoint(yin, yang), scale(normalU, p.arch * p.leafLength));
    out.push(taiji(yin, yang, petalCenter, {
      twist: p.leafTwist, radius: p.leafWidth, profile: p.leafProfile,
      crossSections: p.leafCS, samples: p.leafSamples, style: petalStyle,
    }));
  }

  // Disc florets: the golden-spiral packing (the `disc` capability), reused
  // here so a flower can carry a sunflower/poppy seed-head centre.
  if (discCount > 0) {
    out.push(...discPack({
      center, normalU, count: discCount, radius: discR,
      dome: numOr(spec?.dome, discR * 0.25), length: 0,
      profile: 'spindle', size: discR * 0.5, twist: 0,
      style: discStyle, cs: p.discCS, samples: p.discSamples,
    }));
  }
  return out;
}

// A bladelike leaf: a pointed spindle that shoots up from `base` along `up`,
// then arches over and flops down at the tip, leaning out along `radial`.
function bladeLeaf(base, up, radial, length, width, cs, samples, style) {
  const apex = add(add(base, scale(up, length * 0.95)), scale(radial, length * 0.16));   // high control → rises
  const yang = add(add(base, scale(up, length * 0.42)), scale(radial, length * 0.62));   // tip out + low → flops
  return taiji(base, yang, apex, {
    twist: 0.04, radius: width, profile: 'spindle', crossSections: cs, samples, style,
  });
}

/**
 * disc — the radial golden-circle capability as its own form: pack `count`
 * small taiji waveforms on a disc by the golden angle (137.5°), the same rule
 * a sunflower seed-head uses. `dome` bulges the packing into a paraboloid;
 * `length` turns it into a prolate ovoid (a pinecone / seed-cone) with the
 * elements reading as overlapping scales. Decoupled from `flower` so it can
 * be a sunflower head, a succulent crown, a seed-head, or a pinecone.
 */
function expandDisc(spec) {
  const center = isFiniteVec(spec?.center) ? spec.center : (isFiniteVec(spec?.base) ? spec.base : v(0, 0, 0));
  const tip = isFiniteVec(spec?.tip) ? spec.tip : add(center, v(0, 0, 1));
  const normalU = isFiniteVec(spec?.normal) ? normalize(spec.normal) : normalize(sub(tip, center));
  const p = resolve(spec, { leafProfile: 'spindle' });
  const count = Number.isInteger(spec?.count) ? spec.count : 120;
  const radius = numOr(spec?.radius, 2);
  const dome = numOr(spec?.dome, 0);
  const length = numOr(spec?.length, 0);
  const profile = PROFILES.has(spec?.elementProfile)
    ? spec.elementProfile
    : (length > 0 ? 'capsule' : 'spindle');
  const size = numOr(spec?.elementSize, length > 0 ? radius * 0.5 : radius * 0.16);
  const twist = numOr(spec?.elementTwist, 0);
  return discPack({
    center, normalU, count, radius, dome, length, profile, size, twist,
    style: p.leafStyle, cs: p.discCS, samples: p.discSamples,
  });
}

/**
 * Golden-spiral packing of `count` small taiji elements. Flat/domed disc by
 * default (sunflower head, seed-head); a prolate ovoid when `length > 0`
 * (pinecone). The shared core behind both the `disc` form and the flower's
 * head. Deterministic — the golden angle is the only "randomness."
 */
function discPack({ center, normalU, count, radius, dome = 0, length = 0, profile = 'spindle', size = 0.2, twist = 0, style, cs, samples }) {
  const [u, w] = perpBasis(normalU);
  const N = Math.max(count, 1);
  const out = [];
  for (let j = 0; j < N; j += 1) {
    const f = (j + 0.5) / N;
    const theta = 2 * Math.PI * GOLDEN * j;
    const radial = add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta)));
    let seat;
    let dir;
    if (length > 0) {
      // Prolate ovoid: axial position from the golden index, radius widest at
      // the equator and tapering to both tips (a pinecone / seed-cone).
      const axial = f * length;
      const rr = radius * Math.sin(Math.PI * f);
      seat = add(add(center, scale(normalU, axial)), scale(radial, rr));
      dir = normalize(add(radial, scale(normalU, 0.6))); // scales angle up-and-out
    } else {
      // Flat or domed disc: r = R·√f packs evenly; a paraboloid bulge for dome.
      const r = radius * Math.sqrt(f);
      const height = dome * (1 - (r / Math.max(radius, 1e-6)) ** 2);
      seat = add(add(center, scale(radial, r)), scale(normalU, height));
      dir = normalU;
    }
    out.push(taiji(seat, add(seat, scale(dir, size)), null, {
      twist, radius: Math.max(size * 0.4, 0.02), profile,
      crossSections: cs, samples, style,
    }));
  }
  return out;
}

/**
 * rosette — upright, gently curling capsule "tongue" leaves from a common
 * base, fanned around the axis (snake-plant / agave). Blunt tips read as
 * fleshy straps rather than pointed blades.
 */
function expandRosette(spec) {
  const p = resolve(spec, {
    leafProfile: 'capsule', count: 8, leafLength: 3.0, leafWidth: 0.28,
    leafTwist: 0.18, stemTwist: 0, taper: 1, arch: 0.12,
  });
  const axisU = normalize(sub(p.tip, p.base));
  const [e1, e2] = perpBasis(axisU);
  const out = [];
  for (let k = 0; k < p.count; k += 1) {
    const theta = (2 * Math.PI * k) / p.count + 2 * Math.PI * p.divergence * 0; // even fan
    const radial = add(scale(e1, Math.cos(theta)), scale(e2, Math.sin(theta)));
    const len = p.leafLength * Math.pow(p.taper, k);
    // Stand upright with a slight outward tilt; arch gives the curl.
    const outward = 0.28;
    const dir = normalize(add(scale(axisU, 1), scale(radial, outward)));
    const yin = add(p.base, scale(radial, p.stemRadius));
    const yang = add(yin, scale(dir, len));
    const center = add(midpoint(yin, yang), scale(radial, p.arch * len));
    out.push(taiji(yin, yang, center, {
      twist: p.leafTwist, radius: p.leafWidth, profile: p.leafProfile,
      crossSections: p.leafCS, samples: p.leafSamples, style: p.leafStyle,
    }));
  }
  return out;
}

/**
 * tulip — a small upright bed plant: a slender green stem, a cup of `petals`
 * (spindles bowed out at the belly and drawn back toward the axis at the tip →
 * a goblet), and a pair of arching strap leaves at the base. `open` widens the
 * cup (0 tight bud … 1 splayed); `petalColor` paints the bloom while the stem
 * and leaves stay green. The small-plant twin of `flower`, but self-contained
 * on its own stem so a `bed` can stand a clump of them up off the ground.
 */
function expandTulip(spec) {
  const p = resolve(spec, { leafProfile: 'spindle', stemRadius: 0.05, leafWidth: 0.16, leafTwist: 0.06 });
  const axisU = normalize(sub(p.tip, p.base));
  const L0 = Math.max(norm(sub(p.tip, p.base)), 1e-6);
  const [u, w] = perpBasis(axisU);
  const petals = clampInt(spec?.petals, 3, 10, 6);
  const leaves = clampInt(spec?.leaves, 0, 4, 2);
  const open = clamp01(numOr(spec?.open, 0.3));
  const bloomLen = numOr(spec?.bloomLength, L0 * 0.32);
  const petalColor = spec?.petalColor || '#d6433a';
  const stemStyle = { partitionStroke: '#3f6e34', yinStroke: '#5b8a44', yangStroke: '#2e5e1b', width: 0.7, strandWidth: 1, ...(spec?.style?.stem || {}) };
  const petalStyle = { partitionStroke: petalColor, yinStroke: petalColor, yangStroke: petalColor, width: 0.6, strandWidth: 0.9, ...(spec?.style?.petal || {}) };
  const out = [];

  // Stem: a thin green capsule from the ground to the bloom base.
  const bloomBase = add(p.base, scale(axisU, Math.max(L0 - bloomLen, L0 * 0.4)));
  out.push(taiji(p.base, bloomBase, null, {
    twist: 0.05, radius: p.stemRadius, profile: 'capsule',
    crossSections: p.stemCS, samples: p.stemSamples, style: stemStyle,
  }));

  // Petal cup: each petal bows OUT at the belly (control point) then draws back
  // toward the axis at the tip — a closed goblet that `open` widens.
  const flare = bloomLen * (0.22 + 0.5 * open);
  for (let k = 0; k < petals; k += 1) {
    const theta = 2 * Math.PI * k / petals;
    const radial = add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta)));
    const yin = add(bloomBase, scale(radial, p.stemRadius + 0.01));
    const tip = add(add(bloomBase, scale(axisU, bloomLen)), scale(radial, flare * 0.35));
    const center = add(add(midpoint(yin, tip), scale(radial, flare)), scale(axisU, bloomLen * 0.1));
    out.push(taiji(yin, tip, center, {
      twist: p.leafTwist, radius: bloomLen * 0.3, profile: 'spindle',
      crossSections: Math.max(p.discCS, 5), samples: Math.max(p.discSamples, 10), style: petalStyle,
    }));
  }

  // Bladelike leaves: a pointed SPINDLE blade that shoots UP from the base then
  // arches over and flops DOWN at the tip. The bezier control sits high near the
  // stem (the blade rises) while the tip lands out and well BELOW it (the flop).
  for (let l = 0; l < leaves; l += 1) {
    const sgn = (l % 2 === 0) ? 1 : -1;
    const radial = normalize(l >= 2 ? scale(w, sgn) : scale(u, sgn));
    const lr = L0 * (0.95 + 0.1 * hash(l + 1, 7));   // slight per-blade length variation
    const yin = add(p.base, scale(radial, p.stemRadius));
    const apex = add(add(p.base, scale(axisU, lr * 0.95)), scale(radial, lr * 0.16));   // high control → rises
    const yang = add(add(p.base, scale(axisU, lr * 0.42)), scale(radial, lr * 0.62));   // tip out + low → flops over
    out.push(taiji(yin, yang, apex, {
      twist: 0.04, radius: p.leafWidth, profile: 'spindle',
      crossSections: p.leafCS, samples: p.leafSamples, style: p.leafStyle,
    }));
  }
  return out;
}

function estimateTulipTaijis(spec) {
  return 1 + clampInt(spec?.petals, 3, 10, 6) + clampInt(spec?.leaves, 0, 4, 2);
}

// Stemmed flower: stem + leaves + petals + disc florets.
function estimateFlowerTaijis(spec) {
  const count = Number.isInteger(spec?.count) ? spec.count : 13;
  const disc = Number.isInteger(spec?.discCount) ? spec.discCount : 0;
  return 1 + clampInt(spec?.leaves, 0, 4, 2) + count + disc;
}

/**
 * palm — a slightly-bowed SINGLE trunk crowned with a whorl of fronds. The
 * trunk is a stack of `trunkSegments` short capsules whose blunt joints read as
 * the ringed leaf-scar SEGMENTS of a palm; `trunkBulge` fattens its lower half
 * (a bottle / spindle palm). Two frond habits via `frondType`:
 *   - 'feather' (default, pinnate coconut): an arching rachis bearing a comb of
 *     spindle pinnae that splay to alternating sides and droop — the sheath.
 *   - 'fan' (palmate): a short petiole then a flat PEACOCK array of blades
 *     radiating in one plane (it reads "2D" edge-on).
 * `fronds`/`pinnae` set crown density, `upFronds`/`lift` how many fronds stand
 * up vs droop, `pinnaLength` the blade/spike length, `coconuts` a bunch of dark
 * ovoids under the crown. Deterministic; a per-frond hash varies the droop.
 */
function expandPalm(spec) {
  const p = resolve(spec, {
    leafProfile: 'spindle', stemRadius: 0.42, leafWidth: 0.34, leafTwist: 0.05,
  });
  const axisU = normalize(sub(p.tip, p.base));
  const L0 = Math.max(norm(sub(p.tip, p.base)), 1e-6);
  const [u, w] = perpBasis(axisU);
  const crown = p.tip;

  const fan = spec?.frondType === 'fan' || spec?.frondType === 'palmate';
  const fronds = clampInt(spec?.fronds, 3, 16, 10);
  const pinnae = clampInt(spec?.pinnae, 0, 24, 12);   // pinnae per feather frond / blades per fan
  const coconuts = clampInt(spec?.coconuts, 0, 16, 6);
  const frondLen = numOr(spec?.frondLength, L0 * 0.5);
  const droop = clamp01(numOr(spec?.droop, 0.55));   // 0 flat fan … 1 strongly weeping
  const rise = numOr(spec?.frondRise, 0.28);          // up-arch before the droop
  const bend = numOr(spec?.bend, 0.12);               // trunk lean curvature (× trunk length)
  const pinnaLen = numOr(spec?.pinnaLength, frondLen * 0.9);    // blade / spike length
  // Crown pitch: not every frond weeps. `upFronds` of them splay UP (standing
  // inner/younger fronds), the rest droop; `lift` is how high the up-fronds reach.
  const lift = numOr(spec?.lift, 0.55);               // upward splay (× reach) for up-fronds
  const upFronds = clampInt(spec?.upFronds, 0, fronds, Math.round(fronds * 0.33));
  const upStride = upFronds > 0 ? Math.max(1, Math.round(fronds / upFronds)) : 0;
  const segments = clampInt(spec?.trunkSegments, 0, 16, 7);     // ringed trunk; 0/1 = smooth
  const bulge = numOr(spec?.trunkBulge, 0);                     // fattens the lower trunk
  const fanSpread = numOr(spec?.fanSpread, 2.1);               // fan arc (radians)

  const trunkStyle = {
    partitionStroke: '#7a5a33', yinStroke: '#9c7a47', yangStroke: '#5e4626',
    width: 0.7, strandWidth: 1, ...(spec?.style?.stem || {}),
  };
  const out = [];

  // Trunk: a gently bowed path (quadratic, control pushed along u by `bend`).
  // `trunkSegments` short capsules approximate it and their blunt joints read as
  // the rings; `trunkBulge` fattens the lower trunk into a bottle/spindle palm.
  const trunkCtl = add(midpoint(p.base, crown), scale(u, bend * L0));
  const trunkAt = (t) => bezier3(p.base, trunkCtl, crown, t);
  const trunkRadiusAt = (t) => Math.max(p.stemRadius * (1 + bulge * Math.max(0, 1 - t * 1.5) ** 2), 0.03);
  if (segments >= 2) {
    for (let s = 0; s < segments; s += 1) {
      const t0 = s / segments;
      const t1 = (s + 1) / segments;
      out.push(taiji(trunkAt(t0), trunkAt(t1), null, {
        twist: 0.04, radius: trunkRadiusAt((t0 + t1) / 2), profile: 'capsule',
        crossSections: p.stemCS, samples: p.stemSamples, style: trunkStyle,
      }));
    }
  } else {
    out.push(taiji(p.base, crown, trunkCtl, {
      twist: 0.12, radius: p.stemRadius, profile: 'capsule',
      crossSections: p.stemCS, samples: p.stemSamples, style: trunkStyle,
    }));
  }

  // Crown: an even azimuthal whorl of fronds.
  const bez = (a, c, b, t) => bezier3(a, c, b, t);
  for (let f = 0; f < fronds; f += 1) {
    if (out.length >= MAX_TAIJIS_PER_PLANT) break;
    const theta = 2 * Math.PI * (f / fronds);
    const radial = add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta)));
    const splayUp = upStride > 0 && (f % upStride === 0);
    const dv = droop * (0.82 + 0.36 * hash(f, 1));   // slight per-frond droop variation
    const lv = lift * (0.7 + 0.5 * hash(f, 4));       // per-frond upward splay
    const reach = frondLen * (0.9 + 0.2 * hash(f, 2));
    // Rachis vertical: up-fronds stand ABOVE the crown (and lean less outward);
    // the rest arch up a touch then droop BELOW it.
    const tipVert = splayUp ? lv * reach : -dv * reach;
    const ctlVert = splayUp ? (lv * 0.7 + 0.15) * reach : rise * reach;
    const rachisTip = add(add(crown, scale(radial, reach * (splayUp ? 0.78 : 1.0))), scale(axisU, tipVert));
    const rachisCtl = add(add(crown, scale(radial, reach * 0.45)), scale(axisU, ctlVert));
    const side = normalize(cross(axisU, radial));   // the frond's width axis

    if (fan) {
      // Fan (palmate): a short petiole, then a flat peacock array of blades that
      // radiate in the plane spanned by the petiole direction and `side`.
      const petioleTip = bez(crown, rachisCtl, rachisTip, 0.4);
      out.push(taiji(crown, petioleTip, null, {
        twist: 0.05, radius: Math.max(p.stemRadius * 0.26, 0.05), profile: 'capsule',
        crossSections: Math.max(p.discCS, 5), samples: Math.max(p.discSamples, 10), style: p.leafStyle,
      }));
      const outward = normalize(sub(petioleTip, crown));
      const blades = Math.max(pinnae, 3);
      const bladeLen = pinnaLen * 0.85;
      for (let k = 0; k < blades; k += 1) {
        if (out.length >= MAX_TAIJIS_PER_PLANT) break;
        const frac = blades > 1 ? k / (blades - 1) : 0.5;
        const ang = (frac - 0.5) * fanSpread;
        const dir = normalize(add(scale(outward, Math.cos(ang)), scale(side, Math.sin(ang))));
        const len = bladeLen * (0.78 + 0.22 * Math.cos(ang));   // a touch shorter at the fan edges
        out.push(taiji(petioleTip, add(petioleTip, scale(dir, len)), null, {
          twist: p.leafTwist, radius: p.leafWidth * 0.6, profile: 'spindle',
          crossSections: p.discCS, samples: p.discSamples, style: p.leafStyle,
        }));
      }
    } else {
      // Feather (pinnate): rachis + a comb of pinnae swept by the rachis tangent.
      out.push(taiji(crown, rachisTip, rachisCtl, {
        twist: 0.05, radius: Math.max(p.stemRadius * 0.26, 0.05), profile: 'capsule',
        crossSections: Math.max(p.discCS, 5), samples: Math.max(p.discSamples, 12), style: p.leafStyle,
      }));
      for (let k = 0; k < pinnae; k += 1) {
        if (out.length >= MAX_TAIJIS_PER_PLANT) break;
        const t = (k + 0.5) / pinnae;
        const P = bez(crown, rachisCtl, rachisTip, t);
        const tan = normalize(sub(bez(crown, rachisCtl, rachisTip, Math.min(t + 0.06, 1)),
          bez(crown, rachisCtl, rachisTip, Math.max(t - 0.06, 0))));
        const sgn = (k % 2 === 0) ? 1 : -1;
        const spread = 0.95 * (1 - 0.35 * t);           // narrower toward the tip
        const dir = normalize(add(add(scale(side, sgn * spread), scale(tan, 0.85)), scale(axisU, -0.18)));
        const len = pinnaLen * (1 - 0.55 * t);
        out.push(taiji(P, add(P, scale(dir, len)), null, {
          twist: p.leafTwist, radius: p.leafWidth * (1 - 0.4 * t), profile: 'spindle',
          crossSections: p.discCS, samples: p.discSamples, style: p.leafStyle,
        }));
      }
    }
  }

  // Coconuts: a small bunch of dark ovoids nestled just under the crown.
  if (coconuts > 0) {
    const nutStyle = { partitionStroke: '#4f3318', yinStroke: '#6e4a28', yangStroke: '#3a2613', width: 0.7, strandWidth: 1 };
    for (let c = 0; c < coconuts; c += 1) {
      if (out.length >= MAX_TAIJIS_PER_PLANT) break;
      const theta = 2 * Math.PI * GOLDEN * c;
      const radial = add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta)));
      const seat = add(add(crown, scale(radial, p.stemRadius * 0.9)), scale(axisU, -0.35 - 0.22 * (c % 3)));
      const dir = normalize(add(scale(radial, 0.5), scale(axisU, -1)));
      out.push(taiji(seat, add(seat, scale(dir, 0.5)), null, {
        twist: 0, radius: 0.24, profile: 'spindle',
        crossSections: Math.max(p.discCS, 5), samples: Math.max(p.discSamples, 10),
        style: nutStyle,
      }));
    }
  }
  return out;
}

/**
 * tree — a recursive branching woody structure. The trunk is a tapering
 * capsule taiji; each fork spawns `branches` children, each a scaled,
 * rotated copy growing off the parent's tip, recursing to `depth`. This is
 * the fractal case the other forms only hint at: self-similar limbs, the
 * length/radius RATIOS are the self-similarity. Optional spindle-leaf
 * foliage clusters at the terminal twigs. Fully deterministic — branching
 * azimuth uses the golden angle (offset per level) so the canopy never
 * looks like a flat, mirror-symmetric fractal.
 */
function expandTree(spec) {
  const p = resolve(spec, {
    stemTwist: 0.5, leafProfile: 'spindle', stemRadius: 0.38,
    leafLength: 0.95, leafWidth: 0.28, leafTwist: 0.08,
  });
  const depth = clampInt(spec?.depth, 1, 7, 4);
  const branches = clampInt(spec?.branches, 1, 5, 2);
  const branchAngle = numOr(spec?.branchAngle, 35) * Math.PI / 180;
  const lengthRatio = numOr(spec?.lengthRatio, 0.72);
  const radiusRatio = numOr(spec?.radiusRatio, 0.62);
  const crook = numOr(spec?.crook, 0.12);          // per-segment bend (gnarl)
  const upBias = numOr(spec?.upBias, 0.12);        // gravitropism toward the trunk axis
  const foliageMode = treeFoliageMode(spec);   // 'leaves' | 'cluster' | 'conifer' | 'none'
  const leafCount = clampInt(spec?.leafCount, 0, 12, 5);
  const clusterSize = numOr(spec?.clusterSize, 0.7);
  const foliageTiers = clampInt(spec?.foliageTiers, 1, 8, 4);
  // Tiered canopy: foliage borne at the deepest `foliageLevels` tiers, not only
  // the terminal twigs — stacks 2+ canopy shells up the tree (a lower skirt +
  // an upper crown). Clamped to depth; 1 = the original single-shell crown.
  const foliageLevels = clampInt(spec?.foliageLevels, 1, Math.max(depth, 1), 1);
  // Fork geometry. 'spiral' (default) scatters each fork's children on the
  // golden angle → a full round 3D crown. 'planar' fans every fork into ONE
  // plane so 2 branches read as a flat codominant "V" and 3 as a candelabra.
  const planarFork = spec?.forkStyle === 'planar';

  const axisU = normalize(sub(p.tip, p.base));
  const L0 = Math.max(norm(sub(p.tip, p.base)), 1e-6);
  const trunkStyle = {
    partitionStroke: '#6b4f2a', yinStroke: '#8a6a3a', yangStroke: '#4f3a1f',
    width: 0.7, strandWidth: 1, ...(spec?.style?.stem || {}),
  };
  const out = [];

  const emitLimb = (b, dir, len, radius) => {
    const tipPt = add(b, scale(dir, len));
    const [u, w] = perpBasis(dir);
    const center = crook > 0 ? add(midpoint(b, tipPt), scale(u, crook * len)) : null;
    out.push(taiji(b, tipPt, center, {
      twist: p.stemTwist, radius: Math.max(radius, 1e-3), profile: 'capsule',
      crossSections: p.stemCS, samples: p.stemSamples, style: trunkStyle,
    }));
    return { tipPt, u, w };
  };
  const emitFoliage = (tipPt, dir, u, w) => {
    if (foliageMode === 'none' || out.length >= MAX_TAIJIS_PER_PLANT) return;
    if (foliageMode === 'cluster') {
      // A leaf-cluster "wig": ONE fat, lightly-swirled spindle blob standing
      // in for a whole tuft of leaves. One taiji per twig instead of
      // `leafCount` — the efficiency lever — and it reads as an impressionist
      // canopy puff rather than individual blades.
      out.push(taiji(tipPt, add(tipPt, scale(dir, clusterSize * 1.5)), null, {
        twist: 1.2, radius: clusterSize, profile: 'spindle',
        crossSections: Math.max(p.discCS, 6), samples: Math.max(p.discSamples, 12),
        style: p.leafStyle,
      }));
      return;
    }
    if (foliageMode === 'conifer') {
      emitConiferMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p });
      return;
    }
    if (foliageMode === 'canopy') {
      emitCanopyMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p });
      return;
    }
    if (foliageMode === 'weeping') {
      emitWeepingMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p });
      return;
    }
    if (leafCount <= 0) return;
    for (let j = 0; j < leafCount; j += 1) {
      if (out.length >= MAX_TAIJIS_PER_PLANT) break;
      const phi = 2 * Math.PI * GOLDEN * j;
      const radial = add(scale(u, Math.cos(phi)), scale(w, Math.sin(phi)));
      const leafDir = normalize(add(scale(dir, Math.cos(0.9)), scale(radial, Math.sin(0.9))));
      // Twig leaves are small adornments and there are many of them — render
      // them at the coarse disc mesh, not the (heavier) main-leaf mesh.
      out.push(taiji(tipPt, add(tipPt, scale(leafDir, p.leafLength)), null, {
        twist: p.leafTwist, radius: p.leafWidth, profile: p.leafProfile,
        crossSections: p.discCS, samples: p.discSamples, style: p.leafStyle,
      }));
    }
  };

  // Dichotomous fork — a broadleaf tree/bush.
  const grow = (b, dir, len, radius, level) => {
    if (out.length >= MAX_TAIJIS_PER_PLANT) return;
    const { tipPt, u, w } = emitLimb(b, dir, len, radius);
    const terminal = level >= depth;
    // Foliage at the terminal tip AND at the deepest `foliageLevels` interior
    // tiers, so a tree can carry stacked canopy shells instead of one crown.
    if (terminal || level > depth - foliageLevels) emitFoliage(tipPt, dir, u, w);
    if (terminal) return;
    for (let i = 0; i < branches; i += 1) {
      let radial;
      let angle = branchAngle;
      if (planarFork) {
        // Fan children across the limb's u-axis plane: parametrise i to −1..+1
        // so 2 branches splay to a symmetric V and a middle child (odd counts)
        // stays a vertical leader (candelabra).
        const t = branches === 1 ? 0 : (i / (branches - 1)) * 2 - 1;
        radial = scale(u, t >= 0 ? 1 : -1);
        angle = branchAngle * Math.abs(t);
      } else {
        const phi = 2 * Math.PI * GOLDEN * (i + level * 0.5);
        radial = add(scale(u, Math.cos(phi)), scale(w, Math.sin(phi)));
      }
      let childDir = add(scale(dir, Math.cos(angle)), scale(radial, Math.sin(angle)));
      childDir = normalize(add(childDir, scale(axisU, upBias)));
      grow(tipPt, childDir, len * lengthRatio, radius * radiusRatio, level + 1);
    }
  };
  grow(p.base, axisU, L0, p.stemRadius, 0);
  return out;
}

// Layered conifer mass: a tapered stack of overlapping spindle/capsule
// silhouettes around a twig axis. This is the local-tree twin of the painted
// landscape's pine mass: cheap, filled matter first, with tiered volume rather
// than many individual needles.
function emitConiferMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p }) {
  const height = clusterSize * (1.65 + 0.18 * foliageTiers);
  const baseCenter = add(tipPt, scale(dir, -height * 0.52));
  out.push(taiji(baseCenter, add(tipPt, scale(dir, clusterSize * 0.16)), null, {
    twist: 0.45,
    radius: clusterSize * 0.45,
    profile: 'spindle',
    crossSections: Math.max(p.discCS, 5),
    samples: Math.max(p.discSamples, 10),
    style: p.leafStyle,
  }));
  for (let k = 0; k < foliageTiers; k += 1) {
    if (out.length >= MAX_TAIJIS_PER_PLANT) break;
    const t = foliageTiers <= 1 ? 0.5 : k / (foliageTiers - 1);
    const center = add(tipPt, scale(dir, -height * (0.12 + 0.72 * t)));
    const theta = 2 * Math.PI * GOLDEN * k;
    const lateral = normalize(add(scale(u, Math.cos(theta)), scale(w, Math.sin(theta))));
    const width = clusterSize * (1.22 - 0.62 * t);
    const yin = add(center, scale(lateral, -width));
    const yang = add(center, scale(lateral, width));
    const archCenter = add(center, scale(dir, clusterSize * (0.12 + 0.08 * (1 - t))));
    out.push(taiji(yin, yang, archCenter, {
      twist: 0.18 + 0.08 * k,
      radius: Math.max(clusterSize * (0.34 - 0.08 * t), 0.05),
      profile: k === foliageTiers - 1 ? 'spindle' : 'capsule',
      crossSections: Math.max(p.discCS, 5),
      samples: Math.max(p.discSamples, 10),
      style: p.leafStyle,
    }));
  }
}

// Broad, overhanging SHADE dome (oak/maple/elm habit): a squat central crown
// cap plus a ring of lobes that splay radially OUTWARD and droop at the rim, so
// the canopy spills well past the twig footprint instead of perching on top of
// it like the `cluster` hat. Each lobe is an arched spindle whose belly bulges
// up-and-out while its tip dips below its base — the overhang that reads as a
// mature broadleaf crown.
function emitCanopyMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p }) {
  const lobes = Math.max(4, foliageTiers);
  // central crown cap — a wide, squat blob sitting low over the tip
  out.push(taiji(
    add(tipPt, scale(dir, -clusterSize * 0.25)),
    add(tipPt, scale(dir, clusterSize * 0.75)),
    null,
    {
      twist: 0.9, radius: clusterSize * 0.9, profile: 'spindle',
      crossSections: Math.max(p.discCS, 6), samples: Math.max(p.discSamples, 12), style: p.leafStyle,
    },
  ));
  for (let k = 0; k < lobes; k += 1) {
    if (out.length >= MAX_TAIJIS_PER_PLANT) break;
    const phi = 2 * Math.PI * GOLDEN * k;
    const radial = normalize(add(scale(u, Math.cos(phi)), scale(w, Math.sin(phi))));
    // lobe axis: out and slightly DOWN → the overhang. Start a touch out from
    // the crown centre so lobes ring the rim.
    const start = add(tipPt, scale(radial, clusterSize * 0.45));
    const axis = normalize(add(scale(radial, 1.0), scale(dir, -0.4)));
    const end = add(start, scale(axis, clusterSize * 1.25));
    // arch the belly up+out so the lobe bulges before dipping (a domed rim)
    const archCenter = add(midpoint(start, end), scale(dir, clusterSize * 0.28));
    out.push(taiji(start, end, archCenter, {
      twist: 0.6, radius: clusterSize * 0.6, profile: 'spindle',
      crossSections: Math.max(p.discCS, 6), samples: Math.max(p.discSamples, 12), style: p.leafStyle,
    }));
  }
}

// WEEPING habit (willow/pendant): a small crown cap plus long, thin strands
// that hang DOWN-and-out from the twig and arch as they fall, so the foliage
// mass pours below the branch rather than sitting on it. The strands' outward
// arch + downward reach is the spillover — a curtain, not a cap.
function emitWeepingMass({ out, tipPt, dir, u, w, clusterSize, foliageTiers, p }) {
  const strands = Math.max(4, foliageTiers);
  // small crown cap so the top of the twig still reads as leafed
  out.push(taiji(
    add(tipPt, scale(dir, -clusterSize * 0.15)),
    add(tipPt, scale(dir, clusterSize * 0.5)),
    null,
    {
      twist: 0.8, radius: clusterSize * 0.55, profile: 'spindle',
      crossSections: Math.max(p.discCS, 6), samples: Math.max(p.discSamples, 12), style: p.leafStyle,
    },
  ));
  for (let k = 0; k < strands; k += 1) {
    if (out.length >= MAX_TAIJIS_PER_PLANT) break;
    const phi = 2 * Math.PI * GOLDEN * k;
    const radial = normalize(add(scale(u, Math.cos(phi)), scale(w, Math.sin(phi))));
    const start = add(tipPt, scale(radial, clusterSize * 0.3));
    // fall direction: mostly DOWN (−dir) with a slight outward flare
    const fall = normalize(add(scale(dir, -1.0), scale(radial, 0.45)));
    const end = add(start, scale(fall, clusterSize * 2.1));
    // arch the strand outward at its belly → a hanging bow, not a straight stick
    const archCenter = add(midpoint(start, end), scale(radial, clusterSize * 0.5));
    out.push(taiji(start, end, archCenter, {
      twist: 0.25, radius: clusterSize * 0.22, profile: 'spindle',
      crossSections: Math.max(p.discCS, 6), samples: Math.max(p.discSamples, 12), style: p.leafStyle,
    }));
  }
}

/**
 * grove — a landscape repeater: scatter `count` trees across a region with
 * NATURAL, deterministic per-tree variation (size, height, depth, lean,
 * branch angle, twist, cluster size, and green shade). Trees sit on an
 * optional sinusoidal ground (`groundAmplitude`) so they follow terrain.
 * Reuses `expandTree` per tree (so wigs / paint all carry through),
 * and is bounded so a forest stays browser-renderable. Fully deterministic —
 * variation comes from an index hash, not a seed.
 *
 * Compose with a manifest `waveFields` floor for the actual ground surface;
 * the grove just places the trees on the matching height.
 */
function expandGrove(spec) {
  const base = isFiniteVec(spec?.base) ? spec.base : v(0, 0, 0);
  const region = (spec?.region && typeof spec.region === 'object') ? spec.region : {};
  const W = Math.max(numOr(region.width, 14), 0.1);
  const D = Math.max(numOr(region.depth, region.length ?? 14), 0.1);
  const count = clampInt(spec?.count, 1, 60, 9);
  const variation = clamp01(numOr(spec?.variation, 0.35));
  const sizeRange = Array.isArray(spec?.sizeRange) && spec.sizeRange.length === 2
    ? spec.sizeRange : [0.75, 1.3];
  const sMin = numOr(sizeRange[0], 0.75);
  const sMax = numOr(sizeRange[1], 1.3);
  const groundAmp = numOr(spec?.groundAmplitude, 0);
  const tmpl = groveTreeTemplate(spec);
  const baseHeight = numOr(tmpl.height, 5);

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (out.length >= GROVE_MAX_TAIJIS) break;
    const col = i % cols;
    const row = Math.floor(i / cols);
    // Even grid coverage + deterministic per-cell jitter = a natural scatter.
    const gx = ((col + 0.5) / cols - 0.5) * W;
    const gy = ((row + 0.5) / rows - 0.5) * D;
    const jx = (hash(i, 1) - 0.5) * (W / cols) * 0.8 * variation;
    const jy = (hash(i, 2) - 0.5) * (D / rows) * 0.8 * variation;
    const px = base.x + gx + jx;
    const py = base.y + gy + jy;
    const gz = base.z + groundAmp * Math.sin(px * 0.35) * Math.cos(py * 0.3);

    const size = sMin + (sMax - sMin) * hash(i, 3);
    const h = baseHeight * size;
    // Centered jitter scaled by `variation`: at variation 0 every delta is 0
    // (true clones); higher = a real structural mix. Each param gets its own
    // salt so they vary independently.
    const vj = (salt, amt) => (hash(i, salt) - 0.5) * 2 * variation * amt;
    const lean = vj(4, 0.25);
    const leanY = vj(5, 0.25);
    const green = FOLIAGE_GREENS[i % FOLIAGE_GREENS.length];
    const tDepth = Number.isInteger(tmpl.depth) ? tmpl.depth : 3;
    const tBranches = Number.isInteger(tmpl.branches) ? tmpl.branches : 2;

    const treeSpec = {
      ...tmpl,
      base: { x: px, y: py, z: gz },
      tip: { x: px + lean, y: py + leanY, z: gz + h },
      // Structure: branch topology + depth (the biggest differentiators).
      depth: clampInt(tDepth + Math.round(vj(6, 1.4)), 1, 6, tDepth),
      branches: clampInt(tBranches + Math.round(vj(10, 1.3)), 1, 5, tBranches),
      // Thickness: overall trunk girth (× size) AND taper stockiness.
      stemRadius: numOr(tmpl.stemRadius, 0.34) * size * (1 + vj(12, 0.45)),
      radiusRatio: Math.max(0.3, Math.min(0.95, numOr(tmpl.radiusRatio, 0.62) * (1 + vj(11, 0.32)))),
      branchAngle: numOr(tmpl.branchAngle, 35) + vj(7, 11),
      stemTwist: numOr(tmpl.stemTwist, 0.5) + vj(8, 0.6),
      // Foliage cover: cluster mass (wig size) AND leaf count (leaves mode).
      clusterSize: Math.max(0.1, numOr(tmpl.clusterSize, 0.7) * (1 + vj(9, 0.5))),
      leafCount: clampInt(numOr(tmpl.leafCount, 5) + Math.round(vj(13, 2.5)), 1, 12, 5),
      detail: spec?.detail, // inherit the grove's mesh level
      style: { ...(tmpl.style || {}), leaf: { ...green, ...((tmpl.style || {}).leaf || {}) } },
    };
    out.push(...expandTree(treeSpec));
  }
  return out;
}

// Merge the grove's `tree` template over the grove defaults.
function groveTreeTemplate(spec) {
  const t = (spec?.tree && typeof spec.tree === 'object' && !Array.isArray(spec.tree)) ? spec.tree : {};
  return { ...GROVE_TREE_DEFAULTS, ...t };
}

/**
 * bed — a CLUSTER of small plants scattered over a region: the small-plant twin
 * of `grove`. Repeats a `plant` template (default a tulip; also flower, shoot,
 * rosette, or a low bushy `tree` for shrubbery) on a jittered grid with natural
 * per-plant size/lean variation. Bloom forms (tulip/flower) cycle a
 * `bloomPalette` so a clump reads as mixed cultivars; pass `bloomPalette:null`
 * for a single colour. Trees-as-shrubs keep their own greens. Deterministic.
 */
function expandBed(spec) {
  const base = isFiniteVec(spec?.base) ? spec.base : v(0, 0, 0);
  const region = (spec?.region && typeof spec.region === 'object') ? spec.region : {};
  const W = Math.max(numOr(region.width, 6), 0.1);
  const D = Math.max(numOr(region.depth, region.length ?? 6), 0.1);
  const count = clampInt(spec?.count, 1, 80, 18);
  const variation = clamp01(numOr(spec?.variation, 0.4));
  const sizeRange = Array.isArray(spec?.sizeRange) && spec.sizeRange.length === 2 ? spec.sizeRange : [0.8, 1.2];
  const sMin = numOr(sizeRange[0], 0.8);
  const sMax = numOr(sizeRange[1], 1.2);
  const groundAmp = numOr(spec?.groundAmplitude, 0);
  const tmpl = bedPlantTemplate(spec);
  const baseHeight = numOr(tmpl.height, 1.4);
  const wantsBloom = tmpl.form === 'tulip' || tmpl.form === 'flower';
  const palette = spec?.bloomPalette === null ? null
    : (Array.isArray(spec?.bloomPalette) && spec.bloomPalette.length ? spec.bloomPalette : BLOOM_PALETTE);

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const out = [];
  for (let i = 0; i < count; i += 1) {
    if (out.length >= BED_MAX_TAIJIS) break;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const gx = ((col + 0.5) / cols - 0.5) * W;
    const gy = ((row + 0.5) / rows - 0.5) * D;
    const jx = (hash(i, 1) - 0.5) * (W / cols) * 0.9 * variation;
    const jy = (hash(i, 2) - 0.5) * (D / rows) * 0.9 * variation;
    const px = base.x + gx + jx;
    const py = base.y + gy + jy;
    const gz = base.z + groundAmp * Math.sin(px * 0.5) * Math.cos(py * 0.5);
    const size = sMin + (sMax - sMin) * hash(i, 3);
    const h = baseHeight * size;
    const vj = (salt, amt) => (hash(i, salt) - 0.5) * 2 * variation * amt;
    const lean = vj(4, 0.12);
    const leanY = vj(5, 0.12);
    const inst = {
      ...tmpl,
      base: { x: px, y: py, z: gz },
      tip: { x: px + lean, y: py + leanY, z: gz + h },
      detail: spec?.detail,
    };
    // Guard against a recursive bed/grove template (would fan out unbounded).
    if (inst.form === 'bed' || inst.form === 'grove') inst.form = 'tulip';
    if (wantsBloom && palette && tmpl.petalColor === undefined) inst.petalColor = palette[i % palette.length];
    out.push(...expandPlant(inst));
  }
  return out;
}

// Merge a bed's `plant` template over the bed defaults.
function bedPlantTemplate(spec) {
  const t = (spec?.plant && typeof spec.plant === 'object' && !Array.isArray(spec.plant)) ? spec.plant : {};
  return { ...BED_PLANT_DEFAULTS, ...t };
}

// Predicted taiji count for a bed: instances × per-plant-template estimate.
function estimateBedTaijis(spec) {
  const count = clampInt(spec?.count, 1, 80, 18);
  const tmpl = bedPlantTemplate(spec);
  const per = tmpl.form === 'tree' ? estimateTreeTaijis(tmpl)
    : (tmpl.form === 'palm' ? estimatePalmTaijis(tmpl)
      : (tmpl.form === 'flower' ? estimateFlowerTaijis(tmpl) : estimateTulipTaijis(tmpl)));
  return count * Math.max(per, 1);
}

// Deterministic, seedless hash → [0,1). Reproducible per (index, salt).
function hash(i, salt) {
  const x = Math.sin((i + 1) * (12.9898 + salt * 7.137)) * 43758.5453;
  return x - Math.floor(x);
}
function clamp01(n) { return Math.max(0, Math.min(1, n)); }

// ─── spec resolution + taiji emission ───────────────────────────────────

const STEM_STYLE_DEFAULT = { partitionStroke: '#4a7c3a', yinStroke: '#6aa84f', yangStroke: '#386a25', width: 0.7, strandWidth: 1 };
const LEAF_STYLE_DEFAULT = { partitionStroke: '#4a7c3a', yinStroke: '#7cb342', yangStroke: '#33691e', width: 0.6, strandWidth: 0.9 };

function resolve(spec, formDefaults = {}) {
  const s = spec && typeof spec === 'object' ? spec : {};
  const d = { ...DEFAULTS, ...formDefaults };
  const num = (key) => (Number.isFinite(Number(s[key])) ? Number(s[key]) : d[key]);
  const style = s.style && typeof s.style === 'object' ? s.style : {};
  // Mesh density: a `detail` preset, with explicit crossSections / samples
  // overriding it for every emitted taiji.
  const preset = DETAIL_PRESETS[s.detail] || DETAIL_PRESETS.medium;
  const ovCS = Number.isInteger(s.crossSections) ? s.crossSections : null;
  const ovSamples = Number.isInteger(s.samples) ? s.samples : null;
  return {
    base: isFiniteVec(s.base) ? s.base : (isFiniteVec(s.center) ? s.center : v(0, 0, 0)),
    tip: isFiniteVec(s.tip) ? s.tip : v(0, 0, 6),
    count: Number.isInteger(s.count) && s.count >= 0 ? s.count : d.count,
    divergence: num('divergence'),
    leafProfile: PROFILES.has(s.leafProfile) ? s.leafProfile : d.leafProfile,
    leafTwist: num('leafTwist'),
    leafLength: num('leafLength'),
    leafWidth: num('leafWidth'),
    stemRadius: num('stemRadius'),
    stemTwist: num('stemTwist'),
    taper: num('taper'),
    arch: num('arch'),
    leafCS: ovCS ?? preset.leaf.cs,
    leafSamples: ovSamples ?? preset.leaf.samples,
    stemCS: ovCS ?? preset.stem.cs,
    stemSamples: ovSamples ?? preset.stem.samples,
    discCS: ovCS ?? preset.disc.cs,
    discSamples: ovSamples ?? preset.disc.samples,
    stemStyle: { ...STEM_STYLE_DEFAULT, ...(style.stem || {}) },
    leafStyle: { ...LEAF_STYLE_DEFAULT, ...(style.leaf || {}) },
  };
}

/** Build one taiji spec with rounded inline {x,y,z} poles. */
function taiji(yin, yang, center, opts = {}) {
  const out = {
    yin: rv(yin),
    yang: rv(yang),
    twist: round(opts.twist ?? 0.5),
    radius: round(Math.max(opts.radius ?? 1, 1e-4)),
    profile: PROFILES.has(opts.profile) ? opts.profile : 'spindle',
  };
  if (center) out.center = rv(center);
  if (Number.isInteger(opts.crossSections)) out.crossSections = opts.crossSections;
  if (Number.isInteger(opts.samples)) out.samples = opts.samples;
  if (opts.style) out.style = opts.style;
  if (opts.matter) out.matter = opts.matter;
  return out;
}

// ─── vector helpers (mirror taiji.js) ───────────────────────────────────

function v(x, y, z) { return { x, y, z }; }
function add(a, b) { return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }; }
function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }; }
function scale(a, s) { return { x: a.x * s, y: a.y * s, z: a.z * s }; }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function norm(a) { return Math.hypot(a.x, a.y, a.z); }
function normalize(a) {
  const l = norm(a);
  if (l < 1e-12) return v(0, 0, 1);
  return v(a.x / l, a.y / l, a.z / l);
}
function midpoint(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 }; }

// Two unit vectors spanning the plane ⊥ to `n` (same construction as
// taiji.js::perpendicularBasis, so plant axes and taiji axes agree).
function perpBasis(n) {
  const ref = Math.abs(n.x) < 0.9 ? v(1, 0, 0) : v(0, 1, 0);
  const u = normalize(cross(n, ref));
  const w = normalize(cross(n, u));
  return [u, w];
}

function bezier3(p0, p1, p2, t) {
  const mt = 1 - t;
  const a = mt * mt;
  const b = 2 * mt * t;
  const c = t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x,
    y: a * p0.y + b * p1.y + c * p2.y,
    z: a * p0.z + b * p1.z + c * p2.z,
  };
}

function isFiniteVec(p) {
  return p && typeof p === 'object' && !Array.isArray(p)
    && Number.isFinite(Number(p.x)) && Number.isFinite(Number(p.y)) && Number.isFinite(Number(p.z));
}
function sameVec(a, b) {
  return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9 && Math.abs(a.z - b.z) < 1e-9;
}
function round(n) { return Math.round(Number(n) * 10000) / 10000; }
function rv(p) { return { x: round(p.x), y: round(p.y), z: round(p.z) }; }
function numOr(v, d) { return Number.isFinite(Number(v)) ? Number(v) : d; }
function clampInt(v, min, max, d) {
  const n = Number(v);
  if (!Number.isInteger(n)) return d;
  return Math.max(min, Math.min(max, n));
}

// Predicted taiji count for a tree spec (geometric branch series + terminal
// foliage), used by validatePlants to reject specs that would blow past the
// per-plant cap before any recursion runs.
// Tree foliage mode: individual leaves (default), one cheap cluster "wig" per
// twig, layered conifer mass, an overhanging broadleaf `canopy` dome, a
// `weeping` willow curtain, or none (a bare winter tree). `canopy`/`weeping`
// differ from `cluster` by spilling mass OUT and DOWN past the twig instead of
// perching a single blob on top.
function treeFoliageMode(spec) {
  if (spec?.foliage === false) return 'none';
  if (spec?.foliage === 'cluster' || spec?.foliage === 'wig') return 'cluster';
  if (spec?.foliage === 'conifer' || spec?.foliage === 'pine' || spec?.foliage === 'fir') return 'conifer';
  if (spec?.foliage === 'canopy' || spec?.foliage === 'umbrella' || spec?.foliage === 'dome'
    || spec?.foliage === 'spread' || spec?.foliage === 'shade') return 'canopy';
  if (spec?.foliage === 'weeping' || spec?.foliage === 'willow'
    || spec?.foliage === 'pendant' || spec?.foliage === 'droop') return 'weeping';
  return 'leaves';
}

function estimateTreeTaijis(spec) {
  const b = clampInt(spec?.branches, 1, 5, 2);
  const d = clampInt(spec?.depth, 1, 7, 4);
  const mode = treeFoliageMode(spec);
  // Foliage taijis per terminal twig: 0 / 1 (cluster wig) / conifer tiers
  // plus a central cap / leafCount leaves.
  const tiers = clampInt(spec?.foliageTiers, 1, 8, 4);
  const lc = mode === 'none' ? 0
    : (mode === 'cluster' ? 1
      : (mode === 'conifer' ? tiers + 1
        // canopy/weeping emit a central cap + a ring of max(4, tiers) lobes/strands
        : ((mode === 'canopy' || mode === 'weeping') ? Math.max(4, tiers) + 1
          : clampInt(spec?.leafCount, 0, 12, 5))));
  const segments = b <= 1 ? d + 1 : (Math.pow(b, d + 1) - 1) / (b - 1);
  // Foliage-bearing nodes: the terminal tier plus the deepest foliageLevels−1
  // interior tiers (each tier k below the top has b^(d−k) nodes).
  const fl = clampInt(spec?.foliageLevels, 1, Math.max(d, 1), 1);
  let foliageNodes = 0;
  for (let k = 0; k < fl; k += 1) foliageNodes += Math.pow(b, Math.max(d - k, 0));
  return Math.round(segments + foliageNodes * lc);
}

// Predicted taiji count for a palm: trunk segments + fronds×(rachis/petiole +
// pinnae/blades) + coconuts.
function estimatePalmTaijis(spec) {
  const fronds = clampInt(spec?.fronds, 3, 16, 10);
  const pinnae = clampInt(spec?.pinnae, 0, 24, 12);
  const coconuts = clampInt(spec?.coconuts, 0, 16, 6);
  const segments = clampInt(spec?.trunkSegments, 0, 16, 7);
  const trunk = segments >= 2 ? segments : 1;
  return trunk + fronds * (1 + pinnae) + coconuts;
}

// Predicted taiji count for a grove: trees × per-tree-template estimate,
// inflated by `variation` since branch/depth jitter can push some trees above
// the template (a deliberate over-estimate so the cap stays conservative).
function estimateGroveTaijis(spec) {
  const count = clampInt(spec?.count, 1, 60, 9);
  const variation = clamp01(numOr(spec?.variation, 0.35));
  return Math.ceil(count * estimateTreeTaijis(groveTreeTemplate(spec)) * (1 + variation));
}

export { GOLDEN, FORMS, MAX_TAIJIS_PER_PLANT };
