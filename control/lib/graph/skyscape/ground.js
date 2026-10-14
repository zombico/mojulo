/**
 * THE MAP'S GROUND — scapeshift's land, laid at a pilot's scale and carried by the terrain channel.
 *
 * Scapeshift already says how land moves and what it is made of; this lays those documents on a map (map.js) instead
 * of a trail:
 *
 *   relief     a LAND's relief from the surrounds (roads/surrounds.js: rolling hills, ridged mountains, terraced mesas,
 *              a plain), low in the field and rising toward the reach, shaped by the map's form: an island sinks into
 *              its sea past the field, a basin's ring climbs to its wall, a canyon's walls rise along its axis
 *   heartbeat  a scapeshift heartbeat (era/heartbeat.js: a preset or a document) laid on the field at `scale`. Its
 *              places are relative (u across the field, v along it) and are read and checked at their own scale, as
 *              on any level; then every height, depth, width, size and falloff is multiplied by `scale`, so a
 *              heartbeat's 5 m cliff is a 150 m escarpment from the air and the same ground to fly
 *   pads       runways and landing pads: graded ground (the kernel's `grade` layers, as a city sits on a terrain
 *              world), flat to the datum under the wheels whatever the detail around them, painted with their marks
 *   paint      a geocube's key colours as the kernel's ramps (grass the soil, stone the rock, sand the scree)
 *
 * The result is a terrain field (terrain-field.js's shape: the kernel bound to its grids, `pageConfig()` for the page)
 * so the World page meshes it around the camera with the LOD the map planned, and server and page stand on the same
 * ground. Past the grid the kernel's own `outside()` carries the backdrop: the sea round an island, the wall's height
 * round a basin, a plain under the haze.
 *
 *   readGroundAsk(ask), mapGround(map, ask) → field + { pads, report }
 *
 * Pure, deterministic (seeded noise, no clock).
 */
import { readHeartbeat, heartbeatInFrame } from '../era/heartbeat.js';
import { applyEdits, readEdits } from '../era/out-ground.js';
import { readGeocube, geocubeRamps } from '../era/geocube.js';
import { landformGrid, gridX, gridY, hashSeed, gnoise } from '../polygonizer/landform.js';
import { LANDS, SHAPES } from '../roads/surrounds.js';
import { terrainKernel } from '../terrain/terrain-kernel.js';
import * as dmath from '../../util/dmath.js';

/** The painting's width in its own units (terrain-field.js): the kernel's backdrop swell and fall are sized in them. */
const PAINT_WIDTH = 24;
/** A pad's graded grid (m) and its painted marks' grid (m). */
const PAD_CELL = 4, MARK_CELL = 2;
/** Pads: a runway's and a landing pad's default size [length, width] (m) and the ground they blend back over (m). */
export const PAD_KINDS = Object.freeze({
  runway: { size: [900, 30], falloff: 80, label: 'a paved strip to take off from and land on' },
  pad: { size: [60, 60], falloff: 40, label: 'a level square to set down on' },
});
/** The geocube a map is painted with when none is named: a daytime one. */
export const DEFAULT_GEOCUBE = 'island-noon';
const ASPHALT = { stops: [[46, 48, 52], [70, 72, 76], [92, 94, 98], [118, 120, 124]], pos: [0, 1 / 3, 2 / 3, 1], gamma: 1 };
const LIGHT = Object.freeze({ dir: [-0.42, -0.5, 0.757], ambient: 0.42, gain: 0.62 });

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const r2 = (v) => Math.round(v * 100) / 100;
const isUV = (p) => Array.isArray(p) && p.length === 2 && p.every((v) => Number.isFinite(v) && v >= 0 && v <= 1);
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rampOfHex = (hexes) => ({ stops: hexes.map(rgbOf), pos: [0, 1 / 3, 2 / 3, 1], gamma: 1 });
const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');

/** Errors (strings) for a ground ask; [] when it lays. */
export function readGroundAsk(ask = {}) {
  const e = [];
  if (!ask || typeof ask !== 'object') return ['ground must be { land?, heartbeat?, scale?, pads?, geocube?, seed? }'];
  if (ask.land !== undefined && !LANDS[ask.land]) e.push(`ground.land must be one of ${Object.keys(LANDS).join(', ')}`);
  if (ask.scale !== undefined && !(Number.isFinite(ask.scale) && ask.scale >= 1 && ask.scale <= 100)) e.push('ground.scale must be 1–100: the heartbeat\'s metres are multiplied by it (its places stay relative)');
  if (ask.heartbeat !== undefined) { try { readHeartbeat(ask.heartbeat); } catch (err) { e.push(`ground.heartbeat: ${err.message}`); } }
  if (ask.geocube !== undefined) { try { readGeocube(ask.geocube); } catch (err) { e.push(`ground.geocube: ${err.message}`); } }
  if (ask.pads !== undefined) {
    if (!Array.isArray(ask.pads) || ask.pads.length > 4) e.push('ground.pads must be a list of at most 4 { kind?, at: [u, v], along?, size? }');
    else ask.pads.forEach((p, i) => {
      const at = `ground.pads[${i}]`;
      if (!p || typeof p !== 'object') { e.push(`${at} must be an object`); return; }
      if (p.kind !== undefined && !PAD_KINDS[p.kind]) e.push(`${at}.kind must be one of ${Object.keys(PAD_KINDS).join(', ')}`);
      if (!isUV(p.at)) e.push(`${at}.at must be [u, v] in the field, each 0–1 (u across, v along)`);
      if (p.along !== undefined && !['x', 'y'].includes(p.along)) e.push(`${at}.along must be 'x' or 'y' (the axis a runway runs along)`);
      if (p.size !== undefined && !(Array.isArray(p.size) && p.size.length === 2 && p.size.every((v) => Number.isFinite(v) && v >= 10 && v <= 4000))) e.push(`${at}.size must be [length, width] in metres, each 10–4000`);
    });
  }
  return e;
}

/** A path's share of its length it wanders off its line when laid at a pilot's scale, and the pieces it is cut into. */
const MEANDER = Object.freeze({ share: 0.12, pieces: 12, wave: 4.5 });

/**
 * A path laid at a pilot's scale meanders: a walker's straight 50 m cliff is a ruler-straight wall kilometres long from
 * the air, which no land is. Each leg is cut into pieces and its inner points pushed sideways by seeded noise, up to
 * MEANDER.share of the leg's length; the ends stay where the heartbeat put them.
 */
function meander(path, seed) {
  const out = [path[0]];
  for (let k = 1; k < path.length; k++) {
    const [ax, ay] = path[k - 1], [bx, by] = path[k], L = dmath.hypot(bx - ax, by - ay); if (L < 1e-6) continue;
    const nx = -(by - ay) / L, ny = (bx - ax) / L, n = MEANDER.pieces;
    for (let i = 1; i <= n; i++) {
      const t = i / n, off = i === n ? 0 : MEANDER.share * L * gnoise(t * MEANDER.wave, k * 7.1, seed) * smooth(0, 0.2, Math.min(t, 1 - t));
      out.push([ax + (bx - ax) * t + nx * off, ay + (by - ay) * t + ny * off]);
    }
  }
  return out;
}

/** The heartbeat in the field's frame (centred on the origin), its metres multiplied by `scale`, its paths meandering.
 *  → edits */
function aerialMarks(heartbeat, field, scale, seed) {
  const h = readHeartbeat(heartbeat);
  // read at the heartbeat's own scale, so every default (a cliff's face and reach, a gorge's width and wall) is filled
  // in and checked as on any level, before the metres are scaled
  const edits = readEdits(heartbeatInFrame(h, { x0: -field.hx, x1: field.hx, length: 2 * field.hy }).edits, 'ground.heartbeat');
  const dy = -field.hy, k = scale;
  return edits.map((e, i) => {
    const o = { ...e };
    if (o.at) o.at = [o.at[0], o.at[1] + dy];
    if (o.path) o.path = meander(o.path.map(([x, y]) => [x, y + dy]), seed + 13 * (i + 1));
    if (o.points) o.points = o.points.map(([y, z]) => [y + dy, z * k]);
    for (const key of ['height', 'depth', 'width', 'falloff', 'reach']) if (Number.isFinite(o[key])) o[key] *= k;
    if (o.size) o.size = o.size.map((v) => v * k);
    if (Number.isFinite(o.to)) o.to *= k;
    return o;
  });
}

/** An island stands this far (m) above its sea where it is land, so the gentle ground never pools into ponds. */
const FREEBOARD = 12;

/**
 * The form's shape over the relief at (x, y): `lift`, the 0…1 share of the land's height that stands; `add`, metres
 * added (a basin's or canyon's wall, an island's sea floor and freeboard); `rim`, 0…1 toward the reach (where a
 * basin's, a canyon's or a plain's land takes its far height). An island's coast is a rounded box round the field,
 * wobbled by noise at two scales, so it is a shore and not the field's square.
 */
function formAt(map, x, y, seed) {
  const { rings, backdrop: B } = map, F = rings.field, R = rings.reach;
  const ex = Math.max(Math.abs(x) - F.hx, 0) / (R.hx - F.hx), ey = Math.max(Math.abs(y) - F.hy, 0) / (R.hy - F.hy);
  const out = Math.max(ex, ey);   // 0 in the field, 1 at the reach's edge
  if (map.form === 'island') {
    const ux = Math.abs(x) / F.hx, uy = Math.abs(y) / F.hy, q0 = dmath.pow(ux ** 4 + uy ** 4, 0.25);
    const q = q0 + 0.14 * gnoise(x / (F.hx * 0.45), y / (F.hy * 0.45), seed + 5) + 0.05 * gnoise(x / (F.hx * 0.12), y / (F.hy * 0.12), seed + 6);
    const k = 0.5 * (R.hx - F.hx) / F.hx, land = 1 - smooth(1.02, 1.02 + k, q);   // the shore a little past the field
    return { lift: land, add: FREEBOARD * land + B.base * smooth(1.02, 1.02 + 2 * k, q), rim: 0 };
  }
  if (map.form === 'basin') return { lift: 1, add: B.wall * smooth(0.35, 1.3, out), rim: smooth(0.25, 1, out) };
  if (map.form === 'canyon') { const across = B.axis === 'x' ? ey : ex; return { lift: 1, add: B.wall * smooth(0.1, 0.8, across), rim: smooth(0.25, 1, out) }; }
  return { lift: 1, add: 0, rim: smooth(0.25, 1, out) };
}

/** The pads asked for, in metres: { id, kind, length, width, falloff, center, along (null: either axis, sited) }. */
function placePads(map, pads) {
  const F = map.rings.field;
  return pads.map((p, i) => {
    const K = PAD_KINDS[p.kind ?? 'runway'], [L, W] = p.size ?? K.size;
    return { id: p.id ?? `${p.kind ?? 'runway'}-${i + 1}`, kind: p.kind ?? 'runway', along: p.along ?? null, length: L, width: W, falloff: K.falloff, center: [-F.hx + p.at[0] * 2 * F.hx, -F.hy + p.at[1] * 2 * F.hy] };
  });
}
/** A pad's half-extents along x and y, laid along an axis. */
const halfOf = (p, along) => (along === 'x' ? [p.length / 2, p.width / 2] : [p.width / 2, p.length / 2]);

/** A runway's marks on a MARK_CELL grid (premultiplied rgba): threshold bars at both ends, a dashed centre line, edge
 *  lines. Drawn a cell wide or more, bolder than a real runway's (0.9 m lines): under the eye spot a mark never reads. */
function runwayPaint(p) {
  const along = p.along, L = p.length, W = p.width, nx = Math.round((p.x1 - p.x0) / MARK_CELL) + 1, ny = Math.round((p.y1 - p.y0) / MARK_CELL) + 1;
  const pc = new Uint8Array(nx * ny * 4);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s = along === 'x' ? i * MARK_CELL : j * MARK_CELL, t = along === 'x' ? j * MARK_CELL - W / 2 : i * MARK_CELL - W / 2;
    const edge = Math.abs(t) > W / 2 - MARK_CELL;
    const threshold = (s < 30 || s > L - 30) && s > 6 && s < L - 6 && Math.abs(t) < W / 2 - 2 * MARK_CELL && Math.floor((t + W / 2) / MARK_CELL) % 2 === 0;
    const centre = Math.abs(t) <= MARK_CELL / 2 && s > 40 && s < L - 40 && Math.floor(s / 15) % 2 === 0;
    if (edge || threshold || centre) { const k = (j * nx + i) * 4; pc[k] = pc[k + 1] = pc[k + 2] = 235; pc[k + 3] = 255; }
  }
  return { x0: p.x0, y0: p.y0, dx: MARK_CELL, nx, ny, pc };
}

/** How far (m) a pad may be moved from where it was asked for, as a share of the field's smaller half-side. */
const SITE_REACH = 0.35, SITE_STEP = 50, SAMPLE = 20;
/** A departure: the steepest the ground ahead of a runway's end may rise (its obstacle gradient, as an airport's
 *  clearance surface: a light craft climbs at ~10%, so half that leaves room), how far ahead it is read (m), and from
 *  how far past the end (the climb-out begins there). A pad's departure is the end whose ground ahead rises least. */
export const DEPARTURE = Object.freeze({ gradient: 0.05, run: 3000, from: 150 });

/** The pad at (cx, cy): its datum (the ground's mean, above the sea) and its earthwork (m), or null if it cannot stand. */
function padAt(p, cx, cy, along, { nat, sea, field, taken }) {
  const [hx, hy] = halfOf(p, along), m = p.falloff;
  if (Math.abs(cx) + hx > field.hx || Math.abs(cy) + hy > field.hy) return null;
  if (taken.some((t) => cx - hx - m < t.x1 + t.falloff && cx + hx + m > t.x0 - t.falloff && cy - hy - m < t.y1 + t.falloff && cy + hy + m > t.y0 - t.falloff)) return null;
  const zs = [];
  for (let y = cy - hy; y <= cy + hy + 1e-6; y += Math.min(SAMPLE, 2 * hy)) for (let x = cx - hx; x <= cx + hx + 1e-6; x += Math.min(SAMPLE, 2 * hx)) zs.push(nat(x, y));
  const mean = zs.reduce((a, v) => a + v, 0) / zs.length;
  if (sea !== null && Math.min(...zs) < sea + 1) return null;   // a pad stands on land
  const datum = mean, earthwork = Math.max(...zs.map((z) => Math.abs(z - datum)));
  // the departure: for each end, the steepest rise of the ground ahead of it over its distance from the end
  const ax = along === 'x' ? [1, 0] : [0, 1], half = p.length / 2;
  const ahead = (dir) => { let g = -Infinity; for (let s = DEPARTURE.from; s <= DEPARTURE.run; s += 50) { const x = cx + ax[0] * dir * (half + s), y = cy + ax[1] * dir * (half + s); g = Math.max(g, (nat(x, y) - datum) / s); } return g; };
  const up = ahead(1), down = ahead(-1), depart = up <= down ? 1 : -1;
  return { datum, earthwork, depart, gradient: Math.min(up, down) };
}

/** A pad sited: searched outward from where it was asked for, in SITE_STEP rings, the least earthwork winning (the
 *  nearer on a tie). → the pad moved there, with `datum`, `earthwork` and `moved` (m). */
function sitePad(p, ctx) {
  const ax = p.center[0], ay = p.center[1], R = SITE_REACH * Math.min(ctx.field.hx, ctx.field.hy);
  const axes = p.along ? [p.along] : ['y', 'x'];
  let best = null;
  for (const along of axes) for (let dy = -R; dy <= R + 1e-6; dy += SITE_STEP) for (let dx = -R; dx <= R + 1e-6; dx += SITE_STEP) {
    const d = dmath.hypot(dx, dy); if (d > R + 1e-6) continue;
    const at = padAt(p, ax + dx, ay + dy, along, ctx); if (!at) continue;
    // a blocked departure costs far more than earthwork: a runway that cannot be flown out of is no runway
    const score = at.earthwork + 0.002 * d + (p.kind === 'runway' ? 2000 * Math.max(0, at.gradient - DEPARTURE.gradient) : 0);
    if (!best || score < best.score - 1e-9) best = { score, cx: ax + dx, cy: ay + dy, d, along, ...at };
  }
  if (!best) { const along = axes[0], at = padAt(p, ax, ay, along, { ...ctx, taken: [], sea: null }) ?? { datum: 0, earthwork: Infinity, depart: 1, gradient: Infinity }; best = { cx: ax, cy: ay, d: 0, along, ...at }; }
  const [hx, hy] = halfOf(p, best.along);
  return { ...p, along: best.along, x0: r2(best.cx - hx), x1: r2(best.cx + hx), y0: r2(best.cy - hy), y1: r2(best.cy + hy), center: [r2(best.cx), r2(best.cy)],
    datum: r2(ctx.sea === null ? best.datum : Math.max(ctx.sea + 2, best.datum)), earthwork: r2(best.earthwork), moved: r2(best.d),
    ...(p.kind === 'runway' ? { depart: best.depart, gradient: r2(best.gradient) } : {}) };
}

/** A pad's graded layer: its datum flat inside, blending into the natural ground over its falloff. */
function padLayer(p, datum) {
  const m = p.falloff, x0 = p.x0 - m, y0 = p.y0 - m, nx = Math.ceil((p.x1 - p.x0 + 2 * m) / PAD_CELL) + 1, ny = Math.ceil((p.y1 - p.y0 + 2 * m) / PAD_CELL) + 1, N = nx * ny;
  const dq = new Uint16Array(N), w = new Uint8Array(N);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = x0 + i * PAD_CELL, Y = y0 + j * PAD_CELL;
    const d = Math.max(p.x0 - X, X - p.x1, p.y0 - Y, Y - p.y1, 0);   // metres outside the pad
    w[j * nx + i] = Math.round(255 * (1 - smooth(0, m, d)));
  }
  return { x0, y0, dx: PAD_CELL, nx, ny, dMin: datum, dStep: 1e-9, dq, w, ramp: ASPHALT, ...(p.kind === 'runway' ? { paint: runwayPaint(p) } : {}) };
}

/**
 * The map's ground. `ask`: { land?, heartbeat?, scale?, pads?, geocube?, seed? }. → a terrain field (K, kernel, heightAt,
 * groundAt, normalAt, colorAt, bounds, meta, pageConfig) plus `pads` (each with its datum) and a `report`.
 */
export function mapGround(map, ask = {}) {
  const errs = readGroundAsk(ask); if (errs.length) throw new Error(`ground: ${errs.join('; ')}`);
  const land = LANDS[ask.land ?? (map.form === 'basin' ? 'mountains' : map.form === 'canyon' ? 'mesas' : 'hills')];
  const seed = hashSeed(ask.seed ?? map.seed ?? 'skyscape') % 100003;
  const scale = ask.scale ?? Math.min(50, Math.max(5, Math.round(map.ceiling / 100)));
  const G = map.grid, F = map.rings.field;
  // the relief, in metres on a grid over the reach (and a basin's or canyon's wall band)
  const g = landformGrid({ x0: -G.hx, x1: G.hx, y0: -G.hy, y1: G.hy, res: G.ny });
  const shape = SHAPES[land.shape], wave = land.wave * Math.max(1, F.hx / 2000);
  // the land's height: its near height, rising to its far height where a slow mask says this is high country (so a
  // field has hills to fly round and flats to land on) and toward the reach where the form rings it
  const relief = (x, y) => {
    const f = formAt(map, x, y, seed);
    const high = smooth(0.42, 0.78, 0.5 + 0.9 * gnoise(x / (wave * 3), y / (wave * 3), seed + 9));
    const h = land.near + (land.far - land.near) * Math.max(high, f.rim);
    return h * f.lift * shape(x / wave, y / wave, seed, land) + f.add;
  };
  for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) g.z[j * g.nx + i] = relief(gridX(g, i), gridY(g, j));
  const centre = relief(0, 0);
  const edits = ask.heartbeat !== undefined ? aerialMarks(ask.heartbeat, F, scale, seed) : [];
  if (edits.length) applyEdits(g, edits, { gridX, gridY, walkAt: () => centre });
  // the kernel's frame: painting units, s metres each, so its backdrop swell (~30 units) is the map's own scale
  const s = (2 * G.hx) / PAINT_WIDTH, zs = s, N = g.nx * g.ny;
  let lo = Infinity, hi = -Infinity; for (let k = 0; k < N; k++) { if (g.z[k] < lo) lo = g.z[k]; if (g.z[k] > hi) hi = g.z[k]; }
  const hStep = (hi - lo) / zs / 65535 || 1e-9, hq = new Uint16Array(N), hard = new Uint8Array(N), apron = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    hq[k] = Math.round((g.z[k] - lo) / zs / hStep);
    hard[k] = Math.round(255 * clamp01(land.rocks * (0.3 + 0.7 * clamp01((g.z[k] - lo) / ((hi - lo) || 1)))));
  }
  const B = map.backdrop, sea = B.sea ? 0 : null;
  const cellM = g.dx, L0 = 4 * cellM, octaves = []; for (let L = L0; L >= 0.5 && octaves.length < 16; L /= 2) octaves.push([L, dmath.pow(L / L0, 0.8)]);
  const cube = readGeocube(ask.geocube ?? DEFAULT_GEOCUBE), R4 = geocubeRamps(cube, 4);
  const K = {
    nx: g.nx, ny: g.ny, x0: g.x0 / s, y0: g.y0 / s, dx: g.dx / s, hq, hMin: lo / zs, hStep, hard, apron, apronStep: 1,
    s, zs, yc: 0, rect: [g.x0 / s, (g.x0 + (g.nx - 1) * g.dx) / s, g.y0 / s, (g.y0 + (g.ny - 1) * g.dx) / s],
    // past the grid the kernel eases the edge to `base`: the sea floor round an island, a basin's wall, else the plain
    horizon: { mode: B.sea ? 'sea' : 'plain', fall: B.fall / s, amp: B.amp / zs, base: (map.form === 'basin' ? B.wall : B.base) / zs },
    sea: sea === null ? null : sea / zs, beds: null,
    detail: { octaves, norm: octaves.reduce((a, o) => a + o[1], 0) || 1, rock: 0.06 * L0, soil: 0.012 * L0, seed },
    light: LIGHT.dir, lambert: { ambient: LIGHT.ambient, gain: LIGHT.gain },
    ramps: { soil: rampOfHex(R4.grass), stone: rampOfHex(R4.stone), scree: rampOfHex(R4.sand ?? R4.floor), beds: [rampOfHex(R4.stone)] },
  };
  // the pads: each sited near where it was asked for, where it needs the least earthwork (the most the natural ground
  // stands off its datum over the footprint), dry, inside the field and clear of the pads before it; graded flat
  const natural = terrainKernel(K), nat = (x, y) => natural.macroZ(x / s, y / s) * zs;
  const taken = [];
  const pads = placePads(map, ask.pads ?? []).map((p) => {
    const site = sitePad(p, { nat, sea, field: F, taken });
    taken.push(site);
    return site;
  });
  if (pads.length) K.grade = pads.map((p) => padLayer(p, p.datum));
  const kernel = pads.length ? terrainKernel(K) : natural;
  const sky = { zenith: [96, 146, 206], horizon: [196, 214, 226], day: 1 };
  return {
    K, kernel, heightAt: kernel.heightAt, groundAt: kernel.groundAt, normalAt: kernel.normalAt, colorAt: kernel.colorAt,
    bounds: { x: [g.x0, g.x0 + (g.nx - 1) * g.dx], y: [g.y0, g.y0 + (g.ny - 1) * g.dx], z: [lo, hi], cell: cellM },
    meta: { span: 2 * G.hx, relief: 1, horizon: K.horizon.mode, sea, planet: null, sky, rock: null, octaves: octaves.length, scree: [] },
    pads,
    report: { land: Object.keys(LANDS).find((k) => LANDS[k] === land), geocube: cube.id, scale, marks: edits.length, relief: [r2(lo), r2(hi)], grid: [g.nx, g.ny], cell: r2(cellM), pads: pads.map((p) => ({ id: p.id, datum: p.datum, earthwork: p.earthwork, moved: p.moved, ...(p.depart ? { depart: p.depart, gradient: p.gradient } : {}) })) },
    pageConfig() {
      const { hq: q, hard: h, apron: a, grade, ...rest } = K;
      return { ...rest, grids: { hq: b64(q), hard: b64(h), apron: b64(a) }, ...(grade ? { grade: grade.map((L) => ({ ...L, dq: b64(L.dq), w: b64(L.w), ...(L.paint ? { paint: { ...L.paint, pc: b64(L.paint.pc) } } : {}) })) } : {}) };
    },
  };
}
