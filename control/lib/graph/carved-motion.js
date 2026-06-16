/**
 * carved-motion — the TEMPORAL render of carve's two phase-driven peers:
 *   - materialize (presence: ∅ ⇄ form)  — control/lib/graph/polygonizer/materialize.js
 *   - transfigure (identity: form A ⇄ form B) — control/lib/graph/polygonizer/transfigure.js
 *
 * The primitives are pure geometry: (contours, class, phase) → a phase-STATE
 * ({ contours, wireRing?, reveal?, skinAlpha, wireAlpha, wire }). This module is
 * the missing CONSUMER — it draws that state with the SAME extrude + project +
 * vexar-shade stack the still carved-solid uses (CARVE_VIEW framing, so a motion
 * frames its subject identically to its still), crossfading an extruded SKIN
 * (× skinAlpha) against a glowing WIREFRAME (× wireAlpha).
 *
 * Output is pure: arrays of SVG frame strings + a viewBox. The motion tool
 * composes the flipbook / encodes the GIF; this module has no fs / motion-lib dep.
 *
 * Materialize draws three modes:
 *   - reveal ('hologram') — contour wire draws on, then skin solidifies
 *   - platform ('doom') — a scan plane sweeps upward, printing the skin
 *   - particles ('transporter') — a deterministic cloud converges into skin
 * Transfigure draws Galvatron-style de-skin/morph/re-skin. Liquid-metal leaves
 * the beveled carved paradigm and renders the carrier as a smooth liquid mass.
 */

import { projectTwoPoint } from './polygonizer/pure-mandala.js';
import { extrudeProfile } from './polygonizer/carve-solid.js';
import { centroid, newellNormal, sub3, dot3, norm3, hexToRgb, rgbToHex } from './polygonizer/vexar.js';
import { CARVE_VIEW, resolveContours, resolveMaterial } from './carved-solid.js';
import {
  prepareMaterialize, materialize, MATERIALIZE_CLASS_NAMES,
} from './polygonizer/materialize.js';
import {
  prepareTransfigure, transfigure, TRANSFIGURE_CLASS_NAMES,
} from './polygonizer/transfigure.js';

export { MATERIALIZE_CLASS_NAMES, TRANSFIGURE_CLASS_NAMES };

const { VW, VH, Z_C, BG, FIT_W, FIT_H, LIGHT, yaw: YAW_DEG, fov: FOV, CAM, ROOM } = CARVE_VIEW;
const DEPTH = 0.34, BEVEL = 0.04, BEVEL_STEPS = 4, WIRE_SAMPLES = 150;

function bboxOf(rings) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { w: maxX - minX, h: maxY - minY };
}

/**
 * The projection + shade closure for one effect render. `fitRings` (one or more
 * 2-D rings) sizes the world-fit ONCE so every frame shares a stable scale — for
 * transfigure that is A∪B, so the form doesn't pump as it morphs.
 */
// The carved-solid's matRgb (Lambert + spec + emissive + cel), minus the
// inner-glow layer. Factored out so a single render can light skin/facets in
// several materials (the carrier vs the resolved end-form) under the same light.
function makeShade(mat) {
  const base = hexToRgb(mat.base);
  return (n, c) => {
    let lam = Math.max(0, dot3(n, LIGHT.toLight));
    if (mat.cel) lam = Math.round(lam * mat.cel) / mat.cel;
    let rgb = base.map((v) => v * (mat.ambient + mat.diffuse * lam));
    if (mat.specular) {
      const toC = norm3(sub3(CAM, c));
      const half = norm3([LIGHT.toLight[0] + toC[0], LIGHT.toLight[1] + toC[1], LIGHT.toLight[2] + toC[2]]);
      const s = mat.specular * Math.pow(Math.max(0, dot3(n, half)), mat.shininess || 16);
      rgb = rgb.map((v) => v + 255 * s);
    }
    if (mat.emissive) rgb = rgb.map((v, i) => v * (1 - mat.emissive) + base[i] * mat.emissive);
    return rgbToHex(rgb);
  };
}

function buildScene(fitRings, mat) {
  const b = bboxOf(fitRings);
  const S = Math.min(FIT_W / (b.w || 1), FIT_H / (b.h || 1));
  const yaw = (YAW_DEG * Math.PI) / 180, ca = Math.cos(yaw), sa = Math.sin(yaw);
  const place = ([x, y, z]) => [-(x * ca - z * sa) * S, x * sa + z * ca, Z_C + y * S];
  const cam = { viewBox: { width: VW, height: VH }, worldFraming: { cameraPosition: CAM, lookAt: [0, 0, Z_C], horizontalFov: FOV, pictureCenter: [VW / 2, VH / 2] } };
  const proj = (w) => { const p = projectTwoPoint(w, cam, ROOM); return [p[0], p[1]]; };
  const fmt = (P) => `${P[0].toFixed(1)},${P[1].toFixed(1)}`;
  const dist = (c) => Math.hypot(c[0] - CAM[0], c[1] - CAM[1], c[2] - CAM[2]);
  const orient = (n, from, to) => (dot3(n, sub3(to, from)) < 0 ? [-n[0], -n[1], -n[2]] : n);
  return { place, proj, fmt, dist, orient, shade: makeShade(mat), opacity: mat.opacity ?? 1 };
}

/** Extrude `contours`, shade + depth-sort the faces, return a `<g>` faded by alpha. */
function skinSvg(scene, contours, alpha, { clipId, shade: shadeOverride } = {}) {
  if (alpha <= 0.02) return '';
  const { place, proj, fmt, dist, orient, opacity } = scene;
  const shade = shadeOverride || scene.shade;
  const { faces } = extrudeProfile(contours, { depth: DEPTH, bevel: BEVEL, bevelSteps: BEVEL_STEPS });
  const world = faces.map((f) => (f.kind === 'cap' ? { ...f, w: f.contours.map((r) => r.map(place)) } : { ...f, w: f.pts.map(place) }));
  const ctr = centroid(world.flatMap((f) => (f.kind === 'cap' ? f.w[0] : f.w)));
  const items = [];
  for (const f of world) {
    if (f.kind === 'cap') {
      const r0 = f.w[0], c = centroid(r0);
      const n = orient(newellNormal(r0), ctr, c);
      items.push({ d: f.w.map((r) => 'M' + r.map((p) => fmt(proj(p))).join(' L') + 'Z').join(' '), fill: shade(n, c), dist: dist(c) + (f.side === 'back' ? 0.12 : -0.12) });
    } else {
      const c = centroid(f.w);
      const n = orient(newellNormal(f.w), ctr, c);
      if (dot3(n, sub3(CAM, c)) <= 0) continue; // backface cull
      items.push({ pts: f.w.map(proj), fill: shade(n, c), dist: dist(c) });
    }
  }
  items.sort((a, b) => b.dist - a.dist);
  const draw = items.map((it) => (it.d
    ? `<path d="${it.d}" fill="${it.fill}" fill-rule="evenodd" stroke="${it.fill}" stroke-width="0.4"/>`
    : `<polygon points="${it.pts.map(fmt).join(' ')}" fill="${it.fill}" stroke="${it.fill}" stroke-width="0.4"/>`)).join('');
  const clip = clipId ? ` clip-path="url(#${clipId})"` : '';
  return `<g${clip} opacity="${(alpha * opacity).toFixed(2)}">${draw}</g>`;
}

// Glowing front+back rings + struts for a list of 2-D ring points (front at z=0,
// back at z=DEPTH). `closed` → polygons (full outline); else polylines (draw-on).
function wireSvg(scene, ring2d, { closed, wire, alpha, backRing = true }) {
  if (alpha <= 0.02 || ring2d.length < 2) return '';
  const { place, proj, fmt } = scene;
  const F = ring2d.map((p) => proj(place([p[0], p[1], 0])));
  const Bk = ring2d.map((p) => proj(place([p[0], p[1], DEPTH])));
  const tag = closed ? 'polygon' : 'polyline';
  const pts = (pp) => pp.map(fmt).join(' ');
  let struts = '';
  for (let i = 0; i < ring2d.length; i += 6) struts += `<line x1="${F[i][0].toFixed(1)}" y1="${F[i][1].toFixed(1)}" x2="${Bk[i][0].toFixed(1)}" y2="${Bk[i][1].toFixed(1)}" stroke="${wire.color}" stroke-width="0.8"/>`;
  const back = backRing ? `<${tag} points="${pts(Bk)}" fill="none" stroke="${wire.color}" stroke-width="1.0" opacity="0.7"/>` : '';
  const glowBack = backRing && closed ? `<${tag} points="${pts(Bk)}" fill="none" stroke="${wire.color}" stroke-width="3" opacity="0.35"/>` : '';
  return `<g opacity="${alpha.toFixed(2)}">`
    + `<g filter="url(#cm-glow)"><${tag} points="${pts(F)}" fill="none" stroke="${wire.color}" stroke-width="3" opacity="0.5"/>${glowBack}</g>`
    + `<${tag} points="${pts(F)}" fill="none" stroke="${wire.core}" stroke-width="1.3"/>${back}${struts}</g>`;
}

function projectedBox(scene, contours) {
  const { place, proj } = scene;
  const pts = [];
  for (const ring of contours) {
    for (const [x, y] of ring) {
      pts.push(proj(place([x, y, 0])));
      pts.push(proj(place([x, y, DEPTH])));
    }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function platformSvg(scene, contours, scan, plane, clipId) {
  if (scan <= 0.01) return { defs: '', body: '' };
  const box = projectedBox(scene, contours);
  const pad = Math.max(10, box.h * 0.06);
  const y = box.maxY + pad - (box.h + pad * 2) * scan;
  const h = (box.h + pad * 2) * scan;
  const defs = `<clipPath id="${clipId}"><rect x="${(box.minX - pad).toFixed(1)}" y="${y.toFixed(1)}" width="${(box.w + pad * 2).toFixed(1)}" height="${h.toFixed(1)}"/></clipPath>`;

  const { place, proj, fmt } = scene;
  const b = bboxOf(contours);
  const halfW = Math.max(0.7, b.w * 0.62);
  const yModel = -b.h / 2 + b.h * scan;
  const zPad = 0.08;
  const quad = [
    [-halfW, yModel, -zPad],
    [halfW, yModel, -zPad],
    [halfW, yModel, DEPTH + zPad],
    [-halfW, yModel, DEPTH + zPad],
  ].map((p) => proj(place(p)));
  const color = plane?.color || '#ff7a2a';
  const core = plane?.core || '#ffe6b0';
  const body = `<g class="cm-scan-plane" opacity="${Math.min(1, 0.25 + scan * 0.75).toFixed(2)}">`
    + `<g filter="url(#cm-glow)"><polygon points="${quad.map(fmt).join(' ')}" fill="${color}" opacity="0.18" stroke="${color}" stroke-width="5"/></g>`
    + `<polygon points="${quad.map(fmt).join(' ')}" fill="${color}" opacity="0.12" stroke="${core}" stroke-width="1.5"/>`
    + `</g>`;
  return { defs, body };
}

function particlesSvg(scene, particles, { color = '#cfeaff', size = 0.012, alpha = 1 } = {}) {
  if (!particles?.length || alpha <= 0.02) return '';
  const { place, proj } = scene;
  const radius = Math.max(1.2, size * 180);
  const dots = particles
    .filter((p) => p.alpha > 0.015)
    .map((p) => {
      const q = proj(place(p.pos));
      const a = Math.min(1, p.alpha * alpha);
      return `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${(radius * (0.65 + 0.7 * a)).toFixed(2)}" fill="${color}" opacity="${a.toFixed(3)}"/>`;
    })
    .join('');
  if (!dots) return '';
  return `<g class="cm-particles"><g filter="url(#cm-glow)" opacity="0.75">${dots}</g>${dots}</g>`;
}

const clamp01 = (x, fallback = 0) => {
  const n = Number.isFinite(x) ? x : fallback;
  return n < 0 ? 0 : n > 1 ? 1 : n;
};

// Liquid metal is an OPINIONATED CHROME RESKIN of the carved solid — nothing more.
// It reuses the exact same extruded geometry + projection as the wood end forms
// (the scene is built with the carrier = chrome material, so scene.shade IS the
// chrome shade), wrapped in a light gloss blur for a wet-chrome sheen. No new
// geometry, no recalculated perspective: the wood→chrome melt is a PURE material
// change at the identical angle. The morph layer already handles the shape; surface
// tuning (blobRandomness/highlightBias) is reserved for later and ignored here.
function liquidMetalSvg(scene, contours) {
  const skin = skinSvg(scene, contours, 1); // scene.shade = carrier (chrome)
  if (!skin) return '';
  return `<g class="cm-liquid-metal">`
    + `<defs><filter id="cm-liquid-gloss" x="-8%" y="-8%" width="116%" height="116%"><feGaussianBlur stdDeviation="1.3"/></filter></defs>`
    + `<g filter="url(#cm-liquid-gloss)">${skin}</g>`
    + `</g>`;
}

function shell(body, defs = '') {
  return `<svg viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg">`
    + `<defs><radialGradient id="cm-bg" cx="50%" cy="46%" r="62%"><stop offset="0" stop-color="#0b1426"/><stop offset="0.6" stop-color="#070b16"/><stop offset="1" stop-color="${BG}"/></radialGradient>`
    + `<filter id="cm-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="3.4"/></filter>${defs}</defs>`
    + `<rect width="100%" height="100%" fill="${BG}"/><rect width="100%" height="100%" fill="url(#cm-bg)"/>`
    + `${body}</svg>`;
}

// Ping-pong so the GIF loops smoothly: ∅→form→∅ (materialize) / A→B→A
// (transfigure). The interior is mirrored so endpoints aren't doubled.
function pingPong(fwd) {
  return [...fwd, ...fwd.slice(1, -1).reverse()];
}

const VIEWBOX = [0, 0, VW, VH];

/** materialize (presence) frames for a single carved subject. */
export function renderMaterializeFrames({ shape, klass = 'hologram', material, style }, frames = 30) {
  if (!MATERIALIZE_CLASS_NAMES.includes(klass)) throw new Error(`unknown materialize class '${klass}'. One of: ${MATERIALIZE_CLASS_NAMES.join(', ')}.`);
  const contours = resolveContours(shape, style || {});
  const mat = resolveMaterial(material);
  const prep = prepareMaterialize(contours, { klass, samples: WIRE_SAMPLES });
  const scene = buildScene(contours, mat);
  const N = Math.max(2, frames);
  const fwd = [];
  for (let i = 0; i < N; i++) {
    const st = materialize(prep, i / (N - 1));
    if (st.mode === 'platform') {
      const clipId = `cm-scan-${i}`;
      const scan = Math.max(0, Math.min(1, st.scan ?? 0));
      const platform = platformSvg(scene, st.contours, scan, st.plane, clipId);
      fwd.push(shell(skinSvg(scene, st.contours, scan, { clipId }) + platform.body, platform.defs));
    } else if (st.mode === 'particles') {
      fwd.push(shell(particlesSvg(scene, st.particles, { color: st.color, size: st.size }) + skinSvg(scene, st.contours, st.skinAlpha)));
    } else if (!st.mode || st.mode === 'reveal') {
      const k = Math.floor(st.reveal * st.wireRing.length);
      const closed = st.reveal >= 0.999;
      const ring = closed ? st.wireRing : st.wireRing.slice(0, Math.max(0, k));
      fwd.push(shell(skinSvg(scene, st.contours, st.skinAlpha) + wireSvg(scene, ring, { closed, wire: st.wire, alpha: st.wireAlpha, backRing: false })));
    } else {
      throw new Error(`materialize: no renderer for mode '${st.mode}' (class '${klass}').`);
    }
  }
  return { frameSvgs: pingPong(fwd), viewBox: VIEWBOX };
}

/** transfigure (identity) frames morphing a `from` carved outline into a `to` one. */
export function renderTransfigureFrames({ from, to, klass = 'galvatron', material, fromMaterial, style, liquid = {} }, frames = 36) {
  if (!TRANSFIGURE_CLASS_NAMES.includes(klass)) throw new Error(`unknown transfigure class '${klass}'. One of: ${TRANSFIGURE_CLASS_NAMES.join(', ')}.`);
  const fromC = resolveContours(from, style || {});
  const toC = resolveContours(to, style || {});
  // liquid-metal is shaded with the carrier material (default chrome); galvatron
  // skins with the caller's material. Either way buildScene's vexar light + this
  // material is what lights every facet.
  const mat = klass === 'liquid-metal'
    ? resolveMaterial(liquid.carrier || 'chrome')
    : resolveMaterial(material);
  // liquid-metal is only the TRANSITION medium — the carrier melts the start form
  // (fromMaterial) and resolves into the FINAL form (material), each in its own
  // real material, not the chrome/gold carrier. These two shaders light those
  // resolved end skins under the same scene light.
  const shadeFrom = makeShade(resolveMaterial(fromMaterial ?? material));
  const shadeTo = makeShade(resolveMaterial(material));
  const RESOLVE = 0.18; // phase window over which each end crystallizes from/into liquid
  const ss = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };
  const prep = prepareTransfigure(fromC, toC, { klass, samples: WIRE_SAMPLES });
  const scene = buildScene([...fromC, ...toC], mat); // stable fit over BOTH forms
  const N = Math.max(2, frames);
  const fwd = [];
  for (let i = 0; i < N; i++) {
    const p = i / (N - 1);
    const st = transfigure(prep, p);
    const C = st.contours[0];
    if (st.mode === 'liquid-metal') {
      // The end forms crystallize over the liquid at the extremes; the chrome carrier
      // fades out as they resolve, so it shows ONLY in the molten transition — never
      // behind a fully-formed end (no chrome halo on the wood).
      const aFrom = 1 - ss(p / RESOLVE);
      const aTo = ss((p - (1 - RESOLVE)) / RESOLVE);
      const liqAlpha = clamp01(1 - Math.max(aFrom, aTo));
      const liquidG = liqAlpha > 0.01
        ? `<g opacity="${liqAlpha.toFixed(2)}">${liquidMetalSvg(scene, st.contours)}</g>`
        : '';
      fwd.push(shell(
        liquidG
        + skinSvg(scene, st.contours, aFrom, { shade: shadeFrom })
        + skinSvg(scene, st.contours, aTo, { shade: shadeTo }),
      ));
    } else if (!st.mode) {
      fwd.push(shell(skinSvg(scene, st.contours, st.skinAlpha) + wireSvg(scene, C, { closed: true, wire: st.wire, alpha: st.wireAlpha })));
    } else {
      throw new Error(`transfigure: no renderer for mode '${st.mode}' (class '${klass}').`);
    }
  }
  return { frameSvgs: pingPong(fwd), viewBox: VIEWBOX };
}
