/**
 * carved-solid-world — the `kind:'carved-solid'` World/export form
 * (interchange.plan.md I2). Lowers the carve-solid primitive (extruded, bevelled
 * outline) to the standard World payload so `resolveWorldScene` — and therefore
 * the live /world route AND `export_model` — cover it, instead of the SVG-only
 * dead end.
 *
 * Depiction-faithful by construction: geometry, framing, and COLOUR replicate
 * renderCarvedSolidToSvg's renderFrame exactly — same contours, same extrusion
 * dials, same `place` transform (yaw + fit scale into the CARVE_VIEW hero frame),
 * and the same material shade (vexar Lambert + cel + specular + emissive + inner
 * glow, evaluated at the still's phase against the fixed hero CAM/light) baked
 * into each face fill. The GLB therefore matches the SVG's palette from the hero
 * angle (the repo's export doctrine: baked unlit colour, the depiction IS the
 * asset). Differences from the SVG, both deliberate:
 *   • caps (evenodd contours-with-holes) are TESSELLATED via triangulateRings —
 *     a 3D face list cannot fill evenodd;
 *   • no view cull — back-facing wall quads are kept so the solid is closed from
 *     every orbit angle (their fills use the same camera-independent Lambert).
 * Outer `fx` layers (flame/vine/electric/ice) and the background/bloom halo are
 * screen embellishments, not solid geometry — dropped, same doctrine as glow
 * billboards and the sky dome.
 *
 * Deterministic: pure math over the manifest (the glyph contours come from the
 * same font resolution the SVG uses).
 */

import { newellNormal, centroid, sub3, dot3, norm3, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { extrudeProfile } from '../polygonizer/carve-solid.js';
import { triangulateRings } from '../polygonizer/triangulate.js';
import { resolveContours, resolveMaterial, CARVE_VIEW } from './carved-solid.js';
import { innerEffect } from './form-effect.js';

const TAU = Math.PI * 2;

function bbox(contours) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of contours) for (const [x, y] of r) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

// manifest.inner ('glow' | 'glow:neon' | { effect, preset, … }) → glow params —
// the same resolution renderFrame's parseInner performs.
function parseInner(spec) {
  if (!spec) return { emission: 0, bloom: 0 };
  if (typeof spec === 'string') { const [name, preset] = spec.split(':'); return innerEffect(name, preset); }
  const { effect = 'glow', preset, ...rest } = spec;
  return innerEffect(effect, preset, rest);
}

/**
 * assembleCarvedSolidScene(manifest, ctx) → World payload { faces, cameras,
 * viewBox, title, bg } for a `kind:'carved-solid'` manifest (WORLD_KINDS resolver).
 */
export function assembleCarvedSolidScene(manifest = {}, ctx = {}) {
  const { shape, style = {}, material, metal, inner: innerSpec, camera = {} } = manifest;
  const mat = resolveMaterial(material ?? metal);
  const inner = parseInner(innerSpec);
  const phase = manifest.phase ?? 0.2;                       // the still's phase (renderCarvedSolidToSvg)
  const contours = resolveContours(shape, style);
  const cb = bbox(contours);
  const { FIT_W, FIT_H, Z_C, LIGHT, CAM, VW, VH, BG } = CARVE_VIEW;
  const S = Math.min(FIT_W / (cb.w || 1), FIT_H / (cb.h || 1));
  const depth = style.depth ?? 0.34;
  const { faces } = extrudeProfile(contours, { depth, bevel: style.bevel ?? 0.05, bevelSteps: style.bevelSteps ?? 6 });
  const yaw = (camera.yaw ?? CARVE_VIEW.yaw) * Math.PI / 180;
  const fov = camera.fov ?? CARVE_VIEW.fov;

  // ── the same placement + shading kernels as renderFrame ──
  const place = ([x, y, z]) => { const ca = Math.cos(yaw), sa = Math.sin(yaw); return [-(x * ca - z * sa) * S, x * sa + z * ca, Z_C + y * S]; };
  const orient = (n, from, to) => (dot3(n, sub3(to, from)) < 0 ? [-n[0], -n[1], -n[2]] : n);
  const lambertOf = (n) => Math.max(0, dot3(n, LIGHT.toLight));
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
  const alpha = typeof mat.opacity === 'number' && mat.opacity < 1 ? { alpha: mat.opacity } : {};

  const world = faces.map((f) => (f.kind === 'cap' ? { ...f, w: f.contours.map((r) => r.map(place)) } : { ...f, w: f.pts.map(place) }));
  const center = centroid(world.flatMap((f) => (f.kind === 'cap' ? f.w[0] : f.w)));
  const out = [];
  for (const f of world) {
    if (f.kind === 'cap') {
      // one planar cap = one fill (the SVG paints the whole evenodd path uniformly);
      // tessellate the raw 2D rings at the cap's z, then place each triangle.
      const r0 = f.w[0], c = centroid(r0);
      const n = orient(newellNormal(r0), center, c);
      const fill = surf(n, c);
      const z = f.contours[0][0][2];
      const rings2d = f.contours.map((r) => r.map(([x, y]) => [x, y]));
      for (const tri of triangulateRings(rings2d)) {
        // the World mesh builder consumes quads — pad [a,b,c] → [a,b,c,c]
        // (padTrianglesForWorld's convention; the second split tri is degenerate).
        const c3 = tri.map(([x, y]) => place([x, y, z]));
        out.push({ corners: [...c3, c3[2]], fill, group: 'carved', ...alpha });
      }
    } else {
      const c = centroid(f.w);
      const n = orient(newellNormal(f.w), center, c);
      out.push({ corners: f.w, fill: surf(n, c), group: 'carved', ...alpha });
    }
  }

  return {
    faces: out,
    cameras: [{ name: 'hero', worldFraming: { cameraPosition: [...CAM], lookAt: [0, 0, Z_C], horizontalFov: fov, pictureCenter: [VW / 2, VH / 2] } }],
    viewBox: { width: VW, height: VH },
    title: ctx.title || manifest.title || 'mojulo carved solid',
    bg: BG,
  };
}
