/**
 * SUN — the hard key light of an exterior stage, baked per vertex with a real shadow test: the era's vertex-lit
 * daylight, where an eave or a balcony throws a shadow onto the wall and a house throws one across the plaza.
 *
 * `makeSunShadow(faces, toSun, { cell })` → `(p, n) => 0 | 1` (1 = the sun reaches p). Every face is split into
 * triangles and binned in LIGHT SPACE (a grid on the plane perpendicular to the sun), so a query walks only the
 * triangles that could stand between p and the sun — a shadow map's lookup with an exact ray–triangle test.
 * `sunDir(elevationDeg, azimuthDeg)` → the unit vector toward the sun (z-up, azimuth from +x toward +y).
 * Deterministic; no dice.
 */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

export function sunDir(elevation, azimuth) {
  const e = (elevation * Math.PI) / 180, a = (azimuth * Math.PI) / 180;
  return [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
}

export function makeSunShadow(faces, toSun, { cell = 0.75, skip = () => false, maskOf = null } = {}) {
  const L = norm(toSun);
  let e1 = cross(L, [0, 0, 1]); if (Math.hypot(...e1) < 1e-6) e1 = [1, 0, 0]; e1 = norm(e1);
  const e2 = cross(L, e1);
  // `maskOf(face)` → { W, H, a } | null: a cutout card's alpha; the sun passes where the texel the ray crosses is clear
  const tris = [], masks = [];
  for (const f of faces) {
    if (skip(f) || !Array.isArray(f.corners) || f.corners.length < 3) continue;
    const m = maskOf && f.uv ? maskOf(f) : null;
    for (let i = 1; i + 1 < f.corners.length; i++) {
      tris.push([f.corners[0], f.corners[i], f.corners[i + 1]]);
      if (m) masks[tris.length - 1] = { m, uv: [f.uv[0], f.uv[i], f.uv[i + 1]] };
    }
  }
  const grid = new Map(), key = (i, j) => i * 73856093 ^ j * 19349663;
  tris.forEach((t, ti) => {
    const us = t.map((p) => dot(p, e1)), vs = t.map((p) => dot(p, e2));
    const i0 = Math.floor(Math.min(...us) / cell), i1 = Math.floor(Math.max(...us) / cell);
    const j0 = Math.floor(Math.min(...vs) / cell), j1 = Math.floor(Math.max(...vs) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(ti);
    }
  });
  // Möller–Trumbore along +L from o; a hit at t > eps means something stands between o and the sun
  const clear = (k, u, v) => {
    const { m, uv } = masks[k], w = 1 - u - v;
    const s = uv[0][0] * w + uv[1][0] * u + uv[2][0] * v, q = uv[0][1] * w + uv[1][1] * u + uv[2][1] * v;
    const x = Math.floor((s - Math.floor(s)) * m.W), y = Math.floor((1 - (q - Math.floor(q))) * m.H);   // v up: the image's row 0 is v = 1
    return m.a[Math.min(m.H - 1, y) * m.W + Math.min(m.W - 1, x)] === 0;
  };
  const hits = (o, t, k) => {
    const [a, b, c] = t, ab = sub(b, a), ac = sub(c, a), pv = cross(L, ac), det = dot(ab, pv);
    if (Math.abs(det) < 1e-12) return false;
    const inv = 1 / det, tv = sub(o, a), u = dot(tv, pv) * inv;
    if (u < 0 || u > 1) return false;
    const qv = cross(tv, ab), v = dot(L, qv) * inv;
    if (v < 0 || u + v > 1) return false;
    if (dot(ac, qv) * inv <= 1e-3) return false;
    return !(masks[k] && clear(k, u, v));
  };
  return (p, n) => {
    if (n && dot(n, L) <= 0) return 0;   // facing away: self-shadowed
    const o = n ? [p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02] : p;
    const b = grid.get(key(Math.floor(dot(o, e1) / cell), Math.floor(dot(o, e2) / cell)));
    if (!b) return 1;
    for (const ti of b) if (hits(o, tris[ti], ti)) return 0;
    return 1;
  };
}
