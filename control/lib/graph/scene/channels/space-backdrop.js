import { safeJson } from '../emit-util.js';

// THE SPACE BACKDROP on the page (skyscape/backdrop.js plans it): the nebula's band, the planets lit by the map's own
// star, a far sun and the near star's corona, drawn ONCE at load into a cube at infinity and set as the scene's
// background, so it turns with the view and never moves with the craft, and costs nothing a frame after.
//
//   the nebula   a sphere's inside: a band on its great circle (a galaxy's plane), two hues of cloud by a domain-
//                warped noise, dust lanes dark through it, a few warm knots; dim, under the stars
//   the planets  each a sphere at its direction, its surface by its kind (a gas giant's bands and storms, a rocky
//                world's plains and highlands, ice, an ocean's land and cloud, lava's cracks glowing on its night),
//                lit by the star with a soft terminator, an atmosphere's rim brightest on the lit limb; a gas giant's
//                rings banded and translucent, the planet's shadow across them
//   the suns     the far one a hot disc in its glow; the near one's corona, a wide faint glow round where it stands
//
// The stars (sky-dome.js) are drawn over the backdrop; a star whose direction falls on a planet's disc is left out.
// Pure source: the noise is a hash, no dice; the same plan, the same sky.
//
//   a close world (near, in orbit: skyscape/backdrop.js PROXIMITY) is not baked: it is drawn live at the screen's
//                resolution, a sphere held at infinity round the eye and behind everything, its finer relief and its
//                cities in it, its air a shell over it (the horizon's bright band, lit where the star is up)
//
//   spaceBackdropScript(B, { size? }) → the page's block (in a scope with THREE, scene, renderer, SKY)

/** The cube's face (px): a primary planet of 10° radius is ~230 px across. */
export const BACKDROP_FACE = 1024;

const lin = (h) => [1, 3, 5].map((i) => { const c = parseInt(h.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }).map((v) => Math.round(v * 1e4) / 1e4);

const NOISE = `
float bdHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float bdNoise(vec3 x) {
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(bdHash(i), bdHash(i + vec3(1, 0, 0)), f.x), mix(bdHash(i + vec3(0, 1, 0)), bdHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(bdHash(i + vec3(0, 0, 1)), bdHash(i + vec3(1, 0, 1)), f.x), mix(bdHash(i + vec3(0, 1, 1)), bdHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float bdFbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 6; i++) { s += a * bdNoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }`;

const NEBULA_FRAG = `${NOISE}
uniform vec3 uPlane, uA, uB, uWarm; uniform float uWidth, uDust, uGlow, uSeed; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir), o = vec3(uSeed * 0.0013, uSeed * 0.0007, uSeed * 0.0011);
  float h = dot(d, uPlane), band = exp(-(h * h) / (uWidth * uWidth)), halo = exp(-(h * h) / (uWidth * uWidth * 6.0));
  // (clouds, domain-warped, and their filaments: the ridges of a finer noise drawn through the warp, as gas is drawn
  // out in threads; the galaxy's own unresolved glow along its plane under both)
  float n1 = bdFbm(d * 2.2 + o), n2 = bdFbm(d * 4.0 + vec3(n1 * 2.0) + o * 2.0);
  float fil = pow(1.0 - abs(2.0 * bdFbm(d * 7.0 + vec3(n2 * 1.6) + o * 3.0) - 1.0), 6.0);
  float cloud = (smoothstep(0.45, 0.82, n2) * 0.55 + fil * 0.7) * band + 0.1 * smoothstep(0.5, 0.8, n1) * halo;
  vec3 col = mix(uA, uB, smoothstep(0.3, 0.72, n1)) * cloud + vec3(0.55, 0.6, 0.75) * band * 0.05;
  float dust = smoothstep(0.46, 0.68, bdFbm(d * 8.5 + o * 3.0)) * uDust * band;
  float knots = pow(smoothstep(0.66, 0.86, bdFbm(d * 13.0 + o * 4.0)), 2.0) * band * smoothstep(0.45, 0.75, n2);
  col = col * (1.0 - dust) + uWarm * knots * 1.1;
  gl_FragColor = vec4(col * uGlow + vec3(0.0015, 0.0018, 0.003), 1.0);
}`;

const PLANET_FRAG = `${NOISE}
// ANY WORLD from its knobs (skyscape/planet-gen.js): a giant's bands and storm, or a rocky world's sea, land, plants,
// ice, craters, lava and cities; then its clouds, its haze, the star's light with a soft terminator, the night side's
// own glow and lights, the atmosphere's rim, the limb antialiased
uniform vec3 uSun, uLand0, uLand1, uSea, uVeg, uIce, uCloud, uAtmo, uLava, uB0, uB1, uB2, uStorm;
uniform float uGas, uOcean, uVegK, uIceK, uCloudK, uCraters, uLavaK, uLights, uDunes, uHaze, uAtmoK, uGlow, uFreq, uTurb, uStormK, uSeed, uDetail;
uniform mat3 uSpin;
varying vec3 vN, vW;
void main() {
  // (its surface in its own frame: its axis tilted, uSpin; its light and its air in the sky's)
  // (close, its features sized for what an orbit sees of it, a slice of the sphere: its noise zoomed, Z)
  vec3 ns = normalize(vN), n0 = normalize(uSpin * ns), o = vec3(uSeed * 0.0017, uSeed * 0.0009, uSeed * 0.0013), c;
  float Z = 1.0 + 3.0 * uDetail; vec3 n = n0 * Z;
  float lat = abs(n0.z), water = 0.0, emit = 0.0, land = 1.0;
  if (uGas > 0.5) {
    // (bands round its axis, warped by its weather; a storm, an eye in the bands)
    float t = n.z * uFreq + (bdFbm(n * 3.0 + o) - 0.5) * uTurb;
    // (a giant's albedo: half the light back, as Jupiter's)
    c = mix(mix(uB0, uB1, 0.5 + 0.5 * sin(t * 2.2)), uB2, smoothstep(0.55, 0.95, 0.5 + 0.5 * sin(t * 0.83 + 1.3)));
    c *= (0.9 + 0.2 * bdNoise(n * 18.0 + o)) * 0.78;
    vec3 sd = normalize(vec3(cos(uSeed), sin(uSeed), -0.35));
    float sdist = length(n0 - sd) * Z, sw = smoothstep(0.16, 0.0, sdist) * uStormK;
    c = mix(c, uStorm, sw * (0.6 + 0.4 * sin(sdist * 60.0 + bdNoise(n * 9.0) * 3.0)));
    land = 0.0;
  } else {
    // (close, uDetail: the finer relief a world seen from orbit shows, coastlines and ridges at its scale)
    float e = bdFbm(n * 3.0 + o) + (bdFbm(n * 12.0 + o) - 0.5) * 0.15 + (bdFbm(n * 48.0 + o) - 0.5) * 0.06 * uDetail;
    water = uOcean > 0.0 ? 1.0 - smoothstep(uOcean * 0.62 + 0.19 - 0.004, uOcean * 0.62 + 0.19 + 0.004, e) : 0.0;
    float hi = smoothstep(0.45, 0.75, e);
    c = mix(uLand0, uLand1, hi) * (1.0 + (bdNoise(n * 220.0 + o) - 0.5) * 0.22 * uDetail);
    // (a city world's day side: its fabric, blocks and their streets, over the land)
    c *= 1.0 + (step(0.5, bdNoise(n * (90.0 + 260.0 * uDetail) + o)) - 0.5) * 0.25 * uLights;
    // (dunes: long streaks across its plains)
    c *= 1.0 + uDunes * 0.18 * sin(dot(n, vec3(31.0, 17.0, 5.0)) + bdNoise(n * 6.0 + o) * 6.0);
    // (plants where it is neither high nor polar)
    float veg = uVegK * smoothstep(0.35, 0.62, bdFbm(n * 6.0 + o + 3.0)) * (1.0 - smoothstep(0.55, 0.85, lat)) * (1.0 - hi * 0.6);
    c = mix(c, uVeg, veg);
    // (craters: rims and dark floors, on a world with little air)
    float cr = bdNoise(n * 22.0 + o), rim = smoothstep(0.72, 0.76, cr) - smoothstep(0.78, 0.84, cr);
    c *= 1.0 + uCraters * (rim * 0.35 - smoothstep(0.8, 0.9, cr) * 0.3);
    // (its sea, deeper where the land falls away)
    c = mix(c, mix(uSea * 0.55, uSea, smoothstep(0.1, 0.5, e)), water);
    land = 1.0 - water;
    // (lava: a crust's cracks alight)
    emit = uLavaK * smoothstep(0.04, 0.0, abs(bdFbm(n * 5.0 + o + 9.0) - 0.5)) * land;
    c = mix(c, uLand0 * 0.4, uLavaK * 0.6 * land);
  }
  // (ice: its caps, ragged at the edge; frozen seas too)
  float ice = uIceK > 0.0 ? smoothstep(1.0 - uIceK - 0.04, 1.0 - uIceK + 0.04, lat + (bdFbm(n * 8.0 + o) - 0.5) * 0.12 / Z) : 0.0;
  c = mix(c, uIce, ice);
  // (clouds, swirled, over the lot)
  // (cloud: its cover a share of the ground hidden: the noise's middle is a half, so a cover of c clears above 0.68 − 0.32 c)
  float cl = uCloudK > 0.0 ? smoothstep(0.68 - 0.32 * uCloudK, 0.68 - 0.32 * uCloudK + 0.16, bdFbm(n * 4.5 + o + 7.0 + vec3(bdFbm(n * 2.0 + o) * 0.8)) + (bdFbm(n * 36.0 + o) - 0.5) * 0.12 * uDetail) : 0.0;
  c = mix(c, uCloud, cl * 0.9);
  c = mix(c, uAtmo, uHaze);
  float lit = dot(ns, uSun), k = smoothstep(-0.08, 0.3, lit) * max(lit + 0.08, 0.0), night = 1.0 - smoothstep(-0.15, 0.12, lit);
  vec3 col = c * k * 1.05 + c * 0.004;
  col += uLava * emit * (0.35 + 0.65 * night) * (1.0 - cl * 0.7);
  col += uLava * uGlow * night * 0.12;
  // (cities: lights on its night side, on its land, where people would gather)
  float city = uLights * land * (1.0 - ice) * step(0.6, bdNoise(n * (70.0 + 130.0 * uDetail) + o)) * smoothstep(0.45, 0.65, bdFbm(n * 7.0 + o + 2.0));
  col += vec3(1.0, 0.78, 0.45) * city * night * 0.6 * (1.0 - cl * 0.8);
  vec3 V = normalize(cameraPosition - vW);
  // (its air at its rim, a far world's; a close one's air is its shell, AIR_FRAG, the rim term would wash its ground)
  float fres = pow(1.0 - max(dot(ns, V), 0.0), 3.0);
  col += uAtmo * fres * uAtmoK * (0.08 + smoothstep(-0.35, 0.45, lit)) * (1.0 - 0.9 * uDetail);
  // (a close world is drawn live, into the screen: its colour encoded as the baked sky's is when three draws it)
  if (uDetail > 0.5) col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, smoothstep(0.0, 0.09, dot(ns, V)));
}`;

// A CLOSE WORLD'S AIR (live): a shell just over it, each ray's path through the air between the shell and the ground
// (longest at the limb, the bright band along the horizon), lit where the star is up at that point of it
const AIR_FRAG = `uniform vec3 uC, uAtmo, uSun; uniform float uR, uRs, uK; varying vec3 vW;
void main() {
  vec3 dir = normalize(vW - cameraPosition), C = uC - cameraPosition;
  float t = dot(C, dir), h2 = dot(C, C) - t * t;
  float outer = sqrt(max(uRs * uRs - h2, 0.0)), inner = h2 < uR * uR ? sqrt(uR * uR - h2) : 0.0;
  float path = (h2 < uR * uR ? outer - inner : 2.0 * outer) / (2.0 * sqrt(uRs * uRs - uR * uR));
  vec3 m = cameraPosition + dir * (t - (h2 < uR * uR ? (outer + inner) * 0.5 : 0.0));
  float lit = smoothstep(-0.25, 0.35, dot(normalize(m - uC), uSun));
  // (over the ground its haze is faint, the band along the horizon bright; encoded, as the ground under it is)
  vec3 col = uAtmo * clamp(path, 0.0, 1.6) * lit * uK * (h2 < uR * uR ? 0.3 : 1.0);
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), 1.0);
}`;

// THE BLACK HOLE, a second pass over the sky already drawn (uSky): each direction near it bent as a point lens bends
// light (a source at β seen at θ, β = θ − θE²/θ: an Einstein ring, the sky behind drawn round it), the shadow black
// inside its edge with the photon ring bright on it; its accretion disk tilted near edge-on, hot white at its inner
// edge to orange at its outer, brighter on the side turning toward the eye; the disk's far side seen bent up over the
// shadow and down under it
const HOLE_FRAG = `${NOISE}
uniform samplerCube uSky; uniform vec3 uC, uE1, uHot, uCool; uniform float uR, uIn, uOut, uEin, uTilt, uSeed; varying vec3 vW;
vec3 sky(vec3 d) { return textureCube(uSky, d).rgb; }
vec3 diskAt(float r, float side) {
  if (r < uIn || r > uOut) return vec3(0.0);
  float T = pow(uIn / r, 0.75), edge = smoothstep(uIn, uIn + 0.25, r) * (1.0 - smoothstep(uOut - 1.2, uOut, r));
  // (Doppler: the side turning toward the eye brighter and whiter, the other dimmer and redder)
  vec3 col = mix(uCool, uHot, clamp(T + 0.25 * side, 0.0, 1.0)) * T * edge * (1.0 + 0.85 * side);
  return col * 1.4 * (0.6 + 0.8 * bdNoise(vec3(r * 6.0, side * 4.0, uSeed * 0.001))) * (0.8 + 0.4 * bdNoise(vec3(r * 24.0, 0.0, uSeed * 0.002)));
}
void main() {
  vec3 d = normalize(vW), C = normalize(uC), E2 = normalize(cross(C, uE1));
  float th = acos(clamp(dot(d, C), -1.0, 1.0)), x = th / uR;
  vec3 e = normalize(d - C * dot(d, C) + 1e-6 * uE1);
  float px = dot(e, uE1) * x, py = dot(e, E2) * x;
  // the lens: the sky behind, bent; past the plane's edge, the sky as it is
  float fade = 1.0 - smoothstep(5.5, 7.5, x), beta = th - (uEin * uEin * uR * uR / max(th, 1e-4)) * fade;
  vec3 dir = C * cos(abs(beta)) + e * sign(beta) * sin(abs(beta));
  vec3 col = x < 1.0 ? vec3(0.0) : sky(dir);
  // the photon ring on the shadow's edge
  col += uHot * exp(-pow((x - 1.03) / 0.03, 2.0)) * 1.4;
  // the disk, near edge-on: X along it, Y across it (its far side Y > 0, behind the shadow)
  float ci = sin(uTilt), X = px, Y = py / max(ci, 0.05), r = sqrt(X * X + Y * Y), side = r > 0.0 ? X / r : 0.0;
  vec3 dk = diskAt(r, side);
  col += Y < 0.0 ? dk : (x < 1.0 ? vec3(0.0) : dk);
  // the far side bent over the top and under the bottom of the shadow: the disk's light drawn round it as a halo, its
  // inner edge on the photon ring, widest and brightest across the disk (above and below), thinning toward its plane
  float across = abs(py) / max(x, 1e-3), reach = 1.02 + (uOut - uIn) * 0.32 * (0.35 + 0.65 * across);
  float arc = smoothstep(1.0, 1.06, x) * (1.0 - smoothstep(reach * 0.8, reach, x)) * (0.3 + 0.7 * across);
  col += diskAt(uIn + (x - 1.02) / max(reach - 1.02, 0.05) * (uOut - uIn) * 0.7, px / max(x, 1e-3)) * arc;
  // (no seam: its plane's square edge fades into the sky the plane covers)
  gl_FragColor = vec4(col, 1.0 - smoothstep(6.5, 7.6, x));
}`;

// a planet's halo: its atmosphere's glow past the limb, a thin ring brightest on its lit side
const HALO_FRAG = `uniform vec3 uAtmo, uSunUv; uniform float uAtmoK, uIn; varying vec2 vUv;
void main() {
  vec2 q = (vUv - 0.5) * 2.0; float r = length(q), t = (r - uIn) / (1.0 - uIn);
  float g = r < uIn ? 0.0 : exp(-t * t * 9.0) * (1.0 - smoothstep(0.85, 1.0, r));
  float lit = 0.25 + 0.75 * smoothstep(-0.4, 0.6, dot(normalize(q + 1e-5), uSunUv.xy));
  gl_FragColor = vec4(uAtmo * g * uAtmoK * lit * 0.9, 1.0);
}`;

const RING_FRAG = `${NOISE}
uniform vec3 uSun, uBase, uCenter; uniform float uIn, uOut, uR, uSeed; varying vec3 vW;
void main() {
  vec3 p = vW - uCenter; float r = length(p), t = (r - uIn) / (uOut - uIn);
  float bands = 0.55 + 0.45 * sin(t * 70.0 + bdNoise(vec3(t * 20.0, uSeed * 0.001, 0.0)) * 4.0);
  float a = bands * smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t) * (t > 0.42 && t < 0.47 ? 0.15 : 1.0) * 0.75;
  // (the planet's shadow across it: a point behind the planet from the star)
  float b = dot(p, uSun), sh = b < 0.0 && length(p - b * uSun) < uR ? 0.08 : 1.0;
  gl_FragColor = vec4(uBase * (0.55 + 0.45 * abs(dot(normalize(cross(dFdx(vW), dFdy(vW))), uSun))) * sh, a);
}`;

// A CLOSE WORLD'S RINGS (live, a ringed child of Sol held near: skyscape/backdrop.js PROXIMITY): its plane the world's
// equator, its density Saturn's (the C ring faint, the B ring dense and bright, the Cassini Division, the A ring and the
// Encke gap), its ringlets fine; hidden where the world stands in front of it, the world's shadow across it; drawn into
// the screen, encoded as the world under it is
const RING_LIVE_FRAG = `${NOISE}
uniform vec3 uSun, uBase, uCenter; uniform float uIn, uOut, uR, uSeed; varying vec3 vW;
void main() {
  vec3 p = vW - uCenter, eye = vW - cameraPosition, dir = normalize(eye), C = uCenter - cameraPosition;
  float tc = dot(C, dir), h2 = dot(C, C) - tc * tc;
  if (h2 < uR * uR && tc - sqrt(uR * uR - h2) < length(eye)) discard;
  float t = (length(p) - uIn) / (uOut - uIn);
  float d = 0.3 * smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.2, 0.28, t))
          + 0.95 * smoothstep(0.26, 0.31, t) * (1.0 - smoothstep(0.66, 0.69, t))
          + 0.62 * smoothstep(0.75, 0.78, t) * (1.0 - smoothstep(0.97, 1.0, t));
  d *= 1.0 - 0.85 * smoothstep(0.88, 0.89, t) * (1.0 - smoothstep(0.9, 0.91, t));
  // (ringlets: faded as they near a pixel across, so they never beat into moiré)
  float fw = clamp(fwidth(t) * 160.0, 0.0, 1.0);
  d *= mix(0.74 + 0.26 * (0.5 + 0.5 * sin(t * 160.0 + 2.0 * sin(t * 23.0))) * (0.8 + 0.2 * bdNoise(vec3(t * 90.0, uSeed * 0.001, 0.0))), 0.87, fw);
  vec3 alb = uBase * mix(0.6, 1.08, smoothstep(0.25, 0.6, t));
  float b = dot(p, uSun), sh = b < 0.0 && length(p - b * uSun) < uR ? 0.1 : 1.0;
  vec3 col = alb * (0.18 + 0.9 * abs(dot(normalize(cross(dFdx(vW), dFdy(vW))), uSun))) * sh;
  gl_FragColor = vec4(pow(max(col, 0.0), vec3(1.0 / 2.2)), clamp(d, 0.0, 1.0));
}`;

const GLOW_FRAG = `uniform vec3 uCol; uniform float uCore, uK; varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0, g = exp(-r * r * 6.0) * uK;
  if (uCore > 0.0) g += (1.0 - smoothstep(uCore * 0.8, uCore, r)) * 1.6;   // (a disc where it has one)
  gl_FragColor = vec4(uCol * g * (1.0 - smoothstep(0.7, 1.0, r)), 1.0);    // (to nothing at its edge: no square)
}`;

// a world's knobs as its shader's uniforms (linear colours; a knob the world leaves out, nothing of it)
const COLOURS = { uLand0: 'land0', uLand1: 'land1', uSea: 'sea', uVeg: 'vegC', uIce: 'iceC', uCloud: 'cloudC', uAtmo: 'atmoC', uLava: 'lavaC', uB0: 'band0', uB1: 'band1', uB2: 'band2', uStorm: 'stormC' };
const NUMBERS = { uDetail: 'live', uGas: 'gas', uOcean: 'ocean', uVegK: 'veg', uIceK: 'ice', uCloudK: 'cloud', uCraters: 'craters', uLavaK: 'lava', uLights: 'lights', uDunes: 'dunes', uHaze: 'haze', uAtmoK: 'atmo', uGlow: 'glow', uFreq: 'freq', uTurb: 'turb', uStormK: 'storm', uSeed: 'seed' };
function worldInput(p) {
  const u = {};
  for (const [k, w] of Object.entries(COLOURS)) u[k] = typeof p[w] === 'string' ? lin(p[w]) : [0, 0, 0];
  for (const [k, w] of Object.entries(NUMBERS)) u[k] = Number.isFinite(p[w]) ? p[w] : p[w] === true ? 1 : 0;
  return { dir: p.dir, r: p.r, u, spin: p.axis ?? [0, 0], ...(p.rings ? { rings: { ...p.rings, color: lin(p.rings.color || p.band2 || '#d8c8a0') } } : {}) };
}

export function spaceBackdropScript(B, { size = BACKDROP_FACE } = {}) {
  const D = {
    nebula: B.nebula ? { ...B.nebula, a: lin(B.nebula.a), b: lin(B.nebula.b), warm: lin(B.nebula.warm) } : null,
    planets: (B.planets || []).filter((p) => !p.blackHole && !p.live).map(worldInput),
    live: (B.planets || []).filter((p) => !p.blackHole && p.live).map(worldInput),
    holes: (B.planets || []).filter((p) => p.blackHole).map((p) => ({ dir: p.dir, r: p.r, disk: p.disk, einstein: p.einstein, tilt: p.tilt, spin: p.spin, hot: lin(p.hot), cool: lin(p.cool), seed: p.seed })),
    suns: (B.suns || []).map((s) => ({ dir: s.dir, r: s.r, glow: s.glow, color: lin(s.color) })),
  };
  return `
// --- the space backdrop (skyscape/backdrop.js; channels/space-backdrop.js): baked once into the sky at infinity ---
(function () {
  const BD = ${safeJson(D)}, SUN = (SKY.sun && SKY.sun.dir) || [0, 0, 1];
  const NEB = ${JSON.stringify(NEBULA_FRAG)}, PLA = ${JSON.stringify(PLANET_FRAG)}, AIR = ${JSON.stringify(AIR_FRAG)}, RING = ${JSON.stringify(RING_FRAG)}, GLOW = ${JSON.stringify(GLOW_FRAG)}, HALO = ${JSON.stringify(HALO_FRAG)}${D.live.some((P) => P.rings) ? `, RINGL = ${JSON.stringify(RING_LIVE_FRAG)}` : ''}${D.holes.length ? `, HOLE = ${JSON.stringify(HOLE_FRAG)}` : ''};
  const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]), sunV = v3(SUN).normalize();
  // (a world's axis: tilted about x by its tilt, turned about its axis by its turn, as a 3×3 for its shader)
  const spinOf = (sp) => new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationZ(sp[1] * Math.PI / 180).multiply(new THREE.Matrix4().makeRotationX(sp[0] * Math.PI / 180)));
  const uniOf = (P) => Object.assign({ uSun: { value: sunV }, uSpin: { value: spinOf(P.spin) } }, ...Object.entries(P.u).map(([k, v]) => ({ [k]: { value: Array.isArray(v) ? v3(v) : v } })));
  const VERT_DIR = 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const VERT_N = 'varying vec3 vN; varying vec3 vW; void main(){ vN = normalize(position); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const VERT_W = 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
  const VERT_UV = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  function bake() {
    if (typeof renderer === 'undefined') return setTimeout(bake, 50);
    const room = new THREE.Scene(), made = [];
    const add = (m) => { room.add(m); made.push(m); return m; };
    const glow = (dir, dist, deg, col, k, core) => { const s = dist * Math.tan(deg * Math.PI / 180) * 2, m = add(new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.ShaderMaterial({ uniforms: { uCol: { value: v3(col) }, uK: { value: k }, uCore: { value: core } }, vertexShader: VERT_UV, fragmentShader: GLOW, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))); m.position.copy(v3(dir).normalize().multiplyScalar(dist)); m.lookAt(0, 0, 0); return m; };
    if (BD.nebula) {
      const N = BD.nebula;
      add(new THREE.Mesh(new THREE.SphereGeometry(150, 96, 48), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, vertexShader: VERT_DIR, fragmentShader: NEB,
        uniforms: { uPlane: { value: v3(N.plane).normalize() }, uA: { value: v3(N.a) }, uB: { value: v3(N.b) }, uWarm: { value: v3(N.warm) }, uWidth: { value: N.width }, uDust: { value: N.dust }, uGlow: { value: N.glow }, uSeed: { value: N.seed } } }))).renderOrder = -3;
    }
    // (the near star's corona, wide and faint, round where its disc is drawn; the far suns, a disc in a glow each)
    glow(SUN, 120, 16, [1, 0.93, 0.82], 0.05, 0).renderOrder = -2;
    for (const S of BD.suns) glow(S.dir, 120, S.glow, S.color, 0.35, S.r / S.glow).renderOrder = -2;
    for (const P of BD.planets) {
      const c = v3(P.dir).normalize().multiplyScalar(60), R = 60 * Math.tan(P.r * Math.PI / 180);
      // (its halo behind it, a plane facing the eye: the atmosphere's glow past its limb, lit on the star's side)
      const hs = R * 1.18, halo = add(new THREE.Mesh(new THREE.PlaneGeometry(2 * hs, 2 * hs), new THREE.ShaderMaterial({ vertexShader: VERT_UV, fragmentShader: HALO, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uAtmo: { value: v3(P.u.uAtmo) }, uAtmoK: { value: P.u.uAtmoK }, uIn: { value: R / hs }, uSunUv: { value: new THREE.Vector3() } } })));
      halo.position.copy(c).multiplyScalar(1.02); halo.lookAt(0, 0, 0); halo.updateMatrixWorld(true);
      { const inv = new THREE.Matrix4().copy(halo.matrixWorld).invert(), sp = sunV.clone().transformDirection(inv); halo.material.uniforms.uSunUv.value.set(sp.x, sp.y, 0).normalize(); }
      const m = add(new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), new THREE.ShaderMaterial({ transparent: true, vertexShader: VERT_N, fragmentShader: PLA,
        uniforms: uniOf(P) })));
      m.position.copy(c);
      if (P.rings) {
        const ring = add(new THREE.Mesh(new THREE.RingGeometry(R * P.rings.inner, R * P.rings.outer, 160, 1), new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthWrite: false, vertexShader: VERT_W, fragmentShader: RING, extensions: { derivatives: true },
          uniforms: { uSun: { value: sunV }, uBase: { value: v3(P.rings.color) }, uCenter: { value: c.clone() }, uIn: { value: R * P.rings.inner }, uOut: { value: R * P.rings.outer }, uR: { value: R }, uSeed: { value: P.u.uSeed } } })));
        // (its plane tilted off the line of sight by the plan's tilt, about the planet's own equator)
        ring.position.copy(c); ring.lookAt(0, 0, 0); ring.rotateX((90 - P.rings.tilt) * Math.PI / 180);
      }
    }
    // (half-float: the nebula's faint gradients are a few hundredths of linear light, and in eight bits their channels
    // round apart, banding the dark into green and teal)
    const rt = new THREE.WebGLCubeRenderTarget(${size}, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    const cam = new THREE.CubeCamera(0.5, 400, rt); cam.up.set(0, 0, 1);
    cam.update(renderer, room);
    let sky = rt;${D.holes.length ? `
    // the black holes: a second pass, the sky just drawn bent round each (HOLE_FRAG), drawn again into a second cube
    {
      const room2 = new THREE.Scene(), rt2 = new THREE.WebGLCubeRenderTarget(${size}, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      rt2.texture.colorSpace = THREE.LinearSRGBColorSpace;
      const back = new THREE.Mesh(new THREE.SphereGeometry(150, 64, 32), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, uniforms: { uSky: { value: rt.texture } }, vertexShader: VERT_DIR, fragmentShader: 'uniform samplerCube uSky; varying vec3 vDir; void main(){ vec3 d = normalize(vDir); gl_FragColor = vec4(textureCube(uSky, d).rgb, 1.0); }' }));
      room2.add(back); made.push(back);
      for (const H of BD.holes) {
        const C = v3(H.dir).normalize(), R = H.r * Math.PI / 180, s = 2 * 60 * Math.tan(Math.min(1.4, R * 8));
        // (its disk's long axis round the line of sight by its spin)
        const ref = Math.abs(C.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0), a = new THREE.Vector3().crossVectors(C, ref).normalize(), b = new THREE.Vector3().crossVectors(C, a), sp = H.spin * Math.PI / 180;
        const e1 = a.clone().multiplyScalar(Math.cos(sp)).add(b.clone().multiplyScalar(Math.sin(sp)));
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, vertexShader: VERT_W, fragmentShader: HOLE,
          uniforms: { uSky: { value: rt.texture }, uC: { value: C }, uE1: { value: e1 }, uHot: { value: v3(H.hot) }, uCool: { value: v3(H.cool) }, uR: { value: R }, uIn: { value: H.disk[0] }, uOut: { value: H.disk[1] }, uEin: { value: H.einstein }, uTilt: { value: H.tilt * Math.PI / 180 }, uSeed: { value: H.seed } } }));
        m.position.copy(C).multiplyScalar(60); m.lookAt(0, 0, 0); room2.add(m); made.push(m);
      }
      const cam2 = new THREE.CubeCamera(0.5, 400, rt2); cam2.up.set(0, 0, 1);
      cam2.update(renderer, room2);
      sky = rt2; rt.dispose();
    }` : ''}
    scene.background = sky.texture;
    for (const m of made) { m.geometry.dispose(); m.material.dispose(); }
  }
  setTimeout(bake, 0);${D.live.length ? `
  // THE CLOSE WORLD, live (near, or in orbit): a sphere at infinity drawn at the screen's own resolution, behind
  // everything (first, no depth: the fight is always in front of it), held round the eye as the sky is; its air a shell
  // over it, the horizon's band
  const LD = 4000;
  for (const P of BD.live) {
    const dir = v3(P.dir).normalize(), R = LD * Math.sin(P.r * Math.PI / 180), Rs = R * 1.018;
    const at = (o, cam) => { const e = cam.matrixWorld.elements; o.position.set(e[12] + dir.x * LD, e[13] + dir.y * LD, e[14] + dir.z * LD); o.updateMatrixWorld(); };
    const ground = new THREE.Mesh(new THREE.SphereGeometry(R, 256, 128), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, vertexShader: VERT_N, fragmentShader: PLA,
      uniforms: uniOf(P) }));
    ground.renderOrder = -10; ground.frustumCulled = false; ground.onBeforeRender = (r, sc, cam) => at(ground, cam);
    const air = new THREE.Mesh(new THREE.SphereGeometry(Rs, 192, 96), new THREE.ShaderMaterial({ depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, vertexShader: VERT_W, fragmentShader: AIR,
      uniforms: { uC: { value: new THREE.Vector3() }, uAtmo: { value: v3(P.u.uAtmo) }, uSun: { value: sunV }, uR: { value: R }, uRs: { value: Rs }, uK: { value: 0.35 + 0.9 * P.u.uAtmoK } } }));
    air.renderOrder = -9; air.frustumCulled = false; air.onBeforeRender = (r, sc, cam) => { at(air, cam); air.material.uniforms.uC.value.copy(air.position); };
    scene.add(ground, air);${D.live.some((P) => P.rings) ? `
    if (P.rings) {
      // (its rings in its equator's plane: the world's pole, the sky's z turned back through its spin)
      const pole = new THREE.Vector3(0, 0, 1).applyMatrix3(spinOf(P.spin).transpose()).normalize();
      const ring = new THREE.Mesh(new THREE.RingGeometry(R * P.rings.inner, R * P.rings.outer, 512, 1), new THREE.ShaderMaterial({ side: THREE.DoubleSide, transparent: true, depthTest: false, depthWrite: false, vertexShader: VERT_W, fragmentShader: RINGL, extensions: { derivatives: true },
        uniforms: { uSun: { value: sunV }, uBase: { value: v3(P.rings.color) }, uCenter: { value: new THREE.Vector3() }, uIn: { value: R * P.rings.inner }, uOut: { value: R * P.rings.outer }, uR: { value: R }, uSeed: { value: P.u.uSeed } } }));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pole);
      ring.renderOrder = -9.5; ring.frustumCulled = false; ring.onBeforeRender = (r, sc, cam) => { at(ring, cam); ring.material.uniforms.uCenter.value.copy(ring.position); };
      scene.add(ring);
    }` : ''}
  }` : ''}
})();
`;
}

/** Whether a direction falls on a planet's disc, or within a black hole's lens (a star there is left out, since it would
 *  shine through the shadow, unbent): the page's star loop asks it. */
export const onPlanetSource = `(d) => { for (const P of SKY.backdrop.planets) { const L = Math.hypot(P.dir[0], P.dir[1], P.dir[2]) || 1; if ((d[0] * P.dir[0] + d[1] * P.dir[1] + d[2] * P.dir[2]) / L > Math.cos(P.r * (P.blackHole ? 2 : 1.06) * Math.PI / 180)) return true; } return false; }`;
