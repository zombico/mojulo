/**
 * THE APPLIANCE BUILDERS: a make-up artist's pieces as closed meshes in the hero's metres, built on the xeno frame's
 * points (./frame.js), each with the centre line it was built along so its coat maps on it (hair-coat-words.js
 * lockCoatFrame: along it, and round it from its outer face).
 *
 *   ridgeMesh(samples, { height, width, sink, K })  a RIDGE laid on the skin: a bump across its path, its base sunk under
 *                                                  the skin and its edges falling to it with no step (the feathered edge
 *                                                  of a glued appliance), its height and width by the place along it
 *   tubeMesh(line, { radius, R })                  a TAIL or a tendril: a tapered tube along a centre line, its root sunk
 *                                                  in the skull and closed, its tip a point
 *   bladeMesh(line, { radius, flat, face, R })     a LOBE: the tube flattened, its section an ellipse `flat` as thick as it
 *                                                  is wide, its broad face toward `face(i)` (a direction per point)
 *
 * `samples` are the frame's hits `{ p, n }` (a point on the skin, its outward normal) in order; `height(t)` and
 * `width(t)` metres at t 0 … 1 along them. → { vertices, faces, line } (line: the centre the coat reads). Pure.
 */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** the normals along a path, each the mean of its neighbours' (a cast's normal is one triangle's: noisy) */
const smoothNormals = (S) => S.map((_, i) => unit(S.slice(Math.max(0, i - 1), i + 2).reduce((a, s) => add(a, s.n), [0, 0, 0])));

/** A ridge on the skin along `samples`. Its section: K points over the bump (x −1 … 1, the bump (1 − x²)^1.5, its base
 * at the sink) and one under it, a closed ring; its ends drawn to points under the skin. */
export function ridgeMesh(samples, { height, width, sink = 0.002, K = 9 }) {
  const N = samples.length; if (N < 2) return null;
  const n = smoothNormals(samples), P = samples.map((s) => s.p), vertices = [], faces = [];
  const T = P.map((_, i) => unit(sub(P[Math.min(N - 1, i + 1)], P[Math.max(0, i - 1)])));
  const rings = [];
  for (let i = 0; i < N; i++) {
    const t = N === 1 ? 0 : i / (N - 1), h = Math.max(0, height(t)), w = Math.max(1e-4, width(t)), b = unit(cross(T[i], n[i])), base = sub(P[i], mul(n[i], sink));
    const ring = [];
    for (let j = 0; j < K; j++) { const x = -1 + (2 * j) / (K - 1), up = (h + sink) * (1 - x * x) ** 1.5; ring.push(vertices.push(add(add(base, mul(b, (x * w) / 2)), mul(n[i], up))) - 1); }
    ring.push(vertices.push(sub(base, mul(n[i], sink))) - 1);   // the underside, below the skin
    rings.push(ring);
  }
  const M = K + 1;
  for (let i = 0; i < N - 1; i++) for (let j = 0; j < M; j++) { const a = rings[i][j], b = rings[i][(j + 1) % M], c = rings[i + 1][(j + 1) % M], d = rings[i + 1][j]; faces.push([a, d, c], [a, c, b]); }
  const cap = (ring, at, flip) => { const e = vertices.push(at) - 1; for (let j = 0; j < M; j++) { const a = ring[j], b = ring[(j + 1) % M]; faces.push(flip ? [e, b, a] : [e, a, b]); } };
  cap(rings[0], sub(P[0], mul(n[0], sink)), false);
  cap(rings[N - 1], sub(P[N - 1], mul(n[N - 1], sink)), true);
  return { vertices, faces, line: P };
}

/** A tapered tube along `line` (its first point the root, sunk), `radius(t)` metres, R round. */
export function tubeMesh(line, { radius, R = 10 }) {
  const N = line.length; if (N < 2) return null;
  const vertices = [], faces = [], rings = [];
  const T = line.map((_, i) => unit(sub(line[Math.min(N - 1, i + 1)], line[Math.max(0, i - 1)])));
  // a frame carried along the line without twisting (each side vector the last one made square to the new tangent)
  let side = unit(cross(T[0], Math.abs(T[0][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
  for (let i = 0; i < N - 1; i++) {
    side = unit(sub(side, mul(T[i], dot(side, T[i])))); const up = cross(T[i], side), r = radius(i / (N - 1)), ring = [];
    for (let j = 0; j < R; j++) { const a = (2 * Math.PI * j) / R; ring.push(vertices.push(add(line[i], add(mul(side, r * Math.cos(a)), mul(up, r * Math.sin(a))))) - 1); }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < R; j++) { const a = rings[i][j], b = rings[i][(j + 1) % R], c = rings[i + 1][(j + 1) % R], d = rings[i + 1][j]; faces.push([a, b, c], [a, c, d]); }
  const root = vertices.push(line[0]) - 1, tip = vertices.push(line[N - 1]) - 1;
  for (let j = 0; j < R; j++) { faces.push([root, rings[0][(j + 1) % R], rings[0][j]]); faces.push([tip, rings.at(-1)[j], rings.at(-1)[(j + 1) % R]]); }
  return { vertices, faces, line };
}

/** A flattened tube along `line`: at each point an ellipse `2·radius(t)` across and `flat` of that thick, its thin axis
 * the direction `face(i)` made square to the line (its broad FRONT that way), R round; root and tip closed as a tube's.
 * → { vertices, faces, line, across, front } (across and front: each ring's axes, for what is laid on its face). */
export function bladeMesh(line, { radius, flat = 0.35, face, R = 14 }) {
  const N = line.length; if (N < 2) return null;
  const vertices = [], faces = [], rings = [], across = [], front = [];
  const T = line.map((_, i) => unit(sub(line[Math.min(N - 1, i + 1)], line[Math.max(0, i - 1)])));
  let f0 = null;
  for (let i = 0; i < N - 1; i++) {
    let f = face(i); f = sub(f, mul(T[i], dot(f, T[i])));
    if (Math.hypot(f[0], f[1], f[2]) < 1e-6) f = f0 ?? unit(cross(T[i], Math.abs(T[i][2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]));
    f = unit(f); if (f0 && dot(f, f0) < 0) f = mul(f, -1); f0 = f;
    const w = unit(cross(T[i], f)), r = radius(i / (N - 1)), ring = [];
    for (let j = 0; j < R; j++) { const a = (2 * Math.PI * j) / R; ring.push(vertices.push(add(line[i], add(mul(w, r * Math.cos(a)), mul(f, r * flat * Math.sin(a))))) - 1); }
    rings.push(ring); across.push(w); front.push(f);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < R; j++) { const a = rings[i][j], b = rings[i][(j + 1) % R], c = rings[i + 1][(j + 1) % R], d = rings[i + 1][j]; faces.push([a, b, c], [a, c, d]); }
  const root = vertices.push(line[0]) - 1, tip = vertices.push(line[N - 1]) - 1;
  for (let j = 0; j < R; j++) { faces.push([root, rings[0][(j + 1) % R], rings[0][j]]); faces.push([tip, rings.at(-1)[j], rings.at(-1)[(j + 1) % R]]); }
  return { vertices, faces, line, across, front };
}
