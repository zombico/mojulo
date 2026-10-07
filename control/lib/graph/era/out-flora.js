/**
 * THE FLORA INDEX — the outdoor plants as DOODADS: shapes built for look, read and cost, not botany. The species
 * table (vegetation/species.js) and its growers stay for a world that wants a grown tree; a kit that wants a plant
 * that READS asks this index instead, and should rarely need the growers.
 *
 * Four FORMS make every plant a kit needs, each a few primitives under a few dials:
 *   broccoli   masses on a stick: overlapping round masses on a trunk (lollipop, broccoli, cloud pads, column)
 *   mushroom   a cap on a stalk, revolved from a profile (parasol, bell, funnel, lantern; a tree or a toadstool)
 *   fungi      organic growth on a host or the ground (brackets on a stump, puffball clusters, ruffled frills)
 *   fingers    capsule chains, sausage fingers (saguaro arms, prickly pads, forking coral, a bundle of tubes)
 * A form is built in VALUES only, on parts (mass, wood, flesh, gills, detail), the way a playscape object is: the
 * kit's SKIN says which swatch ramp each part takes (era/style/swatches.js), so one doodad dresses any kit.
 *
 * Leaf DENSITY is depicted, never modelled: how many masses, how much they overlap, and how much of the dark core
 * shows through the gaps (`porosity`). Leaf detail, where a kit wants it, is a texture or a card on the mass.
 *
 * BARK is exposed as dials (barkDials) read off the fracture model's presets (vegetation/bark.js) and drawn as one of
 * a few stylized BARK_PATTERNS; GRASS is chosen from mojulo's own grass primitives (GRASS_PRIMITIVES), not one look.
 * A COMPOSITION is layers of forms with density by ring (JUNGLE_COMPOSITION reads the jungle that way). Pure; seeded.
 */
import { blobTris } from '../vegetation/tree-mesh.js';
import { mulberry32 } from '../vegetation/grow.js';
import { BARKS } from '../vegetation/bark.js';
import { JUNGLE_MGS3 } from './style/jungle-mgs3.js';

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a, b, t) => a + (b - a) * t;
const r3 = (x) => Math.round(x * 1000) / 1000 + 0;
export const subSeed = (seed, key) => { let h = (seed >>> 0) ^ 0x9e3779b9; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0; return (h % 99998) + 1; };

// ── the parts and the skin ─────────────────────────────────────────────────────
/** The parts a doodad is built of, and the swatch role each takes by default (a kit's skin re-points them). */
export const FLORA_PARTS = Object.freeze({
  mass: { role: 'foliage', read: 'the leafy mass: the shape the eye reads first' },
  core: { role: 'foliage', read: 'the dark inside of a mass, showing through its gaps: depicted density' },
  wood: { role: 'bark', read: 'trunk, limb, stalk of a woody thing' },
  flesh: { role: 'soil', read: 'a cap, a pad, a finger, a shelf: the body of a soft thing' },
  gills: { role: 'soil', read: 'the underside of a cap or shelf: always a step darker' },
  detail: { role: 'cloud', read: 'spots, tips, bulbs: the small marks, a step lighter' },
});
export const DEFAULT_SKIN = Object.freeze(Object.fromEntries(Object.entries(FLORA_PARTS).map(([k, v]) => [k, v.role])));
/** Each kit's flora skin: which of its swatch ramps each part takes (era/style/swatches.js land); unnamed parts keep
 *  the default. The same doodad, re-skinned, is another world's plant. */
export const FLORA_SKINS = Object.freeze({
  'isekai-meadow': {},
  'isekai-bamboo': { flesh: 'bark' },
  'isekai-sakura': { flesh: 'rock' },
  'alien-night': { flesh: 'glow', gills: 'bark', detail: 'glow' },
});
export const floraSkin = (kitId) => ({ ...DEFAULT_SKIN, ...(FLORA_SKINS[kitId] ?? {}) });

// ── geometry: icosphere masses, revolved profiles, tubes ───────────────────────
const faceNormal = (c) => unit(cross(sub(c[1], c[0]), sub(c[2], c[0])));
const centroid = (c) => mul(c.reduce((s, p) => add(s, p), [0, 0, 0]), 1 / c.length);

function pushFace(out, corners, part, value, centre = null, bend = 0) {
  let n = faceNormal(corners);
  const m = centroid(corners);
  if (centre && dot(n, sub(m, centre)) < 0) { corners = corners.slice().reverse(); n = mul(n, -1); }
  // the shading normal bends toward the whole crown's (an aggregate normal): a crown lights as one shape, not bubbles
  const shade = bend && centre ? unit(add(mul(n, 1 - bend), mul(unit(sub(m, centre)), bend))) : n;
  out.push({ corners, normal: shade, gn: n, part, value });
}

/** An icosphere mass (detail 0: 20 faces; 1: 80) round `c`, radii [rx, ry, rz]. `crown` bends its shading normals. */
function mass(out, c, radii, part, value, detail, crown = null, bend = 0) {
  for (const t of blobTris(c, radii, null, { detail })) {
    pushFace(out, t.p, part, value, c);
    if (crown && bend) { const f = out[out.length - 1]; f.normal = unit(add(mul(f.gn, 1 - bend), mul(unit(sub(centroid(f.corners), crown)), bend))); }
  }
}

/**
 * A profile [[r, z], …] revolved round the axis at `at`, `sides` round. `wave` [n, amp] ripples the radius n times
 * round (a cactus's ribs, a frill's ruffle); `squash` flattens one horizontal axis (a pad).
 */
function lathe(out, at, profile, sides, part, value, { wave = null, squash = 1, yaw = 0 } = {}) {
  const ring = (r, z, i) => {
    // squash flattens the profile's own y before the yaw turns it, so a pad can face any way
    const t = (2 * Math.PI * i) / sides, w = wave ? 1 + wave[1] * Math.cos(wave[0] * t) : 1, lx = Math.cos(t) * r * w, ly = Math.sin(t) * r * w * squash;
    return [at[0] + lx * Math.cos(yaw) - ly * Math.sin(yaw), at[1] + lx * Math.sin(yaw) + ly * Math.cos(yaw), at[2] + z];
  };
  const mid = [at[0], at[1], at[2] + profile.reduce((s, q) => s + q[1], 0) / profile.length];
  for (let k = 0; k + 1 < profile.length; k++) {
    const [ra, za] = profile[k], [rb, zb] = profile[k + 1];
    for (let i = 0; i < sides; i++) {
      const c = ra < 1e-6 ? [ring(ra, za, 0), ring(rb, zb, i + 1), ring(rb, zb, i)]
        : rb < 1e-6 ? [ring(ra, za, i), ring(ra, za, i + 1), ring(rb, zb, 0)]
        : [ring(ra, za, i), ring(ra, za, i + 1), ring(rb, zb, i + 1), ring(rb, zb, i)];
      pushFace(out, c, part, value, mid);
    }
  }
}

/** A tapering tube along a polyline, `sides` round (a trunk, a limb, a finger). */
function tube(out, pts, radii, sides, part, value) {
  for (let k = 0; k + 1 < pts.length; k++) {
    const a = pts[k], b = pts[k + 1], d = unit(sub(b, a)), up = Math.abs(d[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
    const u = unit(cross(d, up)), v = cross(u, d);
    const ring = (p, r, i) => { const t = (2 * Math.PI * i) / sides; return add(p, add(mul(u, Math.cos(t) * r), mul(v, Math.sin(t) * r))); };
    const axis = mul(add(a, b), 0.5);
    for (let i = 0; i < sides; i++) pushFace(out, [ring(a, radii[k], i), ring(a, radii[k], i + 1), ring(b, radii[k + 1], i + 1), ring(b, radii[k + 1], i)], part, value, axis);
  }
}

// a curve from a to b bowed by `bow` metres sideways along `side`, in n steps
const bowed = (a, b, bow, side, n = 3) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return add(add(a, mul(sub(b, a), t)), mul(side, bow * Math.sin(Math.PI * t))); });

// ── the levels a doodad is built at (the reveal rings) ─────────────────────────
/** By ring: icosphere detail, tube sides, lathe sides, and the face budget a doodad must keep. */
export const FLORA_LEVELS = Object.freeze({
  near: { detail: 1, sides: 7, round: 12, budget: 1400 },
  mid: { detail: 0, sides: 5, round: 8, budget: 420 },
  far: { detail: 0, sides: 3, round: 6, budget: 90, envelope: true },
});

// ── the forms ──────────────────────────────────────────────────────────────────
/**
 * Each form: what it reads as, what it makes, its RAILS (every dial's [lo, hi], a seed rolls inside them), its
 * VARIANTS (named narrowings of the rails), and `build(X, rand, L)` → { faces, elements } where elements lists the
 * shapes the eye reads ({ what, size }) for the dominance law.
 */
export const FLORA_FORMS = Object.freeze({
  broccoli: {
    read: 'masses on a stick: a tree, a bush, a hedge, a topiary',
    makes: ['tree', 'bush', 'canopy clump', 'far wall'],
    rails: { height: [3, 10], crown: [0.5, 0.72], width: [0.45, 0.85], masses: [4, 9], squash: [0.75, 1.15], tiers: [1, 1], lean: [0, 0.12], trunk: [0.03, 0.055], porosity: [0, 0.35] },
    variants: {
      lollipop: { masses: [0, 0], tiers: [1, 1], porosity: [0, 0], width: [0.55, 0.7] },
      broccoli: {},
      pads: { tiers: [3, 4], masses: [2, 4], lean: [0, 0.07], squash: [0.4, 0.55], crown: [0.62, 0.78], width: [0.5, 0.7], porosity: [0.2, 0.4] },
      column: { width: [0.22, 0.3], lean: [0, 0.06], porosity: [0, 0.1], tiers: [3, 4], masses: [3, 4], squash: [1.3, 1.6], crown: [0.8, 0.9] },
    },
    build: buildBroccoli,
  },
  mushroom: {
    read: 'a cap on a stalk: a toadstool, a parasol tree, a lantern, a fern on a trunk',
    makes: ['toadstool', 'parasol tree', 'tree fern', 'lantern'],
    rails: { height: [0.3, 8], cap: [0.32, 0.6], dome: [0.15, 0.85], cone: [0, 0.4], curl: [-0.12, 0.05], stalk: [0.05, 0.12], spots: [0, 0], cluster: [1, 1] },
    variants: {
      parasol: { height: [4, 9], cap: [0.5, 0.75], dome: [0.08, 0.2], cone: [0, 0], curl: [-0.06, 0], stalk: [0.035, 0.05] },
      bell: { dome: [0.75, 1], cone: [0.25, 0.5], curl: [-0.15, -0.08], cap: [0.3, 0.42] },
      funnel: { dome: [-0.7, -0.45], cone: [0.6, 0.9], curl: [0.02, 0.08], cap: [0.35, 0.5], stalk: [0.08, 0.13] },
      toadstool: { height: [0.25, 0.6], spots: [5, 9], cluster: [2, 4], dome: [0.45, 0.7] },
    },
    build: buildMushroom,
  },
  fungi: {
    read: 'organic growth on a host or the ground: brackets, puffballs, frills',
    makes: ['bracket shelves', 'puffball cluster', 'frill', 'boulder of growth'],
    rails: { height: [0.6, 2.4], count: [3, 6], size: [0.6, 0.8], ruffle: [0, 0], host: [0.2, 0.28] },
    variants: {
      bracket: { kind: 'bracket' },
      puffball: { kind: 'puffball', count: [4, 9], height: [0.4, 1.2] },
      frill: { kind: 'frill', ruffle: [0.12, 0.24], count: [1, 3], height: [0.4, 1.6] },
    },
    build: buildFungi,
  },
  fingers: {
    read: 'capsule chains, sausage fingers: cacti, coral, tube sponges',
    makes: ['saguaro', 'prickly pads', 'coral', 'tube bundle'],
    rails: { height: [1.2, 6], radius: [0.07, 0.12], arms: [1, 3], ribs: [0, 0.12], taper: [0.55, 0.85], spread: [0.4, 0.8], depth: [2, 3], bulb: [0, 0] },
    variants: {
      saguaro: { rule: 'saguaro', ribs: [0.06, 0.12], radius: [0.1, 0.14] },
      pads: { rule: 'pads', height: [0.8, 2], arms: [2, 3] },
      coral: { rule: 'coral', height: [0.8, 3], depth: [2, 3], radius: [0.06, 0.1], bulb: [1.2, 1.6] },
      tubes: { rule: 'tubes', arms: [4, 9], height: [0.6, 2.4], radius: [0.08, 0.14], bulb: [1.1, 1.3] },
    },
    build: buildFingers,
  },
});
export const FLORA_FORM_IDS = Object.freeze(Object.keys(FLORA_FORMS));

/** Roll a form's dials: the variant narrows the rails, `over` narrows or pins them further (a kit's or trail's ask). */
export function floraDials(form, variant, seed, over = {}) {
  const F = FLORA_FORMS[form], V = F.variants[variant] ?? {}, rand = mulberry32(subSeed(seed, `flora:${form}:${variant}`));
  const X = { form, variant };
  for (const [k, rail] of Object.entries(F.rails)) {
    let [lo, hi] = V[k] ?? rail;
    if (over[k] != null) [lo, hi] = Array.isArray(over[k]) ? over[k] : [over[k], over[k]];
    X[k] = mix(lo, hi, rand());
  }
  for (const [k, v] of Object.entries(V)) if (!Array.isArray(v)) X[k] = v;
  for (const k of ['masses', 'tiers', 'spots', 'cluster', 'count', 'arms', 'depth']) if (k in X) X[k] = Math.round(X[k]);
  return { X, rand };
}

/** One doodad: the form's dials rolled for `seed`, built at a ring's level. → { dials, faces, elements, level } */
export function designFlora(form, variant, seed, { level = 'mid', over = {} } = {}) {
  const { X, rand } = floraDials(form, variant, seed, over), L = FLORA_LEVELS[level];
  const { faces, elements } = FLORA_FORMS[form].build(X, rand, { ...L, name: level });
  return { dials: X, faces, elements, level };
}

// masses on a stick
function buildBroccoli(X, rand, L) {
  const out = [], elements = [], H = X.height, base = H * (1 - X.crown), Rc = (X.width * H) / 2;
  const yaw = rand() * Math.PI * 2, leanDir = [Math.cos(yaw), Math.sin(yaw), 0];
  const top = add([0, 0, base + Rc * X.squash * 0.8], mul(leanDir, X.lean * H));
  // the trunk: into the crown's middle, bowed by the lean
  tube(out, bowed([0, 0, 0], top, X.lean * H * 0.3, leanDir, 3), [X.trunk * H * 1.25, X.trunk * H, X.trunk * H * 0.8, X.trunk * H * 0.62], L.sides, 'wood', 0.3);
  elements.push({ what: 'trunk', size: X.trunk * H * 2 });
  if (L.envelope) {
    mass(out, top, [Rc, Rc, Rc * X.squash], 'mass', 0.6, 1, top, 0.7);
    elements.push({ what: 'crown', size: Rc * 2 });
    return { faces: out, elements };
  }
  const tiers = X.tiers;
  for (let t = 0; t < tiers; t++) {
    // tiers stack up the crown, smaller as they rise; pads step out round the trunk on alternate sides
    const f = tiers === 1 ? 0 : t / (tiers - 1), Rt = Rc * Math.pow(0.78, t);
    const z = tiers === 1 ? top[2] : mix(base + Rt * X.squash, base + (top[2] - base) * 1.9, f);
    const out2 = X.variant === 'pads' ? mul([Math.cos(yaw + t * 2.4), Math.sin(yaw + t * 2.4), 0], Rc * 0.4 * (1 - f)) : [0, 0, 0];
    const c = add([top[0] * (z / top[2]), top[1] * (z / top[2]), z], out2);
    if (X.variant === 'pads' && t < tiers - 1) tube(out, [[top[0] * (z / top[2]), top[1] * (z / top[2]), z - Rt * X.squash * 0.6], c], [X.trunk * H * 0.55, X.trunk * H * 0.35], L.sides, 'wood', 0.3);
    // the dark core: what shows through the gaps between masses (depicted density)
    if (X.porosity > 0) mass(out, c, [Rt * 0.62, Rt * 0.62, Rt * 0.62 * X.squash], 'core', 0.12, 0, c, 0);
    // the leading mass rides high: one shape dominates, the rest gather round it
    // a sparser crown is smaller masses further apart, so the core shows between them
    const lead = Rt * 0.64 * (1 - 0.5 * X.porosity);
    mass(out, add(c, [0, 0, Rt * 0.3 * X.squash]), [lead, lead, lead * X.squash], 'mass', 0.62, L.detail, c, 0.6);
    elements.push({ what: `crown ${t}`, size: lead * 2 });
    // a stacked crown at mid keeps three masses a tier: the tiers are the read there, not the masses
    const m = tiers > 1 && L.name !== 'near' ? Math.min(3, X.masses) : X.masses;
    for (let i = 0; i < m; i++) {
      if (rand() < X.porosity) continue;
      const a = yaw + (2 * Math.PI * (i + 0.35 * rand())) / m, e = mix(-0.3, 0.4, rand()), d = Rt * mix(0.5, 0.66, rand()) * (1 + 0.4 * X.porosity), r = Rt * mix(0.34, 0.48, rand()) * (1 - 0.6 * X.porosity);
      mass(out, add(c, [Math.cos(a) * Math.cos(e) * d, Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d * X.squash]), [r, r, r * X.squash], 'mass', 0.55, tiers > 1 ? 0 : L.detail, c, 0.6);
      elements.push({ what: 'mass', size: r * 2 });
    }
  }
  return { faces: out, elements };
}

// a cap on a stalk
function buildMushroom(X, rand, L) {
  const out = [], elements = [], n = L.round, cluster = L.name === 'far' ? 1 : X.cluster;
  const one = (at, H, scale) => {
    const R = X.cap * H, capH = R * mix(0.18, 1.05, Math.abs(X.dome)) * Math.sign(X.dome || 1), sr = Math.max(0.012, X.stalk * H);
    const zr = H - Math.max(0, capH) * 0.85 + R * X.curl;
    // the stalk: a little flare at the foot, a little waist below the cap
    lathe(out, at, [[sr * 1.35, 0], [sr, H * 0.3], [sr * 0.9, zr]], n, 'wood', 0.32);
    // the cap from its rim to its crown: an ellipse leaning toward a cone by `cone`, the rim curled by `curl`
    const prof = [];
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, r = R * (1 - t), ell = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t))), z = zr + capH * mix(ell, t, X.cone) + (k === 0 ? R * X.curl : 0);
      prof.push([r, z]);
    }
    lathe(out, at, prof, n, 'flesh', 0.62, { wave: X.ruffle ? [7, X.ruffle] : null });
    // the gills: the underside, a disc from the rim in to the stalk, a step darker
    lathe(out, at, [[sr * 0.9, zr - R * 0.04], [R * 0.98, prof[0][1] - R * 0.02]], n, 'gills', 0.34);
    elements.push({ what: 'cap', size: R * 2 * scale });
    for (let s = 0; s < X.spots; s++) {
      const a = rand() * Math.PI * 2, t = mix(0.15, 0.7, rand()), r = R * (1 - t), z = zr + capH * mix(Math.sqrt(1 - (1 - t) * (1 - t)), t, X.cone);
      const p = add(at, [Math.cos(a) * r, Math.sin(a) * r, z]), sz = R * mix(0.07, 0.12, rand());
      // a spot is a low five-sided button, and only where it can be seen: none in the far ring, none on the small ones mid
      if (L.name === 'far' || (L.name === 'mid' && scale < 1)) continue;
      lathe(out, p, [[sz, -sz * 0.05], [0, sz * 0.3]], 5, 'detail', 0.86);
    }
  };
  one([0, 0, 0], X.height, 1);
  elements.push({ what: 'stalk', size: X.stalk * X.height * 2 });
  // a cluster: smaller ones leaning in round the first
  for (let k = 1; k < cluster; k++) {
    const a = (2 * Math.PI * k) / Math.max(1, cluster - 1) + rand(), s = mix(0.35, 0.7, rand()), d = X.cap * X.height * mix(0.9, 1.4, rand());
    one([Math.cos(a) * d, Math.sin(a) * d, 0], X.height * s, s);
  }
  return { faces: out, elements };
}

// organic growth
function buildFungi(X, rand, L) {
  const out = [], elements = [], n = L.round, count = L.name === 'far' ? Math.min(X.count, 3) : L.name === 'mid' && X.kind === 'puffball' ? Math.min(X.count, 4) : X.count;
  if (X.kind === 'bracket') {
    // a stump, its shelves stacked up one face, each a half disc tilted out, smaller as they rise
    const hr = X.host * X.height, yaw = rand() * Math.PI * 2;
    tube(out, [[0, 0, 0], [0, 0, X.height]], [hr * 1.1, hr], L.sides + 2, 'wood', 0.3);
    lathe(out, [0, 0, X.height], [[hr, 0], [hr * 0.55, 0.02], [0, 0.03]], L.sides + 2, 'wood', 0.42);
    elements.push({ what: 'stump', size: hr * 2 });
    for (let i = 0; i < X.count; i++) {
      const f = i / Math.max(1, X.count - 1), a = yaw + mix(-0.9, 0.9, rand()), s = hr * X.size * mix(1, 0.6, f) * mix(0.9, 1.05, rand());
      const at = [Math.cos(a) * hr * 0.9, Math.sin(a) * hr * 0.9, mix(0.15, 0.85, f) * X.height];
      // half a squashed disc, its flat side on the bark: a lathe over half a turn, pressed thin
      const shelf = [];
      lathe(shelf, [0, 0, 0], [[0, s * 0.4], [s * 0.7, s * 0.3], [s, 0.02 * s], [s * 0.8, -s * 0.1], [0, -s * 0.12]], n, 'flesh', 0.6);
      for (const fc of shelf) {
        const cs = fc.corners.map((p) => (dot(p, [1, 0, 0]) < 0 ? null : p));
        if (cs.some((p) => !p)) continue;
        const rot = (p) => { const c = Math.cos(a), sn = Math.sin(a); return add(at, [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]]); };
        fc.corners = fc.corners.map(rot); fc.gn = faceNormal(fc.corners); fc.normal = fc.gn; if (fc.corners.length && fc.corners.some((p) => p[2] < at[2] - s * 0.02)) fc.part = 'gills', fc.value = 0.36;
        out.push(fc);
      }
      elements.push({ what: 'shelf', size: s * 2 });
    }
    return { faces: out, elements };
  }
  if (X.kind === 'puffball') {
    // a family of round bodies, the first biggest, the rest crowding round it smaller
    for (let i = 0; i < count; i++) {
      const r = X.height * 0.5 * (i === 0 ? 1 : mix(0.3, 0.62, rand())), a = (2 * Math.PI * i) / Math.max(1, count - 1) + rand(), d = i === 0 ? 0 : X.height * mix(0.4, 0.7, rand());
      mass(out, [Math.cos(a) * d, Math.sin(a) * d, r * 0.78], [r, r, r * 0.82], 'flesh', i === 0 ? 0.66 : 0.6, L.name === 'far' ? 0 : 1);
      if (i === 0) mass(out, [0, 0, r * 1.55], [r * 0.2, r * 0.2, r * 0.08], 'detail', 0.86, 0);
      elements.push({ what: 'puffball', size: r * 2 });
    }
    return { faces: out, elements };
  }
  // frill: ruffled cups, a lathe whose rim waves round
  // a family of two never balances: a frill is one, or three and more round the first
  const sides = L.name === 'far' ? L.round : L.round + 6, family = count === 2 ? 3 : count;
  for (let i = 0; i < family; i++) {
    // the others stand evenly round the first, so the family's weight stays over its foot
    const s = X.height * (i === 0 ? 0.5 : mix(0.25, 0.4, rand())), a = (2 * Math.PI * i) / Math.max(1, family - 1) + rand() * 0.6, d = i === 0 ? 0 : X.height * 0.28;
    const at = [Math.cos(a) * d, Math.sin(a) * d, 0];
    lathe(out, at, [[s * 0.12, 0], [s * 0.1, s * 0.5], [s * 0.6, s * 0.9], [s, s * 1.05]], sides, 'flesh', 0.6, { wave: [7, X.ruffle] });
    lathe(out, at, [[s * 0.95, s * 1.02], [s * 0.5, s * 0.82], [s * 0.1, s * 0.55]], sides, 'gills', 0.34, { wave: [7, X.ruffle] });
    elements.push({ what: 'frill', size: s * 2 });
  }
  return { faces: out, elements };
}

// sausage fingers
function buildFingers(X, rand, L) {
  const out = [], elements = [], H = X.height, R = X.radius * Math.max(1, H / 2), far = L.name === 'far', sides = far ? L.sides : Math.max(L.sides, X.ribs ? 8 : 0);
  const finger = (pts, r0, r1, bulb) => {
    const rs = pts.map((_, i) => mix(r0, r1, i / (pts.length - 1)));
    tube(out, pts, rs, sides, 'flesh', 0.58);
    const tip = pts[pts.length - 1], d = unit(sub(tip, pts[pts.length - 2]));
    // a round end (never a cut): a half-mass on the tip, a bulb if asked
    const b = r1 * (bulb || 1);
    if (far) return;
    mass(out, add(tip, mul(d, b * 0.2)), [b, b, b], 'flesh', bulb ? 0.82 : 0.6, 0);
  };
  if (X.rule === 'saguaro') {
    finger([[0, 0, 0], [0, 0, H * 0.5], [0, 0, H]], R, R * 0.92, 0);
    elements.push({ what: 'column', size: R * 2 });
    for (let i = 0; i < X.arms; i++) {
      const a = rand() * Math.PI * 2, z = H * mix(0.32, 0.6, rand()), out_ = R * mix(1.6, 2.4, rand()), up = H * mix(0.2, 0.38, rand()), ar = R * mix(0.6, 0.75, rand());
      const dir = [Math.cos(a), Math.sin(a), 0];
      finger([add([0, 0, z], mul(dir, R * 0.5)), add([0, 0, z + ar * 0.6], mul(dir, out_ * 0.8)), add([0, 0, z + ar * 2.2], mul(dir, out_)), add([0, 0, z + up], mul(dir, out_))], ar, ar * 0.9, 0);
      elements.push({ what: 'arm', size: ar * 2 });
    }
  } else if (X.rule === 'pads') {
    // pads on pads: flattened ovals, each set on its parent's rim at a fan of angles
    const pad = (at, w, depth, tilt, yaw) => {
      const h = w * 1.25, c = add(at, [Math.sin(tilt) * Math.cos(yaw) * h, Math.sin(tilt) * Math.sin(yaw) * h, Math.cos(tilt) * h]);
      lathe(out, c, far ? [[0, -h], [w, 0], [0, h]] : [[0, -h], [w * 0.7, -h * 0.75], [w, 0], [w * 0.7, h * 0.75], [0, h]], L.round, 'flesh', 0.58, { squash: 0.28, yaw });
      elements.push({ what: 'pad', size: w * 2 });
      if (depth <= 0) return;
      const top = add(c, [Math.sin(tilt) * Math.cos(yaw) * h, Math.sin(tilt) * Math.sin(yaw) * h, Math.cos(tilt) * h * 0.9]);
      for (let k = 0; k < (depth === X.depth - 1 && !far ? X.arms : 2) && (k === 0 || rand() < 0.8); k++) pad(top, w * mix(0.6, 0.78, rand()), depth - 1, tilt * 0.4 + (k % 2 ? -1 : 1) * mix(0.45, 0.9, rand()), yaw + mix(-0.6, 0.6, rand()));
    };
    pad([0, 0, 0], H * 0.2, far ? Math.min(1, X.depth - 1) : X.depth - 1, 0, rand() * Math.PI * 2);
  } else if (X.rule === 'coral') {
    // forks: every segment splits in two, spreading, shrinking by `taper`, round tips
    const fork = (at, dir, len, r, depth) => {
      const end = add(at, mul(dir, len));
      if (depth <= 0) { finger([at, add(at, mul(dir, len * 0.5)), end], r, r * X.taper, X.bulb); return; }
      tube(out, [at, end], [r, r * X.taper], sides, 'flesh', 0.58);
      if (L.name === 'near') mass(out, end, [r * X.taper, r * X.taper, r * X.taper], 'flesh', 0.58, 0);
      const side = unit(cross(dir, Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), roll = rand() * Math.PI;
      const sw = add(mul(side, Math.cos(roll)), mul(cross(dir, side), Math.sin(roll)));
      for (const s of [-1, 1]) fork(end, unit(add(add(dir, mul(sw, s * X.spread)), [0, 0, 0.25])), len * mix(0.62, 0.8, rand()), r * X.taper, depth - 1);
    };
    const seg = H / (1 + 0.75 * X.depth + 0.4);
    fork([0, 0, 0], [0, 0, 1], seg, R * 1.6, far ? 1 : X.depth);
    elements.push({ what: 'trunk', size: R * 3.2 });
  } else {
    // tubes: a bundle from one foot, the middle tallest, splaying out
    for (let i = 0; i < (far ? Math.min(3, X.arms) : X.arms); i++) {
      const a = (2 * Math.PI * i) / X.arms + rand() * 0.5, d = i === 0 ? 0 : R * mix(1.6, 2.6, rand()), h = H * (i === 0 ? 1 : mix(0.45, 0.85, rand()));
      const foot = [Math.cos(a) * d, Math.sin(a) * d, 0], lean = mul([Math.cos(a), Math.sin(a), 0], d * X.spread * 0.5);
      finger([foot, add(foot, add([0, 0, h * 0.5], mul(lean, 0.3))), add(foot, add([0, 0, h], lean))], R, R * X.taper, X.bulb);
      elements.push({ what: 'tube', size: R * 2 * (i === 0 ? 1.3 : 1) * (h / H) });
    }
  }
  return { faces: out, elements };
}

// ── the read laws ──────────────────────────────────────────────────────────────
/**
 * A doodad's laws are about how it READS and what it COSTS, never botany:
 *   dominant    one shape leads: the biggest shape the eye reads is at least 1.2× the next (no bubble wrap)
 *   stands      the doodad's weight (its faces' area) sits over its foot: offset ≤ 0.3 of its height
 *   value-split the body (mass, flesh) and what holds it up (wood) differ by ≥ 0.2 in value, so each reads
 *   budget      its faces keep its ring's budget (FLORA_LEVELS)
 */
export const FLORA_LAWS = Object.freeze([
  { id: 'dominant', rule: 'one shape leads: the biggest the eye reads is at least 1.2× the next' },
  { id: 'stands', rule: 'its weight sits over its foot: offset no more than 0.3 of its height' },
  { id: 'value-split', rule: 'the body and what holds it up differ by at least 0.2 in value' },
  { id: 'budget', rule: 'its faces keep the ring\'s budget' },
]);

const area = (c) => { let s = [0, 0, 0]; for (let i = 1; i + 1 < c.length; i++) s = add(s, cross(sub(c[i], c[0]), sub(c[i + 1], c[0]))); return Math.hypot(...s) / 2; };

export function floraMeasures(d) {
  const sizes = d.elements.map((e) => e.size).sort((a, b) => b - a);
  let A = 0, cx = 0, cy = 0, zMax = 0;
  for (const f of d.faces) { const a = area(f.corners), m = centroid(f.corners); A += a; cx += a * m[0]; cy += a * m[1]; for (const p of f.corners) zMax = Math.max(zMax, p[2]); }
  const meanOf = (parts) => { const fs = d.faces.filter((f) => parts.includes(f.part)); return fs.length ? fs.reduce((s, f) => s + f.value, 0) / fs.length : null; };
  const body = meanOf(['mass', 'flesh']), wood = meanOf(['wood']);
  return {
    dominance: sizes.length > 1 ? r3(sizes[0] / sizes[1]) : Infinity,
    offset: r3(A ? Math.hypot(cx / A, cy / A) / (zMax || 1) : 0),
    split: body != null && wood != null ? r3(Math.abs(body - wood)) : null,
    faces: d.faces.length, height: r3(zMax),
  };
}

export function floraLaws(d) {
  const m = floraMeasures(d), L = FLORA_LEVELS[d.level], out = [];
  if (m.dominance < 1.2) out.push({ law: 'dominant', line: `the two biggest shapes are ${m.dominance}× apart; let one lead.` });
  if (m.offset > 0.3) out.push({ law: 'stands', line: `its weight sits ${m.offset} of its height off its foot.` });
  if (m.split != null && m.split < 0.2) out.push({ law: 'value-split', line: `body and wood are ${m.split} apart in value.` });
  if (m.faces > L.budget) out.push({ law: 'budget', line: `${m.faces} faces over the ${d.level} budget of ${L.budget}.` });
  return out;
}

// ── bark as dials ──────────────────────────────────────────────────────────────
/**
 * The stylized bark patterns a doodad's wood wears (a tile drawn in values; the kit's bark ramp colours it). Each is
 * what the fracture model makes when one of its dials dominates.
 */
export const BARK_PATTERNS = Object.freeze({
  smooth: 'no cracks: the bark keeps up with the stretch (beech, silver fir); mottle only',
  ringed: 'horizontal bands of lenticels round a smooth skin (cherry, birch)',
  ridged: 'long interlaced ridges and fissures running up the stem (oak, ash)',
  plated: 'fissures broken across into plates (pine, spruce scales)',
  spiral: 'ridges leaning round the stem with the grain (sweet chestnut)',
  noded: 'a culm\'s rings at even steps (bamboo; a cactus\'s areoles)',
  scaled: 'overlapping leaf-base scales (a palm, a tree fern)',
});

/**
 * A bark preset's dials, read off the fracture model (vegetation/bark.js BARKS): `smooth` how much the skin keeps up
 * (0 cracks, 1 none), `spacing` the crack spacing per thickness, `plates` how much it breaks across, `twist` the grain's
 * lean in degrees, `lenticels` the bands, `contrast` the value step from a plate's face to a fissure's floor; and the
 * stylized pattern it reads as.
 */
export function barkDials(name) {
  const B = BARKS[name];
  if (!B) return null;
  const luma = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  const twist = Math.abs(B.grain(20));
  const d = { smooth: B.delta, spacing: B.k, plates: B.plates, twist: r3(twist), lenticels: B.lenticels, contrast: r3(luma(B.top) - luma(B.floor)) };
  d.pattern = d.smooth >= 0.9 ? (d.lenticels >= 0.5 ? 'ringed' : 'smooth') : d.plates >= 1 ? 'plated' : d.twist >= 8 ? 'spiral' : 'ridged';
  return d;
}
export const BARK_DIALS = Object.freeze(Object.fromEntries(Object.keys(BARKS).map((k) => [k, barkDials(k)])));

// ── grass: mojulo's own primitives, chosen per kit ─────────────────────────────
/** The grass primitives a kit may choose among (the isekai blade cards are one), what each reads as and costs. */
export const GRASS_PRIMITIVES = Object.freeze({
  'blade-cards': { where: 'era/isekai.js field + isekai-tiles.js `blades`', read: 'crossed cards of painted tapered blades, root dark, tips lit: a sea of painted grass', cost: 'two cards a tuft', suits: ['painted', 'cel'] },
  'broad-cards': { where: 'era/leaf-cards.js `card:grass`', read: 'tall broad sharp blades on a card, dark crown, lit tips: jungle gaps', cost: 'two cards a clump', suits: ['filmic', 'dense'] },
  'meadow-cards': { where: 'era/leaf-cards.js `card:meadow`', read: 'fine blades with seed stalks on a card', cost: 'two cards a clump', suits: ['natural', 'pastoral'] },
  tufts: { where: 'vegetation/grass.js GRASSES', read: 'a 3-D tuft of elastica blades and heads: fescue, meadow, tussock, needlegrass, sedge, fountain, pampas, lawn, elephant', cost: 'a ladder L2…LF, 3 to hundreds of triangles', suits: ['natural', 'stylized'] },
  'live-field': { where: 'scene/channels/stage-grass.js', read: 'streamed stylized blades round the walker: gust sheen, parting, sway, petals', cost: 'a draw budget, decimated by distance', suits: ['painted', 'cel'] },
  'terrain-field': { where: 'terrain/grass-kernel.js + scene/channels/terrain-grass.js', read: 'patches and clumps by climate, tussock or sward, thinning under wood', cost: 'tiles streamed, levels by screen size', suits: ['natural'] },
  fur: { where: 'polygonizer/field-splats.js', read: 'oriented splats in shells off a surface: moss, fur, a lawn as a pelt', cost: 'splats per area', suits: ['soft', 'toy'] },
  hats: { where: 'isekai-tiles.js `hat` / `fringe` / `creep`', read: 'grass caps and fringes on stones and lips, creeping edges', cost: 'one card a lip', suits: ['painted', 'cel'] },
  ground: { where: 'landscape/surface-textures.js grassPng', read: 'a flat mat of blade strokes: grass as the ground\'s texture', cost: 'none above the ground', suits: ['far', 'cheap'] },
});

// ── compositions ───────────────────────────────────────────────────────────────
/**
 * A COMPOSITION is layers, each a role filled by doodad species (a form, a variant, rails narrowed), with a density
 * (per square metre or a count) by reveal ring and a height band. Its principles:
 *   every sightline crosses three layers; one layer dominates the frame (the wall, the canopy, the grove);
 *   a layer holds 1–3 species, clumped by species, varied inside its rails, never off its ramp;
 *   density falls by ring, near distinct, mid repeats, far is a silhouette;
 *   the way is the gap: the trail is the one cut.
 */
export const COMPOSITION_ROLES = Object.freeze(['emergent', 'canopy', 'midstorey', 'understory', 'groundcover', 'climbers', 'walls']);

/** The jungle (jungle-mgs3) read as a composition: its card's own numbers, and the doodad form each layer would be. */
export const JUNGLE_COMPOSITION = Object.freeze((() => {
  const J = JUNGLE_MGS3;
  return {
    id: 'jungle-mgs3', rings: J.rings, dominant: 'canopy',
    layers: [
      { role: 'emergent', what: 'buttressed giants framing the way', count: J.giants.count, height: J.giants.heights, as: { form: 'broccoli', variant: 'pads' }, wood: 'grown figs (kept: the wood is the read)' },
      { role: 'canopy', what: 'a roof of crown clumps, holes the light comes through', cover: J.canopy.cover, height: J.canopy.z, as: { form: 'broccoli', variant: 'pads' } },
      { role: 'midstorey', what: 'tree ferns: a trunk under a crown of fronds', count: J.treeferns.count, height: J.treeferns.height, as: { form: 'mushroom', variant: 'parasol' } },
      { role: 'understory', what: 'broadleaf and fern cards, dense near the trail', density: { near: J.understory.near, mid: J.understory.mid, far: 0 }, size: J.understory.size, as: { form: 'broccoli', variant: 'lollipop' } },
      { role: 'groundcover', what: 'litter, tall grass in the light gaps, moss', density: { near: J.litter.near }, grass: 'broad-cards', as: { form: 'fungi', variant: 'puffball' }, keeps: 'cards for litter and grass; the doodad is the mounds and growth on the floor' },
      { role: 'climbers', what: 'vine strips and lianas, hung from the crowns', count: J.vines.count, as: null, keeps: 'cards: a vine strip is a texture, not a shape; a liana is a sagging tube' },
      { role: 'walls', what: 'rows of crown cards fading into the fog', rows: J.walls.rows, height: J.walls.height, as: { form: 'broccoli', variant: 'broccoli', level: 'far' } },
    ],
    // the plan's species, for floraScatter: giants in pairs, tree ferns in loose groups, understory crowding the trail
    plan: [
      { id: 'giant', clusters: 5, perCluster: 2, spread: 7, size: 2.6, density: { near: 1, mid: 1, far: 0.6 } },
      { id: 'treefern', clusters: 9, perCluster: 3, spread: 4, size: 1.1, density: { near: 1, mid: 0.8, far: 0.3 } },
      { id: 'understory', clusters: 30, perCluster: 8, spread: 3.5, size: 0.5, density: { near: 1, mid: 0.4, far: 0 } },
    ],
  };
})());

/**
 * A plan of where a composition's species stand: per species, clusters (clumped, never even), thinning by ring out
 * from a trail along y at x = 0, clear of it. → [{ x, y, species, scale, ring }]
 */
export function floraScatter(species, seed, { w = 40, d = 60, rings = { near: 7, mid: 16 }, clear = 1.6 } = {}) {
  const out = [];
  species.forEach((sp, si) => {
    const rand = mulberry32(subSeed(seed, `scatter:${sp.id}`)), dens = sp.density;
    for (let c = 0; c < sp.clusters; c++) {
      const cx = mix(-w / 2, w / 2, rand()), cy = mix(0, d, rand());
      for (let k = 0; k < sp.perCluster * 3; k++) {
        const r = sp.spread * Math.sqrt(rand()), a = rand() * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const ax = Math.abs(x), ring = ax < rings.near ? 'near' : ax < rings.mid ? 'mid' : 'far';
        if (ax < clear + sp.size || y < 0 || y > d || ax > w / 2 || rand() > dens[ring]) continue;
        if (out.some((p) => Math.hypot(p.x - x, p.y - y) < (p.size + sp.size) * 0.7)) continue;
        out.push({ x: r3(x), y: r3(y), species: sp.id, si, size: sp.size, scale: r3(mix(0.8, 1.2, rand()) * (1 - r / sp.spread * 0.3)), ring });
      }
    }
  });
  return out;
}
