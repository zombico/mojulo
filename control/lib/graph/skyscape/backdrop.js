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
 *   full-faced and flat, never all dark), and up to two small ones; each a world the planet generator makes
 *   (planet-gen.js: an earthlike world, a desert, an ice giant, a city world, a black hole…), named by the level or
 *   drawn by weight. Every planet clear of the star and of each other (a black hole of its whole disk), so the star the
 *   craft are lit by is always seen.
 *   A FAR SUN: a small second star, red or blue-white by its temperature, far from the near one; it lights nothing.
 *
 *   planBackdrop({ star, seed?, planets?, worlds?, nebula?, suns? }) → { nebula, planets, suns }   (star: the direction
 *     toward the map's star, unit; planets 0..3 (2); worlds: the kinds asked, the first the large one ('random' a
 *     slot left to the dice); nebula true | false; suns 0..1 (1))
 *   BACKDROP              the numbers: the planets' sizes (angular radius, °), the clearances
 *   validateBackdrop(v)   → errors (strings) for a level's `space.backdrop` (false | true | { planets?, worlds?, nebula?,
 *                           suns?, seed? })
 *
 * Pure: the same star and seed, the same sky.
 */
import { mulberry32, strHash } from '../city/plan/dice.js';
import { PLANET_KINDS, BLACK_HOLE, generatePlanet, pickKind } from './planet-gen.js';

export const BACKDROP = Object.freeze({
  // a planet's angular radius (°): the primary's, a small one's
  primary: Object.freeze([7, 12]), small: Object.freeze([1.2, 3]),
  // the primary from the star (°): lit from the side, a half to a broad gibbous (its land and its terminator both seen)
  phase: Object.freeze([50, 105]),
  // a small world no further round from the star than this (°): at least about half of it lit, so it reads as itself
  lit: 110,
  // clear of the star (° past its radius) and of each other
  clear: 18, apart: 6,
  // a far sun at least this far from the near one (°), its size (° radius, the glow round it)
  sun: Object.freeze({ from: 70, r: 0.35, glow: 3.5 }),
  // the nebula's hue families (°), cool for a warm star (blue to violet: a teal reads green on the dark); the target's
  // band left out (cockpit-look.js magenta)
  hues: Object.freeze([200, 215, 230, 248, 265]), warm: 28, forbid: Object.freeze([285, 345]),
});

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
  if (!v || typeof v !== 'object' || Array.isArray(v)) return ['space.backdrop is true, false or { planets?, worlds?, nebula?, suns?, seed? }'];
  const e = [];
  for (const k of Object.keys(v)) if (!['planets', 'nebula', 'suns', 'seed', 'worlds'].includes(k)) e.push(`space.backdrop.${k} is not a backdrop's word (planets, worlds, nebula, suns, seed)`);
  if (v.worlds !== undefined) {
    if (!Array.isArray(v.worlds) || v.worlds.length > 3) e.push('space.backdrop.worlds is a list of up to 3 kinds of world (the first the large one)');
    else for (const w of v.worlds) if (w !== 'random' && !PLANET_KINDS[w]) e.push(`space.backdrop.worlds: '${w}' is not a kind of world (${Object.keys(PLANET_KINDS).join(', ')}, or random)`);
  }
  if (v.planets !== undefined && !(Number.isInteger(v.planets) && v.planets >= 0 && v.planets <= 3)) e.push('space.backdrop.planets is 0 to 3');
  if (v.suns !== undefined && !(Number.isInteger(v.suns) && v.suns >= 0 && v.suns <= 1)) e.push('space.backdrop.suns is 0 or 1');
  if (v.nebula !== undefined && typeof v.nebula !== 'boolean') e.push('space.backdrop.nebula is true or false');
  if (v.seed !== undefined && !Number.isFinite(v.seed)) e.push('space.backdrop.seed is a number');
  return e;
}

export function planBackdrop({ star, seed = 1, planets = 2, worlds = null, nebula = true, suns = 1 } = {}) {
  const S = unit(star || [0, 0, 1]), rnd = mulberry32(strHash(`backdrop|${seed}`)), pick = (a) => a[Math.floor(rnd() * a.length) % a.length];
  const span = ([lo, hi]) => lo + rnd() * (hi - lo);
  const placed = [{ dir: S, r: 1 + BACKDROP.clear }];
  const free = (d, r, gap) => placed.every((p) => angle(d, p.dir) > p.r + r + gap);
  // THE PLANETS (planet-gen.js): each slot a kind (named, or drawn by weight: the first a large world, the rest small
  // ones), its world generated; the primary from the side of the star, the small ones where the sky is free. A black
  // hole takes its disk's room
  const out = [], n = Math.max(planets, worlds ? worlds.length : 0);
  for (let i = 0; i < n; i++) {
    const primary = i === 0, asked = worlds && worlds[i] && worlds[i] !== 'random' ? worlds[i] : null;
    const kind = asked ?? pickKind(rnd, primary ? 'large' : 'small'), world = generatePlanet(kind, rnd);
    const r = world.blackHole ? span(BLACK_HOLE.r) : span(primary ? BACKDROP.primary : BACKDROP.small), reach = world.blackHole ? r * world.disk[1] * 1.15 : world.rings ? r * world.rings.outer : r;
    let dir = null;
    for (let t = 0; t < 60 && !dir; t++) {
      const d = primary ? around(S, span(world.blackHole ? [70, 140] : BACKDROP.phase), rnd() * 2 * Math.PI) : unit([rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1]);
      if (free(d, reach, BACKDROP.apart) && (primary || world.blackHole || angle(d, S) <= BACKDROP.lit)) dir = d;
    }
    if (!dir) continue;
    out.push({ dir: dir.map(r3), r: r3(r), ...world });
    placed.push({ dir, r: reach });
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
