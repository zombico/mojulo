/**
 * windmill-view — air MOVING a windmill, depicted from the principles built up across the science
 * views. The blades are airfoils (lift), the wind is a flow (streaming particles), and the rotor
 * SPINS — the one new capability, a rotational `spin` mover (the mover channel rotating a render group
 * about an axis, rather than translating it).
 *
 * The chain: wind V hits the airfoil blades → lift → its tangential component is a torque → the rotor
 * turns. Two scenarios: 'turbine' (a modern 3-blade horizontal-axis wind turbine) and 'classic' (a
 * Dutch 4-sail windmill). The `wind` knob drives the rotation rate (ω = λ·V/R, tip-speed ratio λ) and
 * the particle speed.
 *
 * Stored manifest IS the recipe (regenerated on render):
 *   { kind:'windmill-view', scenario?, wind?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// ── vec + baked shading (the world meshes are flat-coloured, so we bake form into the fills). ──
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const SUN = norm([0.45, -0.5, 0.8]);
const hexToRgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r) => '#' + r.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
function shade(hex, n) { const f = 0.55 + 0.45 * Math.max(0, dot(norm(n), SUN)); return rgbToHex(hexToRgb(hex).map((c) => c * f)); }
const faceNormal = (c) => norm(cross(sub(c[1], c[0]), sub(c[2], c[0])));

// a shaded quad / convex face.
const solid = (corners, hex, group) => ({ corners, fill: shade(hex, faceNormal(corners)), group });

// rotate a point about the Y axis (the rotor spin axis) / about Z (blade pitch).
const rotY = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; };
const rotZ = (p, a) => { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]]; };

// an axis-aligned (optionally tapered along z) box, six shaded faces.
function boxFaces(center, half, hex, group, topHalf) {
  const [cx, cy, cz] = center, [hx, hy, hz] = half, [tx, ty] = topHalf || [hx, hy];
  const v = (sx, sy, sz) => [cx + (sz > 0 ? tx : hx) * sx, cy + (sz > 0 ? ty : hy) * sy, cz + hz * sz];
  const f = (a, b, c, d) => solid([a, b, c, d], hex, group);
  return [
    f(v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)),
    f(v(-1, -1, -1), v(-1, 1, -1), v(1, 1, -1), v(1, -1, -1)),
    f(v(-1, -1, -1), v(1, -1, -1), v(1, -1, 1), v(-1, -1, 1)),
    f(v(-1, 1, -1), v(-1, 1, 1), v(1, 1, 1), v(1, 1, -1)),
    f(v(1, -1, -1), v(1, 1, -1), v(1, 1, 1), v(1, -1, 1)),
    f(v(-1, -1, -1), v(-1, -1, 1), v(-1, 1, 1), v(-1, 1, -1)),
  ];
}

// a tapered blade radiating +z from rHub to R (chord c0→c1, thickness ty), pitched about its long
// axis, then swung to `bladeAngle` about Y. Returns shaded faces tagged into the rotor group.
function bladeFaces(rHub, R, c0, c1, ty, pitch, bladeAngle, hex, group) {
  // 8 corners in the blade frame (x = chord, y = thickness, z = span), pitched about z (long axis).
  const corner = (sx, sy, z, c) => rotY(rotZ([sx * c, sy * ty, z], pitch), bladeAngle);
  const root = (sx, sy) => corner(sx, sy, rHub, c0), tip = (sx, sy) => corner(sx, sy, R, c1);
  const A = root(-1, -1), B = root(1, -1), C = root(1, 1), D = root(-1, 1);
  const E = tip(-1, -1), F = tip(1, -1), Gg = tip(1, 1), H = tip(-1, 1);
  return [
    solid([A, B, C, D], hex, group), solid([E, F, Gg, H], hex, group),
    solid([A, B, F, E], hex, group), solid([D, C, Gg, H], hex, group),
    solid([A, D, H, E], hex, group), solid([B, C, Gg, F], hex, group),
  ];
}

// a flat lattice sail (classic mill): a thin rectangle from the hub out along +z, swung to angle.
function sailFaces(rHub, R, halfW, angle, hex, group) {
  const p = (x, z) => rotY([x, 0, z], angle);
  const a = p(-halfW, rHub), b = p(halfW, rHub), c = p(halfW, R), d = p(-halfW, R);
  const bar = (z0, z1) => { const e = p(-halfW, z0), f = p(halfW, z0), g = p(halfW, z1), h = p(-halfW, z1); return solid([e, f, g, h], '#6b5436', group); };
  const faces = [solid([a, b, c, d], hex, group)];
  for (let z = rHub + (R - rHub) * 0.2; z < R; z += (R - rHub) * 0.22) faces.push(bar(z, z + 0.3));   // lattice bars
  return faces;
}

const compactFields = (pairs) => pairs.filter(([, v]) => v != null && v !== '').map(([k, v]) => ({ k: String(k), v: String(v) }));

// wind streamlines flowing +y past the rotor, + a few upstream wind arrows. Returns { tracers, windSet }.
function windFlow(hubZ, R, windSpeed) {
  const tracers = [];
  for (const x of [-R * 0.7, -R * 0.35, 0, R * 0.35, R * 0.7]) for (const z of [hubZ - R * 0.6, hubZ, hubZ + R * 0.6]) {
    const path = Array.from({ length: 24 }, (_, k) => { const t = k / 23; return [x, -R * 1.7 + (R * 3.4) * t, z]; });
    tracers.push({ path, color: [225, 236, 250], size: 0.5, period: clamp(60 / windSpeed, 2, 7), trail: 5, trailLag: 0.005 });
  }
  const windSet = { color: 0x6fa8dc, curve: false, samples: [-R * 0.5, R * 0.5].map((x) => ({ pos: [x, -R * 1.9, hubZ], dir: [0, 1, 0], amp: clamp(windSpeed * 0.45, 2, 6) })) };
  return { tracers, windSet };
}

const SCENARIOS = {
  // a modern 3-blade horizontal-axis wind turbine.
  turbine(P) {
    const wind = clampNum(P.wind, 2, 25, 10);
    const Hhub = 22, R = 13, rHub = 1.5;
    const faces = [];
    // ground + tower + nacelle (static).
    faces.push(solid([[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0]], '#4a6a44', 'ground'));
    faces.push(...boxFaces([0, 0, Hhub / 2], [1.5, 1.5, Hhub / 2], '#e6e9ef', 'tower', [0.9, 0.9]));
    faces.push(...boxFaces([0, -2.4, Hhub], [1.4, 2.6, 1.4], '#d7dbe2', 'nacelle'));
    // rotor (hub + 3 blades), authored centred on the ORIGIN so the spin mover can place + rotate it.
    const rotor = [...boxFaces([0, 0.6, 0], [1.5, 1.0, 1.5], '#c4c9d2', 'rotor')];
    for (let b = 0; b < 3; b++) rotor.push(...bladeFaces(rHub, R, 1.5, 0.5, 0.45, 0.32, b * TAU / 3, '#f2f4f7', 'rotor'));
    faces.push(...rotor);

    const lambda = 6, omega = clamp(lambda * wind / R, 0.5, 2.2);   // ω = λ·V/R, clamped to a watchable rate
    const movers = [{ group: 'rotor', spin: { axis: [0, 1, 0], omega }, pivot: [0, 0, Hhub], basePos: [0, 0, 0] }];
    const { tracers, windSet } = windFlow(Hhub, R, wind);
    const rpm = Math.round(omega * 60 / TAU);
    return {
      faces, movers, tracers,
      picks: [{ name: 'rotor', kind: 'rotor', label: 'Rotor', fields: compactFields([['blades', '3 airfoils'], ['drive', 'lift → torque'], ['λ (tip-speed)', `${lambda}`]]) },
        { name: 'tower', kind: 'tower', label: 'Tower', fields: compactFields([['hub height', `${Hhub} m`]]) }],
      field: { animate: false, sets: [windSet], lines: [],
        readout: ['Wind turbine — air drives the rotor', 'blades are airfoils → wind makes LIFT', 'lift’s tangential pull → torque → spin', `tip-speed ratio λ = ωR/V = ${lambda}`, `wind ${wind} m/s → ≈ ${rpm} rpm`] },
      bounds: { center: [0, 0, Hhub * 0.55], radius: Math.max(R + 6, Hhub * 0.75) },
      stats: { scenario: 'turbine', wind, omega, rpm, lambda },
    };
  },

  // a classic Dutch windmill: a fat tapered body, a cap, and 4 lattice sails.
  classic(P) {
    const wind = clampNum(P.wind, 2, 25, 8);
    const Hbody = 18, Hcap = 19.5, R = 11, rHub = 1.2;
    const faces = [];
    faces.push(solid([[-40, -40, 0], [40, -40, 0], [40, 40, 0], [-40, 40, 0]], '#4a6a44', 'ground'));
    faces.push(...boxFaces([0, 0, Hbody / 2], [5.2, 5.2, Hbody / 2], '#8a6a4a', 'body', [3.0, 3.0]));   // tapered tower
    faces.push(...boxFaces([0, 0, Hbody + 1.0], [3.4, 3.4, 1.4], '#5b4636', 'cap'));                    // cap
    faces.push(...boxFaces([0, -3.6, Hcap], [1.0, 1.4, 1.0], '#3a2c22', 'cap'));                        // axle housing
    // sails (4 at 90°), authored at the origin for the spin mover.
    const rotor = [];
    for (let b = 0; b < 4; b++) rotor.push(...sailFaces(rHub, R, 1.5, b * TAU / 4, '#cabd9a', 'rotor'));
    rotor.push(...boxFaces([0, 0.4, 0], [0.9, 0.7, 0.9], '#3a2c22', 'rotor'));   // hub
    faces.push(...rotor);

    const omega = clamp(0.09 * wind, 0.3, 1.2);
    const movers = [{ group: 'rotor', spin: { axis: [0, 1, 0], omega }, pivot: [0, -3.6, Hcap], basePos: [0, 0, 0] }];
    const { tracers, windSet } = windFlow(Hcap, R, wind);
    return {
      faces, movers, tracers,
      picks: [{ name: 'rotor', kind: 'rotor', label: 'Sails', fields: compactFields([['sails', '4 lattice'], ['drive', 'wind → torque']]) },
        { name: 'body', kind: 'body', label: 'Mill house', fields: compactFields([['type', 'tower mill']]) }],
      field: { animate: false, sets: [windSet], lines: [],
        readout: ['Dutch windmill — air turns the sails', 'wind pushes the angled sails → torque', 'the cap yaws the sails into the wind', `wind ${wind} m/s → ${Math.round(omega * 60 / TAU)} rpm`] },
      bounds: { center: [0, 0, Hcap * 0.55], radius: Math.max(R + 6, Hcap * 0.7) },
      stats: { scenario: 'classic', wind, omega, rpm: Math.round(omega * 60 / TAU) },
    };
  },
};

export const WINDMILL_SCENARIOS = Object.keys(SCENARIOS);

/**
 * Resolve a recipe into faces + the spin mover + wind flow. Pure — no DB, no HTML.
 * @returns {{ faces, picks, movers, tracers, fields, bounds, stats }}
 */
export function planWindmillScene(recipe = {}) {
  const scenario = SCENARIOS[recipe.scenario] ? recipe.scenario : 'turbine';
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const built = SCENARIOS[scenario]({ wind: recipe.wind });

  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = built.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const movers = built.movers.map((mv) => ({ ...mv, pivot: sc(mv.pivot), basePos: sc(mv.basePos) }));
  const tracers = built.tracers.map((tr) => ({ ...tr, path: tr.path.map(sc), size: tr.size * scale }));
  const fields = [{ ...built.field, sets: built.field.sets.map((st) => ({ ...st, samples: st.samples.map((s) => ({ ...s, pos: sc(s.pos), amp: s.amp * scale })) })) }];

  return {
    faces, picks: built.picks, movers, tracers, fields,
    bounds: { center: sc(built.bounds.center), radius: built.bounds.radius * scale },
    stats: built.stats,
  };
}

/**
 * Resolve a recipe into the emitThreeWorld payload — a front-quarter view of the turbine in the wind.
 */
export function assembleWindmillScene(recipe = {}, { title } = {}) {
  const plan = planWindmillScene(recipe);
  const { center, radius } = plan.bounds;
  const d = radius * 2.5;
  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [center[0] + d * 0.45, center[1] - d * 1.05, center[2] + d * 0.35], lookAt: center, horizontalFov: 50 } },
    { name: 'side', worldFraming: { cameraPosition: [center[0] + d * 1.1, center[1] - d * 0.2, center[2] + d * 0.25], lookAt: center, horizontalFov: 50 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#9cc4e8';
  return {
    faces: plan.faces,
    picks: plan.picks,
    movers: plan.movers,
    tracers: plan.tracers,
    fields: plan.fields,
    cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1120, height: 780 },
    title: title || recipe.title || `mojulo ${plan.stats.scenario} windmill`,
    bg,
    glow: false,
  };
}
