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
import { INTEREST, EYE_SPOT_PX, metresPerPixel } from '../playscape/objects/laws.js';

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

// ── the plan: base composition blocks ──────────────────────────────────────────
/**
 * A doodad is first a PLAN of base composition blocks, then a mesh. A block is a mass, a revolved body (a cap, a pad, a
 * shelf, a cup) or a knuckle (a joint a finger bends at; drawn as a round end at a tip), placed by its centre and radii,
 * with a parent it rests on or hangs from:
 *   stack   true when it sits ON its parent (a vertical joint: a tier on a tier, a cap on a stalk, a pad on a pad)
 *   group   a tag shared by the blocks that stand BESIDE each other under one parent (masses round a crown, arms on a
 *           column, a family of puffballs): a horizontal run
 *   fixed   an attachment that rides on its parent and is never mismatched itself (a core, a spot)
 * LINKS join blocks with tubes (a trunk, a stalk, a limb, a finger's length); they follow the blocks wherever the
 * incongruity pass moves them. Ids are stable across levels, so a block mismatches the same way near and mid.
 */
function plan() {
  const blocks = [], links = [], byId = new Map();
  const block = (b) => { const B = { stack: false, group: null, fixed: false, parent: null, value: 0.6, ...b, c: b.c.slice(), r: b.r.slice() }; blocks.push(B); byId.set(B.id, B); return B; };
  const link = (l) => { if (l) links.push({ n: 1, bow: 0, side: [1, 0, 0], ...l }); };
  return { blocks, links, byId, block, link };
}

/** One doodad: the form's dials rolled for `seed`, planned, mismatched, built at a ring's level. */
export function designFlora(form, variant, seed, { level = 'mid', over = {}, incongruity = null, interest = 'prop' } = {}) {
  const { X, rand } = floraDials(form, variant, seed, over), L = { ...FLORA_LEVELS[level], name: level };
  const P = plan();
  FLORA_FORMS[form].build(X, rand, L, P);
  const inc = incongruity ? incongrue(P, incongruity, seed, interest) : null;
  const { faces, elements } = meshPlan(P, L);
  return { dials: X, faces, elements, level, incongruity: inc, unstable: planStability(P), plan: { blocks: P.blocks.length, links: P.links.length } };
}

// masses on a stick
function buildBroccoli(X, rand, L, P) {
  const H = X.height, base = H * (1 - X.crown), Rc = (X.width * H) / 2, tr = X.trunk * H;
  const yaw = rand() * Math.PI * 2, leanDir = [Math.cos(yaw), Math.sin(yaw), 0];
  const top = add([0, 0, base + Rc * X.squash * 0.8], mul(leanDir, X.lean * H));
  P.block({ id: 'foot', kind: 'knuckle', c: [0, 0, 0], r: [tr * 1.25, tr * 1.25, tr * 1.25] });
  if (L.envelope) {
    P.block({ id: 't0', kind: 'mass', parent: 'foot', stack: true, c: top, r: [Rc, Rc, Rc * X.squash], part: 'mass', value: 0.6, detail: 1, bend: { to: 't0', off: [0, 0, 0], k: 0.7 }, what: 'crown' });
    P.link({ from: 'foot', to: 't0', radii: [tr * 1.25, tr * 0.62], n: 3, bow: X.lean * H * 0.3, side: leanDir, part: 'wood', value: 0.3, what: 'trunk', whatSize: tr * 2 });
    return;
  }
  const tiers = X.tiers;
  for (let t = 0; t < tiers; t++) {
    // tiers stack up the crown, smaller as they rise; pads step out round the trunk on alternate sides
    const f = tiers === 1 ? 0 : t / (tiers - 1), Rt = Rc * Math.pow(0.78, t);
    const z = tiers === 1 ? top[2] : mix(base + Rt * X.squash, base + (top[2] - base) * 1.9, f);
    const out2 = X.variant === 'pads' ? mul([Math.cos(yaw + t * 2.4), Math.sin(yaw + t * 2.4), 0], Rc * 0.4 * (1 - f)) : [0, 0, 0];
    const c = add([top[0] * (z / top[2]), top[1] * (z / top[2]), z], out2), id = `t${t}`;
    // the leading mass rides high: one shape dominates, the rest gather round it; a sparser crown is smaller masses
    // further apart, so the core shows between them
    const lead = Rt * 0.64 * (1 - 0.5 * X.porosity), up = Rt * 0.3 * X.squash;
    P.block({ id, kind: 'mass', parent: t ? `t${t - 1}` : 'foot', stack: true, c: add(c, [0, 0, up]), r: [lead, lead, lead * X.squash], part: 'mass', value: 0.62, detail: L.detail, bend: { to: id, off: [0, 0, -up], k: 0.6 }, what: `crown ${t}` });
    // the dark core: what shows through the gaps between masses (depicted density)
    if (X.porosity > 0) P.block({ id: `${id}core`, kind: 'mass', parent: id, fixed: true, c, r: [Rt * 0.62, Rt * 0.62, Rt * 0.62 * X.squash], part: 'core', value: 0.12, detail: 0 });
    P.link(t === 0
      ? { from: 'foot', to: id, radii: [tr * 1.25, tr, tr * 0.8, tr * 0.62], n: 3, bow: X.lean * H * 0.3, side: leanDir, part: 'wood', value: 0.3, what: 'trunk', whatSize: tr * 2 }
      : X.variant === 'pads' ? { from: `t${t - 1}`, to: id, radii: [tr * 0.55, tr * 0.35], part: 'wood', value: 0.3 } : null);
    // a stacked crown at mid keeps three masses a tier: the tiers are the read there, not the masses
    const m = tiers > 1 && L.name !== 'near' ? Math.min(3, X.masses) : X.masses;
    for (let i = 0; i < m; i++) {
      if (rand() < X.porosity) continue;
      const a = yaw + (2 * Math.PI * (i + 0.35 * rand())) / m, e = mix(-0.3, 0.4, rand()), d = Rt * mix(0.5, 0.66, rand()) * (1 + 0.4 * X.porosity), r = Rt * mix(0.34, 0.48, rand()) * (1 - 0.6 * X.porosity);
      P.block({ id: `${id}m${i}`, kind: 'mass', parent: id, group: `ring${t}`, c: add(c, [Math.cos(a) * Math.cos(e) * d, Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d * X.squash]), r: [r, r, r * X.squash], part: 'mass', value: 0.55, detail: tiers > 1 ? 0 : L.detail, bend: { to: id, off: [0, 0, -up], k: 0.6 }, what: 'mass' });
    }
  }
}

// a cap on a stalk
function buildMushroom(X, rand, L, P) {
  const n = L.round, cluster = L.name === 'far' ? 1 : X.cluster;
  P.block({ id: 'ground', kind: 'knuckle', c: [0, 0, 0], r: [0.01, 0.01, 0.01] });
  const one = (k, at, H, scale) => {
    const R = X.cap * H, capH = R * mix(0.18, 1.05, Math.abs(X.dome)) * Math.sign(X.dome || 1), sr = Math.max(0.012, X.stalk * H);
    const zr = H - Math.max(0, capH) * 0.85 + R * X.curl;
    P.block({ id: `f${k}`, kind: 'knuckle', parent: 'ground', group: 'cluster', grounded: true, c: at, r: [sr * 1.35, sr * 1.35, sr * 1.35] });
    // the cap from its rim to its crown, in units of its radius: an ellipse leaning toward a cone by `cone`, the rim
    // curled by `curl`; the gills a disc under it, from the rim in to the stalk, a step darker
    const prof = [];
    for (let j = 0; j <= 5; j++) {
      const t = j / 5, ell = Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
      prof.push([1 - t, (capH * mix(ell, t, X.cone) + (j === 0 ? R * X.curl : 0)) / R]);
    }
    P.block({
      id: `c${k}`, kind: 'lathe', parent: `f${k}`, stack: true, c: add(at, [0, 0, zr]), r: [R, R, R], what: 'cap', sizeK: scale,
      lathes: [{ prof, sides: n, part: 'flesh', value: 0.62, wave: X.ruffle ? [7, X.ruffle] : null }, { prof: [[(sr * 0.9) / R, -0.04], [0.98, prof[0][1] - 0.02]], sides: n, part: 'gills', value: 0.34 }],
    });
    // the stalk: a little flare at the foot, a little waist below the cap
    P.link({ from: `f${k}`, to: `c${k}`, radii: [sr * 1.35, sr, sr * 0.9], n: 2, part: 'wood', value: 0.32, sides: n, what: k === 0 ? 'stalk' : null, whatSize: sr * 2 });
    for (let j = 0; j < X.spots; j++) {
      const a = rand() * Math.PI * 2, t = mix(0.15, 0.7, rand()), rr = R * (1 - t), z = capH * mix(Math.sqrt(1 - (1 - t) * (1 - t)), t, X.cone), sz = R * mix(0.07, 0.12, rand());
      // a spot is a low five-sided button, and only where it can be seen: none in the far ring, none on the small ones mid
      if (L.name === 'far' || (L.name === 'mid' && scale < 1)) continue;
      P.block({ id: `c${k}s${j}`, kind: 'lathe', parent: `c${k}`, fixed: true, c: add(at, [Math.cos(a) * rr, Math.sin(a) * rr, zr + z]), r: [sz, sz, sz], lathes: [{ prof: [[1, -0.05], [0, 0.3]], sides: 5, part: 'detail', value: 0.86 }] });
    }
  };
  one(0, [0, 0, 0], X.height, 1);
  // a cluster: smaller ones round the first
  for (let k = 1; k < cluster; k++) {
    const a = (2 * Math.PI * k) / Math.max(1, cluster - 1) + rand(), s = mix(0.35, 0.7, rand()), d = X.cap * X.height * mix(0.9, 1.4, rand());
    one(k, [Math.cos(a) * d, Math.sin(a) * d, 0], X.height * s, s);
  }
}

// organic growth
function buildFungi(X, rand, L, P) {
  const n = L.round, count = L.name === 'far' ? Math.min(X.count, 3) : L.name === 'mid' && X.kind === 'puffball' ? Math.min(X.count, 4) : X.count;
  P.block({ id: 'ground', kind: 'knuckle', c: [0, 0, 0], r: [0.01, 0.01, 0.01] });
  if (X.kind === 'bracket') {
    // a stump, its shelves stacked up one face, each a half disc out from the bark, smaller as they rise
    const hr = X.host * X.height, yaw = rand() * Math.PI * 2;
    P.block({ id: 'top', kind: 'lathe', parent: 'ground', stack: true, c: [0, 0, X.height], r: [hr, hr, hr], what: 'stump', lathes: [{ prof: [[1, 0], [0.55, 0.02 / hr], [0, 0.03 / hr]], sides: L.sides + 2, part: 'wood', value: 0.42 }] });
    P.link({ from: 'ground', to: 'top', radii: [hr * 1.1, hr], sides: L.sides + 2, part: 'wood', value: 0.3, axisOnly: true });
    for (let i = 0; i < X.count; i++) {
      const f = i / Math.max(1, X.count - 1), a = yaw + mix(-0.9, 0.9, rand()), s = hr * X.size * mix(1, 0.6, f) * mix(0.9, 1.05, rand());
      // a shelf rides the bark: it never jogs off it, only its size answers the one under it
      P.block({ id: `s${i}`, kind: 'lathe', parent: i ? `s${i - 1}` : 'ground', stack: true, noJog: true, held: true, c: [Math.cos(a) * hr * 0.9, Math.sin(a) * hr * 0.9, mix(0.15, 0.85, f) * X.height], r: [s, s, s], what: 'shelf', half: a,
        lathes: [{ prof: [[0, 0.4], [0.7, 0.3], [1, 0.02], [0.8, -0.1], [0, -0.12]], sides: n, part: 'flesh', value: 0.6, under: { part: 'gills', value: 0.36 } }] });
    }
    return;
  }
  if (X.kind === 'puffball') {
    // a family of round bodies, the first biggest, the rest crowding round it smaller
    for (let i = 0; i < count; i++) {
      const r = X.height * 0.5 * (i === 0 ? 1 : mix(0.3, 0.62, rand())), a = (2 * Math.PI * i) / Math.max(1, count - 1) + rand(), d = i === 0 ? 0 : X.height * mix(0.4, 0.7, rand());
      P.block({ id: `b${i}`, kind: 'mass', parent: 'ground', group: 'family', c: [Math.cos(a) * d, Math.sin(a) * d, r * 0.78], r: [r, r, r * 0.82], part: 'flesh', value: i === 0 ? 0.66 : 0.6, detail: L.name === 'far' ? 0 : 1, what: 'puffball', grounded: true });
      if (i === 0) P.block({ id: 'b0top', kind: 'mass', parent: 'b0', fixed: true, c: [0, 0, r * 1.55], r: [r * 0.2, r * 0.2, r * 0.08], part: 'detail', value: 0.86, detail: 0 });
    }
    return;
  }
  // frill: ruffled cups, a lathe whose rim waves round; a family of two never balances, so one, or three and more
  const sides = L.name === 'far' ? L.round : L.round + 6, family = count === 2 ? 3 : count;
  for (let i = 0; i < family; i++) {
    const s = X.height * (i === 0 ? 0.5 : mix(0.25, 0.4, rand())), a = (2 * Math.PI * i) / Math.max(1, family - 1) + rand() * 0.6, d = i === 0 ? 0 : X.height * 0.28;
    P.block({ id: `u${i}`, kind: 'lathe', parent: 'ground', group: 'family', c: [Math.cos(a) * d, Math.sin(a) * d, 0], r: [s, s, s], what: 'frill', grounded: true, lathes: [
      { prof: [[0.12, 0], [0.1, 0.5], [0.6, 0.9], [1, 1.05]], sides, part: 'flesh', value: 0.6, wave: [7, X.ruffle] },
      { prof: [[0.95, 1.02], [0.5, 0.82], [0.1, 0.55]], sides, part: 'gills', value: 0.34, wave: [7, X.ruffle] }] });
  }
}

// sausage fingers: knuckles joined by links whose radii are the knuckles' own, so a mismatched knuckle pinches the finger
function buildFingers(X, rand, L, P) {
  const H = X.height, R = X.radius * Math.max(1, H / 2), far = L.name === 'far', sides = far ? L.sides : Math.max(L.sides, X.ribs ? 8 : 0);
  const K = (id, parent, c, r, o = {}) => P.block({ id, kind: 'knuckle', parent, c, r: [r, r, r], ...o });
  const join = (a, b, o = {}) => P.link({ from: a, to: b, radii: 'ends', sides, part: 'flesh', value: 0.58, ...o });
  // a round end, never a cut (none far); a bulb if asked
  const tip = (bulb) => (far ? {} : { tip: { k: bulb || 1, value: bulb ? 0.82 : 0.6 } });
  if (X.rule === 'saguaro') {
    // the column in sausage links, so a vertical mismatch can pinch and jog it
    const zs = [0, 0.35, 0.7, 1];
    zs.forEach((z, i) => K(`k${i}`, i ? `k${i - 1}` : null, [0, 0, z * H], R * mix(1, 0.92, z), { stack: !!i, ...(i === zs.length - 1 ? tip(0) : {}), ...(i === 0 ? { what: 'column' } : {}) }));
    for (let i = 1; i < zs.length; i++) join(`k${i - 1}`, `k${i}`);
    for (let i = 0; i < X.arms; i++) {
      const a = rand() * Math.PI * 2, z = H * mix(0.32, 0.6, rand()), out_ = R * mix(1.6, 2.4, rand()), up = H * mix(0.2, 0.38, rand()), ar = R * mix(0.6, 0.75, rand());
      const dir = [Math.cos(a), Math.sin(a), 0], at = z < 0.52 * H ? 'k1' : 'k2', id = `a${i}`;
      K(`${id}0`, at, add([0, 0, z], mul(dir, R * 0.5)), ar, { group: 'arms', what: 'arm' });
      K(`${id}1`, `${id}0`, add([0, 0, z + ar * 0.6], mul(dir, out_ * 0.8)), ar * 0.97, { fixed: true });
      K(`${id}2`, `${id}1`, add([0, 0, z + ar * 2.2], mul(dir, out_)), ar * 0.94, { stack: true });
      K(`${id}3`, `${id}2`, add([0, 0, z + up], mul(dir, out_)), ar * 0.9, { stack: true, ...tip(0) });
      for (let j = 1; j < 4; j++) join(`${id}${j - 1}`, `${id}${j}`);
    }
  } else if (X.rule === 'pads') {
    // pads on pads: flattened ovals, each set on its parent's rim at a fan of angles
    const pad = (id, parent, at, w, depth, tilt, yaw) => {
      const h = w * 1.25, c = add(at, [Math.sin(tilt) * Math.cos(yaw) * h, Math.sin(tilt) * Math.sin(yaw) * h, Math.cos(tilt) * h]);
      P.block({ id, kind: 'lathe', parent, stack: true, group: parent ? `fan${parent}` : null, c, r: [w, w, w], what: 'pad', grounded: !parent,
        lathes: [{ prof: far ? [[0, -1.25], [1, 0], [0, 1.25]] : [[0, -1.25], [0.7, -0.94], [1, 0], [0.7, 0.94], [0, 1.25]], sides: L.round, part: 'flesh', value: 0.58, squash: 0.28, yaw }] });
      if (depth <= 0) return;
      const top = add(c, [Math.sin(tilt) * Math.cos(yaw) * h, Math.sin(tilt) * Math.sin(yaw) * h, Math.cos(tilt) * h * 0.9]);
      for (let k = 0; k < (depth === X.depth - 1 && !far ? X.arms : 2) && (k === 0 || rand() < 0.8); k++) pad(`${id}.${k}`, id, top, w * mix(0.6, 0.78, rand()), depth - 1, tilt * 0.4 + (k % 2 ? -1 : 1) * mix(0.45, 0.9, rand()), yaw + mix(-0.6, 0.6, rand()));
    };
    pad('p', null, [0, 0, 0], H * 0.2, far ? Math.min(1, X.depth - 1) : X.depth - 1, 0, rand() * Math.PI * 2);
  } else if (X.rule === 'coral') {
    // forks: every segment splits in two, spreading, shrinking by `taper`, round tips
    const seg = H / (1 + 0.75 * X.depth + 0.4);
    K('k', null, [0, 0, 0], R * 1.6, { what: 'trunk', sizeK: 1 });
    const fork = (id, parent, at, dir, len, r, depth) => {
      const end = add(at, mul(dir, len)), leaf = depth <= 0;
      K(id, parent, end, r * X.taper, { stack: true, group: parent === 'k' ? null : `fork${parent}`, ...(leaf ? tip(X.bulb) : L.name === 'near' ? { joint: true } : {}) });
      join(parent, id);
      if (leaf) return;
      const side = unit(cross(dir, Math.abs(dir[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1])), roll = rand() * Math.PI;
      const sw = add(mul(side, Math.cos(roll)), mul(cross(dir, side), Math.sin(roll)));
      [-1, 1].forEach((s, j) => fork(`${id}${j}`, id, end, unit(add(add(dir, mul(sw, s * X.spread)), [0, 0, 0.25])), len * mix(0.62, 0.8, rand()), r * X.taper, depth - 1));
    };
    fork('f', 'k', [0, 0, 0], [0, 0, 1], seg, R * 1.6, far ? 1 : X.depth);
  } else {
    // tubes: a bundle from one foot, the middle tallest, splaying out
    P.block({ id: 'ground', kind: 'knuckle', c: [0, 0, 0], r: [0.01, 0.01, 0.01] });
    for (let i = 0; i < (far ? Math.min(3, X.arms) : X.arms); i++) {
      const a = (2 * Math.PI * i) / X.arms + rand() * 0.5, d = i === 0 ? 0 : R * mix(1.6, 2.6, rand()), h = H * (i === 0 ? 1 : mix(0.45, 0.85, rand()));
      const foot = [Math.cos(a) * d, Math.sin(a) * d, 0], lean = mul([Math.cos(a), Math.sin(a), 0], d * X.spread * 0.5), id = `t${i}`;
      K(`${id}0`, 'ground', foot, R, { group: 'bundle', what: 'tube', sizeK: (i === 0 ? 1.3 : 1) * (h / H), grounded: true });
      K(`${id}1`, `${id}0`, add(foot, add([0, 0, h * 0.5], mul(lean, 0.3))), mix(R, R * X.taper, 0.5), { stack: true });
      K(`${id}2`, `${id}1`, add(foot, add([0, 0, h], lean)), R * X.taper, { stack: true, ...tip(X.bulb) });
      join(`${id}0`, `${id}1`); join(`${id}1`, `${id}2`);
    }
  }
}

// ── the incongruity pass ───────────────────────────────────────────────────────
/**
 * INCONGRUITY — the distortion pass, as juxtaposition: adjacent blocks that do not match are interesting (the era's
 * accent wall breaks a repeat; a run draws the eye). Two flavours, each a dial 0–1:
 *   vertical    along a stack, each block answers the one under it out of step: sizes alternate (big over small, a
 *               pinched sausage link), and the block jogs sideways off the line
 *   horizontal  among blocks side by side, sizes alternate round the run, heights go jagged, and one stands out
 * The sixth-gen object principles hold it:
 *   one leads       one joint and one sibling carry the mismatch (the 33); the rest answer it quietly
 *   inverse interest  filler stays quiet, a focus may be loud: the dials are scaled by the doodad's interest
 *   eye spot        the leading mismatch must move at least the eye spot (12 frame px) at the distance the doodad is
 *                   met, or it is noise and the pass is dropped
 *   stable          every stack's weight is brought back over what holds it (a jog becomes a lean no steeper than its
 *                   support allows), and the whole is fitted back into the bounds it had, so the space it takes,
 *                   and every footprint a composition placed, never changes
 * Seeded per block id, so a block mismatches the same way at every level. Mutates the plan; returns what it did.
 */
export const INCONGRUITY_GAIN = Object.freeze({ filler: 0.3, prop: 0.65, interactable: 0.85, focus: 1 });
const VERTICAL = { size: 0.7, jog: 0.9, kink: 0.45, quiet: 0.3 }, HORIZONTAL = { size: 0.6, jag: 0.5, odd: 0.45, quiet: 0.3 };

/** How far the weight above a joint may sit off what holds it: its support's reach, a lean of its height, or what the
 *  base design already overhung. */
function jointAllow(P, kids, b) {
  const p = P.byId.get(b.parent), bs = [b];
  for (let i = 0; i < bs.length; i++) for (const k of kids.get(bs[i].id) ?? []) bs.push(k);
  let w = 0, x = 0, y = 0; for (const s of bs) { const v = vol(s); w += v; x += v * s.c[0]; y += v * s.c[1]; }
  return Math.max(p.r[0] * 0.6, 0.15 * Math.max(0, b.c[2] - p.c[2]), Math.hypot(x / w - p.c[0], y / w - p.c[1]));
}
const vol = (b) => (b.kind === 'knuckle' ? b.r[0] * b.r[0] * 0.5 : b.r[0] * b.r[1] * b.r[2]);
const ext = (blocks) => {
  let w = 0, z = 0;
  for (const b of blocks) { w = Math.max(w, Math.hypot(b.c[0], b.c[1]) + Math.max(b.r[0], b.r[1])); z = Math.max(z, b.c[2] + b.r[2]); }
  return { w, z };
};

export function incongrue(P, { vertical = 0, horizontal = 0 } = {}, seed = 1, interest = 'prop') {
  const g = INCONGRUITY_GAIN[interest] ?? INCONGRUITY_GAIN.prop, V = Math.max(0, Math.min(1, vertical)) * g, Hh = Math.max(0, Math.min(1, horizontal)) * g;
  const B = P.blocks, kids = new Map();
  for (const b of B) { b.c0 = b.c.slice(); b.r0 = b.r.slice(); b.ownS = 0; b.ownJ = [0, 0, 0]; if (b.parent) { if (!kids.has(b.parent)) kids.set(b.parent, []); kids.get(b.parent).push(b); } }
  const sub_ = (b) => { const out = [b]; for (let i = 0; i < out.length; i++) for (const k of kids.get(out[i].id) ?? []) out.push(k); return out; };
  const moveSub = (b, d) => { for (const x of sub_(b)) x.c = add(x.c, d); };
  const before = ext(B);
  // what each joint already overhangs in the base design: a mismatch may lean a joint as far as its support allows,
  // or as far as the base design already did, never further (the realistic object is the measure of stable)
  for (const b of B) if (b.stack && b.parent && !b.held) b.allow = jointAllow(P, kids, b);
  const R = (key) => mulberry32(subSeed(seed, `incongruity:${key}`))();
  // a block's own size change carries what rides on it: an attachment moves out with its surface, a block stacked on
  // a body rises or sinks with that body's top
  const resize = (b, s, sz = 1) => {
    for (const k of kids.get(b.id) ?? []) {
      if (b.kind === 'knuckle') continue;
      // an attachment rides the surface: it moves out by the surface's own growth along its direction, not its whole offset
      if (k.stack) moveSub(k, [0, 0, (s * sz - 1) * b.r[2]]); else { const off = sub(k.c, b.c), l = Math.hypot(...off); if (l > 1e-9) moveSub(k, mul(off, (Math.min(l, Math.max(...b.r)) * (s - 1)) / l)); }
    }
    b.r = [b.r[0] * s, b.r[1] * s, b.r[2] * s * sz];
    b.ownS += Math.log(s);
  };
  // a block's own move (its jog or its jag), kept apart from what it inherits from its parent
  const own = (b, d) => { moveSub(b, d); b.ownJ = add(b.ownJ, d); };
  // the 66: the biggest shape the eye reads; it never shrinks, and an odd one out that is not it shrinks, never grows
  const sizeOf = (b, r) => 2 * Math.max(r[0], r[1]) * (b.sizeK ?? 1), named = B.filter((b) => b.what);
  const top66 = named.length ? named.reduce((m, b) => (sizeOf(b, b.r0) > sizeOf(m, m.r0) ? b : m)) : null;
  const towards = (b, s, lead) => (b === top66 ? Math.max(s, 1 / s) : lead ? Math.min(s, 1 / s) : s);
  // a knuckle's reach is its segment (the length of the link that ends at it), not its radius: its jog is a kink
  const segLen = (b) => (b.parent ? Math.hypot(...sub(b.c0, P.byId.get(b.parent).c0)) : 0);
  const depth = (b) => { let d = 0, x = b; while (x.parent) { d++; x = P.byId.get(x.parent); } return d; };
  // vertical: every block that sits on another, one of them leading
  const firstOf = new Map();
  for (const b of B) if (b.group && b.stack) { const k = `${b.parent}|${b.group}`; if (!firstOf.has(k) || b.id < firstOf.get(k)) firstOf.set(k, b.id); }
  // a stack's continuation answers the block under it; a fan's or a fork's other members answer across, not up
  const stacked = B.filter((b) => b.stack && !b.fixed && b.parent && (!b.group || firstOf.get(`${b.parent}|${b.group}`) === b.id)).sort((a, b) => depth(a) - depth(b) || (a.id < b.id ? -1 : 1));
  // the leader is one of the bigger blocks (the mismatch has to read): drawn from the larger half by size
  const bigFirst = [...stacked].sort((a, b) => Math.max(...b.r0) * (b.kind === 'knuckle' ? 0 : 1) - Math.max(...a.r0) * (a.kind === 'knuckle' ? 0 : 1) || segLen(b) - segLen(a) || (a.id < b.id ? -1 : 1));
  // and never the 66: the mismatch is the 33's
  const cand = bigFirst.filter((b) => b !== top66), leadV = cand.length ? cand[Math.floor(R('lead:v') * Math.ceil(cand.length / 2))].id : null;
  if (V > 0) for (const b of stacked) {
    const p = P.byId.get(b.parent), q = b.id === leadV ? 1 : VERTICAL.quiet, sign = depth(b) % 2 ? -1 : 1;
    resize(b, towards(b, Math.exp(sign * q * V * VERTICAL.size * (b.id === leadV ? 1 : 0.6 + 0.4 * R(`v:${b.id}`))), b.id === leadV));
    if (!b.noJog && b.id === leadV) { const a = R(`j:${b.id}`) * Math.PI * 2, m = q * V * (b.kind === 'knuckle' ? VERTICAL.kink * segLen(b) : VERTICAL.jog * Math.max(p.r[0], b.r[0])); own(b, [Math.cos(a) * m, Math.sin(a) * m, 0]); b.jogged = true; }
  }
  // horizontal: every run of two or more side by side, one standing out
  const groups = new Map();
  for (const b of B) if (b.group && !b.fixed) { const k = `${b.parent}|${b.group}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(b); }
  const leadsH = [], upward = new Set(V > 0 ? stacked.map((b) => b.id) : []);
  for (const [k, run] of groups) groups.set(k, run.filter((b) => !upward.has(b.id)));
  if (Hh > 0) for (const [k, run] of [...groups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (run.length < 2) continue;
    const p = P.byId.get(run[0].parent), ang = (b) => Math.atan2(b.c[1] - p.c[1], b.c[0] - p.c[0]);
    run.sort((a, b) => ang(a) - ang(b) || (a.id < b.id ? -1 : 1));
    const big = [...run].filter((b) => b !== top66).sort((a, b) => Math.max(...b.r0) - Math.max(...a.r0) || (a.id < b.id ? -1 : 1));
    if (!big.length) continue;
    const odd = big[Math.floor(R(`lead:h:${k}`) * Math.ceil(big.length / 2))].id; leadsH.push(odd);
    run.forEach((b, j) => {
      const q = b.id === odd ? 1 : HORIZONTAL.quiet, sign = j % 2 ? -1 : 1;
      const s = towards(b, Math.exp(sign * q * Hh * HORIZONTAL.size), b.id === odd), sz = b.id === odd ? 1 + Hh * HORIZONTAL.odd : 1;
      resize(b, s, sz);
      if (b.grounded && b.kind === 'mass') moveSub(b, [0, 0, b.c0[2] * (s * sz - 1)]);
      if (!b.grounded) own(b, [0, 0, sign * q * Hh * HORIZONTAL.jag * b.r0[2]]);
    });
  }
  // the 66 keeps the lead: incongruity is the 33's, so no other shape the eye reads grows past the leading shape / 1.2
  if (named.length > 1) {
    const top = top66;
    for (const b of named) if (b !== top && sizeOf(b, b.r) > sizeOf(top, top.r) / 1.25) resize(b, sizeOf(top, top.r) / 1.25 / sizeOf(b, b.r));
  }
  // what each block's mismatch is, against its own base: its size change, and how far it moved off its parent
  const mis = (b) => { const p = b.parent ? P.byId.get(b.parent) : null; return Math.abs(b.ownS) + Math.hypot(...b.ownJ) / Math.max(b.kind === 'knuckle' ? segLen(b) * 0.5 : 0, b.r0[0], p ? p.r0[0] : 0, 1e-6); };
  // STABLE: a run's weight back over its parent, then deepest first each stack's weight back over what holds it (twice,
  // so a correction low down is answered above); a correction comes off the block's own jog
  const comOf = (bs) => { let w = 0, x = 0, y = 0; for (const b of bs) { const v = vol(b); w += v; x += v * b.c[0]; y += v * b.c[1]; } return w ? [x / w, y / w] : [0, 0]; };
  for (const [, run] of groups) {
    if (run.length < 2 || run.some((b) => b.grounded)) continue;
    const p = P.byId.get(run[0].parent), [cx, cy] = comOf(run.flatMap(sub_)), [bx, by] = comOf(run.map((b) => ({ ...b, c: b.c0, r: b.r0 })));
    const d = [-(cx - bx), -(cy - by), 0];
    if (Math.hypot(d[0], d[1]) > p.r[0] * 0.3) for (const b of run) moveSub(b, d);
  }
  // THE WHOLE STANDS: if the doodad's weight drifted off where it stood by more than 6% of its height, the
  // leading jog gives the difference back
  const all0 = comOf(B.map((b) => ({ ...b, c: b.c0, r: b.r0 }))), all1 = comOf(B), drift = [all1[0] - all0[0], all1[1] - all0[1]], dl = Math.hypot(...drift), lim = Math.max(0, Math.min(0.06 * before.z, 0.27 * before.z - Math.hypot(...all0)));
  if (dl > lim && leadV) { const b = P.byId.get(leadV), w = vol(b) && comOf(sub_(b)) && sub_(b).reduce((s, x) => s + vol(x), 0) / B.reduce((s, x) => s + vol(x), 0); const k = Math.min(1, (dl - lim) / dl / Math.max(w, 0.05)); own(b, [-drift[0] * k, -drift[1] * k, 0]); }
  const allStacked = B.filter((b) => b.stack && b.parent && !b.fixed).sort((a, b) => depth(a) - depth(b) || (a.id < b.id ? -1 : 1));
  for (let pass = 0; pass < 3; pass++) for (const b of [...allStacked].reverse()) {
    if (b.held) continue;
    const p = P.byId.get(b.parent), [cx, cy] = comOf(sub_(b)), dx = cx - p.c[0], dy = cy - p.c[1], dist = Math.hypot(dx, dy), allow = b.allow;
    if (dist > allow) { const d = [(-dx / dist) * (dist - allow), (-dy / dist) * (dist - allow), 0]; if (b.jogged) own(b, d); else moveSub(b, d); }
  }
  const scores = B.filter((b) => !b.fixed && b.parent).map((b) => ({ id: b.id, m: r3(mis(b)), d: r3(Math.hypot(...sub(b.c, b.c0)) + Math.max(...b.r.map((x, i) => Math.abs(x - b.r0[i])))) })).sort((a, b) => b.m - a.m || (a.id < b.id ? -1 : 1));
  // ONE LEADS, per run: in each stack and each side-by-side run, the leader's mismatch is the run's biggest by 1.4×
  const misOf = new Map(scores.map((x) => [x.id, x.m])), runs = [];
  if (V > 0 && stacked.length > 1) runs.push({ lead: leadV, ids: stacked.map((b) => b.id) });
  if (Hh > 0) for (const [, run] of groups) if (run.length > 1) runs.push({ lead: run.find((b) => leadsH.includes(b.id))?.id, ids: run.map((b) => b.id) });
  const unled = runs.filter((r) => { const lm = misOf.get(r.lead) ?? 0, rest = Math.max(0, ...r.ids.filter((i) => i !== r.lead).map((i) => misOf.get(i) ?? 0)); return lm < 1.4 * rest; }).map((r) => r.lead);
  // the eye spot: the leading mismatch must move far enough to read where the doodad is met, or it is noise
  const eye = EYE_SPOT_PX * metresPerPixel(INTEREST[interest]?.distance ?? INTEREST.prop.distance), leadD = scores.length ? scores[0].d : 0;
  if ((V > 0 || Hh > 0) && leadD < eye) {
    for (const b of B) { b.c = b.c0; b.r = b.r0; }
    return { vertical: r3(V), horizontal: r3(Hh), unled: [], dropped: `the leading mismatch moves ${r3(leadD)} m, under the eye spot's ${r3(eye)} m at ${INTEREST[interest]?.distance ?? INTEREST.prop.distance} m: noise`, scores: [], eye: r3(eye), fit: [1, 1] };
  }
  // FIT: back into the bounds it had, across and up
  const after = ext(B), fx = after.w > 1e-9 ? before.w / after.w : 1, fz = after.z > 1e-9 ? before.z / after.z : 1;
  for (const b of B) { b.c = [b.c[0] * fx, b.c[1] * fx, b.c[2] * fz]; b.r = [b.r[0] * fx, b.r[1] * fx, b.r[2] * fz]; }
  for (const l of P.links) { if (Array.isArray(l.radii)) l.radii = l.radii.map((x) => x * fx); l.bow *= fx; }
  P.fit = fx;
  return { vertical: r3(V), horizontal: r3(Hh), leads: { vertical: leadV, horizontal: leadsH }, unled, scores: scores.slice(0, 6), eye: r3(eye), fit: [r3(fx), r3(fz)], dropped: null };
}

/** A plan's stacks, each checked: the weight above every joint over what holds it (the `stable` law). */
export function planStability(P) {
  const kids = new Map();
  for (const b of P.blocks) if (b.parent) { if (!kids.has(b.parent)) kids.set(b.parent, []); kids.get(b.parent).push(b); }
  const sub_ = (b) => { const out = [b]; for (let i = 0; i < out.length; i++) for (const k of kids.get(out[i].id) ?? []) out.push(k); return out; };
  const off = [];
  for (const b of P.blocks) {
    if (!b.stack || !b.parent || b.held) continue;
    const p = P.byId.get(b.parent), bs = sub_(b);
    let w = 0, x = 0, y = 0; for (const s of bs) { const v = vol(s); w += v; x += v * s.c[0]; y += v * s.c[1]; }
    const dist = Math.hypot(x / w - p.c[0], y / w - p.c[1]), fit = P.fit ?? 1, allow = (b.allow ?? jointAllow(P, kids, b)) * fit + 1e-6;
    if (dist > allow * 1.02) off.push({ id: b.id, by: r3(dist - allow) });
  }
  return off;
}

// ── the mesh ───────────────────────────────────────────────────────────────────
function meshPlan(P, L) {
  const out = [], elements = [];
  for (const b of P.blocks) {
    if (b.kind === 'mass') {
      const bend = b.bend ? { at: add(P.byId.get(b.bend.to).c, b.bend.off), k: b.bend.k } : null;
      mass(out, b.c, b.r, b.part, b.value, b.detail ?? 0, bend?.at ?? null, bend?.k ?? 0);
    } else if (b.kind === 'lathe') {
      for (const l of b.lathes) {
        const prof = l.prof.map(([pr, pz]) => [pr * b.r[0], pz * b.r[2]]);
        if (b.half == null) { lathe(out, b.c, prof, l.sides, l.part, l.value, { wave: l.wave ?? null, squash: l.squash ?? 1, yaw: l.yaw ?? 0 }); continue; }
        // half a body, its flat side on the bark: the outer half of the turn, turned to face out at `half`
        const half = [];
        lathe(half, [0, 0, 0], prof, l.sides, l.part, l.value);
        const c = Math.cos(b.half), sn = Math.sin(b.half);
        for (const f of half) {
          if (f.corners.some((p) => p[0] < -1e-9)) continue;
          f.corners = f.corners.map((p) => add(b.c, [p[0] * c - p[1] * sn, p[0] * sn + p[1] * c, p[2]]));
          f.gn = faceNormal(f.corners); f.normal = f.gn;
          if (l.under && f.corners.some((p) => p[2] < b.c[2] - b.r[2] * 0.02)) { f.part = l.under.part; f.value = l.under.value; }
          out.push(f);
        }
      }
    } else if (b.tip || b.joint) {
      const k = b.tip ? b.tip.k : 1, p = P.byId.get(b.parent), d = p ? unit(sub(b.c, p.c)) : [0, 0, 1];
      mass(out, b.tip ? add(b.c, mul(d, b.r[0] * k * 0.2)) : b.c, [b.r[0] * k, b.r[0] * k, b.r[0] * k], 'flesh', b.tip ? b.tip.value : 0.58, 0);
    }
    if (b.what) elements.push({ what: b.what, size: 2 * Math.max(b.r[0], b.r[1]) * (b.sizeK ?? 1) });
  }
  for (const l of P.links) {
    const A = P.byId.get(l.from), Bk = P.byId.get(l.to);
    const a = l.axisOnly ? [A.c[0], A.c[1], A.c[2]] : A.c, b = l.axisOnly ? [A.c[0], A.c[1], Bk.c[2]] : Bk.c;
    const pts = bowed(a, b, l.bow, l.side, Math.max(1, l.n));
    const radii = l.radii === 'ends' ? pts.map((_, i) => mix(A.r[0], Bk.r[0], i / (pts.length - 1))) : pts.map((_, i) => l.radii[Math.min(l.radii.length - 1, Math.round((i / (pts.length - 1)) * (l.radii.length - 1)))]);
    tube(out, pts, radii, l.sides ?? L.sides, l.part, l.value);
    if (l.what) elements.push({ what: l.what, size: l.whatSize != null ? l.whatSize * (P.fit ?? 1) : 2 * radii[0] });
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
 *   stable      (planned) the weight above every joint sits over what holds it
 *   one-leads   (mismatched) in every stack and run, one mismatch leads
 */
export const FLORA_LAWS = Object.freeze([
  { id: 'dominant', rule: 'one shape leads: the biggest the eye reads is at least 1.2× the next' },
  { id: 'stands', rule: 'its weight sits over its foot: offset no more than 0.3 of its height' },
  { id: 'value-split', rule: 'the body and what holds it up differ by at least 0.2 in value' },
  { id: 'budget', rule: 'its faces keep the ring\'s budget' },
  { id: 'stable', rule: 'the weight above every joint sits over what holds it, no further off than the base design' },
  { id: 'one-leads', rule: 'in every stack and every run, one mismatch leads by 1.4× (the 33 of incongruity)' },
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
  if (d.unstable?.length) out.push({ law: 'stable', line: `${d.unstable.map((u) => `${u.id} +${u.by} m`).join(', ')} off what holds it.` });
  if (d.incongruity?.unled?.length) out.push({ law: 'one-leads', line: `no single mismatch leads the run at ${d.incongruity.unled.join(', ')}.` });
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
 * from a trail along y at x = 0, clear of it. → [{ x, y, species, scale, stretch, ring, gain, odd, incongruity }]
 *
 * INCONGRUITY AT THE COMPOSITION'S SCALE, gated by the EYE RADIUS (distinct inside the radius, repetition outside it):
 * a point's `gain` is 1 near the trail, a half mid, 0 far. Within a cluster the members answer each other the way blocks
 * do inside a doodad: horizontally their sizes alternate and one stands out (`odd`); vertically their heights
 * alternate (`stretch`), tall beside short. A doodad too small for its own mismatch to reach the eye spot gets its
 * incongruity here, from its neighbours. Each point carries the dials its own doodad is built with (`incongruity`).
 */
export const RING_GAIN = Object.freeze({ near: 1, mid: 0.5, far: 0 });
export function floraScatter(species, seed, { w = 40, d = 60, rings = { near: 7, mid: 16 }, clear = 1.6, incongruity = null } = {}) {
  const out = [], V = incongruity?.vertical ?? 0, H = incongruity?.horizontal ?? 0;
  species.forEach((sp, si) => {
    const rand = mulberry32(subSeed(seed, `scatter:${sp.id}`)), dens = sp.density;
    for (let c = 0; c < sp.clusters; c++) {
      const cx = mix(-w / 2, w / 2, rand()), cy = mix(0, d, rand()), members = [];
      for (let k = 0; k < sp.perCluster * 3; k++) {
        const r = sp.spread * Math.sqrt(rand()), a = rand() * Math.PI * 2, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        const ax = Math.abs(x), ring = ax < rings.near ? 'near' : ax < rings.mid ? 'mid' : 'far';
        if (ax < clear + sp.size || y < 0 || y > d || ax > w / 2 || rand() > dens[ring]) continue;
        if (out.some((p) => Math.hypot(p.x - x, p.y - y) < (p.size + sp.size) * 0.7)) continue;
        const p = { x: r3(x), y: r3(y), species: sp.id, si, size: sp.size, scale: r3(mix(0.8, 1.2, rand()) * (1 - r / sp.spread * 0.3)), stretch: 1, ring, gain: RING_GAIN[ring], odd: false, a };
        out.push(p); members.push(p);
      }
      if (!(V > 0 || H > 0) || members.length < 2) continue;
      // round the cluster's middle, alternating; one member leads (the odd one), the rest answer it quietly
      members.sort((p, q) => p.a - q.a);
      const odd = Math.floor(rand() * members.length);
      members.forEach((p, j) => {
        const q = j === odd ? 1 : 0.3, sign = j % 2 ? -1 : 1, g = p.gain;
        p.scale = r3(p.scale * Math.exp(sign * q * H * g * 0.5));
        p.stretch = r3(Math.exp(-sign * q * V * g * 0.5));
        p.odd = j === odd && g > 0;
      });
    }
  });
  for (const p of out) { p.incongruity = { vertical: r3(V * p.gain), horizontal: r3(H * p.gain) }; delete p.a; }
  return out;
}
