/**
 * light-diffusion-3d — the metamandala light-diffusion ray tracer
 * (neo-rembrandt's applyMetamandalaLightDiffusion) re-homed from the 2D
 * picture-plane into 3D WORLD space, so its per-face energy bake is
 * camera-independent and composes with the CSS-3D backend's other baked terms
 * (vexar / gravity / lamps).
 *
 * Model carried over verbatim: a source emits N rays in a cone; each ray is
 * traced against the world faces; on a hit it deposits energy = power · cosθ ·
 * intensity (θ = ray vs face normal); then the ray REFLECTS and continues, its
 * power decayed by falloff · reflectivity, up to `bounces`. So this has the three
 * things the direct point-lamp lacks: real OCCLUSION (a wall stops the ray),
 * BOUNCE (indirect fill — light reaches the ceiling off the floor), and SPILL
 * (a ray through a doorway opening keeps going into the next room).
 *
 * The only change from the 2D original is dimensional: 3D ray/quad intersection
 * (Möller–Trumbore) instead of 2D ray/segment, and a 3D normal instead of normal2.
 * Output is a per-face additive [r,g,b] light, applied over the already-shaded fill.
 */

import { hexToRgb, rgbToHex } from './polygonizer/vexar.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => { const l = len(a); return [a[0] / l, a[1] / l, a[2] / l]; };
const reflect = (d, n) => sub(d, scl(n, 2 * dot(d, n)));
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

const faceNormal = (c) => norm(cross(sub(c[1], c[0]), sub(c[3] || c[2], c[0])));

// Möller–Trumbore ray/triangle; returns t (>0) or Infinity.
function rayTri(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-9) return Infinity;
  const inv = 1 / det, tv = sub(o, a), u = dot(tv, p) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return Infinity;
  const q = cross(tv, e1), v = dot(d, q) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return Infinity;
  const t = dot(e2, q) * inv;
  return t > 1e-4 ? t : Infinity;
}
const rayQuad = (o, d, c) => Math.min(rayTri(o, d, c[0], c[1], c[2]), rayTri(o, d, c[0], c[2], c[3]));

// N ray directions in a cone of half-angle `coneDeg` about `axis` (fibonacci, deterministic).
function coneDirs(axis, coneDeg, n) {
  const A = norm(axis);
  const up = Math.abs(A[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1];
  const X = norm(cross(up, A)), Y = cross(A, X);
  const cosMax = Math.cos((coneDeg * Math.PI) / 180);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const cz = 1 - ((i + 0.5) / n) * (1 - cosMax);
    const sz = Math.sqrt(Math.max(0, 1 - cz * cz));
    const phi = i * GOLDEN;
    out.push(norm(add(add(scl(X, sz * Math.cos(phi)), scl(Y, sz * Math.sin(phi))), scl(A, cz))));
  }
  return out;
}

/**
 * Trace each source's rays against the world faces and accumulate per-face
 * additive light. faces: [{ corners, reflectivity?, skinTransparency? }].
 * source: { pos, dir?, color?[0..1], intensity?, rays?, bounces?, falloff?,
 *   minPower?, spread?(deg), exposure? }.
 * @returns {number[][]} per-face [r,g,b] additive light (roughly 0..1+ per channel).
 */
// Shared trace: emits per-face additive `energy` AND a `field` — the energy-weighted
// centroid (in the face's own u,v) and spread of where the rays actually landed. The
// field is what lets the soft renderer place a gradient pool where light hit, rather
// than flat-filling the whole face.
function traceDiffusion({ faces, sources = [], reflectivity = 0.45, shadows = false }) {
  const geo = faces.map((f) => {
    const c = f.corners, uAxis = sub(c[1], c[0]), vAxis = sub(c[3] || c[2], c[0]);
    // transmission: `transmit` (0..1 transmittance) OR `skinTransparency >= 1` → glass;
    // a transmitting face passes light through (attenuated by `transmit`, tinted by
    // `glassTint`) instead of blocking it — the closed-window analogue of an opening.
    const transmit = Number.isFinite(f.transmit) ? Math.max(0, Math.min(1, f.transmit)) : (f.skinTransparency >= 1 ? 0.78 : 0);
    return { c, n: faceNormal(c), refl: f.reflectivity ?? reflectivity, transmit, tint: f.glassTint || [0.82, 0.9, 1.0], c0: c[0], uAxis, vAxis, uL2: dot(uAxis, uAxis) || 1, vL2: dot(vAxis, vAxis) || 1 };
  });
  const energy = faces.map(() => [0, 0, 0]);
  const fld = faces.map(() => ({ w: 0, u: 0, v: 0, u2: 0, v2: 0 })); // weighted u,v moments (light)
  const senergy = faces.map(() => 0);                                // scalar blocked-light (shadow)
  const sfld = faces.map(() => ({ w: 0, u: 0, v: 0, u2: 0, v2: 0 })); // weighted u,v moments (shadow)
  const nearest = (o, d, skip) => {
    let best = Infinity, bi = -1;
    for (let i = 0; i < geo.length; i += 1) {
      if (i === skip) continue;
      const t = rayQuad(o, d, geo[i].c);
      if (t < best) { best = t; bi = i; }
    }
    return bi < 0 ? null : { idx: bi, t: best, point: add(o, scl(d, best)) };
  };
  const accum = (F, g, point, e) => {
    const dx = sub(point, g.c0), u = dot(dx, g.uAxis) / g.uL2, v = dot(dx, g.vAxis) / g.vL2;
    F.w += e; F.u += u * e; F.v += v * e; F.u2 += u * u * e; F.v2 += v * v * e;
  };
  // floor receivers (upward faces at the base) — where cast shadows land. A ray that
  // hits an elevated object is projected DOWN ALONG THE LIGHT to the floor; the spot
  // it would have lit is darkened (skips the occluder's own back faces entirely).
  const floors = [];
  geo.forEach((g, i) => {
    const zc = g.c.reduce((a, p) => a + p[2], 0) / g.c.length;
    if (Math.abs(g.n[2]) > 0.7 && zc < 0.12) {
      const xs = g.c.map((p) => p[0]), ys = g.c.map((p) => p[1]);
      floors.push({ i, g, minx: Math.min(...xs), maxx: Math.max(...xs), miny: Math.min(...ys), maxy: Math.max(...ys) });
    }
  });
  const castShadow = (hit, d, power, rays) => {
    if (hit.point[2] <= 0.15 || d[2] >= -0.05) return; // not elevated, or ray not heading down
    const t = -hit.point[2] / d[2];
    const gx = hit.point[0] + d[0] * t, gy = hit.point[1] + d[1] * t;
    for (const fl of floors) {
      if (gx >= fl.minx && gx <= fl.maxx && gy >= fl.miny && gy <= fl.maxy) {
        const se = (power * Math.max(Math.abs(d[2]), 0.08)) / rays; // the light this occluder blocked from the floor
        senergy[fl.i] += se;
        accum(sfld[fl.i], fl.g, [gx, gy, 0], se);
        return;
      }
    }
  };
  for (const s of sources) {
    const col = s.color || [1, 0.9, 0.75];
    const rays = s.rays ?? 64, bounces = s.bounces ?? 2, falloff = s.falloff ?? 0.5, minPower = s.minPower ?? 0.03;
    const p0 = (s.intensity ?? 1) * (s.exposure ?? 1); // per-ray power (~1); ray count normalized at deposit
    for (const d0 of coneDirs(s.dir || [0, 0, -1], s.spread ?? 85, rays)) {
      let o = s.pos, d = d0, power = p0, skip = -1;
      for (let b = 0; b <= bounces && power >= minPower; b += 1) {
        // march through any TRANSPARENT panes to the opaque receiver, accumulating the
        // glass attenuation (pmul) + tint (tr,tg,tb); each pane glows faintly.
        let cur = o, sk = skip, pmul = 1, tr = 1, tg = 1, tb = 1, hit = null;
        for (let pass = 0; pass < 6; pass += 1) {
          const h = nearest(cur, d, sk);
          if (!h) break;
          const gg = geo[h.idx];
          if (gg.transmit <= 0) { hit = h; break; }   // opaque receiver
          const gcos = Math.max(Math.abs(dot([-d[0], -d[1], -d[2]], gg.n)), 0.08);
          const ge = (power * pmul * 0.1 * gcos) / rays; // faint glow on the pane
          energy[h.idx][0] += col[0] * ge * tr; energy[h.idx][1] += col[1] * ge * tg; energy[h.idx][2] += col[2] * ge * tb;
          accum(fld[h.idx], gg, h.point, ge);
          pmul *= gg.transmit; tr *= gg.tint[0]; tg *= gg.tint[1]; tb *= gg.tint[2];
          cur = add(h.point, scl(d, 0.01)); sk = h.idx;
        }
        if (!hit) break;
        const g = geo[hit.idx];
        const cosθ = Math.max(Math.abs(dot([-d[0], -d[1], -d[2]], g.n)), 0.08);
        const e = (power * pmul * cosθ) / rays; // attenuated by any glass passed through
        energy[hit.idx][0] += col[0] * e * tr; energy[hit.idx][1] += col[1] * e * tg; energy[hit.idx][2] += col[2] * e * tb;
        accum(fld[hit.idx], g, hit.point, e);
        // SHADOW (inverse): on the FIRST hit of an elevated object, project that hit
        // down along the light to the floor — the spot it blocked is darkened there.
        if (shadows && b === 0) castShadow(hit, d, power * pmul, rays);
        d = norm(reflect(d, g.n));
        o = add(hit.point, scl(d, 0.01));
        power *= falloff * g.refl;
        skip = hit.idx;
      }
    }
  }
  return { energy, fld, senergy, sfld };
}

// finalize weighted u,v moments → { uv:[u,v]|null, spread }
function finalizeField(F) {
  if (F.w <= 0) return { uv: null, spread: 0 };
  const u = F.u / F.w, v = F.v / F.w;
  return { uv: [u, v], spread: Math.sqrt(Math.max(0, (F.u2 / F.w - u * u) + (F.v2 / F.w - v * v))) };
}

/** Bake per-face additive [r,g,b] light (the flat/hard model). */
export function bakeDiffusion3d(args) {
  return traceDiffusion(args).energy;
}

/** Bake per-face { e:[r,g,b], uv, spread, shadow:{ s, uv, spread } } — the light field
 *  (energy + where it landed) and, when `shadows`, the inverse shadow field (blocked
 *  light + where it fell behind occluders), both for the soft gradient renderer. */
export function bakeDiffusionField(args) {
  const { energy, fld, senergy, sfld } = traceDiffusion(args);
  return energy.map((e, i) => ({
    e,
    ...finalizeField(fld[i]),
    shadow: { s: senergy[i], ...finalizeField(sfld[i]) },
  }));
}

/** Add the baked diffusion light over each face's already-shaded fill (flat — the
 *  hard model: one uniform brightness per face). */
export function applyDiffusion(faces, energy, { gain = 1 } = {}) {
  return faces.map((f, i) => {
    const e = energy[i];
    if (!e || typeof f.fill !== 'string' || f.fill[0] !== '#' || f.fill.length !== 7) return f;
    const base = hexToRgb(f.fill);
    return { ...f, fill: rgbToHex([0, 1, 2].map((k) => Math.min(255, base[k] + e[k] * 255 * gain))) };
  });
}

/** Render the diffusion as a SOFT radial-gradient pool per face — a translucent light
 *  layer (rgba → transparent) centered where the rays landed, over the base fill. The
 *  gradient gives blurred edges and a smooth spread, replacing the flat per-face value;
 *  occlusion/bounce still decide which faces light and where the pool sits. */
export function applyDiffusionSoft(faces, field, { gain = 2.5, softness = 1, maxAlpha = 0.9, shadowStrength = 0.9, shadowMaxAlpha = 0.6, shadowColor = [10, 8, 6] } = {}) {
  // a soft radial pool: bright/dark center at (uv) fading to transparent at radius R.
  const pool = (uv, spread, rgb, a) => {
    const cx = Math.max(0, Math.min(100, uv[0] * 100)).toFixed(1);
    const cy = Math.max(0, Math.min(100, uv[1] * 100)).toFixed(1);
    const R = Math.max(16, Math.min(150, (spread * 2.2 + 0.16) * 100 * softness));
    const rgba = (al) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${al.toFixed(3)})`;
    return `radial-gradient(circle at ${cx}% ${cy}%, ${rgba(a)} 0%, ${rgba(a * 0.35)} ${(R * 0.5).toFixed(0)}%, ${rgba(0)} ${R.toFixed(0)}%)`;
  };
  return faces.map((f, i) => {
    const fd = field[i];
    // light a face with a hex fill OR a CSS bg (city facades use bg, not fill)
    const hasBase = (typeof f.fill === 'string' && f.fill[0] === '#') || typeof f.bg === 'string';
    if (!fd || !hasBase) return f;
    const layers = [];
    // shadow pool ON TOP — a cast shadow must darken even a lit area (the shadow falls
    // where the light WOULD have gone), so it sits above the light pool, over the base.
    const sh = fd.shadow;
    if (sh && sh.uv && sh.s >= 1e-3) {
      layers.push(pool(sh.uv, sh.spread, shadowColor, Math.min(shadowMaxAlpha, sh.s * gain * shadowStrength)));
    }
    // light pool (below the shadow, above the base fill)
    const m = Math.max(fd.e[0], fd.e[1], fd.e[2]);
    if (fd.uv && m >= 1e-3) {
      const lc = fd.e.map((c) => Math.round(Math.min(255, (c / m) * 255)));
      layers.push(pool(fd.uv, fd.spread, lc, Math.min(maxAlpha, m * gain)));
    }
    if (!layers.length) return f;
    return { ...f, bg: `${layers.join(', ')}, ${f.bg || f.fill}` };
  });
}

/** The visible fixture at a source: a downward-facing emissive disc (bright fill +
 *  CSS bloom halo), plus — when `source.stem` is the ceiling z of a LOWERED source —
 *  a thin cord from the ceiling down to the lamp, so it reads as a hanging pendant.
 *  Returns an array of faces; add AFTER baking so they neither occlude nor receive. */
export function emissiveFixture(source, { r = 0.16 } = {}) {
  const [x, y, z] = source.pos;
  const col = source.color || [1, 0.9, 0.75];
  const rgb = col.map((c) => Math.min(255, Math.round(c * 255)));
  const out = [];
  if (typeof source.stem === 'number' && source.stem > z + 0.05) {
    const w = 0.018; // thin vertical cord (x–z quad) from ceiling to lamp
    out.push({ corners: [[x - w, y, z], [x + w, y, z], [x + w, y, source.stem], [x - w, y, source.stem]], fill: '#1a1712', doubleSided: true });
  }
  const glow = `0 0 ${source.glowBlur ?? 28}px ${source.glowSpread ?? 9}px rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.55)`;
  out.push({ corners: [[x - r, y - r, z], [x + r, y - r, z], [x + r, y + r, z], [x - r, y + r, z]], fill: rgbToHex(rgb), clip: 'ellipse(50% 50%)', doubleSided: true, glow });
  return out;
}
