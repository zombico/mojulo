import * as dmath from '../../util/dmath.js';
import { resolveAquaLook } from './aqua-look.js';

// Shallow water you can touch: pools and ponds. A body is pure data — an outline in the ground plane, a still level,
// and a bed (how deep the water is at each point) — so the builder, the World page and an engine kernel all ask the
// same question the same way: `waterAt(bodies, x, y)`. On the page the surface is SIMULATED (a heightfield stepped with
// the shallow-water wave equation, waves at c = √(g·depth)), not a closed-form sum like the sea: it is still until
// something disturbs it, and every disturbance — a wading walker, a floater, rain, a script — goes through one bus.
// Builder output: dmath trig and 4-place rounding, so a body and its grid are the same bytes on every platform.

const r4 = (v) => +(+v).toFixed(4);
// a pond's basin reaches this far past its mean radius (the lobes and the bank up to the ground fit inside)
const POND_REACH = 1.45;
const num = (v, lo, hi, fb) => { const n = +v; return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fb; };

// per kind: the bed's shape, the look it borrows, and how the simulated surface behaves
//   speed   multiplies the physical wave speed √(g·D) — real pool waves outrun the eye at a walking scale
//   damp    energy lost per second (a pond's weed and silt calm it faster than a tiled pool)
//   breeze  stray puffs per m² per second: a still body is never quite still, and its ripples throw caustics
//   wall    a hard edge reflects waves (a pool); a soft one (a pond's bank) shoals and absorbs them
export const SHALLOW_KINDS = {
  pool: { look: { kind: 'pool', nAmp: 0.04, nSpeed: 0.25, shore: 0 }, color: '#2a8fa8', speed: 0.45, damp: 0.35, breeze: 0.12, wall: true, shallow: 0.9, deep: 1.8, freeboard: 0.15 },
  pond: { look: { kind: 'lake', nAmp: 0.06, tint: '#6f9a6a', sigma: [0.9, 0.42, 0.5], shore: 0 }, color: '#3d5a3c', speed: 0.5, damp: 0.6, breeze: 0.06, wall: false, deep: 1.1, freeboard: 0.25 },
};

// a pond's shoreline: a lobed ellipse (radii rx, ry), r(θ) = 1 + a₃ sin(3θ + s) + a₅ sin(5θ + 2s) in the unit
// circle the radii stretch; seed picks s
function pondRadius(body, th) {
  const s = body.lobe;
  return 1 + 0.14 * dmath.sin(3 * th + s) + 0.07 * dmath.sin(5 * th + 2 * s);
}

/**
 * Depth of water below the still level at (x, y): > 0 inside the body, ≤ 0 outside (a pond's bank rises out of it,
 * so the negative value is the bank height above the level — the bowl the page's terrain follows).
 */
export function bedDepth(body, x, y) {
  const dx = x - body.center[0], dy = y - body.center[1];
  if (body.kind === 'pool') {
    const hw = body.size[0] / 2, hd = body.size[1] / 2;
    if (Math.abs(dx) > hw || Math.abs(dy) > hd) return -body.freeboard;
    const u = (dx + hw) / body.size[0];                                     // shallow end at −x, deep end at +x
    const s = u < 0.45 ? 0 : u > 0.7 ? 1 : (u - 0.45) / 0.25;
    return body.shallow + (body.deep - body.shallow) * s * s * (3 - 2 * s);
  }
  const ux = dx / body.radii[0], uy = dy / body.radii[1], q = dmath.hypot(ux, uy) / pondRadius(body, dmath.atan2(uy, ux));
  if (q < 1) return body.deep * (1 - q * q) * (1 - 0.35 * q * q);           // a bowl, steepest just inside the shore
  return -body.freeboard * Math.min(1, (q - 1) / 0.18);                      // the bank climbs to the ground (within the reach)
}

/** Normalise a recipe's `shallows` list into bodies (sim grid included). Unknown kinds are dropped. */
export function normalizeShallows(list, { sky, bg, metersPerUnit = 1 } = {}) {
  // positions and sizes are world units; depths (deep, shallow, freeboard) are metres, like the presets
  const L = 1 / (Number.isFinite(+metersPerUnit) && +metersPerUnit > 0 ? +metersPerUnit : 1);
  const out = [];
  for (const [i, raw] of (Array.isArray(list) ? list : []).entries()) {
    const K = SHALLOW_KINDS[raw && raw.kind];
    if (!K) continue;
    const kind = raw.kind, center = [r4(num(raw.at && raw.at[0], -1e5, 1e5, 0)), r4(num(raw.at && raw.at[1], -1e5, 1e5, 0))];
    const ground = r4(num(raw.ground, -1e4, 1e4, 0)), freeboard = r4(num(raw.freeboard, 0, 2, K.freeboard) * L);
    const body = { id: raw.id || `${kind}${i}`, kind, center, ground, level: r4(ground - freeboard), freeboard, deep: r4(num(raw.deep, 0.2, 6, K.deep) * L) };
    let half;
    if (kind === 'pool') {
      body.size = [r4(num(raw.size && raw.size[0], 2 * L, 60 * L, 12 * L)), r4(num(raw.size && raw.size[1], 2 * L, 60 * L, 6 * L))];
      body.coping = r4(0.4 * L);
      body.shallow = r4(Math.min(body.deep, num(raw.shallow, 0.1, 6, K.shallow) * L));
      half = [body.size[0] / 2, body.size[1] / 2];
    } else {
      // `radius` for a round pond, `size: [w, d]` for one that fills a w × d plot (its bank reaching the plot's edge)
      const r = num(raw.radius, 0.5 * L, 60 * L, 7 * L);
      body.radii = Array.isArray(raw.size) ? raw.size.slice(0, 2).map((v) => r4(num(v, L, 120 * L, 2 * r * POND_REACH) / (2 * POND_REACH))) : [r4(r), r4(r)];
      body.lobe = r4(num(raw.seed, 0, 1e6, 0) * 0.7317 % 6.2832);
      half = [body.radii[0] * POND_REACH, body.radii[1] * POND_REACH];
    }
    // the sim grid: one cell ≈ 0.18 m, at most 160 a side; a pond's grid reaches past the shore so the waterline
    // is where the surface meets the bank, not where the grid ends
    const cell = Math.max(0.18 * L, (2 * Math.max(half[0], half[1])) / 160);
    const nx = Math.max(8, Math.round((2 * half[0]) / cell) + 1), ny = Math.max(8, Math.round((2 * half[1]) / cell) + 1);
    const dx = (2 * half[0]) / (nx - 1), dy = (2 * half[1]) / (ny - 1);
    const depth = new Array(nx * ny);
    for (let j = 0; j < ny; j++) for (let ii = 0; ii < nx; ii++) depth[j * nx + ii] = r4(bedDepth(body, center[0] - half[0] + ii * dx, center[1] - half[1] + j * dy));
    body.grid = { nx, ny, x0: r4(center[0] - half[0]), y0: r4(center[1] - half[1]), dx: r4(dx), dy: r4(dy), depth };
    body.sim = { speed: K.speed, damp: K.damp, wall: K.wall, breeze: r4(num(raw.breeze, 0, 5, K.breeze)) };
    body.color = raw.color || K.color;
    body.look = resolveAquaLook({ ...K.look, ...(raw.look || {}) }, { sky, bg, unit: L });
    out.push(body);
  }
  return out;
}

/** The body at (x, y), its still level and the depth there; null on dry ground. */
export function waterAt(bodies, x, y) {
  for (const b of bodies || []) {
    const d = bedDepth(b, x, y);
    if (d > 0) return { body: b.id, level: b.level, depth: r4(d) };
  }
  return null;
}

const quad = (corners, fill, extra) => ({ corners, fill, doubleSided: true, ...extra });

/**
 * The basin a body sits in, as solid faces: a pool's tiled floor, walls and coping; a pond's bowl (bed and bank) as a
 * heightfield that rises to the ground at its rim. `walk` stands on these, and the water's depth pass sees them.
 */
export function basinFaces(body, { groundColor = '#6f8a4a' } = {}) {
  const f = [], g = body.ground, L = body.level;
  if (body.kind === 'pool') {
    const [cx, cy] = body.center, hw = body.size[0] / 2, hd = body.size[1] / 2, n = 12, tile = '#bfe3ea', wall = '#9fd2dd';
    // floor: strips across x following the shallow → deep ramp
    for (let k = 0; k < n; k++) {
      const xa = cx - hw + (k / n) * 2 * hw, xb = cx - hw + ((k + 1) / n) * 2 * hw;
      const za = L - bedDepth(body, Math.min(xa + 1e-3, cx + hw), cy), zb = L - bedDepth(body, Math.min(xb, cx + hw - 1e-3), cy);
      f.push(quad([[xa, cy - hd, za], [xb, cy - hd, zb], [xb, cy + hd, zb], [xa, cy + hd, za]], k % 2 ? tile : '#b4dbe3', { group: `basin:${body.id}` }));
      // side walls follow the floor
      f.push(quad([[xa, cy - hd, za], [xb, cy - hd, zb], [xb, cy - hd, g], [xa, cy - hd, g]], wall, { group: `basin:${body.id}` }));
      f.push(quad([[xa, cy + hd, za], [xa, cy + hd, g], [xb, cy + hd, g], [xb, cy + hd, zb]], wall, { group: `basin:${body.id}` }));
    }
    const zs = L - body.shallow, zd = L - body.deep;
    f.push(quad([[cx - hw, cy - hd, zs], [cx - hw, cy - hd, g], [cx - hw, cy + hd, g], [cx - hw, cy + hd, zs]], wall, { group: `basin:${body.id}` }));
    f.push(quad([[cx + hw, cy - hd, zd], [cx + hw, cy + hd, zd], [cx + hw, cy + hd, g], [cx + hw, cy - hd, g]], wall, { group: `basin:${body.id}` }));
    // coping: a 0.4 m stone lip around the rim
    const c = body.coping, stone = '#d9d2c3';
    f.push(quad([[cx - hw - c, cy - hd - c, g], [cx + hw + c, cy - hd - c, g], [cx + hw + c, cy - hd, g], [cx - hw - c, cy - hd, g]], stone, { group: 'coping' }));
    f.push(quad([[cx - hw - c, cy + hd, g], [cx + hw + c, cy + hd, g], [cx + hw + c, cy + hd + c, g], [cx - hw - c, cy + hd + c, g]], stone, { group: 'coping' }));
    f.push(quad([[cx - hw - c, cy - hd, g], [cx - hw, cy - hd, g], [cx - hw, cy + hd, g], [cx - hw - c, cy + hd, g]], stone, { group: 'coping' }));
    f.push(quad([[cx + hw, cy - hd, g], [cx + hw + c, cy - hd, g], [cx + hw + c, cy + hd, g], [cx + hw, cy + hd, g]], stone, { group: 'coping' }));
    return f;
  }
  // pond: the bowl over the sim grid's square, mud under water, grass on the bank
  const { x0, y0 } = body.grid, sx = 2 * body.radii[0] * POND_REACH, sy = 2 * body.radii[1] * POND_REACH;
  const n = Math.max(16, Math.min(96, Math.round((body.grid.nx - 1) / 2))), s = sx / n, t = sy / n;   // a bowl cell ≈ two sim cells
  const z = (x, y) => Math.min(g, L - bedDepth(body, x, y));
  const mud = [0x4a, 0x42, 0x30], silt = [0x7a, 0x6d, 0x4c], grass = [1, 3, 5].map((k) => parseInt(groundColor.slice(k, k + 2), 16));
  const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const xa = x0 + i * s, ya = y0 + j * t, xb = xa + s, yb = ya + t, d = bedDepth(body, xa + s / 2, ya + t / 2);
    // one continuous ramp from the ground's own colour at the waterline through silt to mud in the deep: a bowl quad
    // straddles the waterline, so any jump in colour there would show every quad as a step
    const u = Math.max(0, Math.min(1, d / (body.deep * 0.7)));
    const col = u < 0.35 ? mix(grass, silt, u / 0.35) : mix(silt, mud, (u - 0.35) / 0.65);
    f.push(quad([[xa, ya, z(xa, ya)], [xb, ya, z(xb, ya)], [xb, yb, z(xb, yb)], [xa, yb, z(xa, yb)]], hex(col), { group: `basin:${body.id}` }));
  }
  return f;
}

/** The square of ground a body replaces (its basin covers it): [x0, y0, x1, y1]. */
export function basinFootprint(body) {
  if (body.kind === 'pool') { const c = body.coping, hw = body.size[0] / 2 + c, hd = body.size[1] / 2 + c; return [body.center[0] - hw, body.center[1] - hd, body.center[0] + hw, body.center[1] + hd]; }
  const hx = body.radii[0] * POND_REACH, hy = body.radii[1] * POND_REACH; return [body.center[0] - hx, body.center[1] - hy, body.center[0] + hx, body.center[1] + hy];
}
