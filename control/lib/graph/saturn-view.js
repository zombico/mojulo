/**
 * saturn-view — the PLANETS of the solar system (Mercury → Neptune) rendered by a per-pixel
 * ray-tracing fragment shader (the same raymarch-mode path as the black hole), plus a GALLERY stepper
 * to flip through them one at a time. The shader does what meshes can't cleanly: ring shadows on the
 * planet, the planet's shadow across the rings, semi-transparent rings, and backlit forward-scatter glow.
 *
 * One shader, eight worlds (selected by `planet`, or stepped through with `gallery`):
 *   • mercury — gray, heavily cratered, airless (rocky surface).
 *   • venus   — thick opaque pale-yellow cloud deck.
 *   • earth   — blue oceans, green/brown continents, white ice caps + clouds, a blue atmosphere.
 *   • mars    — rusty rocky surface with bright polar ice caps.
 *   • jupiter — bold brown belts + cream zones, the Great Red Spot, a faint dusty ring.
 *   • saturn  — bright broad structured rings (C / B / Cassini gap / A / Encke), gold bands.
 *   • uranus  — pale featureless cyan, TIPPED on its side, thin dark rings stand vertical.
 *   • neptune — deep methane blue, a Great Dark Spot, faint narrow rings with the Adams ring ARCS.
 *
 * Each planet carries its own surface TYPE (banded gas giant / rocky / cloud / ocean), palette, ring
 * system, oblateness, axial tilt, atmosphere, and (gas giants) a storm spot.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'saturn-view', planet?, gallery?, scenario?, inclination?, ringOut?, scale?, viewBox?,
 *     scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera). No walk, no /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

export const SATURN_FRAG = `
precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime;
uniform vec3 uSunDir, uBandA, uBandB, uPole, uSpot, uSpotCol, uAtmo;
uniform float uFov, uRingIn, uRingOut, uOblate, uBacklit, uBandFreq, uContrast, uRingMode, uTilt, uSurfType, uAtmoStr, uIceLat;

float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c * p.y + s * p.z, -s * p.y + c * p.z); }
vec3 stars(vec3 d){
  vec3 c = vec3(0.008, 0.010, 0.018);
  float s = hash(floor(d * 240.0));
  if (s > 0.992) { float b = (s - 0.992) / 0.008; c += vec3(0.85, 0.9, 1.0) * b * b; }
  return c;
}
void ringProps(float rr, float mode, out float op, out vec3 alb){
  op = 0.0; alb = vec3(0.0);
  if (mode < 0.5) return;                                                             // no rings (terrestrials)
  float u = clamp((rr - uRingIn) / (uRingOut - uRingIn), 0.0, 1.0);
  float dens = 0.0; vec3 a = vec3(0.8);
  if (mode < 1.5) {                                                                    // SATURN
    dens += 0.30 * smoothstep(0.0, 0.07, u) * (1.0 - smoothstep(0.18, 0.30, u));       // C ring
    dens += 0.95 * smoothstep(0.27, 0.35, u) * (1.0 - smoothstep(0.55, 0.62, u));      // B ring (dense, bright)
    dens += 0.62 * smoothstep(0.70, 0.745, u) * (1.0 - smoothstep(0.95, 0.995, u));    // A ring (past the Cassini Division gap)
    dens *= 1.0 - 0.85 * (smoothstep(0.86, 0.875, u) * (1.0 - smoothstep(0.885, 0.90, u)));  // Encke gap
    dens *= 0.82 + 0.18 * sin(u * 140.0 + 1.0);
    a = mix(vec3(0.52, 0.47, 0.40), vec3(0.93, 0.89, 0.80), smoothstep(0.28, 0.62, u));
  } else if (mode < 2.5) {                                                             // JUPITER — one faint dusty ring
    dens = 0.13 * smoothstep(0.05, 0.25, u) * (1.0 - smoothstep(0.65, 0.95, u));
    a = vec3(0.55, 0.40, 0.32);
  } else if (mode < 3.5) {                                                             // NEPTUNE — narrow rings (arcs added outside)
    dens += 0.22 * smoothstep(0.16, 0.20, u) * (1.0 - smoothstep(0.26, 0.32, u));
    dens += 0.42 * smoothstep(0.86, 0.90, u) * (1.0 - smoothstep(0.94, 0.98, u));      // Adams ring
    a = vec3(0.44, 0.52, 0.64);
  } else {                                                                            // URANUS — thin dark narrow ringlets
    dens += 0.28 * smoothstep(0.55, 0.575, u) * (1.0 - smoothstep(0.60, 0.625, u));
    dens += 0.24 * smoothstep(0.72, 0.74, u) * (1.0 - smoothstep(0.76, 0.78, u));
    dens += 0.55 * smoothstep(0.90, 0.93, u) * (1.0 - smoothstep(0.96, 0.99, u));      // ε ring (the bright one)
    a = vec3(0.32, 0.31, 0.30);
  }
  op = clamp(dens, 0.0, 1.0); alb = a;
}
bool hitPlanet(vec3 ro, vec3 rd, out float t, out vec3 nrm){
  vec3 s = vec3(1.0, 1.0 / uOblate, 1.0);
  vec3 o = ro * s, d = rd * s;
  float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0, h = b * b - a * c;
  if (h < 0.0) return false;
  float tt = (-b - sqrt(h)) / a; if (tt < 0.0) return false;
  t = tt; nrm = normalize((ro + rd * t) * s * s); return true;
}
bool hitRing(vec3 ro, vec3 rd, out float t, out float rr){
  if (abs(rd.y) < 1e-4) return false;
  t = -ro.y / rd.y; if (t < 0.0) return false;
  vec3 p = ro + rd * t; rr = length(p.xz);
  return rr > uRingIn && rr < uRingOut;
}
float ringShadow(vec3 p, vec3 sun){
  if (abs(sun.y) < 1e-4) return 1.0;
  float t = -p.y / sun.y; if (t < 0.0) return 1.0;
  vec3 q = p + sun * t; float rr = length(q.xz);
  if (rr > uRingIn && rr < uRingOut) { float op; vec3 a; ringProps(rr, uRingMode, op, a); return 1.0 - 0.8 * op; }
  return 1.0;
}
float planetShadow(vec3 p, vec3 sun){
  float t; vec3 n; return hitPlanet(p + sun * 0.01, sun, t, n) ? 0.12 : 1.0;
}
vec3 planetColor(vec3 nrm){
  float lat = nrm.y;
  if (uSurfType < 0.5) {                                                  // GAS GIANT — banded atmosphere
    float turb = vnoise(nrm * vec3(3.0, 9.0, 3.0) + vec3(uTime * 0.02, 0.0, 0.0));
    float band = clamp(sin(lat * uBandFreq + turb * 2.2) * uContrast, -1.0, 1.0);
    vec3 c = mix(uBandA, uBandB, 0.5 + 0.5 * band);
    c = mix(c, uPole, smoothstep(0.6, 0.97, abs(lat)));
    if (uSpot.z > 0.001) {                                                // a storm spot (GRS / GDS)
      float lon = atan(nrm.x, nrm.z);
      float dl = atan(sin(lon - uSpot.y - uTime * 0.04), cos(lon - uSpot.y - uTime * 0.04));
      float d = length(vec2(dl * 0.45, lat - uSpot.x));
      c = mix(uSpotCol, c, smoothstep(uSpot.z * 0.55, uSpot.z, d));
    }
    return c;
  } else if (uSurfType < 1.5) {                                           // ROCKY — Mercury, Mars
    float n = fbm(nrm * uBandFreq);
    vec3 c = mix(uBandA, uBandB, smoothstep(0.35, 0.65, n));
    c *= 0.72 + 0.5 * fbm(nrm * uBandFreq * 2.7);                         // crater / albedo speckle
    c = mix(c, uPole, smoothstep(uIceLat, uIceLat + 0.04, abs(lat)));     // polar ice caps
    return c;
  } else if (uSurfType < 2.5) {                                           // CLOUD — Venus
    float n = fbm(nrm * uBandFreq + vec3(uTime * 0.01, 0.0, 0.0));
    return mix(uBandA, uBandB, 0.45 + 0.5 * n);
  } else {                                                                // OCEAN — Earth
    float h = fbm(nrm * uBandFreq);
    vec3 c = mix(uBandA, uBandB, smoothstep(0.48, 0.54, h));              // ocean → land
    c = mix(c, uPole, smoothstep(uIceLat, uIceLat + 0.05, abs(lat)));     // ice caps
    float cl = smoothstep(0.58, 0.72, fbm(nrm * (uBandFreq + 1.0) + vec3(uTime * 0.012, 0.0, 0.0)));
    return mix(c, vec3(1.0), cl * 0.55);                                  // clouds
  }
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  vec3 rdW = normalize(uCamBasis * vec3(uv.x * tan(uFov * 0.5), uv.y * tan(uFov * 0.5), 1.0));
  vec3 ro = rotX(uCamPos, uTilt), rd = rotX(rdW, uTilt), sun = normalize(rotX(uSunDir, uTilt));   // into the planet's tilted body frame
  bool backlit = uBacklit > 0.5;

  vec3 bg = stars(rd);
  float tP, tR, rr; vec3 nP;
  bool hp = hitPlanet(ro, rd, tP, nP);
  bool hr = hitRing(ro, rd, tR, rr);

  vec3 planetCol = bg;
  if (hp) {
    vec3 hit = ro + rd * tP;
    float diff = max(0.0, dot(nP, sun)) * ringShadow(hit, sun);
    planetCol = planetColor(nP) * (0.07 + 0.95 * diff);
    float limb = pow(1.0 - max(0.0, dot(nP, -rd)), 3.0);
    if (backlit) planetCol += uAtmo * limb * 1.8 * pow(max(0.0, dot(-sun, -rd)), 2.0) * (0.25 + uAtmoStr);   // forward-scattered atmosphere rim
    else planetCol += uAtmo * limb * (0.2 + 0.9 * uAtmoStr) * (0.3 + 0.7 * diff);
  }

  vec3 ringCol = vec3(0.0); float ringOp = 0.0;
  if (hr) {
    vec3 hit = ro + rd * tR;
    float op; vec3 alb; ringProps(rr, uRingMode, op, alb);
    if (uRingMode > 2.5 && uRingMode < 3.5) { float az = atan(hit.z, hit.x); op *= 0.18 + 0.82 * pow(max(0.0, sin(az * 3.0 + 1.0)), 6.0); }   // Neptune's Adams ring arcs
    float lit = planetShadow(hit, sun);
    if (backlit) {
      float fs = op * exp(-op * 2.6);                         // forward scatter: peaks mid-density (dense rings darken)
      ringCol = alb * (0.05 + 3.2 * fs) * lit;
      ringOp = clamp(op * 0.5 + fs * 1.2, 0.0, 1.0);
    } else {
      float dif = max(0.06, abs(sun.y)) * lit;
      ringCol = alb * (0.12 + 1.05 * dif);
      ringOp = op;
    }
  }

  vec3 col = hp ? planetCol : bg;
  if (hr && (!hp || tR < tP)) col = mix(col, ringCol, ringOp);   // semi-transparent rings → blend over planet/space

  col = col / (col + vec3(1.0));
  col = pow(col, vec3(0.85));
  gl_FragColor = vec4(col, 1.0);
}
`;

const CAM_DIST = 9;
const NO_RING = { ringMode: 0, ringIn: 2.0, ringOut: 2.0 };

// per-planet appearance — surface type, palette, rings, oblateness, axial tilt, atmosphere, ice caps.
// surfType: 0 banded gas giant · 1 rocky · 2 cloud · 3 ocean.  Keyed in solar order.
const PLANETS = {
  mercury: { surfType: 1, bandA: [0.40, 0.38, 0.36], bandB: [0.62, 0.59, 0.55], pole: [0.5, 0.48, 0.46], bandFreq: 5.0, contrast: 1.0, spot: [0, 0, 0], spotCol: [0, 0, 0], ...NO_RING, oblate: 1.0, tilt: 0.0, atmo: [0, 0, 0], atmoStr: 0.0, iceLat: 2.0 },
  venus: { surfType: 2, bandA: [0.80, 0.66, 0.36], bandB: [0.96, 0.89, 0.64], pole: [0.92, 0.86, 0.62], bandFreq: 2.5, contrast: 0.6, spot: [0, 0, 0], spotCol: [0, 0, 0], ...NO_RING, oblate: 1.0, tilt: 0.0, atmo: [0.98, 0.85, 0.5], atmoStr: 0.5, iceLat: 2.0 },
  earth: { surfType: 3, bandA: [0.05, 0.20, 0.45], bandB: [0.22, 0.42, 0.16], pole: [0.92, 0.95, 0.98], bandFreq: 2.4, contrast: 1.0, spot: [0, 0, 0], spotCol: [0, 0, 0], ...NO_RING, oblate: 0.997, tilt: 0.0, atmo: [0.35, 0.55, 1.0], atmoStr: 0.7, iceLat: 0.80 },
  mars: { surfType: 1, bandA: [0.58, 0.28, 0.15], bandB: [0.80, 0.46, 0.28], pole: [0.95, 0.95, 0.96], bandFreq: 4.5, contrast: 1.0, spot: [0, 0, 0], spotCol: [0, 0, 0], ...NO_RING, oblate: 0.994, tilt: 0.0, atmo: [0.85, 0.55, 0.45], atmoStr: 0.2, iceLat: 0.82 },
  jupiter: { surfType: 0, bandA: [0.55, 0.38, 0.26], bandB: [0.94, 0.85, 0.66], pole: [0.80, 0.74, 0.62], bandFreq: 22, contrast: 1.3, spot: [-0.32, 2.2, 0.24], spotCol: [0.74, 0.32, 0.20], ringMode: 2, ringIn: 1.18, ringOut: 1.55, oblate: 0.935, tilt: 0.05, atmo: [0.92, 0.82, 0.62], atmoStr: 0.35, iceLat: 2.0 },
  saturn: { surfType: 0, bandA: [0.78, 0.63, 0.40], bandB: [0.95, 0.87, 0.62], pole: [0.86, 0.80, 0.66], bandFreq: 17, contrast: 1.0, spot: [0, 0, 0], spotCol: [0, 0, 0], ringMode: 1, ringIn: 1.24, ringOut: 2.27, oblate: 0.90, tilt: 0.0, atmo: [0.93, 0.87, 0.70], atmoStr: 0.3, iceLat: 2.0 },
  uranus: { surfType: 0, bandA: [0.46, 0.74, 0.75], bandB: [0.64, 0.85, 0.85], pole: [0.72, 0.90, 0.90], bandFreq: 9, contrast: 0.3, spot: [0, 0, 0], spotCol: [0, 0, 0], ringMode: 4, ringIn: 1.55, ringOut: 2.0, oblate: 0.977, tilt: 1.42, atmo: [0.62, 0.86, 0.86], atmoStr: 0.4, iceLat: 2.0 },
  neptune: { surfType: 0, bandA: [0.10, 0.26, 0.62], bandB: [0.34, 0.55, 0.90], pole: [0.52, 0.68, 0.88], bandFreq: 12, contrast: 0.6, spot: [-0.28, 4.0, 0.22], spotCol: [0.05, 0.09, 0.28], ringMode: 3, ringIn: 1.35, ringOut: 2.05, oblate: 0.982, tilt: 0.0, atmo: [0.40, 0.6, 1.0], atmoStr: 0.45, iceLat: 2.0 },
};

export const SATURN_PLANETS = Object.keys(PLANETS);   // solar order: mercury … neptune

// lighting / viewing compositions (applied to any planet).
const SCENARIOS = {
  classic: { inclination: 24, sun: [0.5, 0.62, 0.28], backlit: 0, fov: 38 },
  backlit: { inclination: 10, sun: [0.12, 0.2, -1.0], backlit: 1, fov: 42 },
  polar: { inclination: 74, sun: [0.4, 0.6, 0.3], backlit: 0, fov: 40 },
};

export const SATURN_SCENARIOS = Object.keys(SCENARIOS);

const PLANET_LINE = {
  mercury: 'Mercury — cratered, airless, the smallest planet',
  venus: 'Venus — thick opaque sulphuric-acid clouds',
  earth: 'Earth — oceans, continents, clouds, a blue atmosphere',
  mars: 'Mars — rusty rocky surface, bright polar ice caps',
  jupiter: 'Jupiter — brown belts + cream zones, the Great Red Spot',
  saturn: 'Saturn — the bright structured rings (C / B / Cassini / A)',
  uranus: 'Uranus — tipped on its side, thin dark rings stand vertical',
  neptune: 'Neptune — deep methane blue, a Great Dark Spot, ring arcs',
};
const PLANET_FACT = {
  mercury: 'no atmosphere · heavily cratered',
  venus: 'runaway greenhouse · ~460 °C surface',
  earth: 'the only world known to harbour life',
  mars: 'CO₂ + water-ice polar caps',
  jupiter: 'the largest planet · a faint dusty ring',
  saturn: 'rings shadow the planet · the planet shadows the rings',
  uranus: 'axial tilt ≈ 98° — it orbits on its side',
  neptune: 'the Adams ring breaks into bright ARCS',
};
const SCENE_LINE = {
  classic: 'sunlit · rings shadow the planet · the planet shadows the rings',
  backlit: 'backlit (in the planet’s shadow) · rings glow by forward scatter',
  polar: 'high angle · the full ring system over the banded globe',
};

// the per-planet uniform set (the shader is the same; only these change between gallery steps).
function uniformsFor(p, sun, backlit) {
  return {
    uSunDir: sun, uBacklit: backlit, uTilt: p.tilt, uOblate: p.oblate,
    uRingIn: p.ringIn, uRingOut: p.ringOut, uRingMode: p.ringMode,
    uBandA: p.bandA, uBandB: p.bandB, uPole: p.pole, uBandFreq: p.bandFreq, uContrast: p.contrast,
    uSpot: p.spot, uSpotCol: p.spotCol, uSurfType: p.surfType, uAtmo: p.atmo, uAtmoStr: p.atmoStr, uIceLat: p.iceLat,
  };
}

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * `gallery:true` → a stepper through all eight planets. @returns {{ raymarch, stats }}
 */
export function planSaturnScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'classic';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 2, 88, s.inclination);
  const el = incl * DEG;
  const cameraStart = [0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  if (recipe.gallery) {
    const steps = SATURN_PLANETS.map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      uniforms: uniformsFor(PLANETS[key], s.sun, s.backlit),
      readout: [PLANET_LINE[key], PLANET_FACT[key], 'ray-traced shader · ◀ ▶ to step planets · drag to orbit'],
    }));
    return {
      raymarch: { frag: SATURN_FRAG, customUniforms: steps[0].uniforms, steps, cameraStart, target: [0, 0, 0], fov: s.fov },
      stats: { gallery: true, scenario, planets: SATURN_PLANETS.length, inclination: incl },
    };
  }

  const planet = PLANETS[recipe.planet] ? recipe.planet : 'saturn';
  const p = PLANETS[planet];
  const u = uniformsFor(p, s.sun, s.backlit);
  u.uRingOut = clampNum(recipe.ringOut, 1.4, 3.0, p.ringOut);
  return {
    raymarch: {
      frag: SATURN_FRAG, customUniforms: u, cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: [PLANET_LINE[planet], SCENE_LINE[scenario], PLANET_FACT[planet], 'ray-traced shader (true shadows + translucency)'],
    },
    stats: { planet, scenario, inclination: incl, ringIn: p.ringIn, ringOut: u.uRingOut, oblate: p.oblate, tilt: p.tilt, surfType: p.surfType, backlit: !!s.backlit },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleSaturnScene(recipe = {}, { title } = {}) {
  const plan = planSaturnScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#01010a';
  let defaultTitle;
  if (plan.stats.gallery) defaultTitle = 'Solar gallery — the eight planets';
  else { const cap = plan.stats.planet.charAt(0).toUpperCase() + plan.stats.planet.slice(1); defaultTitle = `mojulo ${cap} (${plan.stats.scenario})`; }
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || defaultTitle,
    bg,
  };
}
