/**
 * complete-square-view — COMPLETING THE SQUARE, the geometric move behind the quadratic formula. The
 * expression x² + bx is a square of side x plus a b-by-x rectangle. Split that rectangle in two and wrap
 * the halves around the square: you get an L that is ALMOST the square (x + b/2)² — short by one corner
 * of side b/2. So x² + bx = (x + b/2)² − (b/2)². "Completing" means adding that orange corner.
 *
 * Scenarios vary b (the corner you must add is (b/2)²):
 *   • narrow — b = 2   (small completion)
 *   • square — b = 4
 *   • wide    — b = 6   (big completion)
 *
 * Built as baked `faces` (the four tiles of the completed square, colour-coded). No new renderer
 * primitive. Areas live in the readout / picks (the World has no 3-D text).
 *
 * Stored manifest IS the recipe:
 *   { kind:'complete-square-view', scenario?, x?, b?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));

// rectangle [x0,y0]→[x1,y1] in the x–z plane, as a quad.
const rect = (x0, y0, x1, y1, U, fill, group, alpha) => ({ corners: [[x0 * U, 0, y0 * U], [x1 * U, 0, y0 * U], [x1 * U, 0, y1 * U], [x0 * U, 0, y1 * U]], fill, group, ...(alpha != null ? { alpha } : {}) });
function edge(a, b, U, w, fill, group, alpha) {
  const A = [a[0] * U, 0, a[1] * U], B = [b[0] * U, 0, b[1] * U], dx = B[0] - A[0], dz = B[2] - A[2], L = Math.hypot(dx, dz) || 1, px = (-dz / L) * w, pz = (dx / L) * w;
  return { corners: [[A[0] + px, 0, A[2] + pz], [B[0] + px, 0, B[2] + pz], [B[0] - px, 0, B[2] - pz], [A[0] - px, 0, A[2] - pz]], fill, group, ...(alpha != null ? { alpha } : {}) };
}

const SCENARIOS = { narrow: { b: 2 }, square: { b: 4 }, wide: { b: 6 } };
export const COMPLETE_SQUARE_SCENARIOS = Object.keys(SCENARIOS);

const U = 3.4;
const COL = { sq: '#3a7d8c', strip: '#d6a24a', corner: '#e0843c', line: '#10141c' };

/**
 * Resolve a recipe → { faces, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planCompleteSquareScene(recipe = {}) {
  const scen = COMPLETE_SQUARE_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'square';
  const x = clampNum(recipe.x, 1.5, 6, 3);
  const b = clampNum(recipe.b, 1, 8, SCENARIOS[scen].b);
  const h = b / 2;                                   // half-rectangle width = the gnomon thickness

  const faces = [];
  // x² square (teal) — the original x·x.
  faces.push(rect(0, 0, x, x, U, COL.sq, 'sq', 0.92));
  // the two halves of the b·x rectangle (amber): one on the right, one on top → together they are bx.
  faces.push(rect(x, 0, x + h, x, U, COL.strip, 'stripR', 0.9));   // right strip  (b/2 × x)
  faces.push(rect(0, x, x, x + h, U, COL.strip, 'stripT', 0.9));   // top strip    (x × b/2)
  // the missing corner (orange) — the (b/2)² you ADD to complete the square.
  faces.push(rect(x, x, x + h, x + h, U, COL.corner, 'corner', 0.95));
  // outline the completed (x+b/2)² square + the inner cuts.
  const s = x + h;
  for (const [p, q] of [[[0, 0], [s, 0]], [[s, 0], [s, s]], [[s, s], [0, s]], [[0, s], [0, 0]], [[x, 0], [x, s]], [[0, x], [s, x]]]) faces.push(edge(p, q, U, 0.035, COL.line, 'cut', 0.9));

  const xSq = x * x, bx = b * x, corner = h * h, completed = s * s;
  const picks = [
    { name: 'corner', kind: 'completion', label: `add (b/2)² = ${corner.toFixed(2)} to complete the square`, fields: compactFields([['orange corner', `${h}×${h} = ${corner.toFixed(2)}`], ['identity', 'x² + bx = (x + b/2)² − (b/2)²'], ['here', `${xSq} + ${bx} = ${completed.toFixed(2)} − ${corner.toFixed(2)}`]]) },
    { name: 'sq', kind: 'tile', label: `x² = ${xSq.toFixed(2)} (teal)`, fields: compactFields([['side', String(x)], ['the two amber strips', `together = bx = ${bx.toFixed(2)}`]]) },
  ];

  return {
    faces, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: [
      `Completing the square  (x = ${x}, b = ${b})`,
      'teal = x² · the two amber strips together = bx · orange = the corner you ADD',
      `x² + bx = (x + b/2)² − (b/2)²   →   ${xSq} + ${bx} = ${completed.toFixed(0)} − ${corner.toFixed(0)}`,
      'that orange (b/2)² is the whole trick — it turns x² + bx into a perfect square',
    ] }],
    bounds: { center: [s * U / 2, 0, s * U / 2], radius: s * U * 0.78 },
    stats: { scenario: scen, x, b, corner: +corner.toFixed(3), completedSide: +s.toFixed(3) },
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — front-on view of the figure (it lives in one plane).
 */
export function assembleCompleteSquareScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planCompleteSquareScene(recipe);
  const sc = (c) => [c[0] * scale, c[1] * scale, c[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2], d = 0.5 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.3, ctr[2]], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.45, -d * 1.7, ctr[2] + d * 0.9], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1000, height: 1000 },
    title: title || recipe.title || `mojulo complete the square · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
