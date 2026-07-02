/**
 * pythagoras-view — a² + b² = c², the iconic figure: a right triangle with a SQUARE built on each side,
 * coloured and labelled by area, so you SEE that the two leg-squares together equal the hypotenuse
 * square. The second scenario shows the one-figure dissection proof: a (a+b)² square holding four copies
 * of the triangle around a tilted c² square.
 *
 * Scenarios:
 *   • squares    — the three squares on the sides (areas a², b², c²); change the triangle, the relation holds
 *   • dissection — (a+b)² = 4·(½ab) + c²  ⇒  a²+b² = c², the algebraic proof in one square
 *
 * Built as baked `faces`. No new renderer primitive. The triangle is set by its two legs (a, b).
 *
 * Stored manifest IS the recipe:
 *   { kind:'pythagoras-view', scenario?, a?, b?, scale?, viewBox?, scene?:{ bg? }, title? }
 *
 * Orbit-only object study — no walk, no CSS-3D /scene form.
 */

const clampNum = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };
const compactFields = (pairs) => pairs.map(([k, v]) => ({ k: String(k), v: String(v) }));

// 2-D points are [x, y]; lifted to the x–z render plane as [x, 0, y]·U.
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const perp = (a) => [-a[1], a[0]];           // 90° left turn
// the World face pipeline keeps only faces with ≥4 corners, so pad a triangle to a degenerate quad.
const polyFill = (pts2, U, fill, group, alpha) => {
  const c = pts2.map((p) => [p[0] * U, 0, p[1] * U]);
  while (c.length < 4) c.push(c[c.length - 1]);
  return { corners: c, fill, group, ...(alpha != null ? { alpha } : {}) };
};
function edge(a2, b2, U, w, fill, group, alpha) {
  const A = [a2[0] * U, 0, a2[1] * U], B = [b2[0] * U, 0, b2[1] * U];
  const d = [B[0] - A[0], 0, B[2] - A[2]], L = Math.hypot(d[0], d[2]) || 1, px = (-d[2] / L) * w, pz = (d[0] / L) * w;
  return { corners: [[A[0] + px, 0, A[2] + pz], [B[0] + px, 0, B[2] + pz], [B[0] - px, 0, B[2] - pz], [A[0] - px, 0, A[2] - pz]], fill, group, ...(alpha != null ? { alpha } : {}) };
}
// the square built OUTWARD on edge P→Q (to the right of the direction P→Q).
function squareOn(P, Q, U, fill, group, alpha) {
  const d = sub(Q, P), n = perp(d);            // n points left of P→Q; we want outward = right → use −n
  const R = add(Q, [-n[0], -n[1]]), S = add(P, [-n[0], -n[1]]);
  return polyFill([P, Q, R, S], U, fill, group, alpha);
}

export const PYTHAGORAS_SCENARIOS = ['squares', 'dissection'];

const COL = { tri: '#e6c45a', sqA: '#5fa9e0', sqB: '#6ad29a', sqC: '#e0843c', edge: '#0a0e18', tile: '#e6c45a', inner: '#e0843c' };

/**
 * Resolve a recipe → { faces, picks, fields, bounds, stats }. Pure, deterministic.
 */
export function planPythagorasScene(recipe = {}) {
  const scen = PYTHAGORAS_SCENARIOS.includes(recipe.scenario) ? recipe.scenario : 'squares';
  const a = clampNum(recipe.a, 1, 8, 3), b = clampNum(recipe.b, 1, 8, 4);
  const c = Math.hypot(a, b);
  const U = 22 / (a + b + c);                  // fit the figure to a stable size

  const faces = [];
  let bounds, stats;

  if (scen === 'dissection') {
    // a (a+b)×(a+b) square; four right triangles in the corners leave a tilted c² square.
    const s = a + b;
    // the 4 triangles + the inner tilted square EXACTLY tile the (a+b)² square — so don't fill the big
    // square (it would z-fight with these coplanar pieces); just outline its boundary.
    const big = [[0, 0], [s, 0], [s, s], [0, s]];
    const inner = [[a, 0], [s, a], [b, s], [0, b]];
    const tris = [[[0, 0], [a, 0], [0, b]], [[s, 0], [s, a], [a, 0]], [[s, s], [b, s], [s, a]], [[0, s], [0, b], [b, s]]];
    for (const t of tris) faces.push(polyFill(t, U, COL.tile, 'tri', 1));
    faces.push(polyFill(inner, U, COL.inner, 'inner', 1));
    for (let i = 0; i < 4; i++) faces.push(edge(inner[i], inner[(i + 1) % 4], U, 0.05, '#10141c', 'inneredge', 1));
    for (let i = 0; i < 4; i++) faces.push(edge(big[i], big[(i + 1) % 4], U, 0.05, '#8794ad', 'bigedge', 0.7));
    bounds = { center: [s * U / 2, 0, s * U / 2], radius: s * U * 0.8 };
    stats = { scenario: scen, a, b, c: +c.toFixed(3), check: `(${a}+${b})² = 4·½·${a}·${b} + ${(c * c).toFixed(0)}` };
  } else {
    // right angle at C=(0,0); legs along the axes: B=(a,0), A=(0,b); hypotenuse A→B.
    const C = [0, 0], B = [a, 0], A = [0, b];
    // squareOn builds the square to the RIGHT of P→Q, so order each edge so "right" points OUTWARD
    // (away from the triangle): a-square below CB, b-square left of CA, c-square out past the hypotenuse.
    faces.push(squareOn(C, B, U, COL.sqA, 'sqA', 0.85));   // square on leg a (CB) → down, area a²
    faces.push(squareOn(A, C, U, COL.sqB, 'sqB', 0.85));   // square on leg b (CA) → left, area b²
    faces.push(squareOn(B, A, U, COL.sqC, 'sqC', 0.85));   // square on hypotenuse (AB) → out, area c²
    faces.push(polyFill([C, B, A], U, COL.tri, 'tri', 1));
    for (const [p, q] of [[C, B], [B, A], [A, C]]) faces.push(edge(p, q, U, 0.05, '#10141c', 'triedge', 1));
    bounds = { center: [(a - b) * U / 2, 0, (b - a) * U / 2], radius: (a + b + c) * U * 0.5 };
    stats = { scenario: scen, a, b, c: +c.toFixed(3), aSq: a * a, bSq: b * b, cSq: +(c * c).toFixed(2) };
  }

  const picks = [
    { name: scen === 'dissection' ? 'inner' : 'sqC', kind: 'pythagoras', label: `a² + b² = c²  (${a * a} + ${b * b} = ${(c * c).toFixed(0)})`, fields: compactFields([['a', String(a)], ['b', String(b)], ['c', c.toFixed(3)], ['why', scen === 'dissection' ? 'same big square, two ways' : 'blue + green area = orange area']]) },
  ];

  return {
    faces, picks,
    fields: [{ animate: false, sets: [], lines: [], readout: scen === 'dissection'
      ? [`Pythagoras — the dissection proof  (a=${a}, b=${b})`, 'one (a+b)² square holds four triangles around a tilted c² square', `(a+b)² = 4·(½ab) + c²  ⇒  a² + b² = c²   →   ${a * a} + ${b * b} = ${(c * c).toFixed(0)}`, 'the orange square is c² — the gap the four triangles leave']
      : [`Pythagoras — squares on the sides  (a=${a}, b=${b}, c=${c.toFixed(2)})`, 'the square on each leg, and on the hypotenuse — coloured by area', `a² + b² = c²   →   ${a * a} + ${b * b} = ${(c * c).toFixed(0)}`, 'blue (a²) + green (b²) tile exactly into orange (c²)'] }],
    bounds, stats,
  };
}

/**
 * Resolve a recipe → the emitThreeWorld payload — top-down on the figure (it lives in one plane).
 */
export function assemblePythagorasScene(recipe = {}, { title } = {}) {
  const scale = clampNum(recipe.scale, 0.2, 5, 1);
  const plan = planPythagorasScene(recipe);
  const sc = (cc) => [cc[0] * scale, cc[1] * scale, cc[2] * scale];
  const faces = plan.faces.map((f) => ({ ...f, corners: f.corners.map(sc) }));
  // frame from the actual geometry (the figure lives in the x–z plane → view it along −y).
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const c of f.corners) for (let i = 0; i < 3; i++) { if (c[i] < mn[i]) mn[i] = c[i]; if (c[i] > mx[i]) mx[i] = c[i]; }
  const ctr = [(mn[0] + mx[0]) / 2, 0, (mn[2] + mx[2]) / 2], d = 0.5 * Math.hypot(mx[0] - mn[0], mx[2] - mn[2]);

  const cameras = [
    { name: 'front', worldFraming: { cameraPosition: [ctr[0], -d * 2.3, ctr[2]], lookAt: ctr, horizontalFov: 46 } },
    { name: '3/4', worldFraming: { cameraPosition: [ctr[0] + d * 0.5, -d * 1.7, ctr[2] + d * 0.9], lookAt: ctr, horizontalFov: 48 } },
  ];
  const bg = (recipe.scene && /^#[0-9a-fA-F]{6}$/.test(recipe.scene.bg || '')) ? recipe.scene.bg : '#0a0e18';
  return {
    faces, picks: plan.picks, fields: plan.fields, cameras,
    viewBox: recipe.viewBox && typeof recipe.viewBox === 'object' ? recipe.viewBox : { width: 1000, height: 1000 },
    title: title || recipe.title || `mojulo pythagoras · ${plan.stats.scenario}`,
    bg, glow: false,
  };
}
