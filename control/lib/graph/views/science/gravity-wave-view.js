/**
 * gravity-wave-view — a SPACETIME MEMBRANE rippling under a compact-binary INSPIRAL, rendered in the
 * traversable three.js World. The Einsteinian sibling of ocean-view: where the ocean rides a Gerstner
 * waveform sequence, this rides a GRAVITATIONAL-WAVE STRAIN field — the quadrupole radiation of two
 * masses spiralling together. The same surface channel (a grid mesh deformed every frame), a new mode.
 *
 * The physics kept honest (leading-order post-Newtonian, the textbook chirp):
 *   • the binary loses energy to gravitational radiation, so the orbital frequency RISES toward merger
 *     — f_orb(τ) ∝ (1 − a·τ)^(−3/8), the "chirp", and the separation shrinks a(τ) ∝ f_orb^(−2/3);
 *   • the radiated strain is a rotating QUADRUPOLE — two-armed (the cos(2ψ) lobes), propagating outward
 *     at the wave speed (retarded time t − r/v), so the membrane shows a two-armed SPIRAL of ripples;
 *   • the strain amplitude grows as f^(2/3) through inspiral, peaks at merger, then RINGS DOWN
 *     (exp decay) as the remnant settles — and that quiet ringdown hides the loop seam.
 * Render scale is artistic (a watchable few-second chirp), the readout is physical (chirp mass, the
 * GW frequency sweeping up in Hz, the inspiral → merger → ringdown state).
 *
 * The motion rides emitThreeWorld's SURFACE channel in `gw` mode (scene-three.js): a grid mesh whose
 * height = the GW strain, plus the two inspiralling bodies (and the merged remnant) carried in-script.
 *
 * Stored manifest IS the recipe (geometry regenerated on render, ~nothing stored):
 *   { kind:'gravity-wave-view', scenario?, amplitude?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like ocean-view / orbit-view) — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── tiny face helpers (the `ring` scenario draws discrete masses; the membrane scenarios use surfaces) ──
const _sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const _add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const _sV = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const _cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const _len = (a) => Math.hypot(a[0], a[1], a[2]);
const _norm = (a) => { const l = _len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const _quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function _box(c, h, fill, group, alpha) {
  const v = (sx, sy, sz) => [c[0] + sx * h, c[1] + sy * h, c[2] + sz * h];
  return [
    _quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha),
    _quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),
    _quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),
    _quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha),
  ];
}
function _ribbon(a, b, w, fill, group, alpha) {
  const d = _sub(b, a); let p = _cross(d, [0, 0, 1]); if (_len(p) < 1e-3) p = _cross(d, [0, 1, 0]);
  p = _sV(_norm(p), w); return _quad([_add(a, p), _add(b, p), _sub(b, p), _sub(a, p)], fill, group, alpha);
}

/**
 * The `ring` scenario: a ring of free TEST MASSES (what a wave does to MATTER, the companion to the
 * membrane's "what it does to spacetime"). An inspiral radiates a ROTATING quadrupole, so the strain is
 * plus + cross in quadrature — the ring's ellipse rotates and each mass traces a small circle. Built on
 * the deform channel (a general linear map on the ring group), NOT the surface channel.
 */
function planRingScene(recipe, scale) {
  const amp = clampNum(recipe.amplitude, 0.05, 0.6, 0.3);   // dimensionless strain (exaggerated to read)
  const period = clampNum(recipe.period, 1.5, 8, 4);        // seconds per GW cycle (render-time, artistic)
  const R = 10 * scale, N = 24;
  const pts = Array.from({ length: N }, (_, k) => { const t = (k / N) * TAU; return [Math.cos(t) * R, Math.sin(t) * R, 0]; });

  const faces = [];
  faces.push(_ribbon([-R * 1.4, 0, 0], [R * 1.4, 0, 0], 0.05 * scale, '#3a4560', 'gwaxes', 0.3));
  faces.push(_ribbon([0, -R * 1.4, 0], [0, R * 1.4, 0], 0.05 * scale, '#3a4560', 'gwaxes', 0.3));
  for (let i = 0; i < N; i++) faces.push(_ribbon(pts[i], pts[(i + 1) % N], 0.04 * scale, '#39456a', 'gwrest', 0.3));
  for (let i = 0; i < N; i++) faces.push(_ribbon(pts[i], pts[(i + 1) % N], 0.09 * scale, '#7bd6e8', 'gwring', 0.85));
  for (const p of pts) faces.push(..._box(p, 0.55 * scale, '#ffd36a', 'gwring'));
  faces.push(..._box([0, 0, 0], 0.4 * scale, '#9aa3b8', 'gwcenter'));

  // rotating quadrupole: h₊ = amp·cos(ωt), h× = amp·sin(ωt) → plus·(sin+π/2) + cross·sin.
  const deforms = [{
    group: 'gwring', mode: 'wave', pivot: [0, 0, 0],
    terms: [
      { basis: [[1, 0], [0, -1]], amp, period, phase: Math.PI / 2 },
      { basis: [[0, 1], [1, 0]], amp, period, phase: 0 },
    ],
  }];

  const fields = [{ animate: false, sets: [], lines: [], readout: [
    'Gravitational wave — a ring of free test masses (the effect on MATTER)',
    'an inspiral radiates a ROTATING quadrupole: h₊ and h× in quadrature',
    `strain ≈ ${amp.toFixed(2)} (exaggerated) · period ${period.toFixed(1)} s · the ellipse ROTATES`,
    'each mass traces a small circle — the faint ring is the unstrained rest state',
  ] }];

  return {
    faces, deforms, fields,
    bounds: { center: [0, 0, 0], radius: R * 1.6 },
    stats: { scenario: 'ring', strain: amp, period, masses: N },
  };
}

// spacetime palette (0..1 rgb), a DIVERGING strain map: a wave TROUGH (compression) → the rest sheet
// → a wave CREST (stretch). The renderer colours by the ripple SIGN (z minus the static well), so the
// two-armed spiral alternates cool-indigo / bright-cyan against a visible navy rest state — the
// standard +/− strain look, and far more contrast than a one-sided height ramp. The rest sheet is kept
// bright enough to read as a lit membrane against the void; the crest near-white so the arms glow.
const DEEP = [0.05, 0.10, 0.42], SHEET = [0.09, 0.14, 0.32], CREST = [0.82, 0.96, 1.0];

// the chirp shape, shared by every scenario: the binary is at separation `sep0` at τ=0 and coalesces
// at τ=tauMerge; CHIRP_CLOSE is how far the dimensionless time-to-merger term (1 − a·τ) has collapsed
// by then (→ a steep frequency sweep at the end). tauRing is the ringdown e-fold (in τ).
const TAU_MERGE = 0.82;
const CHIRP_CLOSE = 0.985;     // 1 − a·tauMerge → u_merge = 0.015
const TAU_RING = 0.05;

// chirp mass Mc = (m1 m2)^{3/5} / (m1+m2)^{1/5} — the single mass combo the inspiral waveform depends on.
const chirpMass = (m1, m2) => Math.pow(m1 * m2, 0.6) / Math.pow(m1 + m2, 0.2);

// ── scenario presets. Physical masses (solar) drive the readout; the render knobs (cycles, tLoop, amp0,
// well, sep0, vWave, body radii) are tuned for a legible few-second chirp. f0Hz is the GW frequency at
// the START of the loop's band; it sweeps up by f(τ)/f0 toward merger in the readout. ──
const SCENARIOS = {
  // two ~30 M☉ stellar black holes — a long, gentle, many-cycle inspiral.
  inspiral: { m1: 30, m2: 30, cycles: 8, tLoop: 14, amp0: 3.2, well: 5.0, sep0: 36, vWave: 42, f0Hz: 20, r1: 1.5, r2: 1.5 },
  // GW150914-like (36 + 29 M☉) — fewer cycles, a violent high-amplitude merger.
  merger: { m1: 36, m2: 29, cycles: 6, tLoop: 10, amp0: 4.4, well: 6.0, sep0: 38, vWave: 48, f0Hz: 35, r1: 1.7, r2: 1.5 },
  // a binary NEUTRON STAR (1.4 + 1.35 M☉) — a long, high-frequency, low-amplitude inspiral.
  'neutron-stars': { m1: 1.4, m2: 1.35, cycles: 15, tLoop: 16, amp0: 2.2, well: 3.2, sep0: 34, vWave: 40, f0Hz: 80, r1: 1.0, r2: 1.0 },
  // an EXTREME mass ratio (10^6 M☉ massive BH + 30 M☉ companion) — the heavy primary sits at the
  // centre while the small body spirals in (the LISA band: a very low absolute GW frequency).
  'extreme-mass-ratio': { m1: 1e6, m2: 30, cycles: 11, tLoop: 15, amp0: 2.6, well: 7.0, sep0: 32, vWave: 44, f0Hz: 0.6, r1: 3.0, r2: 0.7 },
};

// `ring` is a distinct render path (deform channel, discrete masses) rather than a binary preset.
export const GRAVITY_WAVE_SCENARIOS = [...Object.keys(SCENARIOS), 'ring'];

// body tints: the heavier body warmer, the lighter cooler; the merged remnant a hot white-gold.
const C1 = 0x9fb8ff, C2 = 0xffd27a, C_REMNANT = 0xfff4d6;

/**
 * Resolve a scenario + knobs into the `gw` descriptor the surface channel consumes (all render units).
 * The closed-form chirp constants (phiCoef, ringRate, aChirp) are precomputed here so the in-page step
 * function is cheap. Pure — same inputs → identical descriptor.
 */
function buildGwDescriptor(scenario, scale, amplitude) {
  const s = SCENARIOS[scenario];
  const aChirp = CHIRP_CLOSE / TAU_MERGE;             // 1 − aChirp·tauMerge = 1 − CHIRP_CLOSE
  const uMerge = 1 - CHIRP_CLOSE;                     // 0.015
  // total accumulated orbital phase over the inspiral = phiCoef · (1 − u^{5/8}); pick phiCoef so the
  // inspiral shows `cycles` orbital revolutions (each → two GW wave-crests, the quadrupole factor 2).
  const phiCoef = (TAU * s.cycles) / (1 - Math.pow(uMerge, 0.625));
  // 2π f0 tLoop, the ringdown phase rate (orbital phase continues linearly after merger at f_merge).
  const ringRate = (phiCoef * 5 * aChirp) / 8;
  const amp0 = s.amp0 * scale * amplitude;
  const well = s.well * scale * amplitude;
  // colour-normalisation height: scaled to the BASE ripple (≈ amp0), NOT the static well or the merger
  // peak — otherwise the well swamps the ramp and the whole sheet sits at one mid-tone. Tuned low so the
  // spiral arms swing across the full palette through inspiral and SATURATE (a bright flash) at merger.
  const amax = amp0 * 0.8;
  const M = s.m1 + s.m2;
  return {
    tLoop: s.tLoop, tauMerge: TAU_MERGE, aChirp, phiCoef, ringRate, tauRing: TAU_RING,
    sep0: s.sep0 * scale, vWave: s.vWave * scale, amp0, well, r0: 0.32 * 130 * scale,
    r1: s.r1 * scale, r2: s.r2 * scale, c1: C1, c2: C2, cRemnant: C_REMNANT,
    frac1: s.m2 / M, frac2: s.m1 / M,                 // orbit-radius fractions (light body swings wider)
    fGwHz: s.f0Hz, chirpMassMsun: +chirpMass(s.m1, s.m2).toFixed(s.m1 >= 1e3 ? 0 : 2),
    m1: s.m1, m2: s.m2, amax,
  };
}

/**
 * The pure chirp state at render time `t` (seconds) — the single source of truth for the inspiral
 * physics, MIRRORED by the inline `_gwphase` in scene-three.js's surface channel. Exported so the
 * physics is testable in Node and reusable by other views. Returns { tau, fr, phi, sep, amp, merged }
 * where `fr` = f_orb/f0, `phi` = accumulated orbital phase, `sep` = binary separation (render units),
 * `amp` = strain amplitude, `merged` = past the merger.
 */
export function gwState(g, t) {
  let tau = (t % g.tLoop) / g.tLoop;
  if (tau < 0) tau += 1;
  const tm = g.tauMerge, a = g.aChirp;
  if (tau < tm) {
    const u = Math.max(1e-4, 1 - a * tau);
    const fr = Math.pow(u, -0.375);
    return {
      tau, fr,
      phi: g.phiCoef * (1 - Math.pow(u, 0.625)),
      sep: g.sep0 * Math.pow(u, 0.25),
      amp: g.amp0 * Math.pow(fr, 2 / 3) * Math.min(1, tau / 0.06),   // fade-in window hides the τ=0 seam
      merged: false,
    };
  }
  const um = Math.max(1e-4, 1 - a * tm), frm = Math.pow(um, -0.375);
  const k = (tau - tm) / (1 - tm);
  return {
    tau, fr: frm,
    phi: g.phiCoef * (1 - Math.pow(um, 0.625)) + g.ringRate * frm * (tau - tm),
    sep: g.sep0 * Math.pow(um, 0.25) * Math.max(0, 1 - k),
    amp: g.amp0 * Math.pow(frm, 2 / 3) * Math.exp(-(tau - tm) / g.tauRing),   // ringdown decay → quiet seam
    merged: true,
  };
}

/**
 * Resolve a recipe into the surface channel payload. Pure — no DB, no HTML. One surface in `gw` mode
 * (the strain membrane + the inspiralling binary). Same recipe → identical descriptor.
 * @returns {{ surfaces, bounds, stats }}
 */
export function planGravityWaveScene(recipe = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  if (recipe.scenario === 'ring') return planRingScene(recipe, scale);
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'inspiral';
  const amplitude = clampNum(recipe.amplitude, 0.1, 4, 1);
  const gw = buildGwDescriptor(scenario, scale, amplitude);

  const w = 130 * scale, d = 130 * scale, nx = 84, ny = 84;
  const surface = {
    grid: { w, d, nx, ny },
    gw,
    amax: gw.amax, deep: DEEP, surf: SHEET, crest: CREST,
    sun: [50 * scale, -60 * scale, 120 * scale],
  };

  return {
    surfaces: [surface],
    bounds: { center: [0, 0, 0], radius: Math.hypot(w / 2, d / 2) },
    stats: {
      scenario, cycles: SCENARIOS[scenario].cycles,
      chirpMassMsun: gw.chirpMassMsun, peakFreqMult: +Math.pow(1 - CHIRP_CLOSE, -0.375).toFixed(2),
      tLoop: gw.tLoop,
    },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a low 3/4 camera that catches the ripples in
 * relief + a top-down camera that reveals the two-armed spiral. Deep-space background.
 */
export function assembleGravityWaveScene(recipe = {}, { title } = {}) {
  const plan = planGravityWaveScene(recipe);
  const d = plan.bounds.radius;
  const isRing = plan.stats.scenario === 'ring';
  // the ring reads best top-down (the rotating ellipse); the membrane reads best in low-angle relief.
  const cameras = isRing
    ? [{ name: 'top', worldFraming: { cameraPosition: [d * 0.12, -d * 0.3, d * 2.4], lookAt: [0, 0, 0], horizontalFov: 46 } }]
    : [
        { name: '3/4', worldFraming: { cameraPosition: [d * 0.15, -d * 0.95, d * 0.62], lookAt: [0, 0, 0], horizontalFov: 54 } },
        { name: 'top', worldFraming: { cameraPosition: [0, -d * 0.02, d * 1.5], lookAt: [0, 0, 0], horizontalFov: 50 } },
      ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05060f';
  return {
    faces: plan.faces || [],
    ...(plan.surfaces ? { surfaces: plan.surfaces } : {}),
    ...(plan.deforms ? { deforms: plan.deforms } : {}),
    ...(plan.fields ? { fields: plan.fields } : {}),
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} gravitational waves`,
    bg,
    glow: false,
  };
}
