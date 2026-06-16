/**
 * scene-css3d — emit mojulo world geometry as a live, dependency-free CSS
 * `preserve-3d` HTML scene (the "second backend" alongside the SVG renderers).
 *
 * The SVG renderers flatten world geometry to 2D via projectTwoPoint. This keeps
 * it 3D: every planar face becomes a positioned `<div>` (one `matrix3d`), the
 * camera becomes a `matrix3d` + `perspective`, and the browser does projection +
 * occlusion + a movable camera. Output is one self-contained HTML string — no
 * runtime dependency, plays anywhere an <img>/<iframe> goes.
 *
 * Eligibility (caller's responsibility): planar faces, non-interpenetrating,
 * separated, under a face budget. Ineligible scenes (organic/curved/inter-
 * penetrating/per-pixel-lit-while-rotating) belong on the baked forge_motion path.
 *
 * Scope today: the ROOM scene, consumed from the clean world-space planner
 * (resolveRoomSceneElementPlan / resolveRoomSurfaces), which exposes 3D corners
 * without projection. Wiring production two-point room manji-trees needs a
 * world-geometry accessor factored out of neo-rembrandt's generateTwoPointRoomMarks
 * (which projects inline) — see SCOPE notes.
 *
 * Lighting: vexar Lambert is baked per face. Correct for translating (walk-through)
 * cameras — Lambert depends on the face normal vs the world light, not the camera.
 */

import { makeLight, litFactor, scaleHex, hexToRgb, rgbToHex } from './polygonizer/vexar.js';
import {
  resolveRoomSurfaces,
  resolveRoomSceneElementPlan,
} from './polygonizer/room-scene-elements.js';
import { planArchitectureMandala } from './polygonizer/architecture-mandala-planner.js';
import { getFurnitureNet, getFurnitureFaceCard } from './polygonizer/furniture-cards.js';
import { bakeDiffusion3d, applyDiffusion, bakeDiffusionField, applyDiffusionSoft, emissiveFixture } from './light-diffusion-3d.js';
import { makeFacade, facadeCss, facadeHtml, facadeFloors, facadeBays, buildingExtras } from './building-facade.js';
import { buildFacadeCard } from './facade-card.js';
import { buildTerrainWorldMesh } from './polygonizer/painted-landscape.js';
import { skyCss } from './sky-css.js';

// ── vector helpers ──────────────────────────────────────────────────────────
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const centroid = (pts) => scale(pts.reduce((acc, p) => add(acc, p), [0, 0, 0]), 1 / pts.length);

/** Face normal from 4 coplanar corners, flipped to point toward `towardPt`. */
function normalToward(corners, towardPt) {
  let n = norm(cross(sub(corners[1], corners[0]), sub(corners[2], corners[0])));
  if (towardPt && dot(n, sub(towardPt, centroid(corners))) < 0) n = scale(n, -1);
  return n;
}

/**
 * Reorder a quad's winding so the emitter's front face (local z = U×V, where
 * U=c1-c0, V=c3-c0) points toward `towardPt`. Without this a back-wall decal's
 * front points away from the room and `backface-visibility:hidden` culls it.
 */
function windToward(corners, towardPt) {
  const n = cross(sub(corners[1], corners[0]), sub(corners[3], corners[0]));
  if (dot(n, sub(towardPt, centroid(corners))) < 0) return [corners[0], corners[3], corners[2], corners[1]];
  return corners;
}

// ── matrix3d builders ────────────────────────────────────────────────────────
const m3d = (c) => `matrix3d(${c.map((n) => n.toFixed(5)).join(',')})`;

/** A plane div placed in world: local x→u, local y→v, local z→normal, origin at c0. */
function planeMatrix(c0, uVec, vVec, unitScale) {
  const U = norm(uVec), V = norm(vVec), n = cross(U, V), o = scale(c0, unitScale);
  return m3d([U[0], U[1], U[2], 0, V[0], V[1], V[2], 0, n[0], n[1], n[2], 0, o[0], o[1], o[2], 1]);
}

/**
 * World→view camera matrix from a `worldFraming` (cameraPosition/lookAt/horizontalFov),
 * baking the perspective-prep so the ancestor `perspective:focal` does the divide.
 * z-up world. Returns { matrix, perspective, center }.
 */
export function cameraMatrixFromWorldFraming(worldFraming = {}, viewBox = {}, unitScale = 1) {
  const pos = worldFraming.cameraPosition || [0, -10, 4];
  const look = worldFraming.lookAt || [0, 0, 2];
  const fov = Number(worldFraming.horizontalFov) || 60;
  const W = Number(viewBox.width) || 1080;
  const H = Number(viewBox.height) || 720;
  // Match projectTwoPointPinhole's basis exactly: right = worldUp × forward,
  // up = forward × right (a flipped right axis mirrors the scene).
  const f = norm(sub(look, pos));
  const r = norm(cross([0, 0, 1], f));
  const u = cross(f, r);
  const focal = (W / 2) / Math.tan((fov * Math.PI / 180) / 2);
  const p = scale(pos, unitScale);
  const cols = [
    r[0], -u[0], -f[0], 0,
    r[1], -u[1], -f[1], 0,
    r[2], -u[2], -f[2], 0,
    -dot(r, p), dot(u, p), focal + dot(f, p), 1,
  ];
  const center = Array.isArray(worldFraming.pictureCenter) ? worldFraming.pictureCenter : [W / 2, H / 2];
  return { matrix: m3d(cols), perspective: focal, center };
}

// ── room scene → planar faces ─────────────────────────────────────────────────
const SURFACE_PALETTE = {
  floor: '#6f5a40', ceiling: '#9a866a', backWall: '#7d6750', leftWall: '#8a7058', rightWall: '#705a44',
};
const LEG_HEX = '#7a5b33';

const surfaceCorners = (s) => [s.origin, add(s.origin, s.uVector), add(s.origin, add(s.uVector, s.vVector)), add(s.origin, s.vVector)];
const bilerp = (c, u, v) => [
  c[0][0] * (1 - u) * (1 - v) + c[1][0] * u * (1 - v) + c[2][0] * u * v + c[3][0] * (1 - u) * v,
  c[0][1] * (1 - u) * (1 - v) + c[1][1] * u * (1 - v) + c[2][1] * u * v + c[3][1] * (1 - u) * v,
  c[0][2] * (1 - u) * (1 - v) + c[1][2] * u * (1 - v) + c[2][2] * u * v + c[3][2] * (1 - u) * v,
];
const isHex = (s) => /^#[0-9a-fA-F]{6}$/.test(String(s));

// Gravity contact-shadow — the world-z attenuation of the lit factor, ported
// verbatim from imperfect-cel.js's gravityLambertOffset: full GRAVITY_DARKEN_AMOUNT
// at the scene base (z=0), ramping to 0 by GRAVITY_DARKEN_HEIGHT. It depends only on
// world-z (not the camera), so baking it per face is correct for a translating
// (walk-through) camera — exactly like vexar Lambert. The renderer subtracts this
// from each face's lit factor (max(0, lambert − offset)), so a piece reads darker
// at its base. Per-part z gives tall furniture a real bottom-to-top gradient.
const GRAVITY_DARKEN_HEIGHT = 5.0, GRAVITY_DARKEN_AMOUNT = 0.20, LAMBERT_GAIN = 0.78;
function gravityOffset(z, sceneBaseZ = 0) {
  const h = z - sceneBaseZ;
  const amount = h >= GRAVITY_DARKEN_HEIGHT ? 0 : h <= 0 ? GRAVITY_DARKEN_AMOUNT : (1 - h / GRAVITY_DARKEN_HEIGHT) * GRAVITY_DARKEN_AMOUNT;
  return amount / LAMBERT_GAIN;
}
const centroidZ = (corners) => corners.reduce((a, c) => a + c[2], 0) / corners.length;

/**
 * Composited baked lighting. vexar's directional Lambert (ambient + diffuse·N·L)
 * gives each volume its DIRECTIONAL mood; `tint` colours it (warm bar / cool
 * daylight); `lamps` add POSITIONED point-lights (Lambert · inverse-square
 * falloff) — the local pools vexar deliberately omits. All terms depend on world
 * geometry only → camera-independent → bakeable, so the look stays correct as the
 * camera moves between stations (the same property that lets vexar bake at all).
 * Returns a closure shade(baseHex, corners, normal) → lit hex.
 */
function makeShade({ light, lamps = [], tint = [1, 1, 1], gravityDarken = true } = {}) {
  const L = light || makeLight({ direction: [0.32, 0.42, -0.84], ambient: 0.58, diffuse: 0.56 });
  const grav = gravityDarken ? gravityOffset : () => 0;
  return (baseHex, corners, normal) => {
    if (!isHex(baseHex)) return baseHex;
    const f = Math.max(0, litFactor(normal, L) - grav(centroidZ(corners)));
    const rgb = hexToRgb(baseHex);
    let r = rgb[0] * tint[0] * f, g = rgb[1] * tint[1] * f, b = rgb[2] * tint[2] * f;
    if (lamps.length) {
      const c = centroid(corners);
      for (const lamp of lamps) {
        const to = sub(lamp.pos, c), d2 = dot(to, to) || 1e-6;
        const at = (lamp.intensity ?? 1) * Math.max(0, dot(normal, norm(to))) / (1 + (lamp.k ?? 0.05) * d2);
        const col = lamp.color || [1, 1, 1];
        r += rgb[0] * col[0] * at; g += rgb[1] * col[1] * at; b += rgb[2] * col[2] * at;
      }
    }
    return rgbToHex([r, g, b]);
  };
}

/**
 * The unified room LIGHTING model. One declarative object carries every layered
 * term; `resolveLighting` normalizes it (and the legacy positional params) into
 * resolved pieces the bakers consume:
 *   { vexar:{direction,ambient,diffuse} | light, tint:[r,g,b], gravity:bool,
 *     lamps:[{at|pos, color, intensity, k}],            // direct, scoped point lights
 *     sources:[{at|pos, height, dir, spread, color, intensity, rays, bounces,
 *               falloff, exposure, fixture, stem, ...}], // TRACED diffusion emitters
 *     diffusion:{ gain, reflectivity } }
 * `at:[fx,fy]`/`height` are fractions of the room footprint/ceiling (explicit `pos`
 * wins), so a lamp or source is authored in the same mandala space as furniture.
 */
function resolveLighting(lighting = {}, ranges = {}) {
  const [x0, x1] = ranges.xRange || [0, 1];
  const [y0, y1] = ranges.yRange || [0, 1];
  const z1 = (ranges.zRange || [0, 1])[1];
  const toWorld = (e) => (Array.isArray(e.pos) ? e.pos : [x0 + (e.at?.[0] ?? 0.5) * (x1 - x0), y0 + (e.at?.[1] ?? 0.5) * (y1 - y0), z1 * (e.height ?? 0.965)]);
  return {
    L: lighting.light || makeLight(lighting.vexar || {}),
    tint: lighting.tint || [1, 1, 1],
    gravity: lighting.gravity ?? lighting.gravityDarken ?? true,
    lamps: (lighting.lamps || []).map((l) => ({ ...l, pos: toWorld(l) })),
    sources: (lighting.sources || []).map((s) => ({ ...s, pos: toWorld(s) })),
    diffusion: lighting.diffusion || {},
  };
}

/** Bake the traced 3D light diffusion over `faces` for `sources`, returning the lit
 *  faces plus each visible source's emissive fixture. Shared by the single-room path
 *  (local bake) and the suite (one bake across all volumes → cross-room spill).
 *  `diffusion.soft` switches the flat per-face value for a soft radial-gradient pool
 *  (blurred edges, smooth spread); `softness`/`maxAlpha` tune it. */
export function bakeSceneDiffusion(faces, sources = [], diffusion = {}) {
  if (!sources.length) return faces;
  const { reflectivity = 0.45, soft = false, softness = 1, maxAlpha = 0.9, shadows = false, shadowStrength = 0.9, shadowMaxAlpha = 0.6 } = diffusion;
  const gain = diffusion.gain ?? (soft ? 2.6 : 1.2);
  let lit;
  if (soft) {
    const field = bakeDiffusionField({ faces, sources, reflectivity, shadows });
    lit = applyDiffusionSoft(faces, field, { gain, softness, maxAlpha, shadowStrength, shadowMaxAlpha });
  } else {
    lit = applyDiffusion(faces, bakeDiffusion3d({ faces, sources, reflectivity }), { gain });
  }
  for (const s of sources) if (s.fixture !== false) lit.push(...emissiveFixture(s, { r: s.fixtureR ?? 0.18 }));
  return lit;
}

/**
 * Moonlight: a cool DIRECTIONAL fill from the moon, added to the base shading so
 * surfaces aligned with the moon (rooftops, the moon-facing sides) catch a blue
 * sheen while the rest stays dark — the cool counterpart to the warm streetlamp
 * pools. `dir` is the light's travel direction (from the moon); the moon's sky
 * position and this should agree. Applied BEFORE the diffusion bake (it's base
 * light); hex-fill faces gain colour, CSS-`bg` faces (facades) get a translucent
 * cool wash whose strength tracks the face's alignment with the moon.
 */
export function applyMoonlight(faces, { dir = [-0.4, -0.28, -0.85], color = [0.58, 0.69, 0.95], intensity = 0.6, ambient = 0.08 } = {}) {
  const toMoon = norm([-dir[0], -dir[1], -dir[2]]);
  const c255 = color.map((c) => Math.round(c * 255));
  return faces.map((f) => {
    const c = f.corners, n = norm(cross(sub(c[1], c[0]), sub(c[3] || c[2], c[0])));
    const k = ambient + intensity * Math.abs(dot(n, toMoon)); // abs → winding-agnostic; rooftops/moon-axis faces read brightest
    if (typeof f.fill === 'string' && f.fill[0] === '#') {
      const b = hexToRgb(f.fill);
      return { ...f, fill: rgbToHex([0, 1, 2].map((i) => Math.min(255, b[i] + c255[i] * k))) };
    }
    if (typeof f.bg === 'string') {
      // multiply-style cool tint: a DARK moonlit-blue layer whose opacity grows as the
      // face turns AWAY from the moon (low k). Moon-facing walls keep their facade colour
      // with a cool sheen; shadowed walls sink toward deep blue — relative hue preserved,
      // unlike a flat bright wash (which desaturated every facade toward the same grey-blue).
      const a = Math.min(0.62, 0.1 + (1 - Math.min(1, k)) * 0.62);
      const dark = `rgba(${Math.round(color[0] * 74)},${Math.round(color[1] * 88)},${Math.round(color[2] * 122)},${a.toFixed(3)})`;
      return { ...f, bg: `linear-gradient(${dark},${dark}), ${f.bg}` };
    }
    return f;
  });
}

/**
 * Contact / ambient-occlusion shadows: a soft dark radial blob laid on the floor
 * DIRECTLY UNDER each elevated piece, there regardless of any light (the seat/top
 * occludes the ambient hemisphere from the floor beneath it). One decal per object,
 * sized to its footprint and fading with height — so multiple objects keep distinct
 * under-shadows instead of blending into one pool. The complement of the directional
 * cast shadow (which lands beside/past the object).
 * @param {Array} footprints  [{ corners: <floor quad>, height }]
 */
export function contactShadowDecals(footprints = [], { strength = 0.5, expand = 1.35, maxAlpha = 0.6 } = {}) {
  return footprints.map(({ corners, height }) => {
    const c = centroid(corners);
    const quad = corners.map((p) => [c[0] + (p[0] - c[0]) * expand, c[1] + (p[1] - c[1]) * expand, 0.02]);
    const a = Math.min(maxAlpha, strength / (1 + (height || 0) * 0.6));
    const bg = `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,${a.toFixed(3)}) 0%, rgba(0,0,0,${(a * 0.45).toFixed(3)}) 42%, rgba(0,0,0,0) 80%)`;
    return { corners: quad, bg, doubleSided: true };
  });
}

/**
 * Render one furniture face-card (furniture-cards.js `parts[]` grammar) onto a
 * world-space quad as coplanar sub-faces — the CSS-3D twin of furniture-net.js's
 * partToMarks, but emitting world faces (the browser projects) instead of screen
 * polygons. `outward` is the face's unit normal; parts are nudged a hair along it
 * so they win the z-sort, and lit per-part by the volume's `shade` closure (so a
 * tall piece darkens toward its base and catches nearby lamps). Faces a card
 * leaves unpainted stay absent → legs show through an apron.
 */
function cardFaces(card, quad, outward, shade) {
  if (!card || !Array.isArray(card.parts)) return [];
  const out = [];
  const W = (u, v) => add(bilerp(quad, u, v), scale(outward, 0.012));
  const sc = (hex, corners) => shade(hex, corners, outward);
  const uLen = len(sub(quad[1], quad[0])) || 1, vLen = len(sub(quad[3], quad[0])) || 1;
  const rect = (u0, v0, u1, v1, fill, clip) => { const c = [W(u0, v0), W(u1, v0), W(u1, v1), W(u0, v1)]; out.push({ corners: c, fill: sc(fill, c), doubleSided: true, ...(clip ? { clip } : {}) }); };
  for (const part of card.parts) {
    const fill = part.fill || part.stroke;
    if (!fill) continue;
    switch (part.kind) {
      case 'band': rect(0, part.v, 1, part.v + part.h, fill); break;
      case 'rect': rect(part.u, part.v, part.u + part.w, part.v + part.h, fill); break;
      case 'repeat': {
        const span = part.u1 - part.u0, gap = part.gap ?? 0;
        const w = part.w ?? (span - gap * (part.count - 1)) / part.count;
        const step = part.count > 1 ? (span - w) / (part.count - 1) : 0;
        for (let i = 0; i < part.count; i += 1) {
          const u0 = part.u0 + i * step;
          const f = Array.isArray(part.fills) ? part.fills[i % part.fills.length] : fill;
          rect(u0, part.v, u0 + w, part.v + part.h, f);
        }
        break;
      }
      case 'line': {                              // thin quad along the segment
        const dx = part.u1 - part.u0, dy = part.v1 - part.v0, l = Math.hypot(dx, dy) || 1;
        const hw = (part.strokeWidth || 1) * 0.004, px = (-dy / l) * hw, py = (dx / l) * hw;
        const c = [W(part.u0 + px, part.v0 + py), W(part.u1 + px, part.v1 + py), W(part.u1 - px, part.v1 - py), W(part.u0 - px, part.v0 - py)];
        out.push({ corners: c, fill: sc(part.stroke || fill, c), doubleSided: true });
        break;
      }
      case 'circle': {                            // bbox quad + elliptical clip
        const du = (part.r * vLen) / uLen;
        rect(part.u - du, part.v - part.r, part.u + du, part.v + part.r, fill, 'ellipse(50% 50%)');
        break;
      }
      case 'poly': {                              // bbox quad + polygon clip
        const us = part.points.map((p) => p.u), vs = part.points.map((p) => p.v);
        const u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
        const clip = `polygon(${part.points.map((p) => `${(((p.u - u0) / ((u1 - u0) || 1)) * 100).toFixed(1)}% ${(((p.v - v0) / ((v1 - v0) || 1)) * 100).toFixed(1)}%`).join(', ')})`;
        rect(u0, v0, u1, v1, fill, clip);
        break;
      }
      default: break;
    }
  }
  return out;
}

/**
 * Extract the room as a flat list of vexar-shaded planar faces in world space.
 * @returns {{ faces: Array<{corners:number[][], fill:string, doubleSided?:boolean}>, roomCenter:number[], faceCount:number }}
 */
export function extractRoomSceneFaces({ elements = [], roomBasis = {}, presets, lighting, light, lamps = [], tint = [1, 1, 1], gravityDarken = true, includeShell = true, deferDiffusion = false } = {}) {
  const plan = resolveRoomSceneElementPlan({ elements, roomBasis, presets }, roomBasis);
  const surfaces = resolveRoomSurfaces(roomBasis);
  const { xRange, yRange, zRange } = surfaces.ranges;
  const roomCenter = [(xRange[0] + xRange[1]) / 2, (yRange[0] + yRange[1]) / 2, (zRange[0] + zRange[1]) / 2];
  const camHint = Array.isArray(roomBasis.cameraHint) ? roomBasis.cameraHint : roomCenter;
  // one unified lighting model (new `lighting` object, or the legacy positional params).
  const lit = resolveLighting(lighting || { light, tint, lamps, gravity: gravityDarken }, { xRange, yRange, zRange });
  const L = lit.L;
  let faces = [];
  // vexar directional Lambert + tint + baked point-lamps + gravity contact-shadow.
  const shade = makeShade({ light: L, lamps: lit.lamps, tint: lit.tint, gravityDarken: lit.gravity });
  const shadeT = (base, corners, toward) => shade(base, corners, normalToward(corners, toward));

  // room shell (skip frontWall — between camera and room). Omitted when furnishing
  // a volume whose shell is built separately (multi-room composition).
  if (includeShell) {
    for (const s of surfaces.list) {
      if (s.id === 'frontWall' || !SURFACE_PALETTE[s.id]) continue;
      const c = surfaceCorners(s);
      faces.push({ corners: c, fill: shadeT(SURFACE_PALETTE[s.id], c, roomCenter), doubleSided: true });
    }
  }

  // furniture: every element is a box-net skinned with furniture-cards.js data
  // cards (5 faces: center=top + four cardinals), legs at the planner's support
  // pins, transparency where a card leaves a face unpainted. This is the SAME
  // furniture model the SVG path uses (buildFurnitureNet), here keeping geometry
  // 3D so the browser projects each card part.
  const boxFaceQuads = (base, top) => ({
    center: top,
    front: [base[0], base[1], top[1], top[0]],
    right: [base[1], base[2], top[2], top[1]],
    back: [base[2], base[3], top[3], top[2]],
    left: [base[3], base[0], top[0], top[3]],
  });
  const outwardNormal = (quad, boxC) => {
    let n = norm(cross(sub(quad[1], quad[0]), sub(quad[3], quad[0])));
    if (dot(n, sub(centroid(quad), boxC)) < 0) n = scale(n, -1);
    return n;
  };
  const legPost = (sup) => {
    const r = (sup.radius || 0.045) * 1.9, b = sup.bottom, t = sup.top;
    const ring = [[b[0]-r,b[1]-r],[b[0]+r,b[1]-r],[b[0]+r,b[1]+r],[b[0]-r,b[1]+r]];
    for (let i = 0; i < 4; i += 1) {
      const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % 4];
      const lc = [[ax,ay,b[2]],[bx,by,b[2]],[bx,by,t[2]],[ax,ay,t[2]]];
      faces.push({ corners: windToward(lc, camHint), fill: shadeT(LEG_HEX, lc, [b[0],b[1],(b[2]+t[2])/2]) });
    }
  };
  const contactFootprints = [];
  for (const el of plan.elements) {
    const manji = el.heightManji;
    const net = getFurnitureNet(el.type);
    const base = manji.basePlane.corners, top = manji.topPlane.corners;
    const elevated = el.surface === 'floor' && manji.heightWorld > 0;

    if (net && elevated) {                         // full box-net: 5 card faces + legs
      const quads = boxFaceQuads(base, top);
      const boxC = centroid([...base, ...top]);
      for (const slot of ['front', 'right', 'back', 'left', 'center']) {
        const card = getFurnitureFaceCard(net.faces[slot]);
        if (!card) continue;
        const q = quads[slot], n = outwardNormal(q, boxC);
        faces.push(...cardFaces(card, q, n, shade));
      }
      for (const sup of manji.supports) legPost(sup);
      if (manji.heightWorld > 0.15) contactFootprints.push({ corners: base, height: manji.heightWorld });
    } else if (net) {                              // flat element (wall fixture / flush floor): one card on its plane
      const card = getFurnitureFaceCard(net.faces.front || net.faces.center);
      const n = normalToward(base, roomCenter);
      faces.push(...cardFaces(card, base, n, shade));
    } else {                                        // no net: a plain shaded top plane
      faces.push({ corners: windToward(top, roomCenter), fill: shadeT('#8a7a64', top, roomCenter) });
    }
  }
  // traced diffusion: bake locally for a standalone room; a larger scene (suite) sets
  // deferDiffusion and bakes once across all its faces so light spills between rooms.
  if (lit.sources.length && !deferDiffusion) {
    faces = bakeSceneDiffusion(faces, lit.sources, lit.diffusion);
  }
  // contact shadows under furniture (defaults on with shadows). Deferred → the suite
  // emits them after its global bake, from the returned footprints.
  const wantContact = lit.diffusion.contact ?? lit.diffusion.shadows ?? false;
  if (wantContact && !deferDiffusion) {
    faces.push(...contactShadowDecals(contactFootprints, { strength: lit.diffusion.contactStrength ?? 0.5 }));
  }
  return { faces, roomCenter, faceCount: faces.length, sources: lit.sources, contactFootprints };
}

/**
 * Build one volume's shell (floor + ceiling + 4 walls) as planar faces, with
 * optional walls omitted (open sides) and rectangular doorway openings cut in.
 * This is the multi-room primitive: compose several volumes of DIFFERENT heights,
 * each sharing a doorway, into one connected interior — all in world space, so the
 * browser projects + occludes the whole enfilade from any pinned camera.
 *
 * Walls are keyed by geometry, not room-role: 'yMin' | 'yMax' | 'xMin' | 'xMax'.
 * `doorways` are { wall, u0, u1, v0, v1 } in that wall's normalized frame
 * (u = horizontal along the wall, v = up). One doorway per wall is split cleanly
 * into left / right / lintel / sill strips; pass at most one opening per wall.
 */
export function buildRoomShellFaces({ xRange, yRange, zRange, omit = [], doorways = [], lighting, light, lamps = [], tint = [1, 1, 1], gravityDarken = true, palette = SURFACE_PALETTE } = {}) {
  const lit = resolveLighting(lighting || { light, tint, lamps, gravity: gravityDarken }, { xRange, yRange, zRange });
  const shade = makeShade({ light: lit.L, lamps: lit.lamps, tint: lit.tint, gravityDarken: lit.gravity });
  const [x0, x1] = xRange, [y0, y1] = yRange, [z0, z1] = zRange;
  const center = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const faces = [];
  const push = (corners, base) => faces.push({ corners, fill: shade(base, corners, normalToward(corners, center)), doubleSided: true });
  push([[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0]], palette.floor);    // floor
  push([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]], palette.ceiling);  // ceiling
  // each wall as a quad [a,b,c,d]: a→b is +u (horizontal), a→d is +v (up).
  const WALLS = {
    yMin: { quad: [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]], base: palette.backWall },
    yMax: { quad: [[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]], base: palette.backWall },
    xMin: { quad: [[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],[x0,y0,z1]], base: palette.leftWall },
    xMax: { quad: [[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]], base: palette.rightWall },
  };
  const doorsByWall = {};
  for (const d of doorways) (doorsByWall[d.wall] ||= []).push(d);
  for (const [id, w] of Object.entries(WALLS)) {
    if (omit.includes(id)) continue;
    const door = (doorsByWall[id] || [])[0];
    if (!door) { push(w.quad, w.base); continue; }
    // split the wall around the doorway: left | right | lintel | sill (sill empty for floor doors)
    const strips = [
      [0, 0, door.u0, 1],
      [door.u1, 0, 1, 1],
      [door.u0, door.v1, door.u1, 1],
      [door.u0, 0, door.u1, door.v0],
    ];
    for (const [a, bv, c, dv] of strips) {
      if (c - a < 1e-4 || dv - bv < 1e-4) continue;
      push([bilerp(w.quad, a, bv), bilerp(w.quad, c, bv), bilerp(w.quad, c, dv), bilerp(w.quad, a, dv)], w.base);
    }
  }
  return faces;
}

// ── emitter ───────────────────────────────────────────────────────────────────
/**
 * Emit a self-contained preserve-3d HTML scene.
 * @param {object} opts
 * @param {Array} opts.faces        {corners, fill|bg, doubleSided?, clip?, glow?, html?, card?, lit?}
 *   card+lit are the World-only mark-card realization (facade-card.js); this CSS-3D
 *   emitter ignores them and paints `bg`. They are two realizations of one facade.
 * @param {Array} opts.cameras      [{ name, worldFraming }]
 * @param {object} opts.viewBox     { width, height }
 * @param {number} opts.unitScale   px per world unit (cancels in projection; sets Z magnitude)
 */
export function emitPreserve3dScene({ faces = [], cameras = [], viewBox = { width: 1080, height: 720 }, unitScale = 30, title = 'mojulo scene', bg = '#1b1712', sky } = {}) {
  const W = viewBox.width, H = viewBox.height;
  // `sky` (painted-landscape sky concept) → a CSS gradient backdrop; else the flat bg.
  if (sky) bg = skyCss(sky);
  const dom = faces.map((f) => {
    const c = f.corners, uVec = sub(c[1], c[0]), vVec = sub(c[3], c[0]);
    const wPx = (len(uVec) * unitScale).toFixed(2), hPx = (len(vVec) * unitScale).toFixed(2);
    const bf = f.doubleSided ? 'visible' : 'hidden';
    const clip = f.clip ? `clip-path:${f.clip};` : '';   // f.clip = polygon mask (e.g. cylinder roof cap)
    const radius = f.radius ? `border-radius:${f.radius};` : '';  // f.radius = rounded corners (e.g. arched window top)
    const glow = f.glow ? `box-shadow:${f.glow};` : '';  // f.glow = CSS bloom halo for emissive faces (light fixtures)
    // f.bg = full CSS background (facade gradient); f.html = inner content (brick arched windows).
    return `      <div class="f" style="width:${wPx}px;height:${hPx}px;background:${f.bg || f.fill};${clip}${radius}${glow}transform:${planeMatrix(c[0], uVec, vVec, unitScale)};backface-visibility:${bf}">${f.html || ''}</div>`;
  }).join('\n');

  const cams = cameras.map((cam) => {
    const { matrix, perspective, center } = cameraMatrixFromWorldFraming(cam.worldFraming, viewBox, unitScale);
    return { name: cam.name || 'view', matrix, perspective, center };
  });
  const camJson = JSON.stringify(cams);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#0b1220;color:#cfe3ff;font:13px/1.4 system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}
  .viewport{width:${W}px;height:${H}px;max-width:100%;overflow:hidden;background:${bg};perspective:600px;perspective-origin:50% 50%}
  .view{position:absolute;left:0;top:0;width:100%;height:100%;transform-style:preserve-3d;transform-origin:0 0}
  .f{position:absolute;left:0;top:0;transform-origin:0 0}
  /* brick masonry windows: arched top (the face's local y is flipped, so the arch
     rounds the CSS-bottom corners → renders at the window's world-top). */
  .bw{position:absolute;background:linear-gradient(150deg,#3a4350,#1d232b 72%);box-shadow:inset 0 0 0 1.2px #c9b396;border-radius:0 0 48% 48% / 0 0 42% 42%}
  .controls{display:flex;gap:8px;margin:8px;flex-wrap:wrap}
  .controls button{color:#9cc4ff;background:none;border:1px solid #24324a;border-radius:5px;padding:4px 10px;cursor:pointer;font:inherit}
  .controls button.on{background:#1b2740;color:#fff}
</style></head><body>
  <div class="viewport"><div class="view" id="view">
${dom}
  </div></div>
  <div class="controls" id="ctrl"></div>
<script>
  const CAMS = ${camJson};
  const view = document.getElementById('view'), vp = document.querySelector('.viewport'), ctrl = document.getElementById('ctrl');
  function setCam(i){ const c = CAMS[i]; vp.style.perspective = c.perspective.toFixed(2)+'px';
    view.style.transform = 'translate('+c.center[0]+'px,'+c.center[1]+'px) ' + c.matrix;
    [...ctrl.children].forEach((b,k)=>b.classList.toggle('on',k===i)); }
  CAMS.forEach((c,i)=>{ const b=document.createElement('button'); b.textContent='cam'+i+(c.name?' · '+c.name:''); b.onclick=()=>setCam(i); ctrl.appendChild(b); });
  const q = new URLSearchParams(location.search).get('cam');
  setCam(q!==null ? Math.max(0, Math.min(CAMS.length-1, +q)) : 0);
</script>
</body></html>
`;
}

/** Convenience: room scene plan + cameras → self-contained HTML. */
export function renderRoomSceneToHtml({ elements, roomBasis, cameras, presets, viewBox, unitScale = 30, title = 'mojulo room', lighting, light, lamps, tint, gravityDarken } = {}) {
  const { faces } = extractRoomSceneFaces({ elements, roomBasis, presets, lighting, light, lamps, tint, gravityDarken });
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title });
}

// ── production manji-tree two-point room → scene (additive; no neo-rembrandt change) ──
const orderedRange = (r, fb) => {
  const raw = Array.isArray(r) && r.length >= 2 ? r : fb;
  const a = Number.isFinite(+raw[0]) ? +raw[0] : fb[0], b = Number.isFinite(+raw[1]) ? +raw[1] : fb[1];
  return a <= b ? [a, b] : [b, a];
};

/** Build a room-scene roomBasis from a stored manji-tree's `pureMandala.room`
 *  (mirrors neo-rembrandt's generateTwoPointRoomMarks range derivation). */
function roomBasisFromPureMandala(room = {}) {
  const xRange = orderedRange(room.floor?.x, [room.walls?.leftX ?? -18, room.walls?.rightX ?? 18]);
  const yRange = orderedRange(room.floor?.y, [-28, 8]);
  const ceilingZ = Number.isFinite(+room.ceilingZ) ? +room.ceilingZ : 11;
  return {
    worldExtent: { width: xRange[1] - xRange[0], depth: yRange[1] - yRange[0], height: ceilingZ },
    xRange, yRange, zRange: [0, ceilingZ],
    frontY: yRange[1], backY: yRange[0], verticalUnit: 26,
    cameraHint: [xRange[0] - 0.2 * (xRange[1] - xRange[0]), yRange[1] + 0.3 * (yRange[1] - yRange[0]), ceilingZ * 0.85],
  };
}

/** A fallback corner camera when the stored primitive has no worldFraming. */
function synthCornerCamera(rb) {
  const [x0, x1] = rb.xRange, [y0, y1] = rb.yRange, h = rb.zRange[1];
  const w = x1 - x0, d = y1 - y0;
  return { name: 'corner', worldFraming: {
    cameraPosition: [x0 - 0.25 * w, y1 + 0.45 * d, h * 0.8],
    lookAt: [(x0 + x1) / 2, y0 + 0.35 * d, h * 0.42],
    horizontalFov: 78,
  } };
}

// ── declarative scene lighting (the model-facing dials) ──────────────────────
// A manifest authors light with simple fields — a `scene.time` preset, or an
// explicit `scene.lighting` object (the full lighting model), plus `scene.sky` —
// never the engine. `time` is the intent the model reaches for; the rest defaults.
// ARTISTIC time-of-day presets (atmosphere = part of the message).
const TIME_PRESETS = {
  day:   { vexar: { direction: [0.35, 0.40, -0.84], ambient: 0.62, diffuse: 0.50 }, tint: [1.0, 1.0, 1.02], sky: { preset: 'day' } },
  dawn:  { vexar: { direction: [-0.4, 0.34, -0.82], ambient: 0.44, diffuse: 0.42 }, tint: [1.06, 0.99, 0.9 ], sky: { preset: 'dawn' } },
  dusk:  { vexar: { direction: [0.45, 0.30, -0.80], ambient: 0.42, diffuse: 0.40 }, tint: [1.08, 0.99, 0.86], sky: { preset: 'dusk' } },
  night: { vexar: { direction: [0.20, 0.30, -0.90], ambient: 0.26, diffuse: 0.22 }, tint: [0.90, 0.95, 1.08], sky: { preset: 'night', stars: true, moon: true } },
};
// NAMED lighting modes. `flat` is the TECHNICAL default: even high-ambient shade that
// reads form but carries no atmosphere — no contact shadow, no pools, no sky. The
// decision rule: technical drawings / scientific explanations → 'flat'; artistic
// depictions where the light is part of the message → a `time`.
const LIGHTING_PRESETS = {
  flat: { vexar: { direction: [0.3, 0.35, -0.86], ambient: 0.84, diffuse: 0.16 }, gravity: false },
};

/**
 * Resolve a manifest's declarative scene-lighting fields into a `lighting` object +
 * `sky` for the renderer. `scene.time` ('day'|'dawn'|'dusk'|'night') is the artistic
 * preset; `scene.lighting` is either a named mode string ('flat' — technical) or the
 * full lighting object (vexar/tint/sources/lamps/diffusion), which overrides the time
 * preset; `scene.sky` overrides the preset sky. Returns nulls when nothing is declared
 * (so the legacy default lighting is kept).
 */
export function resolveSceneLighting(manifest = {}) {
  const scene = manifest.scene && typeof manifest.scene === 'object' ? manifest.scene : {};
  const time = scene.time || manifest.time;
  const lightingIn = scene.lighting ?? manifest.lighting;
  const skyIn = scene.sky ?? manifest.sky;
  if (!time && lightingIn == null && skyIn === undefined) return { lighting: null, sky: null };
  // a NAMED mode ('flat' for technical) — no atmosphere, no sky unless explicitly set
  if (typeof lightingIn === 'string') {
    const mode = LIGHTING_PRESETS[lightingIn];
    return { lighting: mode ? { ...mode } : null, sky: skyIn ?? null };
  }
  const preset = (time && TIME_PRESETS[time]) || {};
  const lighting = {
    vexar: lightingIn?.vexar || preset.vexar,
    tint: lightingIn?.tint || preset.tint,
    ...(lightingIn?.sources ? { sources: lightingIn.sources } : {}),
    ...(lightingIn?.lamps ? { lamps: lightingIn.lamps } : {}),
    ...(lightingIn?.diffusion ? { diffusion: lightingIn.diffusion } : {}),
    ...(lightingIn?.gravity !== undefined ? { gravity: lightingIn.gravity } : {}),
  };
  return { lighting, sky: skyIn ?? preset.sky ?? null };
}

/**
 * Extract a stored two-point room manji-tree manifest into preserve-3d faces + cameras.
 * Honors the manifest's declarative `scene.lighting`/`scene.time`/`scene.sky`.
 * Returns null when the manifest is not an eligible two-point room.
 */
export function extractRoomFacesFromManifest(manifest = {}, { light, lighting } = {}) {
  const cameraPrimitive = manifest.cameraPrimitive || manifest.scene?.cameraPrimitive || {};
  const pureMandala = manifest.polygonizer?.pureMandala || manifest.pureMandala || {};
  if (cameraPrimitive.kind !== 'two-point' || !pureMandala.room) return null;

  const roomConcept = manifest.polygonizer?.roomConcept || manifest.polygonizer?.roomPlanning || {};
  const elements = Array.isArray(roomConcept.elements) ? roomConcept.elements : [];
  const roomBasis = roomBasisFromPureMandala(pureMandala.room);
  const resolved = resolveSceneLighting(manifest);
  const effLighting = lighting || resolved.lighting;          // explicit override → manifest → null (default)
  const { faces, faceCount } = extractRoomSceneFaces(effLighting ? { elements, roomBasis, lighting: effLighting } : { elements, roomBasis, light });

  const wf = cameraPrimitive.worldFraming;
  const hasWF = wf && Array.isArray(wf.cameraPosition) && Array.isArray(wf.lookAt);
  const cameras = hasWF
    ? [{ name: 'view', worldFraming: wf }, synthCornerCamera(roomBasis)]
    : [synthCornerCamera(roomBasis)];
  const viewBox = cameraPrimitive.viewBox || manifest.viewBox || { width: 1080, height: 720 };
  return { faces, faceCount, cameras, viewBox, sky: resolved.sky, cameraSynthesized: !hasWF };
}

/** Stored two-point room manji-tree manifest → self-contained preserve-3d HTML (or null). */
export function renderRoomManifestToHtml(manifest, { unitScale = 26, title = 'mojulo room', light, lighting } = {}) {
  const extracted = extractRoomFacesFromManifest(manifest, { light, lighting });
  if (!extracted) return null;
  return emitPreserve3dScene({ faces: extracted.faces, cameras: extracted.cameras, viewBox: extracted.viewBox, unitScale, title, sky: extracted.sky || undefined });
}

// ── cityscape: architecture planner allocations → world faces (additive; the
//    glyph/fractal planner — planArchitectureMandala — is consumed, never changed) ──
//
// The planner is a 2D picture-plane allocator (normalized {u,v,w,h} slots). It has
// no 3D world model, so this resolver SYNTHESIZES one — promoting the spike's
// worldRectFromSurfaceSlot / cuboid / height-table logic into reusable geometry.

const DEFAULT_CITY_BASIS = {
  worldExtent: { width: 34, depth: 22, height: 18 },
  // surface-slot → world footprint (matches the architecture spike's mapping)
  map: { x0: 1.7, xScale: 30.5, y0: 1.5, yScale: 18.5 },
};
const DEFAULT_CITY_CAMERAS = [
  { name: 'street', worldFraming: { cameraPosition: [-7, 31, 9], lookAt: [16, 8, 5], horizontalFov: 82, pictureCenter: [560, 390] } },
];
// prop heights (world units), lifted from the spike's street-furniture table
const PROP_HEIGHT = {
  'urban.newsstand-vendor': 0.92, 'urban.phone-booth': 1.35, 'urban.hydrant-utility': 0.72,
  'urban.traffic-signals': 1.85, 'urban.billboard-signage': 1.8, 'urban.gas-station': 1.65,
  'urban.bus-stop-shelter': 1.2, 'civic.public-realm-kit': 1.1, 'infrastructure.cell-tower': 4.8,
  'infrastructure.power-tower': 4.4,
};
const GROUND_TINT = {
  roadPlane: '#3b424c', sidewalk: '#cfcabf', plaza: '#d2cfc5', lotPad: '#c5bfb3',
  yard: '#c3bca9', field: '#bccb9a', dock: '#b0855c', transportApron: '#c2c6ce', railPlatform: '#c1b8aa',
};

const slotWorldRect = (surface, slot, m) => {
  const u = surface.rect.u + slot.u * surface.rect.w, v = surface.rect.v + slot.v * surface.rect.h;
  return { x: m.x0 + u * m.xScale, y: m.y0 + v * m.yScale, w: slot.w * surface.rect.w * m.xScale, d: slot.h * surface.rect.h * m.yScale };
};
const surfaceWorldRect = (surface, m) => ({
  x: m.x0 + surface.rect.u * m.xScale, y: m.y0 + surface.rect.v * m.yScale,
  w: surface.rect.w * m.xScale, d: surface.rect.h * m.yScale,
});
const facadeBg = (floors, bays, glass, frame = 'rgba(8,11,17,.85)') =>
  `repeating-linear-gradient(to right, ${frame} 0 1.4px, transparent 1.4px calc(100%/${bays})),`
  + `repeating-linear-gradient(to top, ${frame} 0 1.4px, transparent 1.4px calc(100%/${floors})),${glass}`;
const cityHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
// hex palettes (scaleHex is hex-only — never feed it hsl())
const GLASS_PAL = ['#8fb0cf', '#7fa3b8', '#92b6a6', '#a3aecb', '#bda28c', '#88a0c4'];
const PROP_PAL = ['#b9c2cc', '#c4b8a8', '#a8b6a0', '#c9bcae', '#b0a8c0', '#bcc6b2'];

// a flat ground quad at height z, normal up
function groundFace(r, z, fill, L) {
  const c = [[r.x, r.y, z], [r.x + r.w, r.y, z], [r.x + r.w, r.y + r.d, z], [r.x, r.y + r.d, z]];
  return { corners: c, fill: scaleHex(fill, litFactor([0, 0, 1], L)), doubleSided: true };
}
// A facade wall face carries BOTH realizations of the same facade: `bg` (the
// CSS-3D gradient, painted by the preserve-3d emitter) and `card` + `lit` (the
// mark-card, realized as window geometry by the WebGL World — see facade-card.js
// / expandSurfaceCards). Every facade wall of every building shape is born through
// this one constructor so the two renderers stay in lockstep — the first-class
// "detail-as-card" seam. `html` is the brick child-window markup (CSS-3D only).
function facadeFace(corners, facade, lit, floors, bays, html = '') {
  return { corners, bg: facadeCss(facade, lit, floors, bays), card: buildFacadeCard(facade, floors, bays), lit, html };
}

// a box: top (shaded, up) + 4 sides (single-sided, natural winding so backface-cull
// shows only camera-facing sides; local x=width, local y=up → facade grid lands right)
function cityBox(r, z0, z1, { top, side, glass, facade, floors, bays }, L, camHint) {
  const { x, y, w, d } = r, x1 = x + w, y1 = y + d;
  const faces = [];
  const topQ = [[x, y, z1], [x1, y, z1], [x1, y1, z1], [x, y1, z1]];
  faces.push({ corners: windToward(topQ, [(x + x1) / 2, (y + y1) / 2, 1e4]), fill: scaleHex(top, litFactor([0, 0, 1], L)) });
  const sides = [
    [[x, y, z0], [x1, y, z0], [x1, y, z1], [x, y, z1]],       // -y
    [[x1, y1, z0], [x, y1, z0], [x, y1, z1], [x1, y1, z1]],   // +y
    [[x, y1, z0], [x, y, z0], [x, y, z1], [x, y1, z1]],       // -x
    [[x1, y, z0], [x1, y1, z0], [x1, y1, z1], [x1, y, z1]],   // +x
  ];
  const html = facade && facade.material === 'brick' ? facadeHtml(facade, floors, bays) : '';
  for (const s of sides) {
    const lit = litFactor(normalToward(s, camHint), L);
    if (facade) faces.push(facadeFace(s, facade, lit, floors, bays, html));
    else if (glass) faces.push({ corners: s, bg: facadeBg(floors, bays, scaleHex(glass, lit)) });
    else faces.push({ corners: s, fill: scaleHex(side, lit) });
  }
  return faces;
}

// a cylindrical (N-gon prism) skyscraper: vertical side facades + a clipped N-gon roof cap
function cylinderBuilding(b, facade, floors, L, camHint) {
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, r = Math.min(b.w, b.d) / 2, N = 14;
  const ring = (z) => Array.from({ length: N }, (_, i) => { const a = (i / N) * 2 * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r, z]; });
  const bot = ring(b.z0), top = ring(b.z1), faces = [];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, s = [bot[i], bot[j], top[j], top[i]];
    faces.push(facadeFace(s, facade, litFactor(normalToward(s, camHint), L), floors, 1));
  }
  const capPts = Array.from({ length: N }, (_, i) => { const a = (i / N) * 2 * Math.PI; return `${(50 + 50 * Math.cos(a)).toFixed(1)}% ${(50 + 50 * Math.sin(a)).toFixed(1)}%`; }).join(', ');
  const cap = [[cx - r, cy - r, b.z1], [cx + r, cy - r, b.z1], [cx + r, cy + r, b.z1], [cx - r, cy + r, b.z1]];
  faces.push({ corners: windToward(cap, [cx, cy, 1e4]), fill: scaleHex(facade.glass, 0.62), clip: `polygon(${capPts})` });
  return faces;
}
// a setback (stepped) skyscraper: stacked boxes with decreasing footprint
function setbackBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, hf = [0.5, 0.3, 0.2], faces = [];
  let z = b.z0, x = b.x, y = b.y, w = b.w, d = b.d;
  for (let t = 0; t < 3; t++) {
    const th = h * hf[t], fl = Math.max(2, Math.round(th / facade.floorH)), by = Math.max(2, Math.round(w / facade.bayW));
    faces.push(...cityBox({ x, y, w, d }, z, z + th, { facade, floors: fl, bays: by, top: scaleHex(facade.glass, 0.62) }, L, camHint));
    z += th;
    if (t < 2) { const ins = Math.min(w, d) * 0.18; x += ins / 2; y += ins / 2; w -= ins; d -= ins; }
  }
  return faces;
}

// "tower on podium": a tall narrow tower (slab) rising from a WIDE LOW base. The base
// is the full footprint, 2–3 floors; the tower is inset and centred, the rest of the
// height. The exposed base roof reads as a podium terrace.
function podiumBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, faces = [];
  const baseH = Math.max(facade.floorH * 1.6, Math.min(h * 0.30, facade.floorH * 3));
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z0 + baseH,
    { facade, floors: Math.max(2, Math.round(baseH / facade.floorH)), bays: Math.max(2, Math.round(b.w / facade.bayW)), top: scaleHex(facade.glass, 0.5) }, L, camHint));
  const iw = b.w * 0.28, id = b.d * 0.34, tw = b.w - iw, td = b.d - id;
  faces.push(...cityBox({ x: b.x + iw / 2, y: b.y + id / 2, w: tw, d: td }, b.z0 + baseH, b.z1,
    { facade, floors: Math.max(3, Math.round((h - baseH) / facade.floorH)), bays: Math.max(2, Math.round(tw / facade.bayW)), top: scaleHex(facade.glass, 0.62) }, L, camHint));
  return faces;
}

// mixed-use COMPLEX: a long low retail box (shopping complex) with a taller condo
// tower (cylinder or box) at one end — either ABOVE the podium or BESIDE it (a
// full-height tower with the retail filling the remaining length). Variant + end +
// tower-form are chosen deterministically from the footprint position.
function complexBuilding(b, facade, L, camHint) {
  const h = b.z1 - b.z0, faces = [];
  const hsh = Math.abs(Math.sin(b.x * 12.9898 + b.y * 78.233) * 43758.5453);
  const r1 = hsh % 1, r2 = (hsh * 7.37) % 1, r3 = (hsh * 3.11) % 1;
  const long = b.w >= b.d ? 'x' : 'y', end = r2 < 0.5, cyl = r3 < 0.55;
  const baseH = Math.max(facade.floorH * 1.7, Math.min(h * 0.30, facade.floorH * 3));
  const fl = (hh) => Math.max(2, Math.round(hh / facade.floorH));
  const by = (ww) => Math.max(2, Math.round(ww / facade.bayW));
  const podium = (r, z0, z1) => cityBox(r, z0, z1, { facade, floors: fl(z1 - z0), bays: by(Math.max(r.w, r.d)), top: scaleHex(facade.glass, 0.46) }, L, camHint);
  const tower = (r, z0, z1) => (cyl
    ? cylinderBuilding({ ...r, z0, z1 }, facade, fl(z1 - z0), L, camHint)
    : cityBox(r, z0, z1, { facade, floors: fl(z1 - z0), bays: by(Math.min(r.w, r.d)), top: scaleHex(facade.glass, 0.62) }, L, camHint));

  if (r1 < 0.5) {
    // ABOVE — long retail podium (full footprint) + a point condo tower on one end
    faces.push(...podium({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z0 + baseH));
    const ts = Math.min(b.w, b.d) * 0.86, tr = long === 'x'
      ? { x: end ? b.x + b.w - ts : b.x, y: b.y + (b.d - ts) / 2, w: ts, d: ts }
      : { x: b.x + (b.w - ts) / 2, y: end ? b.y + b.d - ts : b.y, w: ts, d: ts };
    faces.push(...tower(tr, b.z0 + baseH, b.z1));
  } else {
    // BESIDE — a full-height condo tower at one end + retail podium on the remainder
    const split = 0.4 + r2 * 0.16;
    let tr, pr;
    if (long === 'x') { const tw2 = b.w * split; tr = { x: end ? b.x + b.w - tw2 : b.x, y: b.y, w: tw2, d: b.d }; pr = { x: end ? b.x : b.x + tw2, y: b.y, w: b.w - tw2, d: b.d }; }
    else { const td2 = b.d * split; tr = { x: b.x, y: end ? b.y + b.d - td2 : b.y, w: b.w, d: td2 }; pr = { x: b.x, y: end ? b.y : b.y + td2, w: b.w, d: b.d - td2 }; }
    if (pr.w > 0.6 && pr.d > 0.6) faces.push(...podium(pr, b.z0, b.z0 + baseH));
    faces.push(...tower(tr, b.z0, b.z1));
  }
  return faces;
}

// ── religious place (church) ────────────────────────────────────────────────────
// A church-class mass with an unmistakable silhouette, built from the same planar-face
// primitive as every other building. Two variants (b.churchVariant), both reusing an
// already-placed building footprint (so they're road-clear) and computing their own
// proportions from it — the incoming z1 is ignored:
//   • 'chapel'   (default) — a NAVE under a pitched GABLE roof, a front BELL TOWER, a
//                 four-sided pyramidal SPIRE, and a rooftop CROSS.
//   • 'basilica' — a grander GOTHIC-REVIVAL twin-tower front (Notre-Dame-de-Montréal):
//                 two flat-topped CRENELLATED towers with corner PINNACLES flanking a
//                 central gabled facade with three pointed PORTALS, tiers of pointed
//                 LANCET windows, and a cross. Taller; wants a bigger footprint.
// Palette is overridable via b.churchPalette (the per-locale "hatch"); defaults to warm
// stone + verdigris copper.
const CHURCH_PALETTE = { wall: '#dcd6c8', roof: '#4f7d6e', spire: '#4a7567', door: '#3a2b22', cross: '#c9a23a' };
function churchBuilding(b, L, camHint) {
  const pal = { ...CHURCH_PALETTE, ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  // a flat TRIANGLE A,B,T: the emitter only draws parallelograms, so bound it with a quad
  // [A, B, B+h, A+h] (h = apex height vector ⟂ to the base) and clip it back to the triangle.
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), baseLen = len(Uw), ub = norm(Uw);
    const Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));   // perpendicular foot→apex height vector
    if (len(Vw) < 1e-4) return;
    const apexU = dot(sub(T, A), ub) / baseLen;                  // apex position along the base (0..1)
    faces.push({
      corners: [A, B, add(B, Vw), add(A, Vw)],
      fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)),
      doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(apexU * 100).toFixed(1)}% 100%)`,
    });
  };
  const along = b.w >= b.d ? 'x' : 'y';                 // nave runs down the longer axis
  const aLen = along === 'x' ? b.w : b.d, cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x;
  const cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);   // (along, across, height) → world
  const z0 = b.z0;
  const a1 = a0 + aLen;                                  // rear of the nave (shared by both variants)

  // ── variant: GOTHIC-REVIVAL BASILICA (twin crenellated towers) ────────────────
  if (b.churchVariant === 'basilica') {
    const c1 = c0 + cLen, eps = 0.04;
    // INVERTED palette vs the chapel: a dark stone facade with PALE arched windows
    // (the cross is dropped — the twin-tower silhouette is iconic enough). Overridable
    // via b.churchPalette.
    const bpal = { wall: '#514c46', roof: '#39554c', window: '#cbd2d6', portal: '#241f1b', pinnacle: '#5b564e', ...(b.churchPalette || {}) };
    const ARCH = '0 0 50% 50% / 0 0 38% 38%';   // rounds the world-top corners → a curved arch (no triangular point)
    // an axis-aligned box in (along, across) terms, mapped to the right world rect
    const boxAC = (a, c, da, dc, zlo, zhi, tint) => {
      if (da <= 0 || dc <= 0 || zhi <= zlo) return;
      const r = along === 'x' ? { x: a, y: c, w: da, d: dc } : { x: c, y: a, w: dc, d: da };
      faces.push(...cityBox(r, zlo, zhi, { top: scaleHex(tint, 1.05), side: tint }, L, camHint));
    };
    // a small 4-sided pyramid (tower-corner pinnacle) centred at (a,c)
    const pinnacle = (a, c, s, zb, h, tint) => {
      const ring = [[a - s, c - s], [a + s, c - s], [a + s, c + s], [a - s, c + s]];
      for (let i = 0; i < 4; i++) { const [pa, pc] = ring[i], [qa, qc] = ring[(i + 1) % 4]; tri(P(pa, pc, zb), P(qa, qc, zb), P(a, c, zb + h), tint); }
    };
    // a crenellated parapet (merlons + gaps) ringing a rectangle's top edge
    const crenelRing = (aLo, aHi, cLo, cHi, zTop, mh, tint) => {
      const mw = 0.26, th = 0.16;
      for (let c = cLo; c < cHi - 1e-6; c += 2 * mw) { const w = Math.min(mw, cHi - c); boxAC(aLo, c, th, w, zTop, zTop + mh, tint); boxAC(aHi - th, c, th, w, zTop, zTop + mh, tint); }
      for (let a = aLo + th; a < aHi - th - 1e-6; a += 2 * mw) { const w = Math.min(mw, aHi - th - a); boxAC(a, cLo, w, th, zTop, zTop + mh, tint); boxAC(a, cHi - th, w, th, zTop, zTop + mh, tint); }
    };
    // an arched window/portal proud of a wall plane, drawn as a single rounded rectangle
    // (the top corners curve via border-radius — no triangular relief). `arch(corners,tint)`.
    const arch = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true, radius: ARCH });
    // on the FRONT plane (a = a0, exterior toward −A), across cA..cB, from zlo to zTop
    const archFront = (cA, cB, zlo, zTop, tint) => { const a = a0 - eps; arch([P(a, cA, zlo), P(a, cB, zlo), P(a, cB, zTop), P(a, cA, zTop)], tint); };
    // on a tower OUTER SIDE plane (c = cF, exterior toward sgn), along aA..aB
    const archSide = (cF, sgn, aA, aB, zlo, zTop, tint) => { const c = cF + sgn * eps; arch([P(aA, c, zlo), P(aB, c, zlo), P(aB, c, zTop), P(aA, c, zTop)], tint); };

    const towerW = Math.min(cLen * 0.34, aLen * 0.46), towerDepth = towerW;
    const towerTop = z0 + Math.max(4.2, cLen * 1.5);
    const tH = towerTop - z0;
    const towers = [[c0, c0 + towerW], [c1 - towerW, c1]];
    const fcL = c0 + towerW, fcR = c1 - towerW, span = Math.max(0.4, fcR - fcL);
    const facadeTop = z0 + tH * 0.6, parapet = Math.max(0.3, cLen * 0.15), facadeDepth = towerDepth * 0.5;

    // NAVE body behind the facade (lower, gabled) — only if there's depth for it
    const nb0 = a0 + towerDepth * 0.6, ncL = c0 + towerW * 0.25, ncR = c1 - towerW * 0.25;
    if (a1 > nb0 + 0.5) {
      const naveEave = z0 + Math.max(2.2, cLen * 1.1), naveRidge = naveEave + cLen * 0.5, naveMid = (ncL + ncR) / 2;
      lit([P(nb0, ncL, z0), P(a1, ncL, z0), P(a1, ncL, naveEave), P(nb0, ncL, naveEave)], bpal.wall);
      lit([P(nb0, ncR, z0), P(a1, ncR, z0), P(a1, ncR, naveEave), P(nb0, ncR, naveEave)], bpal.wall);
      lit([P(a1, ncL, z0), P(a1, ncR, z0), P(a1, ncR, naveEave), P(a1, ncL, naveEave)], bpal.wall);
      tri(P(a1, ncL, naveEave), P(a1, ncR, naveEave), P(a1, naveMid, naveRidge), bpal.wall);
      lit([P(nb0, ncL, naveEave), P(a1, ncL, naveEave), P(a1, naveMid, naveRidge), P(nb0, naveMid, naveRidge)], bpal.roof);
      lit([P(nb0, ncR, naveEave), P(a1, ncR, naveEave), P(a1, naveMid, naveRidge), P(nb0, naveMid, naveRidge)], bpal.roof);
    }

    // CENTRAL FACADE — dark screen wall with three arched portals + a tall arched window, parapet on top
    boxAC(a0, fcL, facadeDepth, fcR - fcL, z0, facadeTop, bpal.wall);
    const portalH = (facadeTop - z0) * 0.42, pw = span * 0.22;
    for (let i = 0; i < 3; i++) { const cc = fcL + span * (0.2 + 0.3 * i); archFront(cc - pw / 2, cc + pw / 2, z0 + 0.02, z0 + portalH, bpal.portal); }
    archFront(fcL + span * 0.32, fcR - span * 0.32, z0 + portalH * 1.2, facadeTop - 0.05, bpal.window);  // great arched window
    crenelRing(a0, a0 + facadeDepth, fcL, fcR, facadeTop, parapet, bpal.wall);

    // TWIN TOWERS
    for (const [tl, tr] of towers) {
      const tw2 = tr - tl;
      boxAC(a0, tl, towerDepth, tw2, z0, towerTop, bpal.wall);
      archFront(tl + tw2 * 0.22, tr - tw2 * 0.22, z0 + tH * 0.4, z0 + tH * 0.68, bpal.window);   // lower belfry window
      archFront(tl + tw2 * 0.22, tr - tw2 * 0.22, z0 + tH * 0.72, z0 + tH * 0.93, bpal.window);  // upper window
      const outerC = tl === c0 ? c0 : c1, sgn = tl === c0 ? -1 : 1;
      archSide(outerC, sgn, a0 + towerDepth * 0.22, a0 + towerDepth * 0.78, z0 + tH * 0.72, z0 + tH * 0.93, bpal.window);
      const merl = Math.max(0.34, cLen * 0.18);
      crenelRing(a0, a0 + towerDepth, tl, tr, towerTop, merl, bpal.wall);
      const ps = tw2 * 0.19, pzb = towerTop + merl, ph = cLen * 0.28;   // stubby stone corner pinnacles
      for (const [pa, pc] of [[a0 + ps, tl + ps], [a0 + towerDepth - ps, tl + ps], [a0 + ps, tr - ps], [a0 + towerDepth - ps, tr - ps]]) pinnacle(pa, pc, ps, pzb, ph, bpal.pinnacle);
    }
    return faces;
  }

  // ── variant: EASTERN-ORTHODOX (five onion domes) ──────────────────────────────
  if (b.churchVariant === 'orthodox') {
    // white walls + a gilded central dome + four blue secondary domes (a cross-in-square,
    // five-dome plan). Onion domes are surfaces of revolution, faceted as stacked rings.
    const opal = { wall: '#e7e3d7', roof: '#b7b0a0', domeMain: '#caa63f', domeSide: '#39509a', drum: '#dcd7c8', window: '#33291f', cross: '#d8b94a', ...(b.churchPalette || {}) };
    const cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 10;
    const ringPts = (r, z, ox = cx, oy = cy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
    const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
    // onion profile: [heightFrac, radiusFactor] — bulges past 1, tapers to a point
    const ONION = [[0, 1.0], [0.14, 1.14], [0.32, 1.2], [0.5, 1.05], [0.66, 0.74], [0.8, 0.42], [0.92, 0.18], [1.0, 0.0]];
    const onion = (ox, oy, baseR, baseZ, domeH, tint) => {
      let prev = null;
      for (const [hf, rf] of ONION) {
        const z = baseZ + hf * domeH, r = baseR * rf, pts = r < 1e-3 ? null : ringPts(r, z, ox, oy);
        if (prev) { if (pts) band(prev, pts, tint); else { const apex = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], apex, tint); } }
        if (pts) prev = pts;
      }
    };
    const drumCyl = (ox, oy, r, zl, zh, tint) => band(ringPts(r, zl, ox, oy), ringPts(r, zh, ox, oy), tint);
    // a slim ORTHODOX cross (one main bar + a short upper bar) on a thin post
    const finial = (ox, oy, zb, h, tint) => {
      const bar = Math.max(0.04, h * 0.09);
      faces.push(...cityBox({ x: ox - bar / 2, y: oy - bar / 2, w: bar, d: bar }, zb, zb + h, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
      faces.push(...cityBox({ x: ox - h * 0.24, y: oy - bar / 2, w: h * 0.48, d: bar }, zb + h * 0.5, zb + h * 0.5 + bar, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
      faces.push(...cityBox({ x: ox - h * 0.13, y: oy - bar / 2, w: h * 0.26, d: bar }, zb + h * 0.74, zb + h * 0.74 + bar, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    };

    // BODY — a cubic naos, with a flat roof the domes rise from; arched windows + a portal on the front
    const bodyTop = z0 + Math.max(2.6, cLen * 1.05), eps = 0.04, aF = a0 - eps;
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, bodyTop, { top: scaleHex(opal.roof, 1.0), side: opal.wall }, L, camHint));
    const archF = (cA, cB, zlo, zTop, tint) => { const cs = [P(aF, cA, zlo), P(aF, cB, zlo), P(aF, cB, zTop), P(aF, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 42% 42%' }); };
    archF(cMid - cLen * 0.11, cMid + cLen * 0.11, z0 + 0.02, z0 + (bodyTop - z0) * 0.5, opal.window);                 // central portal
    for (const cc of [c0 + cLen * 0.24, c0 + cLen * 0.76]) archF(cc - cLen * 0.07, cc + cLen * 0.07, z0 + (bodyTop - z0) * 0.42, z0 + (bodyTop - z0) * 0.82, opal.window);

    // CENTRAL drum + gilded onion dome, with tall window slits round the drum
    const rC = cLen * 0.21, drumTop = bodyTop + cLen * 0.58;
    drumCyl(cx, cy, rC, bodyTop, drumTop, opal.drum);
    for (let i = 0; i < Nr; i += 2) {                                  // drum windows
      const a = (i / Nr) * 2 * Math.PI, px = cx + Math.cos(a) * (rC + 0.02), py = cy + Math.sin(a) * (rC + 0.02);
      const tx = -Math.sin(a) * 0.06, ty = Math.cos(a) * 0.06, wz0 = bodyTop + cLen * 0.12, wz1 = bodyTop + cLen * 0.48;
      const cs = [[px - tx, py - ty, wz0], [px + tx, py + ty, wz0], [px + tx, py + ty, wz1], [px - tx, py - ty, wz1]];
      faces.push({ corners: cs, fill: scaleHex(opal.window, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 30% 30%' });
    }
    const domeH = cLen * 1.0;
    onion(cx, cy, rC * 1.06, drumTop, domeH, opal.domeMain);
    finial(cx, cy, drumTop + domeH, cLen * 0.42, opal.cross);

    // FOUR secondary drums + blue domes, set out toward the body corners and sitting low
    const dx = b.w * 0.33, dy = b.d * 0.33, rS = cLen * 0.1, sTop = bodyTop + cLen * 0.16, sH = cLen * 0.34;
    for (const [sx, sy] of [[cx - dx, cy - dy], [cx + dx, cy - dy], [cx - dx, cy + dy], [cx + dx, cy + dy]]) {
      drumCyl(sx, sy, rS, bodyTop, sTop, opal.drum);
      onion(sx, sy, rS * 1.06, sTop, sH, opal.domeSide);    // secondary domes carry no cross — only the central dome does
    }
    return faces;
  }

  // ── variant: CHAPEL (default) — single steeple ────────────────────────────────
  // proportions from the footprint width — a nave reads ~as tall at the eave as it is wide
  const eave = z0 + Math.max(1.5, cLen * 0.95);
  const ridge = eave + Math.max(0.9, cLen * 0.6);
  const tw = Math.min(cLen * 0.62, aLen * 0.34);        // bell-tower side (square plan, at the front)
  const aBody = a0 + tw;                                 // nave body starts behind the tower
  const cl = c0, cr = c0 + cLen;

  // NAVE — two long side walls + a rear gable wall (front is occluded by the tower)
  lit([P(aBody, cl, z0), P(a1, cl, z0), P(a1, cl, eave), P(aBody, cl, eave)], pal.wall);
  lit([P(aBody, cr, z0), P(a1, cr, z0), P(a1, cr, eave), P(aBody, cr, eave)], pal.wall);
  lit([P(a1, cl, z0), P(a1, cr, z0), P(a1, cr, eave), P(a1, cl, eave)], pal.wall);
  tri(P(a1, cl, eave), P(a1, cr, eave), P(a1, cMid, ridge), pal.wall);          // rear gable triangle
  tri(P(aBody, cl, eave), P(aBody, cr, eave), P(aBody, cMid, ridge), pal.wall); // front gable (under tower roofline)
  // GABLE ROOF — two sloped planes meeting at the ridge
  lit([P(aBody, cl, eave), P(a1, cl, eave), P(a1, cMid, ridge), P(aBody, cMid, ridge)], pal.roof);
  lit([P(aBody, cr, eave), P(a1, cr, eave), P(a1, cMid, ridge), P(aBody, cMid, ridge)], pal.roof);
  // tall arched-window hint: a slim dark recess centred on each nave flank
  const wd = pal.door;
  for (const c of [cl, cr]) {
    const am = (aBody + a1) / 2, wa = Math.min(0.7, (a1 - aBody) * 0.3);
    lit([P(am - wa / 2, c, z0 + eave * 0.18), P(am + wa / 2, c, z0 + eave * 0.18), P(am + wa / 2, c, eave * 0.78), P(am - wa / 2, c, eave * 0.78)], scaleHex(wd, 1.0));
  }

  // BELL TOWER — a tall square shaft at the front, rising above the ridge
  const tc0 = cMid - tw / 2, tc1 = cMid + tw / 2, towerTop = ridge + cLen * 0.55;
  const twWalls = [
    [P(a0, tc0, z0), P(a0 + tw, tc0, z0), P(a0 + tw, tc0, towerTop), P(a0, tc0, towerTop)],
    [P(a0, tc1, z0), P(a0 + tw, tc1, z0), P(a0 + tw, tc1, towerTop), P(a0, tc1, towerTop)],
    [P(a0, tc0, z0), P(a0, tc1, z0), P(a0, tc1, towerTop), P(a0, tc0, towerTop)],          // front face
    [P(a0 + tw, tc0, z0), P(a0 + tw, tc1, z0), P(a0 + tw, tc1, towerTop), P(a0 + tw, tc0, towerTop)],
  ];
  for (const wq of twWalls) lit(wq, pal.wall);
  // belfry louvres: a darker band near the tower top on all four faces
  const bl0 = towerTop - tw * 0.55, bl1 = towerTop - tw * 0.18;
  lit([P(a0, tc0, bl0), P(a0 + tw, tc0, bl0), P(a0 + tw, tc0, bl1), P(a0, tc0, bl1)], scaleHex(pal.door, 1.0));
  lit([P(a0, tc1, bl0), P(a0 + tw, tc1, bl0), P(a0 + tw, tc1, bl1), P(a0, tc1, bl1)], scaleHex(pal.door, 1.0));
  lit([P(a0, tc0, bl0), P(a0, tc1, bl0), P(a0, tc1, bl1), P(a0, tc0, bl1)], scaleHex(pal.door, 1.0));
  // a round-topped door at the tower base (front)
  const dw = tw * 0.5, dc = cMid;
  lit([P(a0, dc - dw / 2, z0), P(a0, dc + dw / 2, z0), P(a0, dc + dw / 2, z0 + tw * 0.9), P(a0, dc - dw / 2, z0 + tw * 0.9)], pal.door);

  // SPIRE — a four-sided pyramid from the tower top to an apex
  const apexA = a0 + tw / 2, spireH = tw * 1.7, apexZ = towerTop + spireH;
  const ring = [[a0, tc0], [a0 + tw, tc0], [a0 + tw, tc1], [a0, tc1]];
  for (let i = 0; i < 4; i++) {
    const [pa, pc] = ring[i], [qa, qc] = ring[(i + 1) % 4];
    tri(P(pa, pc, towerTop), P(qa, qc, towerTop), P(apexA, cMid, apexZ), pal.spire);
  }

  // CROSS — a vertical shaft + a horizontal bar at the apex
  const bar = Math.max(0.05, tw * 0.07), armW = tw * 0.5, armZ = apexZ + spireH * 0.34;
  faces.push(...cityBox({ x: P(apexA, cMid, 0)[0] - bar / 2, y: P(apexA, cMid, 0)[1] - bar / 2, w: bar, d: bar }, apexZ, apexZ + spireH * 0.55, { top: scaleHex(pal.cross, 1.1), side: pal.cross }, L, camHint));
  const armR = { x: P(apexA, cMid, 0)[0] - (along === 'x' ? bar : armW) / 2, y: P(apexA, cMid, 0)[1] - (along === 'x' ? armW : bar) / 2, w: along === 'x' ? bar : armW, d: along === 'x' ? armW : bar };
  faces.push(...cityBox(armR, armZ, armZ + bar, { top: scaleHex(pal.cross, 1.1), side: pal.cross }, L, camHint));
  return faces;
}

// ── religious place (mosque) ─────────────────────────────────────────────────────
// A relative of the church: same planar-face primitive, but the Islamic vocabulary,
// in four regional variants (b.mosqueVariant), all over a cubic prayer hall:
//   • 'ottoman'   (default) — a big central DOME on a low drum, four slender corner
//                 MINARETS (balcony + cap), a pointed-arch ENTRANCE, CRESCENT finials.
//   • 'persian'   — a bulbous turquoise dome on a TALL drum + a grand projecting PISHTAQ
//                 (portal screen with a deep iwan recess) flanked by two front minarets.
//   • 'sahelian'  — West-African mud mosque: NO dome; an ochre adobe mass, a tapering
//                 stepped central MINARET studded with protruding TORON beam-ends, and
//                 four conical-capped corner buttress PILLARS.
//   • 'nusantara' — Javanese: NO dome; a multi-tiered pyramidal hipped ROOF (three stacked
//                 pyramids of decreasing size) topped by a finial + crescent.
// Palette is overridable via b.churchPalette (the per-locale "hatch").
const MOSQUE_PALETTE = { wall: '#e6ddc6', roof: '#cbbf9f', dome: '#2e8074', drum: '#ddd4bd', trim: '#c9bd98', window: '#2c241c', crescent: '#e8c34a' };
const MOSQUE_PALETTES = {
  ottoman: MOSQUE_PALETTE,
  persian: { wall: '#e3d7bd', roof: '#cdbf9d', dome: '#23b3ab', drum: '#dccfb4', trim: '#2f6fae', window: '#21303c', crescent: '#e8c34a' },
  sahelian: { wall: '#b9824a', roof: '#a06e3c', dome: '#b9824a', drum: '#9c6a3a', trim: '#c79a52', window: '#2a1c10', crescent: '#d8b24a', toron: '#5a3c20' },
  nusantara: { wall: '#e2dac4', roof: '#6f4329', dome: '#6f4329', drum: '#caa15f', trim: '#caa15f', window: '#241a10', crescent: '#e8c34a' },
};
// a crescent-moon clip-path (outer circle minus an offset inner circle), in face-% space
const CRESCENT_CLIP = (() => {
  const pts = [], N = 14, oc = [0.42, 0.5], oR = 0.46, ic = [0.6, 0.5], iR = 0.4, d2r = Math.PI / 180;
  for (let i = 0; i <= N; i++) { const a = (60 + 240 * (i / N)) * d2r; pts.push([oc[0] + Math.cos(a) * oR, oc[1] + Math.sin(a) * oR]); }      // outer left arc 60→300
  for (let i = 0; i <= N; i++) { const a = (300 - 240 * (i / N)) * d2r; pts.push([ic[0] + Math.cos(a) * iR, ic[1] + Math.sin(a) * iR]); }     // inner left arc 300→60 (carves)
  return `polygon(${pts.map((p) => `${(p[0] * 100).toFixed(1)}% ${(p[1] * 100).toFixed(1)}%`).join(', ')})`;
})();
function mosqueBuilding(b, L, camHint) {
  const variant = b.mosqueVariant || 'ottoman';
  const pal = { ...(MOSQUE_PALETTES[variant] || MOSQUE_PALETTE), ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const along = b.w >= b.d ? 'x' : 'y', aLen = along === 'x' ? b.w : b.d, cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x, cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);
  // an axis-aligned footprint from (along, across) spans — respects the nave orientation
  const boxAC = (aLo, aHi, cLo, cHi) => (along === 'x'
    ? { x: aLo, y: cLo, w: aHi - aLo, d: cHi - cLo }
    : { x: cLo, y: aLo, w: cHi - cLo, d: aHi - aLo });
  const z0 = b.z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 12;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const DOME = [[0, 1.0], [0.32, 0.99], [0.56, 0.9], [0.76, 0.74], [0.9, 0.46], [1.0, 0.0]];     // rounded, slightly pointed
  const BULB = [[0, 0.86], [0.12, 0.99], [0.30, 1.08], [0.5, 1.02], [0.68, 0.82], [0.85, 0.48], [1.0, 0.0]];  // bulbous (persian onion)
  const revolve = (prof, ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of prof) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  const dome = (ox, oy, baseR, baseZ, h, tint) => revolve(DOME, ox, oy, baseR, baseZ, h, tint);
  // a square/rect PYRAMID (four triangular hips to a centred apex) — the tiered-roof unit
  const pyramidRect = (x, y, w, d, zb, ph, tint) => {
    const cs = [[x, y, zb], [x + w, y, zb], [x + w, y + d, zb], [x, y + d, zb]], ap = [x + w / 2, y + d / 2, zb + ph];
    for (let i = 0; i < 4; i++) tri(cs[i], cs[(i + 1) % 4], ap, tint);
  };
  // a gilded crescent billboard standing on a thin finial, facing the camera
  const crescent = (ox, oy, zb, s, tint) => {
    const dx = camHint[0] - ox, dy = camHint[1] - oy, l = Math.hypot(dx, dy) || 1, tx = -dy / l * s / 2, ty = dx / l * s / 2;
    const post = Math.max(0.03, s * 0.12);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + s * 0.5, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    const c0c = [ox - tx, oy - ty, zb + s * 0.5], c1c = [ox + tx, oy + ty, zb + s * 0.5];
    faces.push({ corners: [c0c, c1c, [c1c[0], c1c[1], zb + s * 1.3], [c0c[0], c0c[1], zb + s * 1.3]], fill: scaleHex(tint, litFactor([0, 0, 1], L)), doubleSided: true, clip: CRESCENT_CLIP });
  };
  // arched opening proud of the FRONT plane (a = a0, exterior toward −A)
  const eps = 0.04, archF = (cA, cB, zlo, zTop, tint) => { const cs = [P(a0 - eps, cA, zlo), P(a0 - eps, cB, zlo), P(a0 - eps, cB, zTop), P(a0 - eps, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 50% 50% / 0 0 46% 46%' }); };

  // a corner minaret (shaft + balcony ring + cap dome + crescent), reused by ottoman & persian
  const minaret = (mx, my, rM, mTop, capH) => {
    drum(mx, my, rM, z0, mTop, pal.wall);
    const balZ = z0 + (mTop - z0) * 0.74;
    drum(mx, my, rM * 1.6, balZ, balZ + cLen * 0.05, pal.trim);
    dome(mx, my, rM * 1.15, mTop, capH, pal.dome);
    crescent(mx, my, mTop + capH, cLen * 0.2, pal.crescent);
  };

  // BODY — a broad cubic prayer hall (shared by every variant)
  const bodyTop = z0 + Math.max(2.2, cLen * 0.82);
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, bodyTop, { top: scaleHex(pal.roof, 1.0), side: pal.wall }, L, camHint));
  if (variant === 'sahelian') {
    // the tower-over-entrance facade carries the door; just a modest door + slit windows here
    archF(cMid - cLen * 0.08, cMid + cLen * 0.08, z0 + 0.02, z0 + (bodyTop - z0) * 0.5, pal.window);
    for (const cc of [c0 + cLen * 0.25, c0 + cLen * 0.75]) archF(cc - 0.045, cc + 0.045, z0 + (bodyTop - z0) * 0.46, z0 + (bodyTop - z0) * 0.7, pal.window);
  } else {
    archF(cMid - cLen * 0.15, cMid + cLen * 0.15, z0 + 0.02, z0 + (bodyTop - z0) * 0.78, pal.window);                       // grand entrance (iwan)
    for (const cc of [c0 + cLen * 0.2, c0 + cLen * 0.8]) archF(cc - cLen * 0.06, cc + cLen * 0.06, z0 + (bodyTop - z0) * 0.34, z0 + (bodyTop - z0) * 0.72, pal.window);
  }

  if (variant === 'persian') {
    // bulbous turquoise dome on a TALL drum
    const rC = cLen * 0.3, drumTop = bodyTop + cLen * 0.42, domeH = cLen * 0.82;
    drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
    revolve(BULB, cx, cy, rC * 1.06, drumTop, domeH, pal.dome);
    crescent(cx, cy, drumTop + domeH, cLen * 0.3, pal.crescent);
    // PISHTAQ — a tall portal screen projecting above the roofline, with a deep iwan recess
    const pw = cLen * 0.56, pt = Math.max(0.25, cLen * 0.16), pTop = bodyTop + cLen * 0.5;
    faces.push(...cityBox(boxAC(a0, a0 + pt, cMid - pw / 2, cMid + pw / 2), z0, pTop, { top: scaleHex(pal.trim, 1.05), side: pal.wall }, L, camHint));
    archF(cMid - pw * 0.34, cMid + pw * 0.34, z0 + 0.02, pTop - cLen * 0.16, pal.window);                                   // the iwan
    // two slender minarets flanking the pishtaq at the front corners
    const rM = cLen * 0.05, mTop = z0 + Math.max(4.5, cLen * 2.1), capH = cLen * 0.34, mi = cLen * 0.1;
    for (const [mx, my] of [P(a0 + mi, c0 + mi, 0), P(a0 + mi, c0 + cLen - mi, 0)]) minaret(mx, my, rM, mTop, capH);
  } else if (variant === 'sahelian') {
    // NO dome. A tapering, stepped central MINARET at the front, studded with toron beam-ends,
    // plus four conical-capped corner buttress pillars. Earthen ochre throughout.
    const tw0 = cLen * 0.34, twTop = z0 + Math.max(4, cLen * 1.8), aTw = a0 + tw0 * 0.55, steps = 4;
    for (let i = 0; i < steps; i++) {
      const w = tw0 * (1 - 0.5 * (i / steps)), zl = z0 + (twTop - z0) * (i / steps), zh = z0 + (twTop - z0) * ((i + 1) / steps) + 0.03;
      faces.push(...cityBox(boxAC(aTw - w / 2, aTw + w / 2, cMid - w / 2, cMid + w / 2), zl, zh, { top: scaleHex(pal.roof, 1.06), side: pal.wall }, L, camHint));
    }
    const protr = Math.max(0.08, cLen * 0.05);   // toron — rows of protruding wooden beam-ends
    for (let row = 0; row < 3; row++) {
      const f = 0.28 + row * 0.2, zt = z0 + (twTop - z0) * f, w = tw0 * (1 - 0.5 * f);
      for (let k = -1; k <= 1; k++) {
        const cc = cMid + k * w * 0.32;
        faces.push(...cityBox(boxAC(aTw - w / 2 - protr, aTw - w / 2 + 0.02, cc - 0.05, cc + 0.05), zt, zt + 0.07, { top: pal.toron, side: pal.toron }, L, camHint));
      }
    }
    const twC = P(aTw, cMid, 0);
    crescent(twC[0], twC[1], twTop, cLen * 0.18, pal.crescent);
    const pin = cLen * 0.08, pinH = z0 + Math.max(2.8, cLen * 1.05), pinIn = cLen * 0.1;
    for (const [px, py] of [[b.x + pinIn, b.y + pinIn], [b.x + b.w - pinIn, b.y + pinIn], [b.x + pinIn, b.y + b.d - pinIn], [b.x + b.w - pinIn, b.y + b.d - pinIn]]) {
      faces.push(...cityBox({ x: px - pin / 2, y: py - pin / 2, w: pin, d: pin }, z0, pinH, { top: scaleHex(pal.wall, 1.05), side: pal.wall }, L, camHint));
      pyramidRect(px - pin / 2, py - pin / 2, pin, pin, pinH, cLen * 0.18, pal.trim);   // conical/pinnacle cap
    }
  } else if (variant === 'nusantara') {
    // NO dome. A multi-tiered pyramidal hipped roof (three stacked pyramids) + finial.
    // Low pitch + wide eaves + small vertical steps → a broad Javanese meru, not a fir tree.
    const roofH = cLen * 1.05;
    const tiers = [{ wf: 1.0, z: 0.0, hf: 0.32 }, { wf: 0.72, z: 0.22, hf: 0.34 }, { wf: 0.42, z: 0.46, hf: 0.5 }];
    for (const t of tiers) {
      const w = b.w * t.wf, d = b.d * t.wf;
      pyramidRect(cx - w / 2, cy - d / 2, w, d, bodyTop + roofH * t.z, roofH * t.hf, pal.roof);
    }
    const topZ = bodyTop + roofH * 0.96, fin = cLen * 0.06;
    faces.push(...cityBox({ x: cx - fin / 2, y: cy - fin / 2, w: fin, d: fin }, topZ, topZ + cLen * 0.18, { top: scaleHex(pal.trim, 1.1), side: pal.trim }, L, camHint));
    crescent(cx, cy, topZ + cLen * 0.18, cLen * 0.16, pal.crescent);
  } else {
    // OTTOMAN (default) — central dome on a low drum + four corner minarets
    const rC = cLen * 0.3, drumTop = bodyTop + cLen * 0.22, domeH = cLen * 0.62;
    drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
    dome(cx, cy, rC * 1.02, drumTop, domeH, pal.dome);
    crescent(cx, cy, drumTop + domeH, cLen * 0.34, pal.crescent);
    const inset = cLen * 0.13, rM = cLen * 0.055, mTop = z0 + Math.max(4, cLen * 1.95), capH = cLen * 0.4;
    for (const [mx, my] of [[b.x + inset, b.y + inset], [b.x + b.w - inset, b.y + inset], [b.x + inset, b.y + b.d - inset], [b.x + b.w - inset, b.y + b.d - inset]]) minaret(mx, my, rM, mTop, capH);
  }
  return faces;
}

// ── religious place (Buddhist temple) ────────────────────────────────────────────
// The third sibling under class:'religious' — the Buddhist vocabulary, in three regional
// variants (b.templeVariant), each its own mass over the same planar-face primitive:
//   • 'pagoda'  (East Asian — China/Japan/Korea) — a slender multi-storey TOWER of stacked
//               cinnabar-red bodies under wide overhanging jade-tile HIP ROOFS, on a stone
//               podium, crowned by a tall gilded SORIN finial.
//   • 'stupa'   (Theravada — Thailand/Myanmar/Sri Lanka) — a white BELL dome (anda) on a
//               stepped square base, a small harmika, and a tall tapering gilded SPIRE of
//               stacked chattra rings (hti). A surface of revolution.
//   • 'tibetan' (Himalayan — Tibet/Nepal/Bhutan) — a blocky white MONASTERY with a dark-red
//               maroon FRIEZE band near the top, trapezoidal windows, a flat roof, and a
//               central gilded DHARMACHAKRA wheel flanked by two gyaltsen banners.
// Palette per variant from TEMPLE_PALETTES; overridable via b.churchPalette.
const TEMPLE_PALETTES = {
  pagoda: { wall: '#a23b2e', roof: '#3d6b54', eave: '#2f5142', podium: '#7d6f57', trim: '#caa15f', window: '#241410', finial: '#d8b24a' },
  stupa: { base: '#e7e1d0', bell: '#efe9db', band: '#caa15f', spire: '#d8b24a', harmika: '#e2dcc9', window: '#3a2b22', finial: '#e8c34a' },
  tibetan: { wall: '#ece6d6', band: '#7a2e26', frame: '#e6dfcc', gold: '#d8b24a', roof: '#b9904a', window: '#241810' },
};
function templeBuilding(b, L, camHint) {
  const variant = b.templeVariant || 'pagoda';
  const pal = { ...(TEMPLE_PALETTES[variant] || TEMPLE_PALETTES.pagoda), ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const along = b.w >= b.d ? 'x' : 'y', cLen = along === 'x' ? b.d : b.w;
  const a0 = along === 'x' ? b.x : b.y, c0 = along === 'x' ? b.y : b.x, cMid = c0 + cLen / 2;
  const P = (a, c, z) => (along === 'x' ? [a, c, z] : [c, a, z]);
  const z0 = b.z0, cx = b.x + b.w / 2, cy = b.y + b.d / 2, Nr = 14;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  const revolve = (prof, ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of prof) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  // a wide overhanging hip roof: four triangular hips to a centred apex (shallow pitch)
  const hipRoof = (hx, hy, half, zb, ph, tint) => {
    const cs = [[hx - half, hy - half, zb], [hx + half, hy - half, zb], [hx + half, hy + half, zb], [hx - half, hy + half, zb]], ap = [hx, hy, zb + ph];
    for (let i = 0; i < 4; i++) tri(cs[i], cs[(i + 1) % 4], ap, tint);
  };
  // a recess (door / window) proud of a front plane at along-coord aFace (exterior toward −A)
  const eps = 0.04, aCen = along === 'x' ? cx : cy;
  const openAt = (aFace, cA, cB, zlo, zTop, tint, radius) => { const cs = [P(aFace - eps, cA, zlo), P(aFace - eps, cB, zlo), P(aFace - eps, cB, zTop), P(aFace - eps, cA, zTop)]; faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, ...(radius ? { radius } : {}) }); };
  const openF = (cA, cB, zlo, zTop, tint, radius) => openAt(a0, cA, cB, zlo, zTop, tint, radius);   // on the box front
  // a slim gilded finial: post + stacked beads + crowning point
  const finial = (ox, oy, zb, h, tint) => {
    const post = Math.max(0.04, h * 0.06);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + h * 0.55, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    for (let k = 0; k < 3; k++) drum(ox, oy, h * (0.14 - k * 0.03), zb + h * (0.4 + k * 0.16), zb + h * (0.46 + k * 0.16), tint);
    revolve([[0, 1], [1, 0]], ox, oy, h * 0.08, zb + h * 0.88, h * 0.16, tint);
  };

  if (variant === 'stupa') {
    // stepped square base
    const s = Math.min(b.w, b.d);
    let bz = z0;
    for (let i = 0; i < 3; i++) {
      const hw = s * (0.5 - i * 0.08), th = s * 0.12;
      faces.push(...cityBox({ x: cx - hw, y: cy - hw, w: hw * 2, d: hw * 2 }, bz, bz + th, { top: scaleHex(pal.base, 1.06), side: pal.base }, L, camHint));
      bz += th;
    }
    // BELL dome (anda) — a white surface of revolution
    const BELL = [[0, 0.78], [0.16, 0.92], [0.34, 1.0], [0.54, 0.95], [0.72, 0.8], [0.86, 0.58], [1.0, 0.34]];
    const rB = s * 0.4, domeH = s * 0.78;
    drum(cx, cy, rB, bz, bz + s * 0.04, pal.band);                       // gold base ring
    revolve(BELL, cx, cy, rB, bz + s * 0.04, domeH, pal.bell);
    const domeTopZ = bz + s * 0.04 + domeH;
    // harmika — a small gold-banded box on the dome
    const hk = s * 0.12;
    faces.push(...cityBox({ x: cx - hk, y: cy - hk, w: hk * 2, d: hk * 2 }, domeTopZ, domeTopZ + s * 0.12, { top: scaleHex(pal.harmika, 1.05), side: pal.band }, L, camHint));
    // SPIRE (hti) — a tall taper of stacked gold chattra rings
    let sz = domeTopZ + s * 0.12; const rings = 7, sH = s * 0.7;
    for (let i = 0; i < rings; i++) {
      const r = s * 0.13 * (1 - i / (rings + 1)), zl = sz + (sH * 0.82) * (i / rings);
      drum(cx, cy, r, zl, zl + sH * 0.05, pal.spire);
    }
    finial(cx, cy, sz + sH * 0.82, s * 0.5, pal.finial);
  } else if (variant === 'tibetan') {
    // blocky white monastery with a battered base (a slightly wider lower box), a maroon
    // frieze band near the top, a flat roof, trapezoidal windows, and a gold roof ornament.
    const s = Math.min(b.w, b.d), top = z0 + Math.max(2.6, cLen * 1.0);
    faces.push(...cityBox({ x: b.x - s * 0.02, y: b.y - s * 0.02, w: b.w + s * 0.04, d: b.d + s * 0.04 }, z0, z0 + (top - z0) * 0.16, { top: scaleHex(pal.wall, 0.92), side: scaleHex(pal.wall, 0.92) }, L, camHint));   // battered plinth
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0 + (top - z0) * 0.16, top, { top: scaleHex(pal.roof, 1.0), side: pal.wall }, L, camHint));    // white body, flat gold-ish roof
    // maroon frieze band (benma) near the top, slightly proud
    const bandLo = z0 + (top - z0) * 0.78;
    faces.push(...cityBox({ x: b.x - s * 0.015, y: b.y - s * 0.015, w: b.w + s * 0.03, d: b.d + s * 0.03 }, bandLo, top, { top: scaleHex(pal.band, 1.05), side: pal.band }, L, camHint));
    // tall black trapezoidal windows (wider top → tibetan eyebrow) with a thin maroon lintel,
    // two rows of three. The black frame IS the motif; a white reveal sits just inside it.
    for (const zc of [0.3, 0.56]) {
      for (const cc of [c0 + cLen * 0.27, c0 + cLen * 0.5, c0 + cLen * 0.73]) {
        const ww = cLen * 0.06, zlo = z0 + (top - z0) * zc, zhi = z0 + (top - z0) * (zc + 0.2);
        openF(cc - ww * 1.3, cc + ww * 1.3, zhi, zhi + (top - z0) * 0.025, pal.band);   // maroon lintel eyebrow
        openF(cc - ww * 1.3, cc + ww * 1.3, zlo, zhi, pal.window);                       // black trapezoid frame
        openF(cc - ww * 0.55, cc + ww * 0.55, zlo + (zhi - zlo) * 0.18, zhi - (zhi - zlo) * 0.12, pal.frame);   // pale reveal
      }
    }
    openF(cMid - cLen * 0.11, cMid + cLen * 0.11, z0 + 0.02, z0 + (top - z0) * 0.34, pal.window);   // doorway
    // gold roof ornament: a central DHARMACHAKRA wheel on a short post (front-centre), flanked
    // left & right by two gyaltsen victory banners (tapered gold cylinders) — well separated.
    const wc = P(a0 + cLen * 0.34, cMid, 0), postH = cLen * 0.12, wr = cLen * 0.13;
    drum(wc[0], wc[1], cLen * 0.028, top, top + postH, pal.gold);                       // post
    faces.push({ corners: [[wc[0] - wr, wc[1], top + postH], [wc[0] + wr, wc[1], top + postH], [wc[0] + wr, wc[1], top + postH + wr * 2], [wc[0] - wr, wc[1], top + postH + wr * 2]], fill: scaleHex(pal.gold, litFactor([0, 1, 0], L)), doubleSided: true, radius: '50%' });   // the wheel disc
    drum((wc[0] + cx) / 2, (wc[1] + cy) / 2, wr * 0.28, top + postH + wr * 0.7, top + postH + wr * 1.3, scaleHex(pal.gold, 0.8));   // hub
    for (const cc of [c0 + cLen * 0.16, c0 + cLen * 0.84]) {
      const g = P(aCen, cc, 0);
      drum(g[0], g[1], cLen * 0.04, top, top + cLen * 0.4, pal.gold);
      revolve([[0, 1], [1, 0]], g[0], g[1], cLen * 0.055, top + cLen * 0.4, cLen * 0.14, pal.gold);
    }
  } else {
    // PAGODA — a slender multi-storey tower of red bodies under overhanging jade hip roofs.
    const podiumTop = z0 + cLen * 0.16;
    faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, podiumTop, { top: scaleHex(pal.podium, 1.06), side: pal.podium }, L, camHint));
    const lvls = 4;
    let z = podiumTop, half = cLen * 0.32;
    for (let i = 0; i < lvls; i++) {
      const bh = cLen * (0.46 - i * 0.05);                    // body segment height
      faces.push(...cityBox({ x: cx - half, y: cy - half, w: half * 2, d: half * 2 }, z, z + bh, { top: scaleHex(pal.wall, 0.85), side: pal.wall }, L, camHint));
      const aF = aCen - half;   // the inset body's own front face (NOT the box edge)
      if (i === 0) openAt(aF, cMid - half * 0.45, cMid + half * 0.45, z + 0.02, z + bh * 0.7, pal.window, '0 0 44% 44% / 0 0 40% 40%');   // arched door
      else openAt(aF, cMid - half * 0.28, cMid + half * 0.28, z + bh * 0.28, z + bh * 0.72, pal.window, '0 0 40% 40% / 0 0 36% 36%');     // a single arched window
      z += bh;
      const ov = half * 1.5;                                  // wide overhanging eaves
      drum(cx, cy, ov * 1.02, z, z + cLen * 0.03, pal.eave);  // a thin eave fascia lip (octagonal hint)
      hipRoof(cx, cy, ov, z + cLen * 0.03, cLen * 0.2, pal.roof);
      z += cLen * 0.12;                                       // next storey rises out of the roof
      half *= 0.8;
    }
    finial(cx, cy, z, cLen * 0.9, pal.finial);
  }
  return faces;
}

// ── landmark: Taj Mahal ────────────────────────────────────────────────────────────
// A relative of the mosque at recognizable-silhouette fidelity: a white-marble cube on a
// raised PLINTH, a big bulbous amrud (guava) ONION dome on a tall drum with a gilded
// finial, four corner CHATTRIS (domed kiosks) framing it, a tall pointed-arch PISHTAQ
// (iwan) recessed in a raised frame on each face, and four detached tapering MINARETS at
// the plinth corners. Same planar-face + tri()/onion kit as the mosque. Symmetric square
// plan — the real chamfered corners + outward minaret tilt are deferred (see plan).
const TAJ_PALETTE = { plinth: '#d8d1c0', wall: '#ece8dd', roof: '#d8d2c4', dome: '#e9e4d7', drum: '#e1dccd', frame: '#e4dfd1', recess: '#5b5346', trim: '#caa63f', minaret: '#e6e1d4' };
function tajMahalBuilding(b, L, camHint) {
  const pal = { ...TAJ_PALETTE, ...(b.churchPalette || {}) };
  const faces = [];
  const lit = (corners, tint) => faces.push({ corners, fill: scaleHex(tint, litFactor(normalToward(corners, camHint), L)), doubleSided: true });
  const tri = (A, B, T, tint) => {
    const Uw = sub(B, A), ub = norm(Uw), Vw = sub(sub(T, A), scale(ub, dot(sub(T, A), ub)));
    if (len(Vw) < 1e-4) return;
    faces.push({ corners: [A, B, add(B, Vw), add(A, Vw)], fill: scaleHex(tint, litFactor(normalToward([A, B, T], camHint), L)), doubleSided: true, clip: `polygon(0% 0%, 100% 0%, ${(dot(sub(T, A), ub) / len(Uw) * 100).toFixed(1)}% 100%)` });
  };
  const cx = b.x + b.w / 2, cy = b.y + b.d / 2, side = Math.min(b.w, b.d), z0 = b.z0, Nr = 16;
  const ring = (r, z, ox, oy) => Array.from({ length: Nr }, (_, i) => { const a = (i / Nr) * 2 * Math.PI; return [ox + Math.cos(a) * r, oy + Math.sin(a) * r, z]; });
  const band = (lo, hi, tint) => { for (let i = 0; i < Nr; i++) { const j = (i + 1) % Nr; lit([lo[i], lo[j], hi[j], hi[i]], tint); } };
  const drum = (ox, oy, r, zl, zh, tint) => band(ring(r, zl, ox, oy), ring(r, zh, ox, oy), tint);
  // bulbous amrud onion profile: [heightFrac, radiusFactor] — bulges past 1.0, necks to a point
  const ONION = [[0, 0.86], [0.12, 1.0], [0.28, 1.08], [0.46, 1.02], [0.62, 0.82], [0.76, 0.56], [0.88, 0.3], [1.0, 0.0]];
  const onion = (ox, oy, baseR, baseZ, h, tint) => {
    let prev = null;
    for (const [hf, rf] of ONION) {
      const z = baseZ + hf * h, r = baseR * rf, pts = r < 1e-3 ? null : ring(r, z, ox, oy);
      if (prev) { if (pts) band(prev, pts, tint); else { const ap = [ox, oy, z]; for (let i = 0; i < Nr; i++) tri(prev[i], prev[(i + 1) % Nr], ap, tint); } }
      if (pts) prev = pts;
    }
  };
  // a slim gilded finial: a thin post + a small bead + a crowning bud
  const finial = (ox, oy, zb, h, tint) => {
    const post = Math.max(0.04, h * 0.07);
    faces.push(...cityBox({ x: ox - post / 2, y: oy - post / 2, w: post, d: post }, zb, zb + h * 0.6, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    drum(ox, oy, h * 0.12, zb + h * 0.48, zb + h * 0.58, tint);
    onion(ox, oy, h * 0.1, zb + h * 0.58, h * 0.42, tint);
  };

  // PLINTH — a low wide marble terrace; minarets stand at its corners. Kept low so the
  // whole composition reads WIDE (the real Taj is ~1.3:1 span-to-height, not a tall tower).
  const eps = 0.04;
  const plinthTop = z0 + side * 0.05;
  faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, z0, plinthTop, { top: scaleHex(pal.plinth, 1.06), side: pal.plinth }, L, camHint));

  // BODY — an OCTAGONAL (chamfered-square) marble mass, straight from the top-down mandala:
  // a square with its four corners cut → 4 cardinal faces (pishtaqs) + 4 diagonal faces
  // (corner niches). bh = half-width, ch = corner chamfer.
  const bh = side * 0.30, ch = bh * 0.42, bodyTop = plinthTop + side * 0.26;
  const oct = [
    [cx + bh, cy - (bh - ch)], [cx + bh, cy + (bh - ch)],   // +x cardinal face
    [cx + (bh - ch), cy + bh], [cx - (bh - ch), cy + bh],   // +y cardinal face
    [cx - bh, cy + (bh - ch)], [cx - bh, cy - (bh - ch)],   // -x cardinal face
    [cx - (bh - ch), cy - bh], [cx + (bh - ch), cy - bh],   // -y cardinal face
  ];
  for (let i = 0; i < 8; i++) {
    const p = oct[i], q = oct[(i + 1) % 8];
    lit([[p[0], p[1], plinthTop], [q[0], q[1], plinthTop], [q[0], q[1], bodyTop], [p[0], p[1], bodyTop]], pal.wall);
    tri([p[0], p[1], bodyTop], [q[0], q[1], bodyTop], [cx, cy, bodyTop], pal.roof);   // flat octagon roof, fanned to centre
  }

  // a recessed pointed-arch niche on a wall edge p→q, between zlo..zhi, half-width = frac·edge
  const recessArch = (p, q, zlo, zhi, frac, tint) => {
    const ex = q[0] - p[0], ey = q[1] - p[1], el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el;
    const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
    let nx = -uy, ny = ux; if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }   // outward normal
    const hw = el * frac, ox = mx + nx * eps, oy = my + ny * eps;
    const A = [ox + ux * hw, oy + uy * hw, zlo], B = [ox - ux * hw, oy - uy * hw, zlo];
    const cs = [A, B, [B[0], B[1], zhi], [A[0], A[1], zhi]];
    faces.push({ corners: cs, fill: scaleHex(tint, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 46% 46% / 0 0 60% 60%' });
  };

  // PISHTAQ — a tall arched portal in a raised frame that rises ABOVE the cornice, on each
  // of the 4 cardinal faces. Frame projects proud of the wall; a deep recessed arch sits within.
  const proud = side * 0.03, frameTop = bodyTop + side * 0.06, pishW = (bh - ch) * 1.7;
  for (const [nx, ny] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const fcx = cx + nx * bh, fcy = cy + ny * bh, tx = -ny, ty = nx;
    const px = fcx + nx * proud, py = fcy + ny * proud;
    const A = [px + tx * pishW / 2, py + ty * pishW / 2, plinthTop], B = [px - tx * pishW / 2, py - ty * pishW / 2, plinthTop];
    lit([A, B, [B[0], B[1], frameTop], [A[0], A[1], frameTop]], pal.frame);                       // raised frame
    const rx = fcx + nx * (proud + eps), ry = fcy + ny * (proud + eps), rw = pishW * 0.66, rTop = bodyTop + (frameTop - bodyTop) * 0.2;
    const ra = [rx + tx * rw / 2, ry + ty * rw / 2, plinthTop + eps], rb = [rx - tx * rw / 2, ry - ty * rw / 2, plinthTop + eps];
    const cs = [ra, rb, [rb[0], rb[1], rTop], [ra[0], ra[1], rTop]];
    faces.push({ corners: cs, fill: scaleHex(pal.recess, litFactor(normalToward(cs, camHint), L)), doubleSided: true, radius: '0 0 44% 44% / 0 0 56% 56%' });  // deep arch
  }

  // CORNER NICHES — two stacked arched alcoves on each chamfered (diagonal) face
  const hh = bodyTop - plinthTop;
  for (const [ia, ib] of [[1, 2], [3, 4], [5, 6], [7, 0]]) {
    const p = oct[ia], q = oct[ib];
    recessArch(p, q, plinthTop + hh * 0.08, plinthTop + hh * 0.46, 0.3, pal.recess);   // lower alcove
    recessArch(p, q, plinthTop + hh * 0.52, plinthTop + hh * 0.9, 0.3, pal.recess);    // upper alcove
  }

  // CENTRAL drum + big bulbous onion dome + gilded finial (bulb radius ≈ its height). The
  // dome is the dominant mass — a tall drum lifts it clear of the chattris.
  const rC = bh * 0.52, drumTop = bodyTop + side * 0.14, domeH = rC * 1.95;
  drum(cx, cy, rC, bodyTop, drumTop, pal.drum);
  onion(cx, cy, rC * 1.05, drumTop, domeH, pal.dome);
  finial(cx, cy, drumTop + domeH, side * 0.13, pal.trim);

  // FOUR CHATTRIS — domed kiosks over the chamfered corners (mandala: on the diagonals)
  const chOff = (bh - ch / 2) * 0.92, rCh = side * 0.05, chTop = bodyTop + side * 0.08, chH = side * 0.16;
  for (const [sx, sy] of [[cx - chOff, cy - chOff], [cx + chOff, cy - chOff], [cx - chOff, cy + chOff], [cx + chOff, cy + chOff]]) {
    drum(sx, sy, rCh, bodyTop, chTop, pal.drum);
    onion(sx, sy, rCh * 1.1, chTop, chH, pal.dome);
    finial(sx, sy, chTop + chH, side * 0.09, pal.trim);
  }

  // FOUR detached MINARETS at the TRUE plinth corners — slender tapering shafts with balcony
  // rings + a small chattri cap. Tips reach ~the dome shoulder, well below the central finial
  // (kept vertical; the real outward tilt is deferred).
  const mInset = side * 0.05, rM = side * 0.045, mTop = plinthTop + side * 0.36, capH = side * 0.09;
  for (const [mx, my] of [[b.x + mInset, b.y + mInset], [b.x + b.w - mInset, b.y + mInset], [b.x + mInset, b.y + b.d - mInset], [b.x + b.w - mInset, b.y + b.d - mInset]]) {
    drum(mx, my, rM, plinthTop, mTop, pal.minaret);
    for (const t of [0.4, 0.64, 0.85]) { const bz = plinthTop + (mTop - plinthTop) * t; drum(mx, my, rM * 1.5, bz, bz + side * 0.025, pal.trim); }
    drum(mx, my, rM * 1.3, mTop, mTop + side * 0.035, pal.minaret);
    onion(mx, my, rM * 1.25, mTop + side * 0.035, capH, pal.dome);
    finial(mx, my, mTop + side * 0.035 + capH, side * 0.09, pal.trim);
  }
  return faces;
}

/**
 * Resolve a planArchitectureMandala plan into world-space planar faces.
 * @returns {{ faces, faceCount }}
 */
export function extractArchitectureSceneFaces({ plan, cityBasis = DEFAULT_CITY_BASIS, cameras = DEFAULT_CITY_CAMERAS, light } = {}) {
  const L = light || makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
  const m = cityBasis.map;
  const camHint = cameras[0]?.worldFraming?.cameraPosition || [-7, 31, 9];
  const faces = [];
  const surfById = new Map(plan.surfaces.map((s) => [s.id, s]));
  const activeSurfaceIds = new Set(plan.allocations.map((a) => a.surfaceId));

  // base ground
  faces.push(groundFace({ x: m.x0, y: m.y0, w: cityBasis.worldExtent.width * 0.9, d: cityBasis.worldExtent.depth * 0.84 }, 0, '#cdd3bb', L));

  // active ground-type surfaces (roads/sidewalks/plazas/lots/fields) as tinted planes
  for (const id of activeSurfaceIds) {
    const s = surfById.get(id);
    if (!s || !GROUND_TINT[s.kind]) continue;
    faces.push(groundFace(surfaceWorldRect(s, m), 0.03, GROUND_TINT[s.kind], L));
  }

  // buildings from active facade/mass surfaces (slab footprint + facade window grid)
  for (const id of activeSurfaceIds) {
    const s = surfById.get(id);
    if (!s || !['facadeFace', 'buildingMass', 'radialBuildingMass'].includes(s.kind)) continue;
    const r0 = surfaceWorldRect(s, m);
    const r = { x: r0.x, y: r0.y, w: r0.w, d: s.id.includes('building.b') ? 1.15 : 1.35 };
    const h = s.id.includes('building.b') ? 4.4 : 5.2;
    const facade = makeFacade(cityHash(s.id), { height: h });
    const floors = facadeFloors(facade, h);
    const bays = facadeBays(facade, r.w);
    faces.push(...cityBox(r, 0, h, { facade, floors, bays, top: scaleHex(facade.glass, 0.62) }, L, camHint));
  }

  // props / street furniture / lamps (small boxes at their concept height)
  for (const a of plan.allocations) {
    const s = surfById.get(a.surfaceId);
    if (!s) continue;
    if (a.conceptId === 'urban.sidewalk-road') {
      faces.push(groundFace(slotWorldRect(s, a.slot, m), 0.05, '#333a44', L));
      continue;
    }
    if (a.family === 'urban' || a.family === 'infrastructure' || a.family === 'civic') {
      const h = PROP_HEIGHT[a.conceptId] || 0.9;
      const r0 = slotWorldRect(s, a.slot, m);
      // narrow the footprint a touch so props read as objects, not pads
      const r = { x: r0.x + r0.w * 0.2, y: r0.y + r0.d * 0.2, w: Math.max(0.3, r0.w * 0.6), d: Math.max(0.3, r0.d * 0.6) };
      const hsh = cityHash(a.id);
      const tint = PROP_PAL[hsh % PROP_PAL.length];
      faces.push(...cityBox(r, 0.06, h, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    }
  }
  return { faces, faceCount: faces.length };
}

/** Plan a city (concepts → allocations) and render it as self-contained preserve-3d HTML. */
export function renderArchitectureSceneToHtml({ conceptIds, prompt, seed, cameras = DEFAULT_CITY_CAMERAS, cityBasis = DEFAULT_CITY_BASIS, viewBox = { width: 1120, height: 780 }, unitScale = 22, title = 'mojulo city', light } = {}) {
  const plan = planArchitectureMandala({ conceptIds, prompt, seed });
  const { faces } = extractArchitectureSceneFaces({ plan, cityBasis, cameras, light });
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title, bg: '#0e1014' });
}

// A SMOOTH ribbon following a 2D path: a strip of quads (deck top) + side fascia,
// arbitrary-oriented (not axis-aligned boxes). path = [[x,y],...] in world.
function ribbonFaces(ribbon, L, camHint) {
  const { path, z0, z1, width, tint } = ribbon, hw = width / 2;
  const left = [], right = [];
  for (let i = 0; i < path.length; i++) {
    const a = path[Math.max(0, i - 1)], b = path[Math.min(path.length - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const px = -ty, py = tx;                                  // in-plane perpendicular
    left.push([path[i][0] + px * hw, path[i][1] + py * hw]);
    right.push([path[i][0] - px * hw, path[i][1] - py * hw]);
  }
  const faces = [], topFill = scaleHex(tint, litFactor([0, 0, 1], L));
  const fasciaFill = scaleHex(tint, 0.7);
  for (let i = 0; i < path.length - 1; i++) {
    const top = [[left[i][0], left[i][1], z1], [right[i][0], right[i][1], z1], [right[i + 1][0], right[i + 1][1], z1], [left[i + 1][0], left[i + 1][1], z1]];
    faces.push({ corners: windToward(top, [(top[0][0] + top[2][0]) / 2, (top[0][1] + top[2][1]) / 2, 1e4]), fill: topFill });
    if (z1 - z0 > 0.05) {
      faces.push({ corners: [[left[i][0], left[i][1], z0], [left[i][0], left[i][1], z1], [left[i + 1][0], left[i + 1][1], z1], [left[i + 1][0], left[i + 1][1], z0]], fill: fasciaFill, doubleSided: true });
      faces.push({ corners: [[right[i][0], right[i][1], z0], [right[i][0], right[i][1], z1], [right[i + 1][0], right[i + 1][1], z1], [right[i + 1][0], right[i + 1][1], z0]], fill: fasciaFill, doubleSided: true });
    }
  }
  return faces;
}

/**
 * Assemble a world-box scene into the engine-agnostic scene payload
 * ({ faces, cameras, viewBox, unitScale, title, bg, sky }) WITHOUT emitting.
 * This is the shared seam: the CSS-3D path (renderBoxCityToHtml) and the
 * three.js World path (emitThreeWorld via the /world route) both consume the
 * same baked faces, so generators (fractal-city, transportation-hub) never
 * need to know which renderer is downstream.
 *
 * box: { x, y, w, d, z0, z1, kind?, glass?, tint? }  ground: { x, y, w, d, z?, fill? }
 * ribbon: { path:[[x,y]...], z0, z1, width, tint }
 * faces: caller-supplied raw faces appended verbatim — { corners:[[x,y,z]x4], fill?|bg?, clip?, html?, doubleSided?, card?, lit? }.
 *        Lets generators emit pre-shaded geometry with SVG/clip decals (e.g. vehicle stickers).
 */
export function assembleBoxCityScene({ boxes = [], grounds = [], ribbons = [], faces: extraFaces = [], sources = [], diffusion = {}, moonlight, cameras = DEFAULT_CITY_CAMERAS, viewBox = { width: 1120, height: 780 }, unitScale = 22, title = 'mojulo fractal city', light, bg = '#0e1014', sky } = {}) {
  const L = light || makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
  const camHint = cameras[0]?.worldFraming?.cameraPosition || [-7, 31, 9];
  let faces = [];
  for (const g of grounds) faces.push(groundFace({ x: g.x, y: g.y, w: g.w, d: g.d }, g.z ?? 0.02, g.fill || '#cdd3bb', L));
  for (const rb of ribbons) faces.push(...ribbonFaces(rb, L, camHint));
  for (const b of boxes) {
    const r = { x: b.x, y: b.y, w: b.w, d: b.d };
    if (b.kind === 'townhouse') {
      // a rowhouse unit: skin the mass with its (generator-supplied) facade, but DON'T
      // run buildingExtras — the row generator already emits the stoop / doors / cornice
      // / bay geometry as its own annotated boxes + faces.
      const facade = b.facade || makeFacade(cityHash(`${b.x.toFixed(1)},${b.y.toFixed(1)}`), { height: b.z1 - b.z0 });
      const floors = facadeFloors(facade, b.z1 - b.z0);
      const bays = facadeBays(facade, b.w);
      faces.push(...cityBox(r, b.z0, b.z1, { facade, floors, bays, top: scaleHex(facade.glass, 0.6) }, L, camHint));
    } else if (b.shape === 'church') {
      // religious-place class: its own mass form, no window facade / rooftop extras
      faces.push(...churchBuilding(b, L, camHint));
    } else if (b.shape === 'mosque') {
      faces.push(...mosqueBuilding(b, L, camHint));
    } else if (b.shape === 'temple') {
      faces.push(...templeBuilding(b, L, camHint));
    } else if (b.shape === 'taj') {
      faces.push(...tajMahalBuilding(b, L, camHint));
    } else if (['building', 'anchor', 'midtower'].includes(b.kind)) {
      const facade = b.facade || makeFacade(cityHash(`${b.x.toFixed(1)},${b.y.toFixed(1)},${(b.z1 - b.z0).toFixed(1)}`), { height: b.z1 - b.z0 });
      const floors = facadeFloors(facade, b.z1 - b.z0);
      const bays = facadeBays(facade, b.w);
      if (b.shape === 'cylinder') faces.push(...cylinderBuilding(b, facade, floors, L, camHint));
      else if (b.shape === 'setback') faces.push(...setbackBuilding(b, facade, L, camHint));
      else if (b.shape === 'podium') faces.push(...podiumBuilding(b, facade, L, camHint));
      else if (b.shape === 'complex') faces.push(...complexBuilding(b, facade, L, camHint));
      else faces.push(...cityBox(r, b.z0, b.z1, { facade, floors, bays, top: scaleHex(facade.glass, 0.62) }, L, camHint));
      // 3D ornaments: protruding balconies/awning/rooftop boxes + printed signage decals
      // (cylinders + podiums skip the +y-face balconies/escapes — the inset tower would
      // float them off the facade — keeping rooftop kit, which centres over the tower)
      const exFacade = b.shape === 'cylinder' ? { ...facade, balcony: false, fireEscape: false, sign: null, material: 'glass', noEntrance: true }
        : b.shape === 'podium' ? { ...facade, balcony: false, fireEscape: false }
        : b.shape === 'complex' ? { ...facade, balcony: false, fireEscape: false, rooftopKit: [] }   // off-centre tower → skip floating roof kit
        : facade;
      const extras = buildingExtras({ x: b.x, y: b.y, w: b.w, d: b.d, z0: b.z0, z1: b.z1 }, exFacade, floors, bays);
      for (const e of extras.boxes) faces.push(...cityBox({ x: e.x, y: e.y, w: e.w, d: e.d }, e.z0, e.z1, { top: scaleHex(e.tint, 1.06), side: e.tint }, L, camHint));
      for (const ef of extras.faces) faces.push(ef);     // tilted equipment (satellite dish)
      for (const dc of extras.decals) {
        const yo = b.y + b.d + 0.04;
        const c = [[dc.x0, yo, dc.z0], [dc.x1, yo, dc.z0], [dc.x1, yo, dc.z1], [dc.x0, yo, dc.z1]];
        faces.push({ corners: c, fill: scaleHex(dc.fill, litFactor([0, 1, 0], L)), doubleSided: true });
      }
    } else {
      const tint = b.tint || '#9aa3ad';
      faces.push(...cityBox(r, b.z0, b.z1, { top: scaleHex(tint, 1.1), side: tint }, L, camHint));
    }
  }
  faces.push(...extraFaces);
  // moonlight (cool directional base), then streetlamp diffusion (warm pools + cast
  // shadows) on top — same primitives as the room, the faces are just facades.
  if (moonlight) faces = applyMoonlight(faces, moonlight === true ? {} : moonlight);
  if (sources.length) faces = bakeSceneDiffusion(faces, sources, diffusion);
  return { faces, cameras, viewBox, unitScale, title, bg, sky };
}

/**
 * Generic world-box renderer: world boxes + ground planes + smooth ribbons → preserve-3d HTML.
 * Used by generators (e.g. fractal-city) that produce world geometry directly.
 * box: { x, y, w, d, z0, z1, kind?, glass?, tint? }  ground: { x, y, w, d, z?, fill? }
 * ribbon: { path:[[x,y]...], z0, z1, width, tint }
 * faces: caller-supplied raw faces appended verbatim — { corners:[[x,y,z]x4], fill?|bg?, clip?, html?, doubleSided?, card?, lit? }.
 *        Lets generators emit pre-shaded geometry with SVG/clip decals (e.g. vehicle stickers).
 */
export function renderBoxCityToHtml(opts = {}) {
  return emitPreserve3dScene(assembleBoxCityScene(opts));
}

// ── painted-landscape terrain: heightfield mesh → world faces (additive) ──
//
// The terrain generator already samples a real (x, y, z) heightfield; the SVG
// renderer flattens it with the landscape's TWO-POINT (vanishing-point) camera
// cards, which are not pinhole worldFramings. So — like the room path's
// synthCornerCamera — this SYNTHESIZES pinhole cameras over the terrain's world
// bounds (z-up, camera beyond the near edge at +y looking toward the far hills
// at -y). The world mesh + per-cell shading is the reusable asset; only the
// camera is regenerated. v1: terrain + water only (see buildTerrainWorldMesh).

/** Synthesize pinhole cameras framing a terrain's world bounds (z-up). */
function synthTerrainCameras({ xRange, yRange, zRange }) {
  const [, x1] = xRange, [yFar, yNear] = yRange, [z0, z1] = zRange;
  const cx = (xRange[0] + x1) / 2, midY = (yFar + yNear) / 2, midZ = (z0 + z1) / 2;
  const ySpan = yNear - yFar, top = Math.max(z1 + 4, 6);
  return [
    { name: 'survey', worldFraming: {
      cameraPosition: [cx, yNear + 0.42 * ySpan, top],
      lookAt: [cx, midY, midZ], horizontalFov: 66 } },
    { name: 'low-angle', worldFraming: {
      cameraPosition: [cx, yNear + 0.18 * ySpan, midZ + 2.5],
      lookAt: [cx, midY - 0.2 * ySpan, midZ + 1], horizontalFov: 74 } },
    { name: 'aerial', worldFraming: {
      cameraPosition: [cx, yNear - 0.05 * ySpan, top + 0.9 * ySpan],
      lookAt: [cx, midY, z0], horizontalFov: 60 } },
  ];
}

const rgbStr = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

/**
 * Render a painted-landscape manifest as a live preserve-3d HTML terrain scene.
 * Returns null for manifests that aren't paintable terrain (caller falls back
 * to the baked /svg).
 */
export function renderPaintedLandscapeToHtml(manifest = {}, { unitScale = 22, title = 'mojulo terrain', city, cityDensity, bridges, farmland } = {}) {
  if (!manifest || manifest.kind !== 'painted-landscape') return null;
  // Aerial-map sticker/structure layers, all opt-in (render option or manifest):
  //   city      — massed mini-buildings (geometry) on buildable flats
  //   farmland  — patchwork field texture (surface sticker) on gentle dry land
  //   bridges   — span specs ({ from:[x,y], to:[x,y] }) for viaduct/causeway
  const wantCity = city ?? manifest.city === true;
  const wantFarm = farmland ?? manifest.farmland === true;
  const density = cityDensity ?? manifest.cityDensity ?? 0.6;
  const spans = bridges ?? manifest.bridges ?? [];
  const { faces, structures, extraFaces, bounds, sky } = buildTerrainWorldMesh(manifest, { city: wantCity, cityDensity: density, bridges: spans, farmland: wantFarm });
  const cameras = synthTerrainCameras(bounds);
  // Extrude each box-spec (city doodad OR bridge pier) as a plain MASSED box
  // (tinted roof + walls, no facade) via the same box primitive the fractal-city
  // uses — Lambert on top/sides gives form, the tonal ramp gives the mass read.
  if (structures && structures.length) {
    const L = makeLight({ direction: [0.34, 0.46, -0.82], ambient: 0.56, diffuse: 0.52 });
    const camHint = cameras[0]?.worldFraming?.cameraPosition || [0, 18, 8];
    for (const b of structures) {
      faces.push(...cityBox({ x: b.x, y: b.y, w: b.w, d: b.d }, b.z0, b.z1, { top: b.roof, side: b.wall }, L, camHint));
    }
  }
  // Bridge decks/parapets arrive pre-shaded as raw faces (per-point z → not boxes).
  if (extraFaces && extraFaces.length) faces.push(...extraFaces);
  // zenith→horizon gradient backdrop, mirroring the SVG sky (no geometry).
  const bg = sky
    ? `linear-gradient(${rgbStr(sky.zenith)} 0%, ${rgbStr(sky.horizon)} 100%)`
    : '#0e1014';
  const viewBox = manifest.viewBox && manifest.viewBox.width
    ? manifest.viewBox
    : { width: 1120, height: 760 };
  return emitPreserve3dScene({ faces, cameras, viewBox, unitScale, title, bg });
}
