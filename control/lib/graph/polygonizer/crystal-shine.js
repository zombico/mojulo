/**
 * crystal-shine — how a crystal looks, per facet, without a second render pass (crystal-shine S3).
 *
 * The crystal-light study found that a real-time transmission material gets glass right and every crystal's
 * signature wrong, and costs a full extra pass. This is the other way: an interpretive response computed per facet (the
 * CSS turntable) or per pixel (its GLSL twin on the World page), from the stone's exact polytope and its optics:
 *   - a Fresnel glint of a small studio (a soft sky, a floor, the sun as a disc) off the facet;
 *   - the facet's "through" colour: the view ray refracts into the stone at each channel's own index, runs to the exit
 *     facet (exact: the stone is a convex polytope), refracts out or reflects (total internal reflection, up to three
 *     times), and reads the studio where it leaves. Three channels leaving in three directions are fire; a trapped ray
 *     is brilliance; a uniaxial stone sends an ordinary and an extraordinary ray (two sparkles: calcite's double image);
 *   - the colour of that path: the stone's colour after that many cm, per ray (a thin ruby path is pink, a long one
 *     red; tourmaline's ordinary ray is dark, so it is dark looking down c and green across it);
 *   - ruby's glow, stronger on the side the light reaches;
 *   - opal: each facet a domain of the sphere lattice, flashing the Bragg colour λ = 2·d·n·cosθ when it mirrors the
 *     light toward the eye.
 * Everything is in one frame against a fixed light and the eye: right under rotation. Linear sRGB out.
 *
 * Two halves, as crystal-print: `shineOptics(gem)` (JSON) and `shineKernel()` (self-contained; a page embeds it).
 */

import { crystalOptics, wavelengthRgb } from './crystal-optics.js';

/**
 * What the kernel needs from a gem: JSON-serializable. A variant 'gem~g' (0 < g ≤ 1) is the gem shining at strength g in
 * its own body colour (its 1 cm colour, brightest channel 1) — the glow dial, beside any glow the gem has by nature.
 */
export function shineOptics(key) {
  const [gem, g] = String(key).split('~'); const dial = Number.isFinite(+g) && +g > 0 ? Math.min(1, +g) : 0;
  const o = crystalOptics(gem); const r = (v) => +v.toPrecision(6);
  const body = (() => { const c = o.colour.o[2]; const m = Math.max(...c) || 1; return c.map((v) => v / m); })();
  const glow = dial ? { rgb: (o.glow && o.glow.strength >= dial ? o.glow.rgb : body).map(r), strength: r(Math.max(dial, o.glow ? o.glow.strength : 0)) } : o.glow ? { rgb: o.glow.rgb.map(r), strength: r(o.glow.strength) } : null;
  return {
    gem, uniaxial: o.opticalClass === 'uniaxial', n: { o: o.n.o.map(r), e: o.n.e.map(r) }, nD: r(o.nD), abbe: r(o.abbe),
    colour: { paths: [...o.colour.paths], o: o.colour.o.map((c) => c.map(r)), e: o.colour.e.map((c) => c.map(r)) },
    glow,
    photonic: o.photonic ? { d111: o.photonic.d111.map(r), nEff: r(o.photonic.nEff) } : null,
    spectrum: o.photonic ? Array.from({ length: 31 }, (_, i) => wavelengthRgb(400 + i * 10).map(r)) : null,   // 400–700 nm, for opal
    tint: o.tint,
  };
}

/** The response, self-contained: no free variables, so `(${shineKernel})()` runs the same code in a page. */
export function shineKernel() {
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const reflect = (d, n) => sub(d, scale(n, 2 * dot(d, n)));
  /** Refract unit d through a surface with unit normal n (n opposes d), index ratio eta = n1/n2; null past critical. */
  const refract = (d, n, eta) => { const c = -dot(n, d), k = 1 - eta * eta * (1 - c * c); return k < 0 ? null : unit(add(scale(d, eta), scale(n, eta * c - Math.sqrt(k)))); };
  const fresnel = (cosI, n) => { const r0 = ((n - 1) / (n + 1)) ** 2; return r0 + (1 - r0) * Math.pow(1 - Math.max(0, Math.min(1, cosI)), 5); };
  const hash = (i) => { let x = (i + 1) * 2654435761 >>> 0; x ^= x >>> 15; x = Math.imul(x, 0x2c1b3c6d) >>> 0; x ^= x >>> 12; return (x >>> 0) / 4294967296; };

  /**
   * The studio a crystal reflects and refracts (linear sRGB), a gem photographer's: a softbox overhead fading to a dark
   * horizon, a dark floor, and the sun as a small disc with a halo. `up` is the frame's up; `L` points to the sun.
   * A clear stone then reads as dark glass with bright facets (what it reflects and traps from above) and coloured
   * sparkles where a channel finds the sun.
   */
  function studio(d, L, up, s = {}) {
    // the sun is small (≈1.1°): a diamond parts its channels by 1–3°, so a wide sun would swallow the fire into white
    const zenith = s.zenith || [0.42, 0.44, 0.48], horizon = s.horizon || [0.025, 0.03, 0.045], floor = s.floor || [0.018, 0.02, 0.026];
    const sun = s.sun ?? 40, halo = s.halo ?? 0.9;
    const h = dot(d, up); const w = Math.pow(Math.max(0, h), 1.6);
    const base = s.sky ? (h > 0 ? s.sky : floor) : h > 0 ? horizon.map((c, k) => c + (zenith[k] - c) * w) : floor;
    const c = dot(d, L); const disc = c > 0.9998 ? sun : 0; const glow = halo * Math.pow(Math.max(0, c), 256) + 0.15 * halo * Math.pow(Math.max(0, c), 16);
    return base.map((b) => b + disc + glow);
  }
  /** A path's colour (a ray's table, geometric interpolation over path length in cm). */
  function pathColour(tab, paths, cm) {
    const x = Math.max(0, cm); let i = 0; while (i < paths.length - 2 && x > paths[i + 1]) i++;
    const t = x <= paths[0] ? 0 : (x - paths[i]) / (paths[i + 1] - paths[i]);
    if (x <= paths[0]) return [1, 1, 1].map((v, k) => 1 - (1 - tab[0][k]) * (x / Math.max(paths[0], 1e-9)));
    return tab[i].map((a, k) => { const b = tab[i + 1][k]; return a <= 0 || b <= 0 ? a + (b - a) * Math.min(1, t) : a * Math.pow(b / a, t); });
  }
  /** Follow a ray inside the stone (planes: world { n, d }) from p along d; returns { exit dir | null, path (units) }. */
  function inside(planes, p, d, n, maxBounce) {
    let path = 0;
    for (let b = 0; b <= maxBounce; b++) {
      let tMin = Infinity, hit = null;
      for (const pl of planes) { const dn = dot(pl.n, d); if (dn <= 1e-9) continue; const t = (pl.d - dot(pl.n, p)) / dn; if (t > 1e-9 && t < tMin) { tMin = t; hit = pl; } }
      if (!hit) return { dir: null, path, weight: 1 };
      p = add(p, scale(d, tMin)); path += tMin;
      const out = refract(d, scale(hit.n, -1), n);                              // from inside: the normal faces back in
      if (out) return { dir: out, path, weight: 1 - fresnel(dot(d, hit.n), n) };
      d = reflect(d, hit.n);                                                     // total internal reflection
    }
    return { dir: null, path, weight: 1 };
  }

  /**
   * One facet's colour. face: { centroid, normal, index } (world); V: unit, facet → eye; L: unit, to the light; up: the
   * frame's up; axis: the stone's c axis (world); cmPerUnit: how many cm one unit is; optics: shineOptics(gem).
   * Returns { rgb, alpha } in linear sRGB (alpha: how much of what is behind still shows; the through term is the view).
   */
  function faceShine({ optics, planes, face, V, L, up = [0, 0, 1], axis = [0, 0, 1], cmPerUnit = 1, studio: st, bounces = 3 }) {
    const N = face.normal; const cosV = dot(N, V); if (cosV <= 0) return { rgb: [0, 0, 0], alpha: 0 };
    const nMean = (optics.n.o[1] + optics.n.e[1]) / 2; const F = fresnel(cosV, nMean);
    const refl = studio(reflect(scale(V, -1), N), L, up, st).map((c) => c * F);
    const rgb = [0, 0, 0];
    if (optics.photonic) {                                                     // opal: a black body, a milky sheen, a Bragg flash
      const h1 = hash(face.index), h2 = hash(face.index + 7919), h3 = hash(face.index + 104729);
      const g = unit(add(scale(N, 0.55), [h1 - 0.5, h2 - 0.5, h3 - 0.5]));
      const H = unit(add(L, V)); const w = Math.exp(-(1 - Math.abs(dot(g, H))) / 0.012);
      const d = optics.photonic.d111[0] + (optics.photonic.d111[1] - optics.photonic.d111[0]) * hash(face.index + 31337);
      const lambda = 2 * d * optics.photonic.nEff * Math.abs(dot(g, V));
      if (lambda >= 400 && lambda <= 700 && w > 1e-4) { const s = optics.spectrum[Math.round((lambda - 400) / 10)]; for (let k = 0; k < 3; k++) rgb[k] += s[k] * w * 1.4; }
      for (let k = 0; k < 3; k++) rgb[k] += 0.012 + refl[k];
      return { rgb, alpha: 1 };
    }
    const rays = optics.uniaxial ? ['o', 'e'] : ['o'];
    for (const ray of rays) for (let k = 0; k < 3; k++) {
      const n = optics.n[ray][k]; const t = refract(scale(V, -1), N, 1 / n); if (!t) continue;
      const r = inside(planes, face.centroid, t, n, bounces);
      const eShare = ray === 'e' ? 1 - dot(t, axis) ** 2 : 0;
      const col = pathColour(optics.colour.o, optics.colour.paths, r.path * cmPerUnit);
      const colE = ray === 'e' ? pathColour(optics.colour.e, optics.colour.paths, r.path * cmPerUnit) : col;
      const absorb = col[k] * (1 - eShare) + colE[k] * eShare;
      const seen = r.dir ? studio(r.dir, L, up, st)[k] * r.weight : 0.02;       // a ray still trapped: a little inner light
      rgb[k] += (1 - F) * absorb * seen / rays.length;
    }
    if (optics.glow) {                                                         // ruby: re-emission where the light gets in
      const lit = 0.45 + 0.55 * Math.max(0, dot(N, L)); for (let k = 0; k < 3; k++) rgb[k] += optics.glow.rgb[k] * optics.glow.strength * lit * 0.55;
    }
    for (let k = 0; k < 3; k++) rgb[k] += refl[k];
    return { rgb, alpha: 1 };
  }
  return { faceShine, studio, inside, refract };
}
export const { faceShine, studio, inside, refract } = shineKernel();
