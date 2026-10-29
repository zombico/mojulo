/**
 * THE GEOTOWN, BUILT — the geocube kind's `show: 'geotown'`: a neighbourhood's map (design.js) stood on the cube's own
 * land at its hour, LEVELLED: its streets draped on the land's smoothed ground (they keep its grade), each plot a level
 * pad over the walk at its front. Only what the map needs is drawn, each surface once:
 *
 *   streets   each piece of the right-of-way in cells along it (cut where the plots beside it are cut, so the walk and
 *             the front yards meet at the same points): the road on the streets' ground, the verge and the walk a kerb
 *             over it, a kerb's face along every road edge a walk or a verge stands on
 *   plots     the front yard a bank from the walk up (or down) to the pad, the path through it and its steps set in the
 *             bank, the pad one level quad behind (the side yards, the house's ground, the back yard), a hedge along a
 *             share of the front lines; where two pads meet at different heights a retaining face between them (along a
 *             row, at a corner's flank over its cross street, and where a block's two rows meet at their back line). The
 *             land under the town is never drawn
 *   houses    each built plot's house spoken in its style's language (the recipe's, else the pattern's, else the cube's
 *             builders': era/out-anchor-structure.js `speak`) on
 *             its envelope, standing on its pad; a semi pair one design mirrored about its party wall; painted from the
 *             kit's structure ramps and lit by the cube's sun, as a stage's town is (era/stage-buildings.js)
 *   parks     the land as it lies, eased to the walks round it, its paths across it
 *   margin    the land round the town, coarse, eased from the outer walks to the natural ground
 *   green     trees only on the surfaces that grow them (pattern.js SURFACES): the streets' trees on the verges at their
 *             stride, a tree or two in a back yard, the parks' and the margin's; grown variants stamped as repeats, each
 *             at the detail the cameras see it at (vegetation/pool.js)
 *
 *   GEOTOWN_KEYS                 the settings of the geocube kind's geotown
 *   GEOTOWN_FACES                the face budget a geotown is held to (a law, advice)
 *   assembleGeotownScene(m, ctx) → the payload: faces, repeats, colliders, anchors, cameras, sky, the walk and a route
 *                                  round the first block (the dummy's), and `geotown`: the ledger, the laws, the counts
 *
 * Metres, the design's frame (x east, y north, z up). Pure; seeded dice only.
 */
import { designGeotown } from './design.js';
import { SURFACES } from './pattern.js';
import { readGeocube, cubeBuildings, settlementStyle, CUBE_STREET_PAINT, geocubeReadout } from '../era/geocube.js';
import { readPaint, cubeLookSpec, lookLight, hourSky } from '../city/plan/look.js';
import { shadeHex, hexToRgb, rgbToHex } from '../polygonizer/vexar.js';
import { speak } from '../era/out-anchor-structure.js';
import { townLanguage } from '../era/out-town.js';
import { structureStyle, hasStructureRails } from '../era/out-structures.js';
import { structurePaint, paintStop } from '../era/out-structures-paint.js';
import { madeRamp } from '../era/style/swatches.js';
import { townDressOf, dressTownFace } from '../era/town-dress.js';
import { styleTownDress, styleReadout } from '../era/arch-style.js';
import { plantPool, plantRepeats } from '../vegetation/pool.js';
import { SPECIES } from '../vegetation/species.js';
import { streamOf } from '../city/plan/dice.js';
import { houseKits } from './houses.js';
import { frontOf } from './fronts.js';
import { yardOf, fenceOf, YARDS } from './yards.js';

export const GEOTOWN_KEYS = Object.freeze(['kind', 'cube', 'show', 'title', 'seed', 'hour', 'clouds', 'style', 'geotown', 'walk', 'shadows', 'occlusion', 'light']);
// the faces a geotown draws at most (its trees are repeats, budgeted apart): a law, advice
export const GEOTOWN_FACES = 60000;
// the trees' faces, summed over their instances: each starts at its least detail and the trees the views see largest
// step up until this is spent (vegetation/pool.js plantRepeats); the views' thresholds held this much stricter
const TREE_FACES = 400000, TREE_EYE = 0.05;
// a street cell's longest side (m); the park's and the margin's lattice (m)
const CELL = 6, PARK_CELL = 6, MARGIN_CELL = 8;
// a step's rise at most (m), a bank lower than this takes no steps; a hedge's height and depth (m)
const STEP_RISE = 0.18, NO_STEPS = 0.25, HEDGE = { h: 0.85, d: 0.55, in: 0.25 };
// the town's air: a share of the cube's, since a town is seen across hundreds of metres, not a trail's seventy
const TOWN_HAZE = 0.45;

const no = (msg) => { throw new Error(`geotown: ${msg}`); };
const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const newell = (c) => { const n = [0, 0, 0]; for (let i = 0; i < c.length; i++) { const a = c[i], b = c[(i + 1) % c.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); } return unit(n); };
const mix = (a, b, t) => rgbToHex(hexToRgb(a).map((v, i) => v + (hexToRgb(b)[i] - v) * t));
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
// a shed's paint, one a yard
const SHEDS = ['#6f7d63', '#8a5b4a', '#5e6f7d', '#b9ab8f', '#7d6a8a'];
/** A key by its weight (`{ key: weight }`), never `prev`. */
const pickWeighted = (R, table, prev = null) => {
  const keys = Object.keys(table).filter((k) => k !== prev && table[k] > 0), sum = keys.reduce((a, k) => a + table[k], 0);
  let t = R() * sum;
  for (const k of keys) { t -= table[k]; if (t <= 0) return k; }
  return keys[keys.length - 1];
};
const hexOf = (c) => (typeof c === 'string' ? c : `#${c.map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`);

/** The breaks along [lo, hi]: its ends, every `extra` inside it, and no gap longer than `step`. */
function breaks(lo, hi, extra, step) {
  const s = [...new Set([lo, hi, ...extra.filter((v) => v > lo + 1e-6 && v < hi - 1e-6)].map((v) => Math.round(v * 1000) / 1000))].sort((a, b) => a - b), out = [s[0]];
  for (let i = 1; i < s.length; i++) { const g = s[i] - s[i - 1], n = Math.ceil(g / step - 1e-9); for (let k = 1; k < n; k++) out.push(s[i - 1] + (g * k) / n); out.push(s[i]); }
  return out;
}

/** The town's colours, leant to the cube's: its paving and its lawns. */
function coloursOf(cube) {
  const C = cube.colour;
  return {
    road: mix('#4d5055', C.floor, 0.15), walk: mix('#c8c2b4', C.stone, 0.3), kerb: mix('#b3ad9f', C.stone, 0.3), path: mix('#b7a68c', C.floor, 0.35),
    step: mix('#beb6a6', C.stone, 0.35), side: mix('#a59a86', C.floor, 0.3), 'park-path': mix('#c9b48f', C.sand ?? C.floor, 0.4), wall: mix('#9a9284', C.stone, 0.5),
    house: mix('#7a7266', C.stone, 0.3), lawn: C.grass, verge: C.grass, park: mix(C.grass, C.foliage, 0.12), margin: mix(C.grass, C.foliage, 0.3), hedge: C.foliage,
    // an evocation's yards and fronts
    glass: '#3b4654', timber: mix('#8b6b4c', C.floor, 0.25), deck: mix('#9a7a58', C.floor, 0.25), paving: mix('#b9b1a2', C.stone, 0.3), soil: '#5a4535',
    leaf: mix(C.foliage, C.grass, 0.25), sand: mix('#d8c69a', C.sand ?? C.floor, 0.3), shed: '#6f7d63', roof: '#4b4f55', door: '#3a3632', canvas: C.accent,
    metal: '#5c6166', gravel: '#9d978a', picket: '#ece7dc',
  };
}

/** The kit's structure paint, re-pointed to the cube's ramps (a stage's town street's, geocube.js CUBE_STREET_PAINT). */
function housePaint(kitId) {
  const has = (n) => { try { madeRamp(kitId, n); return true; } catch { return false; } };
  try {
    const P = structurePaint(kitId, { swatches: Object.fromEntries(Object.entries(CUBE_STREET_PAINT).filter(([, n]) => has(n))) });
    return (group, v) => hexOf(paintStop(P, group, v));
  } catch {
    const base = { 'str:plaster': [196, 186, 166], 'str:stone': [150, 146, 138], 'str:roof': [122, 72, 56] };
    return (group, v) => hexOf((base[group] ?? base['str:stone']).map((x) => x * (0.55 + 0.6 * v)));
  }
}

/** The geocube kind's geotown: the town's map stood on the cube's land at its hour. */
export function assembleGeotownScene(m, ctx = {}) {
  for (const k of Object.keys(m)) if (!GEOTOWN_KEYS.includes(k)) no(`'${k}' is not a setting of the geocube kind's geotown (cube, seed, hour, clouds, style, geotown)`);
  if (m.seed !== undefined && !Number.isInteger(m.seed)) no('seed is an integer');
  if (m.cube === undefined || m.cube === null) no('cube is a preset id or a document');
  const cube = readGeocube(m.cube), seed = m.seed ?? 1, d = designGeotown(m.geotown ?? {}, { seed }), P = d.pattern, row = d.row;
  const { S, N } = d.land, wk = (x, y) => S(x, y) + row.kerb;
  // ── the light: the cube's at its hour, under its clouds (city/plan/look.js: as it lights a city) ──
  const paint = readPaint({ geocube: m.cube, amount: 1, ...(m.hour !== undefined ? { hour: m.hour } : {}), ...(m.clouds !== undefined ? { clouds: m.clouds } : {}) });
  const spec = cubeLookSpec(paint), lit = lookLight(spec, paint), LIGHT = lit.light, sun = LIGHT.toLight, air = spec.air ?? spec.ref.air;
  const col = coloursOf(cube), faces = [], colliders = [], anchors = [];
  const put = (corners, group, hex, want = null) => {
    let c = corners, n = newell(c);
    if (want && n[0] * want[0] + n[1] * want[1] + n[2] * want[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    if (!want && n[2] < 0) { c = c.slice().reverse(); n = n.map((x) => -x); }
    const fill = shadeHex(hex, n, LIGHT);
    faces.push({ corners: c.map(P3), normal: P3(n), outNormal: P3(n), group, fill, cornerFills: c.map(() => fill) });
  };
  // ── the streets ──
  const plotYs = d.plots.flatMap((pl) => [pl.rect[1], pl.rect[3]]), plotXs = d.plots.flatMap((pl) => [pl.rect[0], pl.rect[2], pl.A[0] + pl.ey[0] * pl.setback]);
  for (const p of d.pieces) {
    const [x0, y0, x1, y1] = p.rect, along = p.street ? (p.street.startsWith('ns') ? 'y' : 'x') : null;
    const xs = along === 'x' ? breaks(x0, x1, plotXs, CELL) : [x0, x1], ys = along === 'y' ? breaks(y0, y1, plotYs, CELL) : [y0, y1];
    const lift = p.cls === 'road' ? 0 : row.kerb, hex = p.cls === 'road' ? col.road : p.cls === 'verge' ? col.verge : col.walk;
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const q = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]];
      put(q.map(([x, y]) => [x, y, S(x, y) + lift]), `geotown:${p.cls}`, hex);
    }
    // the kerb's face along each road edge a walk or a verge stands on, toward the road
    for (const side of p.kerbs ?? []) {
      const ax = side.endsWith('x'), at = side.startsWith('-') ? (ax ? x0 : y0) : (ax ? x1 : y1), into = side.startsWith('-') ? 1 : -1, run = ax ? ys : xs;
      for (let k = 0; k + 1 < run.length; k++) {
        const a = ax ? [at, run[k]] : [run[k], at], b = ax ? [at, run[k + 1]] : [run[k + 1], at];
        put([[...a, S(...a)], [...b, S(...b)], [...b, S(...b) + row.kerb], [...a, S(...a) + row.kerb]], 'geotown:kerb', col.kerb, ax ? [into, 0, 0] : [0, into, 0]);
      }
    }
  }
  // ── the houses' language: the recipe's style, else the pattern's, else the cube's buildings', else the timber hall ──
  const { style, anchor: a0 } = settlementStyle(cube, null, m.style ?? P.style), anchor = a0 ?? cubeBuildings(cube)?.anchor ?? 'timber-hall';
  const kitId = hasStructureRails(cube.outside.base) ? cube.outside.base : 'isekai-meadow';
  const sStyle = structureStyle(kitId, seed), L = townLanguage(sStyle, anchor), Pt = housePaint(kitId);
  const dress = style ? styleTownDress(style, cube, townDressOf(cube)) : townDressOf(cube);
  const litV = (n) => 0.55 + 0.45 * Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
  const [sLo, sHi] = P.house.storeys, spoken = new Map();
  // an EVOCATION's houses each a type of the pattern's (houses.js), each yard its own program (yards.js)
  const evoked = !!d.evoked, kits = evoked ? houseKits(P, m.style ?? P.style, cube, kitId, seed) : null, types = new Map();
  if (kits) for (const B of d.blocks) for (const side of ['w', 'e']) {
    const R = streamOf(seed, 'types', `${B.id}:${side}`);
    let prev = null;
    for (const pl of d.plots.filter((q) => q.block === B.id && q.side === side).sort((p, q) => p.k - q.k)) {
      const key = pl.pair ?? pl.id;
      if (!types.has(key)) { prev = kits.pick(R, prev); types.set(key, prev); }
    }
  }
  // ── the plots ──
  const W = (pl, u, v, z) => [pl.A[0] + pl.ex[0] * u + pl.ey[0] * v, pl.A[1] + pl.ex[1] * u + pl.ey[1] * v, z];
  const items = {}, grows = (sp, x, y, z, h, on) => { (items[sp] ||= []).push({ x: r5(x), y: r5(y), z0: r5(z), height: r5(h), on }); };
  // a yard's or a fence's face, in its plot's frame (u, v, z over its pad), painted by its role
  const yardPrev = new Map(), yardsOf = {};
  const yardFace = (pl, f, shedHex = col.shed) => {
    const cs = f.corners.map(([u, v, z]) => W(pl, u, v, pl.pad + z)), o = f.out, want = unit([pl.ex[0] * o[0] + pl.ey[0] * o[1], pl.ex[1] * o[0] + pl.ey[1] * o[1], o[2]]);
    put(cs, `geotown:${f.role}`, f.role === 'shed' ? shedHex : col[f.role] ?? col.timber, want);
  };
  let built = 0, hedges = 0;
  for (const pl of d.plots) {
    const { w, d: dep, setback: F, pad } = pl, { env, depth: Hd } = pl.house, envW = env[2] - env[0];
    const wkAt = (u) => { const [x, y] = W(pl, u, 0, 0); return wk(x, y); };
    // the house: its design (a semi's second half is its partner's, mirrored about the party wall), its door
    let house = null;
    if (pl.built) {
      const key = pl.pair ?? pl.id, R0 = streamOf(seed, 'house', key), K = kits ? kits.kit(types.get(key)) : null;
      if (!spoken.has(key)) {
        const s = Math.floor(R0() * 1e6) + 1, [b0, b1] = K ? K.band : [sLo, sHi];
        spoken.set(key, speak(K ? K.L : L, 'dwelling', { w: r5(envW), d: r5(Hd) }, K ? kits.sStyle : sStyle, s, { ring: 'near', band: [b0, b1], over: { front: 0, side: 0, rear: 0, area: envW * Hd * b0 } }));
      }
      const dz = spoken.get(key), mirror = pl.half === 'R';
      const door = dz.faces.find((f) => f.part === 'door'), dx = door ? door.corners.reduce((a, c) => a + c[0], 0) / door.corners.length : envW / 2;
      // (its front: a bay and a porch, fronts.js, in its own frame; a semi's halves mirrored, so the pair is symmetric)
      const front = K ? frontOf(K.front, { W: dz.dims.W0, n: dz.dims.n, storeyH: dz.dims.storeyH, doorX: dx, doorW: dz.dims.doorW }) : null;
      house = { design: dz, mirror, doorU: env[0] + (mirror ? envW - dx : dx), kit: K, front, porch: front?.porch ?? 0 };
    }
    // the path to the door (or the envelope's middle), inside the front yard
    const pw = pl.path.w, pu = Math.max(pw / 2 + 0.05, Math.min(w - pw / 2 - 0.05, house ? house.doorU : pl.path.u)), a = pu - pw / 2, b = pu + pw / 2;
    // the front bank: the walk's back edge up (or down) to the pad at the setback line, in three strips about the path
    const R = streamOf(seed, 'yard', pl.id), lawn = mix(col.lawn, R() < 0.5 ? col.hedge : '#ffffff', 0.04 + 0.08 * R());
    for (const [u0, u1, grp, hex] of [[0, a, 'front', lawn], [a, b, 'path', col.path], [b, w, 'front', lawn]]) {
      if (u1 - u0 < 1e-3) continue;
      put([W(pl, u0, 0, wkAt(u0)), W(pl, u1, 0, wkAt(u1)), W(pl, u1, F, pad), W(pl, u0, F, pad)], `geotown:${grp}`, hex);
    }
    // the path's steps, set in the bank: each tread level with the bank at its back, its riser down to the bank at its foot
    // (up to a porch's deck where the house has one: its steps end at the deck's front)
    const rise = pad - wkAt(pu), Fs = F - (house?.porch ?? 0);
    if (Math.abs(rise) > NO_STEPS) {
      const n = Math.ceil(Math.abs(rise) / STEP_RISE), go = Fs / n, base = wkAt(pu), up = Math.sign(rise);
      for (let i = 0; i < n; i++) {
        // going up the bank from the walk: tread i spans [i·go, (i+1)·go], its top the bank's height at its far edge
        const v0 = i * go, v1 = (i + 1) * go, zt = base + (rise * (up > 0 ? i + 1 : i)) / n, zb0 = base + (rise * i) / n, zb1 = base + (rise * (i + 1)) / n;
        put([W(pl, a, v0, zt), W(pl, b, v0, zt), W(pl, b, v1, zt), W(pl, a, v1, zt)], 'geotown:step', col.step);
        // the riser (up: at its foot, facing the street; down: at its far edge, facing the house)
        const vr = up > 0 ? v0 : v1, zr = up > 0 ? zb0 : zb1;
        if (Math.abs(zt - zr) > 1e-3) put([W(pl, a, vr, zr), W(pl, b, vr, zr), W(pl, b, vr, zt), W(pl, a, vr, zt)], 'geotown:step', col.step, up > 0 ? [-pl.ey[0], -pl.ey[1], 0] : [pl.ey[0], pl.ey[1], 0]);
        // its cheeks, where it stands over the bank
        for (const [u, s] of [[a, -1], [b, 1]]) {
          const out = [pl.ex[0] * s, pl.ex[1] * s, 0];
          if (up > 0) put([W(pl, u, v0, zb0), W(pl, u, v1, zt), W(pl, u, v0, zt)], 'geotown:step', col.step, out);
          else put([W(pl, u, v0, zb0), W(pl, u, v1, zb1), W(pl, u, v1, zt)], 'geotown:step', col.step, out);
        }
      }
    }
    // the pad: the side yards, the house's ground, the back yard, one level quad each
    const [sL, sR] = pl.house.sides;
    const quadAt = (u0, v0, u1, v1, grp, hex) => { if (u1 - u0 > 1e-3 && v1 - v0 > 1e-3) put([W(pl, u0, v0, pad), W(pl, u1, v0, pad), W(pl, u1, v1, pad), W(pl, u0, v1, pad)], `geotown:${grp}`, hex); };
    quadAt(0, F, sL, F + Hd, 'side', col.side); quadAt(w - sR, F, w, F + Hd, 'side', col.side);
    quadAt(sL, F, w - sR, F + Hd, 'house', col.house); quadAt(0, F + Hd, w, dep, 'back', lawn);
    // a hedge along the front line, a share of the households keep one (not across the path)
    if (R() < P.grow.front) {
      hedges++;
      for (const [u0, u1] of [[HEDGE.in, a - 0.3], [b + 0.3, w - HEDGE.in]]) {
        if (u1 - u0 < 0.8) continue;
        const v0 = HEDGE.in, v1 = HEDGE.in + HEDGE.d, z0 = Math.min(wkAt(u0), wkAt(u1)) - 0.05, zt = z0 + HEDGE.h + Math.max(0, (pad - wkAt((u0 + u1) / 2)) * (v1 / F));
        const c = [W(pl, u0, v0, 0), W(pl, u1, v0, 0), W(pl, u1, v1, 0), W(pl, u0, v1, 0)];
        put(c.map((p) => [p[0], p[1], zt]), 'geotown:hedge', col.hedge);
        for (let k = 0; k < 4; k++) { const p = c[k], q = c[(k + 1) % 4], o = unit([...cross(sub3(q, p), [0, 0, 1]).slice(0, 2), 0]); put([[p[0], p[1], z0], [q[0], q[1], z0], [q[0], q[1], zt], [p[0], p[1], zt]], 'geotown:hedge', col.hedge, o); }
      }
    }
    // the house on its pad: its faces from its design, a semi's second half mirrored; painted and lit as a stage's town
    if (house) {
      built++;
      const dz = house.design, X = (x) => env[0] + (house.mirror ? envW - x : x), toW = (c) => W(pl, X(c[0]), F + c[1], pad + c[2]);
      let top = 0, lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
      for (const f of dz.faces) {
        const cs = (house.mirror ? f.corners.slice().reverse() : f.corners).map(toW), nl = f.normal ?? [0, 0, 1], nn = unit([pl.ex[0] * (house.mirror ? -nl[0] : nl[0]) + pl.ey[0] * nl[1], pl.ex[1] * (house.mirror ? -nl[0] : nl[0]) + pl.ey[1] * nl[1], nl[2]]);
        for (const c of cs) { top = Math.max(top, c[2] - pad); lo = [Math.min(lo[0], c[0]), Math.min(lo[1], c[1])]; hi = [Math.max(hi[0], c[0]), Math.max(hi[1], c[1])]; }
        const fill = Pt(f.group, Math.min(1, (f.value ?? 0.6) * litV(nn))), F0 = { corners: cs.map(P3), group: `town:${f.part}`, fill, cornerFills: cs.map(() => fill), normal: P3(nn), outNormal: P3(nn) };
        const Dr = house.kit ? house.kit.dress : dress;
        faces.push(Dr ? dressTownFace(F0, f.group, Dr) : F0);
      }
      // its front: the bay's walls in their storey's own wall, its lights, its trim and its top; the porch's deck,
      // posts and roof
      if (house.front) {
        const wallOf = new Map();
        for (const f of dz.faces) if (f.part === 'wall') { const s0 = Math.floor((Math.min(...f.corners.map((c) => c[2])) + 0.05) / dz.dims.storeyH); if (!wallOf.has(s0)) wallOf.set(s0, { group: f.group, value: f.value ?? 0.5 }); }
        const Dr = house.kit.dress;
        for (const f of house.front.faces) {
          const cs = (house.mirror ? f.corners.slice().reverse() : f.corners).map(toW), o = f.out, ox = house.mirror ? -o[0] : o[0], nn = unit([pl.ex[0] * ox + pl.ey[0] * o[1], pl.ex[1] * ox + pl.ey[1] * o[1], o[2]]);
          const n0 = newell(cs), nf = n0[0] * nn[0] + n0[1] * nn[1] + n0[2] * nn[2] < 0 ? n0.map((x) => -x) : n0, cw = n0 === nf ? cs : cs.slice().reverse();
          for (const c of cw) { top = Math.max(top, c[2] - pad); lo = [Math.min(lo[0], c[0]), Math.min(lo[1], c[1])]; hi = [Math.max(hi[0], c[0]), Math.max(hi[1], c[1])]; }
          const W0 = wallOf.get(Math.min(f.storey ?? 0, dz.dims.n - 1)) ?? wallOf.get(0) ?? { group: dz.dims.ground, value: 0.5 };
          const [grp, v] = f.role === 'wall' ? [W0.group, W0.value] : f.role === 'roof' ? [dz.dims.covering, 0.34] : f.role === 'trim' ? ['str:paint', 0.92] : f.role === 'deck' ? ['str:timber', 0.5] : [null, 0];
          const fill = grp ? Pt(grp, Math.min(1, v * litV(nf))) : shadeHex(col.glass, nf, LIGHT), F0 = { corners: cw.map(P3), group: `geotown:${f.role === 'glass' ? 'glass' : f.role === 'wall' ? 'bay' : f.role === 'deck' ? 'porch' : f.role}`, fill, cornerFills: cw.map(() => fill), normal: P3(nf), outNormal: P3(nf) };
          faces.push(grp && Dr && f.role !== 'deck' ? dressTownFace(F0, grp, Dr) : F0);
        }
      }
      colliders.push({ min: P3([lo[0], lo[1], pad]), max: P3([hi[0], hi[1], pad + top]), of: `${pl.id}:house` });
      anchors.push({ id: `house-${pl.id}`, kind: 'house', use: 'dwelling', at: P3(W(pl, house.doorU, F, pad)), N: P3([-pl.ey[0], -pl.ey[1], 0]), floor: r5(pad), box: { min: P3([lo[0], lo[1], pad]), max: P3([hi[0], hi[1], pad + top]) }, ...(house.kit ? { type: house.kit.id } : {}) });
      // an evocation's back yard: its own program, on its pad, from the house's back wall to the plot's back line
      if (evoked) {
        const Ry = streamOf(seed, 'yards', pl.id), prog = pickWeighted(Ry, P.yards, yardPrev.get(`${pl.block}:${pl.side}`)), v0 = F + Math.min(Hd, dz.dims.D0);
        yardPrev.set(`${pl.block}:${pl.side}`, prog); yardsOf[prog] = (yardsOf[prog] ?? 0) + 1; pl.yard = prog; pl.fence = pickWeighted(Ry, P.fences);
        const Y = yardOf(prog, { w, v0, v1: dep, R: Ry }), shedHex = SHEDS[Math.floor(Ry() * SHEDS.length)];
        for (const f of Y.faces) yardFace(pl, f, shedHex);
        for (const t of Y.trees.slice(0, YARDS[prog].trees)) { const [x, y] = W(pl, t.u, t.v, 0), sp = P.grow.trees[Math.floor(Ry() * P.grow.trees.length)], [hl, hh] = SPECIES[sp].heights; grows(sp, x, y, pad, hl + (hh - hl) * (0.25 + 0.5 * Ry()), 'back'); }
      }
    }
  }
  // ── where pads meet: along each row, at a corner's flank, and at a block's back line ──
  const wall = (cs, want) => put(cs, 'geotown:wall', col.wall, want);
  for (const B of d.blocks) {
    if (B.use === 'park') continue;
    for (const side of ['w', 'e']) {
      const rowP = d.plots.filter((pl) => pl.block === B.id && pl.side === side).sort((p, q) => p.k - q.k);
      for (let k = 0; k + 1 < rowP.length; k++) {
        const p = rowP[k], q = rowP[k + 1];
        if (Math.abs(p.pad - q.pad) < 0.01) continue;
        const lowSide = p.pad > q.pad ? [p.ex[0], p.ex[1], 0] : [-p.ex[0], -p.ex[1], 0], f0 = W(p, p.w, 0, 0), f0z = wk(f0[0], f0[1]);
        wall([[f0[0], f0[1], f0z], W(p, p.w, p.setback, p.pad), W(p, p.w, p.setback, q.pad)], lowSide);
        wall([W(p, p.w, p.setback, p.pad), W(p, p.w, p.d, p.pad), W(p, p.w, p.d, q.pad), W(p, p.w, p.setback, q.pad)], lowSide);
      }
      // the flanks: the first plot's start and the last plot's end stand over (or under) the cross street's walk
      for (const [p, u, s] of [[rowP[0], 0, -1], [rowP[rowP.length - 1], rowP[rowP.length - 1].w, 1]]) {
        if (!p) continue;
        const pts = [0, p.setback, p.d].map((v) => { const q = W(p, u, v, 0); return [q[0], q[1], wk(q[0], q[1])]; }), out = [p.ex[0] * s, p.ex[1] * s, 0];
        const want = (z) => (p.pad >= z ? out : out.map((x) => -x));
        if (Math.abs(p.pad - pts[1][2]) > 0.01) wall([pts[0], pts[1], [pts[1][0], pts[1][1], p.pad]], want(pts[1][2]));
        if (Math.abs(p.pad - (pts[1][2] + pts[2][2]) / 2) > 0.01) wall([pts[1], pts[2], [pts[2][0], pts[2][1], p.pad], [pts[1][0], pts[1][1], p.pad]], want((pts[1][2] + pts[2][2]) / 2));
      }
    }
    // the back line: the west row's back against the east row's
    const Wr = d.plots.filter((pl) => pl.block === B.id && pl.side === 'w'), Er = d.plots.filter((pl) => pl.block === B.id && pl.side === 'e'), xr = B.rect[0] + d.depth;
    for (const p of Wr) for (const q of Er) {
      const y0 = Math.max(p.rect[1], q.rect[1]), y1 = Math.min(p.rect[3], q.rect[3]);
      if (y1 - y0 < 1e-3 || Math.abs(p.pad - q.pad) < 0.01) continue;
      wall([[xr, y0, p.pad], [xr, y1, p.pad], [xr, y1, q.pad], [xr, y0, q.pad]], p.pad > q.pad ? [1, 0, 0] : [-1, 0, 0]);
    }
  }
  // ── an evocation's fences: between each yard and the next (from the houses' back walls), on its flanks, and along
  // the back line (the west row's), each plot's own kind, standing on the higher of the two pads ──
  if (evoked) for (const B of d.blocks) for (const side of ['w', 'e']) {
    const rowP = d.plots.filter((pl) => pl.block === B.id && pl.side === side && pl.fence).sort((p, q) => p.k - q.k);
    rowP.forEach((p, k) => {
      const q = rowP[k + 1], vb = (pl) => pl.setback + pl.house.depth;
      if (q) for (const f of fenceOf(p.fence, [p.w, Math.max(vb(p), vb(q))], [p.w, p.d], Math.max(0, q.pad - p.pad))) yardFace(p, f);
      if (k === 0) for (const f of fenceOf(p.fence, [0, vb(p)], [0, p.d], 0)) yardFace(p, f);
      if (!q) for (const f of fenceOf(p.fence, [p.w, vb(p)], [p.w, p.d], 0)) yardFace(p, f);
      if (side === 'w') for (const f of fenceOf(p.fence, [0, p.d], [p.w, p.d], 0)) yardFace(p, f);
    });
  }
  // ── the parks: the land as it lies, eased to the walks round it; their paths on the same lattice ──
  const parkZ = (B) => (x, y) => { const [x0, y0, x1, y1] = B.rect, e = Math.min(x - x0, x1 - x, y - y0, y1 - y), t = smooth(0, 14, e); return wk(x, y) * (1 - t) + N(x, y) * t; };
  const inRect = (r, x, y, pad = 0) => x > r[0] - pad && x < r[2] + pad && y > r[1] - pad && y < r[3] + pad;
  for (const B of d.blocks) {
    if (B.use !== 'park') continue;
    const [x0, y0, x1, y1] = B.rect, z = parkZ(B), edgesX = B.paths.flatMap((r) => [r[0], r[2]]), edgesY = B.paths.flatMap((r) => [r[1], r[3]]);
    const xs = breaks(x0, x1, [...edgesX, ...plotXs], PARK_CELL), ys = breaks(y0, y1, edgesY, PARK_CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2, path = B.paths.some((r) => inRect(r, cx, cy));
      put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, z(x, y)]), path ? 'geotown:park-path' : 'geotown:park', path ? col['park-path'] : col.park);
    }
    // its trees, loose, clear of its paths and a little in from its edges
    const R = streamOf(seed, 'green', `park:${B.id}`), want = Math.round(((x1 - x0) * (y1 - y0) / 10000) * P.grow.park);
    for (let k = 0, tries = 0; k < want && tries < want * 12; tries++) {
      const x = x0 + 4 + R() * (x1 - x0 - 8), y = y0 + 4 + R() * (y1 - y0 - 8);
      if (B.paths.some((r) => inRect(r, x, y, 3))) continue;
      const sp = P.grow.parkTrees[Math.floor(R() * P.grow.parkTrees.length)], [hl, hh] = SPECIES[sp].heights;
      grows(sp, x, y, z(x, y), hl + (hh - hl) * (0.4 + 0.6 * R()), 'park'); k++;
    }
  }
  // ── the margin: the land round the town, coarse, eased from the outer walks to the natural ground ──
  const { W: FW, D: FD, margin: M } = d.frame;
  const marginZ = (x, y) => { const qx = Math.max(0, Math.min(FW, x)), qy = Math.max(0, Math.min(FD, y)), e = Math.hypot(x - qx, y - qy); return wk(qx, qy) * (1 - smooth(0, Math.max(1, 0.7 * M), e)) + N(x, y) * smooth(0, Math.max(1, 0.7 * M), e); };
  if (M > 0) {
    const xs = breaks(-M, FW + M, [0, FW], MARGIN_CELL), ys = breaks(-M, FD + M, [0, FD], MARGIN_CELL);
    for (let j = 0; j + 1 < ys.length; j++) for (let i = 0; i + 1 < xs.length; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cy = (ys[j] + ys[j + 1]) / 2;
      if (cx > 0 && cx < FW && cy > 0 && cy < FD) continue;
      put([[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]].map(([x, y]) => [x, y, marginZ(x, y)]), 'geotown:margin', col.margin);
    }
    // a loose belt of trees round the town, one to every few hundred square metres of it, kept off the outer walks
    // (an evocation's belt thinner: its trees are its block's)
    const R = streamOf(seed, 'green', 'margin'), want = Math.round(((FW + 2 * M) * (FD + 2 * M) - FW * FD) / (evoked ? 900 : 320));
    for (let k = 0; k < want; k++) {
      const x = -M + R() * (FW + 2 * M), y = -M + R() * (FD + 2 * M);
      if (x > -5 && x < FW + 5 && y > -5 && y < FD + 5) continue;
      const sp = P.grow.parkTrees[Math.floor(R() * P.grow.parkTrees.length)], [hl, hh] = SPECIES[sp].heights;
      grows(sp, x, y, marginZ(x, y), hl + (hh - hl) * R(), 'margin');
    }
  }
  // ── the green on the plan: the streets' trees on the verges, a tree or two in a back yard ──
  for (const p of d.pieces) {
    if (p.cls !== 'verge') continue;
    const [x0, y0, x1, y1] = p.rect, ax = x1 - x0 > y1 - y0, len = ax ? x1 - x0 : y1 - y0, R = streamOf(seed, 'green', `street:${p.street}:${p.seg}:${p.side}`);
    for (let s = 3 + R() * P.grow.stride * 0.6; s < len - 3; s += P.grow.stride * (0.85 + 0.3 * R())) {
      const x = ax ? x0 + s : (x0 + x1) / 2, y = ax ? (y0 + y1) / 2 : y0 + s, sp = P.grow.street[Math.floor(R() * P.grow.street.length)], [hl, hh] = SPECIES[sp].heights;
      grows(sp, x, y, wk(x, y), hl + (Math.min(hh, 16) - hl) * (0.3 + 0.5 * R()), 'verge');
    }
  }
  for (const pl of d.plots) {
    if (!pl.built || evoked) continue;
    const back = pl.d - pl.setback - pl.house.depth;
    if (back < 5) continue;
    const R = streamOf(seed, 'green', `back:${pl.id}`), [lo, hi] = P.grow.back, n = Math.min(hi, lo + Math.floor(R() * (hi - lo + 1)));
    for (let k = 0; k < n; k++) {
      const u = 1.5 + R() * (pl.w - 3), v = pl.setback + pl.house.depth + 3 + R() * Math.max(0, back - 5), [x, y] = W(pl, u, v, 0);
      const sp = P.grow.trees[Math.floor(R() * P.grow.trees.length)], [hl, hh] = SPECIES[sp].heights;
      grows(sp, x, y, pl.pad, hl + (hh - hl) * (0.25 + 0.5 * R()), 'back');
    }
  }
  // ── the views: down a street from its walk, a house from across its street, over the town ──
  const B0 = d.blocks.find((b) => b.use !== 'park') ?? d.blocks[0], ym = (B0.rect[1] + B0.rect[3]) / 2, xw = d.X[B0.i] + row.R + row.verge + row.walk / 2;
  const cam = (name, from, to, fov) => ({ name, worldFraming: { cameraPosition: P3(from), lookAt: P3(to), horizontalFov: fov } });
  const back0 = Math.min(30, (B0.rect[3] - B0.rect[1]) / 2 + 4), eye = [xw, ym - back0, wk(xw, ym - back0) + 1.7], facing = d.plots.filter((pl) => pl.block === B0.id && pl.side === 'w' && pl.built).sort((p, q) => Math.abs((p.rect[1] + p.rect[3]) / 2 - ym) - Math.abs((q.rect[1] + q.rect[3]) / 2 - ym))[0];
  const zMean = (d.land.range[0] + d.land.range[1]) / 2, span = Math.max(FW, FD);
  const cameras = [
    cam('street', eye, [xw + 6, ym + 30, eye[2] + 1.2], 70),
    // (from the walk before it, a few metres along: between the boulevard's trees and its front yard)
    ...(facing ? [(() => { const yc = (facing.rect[1] + facing.rect[3]) / 2, xs = d.X[B0.i] + row.half - row.walk / 2, p = [xs, yc - 9]; return cam('house', [...p, wk(...p) + 1.6], [facing.A[0] + facing.setback + 2, yc, facing.pad + 3.5], 66); })()] : []),
    // (an evocation: over its back yards from its back line's end, and over the block close; a town to scale: high)
    ...(evoked ? (() => {
      const xr = B0.rect[0] + d.depth, pads = d.plots.filter((pl) => pl.block === B0.id).map((pl) => pl.pad), zt = Math.max(...pads), zm = pads.reduce((a, z) => a + z, 0) / pads.length;
      return [cam('yards', [xr, B0.rect[1] - 3, zt + 17], [xr, (B0.rect[1] + B0.rect[3]) / 2 + 4, zm], 66), cam('aerial', [B0.rect[0] - 28, B0.rect[1] - 34, zt + 34], [(B0.rect[0] + B0.rect[2]) / 2, (B0.rect[1] + B0.rect[3]) / 2, zm], 55)];
    })() : [cam('aerial', [-0.18 * FW, -0.22 * FD, zMean + 0.45 * span], [FW * 0.5, FD * 0.45, zMean], 58)]),
  ];
  // ── the trees, grown and stamped at the detail the views see them at ──
  const repeats = [], textures = {}, eyes = cameras.map(({ worldFraming: wf }) => ({ pos: wf.cameraPosition, focalPx: (TREE_EYE * 1280) / (2 * Math.tan((wf.horizontalFov * Math.PI) / 360)) }));
  // (each species its share of the budget, by how many of the trees it is)
  const all = Object.values(items).reduce((a, l) => a + l.length, 0) || 1, growth = {};
  let treeFaces = 0;
  for (const sp of Object.keys(items).sort()) {
    for (const it of items[sp]) growth[it.on] = (growth[it.on] ?? 0) + 1;
    const pool = plantPool({ species: sp, variants: 2, seed: `geotown::${sp}`, light: LIGHT, maxLevel: 'L2', group: `geotown:tree-${sp}` });
    const placed = plantRepeats(pool, items[sp].map(({ on, ...it }) => it), { eyes, level: 'L2', budget: Math.round((TREE_FACES * items[sp].length) / all), sink: 0.05 });
    treeFaces += placed.stats.drawnFaces;
    repeats.push(...placed.repeats);
    Object.assign(textures, pool.textures || {});
  }
  // ── the route round the first block's walks (the dummy's), the walk's spawn on the street view ──
  const ring = [[d.X[B0.i] + row.half - row.walk / 2, d.Y[B0.j] + row.half - row.walk / 2], [d.X[B0.i + 1] - row.half + row.walk / 2, d.Y[B0.j] + row.half - row.walk / 2], [d.X[B0.i + 1] - row.half + row.walk / 2, d.Y[B0.j + 1] - row.half + row.walk / 2], [d.X[B0.i] + row.half - row.walk / 2, d.Y[B0.j + 1] - row.half + row.walk / 2]];
  const route = [];
  for (let k = 0; k < 4; k++) { const p = ring[k], q = ring[(k + 1) % 4], n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 2)); for (let i = 0; i < n; i++) { const x = p[0] + ((q[0] - p[0]) * i) / n, y = p[1] + ((q[1] - p[1]) * i) / n; route.push(P3([x, y, wk(x, y)])); } }
  route.push(route[0]);
  // (the dummy sets off from the block's far corner, out of the street view's way)
  const half0 = Math.floor(route.length / 2), routeFrom = [...route.slice(half0, -1), ...route.slice(0, half0 + 1)];
  // ── the laws the scene adds: nothing grows on a hard surface; the faces under their budget ──
  const hard = Object.entries(growth).filter(([on]) => on !== 'margin' && !(SURFACES[on]?.grows ?? []).some((g) => g === 'tree' || g === 'street-tree')).reduce((a, [, n]) => a + n, 0);
  const laws = [...d.laws,
    { law: 'bare', ok: hard === 0, value: `trees ${Object.entries(growth).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}; ${hard} on a hard surface`, want: 'nothing grows on a road, a walk, a path, a side yard or a house\'s footprint' },
    { law: 'faces', ok: faces.length <= GEOTOWN_FACES, value: `${faces.length} faces (budget ${GEOTOWN_FACES}); trees ${treeFaces} faces as repeats`, want: 'only what the map needs is drawn' }];
  const night = lit.night, bg = night ? air.fog.color : rgbToHex(air.dome.horizon);
  const counts = { plots: d.plots.length, houses: built, hedges, trees: Object.values(items).reduce((a, l) => a + l.length, 0), faces: faces.length, treeFaces };
  return {
    faces, repeats, ...(Object.keys(textures).length ? { textures } : {}), colliders, anchors, cameras,
    viewBox: { width: 1280, height: 720 }, title: ctx.title || `${cube.title} · geotown`,
    bg, haze: { color: air.fog.color, density: r5(air.fog.density * TOWN_HAZE) },
    sky: { zenith: air.dome.zenith, horizon: air.dome.horizon, day: night ? 0 : 1, stars: 0, seed: 1, ...(night ? {} : { sun: { dir: P3(sun), size: 1.4, glow: 1.3 } }), ...(spec.air ? hourSky(spec.air) : {}) },
    walk: m.walk === false ? false : { speed: 6, spawn: P3(eye), minEye: 1.7, gravity: 22, radius: 0.4 },
    route: routeFrom,
    geocube: { ...geocubeReadout(cube, 'geotown', null, m), ...(style ? { style: styleReadout(style) } : {}) },
    geotown: {
      pattern: d.pattern.id, grid: d.spec.grid, frame: d.frame, land: d.land.range, language: L.id ?? anchor,
      blocks: d.blocks.map((b) => { const pads = d.plots.filter((pl) => pl.block === b.id).map((pl) => pl.pad); return { id: b.id, use: b.use, built: b.built, ...(pads.length ? { pads: [Math.min(...pads), Math.max(...pads)] } : {}) }; }),
      counts, ledger: d.ledger, laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
      ...(evoked ? { evoke: { level: d.evoked.level, stands: d.evoked.stands, shows: d.evoked.shows }, yards: Object.fromEntries(d.plots.filter((pl) => pl.yard).map((pl) => [pl.id, pl.yard])) } : {}),
    },
  };
}
