/**
 * rupa/fluid.js — liquid: matter whose cohesion holds no shape (c 0, φ 0), so its weight is pressure in every direction.
 * Fluids live in two places. OUTSIDE, on the ground grid (rupa/ground.js): a layer of depth over each cell that flows
 * downhill and levels. INSIDE, simplified: tanks and tubs joined by pipes, with pumps and nozzles (a hydrant, a fire
 * truck, a hose). Pure and deterministic. rupa is the internal name.
 *
 * GROUND LAYER (field.fluid = { matter, d: [depth…], q: [outflow ×4 per cell] })
 *   Each cell's surface is its soil plus its depth. Between neighbours the liquid accelerates by the difference in
 *   surface (g·Δs), through a face as deep as the higher side's layer (the virtual-pipe shallow-water scheme), so a
 *   heap levels, a lake finds one level and a crater fills. Viscosity drags a thin layer (laminar film: the flow loses
 *   its momentum at the rate 3η/(ρd²)): water runs, honey creeps. A Bingham liquid (mud, lava) stops where the slope's
 *   stress at the bed, ρ·g·d·slope, falls under its yield: it holds a low heap. Volume is kept exactly; no cell goes dry
 *   below zero; the grid's edges are walls.
 *   pour(field, { at, volume, liquid?, radius? }) · drain(field, { at, volume, radius? }) · flow(field, { seconds })
 *   fluidAt(field, x, y) → { depth, surface } · fluidVolume(field)
 *
 * VESSELS (a network: { vessels, pipes })
 *   vessel  { id, at: [x, y, z base], area | radius, height, liquid, volume, wall?: { matter, thick, left? } }
 *           its level is volume ÷ area; over its height it spills; its wall's hoop stress at the bottom, p·r/t with
 *           p = ρ·g·level, against the weaker of the wall matter's tensile and bond strength (× left: a damaged wall
 *           holds less) bursts it, and everything in it goes
 *   pipe    { id?, from, to, z, radius, length, pump?, open? }: an opening at height z between two ends. An end is a
 *           vessel's id, { ground: [x, y] } (the grid's cell there), { source: { pressure } } (the mains: a hydrant),
 *           or { nozzle: { at, dir } } (open air: the flow leaves as a jet). The pressure each side is ρ·g times the
 *           liquid standing over the opening (the source's own; a nozzle's 0), plus a pump's (Pa) on the way. The flow
 *           is the smaller of what viscosity lets through a long pipe (Hagen–Poiseuille, πr⁴Δp/8ηL) and what an opening
 *           lets through at all (Torricelli, Cd·πr²·√(2Δp/ρ)): water through a hose is opening-bound, honey
 *           pipe-bound. Levels in joined vessels meet (communicating vessels fall out)
 *   stepVessels(net, { seconds, ground? }) → { net, ground, jets: [{ pipe, at, dir, speed, flow }], events }
 *   jetOf(pressure, { radius, liquid? }) → { speed, flow, reach45 }: a nozzle's jet from the pressure behind it
 */
import { resolveMatter, isLiquid } from './matter.js';

const G = 9.81, CD = 0.6, CV = 0.97;   // a sharp opening's discharge coefficient; a smooth nozzle's velocity coefficient
const liquidOf = (id, where = 'liquid') => {
  const m = resolveMatter(id, where);
  if (!isLiquid(m)) throw new Error(`${where}: '${m.id}' is not a liquid (water, seawater, oil, honey, mud, lava)`);
  return m;
};
const copy = (f) => ({ ...f, h: f.h.slice(), rock: f.rock.slice(), ...(f.fluid ? { fluid: { ...f.fluid, d: f.fluid.d.slice(), q: f.fluid.q.slice() } } : {}) });
const isPt = (p) => Array.isArray(p) && p.length >= 2 && p.every((x) => Number.isFinite(x));
const cellOf = (f, x, y) => [Math.min(f.nx - 1, Math.max(0, Math.floor((x - f.origin[0]) / f.cell))), Math.min(f.ny - 1, Math.max(0, Math.floor((y - f.origin[1]) / f.cell)))];

export const fluidVolume = (f) => (f.fluid ? f.fluid.d.reduce((s, x) => s + x, 0) * f.cell * f.cell : 0);

export function fluidAt(f, x, y) {
  const [i, j] = cellOf(f, x, y), k = j * f.nx + i, d = f.fluid ? f.fluid.d[k] : 0;
  return { depth: d, surface: f.h[k] + d };
}

// lay (or take, a negative volume) evenly over the cells within `radius` of `at`; the nearest cell if none
function spread(f, at, volume, radius) {
  const A = f.cell * f.cell, ks = [];
  for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
    const x = f.origin[0] + (i + 0.5) * f.cell, y = f.origin[1] + (j + 0.5) * f.cell;
    if (Math.hypot(x - at[0], y - at[1]) <= radius) ks.push(j * f.nx + i);
  }
  if (!ks.length) { const [i, j] = cellOf(f, at[0], at[1]); ks.push(j * f.nx + i); }
  if (volume >= 0) { for (const k of ks) f.fluid.d[k] += volume / A / ks.length; return volume; }
  const have = ks.reduce((s, k) => s + f.fluid.d[k], 0) * A, take = Math.min(-volume, have);
  if (have > 0) for (const k of ks) f.fluid.d[k] -= (f.fluid.d[k] * A / have) * take / A;
  return -take;
}

export function pour(field, { at, volume, liquid = 'water', radius } = {}) {
  if (!isPt(at)) throw new Error('fluid.pour: at is [x, y]');
  if (!(Number.isFinite(volume) && volume >= 0)) throw new Error('fluid.pour: volume is cubic metres, 0 or more');
  liquidOf(liquid, 'fluid.pour liquid');
  const f = copy(field);
  if (f.fluid && f.fluid.matter !== liquid && fluidVolume(f) > 1e-9) throw new Error(`fluid.pour: this ground holds ${f.fluid.matter}; one liquid a ground (mixing is not modelled)`);
  if (!f.fluid || f.fluid.matter !== liquid) f.fluid = { matter: liquid, d: new Array(f.nx * f.ny).fill(0), q: new Array(f.nx * f.ny * 4).fill(0) };
  spread(f, at, volume, radius ?? f.cell);
  return f;
}

export function drain(field, { at, volume, radius } = {}) {
  if (!isPt(at)) throw new Error('fluid.drain: at is [x, y]');
  const f = copy(field);
  if (!f.fluid) return { field: f, taken: 0 };
  const taken = -spread(f, at, -Math.abs(volume), radius ?? f.cell);
  return { field: f, taken };
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BED = 0.2;   // 1/s: the bed's own drag on a moving layer (it settles a sloshing pool in seconds, not never)

export function flow(field, { seconds = 1, maxDt = 0.05 } = {}) {
  const f = copy(field);
  if (!f.fluid) return { field: f, steps: 0 };
  const m = liquidOf(f.fluid.matter), { nx, ny, cell: l } = f, A = l * l, d = f.fluid.d, q = f.fluid.q, h = f.h, n = nx * ny;
  const s = new Array(n);
  let t = 0, steps = 0;
  while (t < seconds - 1e-12) {
    let dmax = 0;
    for (let k = 0; k < n; k++) if (d[k] > dmax) dmax = d[k];
    if (dmax <= 0) break;
    const dt = Math.min(seconds - t, maxDt, (0.35 * l) / Math.sqrt(G * dmax));
    for (let k = 0; k < n; k++) s[k] = h[k] + d[k];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      for (let r = 0; r < 4; r++) {
        const ii = i + DIRS[r][0], jj = j + DIRS[r][1], at = k * 4 + r;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny || d[k] <= 0) { q[at] = 0; continue; }
        const kk = jj * nx + ii, ds = s[k] - s[kk];
        const face = ds > 0 ? d[k] : d[kk];
        if (face <= 0) { q[at] = 0; continue; }
        if (m.yield > 0 && m.density * G * face * (Math.abs(ds) / l) <= m.yield) { q[at] = 0; continue; }
        let v = q[at] + dt * G * face * ds;                                   // A_face = l·face, ÷ l
        v /= 1 + dt * ((3 * m.viscosity) / (m.density * face * face) + BED);  // laminar film + the bed, implicit
        q[at] = v > 0 ? v : 0;
      }
      const out = q[k * 4] + q[k * 4 + 1] + q[k * 4 + 2] + q[k * 4 + 3];
      if (out * dt > d[k] * A && out > 0) { const K = (d[k] * A) / (out * dt); for (let r = 0; r < 4; r++) q[k * 4 + r] *= K; }
    }
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      let inflow = 0;
      if (i > 0) inflow += q[(k - 1) * 4 + 0];
      if (i < nx - 1) inflow += q[(k + 1) * 4 + 1];
      if (j > 0) inflow += q[(k - nx) * 4 + 2];
      if (j < ny - 1) inflow += q[(k + nx) * 4 + 3];
      s[k] = inflow - (q[k * 4] + q[k * 4 + 1] + q[k * 4 + 2] + q[k * 4 + 3]);   // reuse: the net in, m³/s
    }
    for (let k = 0; k < n; k++) d[k] = Math.max(0, d[k] + (dt * s[k]) / A);
    t += dt; steps++;
  }
  return { field: f, steps };
}

// ── vessels: tanks, tubs, the mains, pumps, hoses and nozzles ──

export function jetOf(pressure, { radius, liquid = 'water' } = {}) {
  const m = liquidOf(liquid), dp = Math.max(0, pressure);
  const speed = CV * Math.sqrt((2 * dp) / m.density), flowRate = speed * Math.PI * radius * radius;
  return { speed, flow: flowRate, reach45: (speed * speed) / G };
}

function readVessel(v, i) {
  if (!v || typeof v.id !== 'string') throw new Error(`fluid: vessel ${i} needs an id`);
  if (!Array.isArray(v.at) || v.at.length !== 3) throw new Error(`fluid: vessel ${v.id} needs at [x, y, z base]`);
  const area = v.area ?? (v.radius > 0 ? Math.PI * v.radius * v.radius : NaN);
  if (!(area > 0)) throw new Error(`fluid: vessel ${v.id} needs an area or a radius`);
  if (!(v.height > 0)) throw new Error(`fluid: vessel ${v.id} needs a height`);
  liquidOf(v.liquid ?? 'water', `vessel ${v.id} liquid`);
  return { ...v, area, liquid: v.liquid ?? 'water', volume: v.volume ?? 0, burst: v.burst ?? null };
}

// the pressure at height z from one end of a pipe, and how much liquid stands over the opening there
function endState(end, z, net, ground) {
  if (typeof end === 'string') {
    const v = net.byId[end];
    if (!v) throw new Error(`fluid: no vessel '${end}'`);
    if (v.burst) return { p: 0, over: 0, liquid: v.liquid, v };
    const m = liquidOf(v.liquid), surface = v.at[2] + v.volume / v.area, over = Math.max(0, surface - z);
    return { p: m.density * G * over, over, liquid: v.liquid, v };
  }
  if (end && end.source) return { p: end.source.pressure, over: Infinity, liquid: end.source.liquid ?? 'water', source: true };
  if (end && end.nozzle) return { p: 0, over: 0, nozzle: end.nozzle };
  if (end && end.ground) {
    if (!ground) return { p: 0, over: 0, ground: end.ground };
    const { depth, surface } = fluidAt(ground, ...end.ground), m = ground.fluid ? liquidOf(ground.fluid.matter) : liquidOf('water');
    return { p: m.density * G * Math.max(0, Math.min(depth, surface - z)), over: Math.max(0, Math.min(depth, surface - z)), liquid: ground.fluid && ground.fluid.matter, ground: end.ground };
  }
  throw new Error('fluid: a pipe end is a vessel id, { ground: [x, y] }, { source: { pressure } } or { nozzle: { at, dir } }');
}

export function stepVessels(netIn, { seconds = 1, ground = null, maxDt = 0.02 } = {}) {
  const net = { vessels: (netIn.vessels || []).map(readVessel), pipes: (netIn.pipes || []).map((p) => ({ ...p })) };
  net.byId = Object.fromEntries(net.vessels.map((v) => [v.id, v]));
  let g = ground ? copy(ground) : null;
  const events = [], jets = new Map(), toGround = (at, volume, liquid) => { if (!(volume > 0)) return; if (g) g = pour(g, { at, volume, liquid }); else events.push({ kind: 'lost', at, volume }); };
  let t = 0;
  while (t < seconds - 1e-12) {
    const dt = Math.min(maxDt, seconds - t);
    for (const [pi, p] of net.pipes.entries()) {
      if (p.open === false) continue;
      const A = endState(p.from, p.z, net, g), B = endState(p.to, p.z, net, g);
      const dp = A.p - B.p + (p.pump || 0);
      if (Math.abs(dp) < 1e-9) continue;
      const src = dp > 0 ? A : B, dst = dp > 0 ? B : A;
      if (!src.source && !(src.over > 0)) continue;
      const m = liquidOf(src.liquid ?? 'water'), r = p.radius, L = p.length ?? 1;
      const lam = (Math.PI * r ** 4 * Math.abs(dp)) / (8 * m.viscosity * L), ori = (dst.nozzle ? CV : CD) * Math.PI * r * r * Math.sqrt((2 * Math.abs(dp)) / m.density);
      let Q = Math.min(lam, ori), vol = Q * dt;
      if (src.v) vol = Math.min(vol, src.over * src.v.area);
      if (src.ground && g) vol = Math.min(vol, src.over * g.cell * g.cell);
      if (!(vol > 0)) continue;
      Q = vol / dt;
      if (src.v) src.v.volume -= vol;
      if (src.ground && g) g = drain(g, { at: src.ground, volume: vol }).field;
      if (dst.v) { if (dst.v.volume <= 1e-12) dst.v.liquid = m.id; dst.v.volume += vol; }
      if (dst.ground) toGround(dst.ground, vol, m.id);
      if (dst.nozzle) jets.set(pi, { pipe: p.id ?? pi, at: dst.nozzle.at, dir: dst.nozzle.dir, speed: Q / (Math.PI * r * r), flow: Q, liquid: m.id });
    }
    for (const v of net.vessels) {
      if (v.burst) continue;
      const over = v.volume - v.height * v.area;
      if (over > 1e-12) { v.volume -= over; toGround([v.at[0], v.at[1]], over, v.liquid); events.push({ t: +(t + dt).toFixed(4), kind: 'overflow', id: v.id, volume: over }); }
      if (v.wall) {
        const wm = resolveMatter(v.wall.matter, `vessel ${v.id} wall`), level = v.volume / v.area;
        const stress = (liquidOf(v.liquid).density * G * level * Math.sqrt(v.area / Math.PI)) / v.wall.thick;
        const holds = Math.min(wm.tensile, wm.bond ?? wm.tensile) * (v.wall.left ?? 1);
        if (stress > holds) {
          events.push({ t: +(t + dt).toFixed(4), kind: 'burst', id: v.id, volume: v.volume, stress, holds });
          toGround([v.at[0], v.at[1]], v.volume, v.liquid);
          v.volume = 0; v.burst = { t: +(t + dt).toFixed(4) };
        }
      }
    }
    t += dt;
  }
  delete net.byId;
  return { net, ground: g, jets: [...jets.values()], events };
}
