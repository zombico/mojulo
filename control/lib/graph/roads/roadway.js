/**
 * roadway — a divided freeway at TRUE SCALE, in metres (1 u = 1 m, z-up), built from an alignment
 * (alignment.js) and a CROSS-SECTION TEMPLATE: an ordered list of bands laid out from the median
 * outward, the same for each direction of travel. The default template is Highway 401's
 * collector–express section by Pearson: per direction, a median Tall Wall, the express roadway
 * (left shoulder, lanes, right shoulder), a separation Tall Wall, the collector roadway.
 *
 * What it emits:
 *   - faces: pavement, markings (3 m / 6 m broken lines, solid edge lines, yellow on the left),
 *     Tall Wall barriers, median luminaires, verge and terrain — lit, textured where it pays;
 *   - the AFFORDANCE CONTRACT the driving phases read (`roadway` on the payload): a lane graph of
 *     stationed 3D centrelines with width, speed, surface and the line type to each neighbour;
 *   - the census inputs: the band-edge vertices each face was built from, and every dash's ends,
 *     so `roadwayCensus` measures the geometry that was drawn, not the params that asked for it.
 *
 * Cross-slope: each direction's pavement is one plane per station, pivoting on the median. On a
 * tangent it drains outward at the normal crown (2 %); on a curve it banks toward the inside at the
 * alignment's superelevation, passing through level as a reverse crown is removed.
 * Deterministic: the only dice are mulberry32 from `seed`.
 */

import { buildAlignment, curve } from './alignment.js';
import { face, faceOut, texFace, boxFaces } from './road-faces.js';
import { overpass, gantry, measureClearance } from './structures.js';
import { FLEET, FLEET_MIX, PAINTS, TRAILER_PAINTS, buildVehicle, vehicleBounds } from './fleet.js';
import { assembleTrackScene, TRACK_FORMS } from './track.js';

export const ROADWAY_METERS_PER_UNIT = 1;
export const NORMAL_CROWN = 0.02;

// Ontario freeway numbers (see the plan's reference sheet): lane 3.75 m, shoulders 2.5 / 3.0 m,
// Tall Wall ~1.07 m high, broken lane line 3 m line / 6 m gap, lines 0.10 m, edge lines 0.15 m.
export const ROADWAY_DEFAULTS = {
  laneW: 3.75, express: 4, collector: 5,
  shoulderLeft: 2.5, shoulderRight: 3.0, shoulderExpressRight: 2.5,
  barrier: { base: 0.8, top: 0.3, height: 1.07 },
  dash: 3, gap: 6, lineW: 0.10, edgeW: 0.15,
  speedKmh: 100, designSpeed: 120,
  lightSpacing: 60, lightHeight: 13.5, lightArm: 2.6,
};

const COLOR = {
  asphalt: '#c4c6c8', shoulder: '#b3b4b4', concrete: '#cdc9bf', white: '#eceae3', yellow: '#dcb431',
  // grass textures are full-colour, so their fill is a near-white light carrier (late-September verge)
  gravel: '#8d877c', grass: '#e9e6d6', terrain: '#e2dfcf', far: '#d6d3c2', pole: '#9ea3a6', lamp: '#5f6468',
};
const TILE = 2.5;         // asphalt tile (m): ~2 cm a texel, fine-grained at a driver's eye
const GRASS_TILE = 4;
const BASE_Z = -3;        // terrain base, under every roadway edge at full superelevation

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** The corridor's default structures: a guide-sign gantry each way near the start, an overpass on
 *  the long tangent past the crest. */
const DEFAULT_STRUCTURES = (L) => [
  { kind: 'gantry', s: 640, D: 1 }, { kind: 'gantry', s: Math.min(L - 300, 2900), D: -1 },
  { kind: 'overpass', s: Math.min(L - 400, 2200) },
];

const clampNum = (v, lo, hi, dflt) => (Number.isFinite(+v) ? Math.max(lo, Math.min(hi, +v)) : dflt);

/**
 * The per-direction band list, median outward. Each band: { kind, w, roadway?, lane? }.
 * kinds: 'barrier' (a Tall Wall's footprint), 'shoulder', 'lane'.
 */
export function crossSection(o = {}) {
  const d = { ...ROADWAY_DEFAULTS, ...o };
  const bands = [{ kind: 'barrier', w: d.barrier.base / 2, wall: 'median' }];
  const roadway = (name, n, sl, sr) => {
    bands.push({ kind: 'shoulder', w: sl, roadway: name, side: 'left' });
    for (let i = 0; i < n; i++) bands.push({ kind: 'lane', w: d.laneW, roadway: name, lane: i });
    bands.push({ kind: 'shoulder', w: sr, roadway: name, side: 'right' });
  };
  if (d.express > 0) {
    roadway('express', d.express, d.shoulderLeft, d.shoulderExpressRight);
    bands.push({ kind: 'barrier', w: d.barrier.base, wall: 'separation' });
  }
  roadway('collector', d.collector, d.shoulderLeft, d.shoulderRight);
  let acc = 0;
  for (const b of bands) { b.d0 = acc; acc += b.w; b.d1 = acc; }
  return { bands, width: acc };
}

/** The corridor's default alignment: 800 m tangent, an R 1500 left curve, a long tangent; a crest
 *  and a sag, grades ≤ 1.5 %. `curveR` / `length` dial it. */
export function corridorSpec({ length = 3600, curveR = 1500, deflectionDeg = 25 } = {}) {
  const c = curve({ radius: curveR, deflection: deflectionDeg * Math.PI / 180, dir: 'left' });
  const used = 800 + c.reduce((a, e) => a + e.length, 0);
  const k = length / 3600;
  return {
    start: [0, 0], heading: 0,
    elements: [{ type: 'tangent', length: 800 }, ...c, { type: 'tangent', length: Math.max(200, length - used) }],
    // the sag, crest and fall keep their grades at any length (the 3.6 km default is exact: k = 1)
    profile: { z0: 0, pvis: [{ s: 1100 * k, z: 0 }, { s: 1900 * k, z: 12 * k }, { s: 2700 * k, z: 4 * k }] },
  };
}

// ── geometry helpers ─────────────────────────────────────────────────────────────────────────────
/** Outward cross-slope (rise per metre moving AWAY from the median) for travel direction D. */
function slopeOut(st, D) {
  const kD = st.k * D;                     // + ⇒ the curve turns toward the driver's left
  if (kD > 0) return st.e >= NORMAL_CROWN ? st.e : -NORMAL_CROWN + 2 * st.e;   // outside edge rises
  return -Math.max(NORMAL_CROWN, st.e);                                        // inside edge is the outer one
}
/**
 * The frame of a cross-section: `P(st, D, d, dz)` → the world point `d` metres out from the median on
 * direction D's side, `dz` above the pavement. Each ROADWAY (express, collector) is its own plane,
 * pivoting on its inner edge at the profile grade — as built: a 45 m slab drained as one plane
 * would drop 0.9 m at the normal crown. A separation wall's footprint spans the step between the
 * express's outer edge and the collector's pivot; past the paved edge the outer edge's z holds.
 */
export function makeFrame(section) {
  const rws = {};
  for (const b of section.bands) if (b.roadway) {
    const r = rws[b.roadway] || (rws[b.roadway] = { d0: b.d0, d1: b.d1 });
    r.d0 = Math.min(r.d0, b.d0); r.d1 = Math.max(r.d1, b.d1);
  }
  const list = Object.values(rws).sort((a, b) => a.d0 - b.d0);
  const rise = (sl, d) => {
    for (const r of list) if (d >= r.d0 - 1e-9 && d <= r.d1 + 1e-9) return sl * (d - r.d0);
    for (let i = 0; i < list.length - 1; i++) if (d > list[i].d1 && d < list[i + 1].d0) {   // a separation wall's footprint
      const t = (d - list[i].d1) / (list[i + 1].d0 - list[i].d1);
      return (1 - t) * sl * (list[i].d1 - list[i].d0);
    }
    if (d < list[0].d0) return 0;                                                            // the median wall
    const last = list[list.length - 1];
    return sl * (last.d1 - last.d0);                                                          // past the paved edge
  };
  const P = (st, D, d, dz = 0) => {
    const off = D === 1 ? -d : d;            // left-positive offset; D=+1 travels +s on the right
    const nx = -Math.sin(st.heading), ny = Math.cos(st.heading);
    return [st.x + nx * off, st.y + ny * off, st.z + rise(slopeOut(st, D), d) + dz];
  };
  return { P, roadways: rws };
}
// ── the plan ─────────────────────────────────────────────────────────────────────────────────────
/**
 * planRoadway(manifest) → { alignment, section, faces, lanes, sections, dashes, structures, cameras, … }
 * Manifest dials (all clamped to design bands; out-of-band values are clamped and reported in
 * `advisories`, never refused): express, collector, laneW, length, curveR, seed.
 */
export function planRoadway(m = {}) {
  const advisories = [];
  const dial = (key, lo, hi, dflt) => {
    const v = clampNum(m[key], lo, hi, dflt);
    if (m[key] != null && +m[key] !== v) advisories.push(`${key} ${m[key]} is outside ${lo}–${hi}; used ${v}`);
    return v;
  };
  const opts = {
    express: Math.round(dial('express', 0, 6, ROADWAY_DEFAULTS.express)),
    collector: Math.round(dial('collector', 1, 6, ROADWAY_DEFAULTS.collector)),
    laneW: dial('laneW', 3.0, 4.0, ROADWAY_DEFAULTS.laneW),
  };
  const length = dial('length', 1200, 8000, 3600);
  const curveR = dial('curveR', 750, 5000, 1500);
  if (opts.laneW < 3.5) advisories.push(`laneW ${opts.laneW} m is under the 3.5 m freeway floor`);
  const seed = Number.isFinite(+m.seed) ? +m.seed : 1;
  const rng = mulberry32(seed * 2654435761);
  const D0 = { ...ROADWAY_DEFAULTS, ...opts };

  const alignment = buildAlignment({ ...corridorSpec({ length, curveR }), designSpeed: D0.designSpeed });
  const section = crossSection(D0);
  const { P } = makeFrame(section);
  const st = alignment.stations({ fine: 5, coarse: 20 });
  const faces = [], dashes = [], sections = [], dashPhase = {};
  const paved = section.width;

  // band-edge vertices per station, per direction (the census reads these back)
  for (const s of st) {
    const row = { s: s.s };
    for (const D of [1, -1]) {
      const sl = slopeOut(s, D);
      row[D] = { slope: sl, edges: [0, ...section.bands.map((b) => b.d1)].map((d) => P(s, D, d)) };
    }
    sections.push(row);
  }

  const bandHex = (b) => (b.kind === 'shoulder' ? COLOR.shoulder : b.kind === 'lane' ? COLOR.asphalt : COLOR.concrete);
  for (const D of [1, -1]) {
    // pavement: one strip per run of same-kind bands (the lanes of a roadway are one textured strip)
    const runs = [];
    for (const b of section.bands) {
      const last = runs[runs.length - 1];
      if (last && last.kind === b.kind && b.kind === 'lane' && last.roadway === b.roadway) last.d1 = b.d1;
      else runs.push({ kind: b.kind, roadway: b.roadway, d0: b.d0, d1: b.d1 });
    }
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      for (const r of runs) {
        const c = [P(a, D, r.d0), P(a, D, r.d1), P(b, D, r.d1), P(b, D, r.d0)];
        if (r.kind === 'barrier') { faces.push(face(c, COLOR.concrete)); continue; }
        const uv = [[a.s / TILE, r.d0 / TILE], [a.s / TILE, r.d1 / TILE], [b.s / TILE, r.d1 / TILE], [b.s / TILE, r.d0 / TILE]];
        faces.push(texFace(c, r.kind === 'lane' ? COLOR.asphalt : COLOR.shoulder, 'asphalt-aged', uv));
      }
    }
    // verge → ditch → backslope → flat grass to the ROW, then terrain easing to the base level
    const verge = [[0.6, -0.04, COLOR.gravel], [3.0, -0.75, COLOR.grass], [2.0, 0, COLOR.grass], [2.25, 0.6, COLOR.grass], [22, 0, COLOR.grass]];
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      const edge = (s) => P(s, D, paved);
      let pa = edge(a), pb = edge(b), dcur = paved;
      const out = (s, p, dd, dz) => { const q = P(s, D, dcur + dd); return [q[0], q[1], p[2] + dz]; };
      for (const [dw, dz, hex] of verge) {
        const na = out(a, pa, dw, dz), nb = out(b, pb, dw, dz);
        const c = [pa, na, nb, pb];
        if (hex === COLOR.gravel) faces.push(face(c, hex));
        else faces.push(texFace(c, hex, 'grass-dry', c.map((p) => [p[0] / GRASS_TILE, p[1] / GRASS_TILE])));
        pa = na; pb = nb; dcur += dw;
      }
      // terrain out to 600 m from the median, easing to the base level under every roadway edge
      const far = 600;
      const na = out(a, [0, 0, BASE_Z], far - dcur, 0), nb = out(b, [0, 0, BASE_Z], far - dcur, 0);
      const c = [pa, na, nb, pb];
      faces.push(texFace(c, COLOR.terrain, 'grass-dry', c.map((p) => [p[0] / GRASS_TILE, p[1] / GRASS_TILE])));
    }
    // markings: per roadway, a yellow left edge line, broken white lane lines, a white right edge line
    for (const rw of ['express', 'collector']) {
      const lanes = section.bands.filter((b) => b.kind === 'lane' && b.roadway === rw);
      if (!lanes.length) continue;
      const lines = [
        { d: lanes[0].d0, w: D0.edgeW, hex: COLOR.yellow, solid: true },
        ...lanes.slice(1).map((l) => ({ d: l.d0, w: D0.lineW, hex: COLOR.white, solid: false })),
        { d: lanes[lanes.length - 1].d1, w: D0.edgeW, hex: COLOR.white, solid: true },
      ];
      const phase = rng() * (D0.dash + D0.gap);
      dashPhase[`${D}:${rw}`] = phase;
      for (const ln of lines) {
        const lift = 0.012;
        if (ln.solid) {
          for (let i = 0; i < st.length - 1; i++) {
            const a = st[i], b = st[i + 1];
            faces.push(face([P(a, D, ln.d - ln.w / 2, lift), P(a, D, ln.d + ln.w / 2, lift), P(b, D, ln.d + ln.w / 2, lift), P(b, D, ln.d - ln.w / 2, lift)], ln.hex));
          }
          continue;
        }
        // step in distance ALONG THE LINE: at left-positive offset o, a line runs (1 − k·o) m per
        // centreline metre, so a 3 m dash on a curve's outer line spans a little less centreline
        const o = D === 1 ? -ln.d : ln.d;
        const along = (s, L) => L / (1 - alignment.at(s).k * o);
        for (let s0 = phase; s0 + along(s0, D0.dash) <= alignment.length; s0 += along(s0, D0.dash + D0.gap)) {
          const a = alignment.at(s0), b = alignment.at(s0 + along(s0, D0.dash));
          const c = [P(a, D, ln.d - ln.w / 2, lift), P(a, D, ln.d + ln.w / 2, lift), P(b, D, ln.d + ln.w / 2, lift), P(b, D, ln.d - ln.w / 2, lift)];
          faces.push(face(c, ln.hex));
          dashes.push({ D, roadway: rw, d: ln.d, s0, a: P(a, D, ln.d, lift), b: P(b, D, ln.d, lift) });
        }
      }
    }
  }

  // Tall Walls: the median (shared by both directions, centred on d = 0) and each separation
  const walls = [{ key: 'median', D: 1, dc: 0 }];
  const sep = section.bands.find((b) => b.wall === 'separation');
  if (sep) for (const D of [1, -1]) walls.push({ key: 'separation', D, dc: (sep.d0 + sep.d1) / 2 });
  const { base, top, height } = D0.barrier;
  for (const w of walls) {
    for (let i = 0; i < st.length - 1; i++) {
      const a = st[i], b = st[i + 1];
      // median: each foot sits on its own direction's plane (both are the centreline z at d = 0.4)
      const foot = (s, side) => (w.key === 'median'
        ? P(s, side < 0 ? 1 : -1, base / 2)
        : P(s, w.D, w.dc + side * base / 2));
      const head = (s, side) => {
        const f0 = foot(s, -1), f1 = foot(s, 1), zc = (f0[2] + f1[2]) / 2 + height, t = 0.5 + side * (top / base) / 2;
        return [f0[0] + (f1[0] - f0[0]) * t, f0[1] + (f1[1] - f0[1]) * t, zc];
      };
      const f0 = foot(a, -1), f1 = foot(a, 1), mid = [(f0[0] + f1[0]) / 2, (f0[1] + f1[1]) / 2];
      faces.push(faceOut([foot(a, -1), foot(b, -1), head(b, -1), head(a, -1)], COLOR.concrete, mid));
      faces.push(faceOut([foot(b, 1), foot(a, 1), head(a, 1), head(b, 1)], COLOR.concrete, mid));
      faces.push(face([head(a, -1), head(b, -1), head(b, 1), head(a, 1)], COLOR.concrete));
    }
  }
  // structures over the roadway (R3): each sized from its clearance target, each measured back
  const ctx = { alignment, section, P, paved };
  const specs = Array.isArray(m.structures) ? m.structures : DEFAULT_STRUCTURES(alignment.length);
  const structures = [], keepOut = [];
  specs.forEach((sp, i) => {
    const s = clampNum(sp.s, 150, alignment.length - 150, alignment.length / 2);
    const clearance = sp.clearance != null ? clampNum(sp.clearance, 4.0, 8.0, 5.15) : undefined;
    if (clearance != null && clearance < 5.0) advisories.push(`structure ${i} clearance ${clearance} m is under the MTO 5.0 m minimum over a freeway`);
    const built = sp.kind === 'gantry'
      ? gantry(ctx, { id: sp.id || `gantry-${i + 1}`, s, D: sp.D === -1 ? -1 : 1, ...(clearance != null ? { clearance } : {}) })
      : overpass(ctx, { id: sp.id || `overpass-${i + 1}`, s, ...(clearance != null ? { clearance } : {}) });
    faces.push(...built.faces);
    structures.push({ ...built.structure, ...measureClearance(ctx, built.structure) });
    keepOut.push([built.structure.footprint.s0 - 6, built.structure.footprint.s1 + 6]);
  });
  // median luminaires: twin davit arms on the median wall, every `lightSpacing` m (none under a deck)
  const lights = [];
  for (let s = D0.lightSpacing / 2; s < alignment.length; s += D0.lightSpacing) {
    if (keepOut.some(([a, b]) => s >= a && s <= b)) continue;
    lights.push(s);
    const a = alignment.at(s), base0 = [a.x, a.y, a.z + height];
    faces.push(...boxFaces(base0, [0.26, 0.26, D0.lightHeight - height], a.heading, COLOR.pole));
    for (const side of [1, -1]) {
      const nx = -Math.sin(a.heading) * side, ny = Math.cos(a.heading) * side;
      const armC = [a.x + nx * D0.lightArm / 2, a.y + ny * D0.lightArm / 2, a.z + D0.lightHeight - 0.12];
      faces.push(...boxFaces(armC, [0.1, D0.lightArm, 0.1], a.heading, COLOR.pole));
      const headC = [a.x + nx * (D0.lightArm + 0.3), a.y + ny * (D0.lightArm + 0.3), a.z + D0.lightHeight - 0.3];
      faces.push(...boxFaces(headC, [0.32, 0.7, 0.18], a.heading, COLOR.lamp));
    }
  }
  // roadside context beyond the ROW, for scale: the Pearson corridor's logistics warehouses
  // (9–14 m, 60–220 m long) and the odd airport hotel or office block (25–45 m)
  const context = [];
  if (m.context !== false) {
    const vergeW = 29.85, farD = 600;
    for (const D of [1, -1]) {
      for (let s = 60; s < alignment.length - 60;) {
        const hotel = rng() < 0.12;
        const len = hotel ? 30 + rng() * 30 : 60 + rng() * 160, dep = hotel ? 18 + rng() * 10 : 40 + rng() * 60;
        const setback = 35 + rng() * 90, h = hotel ? 25 + rng() * 20 : 9 + rng() * 5;
        if (rng() < 0.7) {
          const a = alignment.at(s + len / 2), dNear = paved + vergeW + setback, dc = dNear + dep / 2;
          const zEdge = P(a, D, paved)[2] - 0.19, dV = paved + vergeW;
          const tz = zEdge + (BASE_Z - zEdge) * (dc - dV) / (farD - dV);
          const c = P(a, D, dc);
          const hex = hotel ? ['#c9c4b8', '#b7bcc2', '#d3cfc4'][Math.floor(rng() * 3)] : ['#d9d6cc', '#c8c9c6', '#bfc3c4', '#d2c9b6'][Math.floor(rng() * 4)];
          faces.push(...boxFaces([c[0], c[1], BASE_Z], [len, dep, tz - BASE_Z + h], a.heading, hex));
          context.push({ D, s: s + len / 2, d: dc, len, dep, h });
        }
        s += len + 15 + rng() * 60;
      }
    }
  }
  // far ground to the horizon, under everything — tiled in 500 m cells: one 18 km quad crossing the
  // camera plane breaks the log depth buffer (its interpolated depth wins over the road)
  const F = 9000, cell = 500, zf = BASE_Z - 0.02, cx0 = alignment.length / 2;
  for (let gx = -F; gx < F; gx += cell) for (let gy = -F; gy < F; gy += cell) {
    const c = [[cx0 + gx, gy, zf], [cx0 + gx + cell, gy, zf], [cx0 + gx + cell, gy + cell, zf], [cx0 + gx, gy + cell, zf]];
    faces.push(texFace(c, COLOR.far, 'grass-dry', c.map((q) => [q[0] / 12, q[1] / 12])));
  }

  const lanes = laneGraph({ alignment, section, D0 });
  const cams = cameraPlan({ alignment, section, D0, structures });
  const traffic = m.traffic === false ? { vehicles: [], repeats: [] } : placeTraffic({ alignment, section, P, rng: mulberry32(seed * 7919 + 13), flow: dial('flow', 0, 2300, 1100), reserved: cams.reserved });
  return { alignment, section, stations: st, faces, lanes, sections, dashes, structures, walls, context, lights, dashPhase, traffic, cameras: cams.cameras, advisories, opts: D0, length: alignment.length };
}

/**
 * The lane graph — the affordance contract the driving phases read. Lane ids are
 * `<dir>:<roadway>:<index>` (dir 'eb' = +s, 'wb' = −s; index 0 is the lane next to the left
 * shoulder). Centrelines are stationed every 10 m in TRAVEL order: [s, x, y, z].
 */
export function laneGraph({ alignment, section, D0 }) {
  const { P } = makeFrame(section);
  const lanes = [];
  const pts = [];
  for (let s = 0; s <= alignment.length; s += 10) pts.push(alignment.at(s));
  if (pts[pts.length - 1].s < alignment.length) pts.push(alignment.at(alignment.length));
  for (const D of [1, -1]) {
    const dir = D === 1 ? 'eb' : 'wb';
    for (const rw of ['express', 'collector']) {
      const ls = section.bands.filter((b) => b.kind === 'lane' && b.roadway === rw);
      ls.forEach((b, i) => {
        const dc = (b.d0 + b.d1) / 2;
        const line = pts.map((p) => { const q = P(p, D, dc); return [Math.round(p.s * 100) / 100, ...q.map((v) => Math.round(v * 1000) / 1000)]; });
        lanes.push({
          id: `${dir}:${rw}:${i}`, dir, roadway: rw, index: i, width: b.w, speedKmh: D0.speedKmh, surface: 'asphalt', mu: 'dry',
          centreline: D === 1 ? line : line.slice().reverse(),
          left: i === 0 ? { lane: null, line: 'solid-yellow', beyond: 'shoulder' } : { lane: `${dir}:${rw}:${i - 1}`, line: 'broken-white' },
          right: i === ls.length - 1 ? { lane: null, line: 'solid-white', beyond: 'shoulder' } : { lane: `${dir}:${rw}:${i + 1}`, line: 'broken-white' },
          pred: null, succ: null,
        });
      });
    }
  }
  return lanes;
}

// ── the census: measure what was drawn ───────────────────────────────────────────────────────────
const hdist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const dist3 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);

export function roadwayCensus(plan) {
  const { section, sections, dashes, alignment, stations } = plan;
  const laneIdx = section.bands.map((b, i) => (b.kind === 'lane' ? i : -1)).filter((i) => i >= 0);
  let wMin = Infinity, wMax = -Infinity, xsMin = Infinity, xsMax = -Infinity;
  for (const row of sections) for (const D of [1, -1]) {
    const e = row[D].edges;
    for (const i of laneIdx) { const w = hdist(e[i], e[i + 1]); wMin = Math.min(wMin, w); wMax = Math.max(wMax, w); }
    const o = row[-D].edges;
    const across = hdist(e[e.length - 1], o[o.length - 1]);
    xsMin = Math.min(xsMin, across); xsMax = Math.max(xsMax, across);
  }
  const lens = dashes.map((d) => dist3(d.a, d.b));
  const byLine = new Map();
  for (const d of dashes) { const k = `${d.D}:${d.roadway}:${d.d}`; if (!byLine.has(k)) byLine.set(k, []); byLine.get(k).push(d); }
  const cycles = [];
  for (const list of byLine.values()) for (let i = 1; i < list.length; i++) cycles.push(dist3(list[i - 1].a, list[i].a));
  let eMax = 0, gMax = 0, rMin = Infinity;
  for (const s of stations) {
    eMax = Math.max(eMax, Math.abs(slopeOut(s, 1)), Math.abs(slopeOut(s, -1)));
    gMax = Math.max(gMax, Math.abs(s.grade));
    if (Math.abs(s.k) > 1e-9) rMin = Math.min(rMin, 1 / Math.abs(s.k));
  }
  // measured radius: the arc's chord geometry (3 points, 100 m apart) at the curve's middle
  let rMeasured = null;
  const arcStart = alignment.elements.slice(0, alignment.elements.findIndex((e) => e.type === 'arc')).reduce((a, e) => a + e.length, 0);
  const arc = alignment.elements.find((e) => e.type === 'arc');
  if (arc) {
    const m = arcStart + arc.length / 2, p = [m - 50, m, m + 50].map((s) => alignment.at(s));
    const a = hdist([p[0].x, p[0].y], [p[1].x, p[1].y]), b = hdist([p[1].x, p[1].y], [p[2].x, p[2].y]), c = hdist([p[0].x, p[0].y], [p[2].x, p[2].y]);
    const area = Math.abs((p[1].x - p[0].x) * (p[2].y - p[0].y) - (p[2].x - p[0].x) * (p[1].y - p[0].y)) / 2;
    rMeasured = (a * b * c) / (4 * area);
  }
  const rng = (xs) => (xs.length ? [Math.min(...xs), Math.max(...xs)] : null);
  return {
    length: alignment.length,
    laneWidth: [wMin, wMax],
    lanesPerDirection: laneIdx.length,
    crossSectionPaved: [xsMin, xsMax],
    dashLength: rng(lens), dashCycle: rng(cycles), dashes: dashes.length,
    crossSlopeMax: eMax, gradeMax: gMax, radiusMin: rMin, radiusMeasured: rMeasured,
    fleet: fleetCensus(plan),
    structures: (plan.structures || []).map((s) => ({ id: s.id, kind: s.kind, s: s.s, clearanceTarget: s.clearanceTarget, clearanceMin: s.clearanceMin })),
    faces: plan.faces.length,
  };
}

/** Fleet census: each class's drawn bounds against its table, the truck share, the tightest
 *  bumper-to-bumper gap in any lane (≥ 0 means no two vehicles overlap). */
export function fleetCensus(plan) {
  const vs = plan.traffic?.vehicles || [];
  const classes = [...new Set(vs.map((v) => v.cls))];
  const dims = Object.fromEntries(classes.map((c) => {
    const b = vehicleBounds(c), f = FLEET[c];
    return [c, { L: b.L / f.L, W: b.W / f.W, H: b.H / f.H }];
  }));
  const byLane = new Map();
  for (const v of vs) { if (!byLane.has(v.lane)) byLane.set(v.lane, []); byLane.get(v.lane).push(v); }
  let minGap = Infinity;
  for (const list of byLane.values()) {
    list.sort((a, b) => a.s - b.s);
    for (let i = 1; i < list.length; i++) minGap = Math.min(minGap, list[i].s - list[i - 1].s - (FLEET[list[i].cls].L + FLEET[list[i - 1].cls].L) / 2);
  }
  const trucks = vs.filter((v) => v.cls === 'straightTruck' || v.cls === 'tractorTrailer').length;
  return { vehicles: vs.length, truckShare: vs.length ? trucks / vs.length : 0, dimRatio: dims, minGap };
}

// ── the world payload ────────────────────────────────────────────────────────────────────────────
/** The preset shots, plus the lane spots traffic must leave empty (a camera is a car's driver). */
export function cameraPlan({ alignment, section, structures }) {
  const express = section.bands.some((b) => b.roadway === 'express');
  const rw = express ? 'express' : 'collector';
  const lane = section.bands.filter((b) => b.kind === 'lane' && b.roadway === rw)[1] || section.bands.find((b) => b.kind === 'lane');
  const colL = section.bands.filter((b) => b.kind === 'lane' && b.roadway === 'collector');
  const truckLane = colL[colL.length - 1];
  const { P } = makeFrame(section);
  const dc = (lane.d0 + lane.d1) / 2, dt = (truckLane.d0 + truckLane.d1) / 2;
  const eye = (s, h, d = dc) => P(alignment.at(s), 1, d, h);
  const s0 = 500;
  const ov = (structures.find((x) => x.kind === 'overpass') || { s: alignment.length * 0.6 }).s;
  const mid = alignment.at(alignment.length * 0.45);
  const pc = [560, 390];
  const laneId = (b) => `eb:${b.roadway}:${b.lane}`;
  return {
    reserved: [
      { lane: laneId(lane), s: s0 }, { lane: laneId(lane), s: ov - 200 }, { lane: laneId(lane), s: ov - 22 },
      { lane: laneId(truckLane), s: s0 },
    ],
    cameras: [
      { name: 'driver', worldFraming: { cameraPosition: eye(s0, 1.15), lookAt: eye(s0 + 160, 0.9), horizontalFov: 72, pictureCenter: pc } },
      { name: 'truck', worldFraming: { cameraPosition: eye(s0, 2.33, dt), lookAt: eye(s0 + 160, 1.6, dt), horizontalFov: 72, pictureCenter: pc } },
      { name: 'approach', worldFraming: { cameraPosition: eye(ov - 200, 1.15), lookAt: eye(ov, 4.5), horizontalFov: 64, pictureCenter: pc } },
      { name: 'under', worldFraming: { cameraPosition: eye(ov - 22, 1.15), lookAt: eye(ov + 20, 5.0), horizontalFov: 72, pictureCenter: pc } },
      { name: 'overpass-side', worldFraming: { cameraPosition: P(alignment.at(ov - 70), 1, section.width + 25, 1.7), lookAt: P(alignment.at(ov), 1, section.width * 0.4, 4), horizontalFov: 66, pictureCenter: pc } },
      { name: 'aerial', worldFraming: { cameraPosition: P(mid, 1, section.width + 140, 65), lookAt: P(alignment.at(mid.s + 250), 1, 0, 0), horizontalFov: 60, pictureCenter: pc } },
    ],
  };
}

/**
 * Static traffic at free flow (R5; R6 moves it): per lane, headways from a shifted exponential
 * around `flow` veh/h/lane at 100–115 km/h, classes from FLEET_MIX with trucks weighted to the
 * right-hand lanes and the collectors (and all but absent from the leftmost express lane).
 * Returns the vehicle list (the census's input) and instanced repeats — one per class, part and
 * heading family, since templates are pre-shaded for heading 0 and π.
 */
export function placeTraffic({ alignment, section, P, rng, flow = 1100, reserved = [] }) {
  const vehicles = [];
  if (flow <= 0) return { vehicles, repeats: [] };
  const truck = (c) => c === 'straightTruck' || c === 'tractorTrailer' || c === 'bus';
  for (const D of [1, -1]) {
    const dir = D === 1 ? 'eb' : 'wb';
    for (const rw of ['express', 'collector']) {
      const ls = section.bands.filter((b) => b.kind === 'lane' && b.roadway === rw);
      ls.forEach((b, i) => {
        const id = `${dir}:${rw}:${i}`, fromRight = ls.length - 1 - i;
        const tw = (rw === 'collector' ? 1.4 : 0.8) * (fromRight === 0 ? 2.0 : fromRight === 1 ? 1.2 : i === 0 ? 0.05 : 0.6);
        const pool = Object.entries(FLEET_MIX).map(([c, w]) => [c, truck(c) ? w * tw : w]);
        const total = pool.reduce((a, [, w]) => a + w, 0);
        const pick = () => { let r = rng() * total; for (const [c, w] of pool) { r -= w; if (r <= 0) return c; } return pool[pool.length - 1][0]; };
        const meanH = 3600 / flow, dc = (b.d0 + b.d1) / 2;
        let s = 20 + rng() * 60, prevHalf = 0;
        while (s < alignment.length - 20) {
          const cls = pick(), half = FLEET[cls].L / 2;
          const v = truck(cls) ? 27 + rng() * 2 : 28 + rng() * 4;
          const h = 1.1 + (-Math.log(1 - rng() * 0.999)) * Math.max(0.2, meanH - 1.1);
          s += Math.max(v * h, prevHalf + half + 8);
          if (s > alignment.length - 20) break;
          const sc = D === 1 ? s : alignment.length - s;           // travel order → station
          if (!reserved.some((r) => r.lane === id && Math.abs(r.s - sc) < 18 + half)) {
            const st = alignment.at(sc), p = P(st, D, dc);
            vehicles.push({ lane: id, cls, s: sc, D, pos: p, heading: st.heading + (D === 1 ? 0 : Math.PI), paint: Math.floor(rng() * PAINTS.length), trailerPaint: Math.floor(rng() * TRAILER_PAINTS.length) });
          }
          prevHalf = half;
        }
      });
    }
  }
  // instanced repeats: templates built once per class × heading family
  const groups = new Map();
  const tpl = new Map();
  for (const v of vehicles) {
    const fam = v.D === 1 ? 0 : 1, key = `${v.cls}:${fam}`;
    if (!tpl.has(key)) tpl.set(key, buildVehicle(v.cls, fam ? Math.PI : 0));
    const parts = tpl.get(key);
    const st = alignment.at(v.s);
    for (const part of ['paint', 'trim', 'trailer']) {
      if (!parts[part].length) continue;
      const g = `fleet:${key}:${part}`;
      if (!groups.has(g)) groups.set(g, { template: parts[part], transforms: [], group: g });
      const tint = part === 'paint' ? PAINTS[v.paint] : part === 'trailer' ? TRAILER_PAINTS[v.trailerPaint] : null;
      groups.get(g).transforms.push({ pos: v.pos, rotZ: st.heading, ...(tint ? { tint } : {}) });
    }
  }
  return { vehicles, repeats: [...groups.values()] };
}

/**
 * The opening shot for `?view=`: a preset camera by name, or `s<station>[-<dir>:<roadway>:<index>]`
 * (lane id colons may be written as dashes) — a driver's eye 1.15 m over that lane's centre at that
 * station, looking 160 m down the lane in its travel direction. Unknown or absent → presets as-is.
 */
export function viewCamera(plan, view) {
  if (typeof view !== 'string' || !view) return null;
  const preset = plan.cameras.find((c) => c.name === view);
  if (preset) return preset;
  const m = /^s(\d+(?:\.\d+)?)(?:[-:](eb|wb)[-:](express|collector)[-:](\d+))?$/.exec(view.trim());
  if (!m) return null;
  const s = Math.max(0, Math.min(plan.length, +m[1]));
  const id = m[2] ? `${m[2]}:${m[3]}:${m[4]}` : null;
  const lane = plan.lanes.find((l) => l.id === id) || plan.lanes.find((l) => l.dir === 'eb' && l.index === 1) || plan.lanes[0];
  const D = lane.dir === 'eb' ? 1 : -1;
  const band = plan.section.bands.filter((b) => b.kind === 'lane' && b.roadway === lane.roadway)[lane.index];
  const { P } = makeFrame(plan.section);
  const dc = (band.d0 + band.d1) / 2, ahead = Math.max(0, Math.min(plan.length, s + D * 160));
  return { name: `here:${Math.round(s)}:${lane.id}`, worldFraming: { cameraPosition: P(plan.alignment.at(s), D, dc, 1.15), lookAt: P(plan.alignment.at(ahead), D, dc, 0.9), horizontalFov: 72, pictureCenter: [560, 390] } };
}

export function assembleRoadwayScene(m = {}, opts = {}) {
  // a circuit or a stage is a track (track.js); no form, or the corridor, is the freeway below
  if (TRACK_FORMS.includes(m.form)) return assembleTrackScene(m, opts);
  if (m.form !== undefined && m.form !== 'corridor') throw new Error(`roadway: form '${m.form}' is not one of ${[...TRACK_FORMS, 'corridor'].join(', ')}`);
  const plan = planRoadway(m);
  const first = viewCamera(plan, opts.view);
  const cameras = first ? [first, ...plan.cameras.filter((c) => c !== first)] : plan.cameras;
  const V = 6000;   // visibility: a clear Ontario afternoon, the corridor's far end sits in haze
  return {
    faces: plan.faces,
    repeats: plan.traffic.repeats,
    cameras,
    viewBox: { width: 1120, height: 780 },
    title: opts.title || m.title || 'mojulo roadway',
    bg: '#c6cfda',
    sky: { preset: 'day', zenith: [96, 138, 190], horizon: [198, 207, 218], day: 1, stars: 0, seed: plan.opts.seed ?? 7 },
    haze: { color: '#c6cfda', density: 1.98 / V },
    metersPerUnit: ROADWAY_METERS_PER_UNIT,
    // the affordance contract (server-side payload; nothing on the page reads it yet)
    roadway: { vehicles: plan.traffic.vehicles.map(({ lane, cls, s, D }) => ({ lane, cls, s, D })), lanes: plan.lanes, structures: plan.structures.map(({ soffits, ...rest }) => rest), length: plan.length, advisories: plan.advisories },
  };
}
