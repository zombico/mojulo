/**
 * THE ROBLOX LOOK: what a level looks like in the place, built from the recipe's own faces on the operator's machine (no
 * mesh, no upload, no account). A face gives its colour (its `fill`; a textured face's tint times its texture's average,
 * in linear light as the page multiplies a map by its vertex colours; quantized so neighbours merge) and a Roblox material
 * named by its texture or its group (grass, rock, bark, brick, slate, soil…); the level's non-floor faces (walls, rocks,
 * trees, props) are VOXELIZED into a grid of coloured cells, each claimed by the first face to cross it, and the cells of
 * one colour and material merged greedily into boxes. The voxel coarsens until the shell fits SHELL_MAX boxes.
 *
 * The shell is decoration: a Humanoid passes through it and no raycast meets it (CanCollide, CanQuery and CanTouch false),
 * so where the player and the cast stand is the greybox's and the kernel's alone. Ground cover the page draws as cards
 * (grass blades, meadow tufts), ground shadows and blend tiles are left out (the floor slabs carry the ground's colour),
 * and so is a backdrop (a fogged ridge, a skyline: the place's own sky stands behind it).
 *
 *   textureMeans(textures)                → (name) → linear [r, g, b] | null   each texture's alpha-weighted mean, once
 *   faceLook(face, means?)                → { color: [r, g, b] (0..1 sRGB, quantized), material, transparency? }
 *   isFloor(a, b, c)                      → true when the triangle faces up (or down) at least UP
 *   voxelShell(faces, { mpu, voxel, means }) → [{ min, max, color, material, transparency? }] in metres
 *   lookModel(faces, { mpu, textures })   → { model, boxes, voxel, lookOf }   the shell as a Model of decoration Parts,
 *                                           and the face → look the floors wear
 *
 * Deterministic: faces in their order, integer cells, keys sorted; no clock, no dice.
 */
import { partOf } from './roblox-project.js';
import { decodePng } from '../era/tone.js';

export const VOXEL = 0.5;          // metres: the shell's finest cell
export const SHELL_MAX = 12000;    // boxes: above it, the voxel doubles (to 4 m at most)
export const UP = 0.6;             // a face is floor when its normal's z is at least this (the greybox's own test)
const STEPS = 31;                  // a colour channel's levels (merging needs equal colours)
const GREY = [0.62, 0.64, 0.68];

// a face's texture (or else its group) names the material, the first rule that matches; long-standing Part materials only
const MATERIALS = [
  [/water|river|lake|pond|sea\b/, 'Glass'],
  [/glass|window|pane/, 'Glass'],
  [/bough|leaf|leaves|canopy|foliage|hedge|bush/, 'LeafyGrass'],
  [/grass|meadow|moss|lawn|turf/, 'Grass'],
  [/plank|board|floorboard|deck/, 'WoodPlanks'],
  [/bark|wood|timber|log|trunk|beam/, 'Wood'],
  [/brick/, 'Brick'],
  [/cobble/, 'Cobblestone'],
  [/flagstone|paving|pavement|sett/, 'Pavement'],
  [/asphalt|tarmac|road/, 'Asphalt'],
  [/slate/, 'Slate'],
  [/marble/, 'Marble'],
  [/granite/, 'Granite'],
  [/sandstone/, 'Sandstone'],
  [/limestone/, 'Limestone'],
  [/basalt|lava/, 'Basalt'],
  [/pebble|gravel|shingle/, 'Pebble'],
  [/rock|scree|cliff|stone|boulder|rubble|cave/, 'Rock'],
  [/sand|beach|dune|desert/, 'Sand'],
  [/snow/, 'Snow'],
  [/ice|glacier|frost/, 'Ice'],
  [/mud|bog|swamp/, 'Mud'],
  [/soil|dirt|earth|ground|loam/, 'Ground'],
  [/concrete|cement|stucco|plaster/, 'Concrete'],
  [/rust|corrod/, 'CorrodedMetal'],
  [/metal|steel|iron|chrome|brass|copper/, 'Metal'],
  [/fabric|cloth|carpet|rug|canvas|banner/, 'Fabric'],
];
const TRANSPARENT = { Glass: 0.35 };
// what the shell leaves out: ground cover drawn as cards, a ground's shadow decal, a blend tile over the ground, a backdrop
const SKIP = (f) => !!f.blend || /(^|:)(shadow|grassblend|ridge|backdrop|skyline|horizon)$/.test(String(f.group || '')) || /^card:(meadow|grass|tuft|flower)/.test(String(f.texture || ''));

const q = (v) => Math.round(Math.min(1, Math.max(0, v)) * STEPS) / STEPS;
const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

/** Each texture's mean colour in linear light, its pixels weighted by their alpha (a card's cut-out is not its colour). */
export function textureMeans(textures = {}) {
  const memo = new Map();
  return (name) => {
    if (typeof name !== 'string' || !textures || typeof textures[name] !== 'string') return null;
    if (memo.has(name)) return memo.get(name);
    const img = decodePng(textures[name]);
    let mean = null;
    if (img) {
      const s = [0, 0, 0];
      let w = 0;
      for (let i = 0; i < img.px.length; i += 4) { const a = img.px[i + 3] / 255; if (!a) continue; for (let k = 0; k < 3; k++) s[k] += toLin(img.px[i + k] / 255) * a; w += a; }
      if (w > 0) mean = s.map((v) => v / w);
    }
    memo.set(name, mean);
    return mean;
  };
}
function colorOf(f, means) {
  const hex = typeof f.fill === 'string' && /^#[0-9a-f]{6}$/i.test(f.fill) ? f.fill : null;
  const tint = hex ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) : null;
  const tex = means ? means(f.texture) : null;
  if (!tint && !tex) return GREY;
  if (!tex) return tint.map(q);
  // the page's map × vertex colour, in linear light
  return tex.map((t, k) => q(toSrgb(t * (tint ? toLin(tint[k]) : 1))));
}
export function materialOf(f) {
  for (const word of [f.texture, f.group]) {
    if (typeof word !== 'string' || !word) continue;
    const w = word.toLowerCase();
    for (const [re, m] of MATERIALS) if (re.test(w)) return m;
  }
  return 'SmoothPlastic';
}
export function faceLook(f, means = null) {
  const material = f && f.water ? 'Glass' : materialOf(f || {});
  return { color: colorOf(f || {}, means), material, ...(TRANSPARENT[material] ? { transparency: TRANSPARENT[material] } : {}) };
}
const keyOf = (l) => `${l.color.join(',')}|${l.material}`;

export function isFloor(a, b, c) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, n = Math.hypot(nx, ny, nz);
  return n > 1e-12 && Math.abs(nz) / n >= UP;
}

/** The non-floor faces as voxels (each cell the first face to cross it), merged into boxes of one look each. */
export function voxelShell(faces = [], { mpu = 1, voxel = VOXEL, means = null } = {}) {
  const cells = new Map();   // 'ix,iy,iz' → look key
  const looks = new Map();   // look key → look
  for (const f of faces) {
    const c = f && Array.isArray(f.corners) ? f.corners : null;
    if (!c || c.length < 3 || SKIP(f)) continue;
    const look = faceLook(f, means), key = keyOf(look);
    for (let i = 1; i + 1 < c.length; i++) {
      const t = [c[0], c[i], c[i + 1]];
      if (!t.every((p) => Array.isArray(p) && p.length >= 3 && p.every(Number.isFinite))) continue;
      const [a0, b0, d0] = t.map((p) => [p[0] * mpu, p[1] * mpu, p[2] * mpu]);
      if (isFloor(a0, b0, d0)) continue;
      // a hair inside the triangle (toward its centroid), so a face on a cell's boundary covers the cells it spans and
      // not the next one too (architecture laid out on the voxel's grid keeps its size)
      const g = [0, 1, 2].map((k) => (a0[k] + b0[k] + d0[k]) / 3), inset = (p) => p.map((v, k) => v + (g[k] - v) * 1e-6);
      const [a, b, d] = [inset(a0), inset(b0), inset(d0)];
      if (!looks.has(key)) looks.set(key, look);
      // samples half a voxel apart over the triangle: every cell it crosses gets one
      const L = Math.max(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), Math.hypot(d[0] - a[0], d[1] - a[1], d[2] - a[2]), Math.hypot(d[0] - b[0], d[1] - b[1], d[2] - b[2]));
      const n = Math.max(1, Math.ceil(L / (voxel / 2)));
      for (let u = 0; u <= n; u++) {
        for (let v = 0; v <= n - u; v++) {
          const s = u / n, r = v / n;
          const k = `${Math.floor((a[0] + (b[0] - a[0]) * s + (d[0] - a[0]) * r) / voxel)},${Math.floor((a[1] + (b[1] - a[1]) * s + (d[1] - a[1]) * r) / voxel)},${Math.floor((a[2] + (b[2] - a[2]) * s + (d[2] - a[2]) * r) / voxel)}`;
          if (!cells.has(k)) cells.set(k, key);
        }
      }
    }
  }
  // greedy merge: from each unvisited cell (in z, y, x order) a run along x, then rows along y, then layers along z, of
  // one look and unvisited cells only
  const at = (x, y, z) => cells.get(`${x},${y},${z}`);
  const done = new Set();
  const free = (x, y, z, key) => at(x, y, z) === key && !done.has(`${x},${y},${z}`);
  const order = [...cells.keys()].map((k) => k.split(',').map(Number)).sort((p, r) => p[2] - r[2] || p[1] - r[1] || p[0] - r[0]);
  const boxes = [];
  for (const [x0, y0, z0] of order) {
    if (done.has(`${x0},${y0},${z0}`)) continue;
    const key = at(x0, y0, z0);
    let x1 = x0;
    while (free(x1 + 1, y0, z0, key)) x1++;
    let y1 = y0;
    for (;;) { let ok = true; for (let x = x0; x <= x1 && ok; x++) ok = free(x, y1 + 1, z0, key); if (!ok) break; y1++; }
    let z1 = z0;
    for (;;) { let ok = true; for (let y = y0; y <= y1 && ok; y++) for (let x = x0; x <= x1 && ok; x++) ok = free(x, y, z1 + 1, key); if (!ok) break; z1++; }
    for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) done.add(`${x},${y},${z}`);
    const l = looks.get(key);
    boxes.push({ min: [x0 * voxel, y0 * voxel, z0 * voxel], max: [(x1 + 1) * voxel, (y1 + 1) * voxel, (z1 + 1) * voxel], color: l.color, material: l.material, ...(l.transparency ? { transparency: l.transparency } : {}) });
  }
  return boxes;
}

/** The shell as a Model of decoration Parts, its voxel doubled until it fits SHELL_MAX (4 m at most). */
export function lookModel(faces = [], { mpu = 1, max = SHELL_MAX, textures = {} } = {}) {
  const means = textureMeans(textures);
  let voxel = VOXEL, boxes = voxelShell(faces, { mpu, voxel, means });
  while (boxes.length > max && voxel < 4) { voxel *= 2; boxes = voxelShell(faces, { mpu, voxel, means }); }
  const children = boxes.map((b, i) => partOf(`look-${i}`, b.min, b.max, b.color, {
    Material: b.material, CanCollide: false, CanQuery: false, CanTouch: false, ...(b.transparency ? { Transparency: b.transparency } : {}),
  }));
  return { model: { Name: 'Look', ClassName: 'Model', Children: children }, boxes: boxes.length, voxel, lookOf: (f) => faceLook(f, means) };
}
