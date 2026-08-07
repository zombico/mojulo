/**
 * terrain-plan — top-down region map → grounded composed terrain.
 *
 * Construct a natural landscape the way the architecture recipe-compiler
 * constructs a building: author a top-down plan of REGIONS blocked out
 * over the world-XY ground, and compile it DOWN to the existing manji-tree
 * IR (fields + waveFields + tree). No new renderer — `renderManjiTreeToSvg`
 * paints the compiled manifest.
 *
 * Each region becomes one `terrain-region` field (window × the biome's own
 * waveform, grounded to z=0 at its radius). Terrain = Σ region fields over
 * baseline 0, so the surface is continuous by construction — no seam
 * fold-ups (see terrain-plan.plan.md for the two invariants). Each region's
 * biome also drives manifestation: forest/meadow scatter trees on the
 * surface; water lays a ripple plane in its basin; rock stays bare.
 *
 * Plan shape:
 *   {
 *     regions: [
 *       { role, center: {x,y}, radius, biome, peak, waveform?, density? },
 *       ...
 *     ],
 *     rivers?: [ { waypoints: [{x,y}, ...], incision? } ],
 *     physics?, camera?, roomBasis?, title?,
 *   }
 *
 * `compileTerrainPlan(plan)` returns a `kind: 'manji-tree'` manifest.
 */

// ─── Biome table ───────────────────────────────────────────────────────
// Each biome binds its OWN waveform (invariant 1), a default peak sign
// (hills up, water down), and how it manifests. Regions may override the
// waveform; the biome supplies the default + the scatter/water behavior.
export const BIOMES = Object.freeze({
  forest: Object.freeze({
    intent: 'conifer hill — gentle rolling waveform, pine scatter',
    waveform: Object.freeze([
      { amplitude: 0.7, cycles: { u: 1.3, v: 1.1 } },
      { amplitude: 0.3, cycles: { u: 2.4, v: 2.0 } },
    ]),
    scatter: 'pine',
    peakSign: 1,
  }),
  meadow: Object.freeze({
    intent: 'open meadow — soft low waveform, sparse shrubs',
    waveform: Object.freeze([{ amplitude: 0.4, cycles: { u: 1.0, v: 0.8 } }]),
    scatter: 'shrub',
    peakSign: 1,
  }),
  rock: Object.freeze({
    intent: 'rocky ridge — jagged high-frequency waveform, bare',
    waveform: Object.freeze([
      { amplitude: 0.9, cycles: { u: 4, v: 3.5 } },
      { amplitude: 0.45, cycles: { u: 7.5, v: 6.5 } },
    ]),
    scatter: null,
    peakSign: 1,
  }),
  water: Object.freeze({
    intent: 'lake basin — gentle dip below baseline, ripple plane',
    waveform: Object.freeze([{ amplitude: 0.12, cycles: { u: 2, v: 2 } }]),
    scatter: null,
    peakSign: -1,
    water: true,
  }),
});

export function biomeIds() { return Object.keys(BIOMES); }

const TERRAIN_CORNERS = Object.freeze([
  Object.freeze({ x: -20, y: -20, z: 0 }),
  Object.freeze({ x: 20, y: -20, z: 0 }),
  Object.freeze({ x: 20, y: 20, z: 0 }),
  Object.freeze({ x: -20, y: 20, z: 0 }),
]);

const DEFAULT_PHYSICS = Object.freeze({
  gravity: Object.freeze({ x: 0, y: 0, z: 1 }),
  gravityStrength: 1,
  defaultSagFactor: 0.12,
});

// ─── Validation (mint-time, not render-time) ───────────────────────────

export function validateTerrainPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push('terrain-plan must be an object');
    return errors;
  }
  if (!Array.isArray(plan.regions) || plan.regions.length === 0) {
    errors.push('regions must be a non-empty array');
  } else {
    const seen = new Set();
    plan.regions.forEach((r, i) => {
      const label = `regions[${i}]`;
      if (!r || typeof r !== 'object') { errors.push(`${label}: must be an object`); return; }
      if (typeof r.role !== 'string' || !r.role) errors.push(`${label}.role: must be a non-empty string`);
      else if (seen.has(r.role)) errors.push(`${label}.role: duplicate role '${r.role}'`);
      else seen.add(r.role);
      if (!r.center || !Number.isFinite(r.center.x) || !Number.isFinite(r.center.y)) {
        errors.push(`${label}.center: must be { x, y } finite numbers`);
      }
      if (!Number.isFinite(r.radius) || r.radius <= 0) errors.push(`${label}.radius: must be a positive number`);
      if (!BIOMES[r.biome]) errors.push(`${label}.biome: must be one of ${biomeIds().join(', ')} (got ${JSON.stringify(r.biome)})`);
      if (r.peak !== undefined && !Number.isFinite(r.peak)) errors.push(`${label}.peak: must be a finite number when provided`);
      if (r.waveform !== undefined && !Array.isArray(r.waveform)) errors.push(`${label}.waveform: must be an array when provided`);
      if (r.density !== undefined && (!Number.isFinite(r.density) || r.density <= 0)) {
        errors.push(`${label}.density: must be a positive number when provided`);
      }
    });
  }
  if (plan.rivers !== undefined && plan.rivers !== null) {
    if (!Array.isArray(plan.rivers)) errors.push('rivers must be an array when provided');
    else plan.rivers.forEach((rv, i) => {
      if (!rv || !Array.isArray(rv.waypoints) || rv.waypoints.length < 2) {
        errors.push(`rivers[${i}].waypoints: must be an array of at least 2 { x, y } points`);
        return;
      }
      rv.waypoints.forEach((w, j) => {
        if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.y)) {
          errors.push(`rivers[${i}].waypoints[${j}]: must be { x, y } finite numbers`);
        }
      });
      for (const key of ['width', 'depth']) {
        if (rv[key] !== undefined && (!Number.isFinite(rv[key]) || rv[key] <= 0)) {
          errors.push(`rivers[${i}].${key}: must be a positive number when provided`);
        }
      }
    });
  }
  return errors;
}

// ─── Scatter nodes ─────────────────────────────────────────────────────
// Lathe billboards ridden onto the surface via anchor.z = { field }.
function scatterNode(kind) {
  if (kind === 'shrub') {
    return {
      spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 0.6 } },
      slots: [{ id: 'top', position: { x: 0, y: 0, z: 0.6 } }, { id: 'base', position: { x: 0, y: 0, z: 0 } }],
      children: [{ slot: 'base', node: {
        kind: 'lathe', axisFrom: 'self/slot/top', axisTo: 'self/slot/base',
        profile: [{ t: 0, radius: 0.04 }, { t: 0.4, radius: 0.35 }, { t: 1, radius: 0.1 }],
        crossSections: 6, samples: 12, style: { stroke: '#4a5d2e', width: 0.28 },
      } }],
    };
  }
  // pine (default)
  return {
    spine: { bar1: { axis: 'Zenith-Nadir', tails: { Zenith: 'closed', Nadir: 'closed' }, lengthScale: 1.2 } },
    slots: [{ id: 'top', position: { x: 0, y: 0, z: 1.2 } }, { id: 'base', position: { x: 0, y: 0, z: 0 } }],
    children: [{ slot: 'base', node: {
      kind: 'lathe', axisFrom: 'self/slot/top', axisTo: 'self/slot/base',
      profile: [{ t: 0, radius: 0.05 }, { t: 0.2, radius: 0.28 }, { t: 0.55, radius: 0.4 }, { t: 0.85, radius: 0.26 }, { t: 1, radius: 0.07 }],
      crossSections: 8, samples: 14, style: { stroke: '#274227', width: 0.3 },
    } }],
  };
}

// Deterministic jittered grid of footprint offsets inside a region's
// radius. `density` is items-per-world-unit-of-radius² scaled; default
// gives a comfortable stand.
function regionOffsets(region) {
  const { center, radius } = region;
  const step = Math.max(radius / Math.max(region.density || 4.2, 1.2), 1.4);
  const offsets = [];
  let row = 0;
  for (let y = center.y - radius; y <= center.y + radius; y += step) {
    const jitter = (row % 2) ? step * 0.4 : 0;
    for (let x = center.x - radius; x <= center.x + radius; x += step) {
      const px = x + jitter;
      // Keep inside 0.85·radius so scatter sits on the body, not the taper edge.
      if (Math.hypot(px - center.x, y - center.y) <= radius * 0.85) {
        offsets.push({ x: px, y, z: 0 });
      }
    }
    row += 1;
  }
  return offsets;
}

// Sample points along a polyline at ~`spacing` world-unit intervals so a
// chain of dips overlaps into a continuous channel.
function densifyPath(waypoints, spacing) {
  const step = Math.max(spacing, 0.5);
  const out = [{ x: waypoints[0].x, y: waypoints[0].y }];
  for (let i = 0; i + 1 < waypoints.length; i += 1) {
    const a = waypoints[i];
    const b = waypoints[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(Math.ceil(len / step), 1);
    for (let s = 1; s <= n; s += 1) {
      const t = s / n;
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return out;
}

// ─── Compiler ──────────────────────────────────────────────────────────

export function compileTerrainPlan(plan) {
  const errors = validateTerrainPlan(plan);
  if (errors.length) {
    throw new Error(`Invalid terrain-plan:\n - ${errors.join('\n - ')}`);
  }

  const fields = {};
  const elevationComponents = [];

  // One terrain-region field per region (invariants 1 + 2 live in the field).
  for (const region of plan.regions) {
    const biome = BIOMES[region.biome];
    const peakMag = Number.isFinite(region.peak) ? Math.abs(region.peak) : 4;
    const fieldId = `region_${region.role}`;
    fields[fieldId] = {
      kind: 'terrain-region',
      center: { x: region.center.x, y: region.center.y, z: 0 },
      radius: region.radius,
      peak: biome.peakSign * peakMag,
      falloff: 'smooth',
      waves: (Array.isArray(region.waveform) ? region.waveform : biome.waveform).map((w) => ({ ...w })),
    };
    elevationComponents.push({ field: fieldId });
  }

  // Rivers — a chain of small negative terrain-region dips along the path.
  // A raw curve-distance term would grow without bound away from the river
  // and lift the whole map off the baseline (violating invariant 2). A dip
  // chain stays grounded — each dip is 0 beyond its radius — so the union
  // carves a continuous channel that returns to baseline at its banks,
  // obeying the same grounding rule as every region.
  (plan.rivers || []).forEach((river, i) => {
    const halfWidth = Number.isFinite(river.width) ? river.width : 2.4;
    const depth = Number.isFinite(river.depth) ? river.depth : 1.6;
    const points = densifyPath(river.waypoints, halfWidth * 0.7);
    points.forEach((p, k) => {
      const fieldId = `river_${i}_${k}`;
      fields[fieldId] = {
        kind: 'terrain-region',
        center: { x: p.x, y: p.y, z: 0 },
        radius: halfWidth,
        peak: -depth,
        falloff: 'smooth',
        waves: [],
      };
      elevationComponents.push({ field: fieldId });
    });
  });

  fields.elevation = { kind: 'sum', components: elevationComponents };

  // Visible terrain reads the composed field; water regions add a ripple
  // plane sitting partway up their basin.
  const waveFields = [{
    corners: TERRAIN_CORNERS.map((c) => ({ ...c })),
    heightField: 'elevation',
    displacement: { x: 0, y: 0, z: 1 },
    samples: { u: 66, v: 66 },
    style: { stroke: '#6b7a52', width: 0.3 },
  }];
  for (const region of plan.regions) {
    if (!BIOMES[region.biome].water) continue;
    const { center, radius } = region;
    const peakMag = Number.isFinite(region.peak) ? Math.abs(region.peak) : 4;
    const waterZ = -peakMag * 0.4; // partway up the basin
    const r = radius * 0.78;
    waveFields.push({
      corners: [
        { x: center.x - r, y: center.y - r, z: waterZ },
        { x: center.x + r, y: center.y - r, z: waterZ },
        { x: center.x + r, y: center.y + r, z: waterZ },
        { x: center.x - r, y: center.y + r, z: waterZ },
      ],
      displacement: { x: 0, y: 0, z: 1 },
      samples: { u: 22, v: 22 },
      waves: [{ amplitude: 0.1, cycles: { u: 5, v: 4 } }, { amplitude: 0.06, cycles: { u: 9, v: 8 } }],
      style: { stroke: '#3a6ea5', width: 0.4 },
    });
  }

  // Biome scatter — forest/meadow regions drop trees riding the surface.
  const scatterChildren = [];
  for (const region of plan.regions) {
    const biome = BIOMES[region.biome];
    if (!biome.scatter) continue;
    scatterChildren.push({
      slot: 'origin',
      node: {
        replicate: { offsets: regionOffsets(region) },
        node: { ...scatterNode(biome.scatter), anchor: { x: 0, y: 0, z: { field: 'elevation' } } },
      },
    });
  }

  const tree = {
    id: 'world',
    spine: { bar1: { axis: 'N-S', tails: { N: 'closed', S: 'closed' }, lengthScale: 0.2 } },
    anchor: { x: 0, y: 0, z: 0 },
    slots: [{ id: 'origin', position: { x: 0, y: 0, z: 0 } }],
    children: scatterChildren,
  };

  return {
    kind: 'manji-tree',
    dimensions: '3d',
    physics: plan.physics || { ...DEFAULT_PHYSICS },
    showSlotMarkers: false,
    fields,
    waveFields,
    tree,
    ...(plan.camera ? { camera: plan.camera } : {}),
    ...(plan.roomBasis ? { roomBasis: plan.roomBasis } : {}),
    ...(plan.title ? { title: plan.title } : {}),
  };
}
