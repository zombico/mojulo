/**
 * THE SURVEYOR: what an eye sees of a form land, solved from the recipe's own data, not from a render. A world is
 * deterministic, so the line of sight from a point is a property of the point: each sample of the image is a ray from
 * the eye cast over the land's triangles (form/land-read.js formPayload `pos`, its classes by `ranges`) and read against
 * the grass's ground map (`grass`). For the far field (scene/channels/far-field.js) it says, sample by sample, where the
 * ground is met, how far, whether the grass map covers it and grass grows there, and where the land's CONTOUR is (the
 * ground's edge against the sky or against ground farther than `edge` × its own distance).
 *
 *   surveyView(land, { eye, target, vfov, aspect, cols, rows, reach, edge? }) → { cols, rows, samples, counts }
 *     samples[row][col]: null (sky) or { d, at: [x, y, z], cls, map: 'in' | 'out', cover (0..1), contour }
 *     counts: { sky, near, far, farGrass, farOutside, farBare, contour }; byClass: { <land class>: { far, grass } }
 *   surveyChart(survey, reach) → the image as text, a character a sample, the top row first:
 *     ' ' sky, '.' inside the reach, and past it: '^' a contour of grass, 'G' grass the map covers on `ground`, 'g' on
 *     another class (the class is the page's: its shader may treat it apart), 'o' outside the grass map, 'n' no grass
 *
 * Pure and deterministic; triangles are binned on a grid of `BIN` m so a ray walks only the bins under it.
 */
const BIN = 4;

function landOf(land) {
  const raw = Buffer.from(land.pos, 'base64'), pos = new Float32Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength));
  const cls = new Array(pos.length / 9);
  for (const R of land.ranges) for (let v = R.start; v < R.start + R.count; v += 3) cls[v / 3] = R.key;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pos.length; i += 3) { x0 = Math.min(x0, pos[i]); x1 = Math.max(x1, pos[i]); y0 = Math.min(y0, pos[i + 1]); y1 = Math.max(y1, pos[i + 1]); }
  const nx = Math.max(1, Math.ceil((x1 - x0) / BIN)), ny = Math.max(1, Math.ceil((y1 - y0) / BIN)), bins = Array.from({ length: nx * ny }, () => []);
  for (let t = 0; t < pos.length / 9; t++) {
    const o = t * 9, xs = [pos[o], pos[o + 3], pos[o + 6]], ys = [pos[o + 1], pos[o + 4], pos[o + 7]];
    const i0 = Math.floor((Math.min(...xs) - x0) / BIN), i1 = Math.floor((Math.max(...xs) - x0) / BIN), j0 = Math.floor((Math.min(...ys) - y0) / BIN), j1 = Math.floor((Math.max(...ys) - y0) / BIN);
    for (let j = Math.max(0, j0); j <= Math.min(ny - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) bins[j * nx + i].push(t);
  }
  return { pos, cls, x0, y0, nx, ny, bins };
}

// (a ray against one triangle, Möller–Trumbore: its distance, or Infinity)
function hitTri(p, o, d) {
  const ax = p[o], ay = p[o + 1], az = p[o + 2], e1 = [p[o + 3] - ax, p[o + 4] - ay, p[o + 5] - az], e2 = [p[o + 6] - ax, p[o + 7] - ay, p[o + 8] - az];
  const h = [d[1] * e2[2] - d[2] * e2[1], d[2] * e2[0] - d[0] * e2[2], d[0] * e2[1] - d[1] * e2[0]], a = e1[0] * h[0] + e1[1] * h[1] + e1[2] * h[2];
  if (Math.abs(a) < 1e-9) return Infinity;
  const f = 1 / a, s = [d.o[0] - ax, d.o[1] - ay, d.o[2] - az], u = f * (s[0] * h[0] + s[1] * h[1] + s[2] * h[2]);
  if (u < 0 || u > 1) return Infinity;
  const q = [s[1] * e1[2] - s[2] * e1[1], s[2] * e1[0] - s[0] * e1[2], s[0] * e1[1] - s[1] * e1[0]], v = f * (d[0] * q[0] + d[1] * q[1] + d[2] * q[2]);
  if (v < 0 || u + v > 1) return Infinity;
  const t = f * (e2[0] * q[0] + e2[1] * q[1] + e2[2] * q[2]);
  return t > 1e-4 ? t : Infinity;
}

// (the nearest land along a ray: walk the bins under it in order, the first bin with a hit inside it wins)
function castRay(L, o, d, far) {
  const dx = d[0], dy = d[1], gx = (o[0] - L.x0) / BIN, gy = (o[1] - L.y0) / BIN;
  let i = Math.floor(gx), j = Math.floor(gy);
  const sx = Math.sign(dx), sy = Math.sign(dy), hx = Math.hypot(dx, dy) || 1e-9;
  const tdx = dx ? BIN / Math.abs(dx) : Infinity, tdy = dy ? BIN / Math.abs(dy) : Infinity;
  let tx = dx ? ((sx > 0 ? i + 1 - gx : gx - i) * BIN) / Math.abs(dx) : Infinity, ty = dy ? ((sy > 0 ? j + 1 - gy : gy - j) * BIN) / Math.abs(dy) : Infinity, t0 = 0;
  const ray = Object.assign([dx, dy, d[2]], { o });
  for (let n = 0; n < 4096 && t0 < far; n++) {
    if (i >= 0 && j >= 0 && i < L.nx && j < L.ny) {
      let best = Infinity, bt = -1; const tEnd = Math.min(tx, ty);
      for (const t of L.bins[j * L.nx + i]) { const h = hitTri(L.pos, t * 9, ray); if (h < best) { best = h; bt = t; } }
      if (bt >= 0 && best <= tEnd + 1e-6) return { t: best, tri: bt };
    } else if ((i < 0 && sx <= 0) || (i >= L.nx && sx >= 0) || (j < 0 && sy <= 0) || (j >= L.ny && sy >= 0)) break;
    if (hx < 1e-6) break;
    if (tx < ty) { t0 = tx; tx += tdx; i += sx; } else { t0 = ty; ty += tdy; j += sy; }
  }
  return null;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const norm = (a) => { const l = Math.hypot(...a) || 1; return a.map((v) => v / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** The grass map's reading at a world point: whether the map holds it, and the cover there (0..1). */
function grassAt(G, px, x, y) {
  if (!G) return { map: 'out', cover: 0 };
  const i = Math.round((x - G.origin[0]) / G.cell), j = Math.round((y - G.origin[1]) / G.cell);
  if (i < 0 || j < 0 || i >= G.size[0] || j >= G.size[1]) return { map: 'out', cover: 0 };
  return { map: 'in', cover: px[(j * G.size[0] + i) * 4 + 2] / 255 };
}

export function surveyView(land, { eye, target, vfov = 50, aspect = 16 / 9, cols = 96, rows = 40, reach = 25, edge = 1.2, far = 4000 } = {}) {
  const L = landOf(land), G = land.grass, gpx = G ? Buffer.from(G.px, 'base64') : null;
  const f = norm(sub(target, eye)), r = norm(cross(f, [0, 0, 1])), u = cross(r, f), th = Math.tan((vfov * Math.PI) / 360), tw = th * aspect;
  const samples = [];
  for (let row = 0; row < rows; row++) {
    const line = [], sv = (1 - ((row + 0.5) / rows) * 2) * th;
    for (let col = 0; col < cols; col++) {
      const su = (((col + 0.5) / cols) * 2 - 1) * tw, d = norm([f[0] + r[0] * su + u[0] * sv, f[1] + r[1] * su + u[1] * sv, f[2] + r[2] * su + u[2] * sv]);
      const h = castRay(L, eye, d, far);
      if (!h) { line.push(null); continue; }
      const at = [eye[0] + d[0] * h.t, eye[1] + d[1] * h.t, eye[2] + d[2] * h.t], g = grassAt(G, gpx, at[0], at[1]);
      line.push({ d: Math.hypot(at[0] - eye[0], at[1] - eye[1]), at: at.map((v) => Math.round(v * 100) / 100), cls: L.cls[h.tri], ...g, contour: false });
    }
    samples.push(line);
  }
  // (the contour: a sample of far grass whose sample above is the sky or ground farther than `edge` × its own)
  for (let row = 1; row < rows; row++) for (let col = 0; col < cols; col++) {
    const s = samples[row][col], up = samples[row - 1][col];
    if (s && s.d >= reach && s.cover > 0 && (!up || up.d > s.d * edge)) s.contour = true;
  }
  const counts = { sky: 0, near: 0, far: 0, farGrass: 0, farOutside: 0, farBare: 0, contour: 0 }, byClass = {};
  for (const line of samples) for (const s of line) {
    if (!s) { counts.sky++; continue; }
    if (s.d < reach) { counts.near++; continue; }
    counts.far++;
    if (s.contour) counts.contour++;
    const B = (byClass[s.cls] ||= { far: 0, grass: 0 }); B.far++;
    if (s.map === 'out') counts.farOutside++;
    else if (s.cover > 0) { counts.farGrass++; B.grass++; } else counts.farBare++;
  }
  return { cols, rows, samples, counts, byClass };
}

export function surveyChart({ samples }, reach) {
  return samples.map((line) => line.map((s) => {
    if (!s) return ' ';
    if (s.d < reach) return '.';
    if (s.contour) return '^';
    return s.map === 'out' ? 'o' : s.cover > 0 ? (s.cls === 'ground' ? 'G' : 'g') : 'n';
  }).join('')).join('\n');
}
