/**
 * THE SPACE BACKDROP — what a space map's sky holds beyond its stars: a nebula's band, planets lit by the map's own star,
 * a far sun. Composed from the map's seed under a few rules of colour and layout, and drawn once into the sky at
 * infinity (scene/channels/space-backdrop.js), so it never moves with the craft and costs nothing a frame.
 *
 *   THE NEBULA: a band across the sky, as a galaxy's plane is (its glow strongest on its great circle and thinning off
 *   it), clouds of gas in two hues with dust lanes dark through them and a few knots of a warm emission. Its hues are
 *   the star's complements (a warm star's sky cool: teal, blue, violet), and never the target's magenta (the cockpit's
 *   code, cockpit-look.js: the target is found by its hue alone). It is dim: a backdrop under the stars, the bolts and
 *   the instruments, never over them.
 *   THE PLANETS: a primary, large, set where the star lights it from the side (its phase a crescent or a gibbous, never
 *   full-faced and flat, never all dark), and up to two small ones; each of a kind (rocky, gas, ice, ocean, lava), its
 *   palette the kind's, a gas giant sometimes ringed, an atmosphere a rim in its own colour. Every planet clear of the
 *   star and of each other, so the star the craft are lit by is always seen.
 *   A FAR SUN: a small second star, red or blue-white by its temperature, far from the near one; it lights nothing.
 *
 *   planBackdrop({ star, seed?, planets?, nebula?, suns? }) → { nebula, planets, suns }   (star: the direction toward the
 *     map's star, unit; planets 0..3 (2), nebula true | false, suns 0..1 (1))
 *   BACKDROP              the numbers: the planets' sizes (angular radius, °), the clearances, the kinds and their palettes
 *   validateBackdrop(v)   → errors (strings) for a level's `space.backdrop` (false | true | { planets?, nebula?, suns?, seed? })
 *
 * Pure: the same star and seed, the same sky.
 */
import { mulberry32, strHash } from '../city/plan/dice.js';

export const BACKDROP = Object.freeze({
  // a planet's angular radius (°): the primary's, a small one's
  primary: Object.freeze([7, 12]), small: Object.freeze([1.2, 3]),
  // the primary from the star (°): lit from the side, a crescent to a gibbous
  phase: Object.freeze([55, 125]),
  // clear of the star (° past its radius) and of each other
  clear: 18, apart: 6,
  // a far sun at least this far from the near one (°), its size (° radius, the glow round it)
  sun: Object.freeze({ from: 70, r: 0.35, glow: 3.5 }),
  kinds: Object.freeze({
    rocky: Object.freeze({ base: '#8a6f55', alt: '#5a4636', atmo: '#9fb6d6', atmoK: 0.35 }),
    gas: Object.freeze({ base: '#c9a272', alt: '#7f5d40', atmo: '#e8c89a', atmoK: 0.6 }),
    ice: Object.freeze({ base: '#b8d7e6', alt: '#6f93a8', atmo: '#cfe9ff', atmoK: 0.5 }),
    ocean: Object.freeze({ base: '#2f5d8a', alt: '#3f7a4a', atmo: '#7fb7ff', atmoK: 0.9 }),
    lava: Object.freeze({ base: '#3a2320', alt: '#ff6a2a', atmo: '#ff9a5a', atmoK: 0.25 }),
  }),
  // the nebula's hue families (°), cool for a warm star (blue to violet: a teal reads green on the dark); the target's
  // band left out (cockpit-look.js magenta)
  hues: Object.freeze([200, 215, 230, 248, 265]), warm: 28, forbid: Object.freeze([285, 345]),
});

const KINDS = Object.keys(BACKDROP.kinds);
const DEG = Math.PI / 180;
const r3 = (v) => Math.round(v * 1000) / 1000;
const unit = (v) => { const L = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / L, v[1] / L, v[2] / L]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) / DEG;
// (a direction `deg` from `a`, turned `spin` round it)
function around(a, deg, spin) {
  const ref = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0], u = unit(cross(a, ref)), v = cross(a, u), t = deg * DEG;
  return unit([0, 1, 2].map((k) => a[k] * Math.cos(t) + Math.sin(t) * (u[k] * Math.cos(spin) + v[k] * Math.sin(spin))));
}
// a hue (°), a saturation and a value as hex
function hsv(h, s, v) {
  const f = (n) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export function validateBackdrop(v) {
  if (v === undefined || v === true || v === false) return [];
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['space.backdrop is true, false or { planets?, nebula?, suns?, seed? }'];
  const e = [];
  for (const k of Object.keys(v)) if (!['planets', 'nebula', 'suns', 'seed'].includes(k)) e.push(`space.backdrop.${k} is not a backdrop's word (planets, nebula, suns, seed)`);
  if (v.planets !== undefined && !(Number.isInteger(v.planets) && v.planets >= 0 && v.planets <= 3)) e.push('space.backdrop.planets is 0 to 3');
  if (v.suns !== undefined && !(Number.isInteger(v.suns) && v.suns >= 0 && v.suns <= 1)) e.push('space.backdrop.suns is 0 or 1');
  if (v.nebula !== undefined && typeof v.nebula !== 'boolean') e.push('space.backdrop.nebula is true or false');
  if (v.seed !== undefined && !Number.isFinite(v.seed)) e.push('space.backdrop.seed is a number');
  return e;
}

export function planBackdrop({ star, seed = 1, planets = 2, nebula = true, suns = 1 } = {}) {
  const S = unit(star || [0, 0, 1]), rnd = mulberry32(strHash(`backdrop|${seed}`)), pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const span = ([lo, hi]) => lo + rnd() * (hi - lo);
  const placed = [{ dir: S, r: 1 + BACKDROP.clear }];
  const free = (d, r, gap) => placed.every((p) => angle(d, p.dir) > p.r + r + gap);
  // THE PLANETS: the primary from the side of the star, then the small ones where the sky is free
  const out = [];
  for (let i = 0; i < planets; i++) {
    const primary = i === 0, r = span(primary ? BACKDROP.primary : BACKDROP.small);
    let dir = null;
    for (let t = 0; t < 40 && !dir; t++) {
      const d = primary ? around(S, span(BACKDROP.phase), rnd() * 2 * Math.PI) : unit([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
      if (free(d, r, BACKDROP.apart)) dir = d;
    }
    if (!dir) continue;
    const kind = primary ? pick(['gas', 'gas', 'ocean', 'rocky', 'ice']) : pick(KINDS), K = BACKDROP.kinds[kind];
    out.push({ dir: dir.map(r3), r: r3(r), kind, base: K.base, alt: K.alt, atmo: K.atmo, atmoK: K.atmoK, seed: Math.floor(rnd() * 1e6), ...(kind === 'gas' && rnd() < 0.55 ? { rings: { inner: r3(1.35 + rnd() * 0.2), outer: r3(2 + rnd() * 0.5), tilt: r3(10 + rnd() * 25) } } : {}) });
    placed.push({ dir, r: r * (out[out.length - 1].rings ? 2.5 : 1) });
  }
  // A FAR SUN: its temperature red or blue-white
  const far = [];
  for (let i = 0; i < suns; i++) {
    for (let t = 0; t < 40; t++) {
      const d = unit([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
      if (angle(d, S) >= BACKDROP.sun.from && free(d, BACKDROP.sun.glow, 2)) { const cool = rnd() < 0.5; far.push({ dir: d.map(r3), r: BACKDROP.sun.r, glow: BACKDROP.sun.glow, color: cool ? '#ffb38a' : '#a9c8ff' }); placed.push({ dir: d, r: BACKDROP.sun.glow }); break; }
    }
  }
  // THE NEBULA: a band on a great circle, two cool hues a step apart, a warm emission in knots
  let neb = null;
  if (nebula) {
    const hues = BACKDROP.hues, i = Math.floor(rnd() * (hues.length - 1)), a = hues[i], b = hues[Math.min(hues.length - 1, i + 1 + Math.floor(rnd() * 2))];
    neb = { plane: unit([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]).map(r3), width: r3(0.22 + rnd() * 0.18), a: hsv(a, 0.62, 0.55), b: hsv(b, 0.55, 0.5), warm: hsv(BACKDROP.warm, 0.7, 0.75), dust: r3(0.45 + rnd() * 0.3), glow: r3(0.17 + rnd() * 0.07), seed: Math.floor(rnd() * 1e6) };
  }
  return { nebula: neb, planets: out, suns: far };
}
