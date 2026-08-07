/**
 * comet-view — a comet on a real, highly eccentric Kepler orbit around the Sun, with a coma and two
 * tails that ALWAYS point away from the Sun (anti-solar) and BLOOM near perihelion. The "how the trail
 * is made" depictor: a sibling of orbit-view (same Kepler machinery, real-units readout) focused on the
 * tail mechanism rather than the orrery.
 *
 * Accurate where it teaches, artistic where it must:
 *   • true eccentric ellipse (Sun at a focus), sampled at uniform mean anomaly = uniform time, so
 *     walking the path at a constant rate reproduces Kepler's 2nd law (the comet whips through
 *     perihelion, crawls at aphelion) — which is exactly when the tail blooms and shrinks;
 *   • the readout shows REAL distance (AU), REAL speed (vis-viva, km/s), REAL period (Kepler's 3rd);
 *   • the ELLIPSE SHAPE is kept true (eccentricity is the point) and only scaled to fit one frame.
 *
 * The motion + tails ride emitThreeWorld's `comets` channel: the ion tail is straight anti-solar
 * (normalize(pos − sun)), the dust tail bends toward the trailing orbital direction (curves + lags),
 * both recomputed every frame so they keep reorienting as the comet moves.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'comet-view', scenario?, scale?, tails?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like orbit-view / atom-view) — no walk, no CSS-3D /scene form.
 */

import { TAU, DEG, clampNum, clamp } from '../../worlds/motion-vocabulary.js';

// ── the Sun is a real lit three.js sphere (emitThreeWorld's `planets` channel), not a lathe "onion":
// a self-luminous body at the focus that drops the system's point light. The channel builds the geometry
// at the ORIGIN and registers meshes['sun'] (userData.g='sun' → still pickable), same as orbit-view's star. ──
const hexRgb = (hex) => { const h = String(hex).replace('#', ''); return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]; };

// ── physical constants (km, s) ──
const AU_KM = 1.495978707e8;
const MU_SUN = 1.32712440018e11;   // km³/s²

// ── Kepler's equation: M = E − e·sinE → eccentric anomaly E (Newton). ──
function solveE(M, e) {
  let m = ((M % TAU) + TAU) % TAU;
  let E = e < 0.8 ? m : Math.PI;
  for (let i = 0; i < 24; i++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= d; if (Math.abs(d) < 1e-13) break;
  }
  return E;
}
const realPeriod = (aKm) => TAU * Math.sqrt((aKm * aKm * aKm) / MU_SUN);

// high-e perihelion needs dense sampling to stay smooth + seamless.
const N_SAMPLES = 360;
const R_PERI = 6;          // render distance at perihelion (the orbit + tails scale off this)
const PLAY = 16;           // playback seconds for one full orbit (the slow crawl / fast whip is intrinsic)

// ── scenarios: eccentricity is the knob. `aAU` only feeds the real period / distance readout. ──
const SCENARIOS = {
  classic: { e: 0.90, aAU: 3.0, name: 'Comet · e=0.90' },
  halley: { e: 0.967, aAU: 17.834, name: 'Halley-type · e=0.967' },
  sungrazer: { e: 0.985, aAU: 2.5, name: 'Sungrazer · e=0.985' },
};
export const COMET_SCENARIOS = Object.keys(SCENARIOS);

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));
const fmtPeriod = (sec) => { const d = sec / 86400; return d < 400 ? `${d.toFixed(0)} d` : `${(d / 365.25).toFixed(1)} yr`; };

/**
 * Resolve a recipe into placed Sun faces + the comet channel payload. Pure — no DB, no HTML.
 * Same recipe → identical faces + identical comet path.
 * @returns {{ faces, picks, comets, bounds, stats }}
 */
export function planCometScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'classic';
  const scale = clampNum(recipe.scale, 0.3, 4, 1);
  const tails = recipe.tails === false ? false : true;
  const S = SCENARIOS[scenario];
  const e = S.e;

  const peri = R_PERI * scale;          // render perihelion distance
  const aR = peri / (1 - e);            // render semi-major axis
  const aphe = aR * (1 + e);            // render aphelion distance
  const aKm = S.aAU * AU_KM;
  const realT = realPeriod(aKm);

  // sample the orbit at UNIFORM mean anomaly = uniform time → equal-dt closed loop. Perihelion (E=0)
  // sits at +x with the Sun at the origin focus; aphelion at −x.
  const path = [], dist = [], speed = [];
  for (let k = 0; k <= N_SAMPLES; k++) {
    const M = TAU * (k / N_SAMPLES);
    const E = solveE(M, e);
    const cosv = (Math.cos(E) - e) / (1 - e * Math.cos(E));
    const sinv = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
    const rr = aR * (1 - e * Math.cos(E));         // render distance from focus
    path.push([rr * cosv, rr * sinv, 0]);
    const rReal = aKm * (1 - e * Math.cos(E));
    dist.push(rReal / AU_KM);                       // AU
    speed.push(Math.sqrt(MU_SUN * (2 / rReal - 1 / aKm)));   // km/s (vis-viva)
  }

  // Sun at the focus (origin) — a self-luminous lit sphere that lights the system, static + pickable.
  const faces = [];
  const sunSize = 1.7 * scale;
  const planets = [{ group: 'sun', center: [0, 0, 0], radius: sunSize, tint: hexRgb('#ffce6b'), star: true, spin: 0.05, bands: 0, mottle: 0.08 }];
  const picks = [{ name: 'sun', kind: 'central', label: 'Sun', fields: compactFields([['role', 'central mass'], ['at', 'orbit focus']]) }];

  // tail lengths scale off the render perihelion distance.
  const comet = {
    path, period: PLAY, sun: [0, 0, 0],
    rPeri: peri, rAphe: aphe, sharp: 2.2,
    sunSize: sunSize * 2.4, sunColor: [255, 210, 110],
    nucleus: { size: 0.55 * scale, color: [240, 240, 220] },
    coma: { size: 2.2 * scale, color: [170, 215, 255] },
    ion: tails ? { count: 24, width: 0.55 * scale, maxLen: peri * 2.6, color: [120, 180, 255] } : { count: 0 },
    dust: tails ? { count: 18, width: 0.75 * scale, maxLen: peri * 1.7, curve: 0.6, color: [240, 210, 150] } : { count: 0 },
    dist, speed, distUnit: 'AU', speedUnit: 'km/s', name: S.name,
    track: true, trackColor: 0x39507a,
  };

  // bounds over the orbit (the tails extend ~anti-solar but the orbit dominates the framing).
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const c of path) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, 0];
  let radius = 0;
  for (const c of path) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1]));
  radius = radius || aR;

  return {
    faces, picks, planets, comets: [comet],
    bounds: { center, radius },
    stats: { scenario, e, period: fmtPeriod(realT), perihelionAU: +(aKm * (1 - e) / AU_KM).toFixed(3) },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Two cameras serve "path view + closeup view":
 * a wide `path` over the whole ellipse (primary), and a `closeup` framed on the perihelion arc + Sun
 * where the tail blooms and visibly reorients. Glow off (the comet channel does its own additive glow).
 */
export function assembleCometScene(recipe = {}, { title } = {}) {
  const plan = planCometScene(recipe);
  const { center, radius } = plan.bounds;
  const peri = plan.comets[0].rPeri;
  const d = radius * 2.3;
  const cameras = [
    { name: 'path', worldFraming: { cameraPosition: [center[0] + d * 0.2, center[1] - d * 0.85, d * 0.7], lookAt: center, horizontalFov: 46 } },
    { name: 'closeup', worldFraming: { cameraPosition: [peri * 0.6, -peri * 2.4, peri * 1.7], lookAt: [peri * 0.5, 0, 0], horizontalFov: 52 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05070f';
  return {
    faces: plan.faces,
    picks: plan.picks,
    planets: plan.planets,
    comets: plan.comets,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} comet`,
    bg,
    glow: false,
  };
}
