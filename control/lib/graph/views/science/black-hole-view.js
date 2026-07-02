/**
 * black-hole-view — a Schwarzschild black hole depicted with CONTEMPORARY physics: gravitational
 * lensing of an accretion disk (the Interstellar / EHT look), rendered by a per-pixel GENERAL-
 * RELATIVITY raymarcher. The mesh channels can't bend light, so this rides a new renderer mode — a
 * full-screen fragment shader that integrates photon GEODESICS through curved spacetime.
 *
 * The physics in the shader (units where the horizon radius Rs = 1):
 *   • Null geodesics via the exact Schwarzschild light-bending law  d²r/dλ² = −1.5·h²·r̂ / r⁵
 *     (h = |r × v| conserved) — this reproduces real gravitational lensing, the photon ring, and the
 *     Einstein-ring arcs (the disk's far side bent up and over / down and under the shadow). The march
 *     is ADAPTIVE (fine steps near the hole) so the thin photon ring resolves crisply.
 *   • Event horizon: rays reaching r < Rs are captured → the black SHADOW.
 *   • Accretion disk in the equatorial plane, SEMI-TRANSPARENT: each disk-plane crossing deposits
 *     emission and absorbs what's behind, so the lensed images (primary + the far side bent over/under)
 *     glow THROUGH each other instead of an opaque plate. Temperature rises inward (orange → blue-white).
 *   • Full relativistic colour: RELATIVISTIC DOPPLER BEAMING (the side orbiting toward you brighter +
 *     bluer) COMBINED with GRAVITATIONAL REDSHIFT (light climbing out of the well, √(1−Rs/r), dims +
 *     reddens — strongest at the inner edge). Brightness ∝ g³ with g = doppler · redshift.
 *   • A lensed background: a Milky-Way band + dust that visibly WARPS around the shadow (the ray
 *     directions are bent), the observational signature of lensing.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'black-hole-view', scenario?, inclination?, diskOut?, beta?, scale?, viewBox?,
 *     scene?:{ bg? }, title? }
 *
 * Orbit-only object study (drag to orbit the camera around the hole). No walk, no /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const DEG = Math.PI / 180;

// ── the GR raymarcher fragment shader (GLSL). Rs = 1; the disk lies in the y = 0 plane, spin axis y. ──
export const BLACK_HOLE_FRAG = `
precision highp float;
uniform vec3 uCamPos; uniform mat3 uCamBasis; uniform vec2 uRes; uniform float uTime;
uniform float uFov, uDiskIn, uDiskOut, uBeta;

float hash(vec3 p){ p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419)); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
// lensed background: a Milky-Way-like band + dust lanes + stars. Sampled with the BENT ray direction,
// so the band warps around the shadow — the visible signature of gravitational lensing.
vec3 galaxy(vec3 d){
  vec3 c = vec3(0.013, 0.015, 0.025);
  float band = exp(-pow(dot(normalize(d), normalize(vec3(0.18, 1.0, 0.12))), 2.0) * 5.5);
  float dust = hash(floor(d * 7.0));
  c += mix(vec3(0.07, 0.06, 0.09), vec3(0.11, 0.10, 0.07), dust) * band * 0.6;     // milky glow + dust lanes
  float s = hash(floor(d * 220.0));
  if (s > 0.990) { float b = (s - 0.990) / 0.010; c += vec3(0.9, 0.95, 1.0) * b * b * (0.6 + band); }
  return c;
}
// emission + opacity from a disk-plane crossing at hit. rgb = emission, a = how much it absorbs
// what's behind it (semi-transparent → lensed images layer). Colour = temperature × Doppler × redshift.
vec4 diskEmission(vec3 hit){
  float rr = length(hit.xz);
  float band = smoothstep(uDiskIn, uDiskIn * 1.12, rr) * smoothstep(uDiskOut, uDiskOut * 0.85, rr);
  if (band < 0.001) return vec4(0.0);
  float Tn = clamp((uDiskOut - rr) / (uDiskOut - uDiskIn), 0.0, 1.0);
  vec3 base = mix(vec3(1.0, 0.42, 0.10), vec3(0.82, 0.88, 1.0), Tn);                // orange → blue-white
  vec3 tang = normalize(cross(vec3(0.0, 1.0, 0.0), normalize(vec3(hit.x, 0.0, hit.z))));
  vec3 toCam = normalize(uCamPos - hit);
  float dopp = 1.0 / max(0.25, 1.0 - uBeta * sqrt(uDiskIn / max(rr, uDiskIn)) * dot(tang, toCam));  // Doppler
  float grav = sqrt(max(0.0, 1.0 - 1.0 / rr));                                       // gravitational redshift √(1−Rs/r)
  float g = dopp * grav;                                                             // total observed/emitted ratio
  float turb = 0.7 + 0.55 * hash(vec3(floor(rr * 3.0), floor(atan(hit.z, hit.x) * 6.0 + uTime * (4.5 / max(rr, 1.0))), 1.0));
  vec3 col = base * (0.5 + 0.9 * Tn) * pow(g, 3.0) * turb;                           // beaming + redshift dimming (g³)
  col *= mix(vec3(1.3, 0.82, 0.66), vec3(0.8, 0.9, 1.45), clamp(g - 0.6, 0.0, 1.0));  // red when g<1, blue when g>1
  return vec4(col, band * clamp(0.32 + 0.55 * Tn, 0.0, 0.92));
}
void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
  float tanf = tan(uFov * 0.5);
  vec3 dir = normalize(uCamBasis * vec3(uv.x * tanf, uv.y * tanf, 1.0));
  vec3 pos = uCamPos, vel = dir, prev = pos;
  float h2 = dot(cross(pos, vel), cross(pos, vel));   // |angular momentum|², conserved along the geodesic
  vec3 acc = vec3(0.0); float trans = 1.0; int fate = 0;   // accumulated disk emission; fate 1 = horizon
  for (int i = 0; i < 300; i++) {
    float r2 = dot(pos, pos), r = sqrt(r2);
    if (r < 1.0) { fate = 1; break; }                              // captured by the horizon → shadow behind
    if (r > 48.0) { fate = 0; break; }                            // escaped → lensed background behind
    if (prev.y * pos.y < 0.0) {                                   // disk-plane crossing (semi-transparent)
      float t = prev.y / (prev.y - pos.y); vec4 em = diskEmission(mix(prev, pos, t));
      acc += trans * em.rgb; trans *= (1.0 - em.a);               // layer the lensed images
    }
    float dt = clamp(0.035 * r, 0.05, 0.5);                       // adaptive: fine near the hole (crisp ring), coarse far
    prev = pos; vel += (-1.5 * h2 * pos / (r2 * r2 * r)) * dt; pos += vel * dt;   // exact light bending
    if (trans < 0.02) break;                                      // fully absorbed
  }
  vec3 bg = (fate == 1) ? vec3(0.0) : galaxy(normalize(vel));
  vec3 outc = acc + trans * bg;
  outc = outc / (outc + vec3(1.0));                               // Reinhard tone-map the bright beamed side
  outc = pow(outc, vec3(0.82));
  gl_FragColor = vec4(outc, 1.0);
}
`;

// camera distance from the hole (Rs units) — far enough to frame the shadow + disk.
const CAM_DIST = 17;

// presets: the two iconic contemporary looks, distinguished by viewing inclination.
const SCENARIOS = {
  interstellar: { inclination: 8, diskIn: 2.4, diskOut: 12, beta: 0.46, fov: 46 },   // near edge-on → the over/under lensed arcs
  eht: { inclination: 52, diskIn: 2.7, diskOut: 8, beta: 0.5, fov: 42 },             // fairly face-on → the photon-ring shadow
};

export const BLACK_HOLE_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planBlackHoleScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'interstellar';
  const s = SCENARIOS[scenario];
  const incl = clampNum(recipe.inclination, 1, 89, s.inclination);
  const diskOut = clampNum(recipe.diskOut, 5, 20, s.diskOut);
  const beta = clampNum(recipe.beta, 0.1, 0.85, s.beta);
  const el = incl * DEG;
  const cameraStart = [0, CAM_DIST * Math.sin(el), CAM_DIST * Math.cos(el)];

  return {
    raymarch: {
      frag: BLACK_HOLE_FRAG,
      customUniforms: { uDiskIn: s.diskIn, uDiskOut: diskOut, uBeta: beta },
      cameraStart, target: [0, 0, 0], fov: s.fov,
      readout: ['Schwarzschild black hole', 'event horizon = the shadow (r = Rs)', 'photon ring at 1.5 Rs (light orbits the hole)',
        'disk: Doppler beaming + gravitational redshift (g³)', 'far side lensed over & under · background warps around the shadow'],
    },
    stats: { scenario, inclination: incl, diskIn: s.diskIn, diskOut, beta },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleBlackHoleScene(recipe = {}, { title } = {}) {
  const plan = planBlackHoleScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#01010a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} black hole`,
    bg,
  };
}
