/**
 * complex-view — a complex function f(z) as an ANALYTIC LANDSCAPE (domain colouring in 3-D). Every point
 * of the plane is a complex number z = x+iy; the surface HEIGHT is the (compressed) log-modulus, so
 * ZEROS become pits and POLES become spikes, and the COLOUR is the phase arg(f) swept around a full hue
 * wheel. Complex analysis — otherwise invisible — becomes terrain you can orbit: you can SEE a zero, a
 * pole, and how f winds the phase around them.
 *
 * One idea, five hats:
 *   • square     — f = z²: a double zero at the origin (a deep pit) — the colour wheel goes round TWICE
 *   • reciprocal — f = 1/z: a single POLE at the origin (a spike), the phase winding reversed
 *   • rational    — f = (z²−1)/(z²+1): ZEROS at ±1 (pits) AND POLES at ±i (spikes) together
 *   • exp         — f = eˣ⁺ⁱʸ: modulus ramps with x, phase = y → horizontal bands of colour
 *   • mobius      — f = (z−1)/(z+1): a zero at +1 and a pole at −1 (a Möbius map)
 *
 * Built as baked Lambert-shaded `faces` (relief from per-quad normals; colour from the phase), same
 * machinery as surface-view. No new renderer primitive.
 *
 * Stored manifest IS the recipe:
 *   { kind:'complex-view', scenario?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

import { makeLight, shadeFace } from '../../polygonizer/vexar.js';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));
const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });

// ── complex arithmetic (a complex number is [re, im]) ──
const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1] || 1e-12; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
const cexp = (a) => { const e = Math.exp(a[0]); return [e * Math.cos(a[1]), e * Math.sin(a[1])]; };
const cabs = (a) => Math.hypot(a[0], a[1]);
const carg = (a) => Math.atan2(a[1], a[0]);

// HSV (h in [0,360), s,v in [0,1]) → '#rrggbb'. Phase → hue is the heart of domain colouring.
function hsvHex(h, s, v) {
  const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0]; else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c]; else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return '#' + [r, g, b].map((u) => Math.round((u + m) * 255).toString(16).padStart(2, '0')).join('');
}

const SCENARIOS = {
  square: { f: (z) => cmul(z, z), title: 'f(z) = z²', blurb: 'a double zero at the origin (a deep pit) — the phase wheel sweeps round TWICE per loop (the colours cycle twice)' },
  reciprocal: { f: (z) => cdiv([1, 0], z), title: 'f(z) = 1/z', blurb: 'a single POLE at the origin: a spike to infinity, and the phase winds the OPPOSITE way to z²' },
  rational: { f: (z) => cdiv(csub(cmul(z, z), [1, 0]), cadd(cmul(z, z), [1, 0])), title: 'f(z) = (z²−1)/(z²+1)', blurb: 'ZEROS at ±1 (pits) and POLES at ±i (spikes) on one surface — read both off the relief at once' },
  exp: { f: (z) => cexp(z), title: 'f(z) = eᶻ', blurb: 'modulus = eˣ ramps left→right; phase = y, so the colour repeats in horizontal bands every 2π up the imaginary axis' },
  mobius: { f: (z) => cdiv(csub(z, [1, 0]), cadd(z, [1, 0])), title: 'f(z) = (z−1)/(z+1)', blurb: 'a Möbius map: one zero at +1 (pit) and one pole at −1 (spike) — the building block of conformal maps' },
};
export const COMPLEX_SCENARIOS = Object.keys(SCENARIOS);

const D = 2.2;       // domain [−D, D]² in the complex plane
const NCELL = 60;
const U = 3.6;       // render units per unit
const HCLAMP = 0.98; // log-modulus compressed to (−1,1); height = HCLAMP·(2/π)·atan(log|f|)
const ZSPAN = 0.55 * D * U;  // render height for h = ±1
const LIGHT = makeLight({ direction: [0.3, -0.4, -0.86], ambient: 0.5, diffuse: 0.6 });

// compressed height from |f|: zeros (|f|→0) → −1, poles (|f|→∞) → +1, |f|=1 → 0.
const heightOf = (m) => HCLAMP * (2 / Math.PI) * Math.atan(Math.log(m + 1e-12));

/**
 * Resolve a recipe → { faces, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planComplexScene(recipe = {}) {
  const scen = COMPLEX_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'square';
  const s = SCENARIOS[scen];
  const f = s.f;
  const step = (2 * D) / NCELL;
  const Pt = (x, y, h) => [x * U, y * U, h * ZSPAN];

  // precompute height at every grid corner (for relief) once.
  const H = [];
  for (let i = 0; i <= NCELL; i++) {
    H.push([]);
    for (let j = 0; j <= NCELL; j++) {
      const x = -D + i * step, y = -D + j * step;
      H[i].push(heightOf(cabs(f([x, y]))));
    }
  }

  const faces = [];
  for (let i = 0; i < NCELL; i++) {
    for (let j = 0; j < NCELL; j++) {
      const x0 = -D + i * step, y0 = -D + j * step, x1 = x0 + step, y1 = y0 + step;
      const corners = [Pt(x0, y0, H[i][j]), Pt(x1, y0, H[i + 1][j]), Pt(x1, y1, H[i + 1][j + 1]), Pt(x0, y1, H[i][j + 1])];
      // colour by the PHASE at the cell centre (avoids averaging across the ±π branch cut).
      const fc = f([x0 + step / 2, y0 + step / 2]);
      const hue = ((carg(fc) * 180 / Math.PI) + 360) % 360;
      const base = hsvHex(hue, 0.82, 1.0);
      const { fill } = shadeFace(corners, base, { light: LIGHT, inside: [x0 * U, y0 * U, -1e4] });   // normals up
      faces.push(quad(corners, fill, 'surface'));
    }
  }

  const picks = [
    { name: 'surface', kind: 'domain-colour', label: `domain colouring · ${s.title}`, fields: compactFields([['height', 'log|f|: pits = ZEROS, spikes = POLES'], ['colour', 'phase arg(f) around a hue wheel'], ['how to read', 'a point where every colour meets = a zero or a pole']]) },
  ];

  return {
    faces, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Complex function — ${s.title}  (domain colouring)`,
      s.blurb,
      'colour = phase arg(f) (the hue wheel) · height = log|f| (pits = zeros, spikes = poles)',
      'a spot where all the colours spin together is a zero (pit) or a pole (spike)',
    ] }],
    bounds: { center: [0, 0, 0], radius: D * U * 1.5 },
    stats: { scenario: scen, domain: [-D, D] },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — a low 3/4 camera for the relief (+ a top for the colours).
 */
export function assembleComplexScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planComplexScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((ff) => ({ ...ff, corners: ff.corners.map(sc) }));
  const d = plan.bounds.radius * scale;

  const cameras = [
    { name: '3/4', worldFraming: { cameraPosition: [d * 0.65, -d * 1.15, d * 0.8], lookAt: [0, 0, 0], horizontalFov: 50 } },
    { name: 'top', worldFraming: { cameraPosition: [0, -d * 0.12, d * 2.3], lookAt: [0, 0, 0], horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#07080f';
  return {
    faces,
    picks: plan.picks,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1080, height: 880 },
    title: title || recipe.title || `mojulo complex · ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
