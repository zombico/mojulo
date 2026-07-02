/**
 * molecule-view — a ball-and-stick MOLECULE hung in the traversable three.js World.
 *
 * The science/educational sibling of scene-planetary: an orbit-only object study built on
 * the same `emitThreeWorld` faces payload, but spheres (atoms) joined by blobpla-style rods
 * (bonds) instead of a globe. Interactive — each atom/bond is a pickable sub-mesh (`group`),
 * so clicking it in the World raises a metadata popup (the additive `picks` channel on
 * emitThreeWorld).
 *
 * Why World, not the live CSS-3D scene: a ball-and-stick molecule is interpenetrating
 * geometry (overlapping spheres + a rod spanning them), and the preserve-3d compositor sorts
 * whole DOM divs by centroid z — it cannot occlude that correctly (see solid-turntable-tool.js
 * scope note: molecules are explicitly routed off the live CSS engine). WebGL depth-sorts every
 * frame, so the World renders it exactly. Orbit-only (object study, like planetary/workbench):
 * NOT added to the world route's WALK_KINDS.
 *
 * Canonical placement:
 *   • principal axis — the molecule's PRINCIPAL axis (PCA of atom positions) is rotated to +Z,
 *     so every molecule is framed on the same vertical spine. `chirality` (±1) fixes the in-plane
 *     mirror flip so enantiomeric framings don't collapse (a presentation choice — it never
 *     mutates the authored bond geometry). `orient:false` renders coords verbatim.
 *   • mandala — the radial graticule cage around the principal axis, an OPT-IN educational
 *     scaffold (rings + meridians, lifted from scene-planetary), off by default.
 *
 * Bond rendering has three styles (`bondStyle`): 'stick' (uniform rods; multi-order → parallel
 * rods), 'split' (each half coloured by its nearer atom), and 'line' (thin licorice).
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored). Three author
 * modes, all resolved by molecule-builder's resolveMoleculeRecipe before planning (see that module):
 *   1. by NAME         { kind:'molecule-view', library:'caffeine' }
 *   2. by CONNECTIVITY { kind:'molecule-view', atoms:['O','H','H'], bonds:[[0,1],[0,2]] }  (no coords
 *                        → VSEPR places the atoms)
 *   3. by COORDINATES  { kind:'molecule-view', atoms:[{ symbol, pos:[x,y,z], label?, charge?, radius?,
 *                        color?, meta? }], bonds:[{ from, to, order?, tint?, meta? }] }  (verbatim)
 *   shared presentation: bondStyle?, orient?, chirality?, axis?, mandala?, lod?, ballScale?,
 *   bondRadius?, viewBox?, scene?:{ bg? }, title?
 */

import { makeLight, shadeHex } from '../../polygonizer/vexar.js';
import { resolveMoleculeRecipe } from './molecule-builder.js';

const TAU = Math.PI * 2;

// ── tiny vec helpers (self-contained, like the other graph builders) ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid4 = (pts) => { const n = pts.length; let x = 0, y = 0, z = 0; for (const p of pts) { x += p[0]; y += p[1]; z += p[2]; } return [x / n, y / n, z / n]; };

// ── element data: CPK-ish colours + covalent radii (Å). Common organic/main-group subset;
// anything unlisted falls back to a magenta marker + a mid radius (visible, clearly "unknown"). ──
const CPK = {
  H: '#f5f5f5', C: '#9a9a9a', N: '#3050f8', O: '#ff3030', F: '#7ee04a', CL: '#27e527',
  BR: '#b03333', I: '#9400b4', S: '#f5d020', P: '#ff8000', B: '#ffb5b5', NA: '#ab5cf2',
  MG: '#8aff00', AL: '#bfa6a6', SI: '#f0c8a0', K: '#8f40d4', CA: '#3dff00', FE: '#e06633',
  ZN: '#7d80b0', CU: '#c88033', SE: '#ffa100',
};
const COVALENT = {
  H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, CL: 1.02, BR: 1.20, I: 1.39, S: 1.05, P: 1.07,
  B: 0.84, NA: 1.66, MG: 1.41, AL: 1.21, SI: 1.11, K: 2.03, CA: 1.76, FE: 1.32, ZN: 1.22,
  CU: 1.32, SE: 1.20,
};
const UNKNOWN_HEX = '#ff1493';
const elemKey = (s) => String(s == null ? '' : s).trim().toUpperCase();
const elemColor = (s) => CPK[elemKey(s)] || UNKNOWN_HEX;
const elemRadius = (s) => COVALENT[elemKey(s)] || 0.75;

const LOD = {
  draft: { longs: 12, lats: 8, sides: 8 },
  default: { longs: 20, lats: 12, sides: 10 },
  hero: { longs: 28, lats: 18, sides: 14 },
};

// faceted unit UV-sphere → corner-array faces (z-up; quad bands + triangle pole caps). CONVEX,
// so per-face vexar Lambert reads it as a smooth ball under WebGL backface culling.
function sphereUnitFaces(longs, lats) {
  const grid = [];
  for (let j = 0; j <= lats; j++) {
    grid[j] = [];
    for (let i = 0; i < longs; i++) {
      const th = -Math.PI / 2 + Math.PI * (j / lats), ph = TAU * (i / longs);
      grid[j][i] = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), Math.sin(th)];
    }
  }
  const faces = [];
  for (let j = 0; j < lats; j++) for (let i = 0; i < longs; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % longs], c = grid[j + 1][(i + 1) % longs], d = grid[j + 1][i];
    if (j === 0) faces.push([a, c, d]);            // south pole cap (a = pole)
    else if (j === lats - 1) faces.push([a, b, d]); // north pole cap (d = pole)
    else faces.push([a, b, c, d]);
  }
  return faces;
}

// a faceted capped-cylinder ROD (the bond) from pA to pB, radius r, `sides` facets. Side quads
// only — the ends sit buried inside the two atom spheres, so no caps are needed. Each quad
// carries its outward radial normal for shading. Returns [] for a degenerate (coincident) bond.
function rodFaces(pA, pB, r, sides) {
  const axisV = sub(pB, pA), L = len(axisV);
  if (L < 1e-6 || r <= 0) return [];
  const dir = scl(axisV, 1 / L);
  let u = cross(dir, [0, 0, 1]);
  if (len(u) < 1e-4) u = cross(dir, [1, 0, 0]);   // bond parallel to z → pick another seed
  u = norm(u);
  const w = norm(cross(dir, u));
  const ring = (c) => Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * TAU;
    return add(c, add(scl(u, Math.cos(a) * r), scl(w, Math.sin(a) * r)));
  });
  const rA = ring(pA), rB = ring(pB), faces = [];
  for (let k = 0; k < sides; k++) {
    const k2 = (k + 1) % sides, mid = ((k + 0.5) / sides) * TAU;
    const n = norm(add(scl(u, Math.cos(mid)), scl(w, Math.sin(mid))));
    faces.push({ corners: [rA[k], rB[k], rB[k2], rA[k2]], normal: n });
  }
  return faces;
}

// ── bond rendering styles ──
export const BOND_STYLES = ['stick', 'split', 'line'];

// parallel-lane offsets for a multi-order σ/π bond (1 → centred, 2 → ±, 3 → 0 and ±).
const bondLanes = (order) => (order === 1 ? [0] : order === 2 ? [-1, 1] : [-1, 0, 1]);

// a direction ⟂ to the bond, for splitting parallel lanes apart in a plane.
function bondOffsetDir(p0, p1) {
  const ax = norm(sub(p1, p0));
  let off = cross(ax, [0, 0, 1]); if (len(off) < 1e-4) off = cross(ax, [1, 0, 0]);
  return norm(off);
}

// realize one bond as lit faces ({corners, fill}) per the chosen style. `a0`/`a1` are atoms
// (carry .pos + .color); `mid` is their midpoint; `tint` the resolved single-colour fill.
function bondStyleFaces(style, a0, a1, mid, { order, bondRadius, sides, tint, light }) {
  const out = [];
  const push = (rfaces, color) => { for (const rf of rfaces) out.push({ corners: rf.corners, fill: shadeHex(color, rf.normal, light) }); };

  const off = bondOffsetDir(a0.pos, a1.pos);
  const r = style === 'line' ? Math.max(0.025, bondRadius * 0.42) : bondRadius;
  const lanes = style === 'line' ? [0] : bondLanes(order);   // 'line' shows connectivity only
  const split = style === 'split' || style === 'line';        // half-coloured by the nearer atom
  const gap = r * 1.9;
  for (const lane of lanes) {
    const s = scl(off, lane * gap);
    const e0 = add(a0.pos, s), e1 = add(a1.pos, s), em = add(mid, s);
    if (split) { push(rodFaces(e0, em, r, sides), a0.color); push(rodFaces(em, e1, r, sides), a1.color); }
    else push(rodFaces(e0, e1, r, sides), tint);
  }
  return out;
}

// ── canonical frame: principal axes of the atom cloud (the principal axis is the dominant one). ──
const mulMV = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
function powerIter(M, seed, iters) {
  let v = norm(seed);
  for (let k = 0; k < iters; k++) { const nv = mulMV(M, v); const l = len(nv); if (l < 1e-12) break; v = scl(nv, 1 / l); }
  return v;
}
// covariance (symmetric 3×3) of the centred points.
function covariance(pts, c) {
  const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) {
    const d = sub(p, c);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i][j] += d[i] * d[j];
  }
  return M;
}
// returns { c, e1, e2, e3 } — centroid + an orthonormal right-handed basis whose e1 is the
// molecule's principal axis. Deterministic: fixed seeds, fixed iteration count, and the
// eigenvector signs are pinned by the extreme-projection atom (tie-break: lowest index).
function principalFrame(pts) {
  const c = centroid4(pts);
  if (pts.length < 2) return { c, e1: [0, 0, 1], e2: [1, 0, 0], e3: [0, 1, 0] };
  const M = covariance(pts, c);
  let e1 = powerIter(M, [0.3, 0.5, 0.81], 128);
  // deflate the dominant component, then iterate again for the second axis.
  const l1 = dot(e1, mulMV(M, e1));
  const M2 = M.map((row, i) => row.map((v, j) => v - l1 * e1[i] * e1[j]));
  let e2 = powerIter(M2, [0.81, 0.3, 0.5], 128);
  e2 = norm(sub(e2, scl(e1, dot(e2, e1))));        // re-orthogonalize against e1
  if (len(e2) < 1e-4) { e2 = norm(cross(e1, Math.abs(e1[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])); }
  // pin signs so mirror/flip ambiguity is resolved the same way every render.
  const pin = (e) => {
    let best = 0, bv = -Infinity;
    pts.forEach((p, i) => { const proj = dot(sub(p, c), e); if (proj > bv + 1e-9) { bv = proj; best = i; } });
    return dot(sub(pts[best], c), e) < 0 ? scl(e, -1) : e;
  };
  e1 = pin(e1); e2 = pin(e2);
  const e3 = norm(cross(e1, e2));
  return { c, e1, e2, e3 };
}

// place authored positions into the canonical frame: principal axis e1 → +Z (the primary spine),
// e2 → +X, e3 → +Y. `chirality < 0` flips the in-plane X handedness (a presentation mirror of
// the FRAME, not of the molecule — bond lengths/angles are untouched). orient:false → verbatim.
function orientPositions(positions, { orient, chirality }) {
  if (orient === false || positions.length < 2) return { positions, principalAxis: [0, 0, 1] };
  const { c, e1, e2, e3 } = principalFrame(positions);
  const xAxis = chirality < 0 ? scl(e2, -1) : e2;
  const placed = positions.map((p) => { const d = sub(p, c); return [dot(d, xAxis), dot(d, e3), dot(d, e1)]; });
  return { positions: placed, principalAxis: [0, 0, 1] };
}

// a slender square needle along the principal axis (z), past both extremes. Built unit-length
// then scaled to the molecule's span by the caller.
function axisNeedleFaces(half, w, hex) {
  const ring = [[w, w], [-w, w], [-w, -w], [w, -w]], faces = [];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % 4];
    faces.push({ corners: [[x0, y0, -half], [x1, y1, -half], [x1, y1, half], [x0, y0, half]], fill: hex });
  }
  return faces;
}

// the mandala graticule: latitude rings + meridian great circles around the principal axis, scaled to
// `R`. Flat unlit scaffold ribbons (an educational cage). Adapted from scene-planetary.
function mandalaFaces(R, segs, equatorHex, lineHex) {
  const faces = [];
  const ribbon = (pointAt, widen, half, hex) => {
    for (let s = 0; s < segs; s++) {
      const p0 = pointAt(s / segs), p1 = pointAt((s + 1) / segs);
      faces.push({ corners: [widen(p0, -half), widen(p1, -half), widen(p1, half), widen(p0, half)], fill: hex });
    }
  };
  for (const lat of [-60, -30, 0, 30, 60]) {
    const L = lat * Math.PI / 180, z = Math.sin(L) * R, rad = Math.cos(L) * R, eq = lat === 0;
    const pointAt = (t) => { const a = t * TAU; return [Math.cos(a) * rad, Math.sin(a) * rad, z]; };
    const widen = (p, e) => { const r = Math.hypot(p[0], p[1]) || 1; return [p[0] * (1 + e / r), p[1] * (1 + e / r), p[2]]; };
    ribbon(pointAt, widen, (eq ? 0.02 : 0.012) * R, eq ? equatorHex : lineHex);
  }
  for (let m = 0; m < 6; m++) {
    const phi = (m / 6) * Math.PI, cphi = Math.cos(phi), sphi = Math.sin(phi), nrm = [-sphi, cphi, 0];
    const pointAt = (t) => { const a = t * TAU, cc = Math.cos(a) * R, s = Math.sin(a) * R; return [cc * cphi, cc * sphi, s]; };
    const widen = (p, e) => add(p, scl(nrm, e));
    ribbon(pointAt, widen, 0.012 * R, lineHex);
  }
  return faces;
}

/**
 * Resolve a recipe into a placed face list + pick map + render params. Pure — no DB, no HTML.
 * Reused by the world route and by tests.
 *
 * @returns {{ faces, picks, atoms, bonds, bounds, principalAxis }}
 */
export function planMoleculeScene(recipeIn = {}) {
  // author-by-name / author-by-connectivity: resolve `library` or coordinate-less atoms into a recipe
  // whose atoms all carry numeric positions. Explicit-coordinate recipes pass through unchanged.
  const recipe = resolveMoleculeRecipe(recipeIn);
  const atomsIn = Array.isArray(recipe.atoms) ? recipe.atoms : [];
  const bondsIn = Array.isArray(recipe.bonds) ? recipe.bonds : [];
  if (atomsIn.length === 0) throw new Error('molecule-view requires at least one atom');

  const lod = LOD[recipe.lod] || LOD.default;
  const chirality = (+recipe.chirality < 0) ? -1 : 1;
  const bondStyle = BOND_STYLES.includes(recipe.bondStyle) ? recipe.bondStyle : 'stick';
  const ballScale = Number.isFinite(+recipe.ballScale) ? Math.max(0.1, +recipe.ballScale) : 0.42;
  const bondRadius = Number.isFinite(+recipe.bondRadius) ? Math.max(0.01, +recipe.bondRadius) : 0.08;

  // normalize atoms: a valid [x,y,z] position is required; symbol/colour/radius/label resolved.
  const rawPos = atomsIn.map((a, i) => {
    const p = a && Array.isArray(a.pos) ? a.pos : null;
    if (!p || p.length < 3 || !p.every((v) => Number.isFinite(+v))) {
      throw new Error(`atom ${i} needs a numeric pos [x,y,z]`);
    }
    return [+p[0], +p[1], +p[2]];
  });
  const { positions, principalAxis } = orientPositions(rawPos, { orient: recipe.orient, chirality });

  const atoms = atomsIn.map((a, i) => ({
    index: i,
    symbol: a.symbol != null ? String(a.symbol) : '?',
    pos: positions[i],
    label: a.label != null ? String(a.label) : `${a.symbol != null ? a.symbol : '?'}${i + 1}`,
    radius: Number.isFinite(+a.radius) ? Math.max(0.05, +a.radius) : elemRadius(a.symbol) * ballScale,
    color: /^#[0-9a-fA-F]{6}$/.test(a.color || '') ? a.color : elemColor(a.symbol),
    charge: a.charge,
    meta: a.meta && typeof a.meta === 'object' ? a.meta : {},
  }));

  // bounds (post-orient) drive the light direction, the camera framing, and the axis/mandala size.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const a of atoms) for (let k = 0; k < 3; k++) {
    mn[k] = Math.min(mn[k], a.pos[k] - a.radius); mx[k] = Math.max(mx[k], a.pos[k] + a.radius);
  }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const radius = 0.5 * Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  const bounds = { min: mn, max: mx, center, radius };

  // a 3/4 upper-front key light so the spheres read as round (lit hemisphere toward +x/+y/+z).
  const light = makeLight({ direction: norm([-0.4, -0.55, -0.72]), ambient: 0.46, diffuse: 0.92 });

  const faces = [], picks = [];

  // atoms → lit faceted spheres, one pickable sub-mesh (group) per atom.
  const sphereUnit = sphereUnitFaces(lod.longs, lod.lats);
  atoms.forEach((a) => {
    const name = `atom:${a.index}`;
    for (const unit of sphereUnit) {
      const corners = unit.map((u) => add(a.pos, scl(u, a.radius)));
      const n = norm(centroid4(unit));               // outward from the sphere centre
      faces.push({ corners, fill: shadeHex(a.color, n, light), group: name });
    }
    picks.push({
      name, kind: 'atom', index: a.index,
      label: a.label,
      fields: compactFields([['element', a.symbol], ['charge', formatCharge(a.charge)], ...Object.entries(a.meta)]),
    });
  });

  // bonds → lit geometry between atom centres, one pickable sub-mesh per bond. The bond STYLE
  // chooses the realization (stick / split / line); see bondStyleFaces.
  const bonds = bondsIn.map((b, bi) => {
    const from = b && Number.isInteger(b.from) ? b.from : -1;
    const to = b && Number.isInteger(b.to) ? b.to : -1;
    if (!atoms[from] || !atoms[to] || from === to) {
      throw new Error(`bond ${bi} references missing/identical atoms (${b && b.from}→${b && b.to})`);
    }
    const order = Math.max(1, Math.min(3, Math.round(+b.order) || 1));
    const a0 = atoms[from], a1 = atoms[to];
    const tint = /^#[0-9a-fA-F]{6}$/.test(b.tint || '') ? b.tint : blend(a0.color, a1.color);
    const name = `bond:${bi}`;
    const mid = scl(add(a0.pos, a1.pos), 0.5);
    for (const bf of bondStyleFaces(bondStyle, a0, a1, mid, { order, bondRadius, sides: lod.sides, tint, light })) {
      faces.push({ corners: bf.corners, fill: bf.fill, group: name });
    }
    picks.push({
      name, kind: 'bond', index: bi,
      label: `${a0.label}–${a1.label}`,
      fields: compactFields([['order', String(order)], ['style', bondStyle], ['length', `${len(sub(a1.pos, a0.pos)).toFixed(2)} Å`], ...Object.entries((b.meta && typeof b.meta === 'object') ? b.meta : {})]),
    });
    return { index: bi, from, to, order, tint };
  });

  // opt-in principal-axis needle + mandala scaffold (educational), scaled to the molecule span.
  if (recipe.axis) {
    for (const f of axisNeedleFaces(radius * 1.35, Math.max(0.02, radius * 0.012), '#a8c6e8')) {
      faces.push({ corners: f.corners.map((c) => add(center, c)), fill: f.fill, group: 'axis' });
    }
  }
  if (recipe.mandala) {
    for (const f of mandalaFaces(radius * 1.08, 48, '#7fc2ff', '#3f74ad')) {
      faces.push({ corners: f.corners.map((c) => add(center, c)), fill: f.fill, group: 'mandala' });
    }
  }

  return { faces, picks, atoms, bonds, bounds, principalAxis };
}

/**
 * Resolve a recipe into the emitThreeWorld payload (faces + pickable metadata + framing). The
 * world route calls this; emitThreeWorld renders it. Orbit-only — no walk, no CSS-3D /scene.
 */
export function assembleMoleculeScene(recipe = {}, { title } = {}) {
  const plan = planMoleculeScene(recipe);
  const { center, radius } = plan.bounds;
  // pull the camera back enough that an elongated molecule (principal axis rotated to vertical) clears
  // the narrower vertical frustum with margin — at 3.1× the long axis filled ~92% of frame and clipped.
  const d = Math.max(3.0, radius * 4.2);
  // three preset bookmarks: a 3/4 angle (default), broadside (down +Y), and end-on (down +Z).
  const cameras = [
    { name: 'angle', worldFraming: { cameraPosition: [center[0] + d * 0.8, center[1] - d * 0.9, center[2] + d * 0.55], lookAt: center, horizontalFov: 42 } },
    { name: 'broadside', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.25, center[2]], lookAt: center, horizontalFov: 42 } },
    { name: 'end-on', worldFraming: { cameraPosition: [center[0], center[1], center[2] + d * 1.3], lookAt: center, horizontalFov: 42 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0b1020';
  return {
    faces: plan.faces,
    picks: plan.picks,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || 'mojulo molecule',
    bg,
    glow: false,            // no emissive fixtures on a molecule
  };
}

// ── small formatting helpers (popup field rows) ──
function compactFields(pairs) {
  return pairs
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => ({ k: String(k), v: typeof v === 'object' ? JSON.stringify(v) : String(v) }));
}
function formatCharge(q) {
  if (!Number.isFinite(+q) || +q === 0) return '';
  const n = +q; return n > 0 ? `+${n}` : `${n}`;
}
// blend two #rrggbb hexes (bond inherits its endpoints' tint).
function blend(h0, h1) {
  const p = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const a = p(h0), b = p(h1);
  const c = (i) => Math.round((a[i] + b[i]) / 2).toString(16).padStart(2, '0');
  return `#${c(0)}${c(1)}${c(2)}`;
}
