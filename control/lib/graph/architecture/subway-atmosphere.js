/**
 * subway-atmosphere — OPT-IN traced-diffusion relight for the subway, the bar-world
 * atmospheric look: a dark low-ambient base + warm point sources at the ceiling fixtures
 * whose ray cones bake bright pools onto the faces they hit (distance falloff + occlusion),
 * plus the inverse CAST shadows where an object blocks the light.
 *
 * Built on light-diffusion-3d (`bakeDiffusionField`). Two subtleties handled here:
 *  • /world keeps face `fill`, not CSS `bg` — so we bake the light energy INTO the hex fill
 *    (the flat term, which survives) and emit the cast shadow as a `shadowDecal` (which the
 *    World realizes via collectShadowDecals). The soft `bg` pools would be CSS-only.
 *  • the tracer's floor receiver / cast-shadow projection assume the floor at z≈0, so each
 *    LEVEL is baked in a frame shifted to put its floor at 0, then shifted back — that lets
 *    cast shadows land on the platform AND the raised concourse.
 */

import { bakeDiffusionField, emissiveFixture } from '../effects/light-diffusion-3d.js';
import { hexToRgb, rgbToHex } from '../polygonizer/vexar.js';

const isHex = (s) => typeof s === 'string' && s[0] === '#' && s.length === 7;
const centroidZ = (f) => f.corners.reduce((a, c) => a + c[2], 0) / f.corners.length;

/** dim a baked #hex fill toward black (low ambient); leave emissive / glass / shadow faces. */
function dimFace(f, dim) {
  if (f.decal === 'shadow' || f.water || f.glow || !isHex(f.fill)) return f;
  return { ...f, fill: rgbToHex(hexToRgb(f.fill).map((v) => Math.round(v * dim))) };
}

const shiftZ = (f, dz) => ({ ...f, corners: f.corners.map((c) => [c[0], c[1], c[2] + dz]) });

const lerpN = (a, b, s) => a.map((v, i) => v + (b[i] - v) * s);
const bilerp = (p, s, t) => lerpN(lerpN(p[0], p[1], s), lerpN(p[3], p[2], s), t);
function upwardness(c) {
  const u = [c[1][0] - c[0][0], c[1][1] - c[0][1], c[1][2] - c[0][2]];
  const v = [c[3][0] - c[0][0], c[3][1] - c[0][1], c[3][2] - c[0][2]];
  const nz = u[0] * v[1] - u[1] * v[0];
  const nl = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], nz) || 1;
  return Math.abs(nz) / nl;
}

/**
 * Subdivide FLOOR receiver faces (upward-facing, near z≈0 in the bake frame) into a `tile`
 * grid, so the per-receiver-face cast-shadow accumulation lands per tile rather than
 * averaging every object's shadow onto one huge panel. UV is bilinearly carried so textured
 * floors (the marble) survive. Non-floor faces pass through untouched.
 */
function subdivideFloor(faces, tile = 1.6) {
  const out = [];
  for (const f of faces) {
    const c = f.corners;
    if (!Array.isArray(c) || c.length < 4 || f.decal === 'shadow' || f.water) { out.push(f); continue; }
    const zc = (c[0][2] + c[1][2] + c[2][2] + c[3][2]) / 4;
    if (upwardness(c) < 0.8 || Math.abs(zc) > 0.25) { out.push(f); continue; }   // not a floor in this frame
    const w = Math.hypot(c[1][0] - c[0][0], c[1][1] - c[0][1]);
    const h = Math.hypot(c[3][0] - c[0][0], c[3][1] - c[0][1]);
    const nx = Math.max(1, Math.round(w / tile)), ny = Math.max(1, Math.round(h / tile));
    if (nx * ny <= 1) { out.push(f); continue; }
    const u = Array.isArray(f.uv) && f.uv.length >= 4 ? f.uv : null;
    for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) {
      const s0 = i / nx, s1 = (i + 1) / nx, t0 = j / ny, t1 = (j + 1) / ny;
      const cell = { ...f, corners: [bilerp(c, s0, t0), bilerp(c, s1, t0), bilerp(c, s1, t1), bilerp(c, s0, t1)] };
      if (u) cell.uv = [bilerp(u, s0, t0), bilerp(u, s1, t0), bilerp(u, s1, t1), bilerp(u, s0, t1)];
      out.push(cell);
    }
  }
  return out;
}

/** Bake one level's faces (its floor near `floorZ`) — shift so the floor sits at 0 (where the
 *  tracer expects it), trace, brighten fills by energy + attach cast-shadow decals, shift back. */
function bakeLevel(faces, sources, floorZ, o) {
  if (!faces.length || !sources.length) return faces;
  const down = subdivideFloor(faces.map((f) => shiftZ(f, -floorZ)));   // tessellate floor → per-tile shadows
  const src = sources.map((s) => ({ ...s, pos: [s.pos[0], s.pos[1], s.pos[2] - floorZ] }));
  const field = bakeDiffusionField({ faces: down, sources: src, reflectivity: o.reflectivity, shadows: true });
  const lit = down.map((f, i) => {
    const fd = field[i];
    if (!fd) return f;
    let out = f;
    if (isHex(f.fill)) {
      const b = hexToRgb(f.fill);
      out = { ...f, fill: rgbToHex([0, 1, 2].map((k) => Math.min(255, b[k] + fd.e[k] * 255 * o.gain))) };
    }
    const sh = fd.shadow;
    if (sh && sh.uv && sh.s >= 1e-3) {
      out = { ...out, shadowDecal: { uv: sh.uv, spread: sh.spread, alpha: Math.min(o.shadowMaxAlpha, sh.s * o.gain * o.shadowStrength), color: o.shadowColor } };
    }
    return out;
  });
  const back = lit.map((f) => shiftZ(f, floorZ));
  for (const s of sources) if (s.fixture !== false) back.push(...emissiveFixture(s, { r: s.fixtureR ?? 0.16 }));
  return back;
}

/**
 * Relight a baked face list atmospherically.
 * @param faces  the composed scene faces (hex-filled).
 * @param levels [{ floorZ, zMin?, zMax?, sources }] — split faces by centroid z into levels;
 *               each level baked in its own floor frame.
 * @param opts   { dim, gain, reflectivity, shadowStrength, shadowMaxAlpha, shadowColor }
 */
export function applyAtmosphere(faces, levels, opts = {}) {
  const o = {
    dim: 0.4, gain: 2.0, reflectivity: 0.42, shadowStrength: 0.85, shadowMaxAlpha: 0.5,
    shadowColor: [8, 7, 9], ...opts,
  };
  const dimmed = faces.map((f) => dimFace(f, o.dim));
  const out = [];
  for (const lvl of levels) {
    const group = dimmed.filter((f) => {
      const z = centroidZ(f);
      return z >= (lvl.zMin ?? -Infinity) && z < (lvl.zMax ?? Infinity);
    });
    out.push(...bakeLevel(group, lvl.sources, lvl.floorZ, o));
  }
  return out;
}

/** Warm point sources at the platform's centre-strip ceiling fixtures. */
export function platformLightSources({ zCeil = 5.0, yEnd = 46, rays = 120 } = {}) {
  const out = [];
  for (let y = 3; y <= yEnd - 2; y += 6) {
    out.push({ pos: [10, y, zCeil - 0.1], dir: [0, 0, -1], spread: 64, color: [1, 0.86, 0.62], intensity: 2.2, rays, bounces: 2, falloff: 0.5, fixture: false });
  }
  return out;
}

/** Cooler skylight-ish sources over the open-top concourse (a coarse grid up near the cornice). */
export function concourseLightSources({ mezzZ, ceilZ, rays = 110 } = {}) {
  const out = [];
  const z = ceilZ - 0.3;
  for (const x of [6, 13]) for (const y of [24, 33, 42]) {
    out.push({ pos: [x, y, z], dir: [0, 0, -1], spread: 70, color: [0.95, 0.97, 1], intensity: 1.9, rays, bounces: 2, falloff: 0.5, fixture: false });
  }
  return out;
}
