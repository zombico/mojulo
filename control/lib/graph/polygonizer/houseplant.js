/**
 * houseplant — a small POTTED plant sized for indoor ROOM scenes, baked to lit
 * faces at a higher fidelity than the city street-tree path.
 *
 * Same substrate as every other plant: the foliage is the taiji `plant` macro
 * (`plantToFaces`), just at indoor scale (metres — a floor plant ~0.7–1.3 m,
 * a tabletop one ~0.1–0.4 m) and a denser mesh (crossSections/samples well
 * above the city's 2×6). The new piece is the POT — a tapered lathe frustum +
 * rim lip + soil cap, shaded by the same vexar light as the plant so the whole
 * object reads as one lit thing and drops straight into a room `faces` list.
 *
 * `houseplantToFaces(spec, opts)` → [{ corners, fill, doubleSided }]
 *   spec.kind     one of HOUSEPLANT_KINDS (snake-plant, fiddle-leaf, parlor-palm,
 *                 boston-fern, succulent, rubber-plant); unknown → fiddle-leaf.
 *   spec.base     {x,y,z} of the pot's base centre on the floor (default origin).
 *   spec.scale    overall size multiplier (default 1).
 *   spec.potStyle override the pot palette (terracotta | white | charcoal | sage).
 *   opts.light    vexar light shared with the room (default DEFAULT_LIGHT).
 *   opts.crossSections / opts.samples  foliage mesh density (default 10 × 18).
 *   opts.potSides number of lathe facets (default 20).
 *
 * Deterministic — no seeds (matches the plant macro).
 *
 * Dual reference: plant.js / plant-faces.js (the foliage), vexar.js (shadeFace).
 */

import { plantToFaces } from './plant-faces.js';
import { DEFAULT_LIGHT, shadeFace } from './vexar.js';

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

// Pot palettes: body, a slightly darker rim lip, and the soil cap.
const POT_STYLES = {
  terracotta: { body: '#b5673f', rim: '#9c5636', soil: '#3a2a1c' },
  white: { body: '#e8e6e0', rim: '#d4d1c9', soil: '#3a2a1c' },
  charcoal: { body: '#3c3f44', rim: '#2e3034', soil: '#241a12' },
  sage: { body: '#8c9b7a', rim: '#768563', soil: '#2f2418' },
};
const potStyle = (name) => POT_STYLES[name] || POT_STYLES.terracotta;

// A few greens cycled across the foliage for tonal depth (lusher than the city).
// (foliagePalette is an array of hex strings — one tint per green taiji.)
const HOUSE_GREENS = ['#5f9a3e', '#6fae45', '#4a8a3a', '#558a36'];

// ── pot lathe ──────────────────────────────────────────────────────────────

// A tapered pot (frustum) + a rim lip + a soil cap, as lit quad/tri faces. The
// `inside` axis point orients every face outward so back-faces shade correctly.
function potFaces({ cx, cy, z0, rTop, rBot, height, sides, style, light }) {
  const faces = [];
  const axis = [cx, cy, z0 + height * 0.5];
  const ring = (r, z) => Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a), z];
  });
  const quad = (corners, hex) => faces.push({ corners, fill: shadeFace(corners, hex, { light, inside: axis }).fill, doubleSided: true });
  const fan = (rng, center, hex) => {
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      const corners = [center, rng[i], rng[j]];
      faces.push({ corners, fill: shadeFace(corners, hex, { light, inside: axis }).fill, doubleSided: true });
    }
  };

  const bot = ring(rBot, z0);
  const top = ring(rTop, z0 + height);
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    quad([bot[i], bot[j], top[j], top[i]], style.body);     // tapered wall
  }
  fan(bot, [cx, cy, z0], style.body);                       // base cap (so it isn't see-through)

  // Rim lip: a short, slightly-wider band at the top edge.
  const rimR = rTop * 1.07;
  const rimTopZ = z0 + height + height * 0.03;
  const rimBotZ = z0 + height - height * 0.05;
  const rl = ring(rimR, rimBotZ);
  const ru = ring(rimR, rimTopZ);
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    quad([rl[i], rl[j], ru[j], ru[i]], style.rim);
  }

  // Soil cap: a disc recessed just below the rim.
  const soilZ = z0 + height * 0.86;
  fan(ring(rTop * 0.9, soilZ), [cx, cy, soilZ], style.soil);

  return faces;
}

// ── houseplant catalog ───────────────────────────────────────────────────
// Each kind: a pot (style + dims in metres) and `build(base, scale)` → an array
// of plant specs (most return one; ferns return a whorl of fronds). All sizes
// are indoor-scale metres; `scale` multiplies everything.

const HOUSEPLANT_KINDS = {
  // Sansevieria — stiff upright variegated straps from the soil. No stem.
  'snake-plant': {
    pot: { style: 'charcoal', rTop: 0.13, rBot: 0.10, height: 0.24 },
    build: (b, s) => [{
      form: 'rosette', base: b, tip: { x: b.x, y: b.y, z: b.z + 0.05 * s },
      count: 7, leafLength: 0.78 * s, leafWidth: 0.045 * s, leafTwist: 0.06, arch: 0.05, divergence: 0,
    }],
  },
  // Fiddle-leaf fig — a slim woody stem carrying a few big broad leaves.
  'fiddle-leaf': {
    pot: { style: 'white', rTop: 0.18, rBot: 0.14, height: 0.28 },
    build: (b, s) => [{
      form: 'tree', base: b, tip: { x: b.x, y: b.y, z: b.z + 1.05 * s },
      depth: 2, branches: 2, foliage: 'leaves', leafCount: 5, leafLength: 0.3 * s, leafWidth: 0.17 * s,
      stemRadius: 0.05 * s, branchAngle: 30, upBias: 0.4, lengthRatio: 0.66,
    }],
  },
  // Parlor / areca palm — a slim segmented cane that clearly shows, topped by a
  // modest crown of arching feather fronds (so it reads as a palm, not a mound).
  'parlor-palm': {
    pot: { style: 'terracotta', rTop: 0.15, rBot: 0.12, height: 0.25 },
    build: (b, s) => [{
      form: 'palm', base: b, tip: { x: b.x, y: b.y, z: b.z + 0.85 * s },
      fronds: 7, pinnae: 9, frondLength: 0.38 * s, pinnaLength: 0.34 * s, droop: 0.45,
      upFronds: 3, lift: 0.55, trunkSegments: 8, coconuts: 0, stemRadius: 0.03 * s,
    }],
  },
  // Boston fern — a shuttlecock of arching pinnate fronds radiating from the pot.
  'boston-fern': {
    pot: { style: 'terracotta', rTop: 0.17, rBot: 0.14, height: 0.20 },
    build: (b, s) => {
      const N = 9;
      const out = [];
      for (let k = 0; k < N; k += 1) {
        const a = (2 * Math.PI * k) / N;
        const reach = 0.46 * s;
        out.push({
          form: 'frond',
          base: b,
          tip: { x: b.x + Math.cos(a) * reach, y: b.y + Math.sin(a) * reach, z: b.z + 0.34 * s },
          count: 13, arch: 0.7, leafLength: 0.12 * s, leafWidth: 0.022 * s, stemRadius: 0.012 * s,
        });
      }
      return out;
    },
  },
  // Echeveria succulent — a low, tight rosette of fat leaves in a shallow bowl.
  'succulent': {
    pot: { style: 'white', rTop: 0.11, rBot: 0.09, height: 0.085 },
    build: (b, s) => [{
      form: 'rosette', base: b, tip: { x: b.x, y: b.y, z: b.z + 0.03 * s },
      count: 10, leafLength: 0.15 * s, leafWidth: 0.05 * s, leafProfile: 'spindle', arch: 0.22, taper: 0.94, divergence: 0,
    }],
  },
  // Rubber plant — a fuller small indoor tree with a rounded cluster crown.
  'rubber-plant': {
    pot: { style: 'sage', rTop: 0.17, rBot: 0.14, height: 0.27 },
    build: (b, s) => [{
      form: 'tree', base: b, tip: { x: b.x, y: b.y, z: b.z + 0.85 * s },
      depth: 2, branches: 3, foliage: 'cluster', clusterSize: 0.22 * s, foliageLevels: 2,
      stemRadius: 0.045 * s, branchAngle: 34, upBias: 0.4, lengthRatio: 0.62,
    }],
  },
};

export const HOUSEPLANT_NAMES = Object.keys(HOUSEPLANT_KINDS);

/** Build a potted houseplant as a flat list of lit faces. */
export function houseplantToFaces(spec = {}, opts = {}) {
  const kind = HOUSEPLANT_KINDS[spec.kind] ? spec.kind : 'fiddle-leaf';
  const def = HOUSEPLANT_KINDS[kind];
  const base = (spec.base && typeof spec.base === 'object') ? spec.base : { x: 0, y: 0, z: 0 };
  const s = Math.max(num(spec.scale, 1), 0.05);
  const light = opts.light || DEFAULT_LIGHT;
  const style = potStyle(spec.potStyle || def.pot.style);

  const potH = def.pot.height * s;
  const faces = potFaces({
    cx: num(base.x, 0), cy: num(base.y, 0), z0: num(base.z, 0),
    rTop: def.pot.rTop * s, rBot: def.pot.rBot * s, height: potH,
    sides: Math.max(8, Math.trunc(num(opts.potSides, 20))), style, light,
  });

  // Foliage rises from the soil surface.
  const soil = { x: num(base.x, 0), y: num(base.y, 0), z: num(base.z, 0) + potH * 0.86 };
  const plantOpts = {
    light,
    crossSections: num(opts.crossSections, 10),
    samples: num(opts.samples, 18),
    foliagePalette: opts.foliagePalette === null ? null : (opts.foliagePalette || HOUSE_GREENS),
    barkPalette: null,
  };
  for (const plantSpec of def.build(soil, s)) {
    faces.push(...plantToFaces(plantSpec, plantOpts));
  }
  return faces;
}
