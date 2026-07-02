/**
 * sky-css — the painted-landscape SKY concept as a CSS backdrop for the CSS-3D
 * scenes. The painted landscape derives a sky from a palette + sun elevation
 * (`deriveSky`): a horizon→zenith gradient that rides the whole day→night arc, plus
 * a sun position and a day/glow factor. This renders the SAME concept as a layered
 * CSS `background` (linear gradient + radial sun/moon glow + star dots) you pass as
 * the viewport `bg` — dependency-free, camera-independent, the scene's sky.
 *
 * spec: {
 *   preset?: 'day'|'dusk'|'dawn'|'night'|'midnight',  // sets sunElev (+ default sun/moon/stars)
 *   sunElev?: number,  // -0.4 (deep night) … 1 (noon); overrides the preset
 *   azimuth?: number,  // -1 … 1, sun left→right
 *   palette?: { highlight:[r,g,b], shadow:[r,g,b] },   // tints the day gradient
 *   sun?: boolean|{ glow?, size? },
 *   moon?: boolean|{ size?, position?:{x,y} },
 *   stars?: boolean|number,   // night star density (0…1)
 *   horizonY?: number,        // screen fraction of the horizon line (default 0.62)
 *   seed?: number,
 * }
 */

import { deriveSky } from '../polygonizer/painted-landscape.js';

const DEFAULT_PALETTE = { highlight: [232, 224, 206], shadow: [58, 68, 92] };
const PRESETS = {
  day: { sunElev: 0.72, azimuth: 0.3, sun: true },
  dusk: { sunElev: 0.04, azimuth: 0.55, sun: true },
  dawn: { sunElev: 0.06, azimuth: -0.5, sun: true },
  night: { sunElev: -0.28, moon: true, stars: 0.55 },
  midnight: { sunElev: -0.42, moon: { size: 0.035, position: { x: 0.78, y: 0.16 } }, stars: 0.8 },
};

const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }

/** Build the CSS `background` value for a sky spec. */
export function skyCss(spec = {}) {
  const s = typeof spec === 'string' ? { preset: spec } : (spec || {});
  const base = PRESETS[s.preset] || PRESETS.day;
  const sunElev = s.sunElev ?? base.sunElev;
  const azimuth = s.azimuth ?? base.azimuth ?? 0;
  const palette = s.palette || DEFAULT_PALETTE;
  const horizonY = (s.horizonY ?? 0.62) * 100;
  const sky = deriveSky(palette, { x: azimuth, y: 0, z: sunElev }); // { zenith, horizon, day, glow, sunPos:{u,h} }

  const layers = [];
  // STARS (night) — deterministic dots in the upper sky
  const starDensity = s.stars ?? base.stars ?? 0;
  if (starDensity && sky.day < 0.5) {
    const rnd = lcg((s.seed ?? 7) * 2654435761);
    const n = Math.round(60 * Math.min(1, starDensity)) * (sky.day < 0.2 ? 1 : 0.6);
    for (let i = 0; i < n; i += 1) {
      const x = (rnd() * 100).toFixed(1), y = (rnd() * (horizonY - 4)).toFixed(1);
      const a = (0.35 + rnd() * 0.5).toFixed(2), px = rnd() < 0.18 ? 1.6 : 1;
      layers.push(`radial-gradient(${px}px ${px}px at ${x}% ${y}%, rgba(255,255,255,${a}) 0%, transparent 60%)`);
    }
  }
  // MOON (night) — a pale glowing disc
  const moon = s.moon ?? base.moon;
  if (moon && sky.day < 0.55) {
    const m = typeof moon === 'object' ? moon : {};
    const mx = ((m.position?.x ?? 0.74) * 100).toFixed(1), my = ((m.position?.y ?? 0.2) * 100).toFixed(1);
    const sz = (m.size ?? 0.03) * 100, disc = rgb([232, 238, 252]);
    layers.push(`radial-gradient(circle at ${mx}% ${my}%, ${disc} 0%, ${disc} ${sz.toFixed(1)}%, rgba(210,220,245,0.35) ${(sz * 1.8).toFixed(1)}%, transparent ${(sz * 4.5).toFixed(1)}%)`);
  }
  // SUN (day/dusk) — a warm glow at the derived sun position
  const sun = s.sun ?? base.sun;
  if (sun && sky.day > 0.12) {
    const sc = typeof sun === 'object' ? sun : {};
    const ux = (sky.sunPos.u * 100).toFixed(1);
    const uy = (horizonY - sky.sunPos.h * (horizonY - 6)).toFixed(1); // h: horizon→zenith maps low→high on screen
    const core = lerp(sky.horizon, [255, 250, 230], 0.7);
    const a = Math.min(0.85, (sc.glow ?? 1) * (0.4 + sky.glow * 0.5 + sky.day * 0.2));
    const r = (sc.size ?? 1) * (26 + sky.glow * 18);
    layers.push(`radial-gradient(circle at ${ux}% ${uy}%, ${rgb(core)} 0%, rgba(${core.map(Math.round).join(',')},${a.toFixed(2)}) ${(r * 0.28).toFixed(0)}%, transparent ${r.toFixed(0)}%)`);
  }
  // BASE gradient (bottom layer): zenith up top → horizon at the horizon line
  layers.push(`linear-gradient(to bottom, ${rgb(sky.zenith)} 0%, ${rgb(sky.zenith)} ${(horizonY * 0.28).toFixed(0)}%, ${rgb(sky.horizon)} ${horizonY.toFixed(0)}%, ${rgb(sky.horizon)} 100%)`);
  return layers.join(', ');
}
