/**
 * river-view — a winding RIVER that flows one direction through terrain it has CARVED into a valley,
 * in the traversable three.js World. The fluid sibling of ocean/beach: instead of open water it rides
 * the surface channel's `river` mode — a winding centreline the water follows, its level DESCENDING
 * downstream, ripples + foam streaks + drifting debris all sliding one way, with the grid culled to the
 * winding ribbon. The land underneath is rolling fBm terrain carved into the river's valley (bed +
 * sloping banks following the same centreline), so the water sits in real topography, filling to the banks.
 *
 * Six KINDS, all the same primitive at different points in its parameter space (see SCENARIOS):
 *   creek  — narrow, fast, clear, shallow, tightly winding
 *   river  — the default: a broad blue-green river, moderate flow
 *   gorge  — deep-carved canyon, dark fast water, steep rock banks
 *   canal  — near-straight, hard-edged, calm
 *   lazy   — wide, slow, glassy, gently meandering lowland water
 *   lava   — a molten flow: hot self-emissive palette, slow viscous drift
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'river-view', scenario?, seed?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form. Same fractal-generation philosophy: a tiny
 * recipe regenerates the whole valley + flow deterministically (seeded phases + hash noise, no dice).
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const hex = (rgb) => '#' + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, '0')).join('');
const norm3 = (v) => { const m = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / m, v[1] / m, v[2] / m]; };
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const W = 160, H = 184, TX = 74, TY = 84;   // terrain footprint + face grid
const SUN = [40, -70, 95];

// deterministic value-noise fBm (seeded by an integer offset).
function hash2(ix, iy) { let h = (ix * 374761393 + iy * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177 | 0; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}
function fbm(x, y) { let s = 0, a = 0.5, f = 0.035; for (let o = 0; o < 4; o++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }

// ── the six kinds, as points in the river/carve/palette parameter space ──────────────────────
const SCENARIOS = {
  creek: { wind: [24, 22], freq: [1.6, 3.4], fbmAmp: 15, grad: 11, chan: 6, valley: 17, wdepth: 4, half: 8, bank: 17, flow: 11, amp: 0.35, lam: 7, sand: 1.4, water: { deep: [0.10, 0.42, 0.46], surf: [0.24, 0.62, 0.62], crest: [0.95, 0.99, 0.98] } },
  river: { wind: [34, 15], freq: [1.15, 2.7], fbmAmp: 16, grad: 10, chan: 11, valley: 30, wdepth: 6, half: 17, bank: 30, flow: 8, amp: 0.5, lam: 11, sand: 1.8, water: { deep: [0.07, 0.30, 0.38], surf: [0.16, 0.50, 0.54], crest: [0.92, 0.97, 0.96] } },
  gorge: { wind: [28, 12], freq: [1.3, 3.0], fbmAmp: 26, grad: 14, chan: 8, valley: 24, wdepth: 13, half: 12, bank: 24, flow: 10, amp: 0.6, lam: 10, sand: 1.2, water: { deep: [0.03, 0.16, 0.24], surf: [0.08, 0.34, 0.42], crest: [0.85, 0.93, 0.95] } },
  canal: { wind: [7, 3], freq: [0.9, 2.1], fbmAmp: 12, grad: 8, chan: 10, valley: 15, wdepth: 6, half: 12, bank: 16, flow: 5, amp: 0.28, lam: 12, sand: 1.2, water: { deep: [0.08, 0.28, 0.34], surf: [0.16, 0.44, 0.48], crest: [0.9, 0.95, 0.95] } },
  lazy: { wind: [40, 10], freq: [0.85, 1.9], fbmAmp: 13, grad: 7, chan: 14, valley: 34, wdepth: 6, half: 22, bank: 38, flow: 4, amp: 0.3, lam: 14, sand: 2.0, water: { deep: [0.10, 0.32, 0.30], surf: [0.22, 0.50, 0.44], crest: [0.9, 0.96, 0.9] } },
  lava: { wind: [30, 14], freq: [1.2, 2.6], fbmAmp: 22, grad: 12, chan: 9, valley: 24, wdepth: 8, half: 13, bank: 24, flow: 4, amp: 0.9, lam: 9, sand: 1.4, water: { deep: [0.20, 0.02, 0.0], surf: [0.65, 0.16, 0.02], crest: [1.0, 0.78, 0.22] }, emissive: [0.5, 0.12, 0.0] },
};

export const RIVER_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into terrain faces + the river surface. Pure — no DB, no HTML. Deterministic:
 * (scenario, seed, scale) → byte-identical scene.
 * @returns {{ faces, surfaces, bounds, stats }}
 */
export function planRiverScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'river';
  const S = SCENARIOS[scenario];
  const scale = clampNum(recipe.scale, 0.4, 3, 1);
  const seed = Number.isFinite(+recipe.seed) ? Math.floor(+recipe.seed) : 1;
  // seeded phases + noise offset (no Math.random — same seed → same valley).
  const ph1 = (seed * 0.61803) % 6.283, ph2 = (seed * 1.4142 + 1.1) % 6.283, nOff = ((seed * 131) % 500) + 40;

  const baseElev = (y) => 8 + (y / (H / 2)) * S.grad;
  const natural = (x, y) => baseElev(y) + (fbm(x + nOff, y + nOff * 0.5) - 0.5) * S.fbmAmp;
  const waterLevelAt = (y) => baseElev(y) - 5;
  const riverX = (t) => S.wind[0] * Math.sin(6.283 * S.freq[0] * t + 0.4 + ph1) + S.wind[1] * Math.sin(6.283 * S.freq[1] * t + 1.2 + ph2);
  const NPTS = 64;
  const centre = Array.from({ length: NPTS }, (_, i) => { const t = i / (NPTS - 1), y = (H / 2) - t * H; return [riverX(t), y, waterLevelAt(y)]; });
  const nearestC = (x, y) => {
    let best = 1e9, bl = 0;
    for (let i = 1; i < centre.length; i++) {
      const a = centre[i - 1], b = centre[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6;
      let tt = ((x - a[0]) * dx + (y - a[1]) * dy) / L2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
      const px = a[0] + dx * tt, py = a[1] + dy * tt, dd = Math.hypot(x - px, y - py);
      if (dd < best) { best = dd; bl = a[2] + (b[2] - a[2]) * tt; }
    }
    return { dl: best, level: bl };
  };
  const terrainZ = (x, y) => {
    const nat = natural(x, y), { dl, level } = nearestC(x, y), bed = level - S.wdepth;
    if (dl <= S.chan) return bed;
    if (dl >= S.valley) return nat;
    const u = (dl - S.chan) / (S.valley - S.chan), s = u * u * (3 - 2 * u);
    return bed + (Math.max(nat, level + 2.5) - bed) * s;   // banks always rise above the water (no spill)
  };

  // terrain faces (grass / rock / sandy bank, Lambert-lit; lava scorches the banks dark).
  const sun = norm3(SUN);
  const GRASS = scenario === 'lava' ? [0.20, 0.19, 0.17] : [0.30, 0.44, 0.19];
  const ROCK = scenario === 'lava' ? [0.16, 0.12, 0.11] : [0.44, 0.37, 0.28];
  const SAND = scenario === 'lava' ? [0.28, 0.16, 0.10] : [0.74, 0.66, 0.46];
  const faces = [];
  for (let j = 0; j < TY; j++) for (let i = 0; i < TX; i++) {
    const xa = (-W / 2 + W * i / TX) * scale, xb = (-W / 2 + W * (i + 1) / TX) * scale, ya = (-H / 2 + H * j / TY) * scale, yb = (-H / 2 + H * (j + 1) / TY) * scale;
    const z = (x, y) => terrainZ(x / scale, y / scale) * scale;
    const p00 = [xa, ya, z(xa, ya)], p10 = [xb, ya, z(xb, ya)], p11 = [xb, yb, z(xb, yb)], p01 = [xa, yb, z(xa, yb)];
    const n = norm3(cross3(sub3(p10, p00), sub3(p01, p00)));
    const shade = 0.4 + 0.6 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
    const xc = (xa + xb) / 2 / scale, yc = (ya + yb) / 2 / scale, zc = (p00[2] + p10[2] + p11[2] + p01[2]) / 4 / scale;
    const above = zc - waterLevelAt(yc), steep = 1 - n[2], dlc = nearestC(xc, yc).dl;
    const base = (dlc < S.valley - 5 && above < S.sand) ? SAND : (steep > 0.42 ? ROCK : GRASS);
    faces.push({ corners: [p00, p10, p11, p01], fill: hex([base[0] * shade, base[1] * shade, base[2] * shade]) });
  }

  const water = {
    grid: { w: W * scale, d: H * scale, nx: 104, ny: 118, cx: 0, cy: 0 },
    deep: S.water.deep, surf: S.water.surf, crest: S.water.crest, sun: [SUN[0] * scale, SUN[1] * scale, SUN[2] * scale], amax: 1,
    ...(S.emissive ? { emissive: S.emissive } : {}),
    floaters: scenario === 'lava' ? [] : [
      { x: 0, y: 0, r: 0.55 * scale, color: 0x6f8a38, drift: 0.05, driftSpeed: S.flow },
      { x: 0, y: 0, r: 0.5 * scale, color: 0x86a24a, drift: 0.4, driftSpeed: S.flow },
      { x: 0, y: 0, r: 0.5 * scale, color: 0x577a2e, drift: 0.72, driftSpeed: S.flow },
    ],
    river: { pts: centre.map((p) => [p[0] * scale, p[1] * scale, p[2] * scale]), half: S.half * scale, bank: S.bank * scale, flow: S.flow, amp: S.amp * scale, lam: S.lam * scale },
  };

  return {
    faces, surfaces: [water],
    bounds: { center: [0, 0, 0], radius: Math.hypot(W / 2, H / 2) * scale },
    stats: { scenario, seed, flow: S.flow, faces: faces.length, points: centre.length },
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a 3/4 camera looking down the valley (the river
 * flows toward the viewer), over a bright sky (dusk for lava).
 */
export function assembleRiverScene(recipe = {}, { title } = {}) {
  const plan = planRiverScene(recipe);
  const s = clampNum(recipe.scale, 0.4, 3, 1);
  const lava = plan.stats.scenario === 'lava';
  const cameras = [
    { name: 'valley', worldFraming: { cameraPosition: [40 * s, -108 * s, 66 * s], lookAt: [-6 * s, 8 * s, 2 * s], horizontalFov: 60 } },
    { name: 'high', worldFraming: { cameraPosition: [0, -20 * s, 150 * s], lookAt: [0, 0, 0], horizontalFov: 54 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : (lava ? '#1a1210' : '#cfe6f2');
  return {
    faces: plan.faces,
    surfaces: plan.surfaces,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} river`,
    bg,
    glow: lava,
  };
}
