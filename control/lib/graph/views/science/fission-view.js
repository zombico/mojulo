/**
 * fission-view — NUCLEAR FISSION, the single event, ray-marched. A compound nucleus (U-236, having just
 * absorbed a neutron) elongates along the Bohr–Wheeler fission coordinate, necks, and CLEAVES into two
 * fragments that fly apart under Coulomb repulsion, throwing off a few prompt neutrons and a gamma flash.
 *
 * Roadmap (raymarch-science-roadmap.plan.md) Category-3 "topology change", Tier-2 #6, `[transformative]`:
 * one blob becoming two is exactly what a mesh CANNOT do without tearing, and what an SDF/metaball
 * density field re-topologizes for free. The sibling of wavepacket-view (volume + time) — it is the
 * second time-evolving consumer of the volume-raymarch scaffold (volume-raymarch.js), and the first
 * consumer of the shared SDF snippets (sdf-glsl.js).
 *
 * The whole event lives in ONE time-dependent density field — no discrete bodies — so the depiction is
 * self-contained in the volume shader (the CHAIN-REACTION cascade is the separate mesh-based view):
 *   • the nucleus  — smin(ellipsoid_heavy, ellipsoid_light): separation grows + smin width shrinks as the
 *                    fission coordinate ξ advances, so one fused blob necks and pinches into two.
 *   • the neck     — strain heat concentrated at the waist, windowed to just before scission (warm→white).
 *   • the neutrons — a few small fast bright Gaussian blobs launched radially at scission (glow).
 *   • the flash    — a brief central gamma brighten at the instant of scission.
 *
 * Frame: the fission axis is +x; ξ loops off uTime so the event replays. Orbit-only object study (drag
 * to orbit), no walk, no /scene form. Stored manifest IS the recipe:
 *   { kind:'fission-view', asymmetry?, density?, viewBox?, scene?:{ bg? }, title? }
 */

import { buildVolumeFrag } from '@/lib/graph/effects/volume-raymarch';
import { SDF_GLSL } from '@/lib/graph/effects/sdf-glsl';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── the time-dependent fission field (the only per-view GLSL; the scaffold does ray-vs-bounds + march) ──
const FISSION_GLOBALS = `
uniform float uRmax; uniform float uDens; uniform float uAsym;
const float P_FISS = 9.0;          // loop period (seconds) — a slow, watchable event
const float XI_SCISSION = 0.55;    // fission coordinate at the moment the neck snaps

// returns vec2( sdf , strain ): the deforming nucleus distance field + neck-strain heat at point p.
vec2 fissionField(vec3 p, float xi){
  // asymmetric mass split (Ba/Kr-like by default): heavy + light fragment, radius ∝ mass^(1/3).
  float heavyFrac = mix(0.5, 0.62, uAsym), lightFrac = 1.0 - heavyFrac;
  float base = uRmax * 0.30;
  float rH = base * pow(heavyFrac / 0.5, 1.0 / 3.0);
  float rL = base * pow(lightFrac / 0.5, 1.0 / 3.0);

  // separation: gentle deformation before the saddle, fast Coulomb fly-apart after scission (clamped to
  // stay inside the bounding sphere). Momentum conservation: the LIGHT fragment recoils farther.
  float pre  = smoothstep(0.10, XI_SCISSION, xi);
  float post = max(xi - XI_SCISSION, 0.0);
  float sep  = base * 0.55 * pre + min(post * uRmax * 1.9, uRmax * 0.6);
  float cH = -sep * lightFrac;       // heavy fragment centre
  float cL =  sep * heavyFrac;       // light fragment centre (moves farther)

  // prolate elongation: peaks at the neck, relaxes back to round after scission.
  float elong = pre * (1.0 - smoothstep(XI_SCISSION, XI_SCISSION + 0.12, xi));
  vec3 rHv = vec3(rH * (1.0 + 0.45 * elong), rH * (1.0 - 0.18 * elong), rH * (1.0 - 0.18 * elong));
  vec3 rLv = vec3(rL * (1.0 + 0.45 * elong), rL * (1.0 - 0.18 * elong), rL * (1.0 - 0.18 * elong));

  float dH = sdfEllipsoid(p - vec3(cH, 0.0, 0.0), rHv);
  float dL = sdfEllipsoid(p - vec3(cL, 0.0, 0.0), rLv);

  // smin width: large early (one fused blob) → tiny by scission (a sharp neck pinch).
  float kb = mix(base * 0.9, base * 0.05, pre);
  float d = sdfSmin(dH, dL, kb);

  // neck strain: heat at the waist (x≈0, near the axis), windowed to just before the snap.
  float neckWin = smoothstep(0.15, XI_SCISSION, xi) * (1.0 - smoothstep(XI_SCISSION, XI_SCISSION + 0.05, xi));
  float strain = exp(-(p.x * p.x) / (2.0 * pow(base * 0.5, 2.0)))
               * exp(-(p.y * p.y + p.z * p.z) / (2.0 * pow(base * 0.45, 2.0))) * neckWin;
  return vec2(d, strain);
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  float xi = fract(uTime / P_FISS);
  // fade the field in at the start and out before the wrap, so the loop reset is seamless.
  float env = smoothstep(0.0, 0.06, xi) * (1.0 - smoothstep(0.90, 1.0, xi));

  vec2 f = fissionField(p, xi);
  float shellW = uRmax * 0.05;
  float dens = smoothstep(shellW, -shellW, f.x) * uDens * env;   // filled, soft-surfaced nuclear matter

  vec3 coreHot = vec3(1.0, 0.55, 0.22), strainHot = vec3(1.0, 0.95, 0.72);
  vec3 tint = mix(coreHot, strainHot, clamp(f.y, 0.0, 1.0));
  emis = tint * dens * (0.7 + min(dens, 2.0) * 0.5);
  ext  = vec3(dens * 4.0);

  // prompt neutrons: 3 small fast bright blobs launched radially from the scission point (~origin).
  float post = max(xi - XI_SCISSION, 0.0);
  if (post > 0.0) {
    float nfade = 1.0 - smoothstep(0.88, 1.0, xi);
    for (int i = 0; i < 3; i++) {
      float a = float(i) * 2.0944 + 0.6;                        // ~120° apart, off the fission axis
      vec3 dir = normalize(vec3(cos(a) * 0.7, sin(a), cos(a * 1.7) * 0.5));
      vec3 sc  = dir * min(post * uRmax * 2.0, uRmax * 0.95);
      float g  = exp(-dot(p - sc, p - sc) / (2.0 * pow(uRmax * 0.06, 2.0)));
      emis += vec3(0.6, 0.8, 1.0) * g * 3.0 * uDens * nfade;
      ext  += vec3(g * 0.6 * uDens * nfade);
    }
  }

  // gamma flash: a brief, COMPACT spark at the waist (~origin) at the instant of scission — tight in
  // both time and space so it punctuates the snap without washing out the neck pinch itself.
  float flash = exp(-pow((xi - XI_SCISSION) / 0.022, 2.0))
              * exp(-dot(p, p) / (2.0 * pow(uRmax * 0.18, 2.0)));
  emis += vec3(1.0, 0.95, 0.85) * flash * 0.8;
}
`;

export const FISSION_FRAG = buildVolumeFrag({
  uniforms: [],                       // all declared in FISSION_GLOBALS
  globals: SDF_GLSL + FISSION_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 104,
  tonemap: 'aces',                    // ACES toe keeps the void black, shoulder rolls off the flash core
  exposureUniform: null,
  jitter: true,
  gamma: 2.2,
});

const RMAX = 10;
const CAM_DIST = 26;                  // frames the whole event (fragments fly to ~0.6·Rmax, neutrons to the shell)

const READOUT = [
  'Nuclear fission — liquid-drop model (Bohr–Wheeler)',
  'U-236* elongates, necks, and CLEAVES into two fragments',
  'the neck strains hot, then snaps at scission (the gamma flash)',
  'fragments fly apart (Coulomb); prompt neutrons escape — the chain-reaction seed',
];

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planFissionScene(recipe = {}) {
  const asymmetry = clampNum(recipe.asymmetry, 0, 1, 1);   // 1 = realistic asymmetric split, 0 = symmetric
  const density = clampNum(recipe.density, 1, 30, 6);
  return {
    raymarch: {
      frag: FISSION_FRAG,
      customUniforms: { uRmax: RMAX, uDens: density, uAsym: asymmetry },
      cameraStart: [0, CAM_DIST * 0.28, CAM_DIST * 0.96], target: [0, 0, 0], fov: 44,
      readout: READOUT,
    },
    stats: { asymmetry, density, render: 'volumetric liquid-drop fission (ray-marched, time-evolving)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleFissionScene(recipe = {}, { title } = {}) {
  const plan = planFissionScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05040a';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || 'mojulo nuclear fission',
    bg,
  };
}
