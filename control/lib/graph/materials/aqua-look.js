import * as dmath from '../../util/dmath.js';

// The water look: what a body of water does to light, as a handful of numbers the World page's water
// shader reads (scene/channels/aqua-glsl.js). A preset is a kind of water, not a colour — the body
// colour stays with whatever drew the water (a sheet's vertex tint, a surface's deep→surf ramp); the
// look adds what a tint can't: fine ripples over the waves, the sky reflected by Fresnel (F0 ≈ 0.02 for
// n = 1.333, so water is nearly clear head-on and a mirror at grazing), a sun glint whose roughness rises
// with distance, and foam drawn as bubble lace.
//
//   rough   GGX roughness of the sun glint near the camera (far water widens it, so it never shimmers)
//   nScale  detail-ripple frequency, cycles per world unit (divided by `unit` for scaled scenes)
//   nAmp    detail-ripple slope (0 = a mirror, 0.5 = a choppy skin)
//   nSpeed  how fast the detail ripples drift, world units per second (scaled by `unit`)
//   flow    the drift direction (a river flows; still water wanders)
//   froth   bubble-lace frequency relative to nScale (bigger = finer bubbles)
//   foamThr Jacobian threshold for whitecaps: the surface starts to foam where J < foamThr
//   refl    reflection gain (a murky canal reflects less of the sky than open sea, not physically — legibly)
//   sigma   absorption per world unit, r/g/b (Beer–Lambert; water eats red first): how fast the bed fades with depth
//   tint    the colour thin water scatters back (sRGB): clear seas and pools go turquoise, rivers olive
//   shore   foam band width, world units: water thinner than this (over a beach, against a bank or a post) froths
export const AQUA_PRESETS = {
  ocean: { rough: 0.07, nScale: 0.32, nAmp: 0.24, nSpeed: 0.7, flow: [0.6, 0.8], froth: 2.2, foamThr: 0.74, refl: 1, sigma: [0.45, 0.09, 0.06], shore: 1.4, tint: '#2f8f9a' },
  lagoon: { rough: 0.05, nScale: 0.45, nAmp: 0.24, nSpeed: 0.5, flow: [0.6, 0.8], froth: 2.6, foamThr: 0.66, refl: 0.9, sigma: [0.9, 0.16, 0.1], shore: 1.1, tint: '#5fd6c8' },
  lake: { rough: 0.035, nScale: 0.6, nAmp: 0.1, nSpeed: 0.25, flow: [0.8, 0.6], froth: 2.6, foamThr: 0.72, refl: 1, sigma: [0.5, 0.14, 0.1], shore: 0.6, tint: '#5f8f7a' },
  river: { rough: 0.08, nScale: 0.7, nAmp: 0.16, nSpeed: 1.4, flow: [0, 1], froth: 2.4, foamThr: 0.55, refl: 0.5, sigma: [0.9, 0.35, 0.3], shore: 0.8, tint: '#7a9a7e' },
  canal: { rough: 0.04, nScale: 0.8, nAmp: 0.08, nSpeed: 0.2, flow: [1, 0], froth: 2.6, foamThr: 0.75, refl: 0.85, sigma: [1.2, 0.6, 0.55], shore: 0.35, tint: '#5c7462' },
  pool: { rough: 0.03, nScale: 1.2, nAmp: 0.14, nSpeed: 0.45, flow: [0.7, 0.7], froth: 3, foamThr: 0.75, refl: 0.9, sigma: [0.2, 0.03, 0.02], shore: 0.25, tint: '#7fe3ee' },
  falls: { rough: 0.12, nScale: 1, nAmp: 0.45, nSpeed: 2.2, flow: [0, -1], froth: 3.2, foamThr: 0.35, refl: 0.5, sigma: [0.6, 0.2, 0.15], shore: 1.2, tint: '#cfe8ea' },
};
export const AQUA_KINDS = Object.keys(AQUA_PRESETS);

// override bounds — a recipe may nudge a preset, never break the shader
const BOUNDS = { shore: [0, 50], rough: [0.01, 0.5], nScale: [0.01, 20], nAmp: [0, 1], nSpeed: [0, 20], froth: [0.5, 8], foamThr: [-1, 1.5], refl: [0, 1.5] };
// the fallback sky when the scene has none and no background: a bright overcast blue, linear light
const SKY0 = { zen: [0.16, 0.3, 0.52], hor: [0.62, 0.7, 0.78] };

const r4 = (v) => +(+v).toFixed(4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// sRGB (0..1 or 0..255) → linear
const lin = (c) => { const v = c > 1 ? c / 255 : c; return v <= 0.04045 ? v / 12.92 : dmath.pow((v + 0.055) / 1.055, 2.4); };
const hexRgb = (h) => (typeof h === 'string' && /^#[0-9a-fA-F]{6}$/.test(h) ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : null);
const mix3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * The sky the water reflects, in linear light: the scene's atmosphere sky when it has one (zenith/horizon),
 * else the page background (zenith = bg, horizon lifted toward white — water at grazing shows the bright band
 * just above the horizon), else a bright overcast. The ground (reflected below the horizon) is the horizon dimmed.
 */
function skyOf(sky, bg) {
  let zen, hor;
  if (sky && Array.isArray(sky.zenith) && sky.zenith.length >= 3 && Array.isArray(sky.horizon) && sky.horizon.length >= 3) {
    zen = sky.zenith.slice(0, 3).map(lin); hor = sky.horizon.slice(0, 3).map(lin);
  } else if (hexRgb(bg)) {
    zen = hexRgb(bg).map(lin); hor = mix3(zen, [0.85, 0.88, 0.92], 0.18);
  } else { zen = SKY0.zen; hor = SKY0.hor; }
  return { zen: zen.map(r4), hor: hor.map(r4), gnd: hor.map((v) => r4(v * 0.35)) };
}

/**
 * Resolve a water look for the page. `spec` is a kind name or `{ kind, ...overrides }`; an unknown kind
 * resolves to null (no look — the caller keeps the old shading). `unit` rescales the ripple frequency and
 * drift for scenes built at a non-unit scale (an ocean at scale 2 has ripples half as dense per unit).
 * Pure: the same arguments give the same numbers, rounded to 4 places so the emitted page is byte-stable.
 */
export function resolveAquaLook(spec, { sky = null, bg = null, unit = 1 } = {}) {
  const o = typeof spec === 'string' ? { kind: spec } : spec && typeof spec === 'object' ? spec : null;
  if (!o || !AQUA_PRESETS[o.kind]) return null;
  const p = { ...AQUA_PRESETS[o.kind] };
  for (const [k, [lo, hi]] of Object.entries(BOUNDS)) if (Number.isFinite(+o[k]) && o[k] !== null && o[k] !== '') p[k] = clamp(+o[k], lo, hi);
  if (Array.isArray(o.flow) && o.flow.length >= 2 && o.flow.every((v) => Number.isFinite(+v)) && (o.flow[0] || o.flow[1])) p.flow = [+o.flow[0], +o.flow[1]];
  const u = Number.isFinite(+unit) && +unit > 0 ? +unit : 1;
  const fl = dmath.hypot(p.flow[0], p.flow[1]) || 1;
  return {
    kind: o.kind,
    ...skyOf(sky, bg),
    rough: r4(p.rough), nScale: r4(p.nScale / u), nAmp: r4(p.nAmp), nSpeed: r4(p.nSpeed * u),
    flow: [r4(p.flow[0] / fl), r4(p.flow[1] / fl)], froth: r4(p.froth), foamThr: r4(p.foamThr), refl: r4(p.refl),
    sigma: p.sigma.map((v) => r4(v / u)), shore: r4(p.shore * u), tint: (hexRgb(typeof o.tint === 'string' && hexRgb(o.tint) ? o.tint : p.tint)).map((c) => r4(lin(c))),
  };
}

/**
 * The whitecap measure of a Gerstner sea at (x, y, t): the Jacobian of the horizontal displacement
 * D = Σ Q·A·d·cos θ. Undisturbed water has J = 1; a crest that pinches the surface together drives J toward 0,
 * and below 0 the surface would fold through itself — that's where real seas break and trap air. The World
 * page runs the same maths per vertex in surface.js (kept in step by surface-aqua.test.js).
 */
export function gerstnerJacobian(waves, x, y, t) {
  let jxx = 0, jyy = 0, jxy = 0;
  for (const w of waves) {
    const s = Math.sin(w.k * (w.dx * x + w.dy * y) - w.om * t + w.ph), q = w.Q * w.A * w.k * s;
    jxx -= q * w.dx * w.dx; jyy -= q * w.dy * w.dy; jxy -= q * w.dx * w.dy;
  }
  return (1 + jxx) * (1 + jyy) - jxy * jxy;
}

/**
 * A view's surfaces with the water look attached: `spec` is the recipe's `aqua` (a kind, `{ kind, ...overrides }`,
 * or `false` to keep the old crest-tint shading), defaulting to the view's own kind. Surfaces already carrying a
 * look keep it.
 */
export function withAqua(surfaces, spec, fallbackKind, opts = {}) {
  if (spec === false || !Array.isArray(surfaces)) return surfaces;
  const look = resolveAquaLook(spec == null ? fallbackKind : spec, opts) || resolveAquaLook(fallbackKind, opts);
  return look ? surfaces.map((sf) => (sf && !sf.aqua ? { ...sf, aqua: look } : sf)) : surfaces;
}
