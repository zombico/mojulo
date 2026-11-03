/**
 * rupa/ground.js — ground that takes a blow and a shovel: a soil heightfield over bedrock that craters, throws its
 * ejecta into a rim, slumps to what its soil can hold, and is dug and piled. Pure and deterministic (no dice: the same
 * field and the same acts give the same heights). rupa is the internal name: the person says craters, trenches, dig.
 *
 * The field: { origin: [x, y], cell, nx, ny, h: [z…], rock: [z…], soil, fluid? } — `h` the top of each cell (row-major, x
 * fastest), `rock` the bedrock under it (nothing digs or slumps below it), `soil` a soil matter (matter.js SOIL_IDS),
 * `fluid` a liquid lying on it (rupa/fluid.js: its depth per cell, carried through every act here).
 *
 * The soil's principles (matter.js):
 *   CRATER   the volume thrown out is the energy over the soil's `dig` (J/m³): V = E / dig; the bowl a paraboloid whose
 *            depth is 0.4 of its radius (simple craters run about a fifth as deep as they are wide), V = 0.2πR³; it stops
 *            at bedrock (`rock: true` said)
 *   EJECTA   the volume out, bulked by the soil's `swell`, falls in a rim from R to 3R, thinning as (r/R)⁻³ (the ejecta
 *            blanket law); every cubic metre is laid down on the field (normalized), none lost
 *   SLUMP    Mohr–Coulomb: a face between two cells stands while its drop is within the soil's critical height
 *            Hc = 4c/γ · tan(45° + φ/2) (a cohesive clay holds a trench wall; sand, c = 0, holds none); past it the soil
 *            runs down until the slope is the angle of repose φ. Soil moves; bedrock does not; volume is kept exactly
 *   DIG      a scoop (a paraboloid, `radius`, `depth`) taken out down to bedrock: its bank volume, and its loose volume
 *            (× swell) for wherever it goes
 *   DEPOSIT  a loose volume piled as a cone at the angle of repose, then slumped
 *   SHOVEL   dig a scoop's worth here, deposit it there (a hand shovel, an excavator's bucket, or cubic metres)
 *
 *   groundField({ origin?, size: [w, d], cell?, height?, soilDepth?, soil? }) → a field
 *   heightAt(field, x, y) · volumeOf(field) (Σ h × cell², metres³ above z = 0)
 *   crater(field, { at, joules, settle? })       → { field, radius, depth, removed, ejected, rock }
 *   slump(field, { iterations? })                → { field, moved, iterations }
 *   dig(field, { at, radius, depth })            → { field, bank, loose, rock }
 *   deposit(field, { at, volume })               → { field, radius }
 *   shovel(field, { from, to, scoop? })          → { field, bank, loose }
 *   SCOOPS                                       the named scoops' bank volumes, m³
 */
import { resolveMatter, isSoil } from './matter.js';
import { rupaPhysics } from './index.js';

const G = 9.81, DEG = Math.PI / 180;
export const SCOOPS = Object.freeze({ hand: 0.01, bucket: 0.8, excavator: 2 });

function soilOf(id, where = 'ground.soil') {
  const m = resolveMatter(id, where);
  if (!isSoil(m)) throw new Error(`${where}: '${m.id}' is not a soil (sand, loam, clay, gravel, snow)`);
  return m;
}
const copy = (f) => ({ ...f, h: f.h.slice(), rock: f.rock.slice(), ...(f.fluid ? { fluid: { ...f.fluid, d: f.fluid.d.slice(), q: f.fluid.q.slice() } } : {}) });
const idx = (f, i, j) => j * f.nx + i;
const cx = (f, i) => f.origin[0] + (i + 0.5) * f.cell;
const cy = (f, j) => f.origin[1] + (j + 0.5) * f.cell;
const isPt = (p) => Array.isArray(p) && p.length >= 2 && p.every((x) => Number.isFinite(x));

export function groundField({ origin = [0, 0], size, cell = 0.5, height = 0, soilDepth = 2, soil = 'loam' } = {}) {
  if (!Array.isArray(size) || size.length !== 2 || !size.every((x) => x > 0)) throw new Error('ground: size is [width, depth] in metres');
  if (!(cell > 0)) throw new Error('ground: cell is metres above 0');
  soilOf(soil);
  const nx = Math.max(1, Math.round(size[0] / cell)), ny = Math.max(1, Math.round(size[1] / cell));
  if (nx * ny > 1e6) throw new Error('ground: more than a million cells; take a coarser cell');
  return { origin: [...origin], cell, nx, ny, h: new Array(nx * ny).fill(height), rock: new Array(nx * ny).fill(height - soilDepth), soil };
}

export function heightAt(f, x, y) {
  const u = Math.min(f.nx - 1, Math.max(0, (x - f.origin[0]) / f.cell - 0.5)), v = Math.min(f.ny - 1, Math.max(0, (y - f.origin[1]) / f.cell - 0.5));
  const i = Math.floor(u), j = Math.floor(v), i1 = Math.min(f.nx - 1, i + 1), j1 = Math.min(f.ny - 1, j + 1), a = u - i, b = v - j;
  return (f.h[idx(f, i, j)] * (1 - a) + f.h[idx(f, i1, j)] * a) * (1 - b) + (f.h[idx(f, i, j1)] * (1 - a) + f.h[idx(f, i1, j1)] * a) * b;
}

export const volumeOf = (f) => f.h.reduce((s, z) => s + z, 0) * f.cell * f.cell;

// lay `volume` m³ on the field shaped by weight(r) per cell, normalized so every cubic metre lands
function lay(f, at, volume, weight, reach) {
  const A = f.cell * f.cell, ws = [];
  let total = 0;
  const i0 = Math.max(0, Math.floor((at[0] - reach - f.origin[0]) / f.cell)), i1 = Math.min(f.nx - 1, Math.ceil((at[0] + reach - f.origin[0]) / f.cell));
  const j0 = Math.max(0, Math.floor((at[1] - reach - f.origin[1]) / f.cell)), j1 = Math.min(f.ny - 1, Math.ceil((at[1] + reach - f.origin[1]) / f.cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const w = weight(Math.hypot(cx(f, i) - at[0], cy(f, j) - at[1]));
    if (w > 0) { ws.push([idx(f, i, j), w]); total += w; }
  }
  if (!(total > 0)) {   // nothing in reach: the nearest cell takes it
    const i = Math.min(f.nx - 1, Math.max(0, Math.floor((at[0] - f.origin[0]) / f.cell))), j = Math.min(f.ny - 1, Math.max(0, Math.floor((at[1] - f.origin[1]) / f.cell)));
    ws.push([idx(f, i, j), 1]); total = 1;
  }
  for (const [k, w] of ws) f.h[k] += (volume / A) * (w / total);
}

// take a paraboloid bowl out (depth D at the centre, radius R), never below bedrock; the bank volume taken
function scoop(f, at, R, D) {
  const A = f.cell * f.cell;
  let taken = 0, rock = false;
  const i0 = Math.max(0, Math.floor((at[0] - R - f.origin[0]) / f.cell)), i1 = Math.min(f.nx - 1, Math.ceil((at[0] + R - f.origin[0]) / f.cell));
  const j0 = Math.max(0, Math.floor((at[1] - R - f.origin[1]) / f.cell)), j1 = Math.min(f.ny - 1, Math.ceil((at[1] + R - f.origin[1]) / f.cell));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const r = Math.hypot(cx(f, i) - at[0], cy(f, j) - at[1]);
    if (r >= R) continue;
    const k = idx(f, i, j), want = D * (1 - (r / R) ** 2), to = Math.max(f.rock[k], f.h[k] - want);
    if (f.h[k] - want < f.rock[k]) rock = true;
    taken += (f.h[k] - to) * A;
    f.h[k] = to;
  }
  return { taken, rock };
}

export function slump(field, { iterations = 400 } = {}) {
  const f = copy(field), m = soilOf(f.soil), d = f.cell;
  const tanPhi = Math.tan(m.phi * DEG), Hc = (4 * m.c) / (m.density * G) * Math.tan((45 + m.phi / 2) * DEG), repose = d * tanPhi;
  let moved = 0, n = 0;
  for (; n < iterations; n++) {
    let most = 0;
    for (let j = 0; j < f.ny; j++) for (let i = 0; i < f.nx; i++) {
      const a = idx(f, i, j);
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        if (i + di >= f.nx || j + dj >= f.ny) continue;
        const b = idx(f, i + di, j + dj), drop = f.h[a] - f.h[b], hi = drop > 0 ? a : b, lo = drop > 0 ? b : a, dz = Math.abs(drop);
        if (dz <= Hc || dz <= repose) continue;
        const q = Math.min((dz - repose) / 2, f.h[hi] - f.rock[hi]);
        if (q <= 1e-9) continue;
        f.h[hi] -= q; f.h[lo] += q; moved += q * d * d; most = Math.max(most, q);
      }
    }
    if (most < 1e-4) break;
  }
  return { field: f, moved, iterations: n };
}

export function crater(field, { at, joules, settle = true } = {}) {
  if (!isPt(at)) throw new Error('ground.crater: at is [x, y]');
  if (!(Number.isFinite(joules) && joules >= 0)) throw new Error('ground.crater: joules is the energy that reaches the ground, 0 or more');
  const f = copy(field), m = soilOf(f.soil);
  const { radius: R, depth: D } = rupaPhysics.craterSize(joules, m.dig);   // the runtime's law: the page paints the same
  const { taken, rock } = scoop(f, at, R, D);
  const ejected = taken * m.swell;
  if (ejected > 0) lay(f, at, ejected, (r) => (r >= R ? (r / R) ** -3 : 0), 3 * R);
  const out = settle ? slump(f).field : f;
  return { field: out, radius: R, depth: D, removed: taken, ejected, rock };
}

export function dig(field, { at, radius, depth } = {}) {
  if (!isPt(at)) throw new Error('ground.dig: at is [x, y]');
  if (!(radius > 0) || !(depth > 0)) throw new Error('ground.dig: radius and depth are metres above 0');
  const f = copy(field), m = soilOf(f.soil), { taken, rock } = scoop(f, at, radius, depth);
  return { field: f, bank: taken, loose: taken * m.swell, rock };
}

export function deposit(field, { at, volume } = {}) {
  if (!isPt(at)) throw new Error('ground.deposit: at is [x, y]');
  if (!(Number.isFinite(volume) && volume >= 0)) throw new Error('ground.deposit: volume is loose cubic metres, 0 or more');
  const f = copy(field), m = soilOf(f.soil), tanPhi = Math.tan(m.phi * DEG);
  const r = Math.max(f.cell, Math.cbrt((3 * volume) / (Math.PI * tanPhi)));
  if (volume > 0) lay(f, at, volume, (x) => (x < r ? r - x : 0), r);
  return { field: slump(f).field, radius: r };
}

export function shovel(field, { from, to, scoop: s = 'hand' } = {}) {
  const bank = typeof s === 'string' ? SCOOPS[s] : s;
  if (!(bank > 0)) throw new Error(`ground.shovel: scoop is ${Object.keys(SCOOPS).join(', ')}, or bank cubic metres above 0`);
  const radius = Math.cbrt((2 * bank) / Math.PI);   // a scoop as deep as it is wide: V = πr²·r/2
  const D = dig(field, { at: from, radius, depth: radius });
  const P = deposit(D.field, { at: to, volume: D.loose });
  return { field: P.field, bank: D.bank, loose: D.loose, rock: D.rock };
}
