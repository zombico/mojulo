/**
 * wavepacket-view — QUANTUM WAVEPACKET DYNAMICS: a volumetric `|ψ(x,t)|²` probability cloud EVOLVING IN
 * TIME, ray-marched. Roadmap Tier-1 #1 — "volume + time, impossible as a surface, the clearest way to
 * SEE quantum behaviour. Reuses the orbital shader's machinery with a time-dependent ψ." The sibling of
 * atom-view's static `|ψ|²` orbital cloud, but the field now moves: it's the first consumer of the
 * reusable volume-raymarch scaffold (volume-raymarch.js / volume-raymarch.plan.md).
 *
 * Every scenario is a CLOSED-FORM `ψ(x,t)` — evaluable per-fragment at `uTime`, no in-shader time-
 * stepping. Opacity is `|ψ|²` (the probability envelope); colour is the SIGN of Re ψ (warm +, cool −),
 * exactly atom-view's phase palette, so the internal carrier oscillation streaks through the cloud.
 *
 *   • free     — a Gaussian packet travelling +x and SPREADING as it goes (dispersion made visible).
 *   • coherent — a harmonic-oscillator COHERENT STATE: a non-spreading Gaussian sloshing on x=A·cos ωt
 *                (the carrier vanishes at the turning points, where momentum is zero — "the most
 *                classical quantum state").
 *   • box      — a particle-in-a-box TWO-STATE superposition (n=1 + n=2): `|ψ|²` sloshes wall to wall,
 *                beating at (E₂−E₁)/ħ — quantum beats.
 *
 * Frame: the packet lives in the box; spin/travel axis is +x. Orbit-only object study (drag to orbit),
 * no walk, no /scene form. Stored manifest IS the recipe:
 *   { kind:'wavepacket-view', scenario?, density?, viewBox?, scene?:{ bg? }, title? }
 */

import { buildVolumeFrag } from '@/lib/graph/volume-raymarch';

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── the time-dependent |ψ(x,t)|² transfer function (the only per-view GLSL; the scaffold does the rest) ──
const WAVE_GLOBALS = `
uniform float uRmax; uniform float uDens; uniform int uScenario;
const float PI = 3.14159265;

// returns vec2( env = |ψ| ≥ 0 ,  re = signed Re ψ ) at world point p and time uTime.
vec2 wave(vec3 p){
  float t = uTime;
  if (uScenario == 0) {
    // FREE Gaussian packet: travels +x and DISPERSES (σ grows with time since launch); loops.
    float L = uRmax * 0.8, P = 6.0;
    float ph = fract(t / P);
    float xc = mix(-L, L, ph);
    float tau = ph * P;                                  // time since launch
    float s0 = uRmax * 0.10;
    float sx = s0 * sqrt(1.0 + (tau * 0.5) * (tau * 0.5)); // dispersive width along travel
    float dx = p.x - xc, rp2 = p.y * p.y + p.z * p.z;
    float env = (s0 / sx) * exp(-dx * dx / (2.0 * sx * sx) - rp2 / (2.0 * s0 * s0));
    float k = 6.0;                                       // carrier → visible motion of crests
    return vec2(env, env * cos(k * dx - 0.5 * k * k * t));
  }
  if (uScenario == 1) {
    // COHERENT state: fixed-width Gaussian sloshing in a harmonic trap, xc = A cos(ωt).
    float A = uRmax * 0.6, w = 1.2;
    float xc = A * cos(w * t), s0 = uRmax * 0.13;
    vec3 d = vec3(p.x - xc, p.y, p.z);
    float env = exp(-dot(d, d) / (2.0 * s0 * s0));
    float kc = -A * w * sin(w * t) * 1.6;               // local momentum → 0 at the turning points
    return vec2(env, env * cos(kc * (p.x - xc)));
  }
  // BOX: infinite-well (n=1 + n=2) superposition; |ψ|² sloshes wall-to-wall (quantum beats).
  float Lw = uRmax * 1.4;
  float xn = p.x / Lw + 0.5;                             // 0..1 across the well
  if (xn <= 0.0 || xn >= 1.0) return vec2(0.0);
  float f1 = sin(PI * xn), f2 = sin(2.0 * PI * xn);
  float E1 = 1.0, E2 = 4.0;                              // E_n ∝ n²
  float re = (f1 * cos(E1 * t) + f2 * cos(E2 * t)) * 0.70710678;
  float dens2 = 0.5 * (f1 * f1 + f2 * f2 + 2.0 * f1 * f2 * cos((E2 - E1) * t));
  float sb = uRmax * 0.28;
  float beam = exp(-(p.y * p.y + p.z * p.z) / (2.0 * sb * sb));  // confine to a finite 3-D beam
  return vec2(sqrt(max(dens2, 0.0)) * beam, re * beam);
}

void volSample(vec3 p, out vec3 emis, out vec3 ext){
  vec2 w = wave(p);
  float d = w.x * w.x * uDens;                           // |ψ|² → opacity
  vec3 tint = w.y >= 0.0 ? vec3(1.0, 0.5, 0.28) : vec3(0.3, 0.62, 1.0);  // +Re ψ warm · −Re ψ cool (phase)
  emis = tint * d * (0.7 + min(d, 2.0) * 0.5);
  ext  = vec3(d * 4.0);                                  // self-occlusion (grey → alpha-style absorption)
}
`;

export const WAVEPACKET_FRAG = buildVolumeFrag({
  uniforms: [],                       // all declared in WAVE_GLOBALS
  globals: WAVE_GLOBALS,
  boundsRadius: 'uRmax',
  steps: 110,
  tonemap: 'reinhard',                // matches atom-view's orbital aesthetic (preserves warm/cool hues)
  exposureUniform: null,
  jitter: true,
  gamma: 2.2,
});

// camera distance from the box centre — frames the whole bounding sphere.
const CAM_DIST = 22;
const RMAX = 10;

// scenarios distinguished by the closed-form ψ(x,t); structure (RMAX) is shared.
const SCENARIOS = {
  free: {
    idx: 0, dens: 7,
    readout: ['Free Gaussian wavepacket — |ψ(x,t)|²', 'travels +x at the group velocity',
      'DISPERSION: the packet spreads as it goes (σ grows with t)', 'warm = +Re ψ · cool = −Re ψ (the carrier under the envelope)'],
  },
  coherent: {
    idx: 1, dens: 6,
    readout: ['Harmonic-oscillator coherent state — |ψ(x,t)|²', 'a non-spreading Gaussian sloshing on x = A·cos ωt',
      'carrier vanishes at the turning points (momentum = 0)', '"the most classical quantum state" — the bridge to classical motion'],
  },
  box: {
    idx: 2, dens: 9,
    readout: ['Particle in a box — (n=1)+(n=2) superposition', '|ψ|² sloshes wall to wall',
      'quantum BEATS at frequency (E₂−E₁)/ħ', 'density vanishes at the walls (the infinite well)'],
  },
};

export const WAVEPACKET_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into the raymarcher payload (shader + uniforms + camera). Pure — no DB, no HTML.
 * @returns {{ raymarch, stats }}
 */
export function planWavepacketScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'free';
  const s = SCENARIOS[scenario];
  const density = clampNum(recipe.density, 1, 30, s.dens);
  return {
    raymarch: {
      frag: WAVEPACKET_FRAG,
      customUniforms: { uRmax: RMAX, uDens: density, uScenario: s.idx },
      cameraStart: [0, CAM_DIST * 0.3, CAM_DIST * 0.95], target: [0, 0, 0], fov: 42,
      readout: s.readout,
    },
    stats: { scenario, density, render: 'volumetric |ψ(x,t)|² (ray-marched, time-evolving)' },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. emitThreeWorld early-returns to the raymarcher
 * emitter when it sees `raymarch`.
 */
export function assembleWavepacketScene(recipe = {}, { title } = {}) {
  const plan = planWavepacketScene(recipe);
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#04050d';
  return {
    raymarch: plan.raymarch,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} wavepacket`,
    bg,
  };
}
