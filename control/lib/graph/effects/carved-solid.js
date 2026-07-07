/**
 * carved-solid — render a CARVED, METALIFIED solid as a standalone SVG.
 *
 * The render-path graduation of the carve-solid primitive: a sketch of
 * `kind: 'carved-solid'` whose `shape` is ANY vector outline — an SVG `path` or
 * `text` (font-carved) — extruded with a rounded BEVEL and shaded as smooth
 * metal (vexar diffuse + a specular highlight). The /api/sketches/<ref>/svg
 * route dispatches on the `carved-solid` discriminator to this renderer, exactly
 * as it does for manji-tree and painted-landscape.
 *
 * The whole composed look is four independent, name-composable layers:
 *   material      — surface finish (metal / stone / glass …)
 *   inner         — luminosity ON the form (glow), separate from material
 *   fx            — outer-effect(s) OUTSIDE the silhouette (vine / electric / ice
 *                   / flame), each a generator routed by a contour pathing
 *   (+ shape / style / camera)
 * See control/lib/graph/form-effect.js and 0610/form-effect.plan.md.
 *
 * Manifest:
 *   { kind:'carved-solid',
 *     shape: { path:'<svg d>' } | { text:'MOJULO', font?:'<path-to-ttf>' },
 *     style?: { depth, bevel, bevelSteps, weight, blocky, slant, tracking, curveSteps },
 *     material?: <preset|#hex|object>,   // (metal? is the legacy alias)
 *     inner?:  'glow' | 'glow:neon' | { effect:'glow', preset?, ...overrides },
 *     fx?:     <fxspec> | <fxspec>[],    // fxspec: 'flame' | 'flame:engulf'
 *              | { effect, preset?, pathing?, pathingParams?, ...overrides }
 *     camera?: { yaw?, fov? },
 *     background?: boolean }
 *
 * renderCarvedSolidToSvg(manifest) → one still SVG (phase = manifest.phase ?? 0.2).
 * renderCarvedSolidFrames(manifest, n) → n SVG strings (phase 0..1) for a GIF.
 */
import { readFileSync } from 'node:fs';

import { projectTwoPoint } from '../polygonizer/pure-mandala.js';
import { makeLight, newellNormal, centroid, sub3, dot3, norm3, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { parseSvgPath, normalizeContours, extrudeProfile } from '../polygonizer/carve-solid.js';
import { formEffect, outerEffect, innerEffect, outerRing } from './form-effect.js';
import { loadFont, layoutText } from '../../motion/glyph-carver.js';
// The material shelf lived here first; it graduated to a polygonizer primitive
// (material-response.plan.md) so lathe/extrude surfaces can name materials too.
// Re-exported so existing importers (carved-motion, tools) are untouched.
import { resolveMaterial } from '../polygonizer/materials.js';
export { MATERIAL_NAMES, resolveMaterial } from '../polygonizer/materials.js';
const DEFAULT_FONTS = [
  '/System/Library/Fonts/Supplemental/Arial Black.ttf',
  '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
];
const FONT_CACHE = new Map();
function resolveFont(p) {
  const tries = p ? [p, ...DEFAULT_FONTS] : DEFAULT_FONTS;
  for (const path of tries) {
    if (FONT_CACHE.has(path)) return FONT_CACHE.get(path);
    try { const f = loadFont(readFileSync(path)); FONT_CACHE.set(path, f); return f; } catch { /* next */ }
  }
  throw new Error(`carved-solid: no usable font found (tried ${tries.join(', ')}). Pass shape.font with a .ttf path.`);
}

function bbox(contours) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of contours) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}
const recenter = (contours) => { const b = bbox(contours); const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2; return contours.map((r) => r.map(([x, y]) => [x - cx, y - cy])); };

// Resolve any shape source to centred contours in a consistent unit: a path is
// fit to a unit box (max dim = 1); text is scaled so cap-height = 1 (so depth /
// bevel stay proportional to letter height, not word width) and centred.
export function resolveContours(shape, style) {
  if (shape?.path) return normalizeContours(parseSvgPath(shape.path, { curveSteps: style.curveSteps || 18 }), { flipY: true });
  if (shape?.text) {
    const { glyphs } = layoutText(resolveFont(shape.font), shape.text, style);
    const cs = glyphs.flatMap((g) => g.contours);
    const cap = bbox(cs).maxY || 1;                       // ≈ cap height (baseline at 0)
    return recenter(cs.map((r) => r.map(([x, y]) => [x / cap, y / cap])));
  }
  throw new Error('carved-solid: shape must be { path: "<svg d>" } or { text: "...", font? }');
}

// ── fixed framing (a single hero shot); camera tunes yaw + fov ──
const VW = 960, VH = 540, Z_C = 2.0, BG = '#070a11', TAU = Math.PI * 2;
const FIT_W = 8.2, FIT_H = 4.4;   // world extent the content is scaled to fill
const LIGHT = makeLight({ direction: [0.4, 0.5, -0.76], ambient: 0.26, diffuse: 0.7 });

// The carved-solid hero framing, exported so sibling renderers (carved-motion's
// materialize / transfigure) frame a subject IDENTICALLY to its still. renderFrame
// above still uses the module-scope consts directly; this just re-packages them.
export const CARVE_VIEW = {
  VW, VH, Z_C, BG, FIT_W, FIT_H, LIGHT,
  yaw: -18, fov: 32,
  CAM: [-3.2, -16, 3.0],
  ROOM: { worldExtent: { width: 22, depth: 22, height: 12 }, xRange: [-11, 11], yRange: [-11, 11], frontY: 4, backY: -14, verticalUnit: 70 },
};
// effect-layer palettes (the render styles lifted out of the spikes)
const LEAF = [90, 168, 58], STEM = [95, 122, 54], ICE = [207, 232, 255];
const E_GLOW = '#46c0ff', E_CORE = '#eaf6ff';
const F_ORANGE = [255, 90, 30], F_YELLOW = [255, 210, 74], F_WHITE = [255, 255, 255];
const lerpC = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

// resolve manifest.inner ('glow' | 'glow:neon' | { effect, preset, …}) → glow params.
function parseInner(spec) {
  if (!spec) return { emission: 0, bloom: 0 };
  if (typeof spec === 'string') { const [name, preset] = spec.split(':'); return innerEffect(name, preset); }
  const { effect = 'glow', preset, ...rest } = spec;
  return innerEffect(effect, preset, rest);
}
// resolve manifest.fx (one or many; 'flame' | 'flame:engulf' | { effect, preset, pathing?, … }).
function parseFx(spec) {
  if (!spec) return [];
  const list = Array.isArray(spec) ? spec : [spec];
  return list.map((s) => (typeof s === 'string' ? { effect: s.split(':')[0], preset: s.split(':')[1] } : s)).filter(Boolean);
}

function renderFrame(manifest, phase) {
  const { shape, style = {}, material, metal, inner: innerSpec, fx: fxSpec, camera = {}, background = true } = manifest;
  const mat = resolveMaterial(material ?? metal);
  const inner = parseInner(innerSpec);
  const fxSpecs = parseFx(fxSpec);
  const contours = resolveContours(shape, style);
  const cb = bbox(contours);
  const S = Math.min(FIT_W / (cb.w || 1), FIT_H / (cb.h || 1));
  const depth = style.depth ?? 0.34;
  const { faces } = extrudeProfile(contours, { depth, bevel: style.bevel ?? 0.05, bevelSteps: style.bevelSteps ?? 6 });
  const yaw = (camera.yaw ?? -18) * Math.PI / 180, fov = camera.fov ?? 32;

  const CAM = [-3.2, -16, 3.0], LOOK = [0, 0, Z_C];
  const cam = { viewBox: { width: VW, height: VH }, worldFraming: { cameraPosition: CAM, lookAt: LOOK, horizontalFov: fov, pictureCenter: [VW / 2, VH / 2] } };
  const ROOM = { worldExtent: { width: 22, depth: 22, height: 12 }, xRange: [-11, 11], yRange: [-11, 11], frontY: 4, backY: -14, verticalUnit: 70 };
  const proj = (w) => { const p = projectTwoPoint(w, cam, ROOM); return [p[0], p[1]]; };
  const fmt = (P) => `${P[0].toFixed(1)},${P[1].toFixed(1)}`;
  const dist = (c) => Math.hypot(c[0] - CAM[0], c[1] - CAM[1], c[2] - CAM[2]);
  const orient = (n, from, to) => (dot3(n, sub3(to, from)) < 0 ? [-n[0], -n[1], -n[2]] : n);
  const place = ([x, y, z]) => { const ca = Math.cos(yaw), sa = Math.sin(yaw); return [-(x * ca - z * sa) * S, x * sa + z * ca, Z_C + y * S]; };
  const poly = (pts) => pts.map((p) => fmt(proj(p))).join(' ');
  const lambertOf = (n) => Math.max(0, dot3(n, LIGHT.toLight));

  // material shade (rgb) + the inner-effect emission layer (rim/pulse weighted).
  const base = hexToRgb(mat.base);
  const matRgb = (n, c) => {
    let lam = lambertOf(n); if (mat.cel) lam = Math.round(lam * mat.cel) / mat.cel;
    let rgb = base.map((v) => v * (mat.ambient + mat.diffuse * lam));
    if (mat.specular) { const half = norm3([LIGHT.toLight[0] + norm3(sub3(CAM, c))[0], LIGHT.toLight[1] + norm3(sub3(CAM, c))[1], LIGHT.toLight[2] + norm3(sub3(CAM, c))[2]]); const s = mat.specular * Math.pow(Math.max(0, dot3(n, half)), mat.shininess || 16); rgb = rgb.map((v) => v + 255 * s); }
    if (mat.emissive) rgb = rgb.map((v, i) => v * (1 - mat.emissive) + base[i] * mat.emissive);
    return rgb;
  };
  const innerRgb = hexToRgb(inner.color || '#000');
  const surf = (n, c) => {
    let rgb = matRgb(n, c);
    if (inner.emission) { const edge = 1 - Math.min(1, Math.abs(dot3(n, norm3(sub3(CAM, c))))); const rimF = (1 - inner.rim) + inner.rim * edge; const pulseF = inner.pulse ? (1 - inner.pulse) + inner.pulse * (0.5 + 0.5 * Math.sin(phase * TAU)) : 1; const em = inner.emission * rimF * pulseF; rgb = rgb.map((v, i) => v + innerRgb[i] * em); }
    return rgbToHex(rgb);
  };

  // ── host faces + any depth-sorted effect solids (plant/ice) in one sort ──
  const world = faces.map((f) => f.kind === 'cap' ? { ...f, w: f.contours.map((r) => r.map(place)) } : { ...f, w: f.pts.map(place) });
  const center = centroid(world.flatMap((f) => f.kind === 'cap' ? f.w[0] : f.w));
  const solids = [];
  for (const f of world) {
    if (f.kind === 'cap') { const r0 = f.w[0], c = centroid(r0); const n = orient(newellNormal(r0), center, c); solids.push({ d: f.w.map((r) => 'M' + poly(r) + 'Z').join(' '), fill: surf(n, c), op: mat.opacity ?? 1, dist: dist(c) + (f.side === 'back' ? 0.12 : -0.12) }); }
    else { const c = centroid(f.w); const n = orient(newellNormal(f.w), center, c); if (dot3(n, sub3(CAM, c)) <= 0) continue; solids.push({ pts: f.w.map(proj), fill: surf(n, c), op: mat.opacity ?? 1, dist: dist(c) }); }
  }

  // ── outer effects: route each along the contour, draw per render style ──
  const drive = fxSpecs.length ? outerRing(contours) : null;
  let overBlur = '', overCrisp = '';
  for (const spec of fxSpecs) {
    const { effect, preset, pathing, pathingParams, ...ov } = spec;
    const eff = outerEffect(effect, preset, { phase, ...ov });
    const items = formEffect({ contour: drive, depth, pathing: pathing || eff.pathing, pathingParams: { ...eff.pathingParams, ...pathingParams }, generator: eff.generator, generatorParams: eff.generatorParams });
    if (eff.render === 'solid' || eff.render === 'frost') {
      for (const it of items) {
        const w = it.pts.map(place), c = centroid(w);
        const n = orient(newellNormal(w), c, [c[0], c[1] - 1, c[2]]);
        if (dot3(n, sub3(CAM, c)) <= 0 && eff.render === 'solid') continue;
        let fill;
        if (eff.render === 'frost') { const lam = lambertOf(n); const tk = 0.6 + 0.4 * Math.max(0, Math.sin(phase * Math.PI * 4 + (it.tw || 0) * TAU)); const half = norm3([LIGHT.toLight[0] + norm3(sub3(CAM, c))[0], LIGHT.toLight[1] + norm3(sub3(CAM, c))[1], LIGHT.toLight[2] + norm3(sub3(CAM, c))[2]]); const sp = Math.pow(Math.max(0, dot3(n, half)), 26) * (0.4 + 0.7 * tk); fill = rgbToHex(ICE.map((v) => v * (0.5 + 0.5 * lam) + 255 * sp)); }
        else fill = rgbToHex((it.role === 'leaf' ? LEAF : STEM).map((v) => v * (0.34 + 0.66 * lambertOf(n))));
        solids.push({ pts: w.map(proj), fill, op: eff.render === 'frost' ? 0.82 : 1, dist: dist(c) });
      }
    } else if (eff.render === 'glow') {
      const st = items.filter((i) => i.kind === 'stroke'), nd = items.filter((i) => i.kind === 'node');
      overBlur += st.map((s) => `<polyline points="${s.pts.map((p) => fmt(proj(place(p)))).join(' ')}" fill="none" stroke="${E_GLOW}" stroke-width="${(s.role === 'arc' ? 7 : 4) * s.intensity}" stroke-linecap="round" opacity="${(0.6 * s.intensity).toFixed(2)}"/>`).join('')
        + nd.map((nn) => { const p = proj(place(nn.p)); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(nn.r * S * 26 * nn.intensity).toFixed(1)}" fill="${E_GLOW}" opacity="${(0.55 * nn.intensity).toFixed(2)}"/>`; }).join('');
      overCrisp += st.map((s) => `<polyline points="${s.pts.map((p) => fmt(proj(place(p)))).join(' ')}" fill="none" stroke="${E_CORE}" stroke-width="${s.role === 'arc' ? 1.6 : 1.0}" stroke-linecap="round" opacity="${(0.9 * s.intensity).toFixed(2)}"/>`).join('')
        + nd.map((nn) => { const p = proj(place(nn.p)); return `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${(nn.r * S * 7 * nn.intensity).toFixed(1)}" fill="#fff"/>`; }).join('');
    } else if (eff.render === 'fire') {
      const tongues = items.map((q) => ({ pts: q.pts.map((p) => proj(place(p))), fill: rgbToHex((q.s ?? 0) < 0.6 ? lerpC(F_ORANGE, F_YELLOW, (q.s ?? 0) / 0.6) : lerpC(F_YELLOW, F_WHITE, ((q.s ?? 0) - 0.6) / 0.4)), base: q.pts[0][1] })).sort((a, b) => a.base - b.base);
      const ps = tongues.map((t) => `<polygon points="${t.pts.map(fmt).join(' ')}" fill="${t.fill}" stroke="${t.fill}" stroke-width="0.4" opacity="0.92"/>`).join('');
      overBlur += `<g opacity="0.7">${ps}</g>`; overCrisp += ps;
    }
  }

  // ── inner-effect bloom halo (silhouette), behind everything ──
  let halo = '';
  if (inner.bloom) {
    const fc = faces.find((f) => f.kind === 'cap' && f.side === 'front');
    if (fc) { const ring = fc.contours[0].map((p) => proj(place(p))); const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length, cy = ring.reduce((s, p) => s + p[1], 0) / ring.length; const grow = (k) => ring.map((p) => `${(cx + (p[0] - cx) * k).toFixed(1)},${(cy + (p[1] - cy) * k).toFixed(1)}`).join(' '); const pf = inner.pulse ? (0.5 + 0.5 * Math.sin(phase * TAU)) : 1; halo = `<g filter="url(#cs-blur)"><polygon points="${grow(1.12)}" fill="${inner.color}" opacity="${(0.4 * inner.bloom * pf).toFixed(3)}"/><polygon points="${grow(1.04)}" fill="${inner.color}" opacity="${(0.65 * inner.bloom * pf).toFixed(3)}"/></g>`; }
  }

  solids.sort((a, b) => b.dist - a.dist);
  const body = solids.map((it) => it.d
    ? `<path d="${it.d}" fill="${it.fill}" fill-rule="evenodd" stroke="${it.fill}" stroke-width="0.4" opacity="${it.op}"/>`
    : `<polygon points="${it.pts.map(fmt).join(' ')}" fill="${it.fill}" stroke="${it.fill}" stroke-width="0.4" opacity="${it.op}"/>`).join('');
  const needBlur = overBlur || halo;
  const grade = background
    ? `<radialGradient id="cs-glow" cx="50%" cy="44%" r="60%"><stop offset="0" stop-color="#16203a"/><stop offset="0.5" stop-color="#0b1120"/><stop offset="1" stop-color="${BG}"/></radialGradient><radialGradient id="cs-vig" cx="50%" cy="50%" r="62%"><stop offset="0.55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.65"/></radialGradient>`
    : '';
  const blurDef = needBlur ? `<filter id="cs-blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${inner.blur || 5}"/></filter>` : '';
  const bg = background ? `<rect width="100%" height="100%" fill="${BG}"/><rect width="100%" height="100%" fill="url(#cs-glow)"/>` : '';
  const vig = background ? `<rect width="100%" height="100%" fill="url(#cs-vig)"/>` : '';
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg"><defs>${grade}${blurDef}</defs>${bg}${halo}${body}${overBlur ? `<g filter="url(#cs-blur)">${overBlur}</g>` : ''}${overCrisp}${vig}</svg>`;
}

/** Render one still SVG (phase = manifest.phase ?? 0.2). */
export function renderCarvedSolidToSvg(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('renderCarvedSolidToSvg requires a manifest');
  return renderFrame(manifest, manifest.phase ?? 0.2);
}

/** Render n SVG frames (phase 0..1) — feed to encodeGif for the motion viewer. */
export function renderCarvedSolidFrames(manifest, frames = 24) {
  if (!manifest || typeof manifest !== 'object') throw new Error('renderCarvedSolidFrames requires a manifest');
  const out = [];
  for (let i = 0; i < frames; i++) out.push(renderFrame(manifest, i / frames));
  return out;
}

/** Does this manifest animate (an animated fx or a pulsing inner)? */
export function carvedSolidIsAnimated(manifest) {
  const inner = parseInner(manifest?.inner);
  if (inner.pulse) return true;
  return parseFx(manifest?.fx).some((s) => ['electric', 'flame', 'ice'].includes(s.effect) || ['electric', 'electric_snake', 'flame', 'ice'].includes(s.effect));
}
