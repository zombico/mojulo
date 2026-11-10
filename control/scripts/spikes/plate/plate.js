/**
 * plate — a drawn illustration of solid forms (spike; the Rendrant revival's tractability probe).
 *
 * The old sketch expander shades flat shapes the agent placed in pixels. This draws the other way round, the way a
 * drawing master teaches it, and every step is a principle the agent already holds:
 *
 *   1. THE PICTURE PLANE IS A CAMERA. A level eye, a horizon and two vanishing points fix one station point (the
 *      vanishing points' distances from the centre of vision multiply to the focal length squared). So the agent
 *      never places pixels: it stands forms on the ground in metres and names where it stands (`station`).
 *   2. BLOCK IN WITH SOLIDS. A form is a list of the studio's own field terms (sphere, ellipsoid, box, capsule,
 *      lathe, sweep, blended or cut): what `mint_solid` already reads. Anything minted can be drawn.
 *   3. ONE LIGHT, FIVE VALUES. Light, halftone, core shadow, reflected light and cast shadow are not painted; they
 *      are measured where the eye's ray meets the form, as one tone per sample of the picture plane.
 *   4. A TONE IS A SHAPE LAID OVER A SHAPE. Each value step is the closed outline of "darker than this", laid
 *      translucent over the lighter one: chiaroscuro by superposition. More steps, a softer edge; one step, a woodcut.
 *   5. A HATCH FOLLOWS THE FORM. A hatch line is a slice of the form by a plane square to the light, so it wraps a
 *      sphere, runs straight on a box and converges on the same vanishing points as the box's edges.
 *   6. THE LINE IS LOST AND FOUND. The contour is heavier on the side away from the light.
 *
 * The output is curves (cubic paths), never a raster: the tone field is sampled on the picture plane and then
 * contoured, so the page that carries it stays a small SVG. Pure and deterministic: no dice, no clock.
 */

import { composeFieldTerms } from '../../../lib/graph/polygonizer/field-terms.js';

const V = (x, y, z) => ({ x, y, z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const add = (a, b, s = 1) => V(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
const unit = (a) => { const l = Math.hypot(a.x, a.y, a.z) || 1; return V(a.x / l, a.y / l, a.z / l); };
const rad = (deg) => (deg * Math.PI) / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;

// ─── 1. the station: two-point perspective as a camera ──────────────────────────────────────────────────────────

/**
 * `station: { turn (deg the view is turned off world +y), eye (m), distance (m), lens (deg), look:[x,y,z] }`.
 * The eye is level, so verticals stay vertical; the horizon rises or falls instead (a rising front, never a tilt).
 */
export function stationRig({ width, height, station = {} }) {
  const turn = rad(station.turn ?? 35);
  const eye = station.eye ?? 1.5;
  const distance = station.distance ?? 5;
  const look = station.look ?? [0, 0, 0.5];
  const f = width / 2 / Math.tan(rad(station.lens ?? 40) / 2);
  const fwd = V(Math.sin(turn), Math.cos(turn), 0);
  const right = V(Math.cos(turn), -Math.sin(turn), 0);
  const up = V(0, 0, 1);
  const origin = V(look[0] - fwd.x * distance, look[1] - fwd.y * distance, eye);
  const cx = width / 2;
  const horizonY = height * (station.centre ?? 0.5) + (f * (look[2] - eye)) / distance;
  const project = (p) => {
    const q = V(p.x - origin.x, p.y - origin.y, p.z - origin.z);
    const zf = dot(q, fwd);
    return [cx + (f * dot(q, right)) / zf, horizonY - (f * q.z) / zf, zf];
  };
  const ray = (sx, sy) => unit(V(
    fwd.x * f + right.x * (sx - cx), fwd.y * f + right.y * (sx - cx), horizonY - sy,
  ));
  // where the world's x and y edges vanish; (vpX - cx) * (cx - vpY) = f²
  const vanishing = { x: [cx + f / Math.tan(turn), horizonY], y: [cx - f * Math.tan(turn), horizonY] };
  return { width, height, f, cx, horizonY, origin, fwd, right, up, project, ray, vanishing };
}

/** `light: { azimuth, elevation }` as the draughtsman says it: azimuth 0 from behind the eye, -90 from the left. */
function lightDirection(rig, light = {}) {
  const az = rad(light.azimuth ?? -55), el = rad(light.elevation ?? 42);
  const h = V(-rig.fwd.x * Math.cos(az) + rig.right.x * Math.sin(az), -rig.fwd.y * Math.cos(az) + rig.right.y * Math.sin(az), 0);
  return unit(V(h.x * Math.cos(el), h.y * Math.cos(el), Math.sin(el)));
}

// ─── 2 + 3. forms, and the tone where the eye's ray meets them ──────────────────────────────────────────────────

function slab(o, d, b, pad) {
  let t0 = 0, t1 = Infinity;
  for (const k of ['x', 'y', 'z']) {
    const inv = 1 / (Math.abs(d[k]) < 1e-12 ? 1e-12 : d[k]);
    let a = (b.min[k] - pad - o[k]) * inv, c = (b.max[k] + pad - o[k]) * inv;
    if (a > c) [a, c] = [c, a];
    if (a > t0) t0 = a;
    if (c < t1) t1 = c;
    if (t0 > t1) return null;
  }
  return [t0, t1];
}

function march(form, o, d, t0, t1, footprint) {
  let t = t0;
  for (let i = 0; i < 200 && t <= t1; i++) {
    const dist = form.d(add(o, d, t));
    if (dist < footprint * t) return t;
    t += dist * 0.7;
  }
  return Infinity;
}

function normalAt(form, p, h) {
  return unit(V(
    form.d(V(p.x + h, p.y, p.z)) - form.d(V(p.x - h, p.y, p.z)),
    form.d(V(p.x, p.y + h, p.z)) - form.d(V(p.x, p.y - h, p.z)),
    form.d(V(p.x, p.y, p.z + h)) - form.d(V(p.x, p.y, p.z - h)),
  ));
}

function shadowAt(forms, p, L, softness) {
  let res = 1;
  for (const form of forms) {
    const hit = slab(p, L, form.bounds, 0.02);
    if (!hit) continue;
    let t = Math.max(hit[0], 0.012);
    for (let i = 0; i < 56 && t < hit[1]; i++) {
      const dist = form.d(add(p, L, t));
      if (dist < 1e-4) return 0;
      res = Math.min(res, (softness * dist) / t);
      t += clamp(dist, 0.006, 0.25);
    }
  }
  return clamp(res, 0, 1);
}

function occlusionAt(forms, ground, p, n, reach) {
  let occ = 0, w = 1;
  for (let i = 1; i <= 4; i++) {
    const h = (reach * i) / 4, q = add(p, n, h);
    let dist = ground ? q.z : Infinity;
    for (const form of forms) dist = Math.min(dist, form.d(q));
    occ += (h - Math.min(dist, h)) * w;
    w *= 0.62;
  }
  return clamp(1 - (1.9 * occ) / reach, 0, 1);
}

/**
 * Sample the picture plane: per sample, which form the eye meets (0 none, 1 ground, 2.. forms), how light it is
 * (0..1), its depth, its normal and where along the light it sits (the hatch coordinate).
 */
export function toneField(plate, rig, res) {
  const W = Math.round(rig.width * res), H = Math.round(rig.height * res), N = W * H;
  const forms = plate.forms.map((f) => composeFieldTerms(f.terms));
  const L = lightDirection(rig, plate.light);
  const cross = unit(V(L.y * rig.up.z - L.z * rig.up.y, L.z * rig.up.x - L.x * rig.up.z, L.x * rig.up.y - L.y * rig.up.x));
  const fillDir = unit(V(-L.x, -L.y, 0.25));
  const ground = plate.ground !== false;
  const softness = plate.light?.softness ?? 9;
  const reach = plate.light?.occlusion ?? 0.22;
  const footprint = 0.5 / (rig.f * res);
  const id = new Uint16Array(N), lum = new Float32Array(N), depth = new Float32Array(N).fill(Infinity);
  const gloss = new Float32Array(N), hatchA = new Float32Array(N), hatchB = new Float32Array(N);
  const nrm = new Float32Array(N * 3);
  const o = rig.origin;
  const half = unit(add(L, rig.fwd, -1));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = rig.ray((x + 0.5) / res, (y + 0.5) / res);
      let best = Infinity, who = -1;
      for (let i = 0; i < forms.length; i++) {
        const hit = slab(o, d, forms[i].bounds, 0.01);
        if (!hit || hit[0] > best) continue;
        const t = march(forms[i], o, d, hit[0], Math.min(hit[1], best), footprint);
        if (t < best) { best = t; who = i; }
      }
      const tg = ground && d.z < -1e-6 ? -o.z / d.z : Infinity;
      const k = y * W + x;
      let n, p;
      if (who >= 0 && best < tg) {
        p = add(o, d, best);
        n = normalAt(forms[who], p, Math.max(footprint * best, 4e-4));
        id[k] = who + 2; depth[k] = best;
      } else if (tg < Infinity) {
        p = add(o, d, tg); n = rig.up; id[k] = 1; depth[k] = tg;
      } else continue;
      const lifted = add(p, n, Math.max(footprint * depth[k] * 3, 2e-3));
      const lambert = Math.max(0, dot(n, L));
      const lit = lambert > 0 ? lambert * shadowAt(forms, lifted, L, softness) : 0;
      // on the ground only the contact shadow reads; its wider dimming would be a puddle round every form
      const ao = who >= 0 && best < tg ? occlusionAt(forms, ground, p, n, reach) : 0.55 + 0.45 * occlusionAt(forms, false, p, n, reach * 0.6);
      // the fill is what the ground and the room throw back: it is why the core shadow sits beside the terminator
      const fill = (0.1 + 0.1 * Math.max(0, dot(n, fillDir)) + 0.06 * (0.5 - 0.5 * n.z)) * (0.35 + 0.65 * ao);
      lum[k] = clamp(fill + 0.86 * lit * (0.6 + 0.4 * ao), 0, 1);
      gloss[k] = lit > 0 ? Math.pow(Math.max(0, dot(n, half)), 60) : 0;
      hatchA[k] = dot(p, L); hatchB[k] = dot(p, cross);
      nrm[k * 3] = n.x; nrm[k * 3 + 1] = n.y; nrm[k * 3 + 2] = n.z;
    }
  }
  return { W, H, res, id, lum, depth, gloss, hatchA, hatchB, nrm, L, groundLum: clamp(0.16 + 0.86 * L.z, 0, 1) };
}

// ─── 4. tones as shapes: contouring the field ───────────────────────────────────────────────────────────────────

const CASES = [
  [], [[3, 0]], [[0, 1]], [[3, 1]], [[1, 2]], null, [[0, 2]], [[3, 2]],
  [[3, 2]], [[0, 2]], null, [[1, 2]], [[3, 1]], [[0, 1]], [[3, 0]], [],
];

/**
 * Marching squares over `field > level`. `valid` (optional) leaves out cells with a sample outside it, which gives
 * open lines (a hatch); without it the grid is closed off at its border, which gives closed outlines (a tone).
 * Returns polylines in sample coordinates, each `{ pts, closed }`.
 */
export function contour(field, W, H, level, valid = null) {
  const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -Infinity : field[y * W + x]);
  const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && valid[y * W + x];
  const Wp = W + 2;
  const key = (x, y, vertical) => 2 * ((y + 1) * Wp + (x + 1)) + vertical;
  const point = new Map(), link = new Map();
  const cross = (x0, y0, x1, y1) => {
    const a = at(x0, y0), b = at(x1, y1);
    let t = 0.5;
    if (Number.isFinite(a) && Number.isFinite(b) && a !== b) t = clamp((level - a) / (b - a), 0, 1);
    else if (!Number.isFinite(a)) t = 0.5;
    return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t];
  };
  const lo = valid ? 0 : -1, hx = valid ? W - 1 : W, hy = valid ? H - 1 : H;
  for (let y = lo; y < hy; y++) {
    for (let x = lo; x < hx; x++) {
      if (valid && !(ok(x, y) && ok(x + 1, y) && ok(x + 1, y + 1) && ok(x, y + 1))) continue;
      const a = at(x, y), b = at(x + 1, y), c = at(x + 1, y + 1), d = at(x, y + 1);
      const idx = (a > level ? 1 : 0) | (b > level ? 2 : 0) | (c > level ? 4 : 0) | (d > level ? 8 : 0);
      if (idx === 0 || idx === 15) continue;
      let segs = CASES[idx];
      if (!segs) {
        const centre = (a + b + c + d) / 4 > level;
        segs = (idx === 5) === centre ? [[0, 1], [3, 2]] : [[3, 0], [1, 2]];
      }
      const edge = [key(x, y, 0), key(x + 1, y, 1), key(x, y + 1, 0), key(x, y, 1)];
      for (const [e0, e1] of segs) {
        for (const e of [e0, e1]) {
          if (point.has(edge[e])) continue;
          point.set(edge[e], e === 0 ? cross(x, y, x + 1, y) : e === 1 ? cross(x + 1, y, x + 1, y + 1)
            : e === 2 ? cross(x, y + 1, x + 1, y + 1) : cross(x, y, x, y + 1));
        }
        const k0 = edge[e0], k1 = edge[e1];
        (link.get(k0) || link.set(k0, []).get(k0)).push(k1);
        (link.get(k1) || link.set(k1, []).get(k1)).push(k0);
      }
    }
  }
  const out = [], used = new Set();
  const walk = (start) => {
    const pts = [point.get(start)];
    used.add(start);
    let cur = start, closed = false;
    for (;;) {
      const next = link.get(cur).find((k) => !used.has(k));
      if (next === undefined) { closed = link.get(cur).includes(start) && pts.length > 2; break; }
      used.add(next); pts.push(point.get(next)); cur = next;
    }
    out.push({ pts, closed });
  };
  for (const [k, ns] of link) if (ns.length === 1 && !used.has(k)) walk(k);
  for (const k of link.keys()) if (!used.has(k)) walk(k);
  return out;
}

function simplify(pts, eps) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1e-9;
    let worst = -1, far = eps;
    for (let i = a + 1; i < b; i++) {
      const dist = len < 1e-6 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / len;
      if (dist > far) { far = dist; worst = i; }
    }
    if (worst > 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

/** A polyline as a cubic path: smooth through its points, sharp where it turns hard (a box's corner stays one). */
export function curvePath({ pts, closed }, scale, { eps = 0.45, corner = 62 } = {}) {
  let p = pts;
  if (closed && p.length > 8) {
    // open the loop at its sharpest turn so the seam is never in the middle of a curve
    let far = 0, at = 0;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i - 3 + p.length) % p.length], b = p[i], c = p[(i + 3) % p.length];
      const turn = Math.abs(Math.atan2((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]), (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1])));
      if (turn > far) { far = turn; at = i; }
    }
    p = [...p.slice(at), ...p.slice(0, at), p[at]];
  }
  p = simplify(p, eps);
  const n = p.length;
  if (n < 2) return '';
  const cosCorner = Math.cos(rad(corner));
  const tangent = (i) => {
    const prev = p[i - 1] ?? (closed ? p[n - 2] : null), next = p[i + 1] ?? (closed ? p[1] : null);
    if (!prev || !next) return null;
    const ax = p[i][0] - prev[0], ay = p[i][1] - prev[1], bx = next[0] - p[i][0], by = next[1] - p[i][1];
    const la = Math.hypot(ax, ay) || 1e-9, lb = Math.hypot(bx, by) || 1e-9;
    const cos = (ax * bx + ay * by) / (la * lb);
    // a corner has no shared tangent: a hard turn, or a turn too large for a curve that simplified to runs this long
    if (cos < cosCorner || Math.acos(clamp(cos, -1, 1)) * Math.min(la, lb) > 24 * eps) return null;
    // a run much longer than its neighbour is a straight edge: the curve leaves along it, never bows it
    const wa = la > 2.5 * lb ? 1 : lb > 2.5 * la ? 0 : 0.5;
    const tx = (ax / la) * wa + (bx / lb) * (1 - wa), ty = (ay / la) * wa + (by / lb) * (1 - wa), l = Math.hypot(tx, ty) || 1e-9;
    return [tx / l, ty / l, la, lb];
  };
  const s = (v) => r1(v * scale);
  let d = `M${s(p[0][0])} ${s(p[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const a = p[i], b = p[i + 1], ta = tangent(i), tb = tangent(i + 1);
    const span = Math.hypot(b[0] - a[0], b[1] - a[1]) / 3;
    if (!ta && !tb) { d += `L${s(b[0])} ${s(b[1])}`; continue; }
    const c1 = ta ? [a[0] + ta[0] * span, a[1] + ta[1] * span] : a;
    const c2 = tb ? [b[0] - tb[0] * span, b[1] - tb[1] * span] : b;
    d += `C${s(c1[0])} ${s(c1[1])} ${s(c2[0])} ${s(c2[1])} ${s(b[0])} ${s(b[1])}`;
  }
  return closed ? `${d}Z` : d;
}

function blur(src, W, H, passes = 2) {
  let a = src, b = new Float32Array(src.length);
  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let sum = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        sum += a[yy * W + xx]; n++;
      }
      b[y * W + x] = sum / n;
    }
    [a, b] = [b, a === src ? new Float32Array(src.length) : a];
  }
  return a;
}

/** Carry a form's values a few samples past its edge, so a tone's outline crosses the silhouette cleanly. */
function spread(field, mask, W, H, rounds = 4, soften = 0) {
  const out = Float32Array.from(field), have = Uint8Array.from(mask);
  for (let pass = 0; pass < soften; pass++) {
    const src = Float32Array.from(out);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue;
      let sum = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || !mask[yy * W + xx]) continue;
        sum += src[yy * W + xx]; n++;
      }
      out[y * W + x] = sum / n;
    }
  }
  for (let round = 0; round < rounds; round++) {
    const next = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const k = y * W + x;
      if (have[k]) continue;
      let sum = 0, n = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H || !have[yy * W + xx]) continue;
        sum += out[yy * W + xx]; n++;
      }
      if (n) next.push([k, sum / n]);
    }
    for (const [k, v] of next) { out[k] = v; have[k] = 1; }
  }
  return { field: out, have };
}

/** A form's smooth patches: samples joined while depth and normal run on. Their borders are the inner edges. */
function patches(T, mask) {
  const { W, H, depth, nrm } = T, label = new Int32Array(W * H).fill(-1), sizes = [];
  const joined = (a, b) => Math.abs(depth[a] - depth[b]) < 0.012 * depth[a] + 0.004
    && nrm[a * 3] * nrm[b * 3] + nrm[a * 3 + 1] * nrm[b * 3 + 1] + nrm[a * 3 + 2] * nrm[b * 3 + 2] > 0.72;
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || label[s] >= 0) continue;
    const idx = sizes.length, stack = [s];
    label[s] = idx;
    let size = 0;
    while (stack.length) {
      const k = stack.pop(), x = k % W, y = (k - x) / W;
      size++;
      for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const q = yy * W + xx;
        if (mask[q] && label[q] < 0 && joined(k, q)) { label[q] = idx; stack.push(q); }
      }
    }
    sizes.push(size);
  }
  return { label, sizes };
}

// ─── 5 + 6. finishes: the plate as curves ───────────────────────────────────────────────────────────────────────

export const FINISHES = {
  // tone steps: [lighter than this is left alone, opacity of the ink laid over what is darker]
  wash: { paper: '#ecdfc4', ink: '#2a1c12', steps: [[0.8, 0.1], [0.64, 0.12], [0.5, 0.14], [0.38, 0.16], [0.27, 0.2], [0.17, 0.26]], line: 0.9 },
  woodcut: { paper: '#efe7d6', ink: '#17120e', steps: [[0.36, 1]], line: 1.3 },
  engraving: {
    paper: '#ece2cc', ink: '#231811', steps: [[0.2, 0.2], [0.11, 0.5]], line: 0.8,
    // hatch sets: [darker than this, which slice family, phase of the comb]
    hatch: [[0.74, 'A', 0], [0.5, 'A', 0.5], [0.33, 'B', 0], [0.2, 'B', 0.5]],
  },
};

function hatchLines(field, valid, W, H, spacing, phase, scale) {
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < field.length; k++) if (valid[k]) { if (field[k] < lo) lo = field[k]; if (field[k] > hi) hi = field[k]; }
  const paths = [];
  for (let level = (Math.ceil(lo / spacing) + phase) * spacing; level < hi; level += spacing) {
    for (const line of contour(field, W, H, level, valid)) {
      if (line.pts.length > 2) paths.push(curvePath(line, scale, { eps: 0.3 }));
    }
  }
  return paths.join('');
}

/**
 * The plate. `{ width, height, station, light, finish, ground, forms:[{ id, terms, tint?, gloss? }], construction? }`
 * → `{ svg, rig, stats }`.
 */
export function renderPlate(plate, { res = 2, prefix = '', backdrop = true } = {}) {
  const width = plate.width ?? 480, height = plate.height ?? 360;
  const rig = stationRig({ width, height, station: plate.station });
  const T = toneField(plate, rig, res);
  const { W, H } = T, N = W * H, scale = 1 / res, half = 0.5;
  const fin = { ...FINISHES[plate.finish ?? 'wash'], ...(plate.palette || {}) };
  const shift = (d) => `<g transform="translate(${half * scale} ${half * scale})">${d}</g>`;
  const out = [];
  const defs = [];
  // screen-space spacing of a hatch, as metres at the look distance
  const spacing = ((plate.hatch?.spacing ?? 3.4) * (plate.station?.distance ?? 5)) / rig.f;

  if (plate.construction) {
    const { x: vx, y: vy } = rig.vanishing, hz = r1(rig.horizonY);
    out.push(`<g stroke="#9b4a2c" stroke-width="0.5" opacity="0.4" fill="none"><path d="M0 ${hz}H${width}"/>`);
    for (const f of plate.forms) {
      const b = composeFieldTerms(f.terms).bounds;
      for (const z of [b.min.z, b.max.z]) for (const [cx, cy] of [[b.min.x, b.min.y], [b.max.x, b.min.y], [b.min.x, b.max.y], [b.max.x, b.max.y]]) {
        const [px, py] = rig.project(V(cx, cy, z));
        out.push(`<path d="M${r1(px)} ${r1(py)}L${r1(vx[0])} ${r1(vx[1])}M${r1(px)} ${r1(py)}L${r1(vy[0])} ${r1(vy[1])}"/>`);
      }
    }
    out.push('</g>');
  }

  const layer = (who, index) => {
    const mask = new Uint8Array(N);
    let count = 0;
    for (let k = 0; k < N; k++) if (T.id[k] === who) { mask[k] = 1; count++; }
    if (!count) return;
    const isGround = who === 1, form = isGround ? {} : plate.forms[who - 2];
    const cover = blur(Float32Array.from(mask), W, H, 2);
    const outline = isGround ? '' : contour(cover, W, H, 0.5).map((l) => curvePath(l, scale)).join('');
    const { field: lum, have } = spread(T.lum, mask, W, H, 4, 1);
    // the ground keeps the paper: only what falls on it is drawn, as a share of its open value
    const value = isGround ? lum.map((v) => v / T.groundLum * 0.86) : lum;
    const tone = Float32Array.from(value, (v, k) => (have[k] ? -v : -Infinity));
    const body = [];
    if (!isGround && form.tint) body.push(`<path d="${outline}" fill="${form.tint}" opacity="${form.tintOpacity ?? 0.55}"/>`);
    for (const [below, opacity] of fin.steps) {
      const d = contour(tone, W, H, -below).map((l) => curvePath(l, scale)).join('');
      if (d) body.push(`<path d="${d}" fill="${fin.ink}" fill-rule="evenodd" opacity="${opacity}"/>`);
    }
    if (fin.hatch) {
      const fields = { A: spread(T.hatchA, mask, W, H).field, B: spread(T.hatchB, mask, W, H).field };
      fin.hatch.forEach(([below, family, phase], h) => {
        const region = contour(tone, W, H, -below).map((l) => curvePath(l, scale)).join('');
        if (!region) return;
        const clip = `${prefix}h${index}-${h}`;
        defs.push(`<clipPath id="${clip}"><path d="${region}" clip-rule="evenodd"/></clipPath>`);
        // comb only near what it will show in: the ground runs to the horizon, its shadow does not
        const near = Uint8Array.from(have, (h, k) => (h && value[k] < below + 0.06 ? 1 : 0));
        const lines = hatchLines(fields[family], near, W, H, spacing, phase, scale);
        body.push(`<path clip-path="url(#${clip})" d="${lines}" fill="none" stroke="${fin.ink}" stroke-width="${fin.hatchWidth ?? 0.55}" stroke-linecap="round"/>`);
      });
    }
    if (!isGround && form.gloss) {
      const g = spread(T.gloss, mask, W, H).field;
      const d = contour(g, W, H, 0.3).map((l) => curvePath(l, scale)).join('');
      if (d) body.push(`<path d="${d}" fill="${fin.paper}" opacity="0.92"/>`);
    }
    if (isGround) { out.push(shift(body.join(''))); return; }
    // inner edges: the borders of the form's smooth patches
    const { label, sizes } = patches(T, mask);
    const inner = [];
    sizes.forEach((size, idx) => {
      if (size < 30 * res * res) return;
      const part = blur(Float32Array.from(label, (v) => (v === idx ? 1 : 0)), W, H, 2);
      inner.push(contour(part, W, H, 0.5).map((l) => curvePath(l, scale)).join(''));
    });
    const clip = `${prefix}f${index}`;
    defs.push(`<clipPath id="${clip}"><path d="${outline}" clip-rule="evenodd"/></clipPath>`);
    // the found line: the silhouette's dark twin, slid away from the light, shows only on the shadow side
    const [lx, ly] = [dot(T.L, rig.right), -T.L.z], ll = Math.hypot(lx, ly) || 1;
    const lean = fin.line * 1.15;
    out.push(shift(
      `<path d="${outline}" fill="${fin.ink}" fill-rule="evenodd" transform="translate(${r1(-lx / ll * lean)} ${r1(-ly / ll * lean)})"/>`
      + `<path d="${outline}" fill="${fin.paper}" fill-rule="evenodd"/>`
      + `<g clip-path="url(#${clip})">${body.join('')}`
      + (sizes.length > 1 ? `<path d="${inner.join('')}" fill="none" stroke="${fin.ink}" stroke-width="${fin.line * 0.7}" opacity="0.8"/>` : '')
      + `</g><path d="${outline}" fill="none" stroke="${fin.ink}" stroke-width="${fin.line}" stroke-linejoin="round"/>`,
    ));
  };

  // far to near, so a near form's found line lies over what is behind it
  const order = plate.forms.map((_, i) => i + 2).map((who) => {
    let near = Infinity;
    for (let k = 0; k < N; k++) if (T.id[k] === who && T.depth[k] < near) near = T.depth[k];
    return [who, near];
  }).sort((a, b) => b[1] - a[1]);
  if (plate.ground !== false) layer(1, 0);
  order.forEach(([who], i) => layer(who, i + 1));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
    + `${backdrop ? `<rect width="${width}" height="${height}" fill="${fin.paper}"/>` : ''}<defs>${defs.join('')}</defs>${out.join('')}</svg>`;
  return { svg, rig, stats: { samples: N, bytes: svg.length } };
}
