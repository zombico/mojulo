/**
 * field-view — an electromagnetism depictor: electromagnetic wave activity and magnetic fields,
 * rendered in the traversable three.js World. Where mechanics/orbit move a discrete BODY, EM is a
 * continuous FIELD over space, so this rides a new primitive — emitThreeWorld's `fields` channel: a
 * lattice of vector arrows updated per frame from an analytic field.
 *
 * Scenarios:
 *   • em-wave    — a travelling plane wave: E (red, vertical) ⊥ B (blue, horizontal), in phase as
 *                  sin(kx − ωt), with the two sine envelope curves sweeping along x.
 *   • bar-magnet — a dipole: N/S body, analytic field lines (r = r₀·sin²θ), iron-filing needles
 *                  oriented along B = (3(m·r̂)r̂ − m)/r³.
 *   • wire       — a straight current: circular B loops (right-hand rule), tangent needles, B ∝ 1/r.
 *   • solenoid   — a coil: near-uniform interior field + dipole return, copper windings.
 *
 * Accurate structure, artistic scale (same compromise as orbit-view): E⊥B in phase, the dipole line
 * shape, B ∝ 1/r round a wire — all honest; only the spatial/temporal scale is compressed to read in
 * one frame, with a real-units readout (λ, f, c = λf).
 *
 * Stored manifest IS the recipe (geometry regenerated on render):
 *   { kind:'field-view', scenario?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study (like mechanics-view / orbit-view) — no walk, no CSS-3D /scene form.
 */

import { lowerObjectFaces, WORKBENCH_LIGHT } from '../../worlds/workbench.js';

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// ── vec helpers ──
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scl = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── workbench lathe helpers (solid bodies — magnet, wire, coil core) ──
const pt = (a) => ({ x: a[0], y: a[1], z: a[2] });
const cylinderProfile = (R) => [{ t: 0, radius: 0 }, { t: 0.04, radius: R }, { t: 0.96, radius: R }, { t: 1, radius: 0 }];
const cylinderSpec = (p0, p1, R, tint, samples = 18) => ({ axisFrom: pt(p0), axisTo: pt(p1), profile: cylinderProfile(R), crossSections: 16, samples, tint });

// ── flat box (the bar magnet halves) as explicit quads ──
const quad = (corners, fill, group, alpha) => ({ corners, fill, group, ...(alpha != null ? { alpha } : {}) });
function boxFaces(center, half, fill, group, alpha) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half;
  const v = (sx, sy, sz) => [cx + sx * hx, cy + sy * hy, cz + sz * hz];
  return [
    quad([v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)], fill, group, alpha),     // +z
    quad([v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)], fill, group, alpha), // -z
    quad([v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)], fill, group, alpha), // -y
    quad([v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)], fill, group, alpha),     // +y
    quad([v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)], fill, group, alpha),     // +x
    quad([v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)], fill, group, alpha), // -x
  ];
}

// ── geometry helpers for field lines ──
const circleZ = (cz, r, n = 48, cx = 0, cy = 0) => Array.from({ length: n + 1 }, (_, i) => { const a = TAU * (i / n); return [cx + r * Math.cos(a), cy + r * Math.sin(a), cz]; });
// dipole field line in the meridional plane at azimuth φ: r = r0·sin²θ, axis = +z.
function dipoleLine(r0, phi, n = 44) {
  const pts = [], cp = Math.cos(phi), sp = Math.sin(phi);
  for (let i = 1; i < n; i++) {
    const th = Math.PI * (i / n);
    const r = r0 * Math.sin(th) * Math.sin(th);
    const x = r * Math.sin(th), z = r * Math.cos(th);
    pts.push([x * cp, x * sp, z]);
  }
  return pts;
}
// dipole B direction + relative magnitude at p (moment m = +ẑ).
function dipoleB(p) {
  const r = len(p) || 1e-6, rh = scl(p, 1 / r), m = [0, 0, 1];
  const v = sub(scl(rh, 3 * dot(m, rh)), m);
  return { dir: norm(v), mag: len(v) / (r * r * r) };
}

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

// ── scenarios. Each returns { faces, picks, field, span }. `field` is one emitThreeWorld field entry. ──
const SCENARIOS = {
  // a travelling E⊥B plane wave along +x; E vertical (z, red), B horizontal (y, blue), in phase.
  'em-wave'() {
    const lambda = 8, k = TAU / lambda, axisLen = lambda * 2.5, M = 31, dx = axisLen / (M - 1);
    const E0 = 3.0, B0 = 2.0, omega = 2.2;
    const stations = Array.from({ length: M }, (_, i) => ({ x: i * dx, phase0: k * (i * dx) }));
    const eSet = { color: 0xff5a5a, curve: true, samples: stations.map((s) => ({ pos: [s.x, 0, 0], dir: [0, 0, 1], amp: E0, phase0: s.phase0 })) };
    const bSet = { color: 0x5a8cff, curve: true, samples: stations.map((s) => ({ pos: [s.x, 0, 0], dir: [0, 1, 0], amp: B0, phase0: s.phase0 })) };
    return {
      faces: [], picks: [],
      field: { animate: true, omega, sets: [eSet, bSet], lines: [{ pts: [[0, 0, 0], [axisLen, 0, 0]], color: 0x44506a, opacity: 0.6 }],
        readout: ['Electromagnetic wave', 'E ⊥ B ⊥ direction of travel', 'λ = 500 nm · f = 6.0×10¹⁴ Hz', 'c = λf = 3.0×10⁸ m/s'] },
      span: axisLen,
    };
  },

  // a bar magnet: N (red) / S (blue) body, dipole field lines, iron-filing needles oriented along B.
  'bar-magnet'() {
    const mh = 4, half = [1.4, 1.4, mh];
    const faces = [
      ...boxFaces([0, 0, mh / 2], [half[0], half[1], mh / 2], '#d0463c', 'magnet:n'),   // N half (+z)
      ...boxFaces([0, 0, -mh / 2], [half[0], half[1], mh / 2], '#3a6bd0', 'magnet:s'),   // S half (−z)
    ];
    const picks = [
      { name: 'magnet:n', kind: 'pole', label: 'North pole', fields: compactFields([['field', 'lines exit here']]) },
      { name: 'magnet:s', kind: 'pole', label: 'South pole', fields: compactFields([['field', 'lines enter here']]) },
    ];
    // field lines: several r0 across a few azimuths → a 3D dipole cage.
    const lines = [];
    for (const r0 of [7, 11, 15]) for (const phi of [0, 60, 120, 180, 240, 300]) lines.push({ pts: dipoleLine(r0, phi * DEG), color: 0x66ccdd, opacity: 0.55 });
    // iron-filing needles: x–z plane grid + a sparse y–z column, oriented along the dipole B.
    const needles = [];
    const inMagnet = (x, y, z) => Math.abs(x) < 2 && Math.abs(y) < 2 && Math.abs(z) < mh + 0.6;
    for (let x = -12; x <= 12; x += 3) for (let z = -12; z <= 12; z += 3) {
      if (inMagnet(x, 0, z)) continue;
      const b = dipoleB([x, 0, z]); const r = Math.hypot(x, z);
      needles.push({ pos: [x, 0, z], dir: b.dir, amp: clamp(0.5 + 1.0 / (1 + (r / 7) ** 2), 0.45, 1.25), phase0: 0 });
    }
    for (let y = -9; y <= 9; y += 3) for (let z = -9; z <= 9; z += 3) {
      if (!y || inMagnet(0, y, z)) continue;
      const b = dipoleB([0, y, z]); const r = Math.hypot(y, z);
      needles.push({ pos: [0, y, z], dir: b.dir, amp: clamp(0.5 + 1.0 / (1 + (r / 7) ** 2), 0.45, 1.2), phase0: 0 });
    }
    return {
      faces, picks,
      field: { animate: false, sets: [{ color: 0x9fb2c8, curve: false, samples: needles }], lines,
        readout: ['Bar magnet — dipole', 'Field lines: N → S', 'B ∝ 1/r³', 'needles = iron filings (∥ B)'] },
      span: 17,
    };
  },

  // a straight current along z: circular B loops (right-hand rule), tangent needles, B ∝ 1/r.
  wire() {
    const wl = 10, R = 0.35;
    const faces = lowerObjectFaces({ lathes: [cylinderSpec([0, 0, -wl], [0, 0, wl], R, '#c87b3a', 20)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: 'wire' }));
    const picks = [{ name: 'wire', kind: 'wire', label: 'Current-carrying wire', fields: compactFields([['current', 'I (along +z)'], ['field', 'circles the wire']]) }];
    // B loops at a few heights and radii.
    const lines = [];
    for (const z of [-5, 0, 5]) for (const r of [2, 3.5, 5]) lines.push({ pts: circleZ(z, r), color: 0x5a8cff, opacity: 0.5 });
    // tangent needles in z=0: B direction = ẑ × r̂ (azimuthal), magnitude ∝ 1/r.
    const needles = [];
    for (const r of [2, 3.5, 5]) for (let a = 0; a < 12; a++) {
      const th = TAU * (a / 12), p = [r * Math.cos(th), r * Math.sin(th), 0];
      const tang = norm([-p[1], p[0], 0]);   // ẑ × r̂
      needles.push({ pos: p, dir: tang, amp: clamp(3.4 / r, 0.5, 1.4), phase0: 0 });
    }
    // a current-direction arrow up the wire.
    const current = { color: 0xffc14d, curve: false, samples: [{ pos: [0, 0, -wl], dir: [0, 0, 1], amp: wl * 2, phase0: 0 }] };
    return {
      faces, picks,
      field: { animate: false, sets: [{ color: 0x86b0ff, curve: false, samples: needles }, current], lines,
        readout: ['Straight current I', 'B circles the wire (right-hand rule)', 'B = μ₀I / 2πr ∝ 1/r'] },
      span: 14,
    };
  },

  // a solenoid: copper windings, near-uniform interior field along the bore, dipole return outside.
  solenoid() {
    const cl = 7, cR = 3;
    // a faint translucent bore core (so there is a pickable body).
    const faces = lowerObjectFaces({ lathes: [cylinderSpec([0, 0, -cl], [0, 0, cl], cR * 0.96, '#7088aa', 22)] }, WORKBENCH_LIGHT).map((f) => ({ ...f, group: 'solenoid', alpha: 0.12 }));
    const picks = [{ name: 'solenoid', kind: 'coil', label: 'Solenoid (coil)', fields: compactFields([['interior', 'near-uniform B'], ['B', 'μ₀ n I']]) }];
    // copper windings as circles.
    const lines = [];
    const turns = 13;
    for (let i = 0; i < turns; i++) { const z = -cl + (2 * cl) * (i / (turns - 1)); lines.push({ pts: circleZ(z, cR), color: 0xc87b3a, opacity: 0.85 }); }
    // exterior return lines: half-ellipses from top exit, bulging outside, to bottom entry, a few azimuths.
    for (const xo of [4.5, 6.5, 9]) for (const phi of [0, 90, 180, 270]) {
      const cp = Math.cos(phi * DEG), sp = Math.sin(phi * DEG), pts = [];
      for (let i = 0; i <= 40; i++) { const th = Math.PI * (i / 40); const x = xo * Math.sin(th), z = (cl + 1.5) * Math.cos(th); pts.push([x * cp, x * sp, z]); }
      lines.push({ pts, color: 0x5a8cff, opacity: 0.4 });
    }
    // interior field arrows (uniform, along +z) on a small bundle of lines through the bore.
    const interior = [];
    for (const off of [[0, 0], [cR * 0.5, 0], [-cR * 0.5, 0], [0, cR * 0.5], [0, -cR * 0.5]]) {
      for (let z = -cl + 1; z <= cl - 1; z += 2.2) interior.push({ pos: [off[0], off[1], z], dir: [0, 0, 1], amp: 1.5, phase0: 0 });
    }
    return {
      faces, picks,
      field: { animate: false, sets: [{ color: 0x88dd99, curve: false, samples: interior }], lines,
        readout: ['Solenoid (coil)', 'Near-uniform field inside the bore', 'B = μ₀ n I'] },
      span: 16,
    };
  },
};

export const FIELD_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into faces + picks + the field channel payload. Pure — no DB, no HTML.
 * @returns {{ faces, picks, fields, bounds, stats }}
 */
export function planFieldScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'em-wave';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const built = SCENARIOS[scenario]();

  // apply the overall scale to every coordinate (faces, field samples, lines).
  const sFaces = built.faces.map((f) => ({ ...f, corners: f.corners.map((c) => scl(c, scale)) }));
  const sField = {
    ...built.field,
    sets: (built.field.sets || []).map((st) => ({ ...st, samples: st.samples.map((s) => ({ ...s, pos: scl(s.pos, scale), amp: s.amp * scale })) })),
    lines: (built.field.lines || []).map((ln) => ({ ...ln, pts: ln.pts.map((p) => scl(p, scale)) })),
  };

  // bounds over faces + field sample positions + line points.
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  const bump = (c) => { for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; } };
  for (const f of sFaces) for (const c of f.corners) bump(c);
  for (const st of sField.sets) for (const s of st.samples) bump(s.pos);
  for (const ln of sField.lines) for (const p of ln.pts) bump(p);
  if (!Number.isFinite(mn[0])) { mn[0] = mn[1] = mn[2] = -built.span * scale; mx[0] = mx[1] = mx[2] = built.span * scale; }
  const center = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  let radius = 0;
  for (const c of [mn, mx]) radius = Math.max(radius, Math.hypot(c[0] - center[0], c[1] - center[1], c[2] - center[2]));
  radius = radius || built.span * scale;

  return { faces: sFaces, picks: built.picks, fields: [sField], bounds: { center, radius }, stats: { scenario, animate: !!built.field.animate, sets: sField.sets.length, lines: sField.lines.length } };
}

/**
 * Resolve a recipe into the emitThreeWorld payload. Orbit-only; a side / 3-quarter pair frames the
 * field. glow off.
 */
export function assembleFieldScene(recipe = {}, { title } = {}) {
  const plan = planFieldScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.5;
  const cameras = [
    { name: 'side', worldFraming: { cameraPosition: [center[0], center[1] - d * 1.3, center[2]], lookAt: center, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [center[0] + d * 0.55, center[1] - d * 0.85, center[2] + d * 0.55], lookAt: center, horizontalFov: 46 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#05070f';
  return {
    faces: plan.faces,
    picks: plan.picks,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario}`,
    bg,
    glow: false,
  };
}
