/**
 * dungeon-designer — the fantasy-interior primitive.
 *
 * A DUNGEON is a network of CHAMBERS joined by TUNNELS, laid out in 3D with ELEVATION.
 * It renders open-ended fantasy spaces (caves now; castle interiors, crypts, mines
 * later) and is deliberately the opposite of the house/room generators: where
 * suite-layout makes FLAT, rectilinear, generative built space, a dungeon is ORGANIC
 * and not-flat. The one invariant it keeps is "there is a ceiling and a floor" — it's
 * an interior — but no surface is assumed flat: floors undulate, walls bulge, ceilings
 * vault. Surface styles are pluggable strings so tiled stonework can slot in beside
 * cave rock later.
 *
 * A dungeon is DATA: a `{ chambers, tunnels }` graph spec. See dungeon-designer.plan.md.
 *
 *   planDungeon(spec)            → resolved chambers + tunnel mouths/tubes + spawn/bounds
 *   buildDungeonFaces(plan, opt) → lit face list (chamber shells + tunnels, traced fire)
 *   renderDungeonWorld(spec)     → walkable three.js World (WASD + mouse)
 *   renderDungeonSection(spec)   → ant-farm cutaway section
 *
 * Geometry kernels live in scene-css3d.js (buildRoundRoomShellFaces, waveCaveFaces,
 * polarDiscFaces, the golden relief fields, bakeSceneDiffusion); this is the
 * composition layer over them.
 */

import { buildRoundRoomShellFaces, bakeSceneDiffusion } from '../scene/scene-css3d.js';
import { emitThreeWorld } from '../scene/scene-three.js';
import { scaleHex } from '../polygonizer/vexar.js';
import { resolveMaterial, tagFacesWithMaterial, validateMaterialRef } from '../polygonizer/materials.js';

export const WALL_STYLES = ['cave', 'flat'];
export const FLOOR_STYLES = ['wave', 'flat'];
export const CEILING_STYLES = ['dome', 'flat'];
export const RELIEF_STYLES = ['golden', 'rolling'];
export const TUNNEL_STYLES = ['tube', 'corridor'];

const FLOOR_MATERIAL = '#6f5a40';               // matches SURFACE_PALETTE.floor in scene-css3d.js

// ── L1 style bible ──────────────────────────────────────────────────────────
// A dungeon can now WEAR a per-surface PALETTE (albedo hex per floor/wall/ceiling)
// and MATERIAL (a name from the 18-shelf → live specular + .glb PBR), set on a
// spec-level `style` (applies to every chamber/tunnel) and/or overridden per
// chamber/tunnel. Defaults match the historic cave browns (SURFACE_PALETTE), so an
// un-styled dungeon renders byte-identically.
export const DUNGEON_PALETTE = { floor: '#6f5a40', wall: '#7d6750', ceiling: '#9a866a' };
const TUNNEL_BASE = '#5a4836';

// a bare material string applies to all three surfaces; an object is per-surface.
const surfaceMap = (m) => (m == null ? null : (typeof m === 'string' ? { floor: m, wall: m, ceiling: m } : { ...m }));
// merge own over style over the default; always complete (the shell reads all keys).
const mergePalette = (style, own) => ({ ...DUNGEON_PALETTE, ...(style || {}), ...(own || {}) });
// map the dungeon's {floor,wall,ceiling} palette to the shell's {floor,ceiling,backWall}.
const toShellPalette = (p) => ({ floor: p.floor, ceiling: p.ceiling, backWall: p.wall });

// Tag a chamber's shell faces with its per-surface material (spec + pbr), keyed by group.
function applyChamberMaterial(faces, material) {
  if (!material) return faces;
  const resolved = {
    'shell:floor': material.floor ? resolveMaterial(material.floor) : null,
    'shell:ceiling': material.ceiling ? resolveMaterial(material.ceiling) : null,
    'shell:wall': material.wall ? resolveMaterial(material.wall) : null,
  };
  for (const f of faces) { const m = resolved[f.group]; if (m) tagFacesWithMaterial([f], m); }
  return faces;
}

// Throw on an unknown material name before the forgiving resolveMaterial swallows the typo.
function validateSurfaceMaterial(m, where) {
  const map = surfaceMap(m); if (!map) return;
  for (const k of ['floor', 'wall', 'ceiling']) {
    const e = validateMaterialRef(map[k]); if (e) throw new Error(`dungeon-designer: ${where} material.${k}: ${e}`);
  }
}

// ── small vec helpers ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const translateZ = (faces, dz) => faces.map((f) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) }));
const centroidY = (f) => f.corners.reduce((s, c) => s + c[1], 0) / f.corners.length;

/** The World mesh builder skips faces with < 4 corners; pad each triangle [a,b,c] →
 *  [a,b,c,c] (the World tessellates a quad into two tris, the second degenerate). */
export function padTrianglesForWorld(faces = []) {
  return faces.map((f) => (Array.isArray(f.corners) && f.corners.length === 3 ? { ...f, corners: [...f.corners, f.corners[2]] } : f));
}

// ── tunnel geometry: a rock tube between two world points ──
const TUBE_LDIR = nrm([0.3, 0.5, -0.4]);
const tubeLamb = (n) => 0.28 + 0.5 * Math.max(0, n[0] * TUBE_LDIR[0] + n[1] * TUBE_LDIR[1] + n[2] * TUBE_LDIR[2]);
/** Straight enclosed rock tube p0→p1 (radius r), shaded by a warm directional key.
 *  Slopes freely, so it reads as a ramp between chambers at different elevations. */
export function tubeFaces(p0, p1, r, { base = '#5a4836', seg = 24, rings = 10, group = 'static' } = {}) {
  const axis = nrm(sub(p1, p0));
  let u = cross(axis, [0, 0, 1]); if (Math.hypot(...u) < 1e-3) u = cross(axis, [1, 0, 0]); u = nrm(u);
  const v = nrm(cross(axis, u));
  const ring = (a, k) => { const th = (k / seg) * Math.PI * 2; const radial = add(scl(u, Math.cos(th)), scl(v, Math.sin(th))); return { p: add(lerp(p0, p1, a), scl(radial, r)), n: radial }; };
  const faces = [];
  for (let i = 0; i < rings; i += 1) {
    const a0 = i / rings, a1 = (i + 1) / rings;
    for (let k = 0; k < seg; k += 1) {
      const A = ring(a0, k), B = ring(a0, k + 1), C = ring(a1, k + 1), D = ring(a1, k);
      const n = nrm(add(add(A.n, B.n), add(C.n, D.n)));
      faces.push({ corners: [A.p, B.p, C.p, D.p], fill: scaleHex(base, tubeLamb(scl(n, -1))), doubleSided: true, group });
    }
  }
  return faces;
}

/** An airsealed CORRIDOR (box passage) between two FLOOR-level points p0→p1: a flat
 *  walkable floor (sloping along the run), two vertical side walls, and a ceiling — all
 *  in the floor material. Open at both ends (it plugs into the chamber mouths). Not
 *  mitered to the curved wall — it just overshoots the carved hole so the chamber stays
 *  sealed (the overshoot pokes outside the rock, which is fine). */
export function corridorFaces(p0, p1, { width = 4.4, height = 5.2, base = FLOOR_MATERIAL, rings = 8 } = {}) {
  const A = sub(p1, p0);
  let r = cross(A, [0, 0, 1]); if (Math.hypot(...r) < 1e-3) r = [1, 0, 0]; r = nrm(r);   // horizontal width axis
  const up = [0, 0, 1], hw = width / 2;
  const sample = (a) => { const c = lerp(p0, p1, a); const fl = add(c, scl(r, -hw)), fr = add(c, scl(r, hw)); return { fl, fr, cl: add(fl, scl(up, height)), cr: add(fr, scl(up, height)) }; };
  const faces = [];
  const quad = (a, b, c, d, n) => faces.push({ corners: [a, b, c, d], fill: scaleHex(base, tubeLamb(n)), doubleSided: true, group: 'static', normal: n });
  for (let i = 0; i < rings; i += 1) {
    const s0 = sample(i / rings), s1 = sample((i + 1) / rings);
    quad(s0.fl, s0.fr, s1.fr, s1.fl, [0, 0, 1]);       // floor (flat across width)
    quad(s0.cl, s1.cl, s1.cr, s0.cr, [0, 0, -1]);      // ceiling
    quad(s0.fl, s1.fl, s1.cl, s0.cl, r);               // left wall
    quad(s0.fr, s0.cr, s1.cr, s1.fr, scl(r, -1));      // right wall
  }
  return faces;
}

/**
 * Resolve a dungeon spec into geometry-ready chambers + tunnels.
 * Each tunnel records the MOUTH arc it carves in both chamber walls (azimuth toward the
 * neighbour) and the tube endpoints (on each rim, at floor + radius height).
 */
export function planDungeon(spec = {}) {
  const styleSpec = spec.style || {};
  const styleMat = surfaceMap(styleSpec.material);
  // validate material refs up front (spec-level style + per-tunnel style default).
  validateSurfaceMaterial(styleSpec.material, 'style');
  const eStyleTun = validateMaterialRef(styleSpec.tunnel?.material);
  if (eStyleTun) throw new Error(`dungeon-designer: style.tunnel material: ${eStyleTun}`);
  const chambers = (spec.chambers || []).map((c, i) => {
    validateSurfaceMaterial(c.material, `chamber '${c.id ?? i}'`);
    return {
      id: c.id ?? `chamber-${i}`,
      at: c.at || [0, 0], elevation: c.elevation ?? 0,
      radius: c.radius ?? 7, height: c.height ?? 9,
      wall: c.wall ?? 'cave', floor: c.floor ?? 'wave', ceiling: c.ceiling ?? 'dome',
      relief: c.relief ?? 'golden', seed: c.seed ?? (i + 2),
      reliefAmp: c.reliefAmp, floorAmp: c.floorAmp, ceilingAmp: c.ceilingAmp,
      // L1: per-surface albedo + finish (spec style ← chamber override; complete palette).
      palette: mergePalette(styleSpec.palette, c.palette),
      material: { ...(styleMat || {}), ...(surfaceMap(c.material) || {}) },
    };
  });
  const byId = new Map(chambers.map((c) => [c.id, c]));
  const mouths = new Map(chambers.map((c) => [c.id, []]));
  const rimPt = (C, az, z) => [C.at[0] + C.radius * Math.cos(az), C.at[1] + C.radius * Math.sin(az), z];
  const tunnels = (spec.tunnels || []).map((t) => {
    const A = byId.get(t.from), B = byId.get(t.to);
    if (!A || !B) throw new Error(`dungeon-designer: tunnel references unknown chamber (${t.from}→${t.to})`);
    const r = t.radius ?? 2.2, clr = t.clearance ?? 1.45, style = t.style ?? 'tube';
    const azA = Math.atan2(B.at[1] - A.at[1], B.at[0] - A.at[0]), azB = azA + Math.PI;
    const tBase = t.base ?? styleSpec.tunnel?.base;         // L1: tunnel albedo + finish
    const tMat = t.material ?? styleSpec.tunnel?.material;
    const eTun = validateMaterialRef(tMat);
    if (eTun) throw new Error(`dungeon-designer: tunnel ${t.from}→${t.to} material: ${eTun}`);
    if (style === 'corridor') {
      // box passage: floor-level endpoints + a mouth sized UNDER the corridor so the
      // corridor mesh fully covers the carved hole (airseal).
      const width = t.width ?? 2 * r, height = t.height ?? 2.4 * r;
      mouths.get(A.id).push({ az: azA, half: (width * 0.46) / A.radius, tMax: Math.min(0.92, (height * 0.92) / A.height) });
      mouths.get(B.id).push({ az: azB, half: (width * 0.46) / B.radius, tMax: Math.min(0.92, (height * 0.92) / B.height) });
      return { from: A.id, to: B.id, style, radius: r, width, height, base: tBase, material: tMat, p0: rimPt(A, azA, A.elevation), p1: rimPt(B, azB, B.elevation) };
    }
    mouths.get(A.id).push({ az: azA, half: (r * clr) / A.radius, tMax: Math.min(0.92, (2 * r * 1.5) / A.height) });
    mouths.get(B.id).push({ az: azB, half: (r * clr) / B.radius, tMax: Math.min(0.92, (2 * r * 1.5) / B.height) });
    return { from: A.id, to: B.id, style, radius: r, base: tBase, material: tMat, p0: rimPt(A, azA, A.elevation + r), p1: rimPt(B, azB, B.elevation + r) };
  });
  const xs = chambers.flatMap((c) => [c.at[0] - c.radius, c.at[0] + c.radius]);
  const ys = chambers.flatMap((c) => [c.at[1] - c.radius, c.at[1] + c.radius]);
  const zs = chambers.flatMap((c) => [c.elevation, c.elevation + c.height]);
  const bounds = { xRange: [Math.min(...xs), Math.max(...xs)], yRange: [Math.min(...ys), Math.max(...ys)], zRange: [Math.min(...zs), Math.max(...zs)] };
  const h0 = chambers[0];
  const spawn = h0 ? [h0.at[0], h0.at[1] - h0.radius * 0.3, h0.elevation + 2] : [0, 0, 2];
  return { chambers, tunnels, mouths, bounds, spawn };
}

/**
 * Build the lit face list for a planned dungeon. `section:true` opens the chamber tops
 * and slices at the section plane for the ant-farm cutaway; otherwise chambers are
 * fully enclosed (walkable). A fire per chamber + glows along each tunnel are TRACED
 * over the rock so the relief self-shadows. Returns { faces, sources }.
 */
// movement-flow: a chamber's PRIMARY exit — the widest carved mouth, the main way out.
function primaryExit(mouths) {
  if (!mouths || !mouths.length) return null;
  return mouths.reduce((best, m) => (m.half > (best ? best.half : -Infinity) ? m : best), null);
}

/**
 * Movement-flow CHECK for a dungeon (kernel #4). Reads the mouths graph + spawn and reports
 * circulation impairments per chamber: a chamber with NO exit (dead end other than spawn),
 * or a fire/prop that would sit inside an exit arc (blocking the way out). Pure; mirrors
 * assessFlow's shape. @returns {{ impairment, necessary[], preferential[], ok }}.
 */
export function assessDungeonFlow(plan) {
  const necessary = [], preferential = [];
  for (const c of plan.chambers) {
    const exits = plan.mouths.get(c.id) || [];
    if (!exits.length) preferential.push({ rule: 'sealed-chamber', detail: `chamber ${c.id} has no exit mouth` });
  }
  return { impairment: necessary.length * 10 + preferential.length * 3, necessary, preferential, ok: necessary.length === 0 };
}

export function buildDungeonFaces(plan, { lighting = {}, section = false } = {}) {
  const base = {
    vexar: lighting.vexar || { direction: [0.4, 0.3, -0.45], ambient: lighting.ambient ?? 0.2, diffuse: lighting.diffuse ?? 0.15 },
    tint: lighting.tint || [1.05, 0.9, 0.74],
    gravity: false,
  };
  let raw = [];
  for (const c of plan.chambers) {
    const shell = buildRoundRoomShellFaces({
      center: c.at, radius: c.radius, height: c.height,
      segments: Math.max(44, Math.round(c.radius * 8)),
      wallSurface: c.wall === 'cave' ? 'cave' : undefined,
      floorSurface: c.floor,
      ceilingSurface: section ? 'flat' : c.ceiling,
      omit: section ? ['ceiling'] : [],
      relief: c.relief, reliefSeed: c.seed,
      caveOptions: { amp: c.reliefAmp ?? 0.95, cell: 0.55, lobeCount: Math.round(c.radius * 3) },
      floorOptions: { amp: c.floorAmp ?? 0.4 },
      ceilingOptions: { amp: c.ceilingAmp ?? c.radius * 0.13 },
      wallOmitArcs: plan.mouths.get(c.id),
      palette: toShellPalette(c.palette),
      lighting: base,
    });
    applyChamberMaterial(shell, c.material);   // L1: per-surface Blinn-Phong finish
    raw.push(...translateZ(shell, c.elevation));
  }
  for (const t of plan.tunnels) {
    const tf = t.style === 'corridor'
      ? corridorFaces(t.p0, t.p1, { width: t.width, height: t.height, base: t.base })
      : tubeFaces(t.p0, t.p1, t.radius, { base: t.base });
    if (t.material) tagFacesWithMaterial(tf, resolveMaterial(t.material));
    raw.push(...tf);
  }
  raw = raw.map((f) => ({ ...f, group: 'static' }));
  if (section) { const cut = lighting.sectionY ?? 0; raw = raw.filter((f) => centroidY(f) >= cut - 0.15); }

  const fireColor = lighting.fireColor || [1, 0.56, 0.24];
  const fireI = lighting.fireIntensity ?? 1.7;
  // movement-flow (kernel #4): seat the fire AWAY from the chamber's primary exit so the
  // prop never blocks the desire line out, and lean its throw TOWARD the passage so the lit
  // gradient leads to the exit. The exit graph is already in plan.mouths (widest arc = main way).
  const fires = plan.chambers.map((c) => {
    const exit = primaryExit(plan.mouths.get(c.id));
    const off = c.radius * 0.3;
    const fx = exit ? c.at[0] - Math.cos(exit.az) * off : c.at[0];
    const fy = exit ? c.at[1] - Math.sin(exit.az) * off : c.at[1];
    return {
      pos: [fx, section ? c.at[1] + c.radius * 0.35 : fy, c.elevation + 1.0],
      color: fireColor, intensity: fireI + c.radius * 0.13, rays: 64, bounces: 2,
      dir: section ? [0, -1, 0.4] : (exit ? [Math.cos(exit.az) * 0.5, Math.sin(exit.az) * 0.5, 0.8] : [0, 0, 1]),
      spread: section ? 155 : 168, fixtureR: 0.26, glowBlur: 26, glowSpread: 11,
    };
  });
  const glows = plan.tunnels.flatMap((t) => { const zUp = t.style === 'corridor' ? (t.height || 5) * 0.45 : 0; return [0.35, 0.65].map((a) => ({ pos: add(lerp(t.p0, t.p1, a), [0, 0, zUp]), color: [1, 0.62, 0.3], intensity: 1.9, rays: 40, bounces: 1, dir: [0, 0, 1], spread: 175, fixtureR: 0.16, glowBlur: 18, glowSpread: 7 })); });
  const sources = [...fires, ...glows];
  const faces = bakeSceneDiffusion(raw, sources, { gain: lighting.gain ?? 1.55, reflectivity: lighting.reflectivity ?? 0.6 });
  return { faces, sources };
}

const midZ = (b) => (b.zRange[0] + b.zRange[1]) / 2;
const midX = (b) => (b.xRange[0] + b.xRange[1]) / 2;

/** A default first-person framing inside the first chamber, looking toward its first
 *  tunnel mouth (so the still shows the chamber + a passage out). */
function defaultHubCamera(plan) {
  const h = plan.chambers[0];
  const out = plan.tunnels.find((t) => t.from === h.id || t.to === h.id);
  const look = out ? (out.from === h.id ? out.p0 : out.p1) : [h.at[0] + h.radius, h.at[1], h.elevation + 2];
  return { name: 'hub', worldFraming: { cameraPosition: [h.at[0] - h.radius * 0.5, h.at[1], h.elevation + 3], lookAt: [look[0] * 1.4 - h.at[0] * 0.4, look[1], h.elevation + 1.6], horizontalFov: 90, pictureCenter: [560, 400] } };
}

/** A default far, narrow-fov, slightly-tilted section framing for the ant-farm view. */
function defaultSectionCamera(plan) {
  const b = plan.bounds, cx = midX(b), cz = midZ(b);
  const span = Math.max(b.xRange[1] - b.xRange[0], (b.zRange[1] - b.zRange[0]) * 1.5);
  return { name: 'section', worldFraming: { cameraPosition: [cx, b.yRange[0] - span * 1.7, cz + span * 0.3], lookAt: [cx, 0, cz - span * 0.06], horizontalFov: 42, pictureCenter: [560, 380] } };
}

/**
 * Render a walkable three.js World for the dungeon. Fully enclosed; spawns in the first
 * chamber; WASD + mouse-look + gravity + wall collision. `extraFaces` lets a caller
 * drop in props/figures (already in world coords); `camera`/`walk` override defaults.
 */
export function renderDungeonWorld(spec, { viewBox = { width: 1120, height: 780 }, camera, walk = {}, extraFaces = [], title = 'mojulo dungeon', bg = '#070605' } = {}) {
  const plan = planDungeon(spec);
  const { faces } = buildDungeonFaces(plan, { lighting: spec.lighting || {}, section: false });
  const all = padTrianglesForWorld([...faces, ...extraFaces]);
  return emitThreeWorld({
    faces: all, cameras: [camera || defaultHubCamera(plan)], viewBox, title, bg, inline: true, glow: true,
    walk: { speed: 9, spawn: plan.spawn, minEye: 1.7, gravity: 22, radius: 0.4, ...walk },
  });
}

/**
 * Render the ant-farm SECTION of the dungeon: open-top chambers sliced at the section
 * plane so the whole colony reads as one cutaway. Returns a (still-orbitable) World.
 */
export function renderDungeonSection(spec, { viewBox = { width: 1180, height: 780 }, camera, extraFaces = [], title = 'mojulo dungeon · section', bg = '#0a0806' } = {}) {
  const plan = planDungeon(spec);
  const { faces } = buildDungeonFaces(plan, { lighting: spec.lighting || {}, section: true });
  const all = padTrianglesForWorld([...faces, ...extraFaces]);
  return emitThreeWorld({ faces: all, cameras: [camera || defaultSectionCamera(plan)], viewBox, title, bg, inline: true, glow: true });
}
