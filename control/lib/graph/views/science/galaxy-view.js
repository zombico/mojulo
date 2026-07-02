/**
 * galaxy-view — an artistic-but-structurally-honest MILKY WAY spiral galaxy, rendered by the same
 * per-pixel raymarcher mode the black-hole view uses (emitThreeWorld's `raymarch` channel). A galaxy
 * is luminous PARTICIPATING MEDIA, so it can't be a point cloud or mesh — it's a full-screen fragment
 * shader that integrates EMISSION and ABSORPTION through a 3-D stellar-density field along each view ray.
 *
 * Frame (shared with black-hole-view so camera presets transfer): the galactic plane is the xz-plane,
 * the spin axis is +y, height above the disk is y.
 *
 * The structure in the field (units ~kpc; Milky Way-like):
 *   • exponential radial disk  Σ(r) ∝ e^(−r/Rd), truncated near Rmax
 *   • thin vertical profile (sech² ≈ gaussian, scale Hz) — stars hug the plane
 *   • LOGARITHMIC spiral arms: phase = θ − ln(r)/tan(pitch), pitch ≈ 12°, 2 major + a weaker 4-arm harmonic
 *   • a central BAR (x-elongated core) and a rounder BULGE spheroid
 *   • flocculent texture from domain-warped fbm so arms feather instead of looking airbrushed
 *
 * The look is built to AVOID "brightness-filter vomit" (additive white mush): front-to-back
 * emission/absorption (dust really occludes), wavelength-dependent extinction (dust reddens), colour
 * from stellar POPULATION not intensity (old-yellow bulge, young-blue arms, pink Hα knots), and a
 * single ACES filmic tone-map whose toe keeps the void black and whose shoulder rolls off the core.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'galaxy-view', scenario?, inclination?, exposure?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera around the galaxy). No walk, no /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

// ── the volumetric galaxy fragment shader (GLSL). Galactic plane = xz, spin axis +y. ──
export const GALAXY_FRAG = `
precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime;
uniform float uFov;
uniform float uRmax;     // disk outer radius
uniform float uRd;       // disk radial scale length
uniform float uHz;       // disk vertical scale height
uniform float uArms;     // number of major arms
uniform float uPitchT;   // tan(pitch angle)
uniform float uBarLen;   // half-length of the central bar
uniform float uBulge;    // bulge scale radius
uniform float uExposure; // single global exposure (applied once, pre tone-map)

// ---- hashing / value noise ----
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.yzx + 33.33); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  float n000=hash13(i), n100=hash13(i+vec3(1,0,0));
  float n010=hash13(i+vec3(0,1,0)), n110=hash13(i+vec3(1,1,0));
  float n001=hash13(i+vec3(0,0,1)), n101=hash13(i+vec3(1,0,1));
  float n011=hash13(i+vec3(0,1,1)), n111=hash13(i+vec3(1,1,1));
  float nx00=mix(n000,n100,f.x), nx10=mix(n010,n110,f.x);
  float nx01=mix(n001,n101,f.x), nx11=mix(n011,n111,f.x);
  return mix(mix(nx00,nx10,f.y), mix(nx01,nx11,f.y), f.z);
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.02; a*=0.5; } return s; }

// background stars (seen through residual transmittance so the galaxy occludes them)
vec3 starfield(vec3 d){
  vec3 g = floor(d*260.0); float s = hash13(g);
  float b = smoothstep(0.992, 1.0, s);
  return vec3(0.82,0.88,1.0) * b*b * (0.4 + 0.6*hash13(g+7.0));
}

// arm ridge: ~1 on the spiral ridge, ~0 between. Logarithmic spiral winding.
float armField(float r, float theta){
  float w = log(max(r,0.05)) / uPitchT;            // winding
  float ph = theta - w;
  float a2 = 0.5 + 0.5*cos(uArms*ph);              // major arms
  float a4 = 0.5 + 0.5*cos(2.0*uArms*ph + 1.3);    // weaker inter-arm harmonic
  return clamp(pow(a2, 2.4) + 0.28*pow(a4, 3.0), 0.0, 1.4);
}
// dust on the inner (trailing) edge of the arm: phase-shifted, sharper, thinner.
float dustArmField(float r, float theta){
  float w = log(max(r,0.05)) / uPitchT;
  float d2 = 0.5 + 0.5*cos(uArms*(theta - w + 0.28));
  return pow(d2, 3.5);
}

// the galaxy volume: emission colour (premultiplied glow) + scalar dust extinction at p.
void sampleGalaxy(vec3 p, out vec3 emis, out float dust){
  float r = length(p.xz);
  float h = p.y;
  float theta = atan(p.z, p.x);

  float zt = h / uHz;
  float ez = exp(-zt*zt*0.5);                                  // thin disk (sech² ≈ gaussian)
  float radial = exp(-r/uRd) * smoothstep(uRmax, uRmax*0.7, r); // exp disk, truncated outer

  // central BAR: elongate along x (squares — never pow() a possibly-negative base in GLSL)
  float ax = p.x/uBarLen, pz = p.z/(uBarLen*0.32), hb = h/(uHz*1.1);
  float bar = exp(-ax*ax - pz*pz - hb*hb);
  // BULGE: broad soft wings (exponential) + a TIGHT, steeply-peaked NUCLEAR CORE — real bulges
  // follow a de Vaucouleurs / Sérsic law (sharp central spike, faint wings), and there is a dense
  // nuclear star cluster at r≈0. That concentrated heart — not a broad glow — is the nuclear core
  // every galaxy photo and artistic depiction shows.
  float r3 = length(p);
  float bulge = exp(-r3/uBulge);                 // broad halo wings
  float core  = exp(-r3/(uBulge*0.14));          // tight bright nucleus (small radius → a focal point)

  // ARMS + flocculent texture (domain-warped along the winding so it streaks down the arm)
  float w = log(max(r,0.05))/uPitchT;
  vec3 np = vec3(cos(theta - w), h*1.6, sin(theta - w)) * (2.2 + r*0.18);
  float tex   = fbm(np);                         // smooth flow texture
  float clump = pow(fbm(np*2.7 + 19.0), 3.0);    // sparse FINE knots — sharp + small + scattered
  float arm = armField(r, theta);
  // light is now CLUMP-dominated: a dim continuous ribbon studded with bright scattered knots,
  // not a smooth broad glow.
  float armDensity = radial * ez * arm * (0.22 + 0.5*tex + 2.6*clump);
  float diskFloor  = radial * ez * 0.10 * (0.4 + 0.6*tex);     // faint inter-arm disk
  // grain the bulge too, so the centre breaks into specks instead of one broad blob
  float bulgeTex = bulge * (0.35 + 1.5*pow(fbm(np*1.9 + 4.0), 2.0));

  // colour from POPULATION/REGION, not from brightness
  vec3 cBulge = vec3(1.00, 0.74, 0.42);   // old yellow-orange (broad bulge)
  vec3 cCore  = vec3(1.00, 0.90, 0.74);   // hot yellow-white nucleus
  vec3 cArm   = vec3(0.62, 0.78, 1.00);   // young blue-white
  vec3 cDisk  = vec3(0.85, 0.80, 0.70);   // warm white inter-arm
  vec3 cHII   = vec3(1.00, 0.42, 0.55);   // Hα pink knots

  // broad bulge stays dim + grainy; the CORE is the concentrated bright heart
  emis  = cBulge * (bulgeTex*0.4 + bar*0.45);
  emis += cCore  * core * 3.0;
  emis += cArm   * armDensity * 1.5;
  emis += cDisk  * diskFloor;
  float hii = clump * (0.4 + arm) * radial * ez;  // bright knots scattered across the disk, favouring arms
  emis += cHII * hii * 4.0;

  // DUST: thinner than the stars, concentrated on the inner arm edge + a general disk haze
  float dz = exp(-(h*h)/(uHz*uHz*0.25));
  dust = radial * dz * (0.5*dustArmField(r, theta)*(0.5 + 0.9*fbm(np*1.7)) + 0.12);
}

// ACES filmic: toe keeps the void black, shoulder rolls off the bright core.
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes) / (0.5*uRes.y);
  float tanf = tan(uFov*0.5);
  vec3 dir = normalize(uCamBasis * vec3(uv.x*tanf, uv.y*tanf, 1.0));
  vec3 ro = uCamPos;

  // march only inside the bounding sphere of the galaxy
  float R = uRmax*1.25;
  float b = dot(ro, dir), c = dot(ro,ro) - R*R, disc = b*b - c;
  vec3 col = vec3(0.0);
  vec3 trans = vec3(1.0);                          // per-channel transmittance → reddening
  if(disc > 0.0){
    float sq = sqrt(disc);
    float t0 = max(-b - sq, 0.0), t1 = -b + sq;
    const int STEPS = 128;
    float dt = (t1 - t0) / float(STEPS);
    float jit = hash13(vec3(gl_FragCoord.xy, floor(uTime)));   // dither start → kill step banding
    float t = t0 + dt*jit;
    for(int i=0;i<STEPS;i++){
      vec3 p = ro + dir*t;
      vec3 emis; float dust;
      sampleGalaxy(p, emis, dust);
      col += trans * emis * dt;                                 // emission through current transmittance
      trans *= exp(-dust * dt * vec3(2.2, 1.5, 0.9));           // dust absorbs blue > red → reddens
      t += dt;
      if(max(trans.r, max(trans.g, trans.b)) < 0.01) break;
    }
  }
  col += trans * starfield(dir);                  // void stars, occluded by the galaxy

  col *= uExposure;                               // expose ONCE
  col = aces(col);                                // tone-map ONCE — no global bloom
  col = pow(col, vec3(0.4545));                   // linear → sRGB
  gl_FragColor = vec4(col, 1.0);
}
`;

// camera distance from the galactic centre (kpc-ish units) — frames the whole disk.
const CAM_DIST = 26;

// structure shared by every preset (the Milky Way-like skeleton); presets vary only the camera.
const STRUCTURE = {
  uRmax: 15, uRd: 3.6, uHz: 0.5, uArms: 2, uPitchT: Math.tan(12 * DEG), uBarLen: 3.2, uBulge: 1.7,
};

// presets distinguished by viewing INCLINATION (0 = face-on / down the spin axis, 90 = edge-on).
const SCENARIOS = {
  oblique: { inclination: 60, exposure: 1.5, fov: 42 },   // the flattering 3/4 "Andromeda" view (default)
  'face-on': { inclination: 7, exposure: 1.45, fov: 44 }, // the full pinwheel
  'edge-on': { inclination: 87, exposure: 1.8, fov: 40 }, // the thin disk + dust-lane silhouette
};

export const GALAXY_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planGalaxyScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'oblique';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 0, 90, s.inclination);
  const exposure = clampNum(recipe.exposure, 0.4, 4, s.exposure);
  const el = (90 - incl) * DEG;   // elevation above the disk plane (90° = face-on)
  // tiny x offset avoids the OrbitControls gimbal when looking straight down +y (face-on).
  const cameraStart = [0.001, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  return {
    raymarch: {
      frag: GALAXY_FRAG,
      customUniforms: { ...STRUCTURE, uExposure: exposure },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: [
        'Milky Way — barred spiral (SBbc)',
        'logarithmic arms, pitch ≈ 12° · 2 major + harmonic',
        'old yellow bulge + bar · young blue arms · pink Hα knots',
        'dust lanes: real extinction (reddens light passing through)',
        'volumetric emission/absorption — not additive bloom',
      ],
    },
    stats: { scenario, inclination: incl, exposure, arms: STRUCTURE.uArms, pitchDeg: 12, Rmax: STRUCTURE.uRmax },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleGalaxyScene(recipe = {}, { title } = {}) {
  const plan = planGalaxyScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#00030a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} galaxy`,
    bg,
  };
}
