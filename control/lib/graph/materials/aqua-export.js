import * as dmath from '../../util/dmath.js';
import { resolveAquaLook } from './aqua-look.js';

// Water for the exporters (GLB → Blender / Godot / Unity / Unreal). The World page animates water in-script; an
// exported scene is a file, so an animated `surfaces` entry with an aqua look leaves as ONE FROZEN FRAME (t = 0) of
// the same surface the page draws at that instant — ocean / shore Gerstner and the river's lanes, foam baked into the
// vertex colour — and a liquid sheet leaves as itself. Each body of water is one node, `water:<kind>` (a second of
// the same kind gets an index), and its look rides the engine score (`score.water`) so a kernel can shade it live
// (Godot: kernel/water.gdshader). Builder output: dmath trig, so the frame is the same bytes on every platform.

const l3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function gerstner(waves, x0, y0, t) {
  let px = x0, py = y0, pz = 0, nx = 0, ny = 0, nz = 1, jxx = 0, jyy = 0, jxy = 0;
  for (const w of waves) {
    const ph = w.k * (w.dx * x0 + w.dy * y0) - w.om * t + w.ph, c = dmath.cos(ph), s = dmath.sin(ph);
    px += w.Q * w.A * w.dx * c; py += w.Q * w.A * w.dy * c; pz += w.A * s;
    nx += -w.dx * w.k * w.A * c; ny += -w.dy * w.k * w.A * c; nz += -w.Q * w.k * w.A * s;
    const a = w.Q * w.A * w.k * s; jxx -= a * w.dx * w.dx; jyy -= a * w.dy * w.dy; jxy -= a * w.dx * w.dy;
  }
  return { p: [px, py, pz], n: [nx, ny, nz], J: (1 + jxx) * (1 + jyy) - jxy * jxy };
}

// the river's centreline frame for one point: lateral distance, arc length, water level (surface.js's precompute)
function riverFrame(P, cum, x0, y0) {
  let best = 1e9, bs = 0, bl = 0;
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1e-6;
    let tt = ((x0 - a[0]) * dx + (y0 - a[1]) * dy) / L2; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
    const px = a[0] + dx * tt, py = a[1] + dy * tt, dd = dmath.hypot(x0 - px, y0 - py);
    if (dd < best) { best = dd; bs = cum[i - 1] + Math.sqrt(L2) * tt; bl = a[2] + (b[2] - a[2]) * tt; }
  }
  return { lat: best, arc: bs, lvl: bl };
}

/**
 * One frozen frame of an aqua surface as a triangle soup: { positions, normals, colors } (Float32Array, z-up world),
 * or null for a mode the exporters don't carry (a falling sheet, a ripple tank, a gravity-wave membrane).
 */
export function aquaSurfaceFrame(sf, t = 0) {
  if (!sf || !sf.aqua || !sf.grid || sf.spout || sf.gw || sf.sources) return null;
  const { nx, ny, w, d } = sf.grid, cx = sf.grid.cx || 0, cy = sf.grid.cy || 0, cz = sf.grid.cz || 0;
  if (!(nx > 1 && ny > 1)) return null;
  const N = nx * ny, pos = new Float64Array(N * 3), nor = new Float64Array(N * 3), col = new Float64Array(N * 3), keep = new Uint8Array(N).fill(1);
  const deep = sf.deep, surf = sf.surf, crest = sf.crest, amax = sf.amax || 1, thr = sf.aqua.foamThr;
  const R = sf.river, S = sf.shore || null;
  let cum = null;
  if (R) { cum = [0]; for (let i = 1; i < R.pts.length; i++) cum[i] = cum[i - 1] + dmath.hypot(R.pts[i][0] - R.pts[i - 1][0], R.pts[i][1] - R.pts[i - 1][1]); }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const v = j * nx + i, o = 3 * v, x0 = (i / (nx - 1) - 0.5) * w + cx, y0 = (j / (ny - 1) - 0.5) * d + cy;
    let c, foam;
    if (R) {
      const f = riverFrame(R.pts, cum, x0, y0);
      if (f.lat >= R.bank) { keep[v] = 0; pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = f.lvl - 40; nor[o + 2] = 1; continue; }
      const k = (Math.PI * 2) / (R.lam || 10), om = k * (R.flow || 7), ph = k * f.arc - om * t;
      const lane = dmath.sin(6.2832 * f.lat / (R.half * 0.7) + 0.6 * dmath.sin(f.arc * 0.04)), swell = dmath.sin(0.5 * ph + 2 * lane);
      const edge = f.lat < R.half ? 1 : Math.max(0, 1 - (f.lat - R.half) / (R.bank - R.half));
      const rip = R.amp * (0.55 * lane * (0.65 + 0.35 * swell) + 0.22 * dmath.sin(ph));
      pos[o] = x0; pos[o + 1] = y0; pos[o + 2] = f.lvl + edge * rip;
      c = l3(deep, surf, clamp01(0.5 + edge * rip / (2 * R.amp + 1e-3)));
      const fline = dmath.pow(0.5 + 0.5 * dmath.sin(3.1416 * f.lat / (R.half * 0.7) + 1.3 + 0.6 * dmath.sin(f.arc * 0.04)), 16);
      const clump = 0.5 + 0.5 * dmath.sin(0.25 * f.arc - om * 0.6 * t + 3 * f.lat / R.half);
      foam = Math.min(1, fline * (0.15 + 0.5 * clump * clump) + dmath.pow(1 - edge, 3) * 0.9);
    } else {
      const g = gerstner(sf.waves || [], x0, y0, t);
      let sh = 1;
      if (S) { sh = clamp01((S.edgeY - y0) / S.surfW); const tp = sh * sh * (3 - 2 * sh); g.p[2] = g.p[2] * tp - (1 - tp) * (S.sink || 0); g.n[0] *= tp; g.n[1] *= tp; }
      const hw = g.p[2];
      pos[o] = g.p[0]; pos[o + 1] = g.p[1]; pos[o + 2] = hw + cz;
      nor[o] = g.n[0]; nor[o + 1] = g.n[1]; nor[o + 2] = g.n[2];
      c = l3(deep, surf, clamp01(0.5 + hw / (2 * amax)));
      foam = clamp01((thr - g.J) * 3.5) * sh;
      if (S) {
        if (S.shallow) c = l3(c, S.shallow, (1 - sh) * 0.7);
        const swashEdge = S.edgeY - S.swashRange * (0.5 - 0.5 * dmath.sin(S.omSwash * t));
        foam = Math.max(foam, dmath.exp(-dmath.pow((y0 - S.edgeY) / (S.foamW * 0.6), 2)) * 0.5, dmath.exp(-dmath.pow((y0 - swashEdge) / S.foamW, 2)) * 0.7);
      }
    }
    // foam is a lace the page draws live; a file carries its mean: the crest colour, partly
    c = l3(c, crest, foam * 0.6);
    col[o] = c[0]; col[o + 1] = c[1]; col[o + 2] = c[2];
  }
  // river normals from the height grid (the page does the same); Gerstner's are analytic
  if (R) {
    const dx = w / (nx - 1), dy = d / (ny - 1);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const o = 3 * (j * nx + i), z = (ii, jj) => pos[3 * (jj * nx + ii) + 2];
      const gx = (z(Math.min(nx - 1, i + 1), j) - z(Math.max(0, i - 1), j)) / (2 * dx), gy = (z(i, Math.min(ny - 1, j + 1)) - z(i, Math.max(0, j - 1))) / (2 * dy);
      nor[o] = -gx; nor[o + 1] = -gy; nor[o + 2] = 1;
    }
  }
  const P = [], Nn = [], C = [];
  const push = (v) => {
    const o = 3 * v, L = dmath.hypot(dmath.hypot(nor[o], nor[o + 1]), nor[o + 2]) || 1;
    P.push(pos[o], pos[o + 1], pos[o + 2]); Nn.push(nor[o] / L, nor[o + 1] / L, nor[o + 2] / L); C.push(col[o], col[o + 1], col[o + 2]);
  };
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
    if (R && !keep[a] && !keep[b] && !keep[c] && !keep[e]) continue;
    for (const v of [a, b, c, b, e, c]) push(v);
  }
  if (!P.length) return null;
  return { positions: new Float32Array(P), normals: new Float32Array(Nn), colors: new Float32Array(C) };
}

/**
 * Every body of water in a payload, named for the exporters: the liquid sheet's faces (the page's first-kind-wins
 * look) and each aqua surface's frozen frame. [{ name, look, liquidFaces? | frame? }]; [] when there is no aqua water.
 */
export function aquaWaterBodies(payload = {}) {
  const out = [], seen = {};
  const nameOf = (kind) => { seen[kind] = (seen[kind] || 0) + 1; return seen[kind] > 1 ? `water:${kind}${seen[kind]}` : `water:${kind}`; };
  const faces = Array.isArray(payload.faces) ? payload.faces : [];
  const lf = faces.find((f) => f && f.water && f.liquid);
  const look = lf ? resolveAquaLook(lf.liquid, { sky: payload.sky, bg: payload.bg, unit: lf.liquid.unit }) : null;
  const toLight = payload.light && Array.isArray(payload.light.toLight) ? payload.light.toLight : null;
  if (look) out.push({ name: nameOf(look.kind), look, liquidFaces: faces.filter((f) => f && f.water && f.liquid), sheet: true, ...(toLight ? { sun: toLight } : {}) });
  for (const sf of Array.isArray(payload.surfaces) ? payload.surfaces : []) {
    const frame = aquaSurfaceFrame(sf, 0);
    if (frame) out.push({ name: nameOf(sf.aqua.kind), look: sf.aqua, frame, sun: sf.sun, foamCol: sf.crest, river: !!sf.river });
  }
  return out;
}

/**
 * A body's look as engine-score data, in metres (`unitScale` = metersPerUnit when the recipe is authored in another
 * unit): absorption and ripple frequency per metre, drift and the shore band in metres. A kernel needs nothing else.
 */
export function aquaScoreEntry(body, unitScale = 1) {
  const L = body.look, u = unitScale > 0 ? unitScale : 1, r4 = (v) => +(+v).toFixed(4);
  return {
    kind: L.kind, sigma: L.sigma.map((v) => r4(v / u)), tint: L.tint, zenith: L.zen, horizon: L.hor,
    roughness: L.rough, reflect: L.refl, ripple: { scale: r4(L.nScale / u), slope: L.nAmp, speed: r4(L.nSpeed * u) }, flow: L.flow,
    shore: r4(L.shore * u), foam: (body.foamCol || [0.9, 0.94, 0.96]).map(r4), ...(body.sun ? { sun: body.sun.map(r4) } : {}),
    ...(body.river ? { river: true } : {}), frozen: !body.sheet,
  };
}
