/**
 * scene-planetary — a space-accurate orbitable body hung in a full celestial sphere.
 *
 * The sibling of fractal-city / transportation-hub / solid-turntable, but built on the
 * "rotatable starmap" basis: the three.js World (`emitThreeWorld` + OrbitControls) whose
 * WORLD-FIXED star field pans as the camera orbits. Where the starmap is an *atmosphere*
 * sky (zenith→horizon gradient, stars biased upward, night-only), planetary is the *space*
 * sky (`sky:{ space:true }` — black void, uniform full-sphere starfield, always on) with a
 * BODY in the middle.
 *
 * The unifying idea — `subject` picks the centre, and the centre fixes two things lifted
 * from the polygonizer's own vocabulary into 3D:
 *   • axis mundi — the body's principal axis drawn through its CORE (Earth: the polar axis,
 *     tilted by `obliquity`). A thin needle pole-to-pole.
 *   • mandala — the radial ring cage centred on that same core. For a single body this is
 *     the GRATICULE (equator + latitude rings + meridian great circles). The planet's own
 *     coordinate cage IS the mandala. (Future `subject:'sun'` → orbit-ring ecliptic mandala.)
 *
 * Continents are a WIREFRAME COASTLINE TRACE (Natural Earth 110m, baked in coastlines-110m.js)
 * mapped onto the surface — geography, not political borders. Not a raster map. Relative land
 * ELEVATION (coarse DEM in earth-elevation-1deg.js) is shown two ways: a BLANKET (default) — a
 * filled lon/lat surface draped over the land, displaced by elevation and coloured DETERMINISTICALLY
 * by height (a BASE tone → GREY as it rises; green land, SANDY deserts, WHITE Antarctic cap; no
 * coastline border by default); and/or GOLDEN-ANGLE radial spikes — a Fibonacci sphere (the
 * φ-derived 137.5° spiral) of short radial needles on land, length ∝ elevation.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'planetary', subject, seed?, stars?, sunU?, sunH?, sun?, sunSize?, sunGlow?,
 *     obliquity?, mandala?, continents?, blanket?, relief?, reliefScale?, atmosphere?,
 *     clouds?, moon?, moonAngle?, moonScale?, nightFill?, datetime?, live?, viewBox?, title? }
 *
 * `datetime` (ISO 8601) GEO-LOCKS the scene: the Sun + Moon are placed at their real positions for
 * that instant (sub-solar / sub-lunar points, true lunar distance, real phase), overriding the
 * manual sunU/sunH/moonAngle/obliquity knobs. See ephemeris.js. `live:true` (with no `datetime`)
 * geo-locks to the CURRENT instant at render time — resolved in assemblePlanetaryScene, so the
 * pure planPlanetaryScene stays deterministic. Geo-locked scenes ship Earth/Sun/Moon camera
 * bookmarks.
 *
 * Orbit-only: there is no CSS-3D preset path. `/scene` 422s (the room renderer returns null
 * for this kind); `/world` is the single render route, via `assemblePlanetaryScene`.
 */

import { makeLight, shadeHex } from './polygonizer/vexar.js';
import { GOLDEN_ANGLE } from './polygonizer/wave-manji-scripts/util.js';
import { COASTLINES } from './coastlines-110m.js';
import { ELEV_W, ELEV_H, ELEV_B64 } from './earth-elevation-1deg.js';
import { geoLockState } from './ephemeris.js';

// parse a geo-lock instant (ISO 8601 string or Date) → a valid Date, else null. Deterministic:
// a function of the stored string only (the manifest stores a concrete instant, never 'now').
function parseLockDate(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Decode the 1° land-elevation grid once (base64 → Uint8, 0..255 relative height; ocean = 0).
const ELEV = Uint8Array.from(atob(ELEV_B64), (c) => c.charCodeAt(0));
// elevation 0..1 at a (lon,lat) in degrees — nearest-cell lookup on the equirectangular grid.
function elevAt(lon, lat) {
  let x = Math.round((lon + 180) / 360 * ELEV_W) % ELEV_W; if (x < 0) x += ELEV_W;
  let y = Math.round((90 - lat) / 180 * ELEV_H); y = y < 0 ? 0 : y >= ELEV_H ? ELEV_H - 1 : y;
  return ELEV[y * ELEV_W + x] / 255;
}

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ── small vec helpers (local; the room/city face kit is untouched) ──
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]) || 1;
const norm = (a) => scl(a, 1 / len(a));
const centroid = (ps) => scl(ps.reduce(add, [0, 0, 0]), 1 / ps.length);
// rotate about +x by angle (tilts the whole system's axis mundi); z is the body's spin axis.
const rotX = (p, c, s) => [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];

// ── subject table: centre body → axis mundi tilt + mandala/atmosphere defaults ──
// Only `earth` is built. The shape is sized for `sun`/`solar-system` later (sun core +
// orbit-ring ecliptic mandala) — same two primitives, different core.
const SUBJECTS = {
  earth: {
    label: 'Earth',
    oceanHex: '#125ea8',   // vivid cobalt-azure ocean marble (sunlit day side pops, deepens to the terminator); continents are a wireframe coastline trace
    obliquity: 23.4,
    mandala: true,
    continents: false,     // coastline border transparent by default — the blanket defines the land
    coastHex: '#83d39a',   // (when re-enabled) land-green coastline outline
    blanket: true,         // filled hypso-coloured land surface draped over the elevation
    relief: false,         // golden-angle elevation spikes (the blanket supersedes them by default)
    atmosphere: true,
    atmoColor: [122, 170, 255],
    clouds: true,          // wispy translucent cloud veils swirled by the general circulation
    moon: true,            // a real companion body at TRUE scale + TRUE distance, sun-lit (correct phase)
  },
};
export const PLANETARY_SUBJECTS = Object.freeze(Object.keys(SUBJECTS));

// ── unit-sphere faces (z-up, poles at ±z). Pole bands self-degenerate: at a pole two of the
// four corners coincide, so faceListToMesh's quad→2-tri split drops the zero-area triangle.
// No special-casing needed; every face is a 4-corner quad as the mesh pipeline requires. ──
function unitSphereFaces(longs, lats) {
  const grid = [];
  for (let j = 0; j <= lats; j++) {
    grid[j] = [];
    for (let i = 0; i < longs; i++) {
      const th = -Math.PI / 2 + Math.PI * (j / lats), ph = TAU * (i / longs);
      grid[j][i] = [Math.cos(th) * Math.cos(ph), Math.cos(th) * Math.sin(ph), Math.sin(th)];
    }
  }
  const faces = [];
  for (let j = 0; j < lats; j++) for (let i = 0; i < longs; i++) {
    const a = grid[j][i], b = grid[j][(i + 1) % longs], c = grid[j + 1][(i + 1) % longs], d = grid[j + 1][i];
    faces.push([a, b, c, d]);
  }
  return faces;
}

// one thin flat ribbon ring → quad segments. `pointAt(t)` returns the unit-sphere centreline
// point at parameter t∈[0,1); `widen(p, e)` offsets a point by ±e in the ribbon's flat
// direction. Returns face quads (unit-scale corners + a flat `hex` fill, baked unlit).
function ribbonRing(pointAt, widen, segs, width, hex) {
  const faces = [];
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    const p0 = pointAt(t0), p1 = pointAt(t1);
    faces.push({ corners: [widen(p0, -width), widen(p1, -width), widen(p1, width), widen(p0, width)], hex, flat: true });
  }
  return faces;
}

// the graticule mandala: equator (emphasised) + latitude rings + meridian great circles,
// all floating just outside the surface (R*1.02). Centreline points are UNIT-scale here;
// the caller tilts + scales them with the body.
function mandalaFaces(segs, equatorHex, lineHex) {
  const RR = 1.02;            // just proud of the surface
  const faces = [];
  // latitude rings (equator + ±30° + ±60°): a horizontal circle at z=sin(lat).
  for (const lat of [-60, -30, 0, 30, 60]) {
    const L = lat * DEG, z = Math.sin(L) * RR, rad = Math.cos(L) * RR;
    const eq = lat === 0;
    const pointAt = (t) => { const a = t * TAU; return [Math.cos(a) * rad, Math.sin(a) * rad, z]; };
    // widen radially in the horizontal plane (ribbon lies flat around the globe).
    const widen = (p, e) => { const r = Math.hypot(p[0], p[1]) || 1; return [p[0] * (1 + e / r), p[1] * (1 + e / r), p[2]]; };
    faces.push(...ribbonRing(pointAt, widen, segs, eq ? 0.018 : 0.011, eq ? equatorHex : lineHex));
  }
  // meridian great circles through both poles, in vertical planes at a few longitudes.
  for (let m = 0; m < 6; m++) {
    const phi = (m / 6) * Math.PI;           // 6 planes → 12 visible half-meridians
    const cphi = Math.cos(phi), sphi = Math.sin(phi);
    const nrm = [-sphi, cphi, 0];            // in-plane out-of-plane normal (ribbon faces broadside)
    const pointAt = (t) => { const a = t * TAU; const c = Math.cos(a) * RR, s = Math.sin(a) * RR; return [c * cphi, c * sphi, s]; };
    const widen = (p, e) => add(p, scl(nrm, e));
    faces.push(...ribbonRing(pointAt, widen, segs, 0.011, lineHex));
  }
  return faces;
}

// a (lon, lat) in degrees → unit point on the body sphere (z-up, poles at ±z; lon = azimuth,
// lat = elevation — the SAME frame unitSphereFaces uses, so coastlines sit ON the surface).
function lonLatToUnit(lon, lat) {
  const th = lat * DEG, ph = lon * DEG, cth = Math.cos(th);
  return [cth * Math.cos(ph), cth * Math.sin(ph), Math.sin(th)];
}

// the continent trace: each Natural Earth coastline polyline → thin ribbon quads lying ON the
// surface (radius RR), the band running ALONG the coast (width perpendicular, in the tangent
// plane) so it reads broadside from orbit. Geography (coastlines), not political borders.
// `lines` is the flat-array COASTLINES; centreline points are UNIT-scale (caller tilts + scales).
function continentFaces(lines, width, hex) {
  const RR = 1.012;        // just proud of the surface, under the graticule (1.02)
  const faces = [];
  for (const flat of lines) {
    let prev = null;
    for (let k = 0; k < flat.length; k += 2) {
      const cur = scl(lonLatToUnit(flat[k], flat[k + 1]), RR);
      if (prev) {
        const seg = sub(cur, prev);
        let side = cross(norm(prev), seg);          // ⟂ to the coast, tangent to the sphere
        const sl = len(side);
        if (sl > 1e-6) {
          side = scl(side, width / sl);
          faces.push({ corners: [sub(prev, side), sub(cur, side), add(cur, side), add(prev, side)], hex, flat: true });
        }
      }
      prev = cur;
    }
  }
  return faces;
}

// elevation ramp: a BASE colour at sea level (the lowest elevation) lerped toward GREY as land
// rises — elevation reads as grey, not white. Base is green for land, sandy in the arid
// subtropical bands, white for the Antarctic ice cap (whited-out, but its high interior still
// greys with elevation, as do the deserts). Colour is the strongest
// cue at orbit distance (height is only ~5px), so the input is gamma-spread (√t). (→ #rrggbb)
const ELEV_GREY = [150, 148, 143];
const BASE_LAND = [138, 158, 140];   // lowest-elevation land = a muted gray-green interior base
const BASE_ICE = [243, 243, 240];    // polar cap base = white
const BASE_DESERT = [210, 193, 154]; // arid subtropical bands = sandy tan
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
function hypsoHex(t0, base = BASE_LAND) {
  const t = Math.sqrt(Math.max(0, Math.min(1, t0)));
  const h = (i) => Math.round(base[i] + (ELEV_GREY[i] - base[i]) * t).toString(16).padStart(2, '0');
  return `#${h(0)}${h(1)}${h(2)}`;
}
// arid-band membership 0..1 — a SOFT subtropical desert belt centred on the ~23° ridge in each
// hemisphere. Its equatorward/poleward edges are wobbled by longitude (two sine octaves) so the
// boundary is curvy, not a straight parallel, and the value ramps (smoothstep) up then back down
// so the sand BLENDS into the green/grey neighbours instead of snapping at a hard latitude.
function aridWeight(lon, lat) {
  const a = Math.abs(lat), L = lon * DEG;
  const wob = 4.5 * Math.sin(L * 1.3 + (lat < 0 ? 2.1 : 0.3)) + 2.5 * Math.sin(L * 3.1 + 1.0);
  const inner = 13 + wob, outer = 34 + wob, mid = (inner + outer) / 2;
  return Math.min(smooth(inner, mid, a), 1 - smooth(mid, outer, a));
}
// base tone at (lon,lat): white-out the polar caps — Antarctica (below −60°) and the high Arctic
// (above ~62°N: Greenland, the top of Canada, northern Russia). Elsewhere lerp the muted-green
// land base toward sand by the soft arid weight, so deserts ease in with a curvy, blended edge.
function baseFor(lon, lat) {
  if (lat < -60 || lat > 62) return BASE_ICE;
  const w = aridWeight(lon, lat);
  return w <= 0 ? BASE_LAND : lerp3(BASE_LAND, BASE_DESERT, w);
}

// relief spikes — the GOLDEN RATIO radials. Sample the sphere at N points by the GOLDEN ANGLE
// (a Fibonacci sphere — the φ-derived 137.5° spiral spreads points evenly), and at each one that
// lands on LAND draw a short radial needle from the surface outward, its length ∝ elevation. The
// tallest peak reaches `maxH` world units (≈5px in the default framing). Each needle is a tiny
// cross of two ⟂ ribbons so it reads from any orbit azimuth. Centreline UNIT-scale; caller places.
function reliefSpikeFaces(n, maxH, R0) {
  const faces = [];
  const hUnitMax = maxH / R0;          // unit-space height (place() scales by R0 back to world)
  const w = 0.0028;                    // unit-space half-width of each needle ribbon
  const zUp = [0, 0, 1];
  for (let i = 0; i < n; i++) {
    const z = 1 - 2 * (i + 0.5) / n, rxy = Math.sqrt(Math.max(0, 1 - z * z)), th = i * GOLDEN_ANGLE;
    const dir = [rxy * Math.cos(th), rxy * Math.sin(th), z];
    const lon = Math.atan2(dir[1], dir[0]) * 180 / Math.PI, lat = Math.asin(z) * 180 / Math.PI;
    const e = elevAt(lon, lat);
    if (e < 0.06) continue;            // ocean / sea-level → no spike
    const base = dir, top = scl(dir, 1 + hUnitMax * e);
    let t1 = cross(dir, zUp); if (len(t1) < 1e-4) t1 = [1, 0, 0]; t1 = scl(norm(t1), w);
    const t2 = scl(norm(cross(dir, t1)), w);
    const hex = hypsoHex(e, baseFor(lon, lat));
    for (const t of [t1, t2]) {
      faces.push({ corners: [sub(base, t), sub(top, t), add(top, t), add(base, t)], hex, flat: true });
    }
  }
  return faces;
}

// the land blanket — a filled surface draped over the continents, displaced by elevation and
// coloured DETERMINISTICALLY by height (the hypso ramp). A lon/lat grid: every cell whose centre
// is land becomes one quad, each corner pushed out by ITS OWN elevation so the sheet drapes down
// to sea level at the coasts (a quilted relief blanket). Centreline UNIT-scale; caller places.
function blanketFaces(stepDeg, maxH, R0) {
  const faces = [];
  const hUnitMax = maxH / R0;
  const lift = (lo, la) => { const e = elevAt(lo, la); return scl(lonLatToUnit(lo, la), 1 + hUnitMax * e); };
  for (let lat = -90; lat < 90 - 1e-9; lat += stepDeg) {
    for (let lon = -180; lon < 180 - 1e-9; lon += stepDeg) {
      const ec = elevAt(lon + stepDeg / 2, lat + stepDeg / 2);
      if (ec <= 0) continue;          // ocean cell → no blanket (the shaded ocean sphere shows)
      const s = stepDeg;
      const corners = [lift(lon, lat), lift(lon + s, lat), lift(lon + s, lat + s), lift(lon, lat + s)];
      faces.push({ corners, hex: hypsoHex(ec, baseFor(lon + s / 2, lat + s / 2)) });
    }
  }
  return faces;
}

// the axis mundi: a thin square needle along the spin axis (z), extending past both poles.
// 4 long side quads (unit-scale; tilted + scaled with the body).
function axisMundiFaces(hex) {
  const H = 1.34, w = 0.013;     // half-length past the poles, half-width (a slender needle)
  const ring = [[w, w], [-w, w], [-w, -w], [w, -w]];
  const faces = [];
  for (let i = 0; i < 4; i++) {
    const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % 4];
    faces.push({ corners: [[x0, y0, -H], [x1, y1, -H], [x1, y1, H], [x0, y0, H]], hex, flat: true });
  }
  return faces;
}

// ── cloud field — impressionistic, NOT physics (just the recognizable global shape) ──
// value-ish noise from summed sin/cos products; deterministic (no RNG). ~ −1..1.
function vnoise(x, y) { return Math.sin(x + Math.cos(y * 0.7)) * Math.cos(y * 1.1 + Math.sin(x * 0.6)); }
function fbm(x, y) {
  let v = 0, amp = 0.55, f = 1;
  for (let o = 0; o < 4; o++) { v += amp * vnoise(x * f, y * f); amp *= 0.5; f *= 2.03; }
  return v;
}
// fixed cyclone centres [lonDeg, latDeg, radiusDeg, spin] — comma systems in the mid-latitude
// STORM BELTS plus a few on the polar fronts (the Blue Marble's signature swirls); spin sign sets
// the rotation sense. They wind the noise into spiral arms and seed a dense comma head.
const CYCLONES = [
  [-35, 50, 24, 1], [72, 46, 22, 1], [165, 54, 26, 1], [-118, 44, 22, 1],
  [28, -50, 26, -1], [150, -54, 28, -1], [-58, -48, 24, -1], [-148, -46, 22, -1],
];
// tangential domain-warp: wind the sample coords around each nearby cyclone (gaussian falloff) so
// streaks spiral, and report the strongest core proximity (→ a dense comma head at the centre).
function vortex(lon, lat) {
  let dlon = 0, dlat = 0, boost = 0;
  for (const [clon, clat, rad, spin] of CYCLONES) {
    let dx = lon - clon; if (dx > 180) dx -= 360; else if (dx < -180) dx += 360;
    dx *= Math.cos(clat * DEG);                       // equirect → roughly metric near the centre
    const dy = lat - clat, fall = Math.exp(-(dx * dx + dy * dy) / (2 * rad * rad));
    const ang = spin * fall * 2.4, ca = Math.cos(ang), sa = Math.sin(ang);
    dlon += dx * ca - dy * sa - dx;                   // rotate the offset, keep the delta → swirl
    dlat += dx * sa + dy * ca - dy;
    boost = Math.max(boost, fall);
  }
  return [lon + dlon, lat + dlat, boost];
}
// cloud cover 0..1 at (lon,lat): banded by the general circulation — a moist ITCZ band over the
// equator and the mid-latitude STORM TRACKS (~50°), the dry SUBTROPICS (~25°, the desert belts)
// left clear between them — wound into spiral commas by the cyclones, broken up by a domain-warped
// wispy noise, then floored hard so it reads as DISCRETE bright masses over clear ocean, not a veil.
function cloudCover(lon, lat) {
  const a = Math.abs(lat);
  const itcz = Math.exp(-(a * a) / (2 * 8 * 8));
  const storm = Math.exp(-((a - 50) * (a - 50)) / (2 * 15 * 15));
  const band = Math.max(itcz, 0.85 * storm);
  const [sl, sla, boost] = vortex(lon, lat);
  const L = (sl + lat * 0.6) * DEG, P = sla * DEG;
  const wx = L + 1.0 * fbm(L * 0.9, P * 0.9), wy = P + 1.0 * fbm(L * 0.9 + 4.2, P * 0.9 + 1.7);
  const n = 0.5 + 0.5 * fbm(wx * 3.1, wy * 3.5);
  const m = smooth(0.42, 0.60, n);                   // edge ramp → feathered rims but solid cores, clear below
  const field = (band + 0.5 * boost) * m;            // discrete masses where the belt is moist AND noise peaks
  return Math.max(0, Math.min(1, field * 1.2));
}
// a translucent cloud shell at unit radius `rUnit`: a lon/lat grid of white quads whose cloud
// cover is sampled AT EACH CORNER (shared with the neighbours → the veil feathers smoothly across
// cells, no flat blocks). Returns unit-space faces carrying the 4 corner covers + the centre dir;
// the caller tilts/scales and bakes per-corner alpha + day/night-dimmed white. Cells whose whole
// quad is below a floor are dropped → genuine clear ocean between the masses.
function cloudFaces(stepDeg, rUnit) {
  const faces = [];
  const s = stepDeg;
  for (let lat = -84; lat < 84 - 1e-9; lat += s) {
    for (let lon = -180; lon < 180 - 1e-9; lon += s) {
      const cc = [
        cloudCover(lon, lat), cloudCover(lon + s, lat),
        cloudCover(lon + s, lat + s), cloudCover(lon, lat + s),
      ];
      if (Math.max(...cc) < 0.03) continue;
      const corners = [
        scl(lonLatToUnit(lon, lat), rUnit), scl(lonLatToUnit(lon + s, lat), rUnit),
        scl(lonLatToUnit(lon + s, lat + s), rUnit), scl(lonLatToUnit(lon, lat + s), rUnit),
      ];
      faces.push({ corners, cc, dir: norm(lonLatToUnit(lon + s / 2, lat + s / 2)) });
    }
  }
  return faces;
}

// ── the Moon — TRUE scale + TRUE mean distance, as ratios of Earth's radius (so it tracks R0). ──
// radius 1737.4 km / 6371 km ⊕ ; mean orbit 384 400 km / 6371 km ⊕ . A bare sun-lit regolith
// sphere: the SAME light bakes its phase, so there is no phase knob — only WHERE in its orbit it
// sits. At true scale + distance it reads exactly as it does from orbit: a small, far disc.
const MOON_RADIUS_RATIO = 1737.4 / 6371;   // ≈ 0.2727 ⊕ radii
const MOON_DIST_RATIO = 384400 / 6371;     // ≈ 60.34 ⊕ radii
const MOON_HEX = '#b7b2a8';                // sun-lit lunar grey; shades to a near-black night limb

/**
 * Resolve a recipe into a placed face list + render params. Pure — no DB, no HTML. The body,
 * mandala, atmosphere and axis are all built unit-scale, tilted by `obliquity` about +x as one
 * rigid cage, then scaled to world units. Reused by the world route and by tests.
 */
export function planPlanetaryScene(recipe = {}) {
  const subjectKey = SUBJECTS[recipe.subject] ? recipe.subject : 'earth';
  const S = SUBJECTS[subjectKey];
  const seed = (recipe.seed >>> 0) || 1;
  const stars = Number.isFinite(+recipe.stars) ? Math.max(0, +recipe.stars) : 1;
  const obliquityRecipe = Number.isFinite(+recipe.obliquity) ? +recipe.obliquity : S.obliquity;
  const sunU = Number.isFinite(+recipe.sunU) ? +recipe.sunU : 0.25;
  const sunH = Number.isFinite(+recipe.sunH) ? +recipe.sunH : 0.5;
  const showMandala = recipe.mandala ?? S.mandala;
  const showContinents = (recipe.continents ?? S.continents) && Array.isArray(COASTLINES) && COASTLINES.length > 0;
  const hasElev = ELEV.length === ELEV_W * ELEV_H;
  const showBlanket = (recipe.blanket ?? S.blanket) && hasElev;
  const showRelief = (recipe.relief ?? S.relief) && hasElev;
  const reliefScale = Number.isFinite(+recipe.reliefScale) ? Math.max(0, +recipe.reliefScale) : 1;
  const showAtmosphere = recipe.atmosphere ?? S.atmosphere;
  const showClouds = recipe.clouds ?? S.clouds;
  const showMoon = recipe.moon ?? S.moon;
  const moonAngle = Number.isFinite(+recipe.moonAngle) ? +recipe.moonAngle : 90;   // 0 new → 90 quarter → 180 full
  const moonScale = Number.isFinite(+recipe.moonScale) ? Math.max(0, +recipe.moonScale) : 1;
  const showSun = recipe.sun ?? true;        // pin the luminary disc itself in the star sphere
  const sunSize = Number.isFinite(+recipe.sunSize) ? Math.max(0, +recipe.sunSize) : 1;
  const sunGlow = Number.isFinite(+recipe.sunGlow) ? Math.max(0, +recipe.sunGlow) : 1.3;
  // night-side floor: how much the unlit (night) hemisphere is lifted out of pure black so the
  // dark side stays VISIBLE against the void with a readable terminator (0 = photoreal near-black,
  // ~0.16 = a deep-navy night globe). A deliberate non-photoreal choice; the Moon keeps its own low
  // floor so its crescent phase still reads.
  const nightFill = Number.isFinite(+recipe.nightFill) ? Math.max(0, Math.min(0.6, +recipe.nightFill)) : 0.16;
  const R0 = 6;              // world-unit body radius

  // GEO-LOCK — when a real datetime is given (earth only), the Sun + Moon are placed at their TRUE
  // geographic sub-points for that instant (sub-solar / sub-lunar), and the Moon at its true
  // geocentric distance. The lit hemisphere, the Moon's direction and its phase become deterministic
  // astronomy; the manual `obliquity` / `sunU` / `sunH` / `moonAngle` knobs are then ignored.
  const lockDate = subjectKey === 'earth' ? parseLockDate(recipe.datetime) : null;
  const geo = lockDate ? geoLockState(lockDate) : null;

  // obliquity is just the scene's rigid global tilt: geography, Sun and Moon all share it, so it
  // never changes the relative geometry. Geo-locked → the true obliquity of date; else the knob.
  const obliquity = geo ? geo.obliquity : obliquityRecipe;
  const tc = Math.cos(obliquity * DEG), ts = Math.sin(obliquity * DEG);
  const place = (p) => scl(rotX(p, tc, ts), R0);   // tilt then scale to world units

  // sun direction (toward the sun) in world space — the lit hemisphere faces it. Geo-locked → the
  // real sub-solar point carried through the shared tilt; else the manual { sunU az, sunH el } knobs.
  let sunDir;
  if (geo) {
    sunDir = norm(rotX(lonLatToUnit(geo.subsolar.lon, geo.subsolar.lat), tc, ts));
  } else {
    const az = sunU * TAU, el = (sunH - 0.5) * Math.PI * 0.6;
    sunDir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
  }
  // Earth body light: the night hemisphere is lifted by `nightFill` so the dark side reads against
  // the void. The Moon gets its OWN low-floor light so its terminator (the crescent) stays crisp.
  const light = makeLight({ direction: scl(sunDir, -1), ambient: nightFill, diffuse: 0.95 });
  const moonLight = makeLight({ direction: scl(sunDir, -1), ambient: 0.05, diffuse: 0.95 });

  // camera — pulled well back (the body reads as a marble in a star field, not a wall) and swung
  // ~108° off the sun azimuth so the first frame shows the day side, the night side and the
  // terminator between them. Derived from the actual sun direction → works geo-locked or manual.
  const sunAz = Math.atan2(sunDir[1], sunDir[0]);
  const camAz = sunAz - 108 * DEG, camEl = 15 * DEG, d = R0 * 4.6;
  const cameraPosition = [d * Math.cos(camEl) * Math.cos(camAz), d * Math.cos(camEl) * Math.sin(camAz), d * Math.sin(camEl)];

  const faces = [];

  // body — shade each face against the fixed sun (baked day/night terminator, low ambient
  // → a near-black night hemisphere). Normal from the tilted unit centroid (sphere-centred).
  for (const unit of unitSphereFaces(36, 18)) {
    const corners = unit.map(place);
    const n = norm(rotX(centroid(unit), tc, ts));
    faces.push({ corners, fill: shadeHex(S.oceanHex, n, light) });
  }

  // continent trace — real coastlines (Natural Earth 110m) as a wireframe on the surface.
  if (showContinents) {
    for (const f of continentFaces(COASTLINES, 0.006, S.coastHex || '#83d39a')) {
      faces.push({ corners: f.corners.map(place), fill: f.hex });
    }
  }

  // relief spikes — golden-angle radials whose length encodes land elevation (peak ≈ 5px proud).
  if (showRelief) {
    for (const f of reliefSpikeFaces(9000, R0 * 0.015 * reliefScale, R0)) {
      faces.push({ corners: f.corners.map(place), fill: f.hex });
    }
  }

  // land blanket — filled hypso-coloured drape over the continents, displaced by elevation.
  if (showBlanket) {
    for (const f of blanketFaces(1.5, R0 * 0.015 * reliefScale, R0)) {
      faces.push({ corners: f.corners.map(place), fill: f.hex });
    }
  }

  // mandala graticule (flat unlit ribbons) — the radial cage from the core.
  if (showMandala) {
    for (const f of mandalaFaces(48, '#7fc2ff', '#3f74ad')) {
      faces.push({ corners: f.corners.map(place), fill: f.hex });
    }
    // axis mundi needle through the poles.
    for (const f of axisMundiFaces('#a8c6e8')) {
      faces.push({ corners: f.corners.map(place), fill: f.hex });
    }
  }

  // clouds — wispy translucent veils swirled by the general circulation, hovering JUST above the
  // tallest relief (the himalaya layer). White, but pre-dimmed toward the night side so the
  // terminator stays consistent (the translucent pass is unlit). Two overlapping passes at
  // slightly different radii build up the wispiness where they cross.
  if (showClouds) {
    const hUnitMax = 0.015 * reliefScale;               // max relief displacement in unit radius
    // just proud of the highest peak — but never below the atmosphere haze (1.03), so the white
    // stays bright instead of being tinted blue by the limb shell at low reliefScale.
    const lift = Math.max(1 + hUnitMax * 1.04, 1.035) + 0.006;
    for (const [step, rOff, aMul] of [[2, 0, 1.38], [3.2, 0.013, 0.52]]) {
      for (const f of cloudFaces(step, lift + rOff)) {
        const n = norm(rotX(f.dir, tc, ts));
        const day = Math.max(0.08, 0.5 + 0.5 * dot(n, sunDir));       // 0.08 night → 1 day
        const tone = Math.round(255 * (0.55 + 0.45 * day));          // bright white, dimmed toward night
        const cornerAlpha = f.cc.map((cv) => Math.min(0.86, Math.pow(cv, 0.82) * aMul));  // bright cores, feathered rims
        faces.push({ corners: f.corners.map(place), fill: `rgb(${tone},${tone},${tone})`, water: true, cornerAlpha });
      }
    }
  }

  // atmosphere — a translucent shell just outside the surface, routed through the World's
  // water pass (DoubleSide, per-vertex alpha). The annulus beyond the body's silhouette
  // reads as a soft blue limb halo; over the disk it's a faint veil. (True Fresnel rim → frontier.)
  if (showAtmosphere) {
    const [ar, ag, ab] = S.atmoColor;
    const atmo = `rgba(${ar},${ag},${ab},0.34)`;
    for (const unit of unitSphereFaces(28, 14)) {
      faces.push({ corners: unit.map((p) => scl(rotX(p, tc, ts), R0 * 1.03)), fill: atmo, water: true });
    }
  }

  // the Moon — a real companion body at TRUE scale (0.27 R⊕), shaded by the SAME sun so its phase is
  // automatically correct. GEO-LOCKED → placed at its true sub-lunar point and true geocentric
  // distance for the instant. MANUAL → placed on an orbit plane spanned by the sun direction
  // (e1 → the sub-solar / new-moon point) and the camera's look axis (e2, behind Earth from the
  // opening frame), at `moonAngle` from the sub-solar point (0 new → 90 first/last-quarter → 180
  // full); the default quarter sits a few degrees off Earth's limb, in frame. Either way it reads as
  // a small, far disc — exactly as the Moon looks at true scale + distance.
  let moonCenter = null;
  if (showMoon) {
    const moonR = R0 * MOON_RADIUS_RATIO * moonScale;
    if (geo) {
      // geo-locked → the true sub-lunar point + true geocentric distance (Earth radii) for the
      // instant, carried through the shared tilt. Its phase falls out of the shared sun shading.
      moonCenter = scl(norm(rotX(lonLatToUnit(geo.sublunar.lon, geo.sublunar.lat), tc, ts)), R0 * geo.moonDistEarthRadii);
    } else {
      const moonDist = R0 * MOON_DIST_RATIO;
      const look = norm(scl(cameraPosition, -1));                 // toward Earth (origin)
      const e1 = sunDir;                                          // toward the sun → new-moon direction
      let e2 = sub(look, scl(e1, dot(look, e1)));                 // look axis ⟂ to the sun → behind Earth
      e2 = len(e2) > 1e-6 ? norm(e2) : norm(cross(e1, [0, 0, 1]));
      const th = moonAngle * DEG;
      moonCenter = scl(add(scl(e1, Math.cos(th)), scl(e2, Math.sin(th))), moonDist);
    }
    // independent of Earth's obliquity (a bare sphere needs no surface orientation); same light → phase.
    for (const unit of unitSphereFaces(24, 12)) {
      const corners = unit.map((p) => add(moonCenter, scl(p, moonR)));
      faces.push({ corners, fill: shadeHex(MOON_HEX, norm(centroid(unit)), moonLight) });
    }
  }

  return {
    subject: subjectKey,
    label: S.label,
    faces,
    cameraPosition,
    sunDir,                       // unit, toward the sun (for the Sun camera bookmark)
    moonCenter,                   // world-space Moon centre, null if no Moon (for the Moon bookmark)
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    // the luminary is pinned at the real sun DIRECTION (the lit hemisphere faces it), so it rides
    // the star sphere fixed in world space as the camera orbits — same principle as the horizon
    // sky's { u, h } sun, but a true 3D direction since space has no horizon to project against.
    // center pinned to Earth's core (origin): the far Moon would otherwise drag the bounds centroid
    // off-body, swinging the world-fixed star sphere — and the sun's apparent direction — off-axis.
    sky: { space: true, stars, seed, center: [0, 0, 0], sun: showSun ? { dir: sunDir, size: sunSize, glow: sunGlow } : null },
    bodyRadius: R0,
    obliquity,
    // geo-lock readout (null in manual mode) — the real astronomy the scene resolved, for callers
    // to echo back (sub-points, the Moon's true distance, its illuminated fraction + named phase).
    geoLock: geo ? {
      datetime: lockDate.toISOString(),
      subsolar: geo.subsolar,
      sublunar: geo.sublunar,
      moonDistEarthRadii: geo.moonDistEarthRadii,
      moonDistKm: geo.moonDistKm,
      illum: geo.illum,
    } : null,
  };
}

// Build the Earth / Sun / Moon camera bookmarks for a geo-locked scene. Earth is the terminator
// framing (plan.cameraPosition, looking at the core); Sun and Moon each recenter on their luminary
// with Earth slid off to one side via a perpendicular offset, so the disc reads against the stars.
// (At true scale the Sun is at infinity and the Moon is ~60 Earth radii out — neither fits the same
// frame as a recognisable Earth, so they are separate bookmarks rather than one wide shot.)
function planetaryCameras(plan) {
  const R0 = plan.bodyRadius;
  const earth = { name: 'Earth', worldFraming: { cameraPosition: plan.cameraPosition, lookAt: [0, 0, 0], horizontalFov: 38 } };
  if (!plan.geoLock) return [earth];                     // manual mode → just the single Earth view
  const cams = [earth];
  const S = plan.sunDir, up = [0, 0, 1];
  const perp = (v) => { const c = cross(v, up); return len(c) > 1e-6 ? norm(c) : [1, 0, 0]; };
  // Sun: stand back along −S, slid sideways so Earth clears the sun's line, look toward the sun.
  const ps = perp(S);
  cams.push({ name: 'Sun', worldFraming: { cameraPosition: add(scl(S, -R0 * 2.7), scl(ps, R0 * 5.5)), lookAt: scl(S, R0 * 700), horizontalFov: 26 } });
  // Moon: stand back along −moonDir, slid sideways, look at the Moon centre.
  if (plan.moonCenter) {
    const Md = norm(plan.moonCenter), pm = perp(Md);
    cams.push({ name: 'Moon', worldFraming: { cameraPosition: add(scl(Md, -R0 * 2.3), scl(pm, R0 * 3.4)), lookAt: plan.moonCenter, horizontalFov: 22 } });
  }
  return cams;
}

/**
 * Assemble the engine-agnostic `emitThreeWorld` payload for a planetary recipe (the /world
 * render path). Mirrors `assembleFractalCityScene` / `assembleTransportationHubScene`.
 *
 * LIVE mode: `manifest.live` (with no explicit `datetime`) GEO-LOCKS to the CURRENT instant at
 * render time — every load advances the Sun, terminator and Moon to match the real sky now. This
 * is the only impurity in the planetary path and lives here (not in the pure `planPlanetaryScene`),
 * so tests and snapshots stay deterministic. Pass a concrete `datetime` instead to freeze a moment.
 */
export function assemblePlanetaryScene(manifest = {}) {
  const resolved = manifest.live && !manifest.datetime
    ? { ...manifest, datetime: new Date().toISOString() }
    : manifest;
  const plan = planPlanetaryScene(resolved);
  const title = manifest.title || `mojulo · ${plan.label}`;
  return {
    faces: plan.faces,
    cameras: planetaryCameras(plan),
    viewBox: plan.viewBox,
    title,
    bg: '#01030a',          // deep-space void
    glow: false,            // no emissive fixtures; stars carry the light
    sky: plan.sky,
  };
}
