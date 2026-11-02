/**
 * A SUBWAY STATION — a platform hall laid from a floor plan (network/station-plans.js), in the original subway station's
 * language (its line's colours, a frieze with roundels, white tile, tactile edges, tiled columns, benches and signs, a
 * train at a platform: architecture/subway-*.js) and the network's panelling over it (back-painted glass between steel
 * battens, a stainless kick, lit glass strips): its tracks laid as a rail tunnel's (network/passage.js layTrack), each
 * running on through a portal at each open end (a running tunnel's way in), or ending at buffer stops; its way out a
 * mezzanine across one end reached by a stair from the island, or a doorway through each side platform's wall.
 *
 *   readStation(c) → c, checked (refused by name)
 *   stationOf(c, { id, at, z0, portals, steps }) → { id, plan, faces, colliders, ports: { tracks, walks }, routes:
 *       { platforms, up, steps }, box, cameras, readout }   `at` [x, y] the hall's -y end's middle, `z0` its track bed;
 *       the hall along +y; `portals` { '-y' | '+y': [[x0, x1], …] } each end's portals as wide as the running tunnels
 *       that meet them (the hall's x), `steps` [{ end, x0, x1 }] steps cut into a platform's end down to the track bed,
 *       where a running tunnel's walkway meets it (routes.steps: each its top on the platform and its foot)
 *   assembleStationScene(manifest, ctx) → the World payload of a stage recipe's `station`
 *
 *   { kind: 'stage', station: { plan?: 'island' | 'side' | 'terminus', line?: 'blue' | 'red' | 'green' | 'orange',
 *     length?: 40…200 (m, 72), train?: true | false | { track } } }
 *
 * A track's port: { id, kind: 'track', end ('-y' | '+y'), track, x (its track's line), lo, hi ([x, y]: the portal's
 * jambs), plane, z0, top, N }; a way out's: { id, kind: 'walk', side, lo, hi, plane, z0, top, N }. Metres, z up. Pure:
 * no dice (a station is its plan, its line and its length).
 */
import { STATION_PLANS, STATION_PLAN_IDS, LINES, LINE_IDS } from './station-plans.js';
import { layTrack } from './passage.js';
import { buildTrainset } from '../architecture/subway-trainset.js';
import { concourseAssetFaces, buildBench, buildWasteBin, buildSignTotem } from '../architecture/subway-concourse-assets.js';
import { makeLight } from '../polygonizer/vexar.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const KEYS = ['plan', 'line', 'length', 'train', 'seed'];
// a platform's height over the track bed; the mezzanine's floor over the platform, its slab, its depth along the hall;
// the stair's riser, going and width; a portal's head over the track bed; the frieze's roundels' spacing (m)
export const STATION = Object.freeze({ platform: 1.05, mezz: 4.6, slab: 0.35, depth: 7, riser: 0.16, going: 0.3, stair: 2.8, portal: 4.2, roundel: 8, column: 6 });
const tint = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;

export function readStation(c = {}) {
  const no = (m) => { throw new Error(`station: ${m}`); };
  if (!c || typeof c !== 'object' || Array.isArray(c)) no(`a station is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(c)) if (!KEYS.includes(k)) no(`'${k}' is not a setting (${KEYS.join(', ')})`);
  if (c.plan !== undefined && !STATION_PLANS[c.plan]) no(`plan '${c.plan}' is not a floor plan (${STATION_PLAN_IDS.join(', ')})`);
  if (c.line !== undefined && !LINES[c.line]) no(`line '${c.line}' is not a line (${LINE_IDS.join(', ')})`);
  if (c.length !== undefined && !(Number.isFinite(c.length) && c.length >= 40 && c.length <= 200)) no('length is 40 to 200 (m)');
  const P = STATION_PLANS[c.plan ?? 'island'];
  if (c.train !== undefined && typeof c.train !== 'boolean' && !(c.train && typeof c.train === 'object' && Number.isInteger(c.train.track) && c.train.track >= 0 && c.train.track < P.tracks.length)) no(`train is true, false or { track: 0…${P.tracks.length - 1} }`);
  return c;
}

export function stationOf(c0 = {}, { id = 'station', at = [0, 0], z0 = 0, portals = {}, steps = [] } = {}) {
  const c = readStation(c0), planId = c.plan ?? 'island', P = STATION_PLANS[planId], line = LINES[c.line ?? 'blue'], len = c.length ?? 72;
  const hw = P.width / 2, H = P.height, PH = STATION.platform, X = (x) => at[0] + x, Y = (s) => at[1] + s;
  const W = ([x, s, z]) => [X(x), Y(s), z0 + z];
  const lamps = P.platforms.map(([a, b]) => (a + b) / 2);
  const glow = (x, z) => 0.86 + 0.24 * Math.max(0, 1 - Math.min(...lamps.map((l) => Math.abs(x - l))) / 7) * (0.55 + 0.45 * Math.min(1, z / H));
  const shade = (n) => (n[2] > 0.5 ? 1 : n[2] < -0.5 ? 0.66 : 0.84 + 0.05 * Math.abs(n[0]));
  const faces = [], colliders = [];
  /** a face from the hall's corners (x, s, z), wound to face along `n`, lit as it stands under the lamps; tiled where a
   *  texture is given (its uv in tiles of `ts` m: along the face and up it) */
  const emit = (cs, n, group, { hex, g = 1, texture = null, ts = 1.2 } = {}) => {
    const w = cs.map(W), e1 = w[1].map((v, i) => v - w[0][i]), e2 = w[w.length - 1].map((v, i) => v - w[0][i]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], flip = cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] < 0;
    const order = flip ? [...cs.keys()].reverse() : [...cs.keys()], k = g * shade(n), N = P3(n);
    const fills = order.map((i) => tint(hex, k * glow(cs[i][0], cs[i][2])));
    const uv = texture ? order.map((i) => (Math.abs(n[0]) > 0.5 ? [r5(cs[i][1] / ts), r5(cs[i][2] / ts)] : Math.abs(n[1]) > 0.5 ? [r5(cs[i][0] / ts), r5(cs[i][2] / ts)] : [r5(cs[i][0] / ts), r5(cs[i][1] / ts)])) : null;
    faces.push({ corners: order.map((i) => P3(w[i])), normal: N, outNormal: N, group: `station:${group}`, fill: fills[0], cornerFills: fills, ...(uv ? { texture, textureLit: true, uv } : {}) });
  };
  const hold = (x0, x1, s0, s1, zA, zB, of) => { const a = W([Math.min(x0, x1), Math.min(s0, s1), zA]), b = W([Math.max(x0, x1), Math.max(s0, s1), zB]); colliders.push({ min: P3(a), max: P3(b), of: `${id}:${of}` }); };
  const qx = (x, s0, s1, za, zb, nx, group, o) => emit([[x, s0, za], [x, s1, za], [x, s1, zb], [x, s0, zb]], [nx, 0, 0], group, o);
  const qs = (s, x0, x1, za, zb, ns, group, o) => emit([[x0, s, za], [x1, s, za], [x1, s, zb], [x0, s, zb]], [0, ns, 0], group, o);
  const qz = (z, x0, x1, s0, s1, nz, group, o) => emit([[x0, s0, z], [x1, s0, z], [x1, s1, z], [x0, s1, z]], [0, 0, nz], group, o);
  const box = (x0, x1, s0, s1, za, zb, group, o) => {
    qz(zb, x0, x1, s0, s1, 1, group, o); qx(x0, s0, s1, za, zb, -1, group, o); qx(x1, s0, s1, za, zb, 1, group, o); qs(s0, x0, x1, za, zb, -1, group, o); qs(s1, x0, x1, za, zb, 1, group, o);
  };
  const open = (end) => P.ends.includes(end);
  const mz = P.exit === 'mezzanine' ? (P.mezzanine === '-y' ? [0, STATION.depth] : [len - STATION.depth, len]) : null;
  const zM = PH + STATION.mezz;

  // ── the troughs and the platforms ──
  const troughs = [];
  let u = -hw;
  for (const [a, b] of [...P.platforms].sort((p, q) => p[0] - q[0])) { if (a > u + 1e-6) troughs.push([u, a]); u = Math.max(u, b); }
  if (u < hw - 1e-6) troughs.push([u, hw]);
  for (const [a, b] of troughs) qz(0, a, b, 0, len, 1, 'trackbed', { hex: '#46433f', g: 0.9 });
  const RUN = 1.2, NS = 4, rise = PH / NS;
  for (const [a, b] of P.platforms) {
    // (its top, but where steps are cut into its end: down to the track bed where a running tunnel's walkway meets it)
    const mine = steps.filter((st) => st.x0 >= a - 1e-6 && st.x1 <= b + 1e-6);
    for (const [s0, s1, end] of [[0, RUN, '-y'], [RUN, len - RUN, null], [len - RUN, len, '+y']]) {
      const cut = mine.filter((st) => st.end === end).sort((p, q) => p.x0 - q.x0);
      let x = a;
      for (const st of cut) { if (st.x0 > x + 1e-6) qz(PH, x, st.x0, s0, s1, 1, 'platform', { hex: '#c9c2b4', g: 0.92 }); x = st.x1; }
      if (b > x + 1e-6) qz(PH, x, b, s0, s1, 1, 'platform', { hex: '#c9c2b4', g: 0.92 });
    }
    for (const st of mine) {
      const sg = st.end === '-y' ? 1 : -1, s0 = st.end === '-y' ? 0 : len;
      for (let i = 0; i < NS; i++) {
        // (riser i at RUN - i going from its end, its tread under it a riser lower; the last at the track bed)
        const sr = s0 + sg * (RUN - (i * RUN) / NS), st1 = s0 + sg * (RUN - ((i + 1) * RUN) / NS), zt = PH - (i + 1) * rise;
        qs(sr, st.x0, st.x1, zt, zt + rise, -sg, 'platform-edge', { hex: '#a8a296', g: 0.85 });
        qz(zt, st.x0, st.x1, Math.min(sr, st1), Math.max(sr, st1), 1, i === NS - 1 ? 'trackbed' : 'stair', { hex: i === NS - 1 ? '#46433f' : '#c9c2b4', g: 0.92 });
        if (i < NS - 1) qz(zt + 0.003, st.x0, st.x1, sg > 0 ? sr - 0.06 : sr, sg > 0 ? sr : sr + 0.06, 1, 'tactile', { hex: '#d8a52a', g: 0.95 });
      }
      for (const [xe, nx] of [[st.x0, 1], [st.x1, -1]]) if (xe > a + 1e-6 && xe < b - 1e-6) qx(xe, Math.min(s0, s0 + sg * RUN), Math.max(s0, s0 + sg * RUN), 0, PH, nx, 'platform-edge', { hex: '#7d786f', g: 0.8 });
    }
    for (const [e, sg] of [[a, -1], [b, 1]]) {
      if (Math.abs(Math.abs(e) - hw) < 1e-6) continue;
      // (its edge over the track: its face down to the bed, a white line at its lip, the tactile strip behind it)
      qx(e, 0, len, 0, PH, sg, 'platform-edge', { hex: '#7d786f', g: 0.85 });
      qz(PH + 0.004, e - sg * 0.12, e - sg * 0.02, 0, len, 1, 'edge', { hex: '#f2efe6', g: 1 });
      qz(PH + 0.005, e - sg * 1.1, e - sg * 0.6, 0, len, 1, 'tactile', { hex: '#d8a52a', g: 0.95 });
    }
    for (const [s, ns] of [[0, -1], [len, 1]]) {
      const end = ns < 0 ? '-y' : '+y';
      if (!open(end)) continue;
      let x = a;
      for (const st of mine.filter((q) => q.end === end).sort((p, q) => p.x0 - q.x0)) { if (st.x0 > x + 1e-6) qs(s, x, st.x0, 0, PH, ns, 'platform-edge', { hex: '#7d786f', g: 0.8 }); x = st.x1; }
      if (b > x + 1e-6) qs(s, x, b, 0, PH, ns, 'platform-edge', { hex: '#7d786f', g: 0.8 });
    }
  }
  // ── the tracks: laid as a running tunnel's, on through a portal at an open end, else to buffer stops ──
  const shut = P.ends.length < 2 ? (open('-y') ? '+y' : '-y') : null, tEnd = shut === '+y' ? len - 1 : len, tStart = shut === '-y' ? 1 : 0;
  const ctx = {
    emit, at: (s, v, z) => [v, s, z], zf: () => 0, along: () => [0, 1, 0], across: (s, sg) => [-sg, 0, 0], clear: () => true, L: tEnd, G: (k) => k,
    run: (fn) => { for (let s = tStart; s < tEnd - 1e-6; s += 4) fn(s, Math.min(tEnd, s + 4), 0, 0); },
  };
  for (const t of P.tracks) {
    layTrack(ctx, t.x, t.third);
    if (shut) {
      const s0 = shut === '+y' ? tEnd - 0.9 : tStart, s1 = s0 + 0.9;
      box(t.x - 1.2, t.x + 1.2, s0, s1, 0, 1.1, 'buffer', { hex: '#b8322a', g: 0.9 });
      qs(shut === '+y' ? s0 - 0.002 : s1 + 0.002, t.x - 1.2, t.x + 1.2, 0.75, 0.95, shut === '+y' ? -1 : 1, 'buffer', { hex: '#f2efe6' });
    }
  }
  // ── the side walls: the trough's concrete under the platform's level, then a stainless kick, a glazed dado in the
  // line's frieze colour, white tile, the line's band with its roundels, back-painted glass between steel battens over
  // it to a steel cornice; a doorway where the way out is ──
  const doors = [];
  if (P.exit === 'sides') for (const [a, b] of P.platforms) { const sg = Math.abs(a + hw) < 1e-6 ? -1 : Math.abs(b - hw) < 1e-6 ? 1 : 0; if (sg) doors.push({ side: sg, s0: len / 2 - 1.5, s1: len / 2 + 1.5, z0: PH, z1: PH + 3 }); }
  if (mz) doors.push({ side: 1, s0: mz[0] + 1.5, s1: mz[0] + 4.5, z0: zM, z1: zM + 3 });
  const layers = (base) => [
    ...(base < PH ? [{ z0: base, z1: PH, hex: '#55524d', g: 0.85, group: 'concrete' }] : []),
    { z0: PH, z1: PH + 0.15, hex: '#8a9096', g: 0.9, group: 'steel' },
    { z0: PH + 0.15, z1: PH + 1.3, hex: line.frieze, g: 0.95, group: 'dado' },
    { z0: PH + 1.3, z1: PH + 3.2, hex: '#e6e8e4', g: 0.95, group: 'tile', texture: 'tile-subway' },
    { z0: PH + 3.2, z1: PH + 3.9, hex: line.band, g: 0.95, group: 'frieze' },
    { z0: PH + 3.9, z1: H - 0.35, hex: '#b9c4ca', g: 0.62, group: 'glass' },
    { z0: H - 0.35, z1: H, hex: '#8a9096', g: 0.7, group: 'steel' },
  ];
  for (const sg of [-1, 1]) {
    const x = sg * hw, base = P.platforms.some(([a, b]) => Math.abs((sg < 0 ? a : b) - x) < 1e-6) ? PH : 0, mine = doors.filter((d) => d.side === sg);
    const cuts = [...new Set([0, len, ...mine.flatMap((d) => [d.s0, d.s1])])].sort((p, q) => p - q);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1], d = mine.find((q) => q.s0 <= s0 + 1e-6 && q.s1 >= s1 - 1e-6);
      for (const L of layers(base)) for (const [za, zb] of d ? [[L.z0, Math.min(L.z1, d.z0)], [Math.max(L.z0, d.z1), L.z1]] : [[L.z0, L.z1]]) if (zb - za > 1e-3) qx(x, s0, s1, za, zb, -sg, L.group, { hex: L.hex, g: L.g, ...(L.texture ? { texture: L.texture } : {}) });
      for (const [za, zb] of d ? [[0, d.z0], [d.z1, H]] : [[0, H]]) if (zb - za > 1e-3) hold(x - sg * 0.02, x + sg * 0.3, s0, s1, za, zb, `wall${sg < 0 ? 'L' : 'R'}-${i}`);
    }
    // (the steel battens over the glass, every 2.4 m; the roundels on the band, every 8 m)
    for (let s = 2.4; s < len - 0.5; s += 2.4) if (!mine.some((d) => s > d.s0 - 0.2 && s < d.s1 + 0.2 && PH + 3.9 < d.z1)) qx(x - sg * 0.02, s - 0.04, s + 0.04, PH + 3.9, H - 0.35, -sg, 'steel', { hex: '#8a9096', g: 0.9 });
    for (let s = 6; s < len - 2; s += STATION.roundel) roundel(x - sg * 0.025, s, PH + 3.55, -sg);
  }
  // (a roundel: its ring in the line's roundel colour, a white disc, a bar across it)
  function roundel(x, s, z, nx) {
    const ring = (r, dx, hex, g = 1) => { const pts = Array.from({ length: 16 }, (_, k) => { const a = (2 * Math.PI * k) / 16; return [x + nx * dx, s + r * Math.cos(a), z + r * Math.sin(a)]; }); emit(pts, [nx, 0, 0], 'roundel', { hex, g }); };
    ring(0.42, 0.005, line.roundel); ring(0.27, 0.01, '#f2efe6');
    emit([[x + nx * 0.015, s - 0.62, z - 0.09], [x + nx * 0.015, s + 0.62, z - 0.09], [x + nx * 0.015, s + 0.62, z + 0.09], [x + nx * 0.015, s - 0.62, z + 0.09]], [nx, 0, 0], 'roundel', { hex: line.frieze, g: 1 });
  }
  // ── the end walls: tile over concrete, a portal to each track at an open end ──
  const gates = [];
  for (const [s, ns, end] of [[0, -1, '-y'], [len, 1, '+y']]) {
    // (each as wide as its trough, or as the running tunnel that meets it: `portals[end]`, the spans the line asks for)
    const spans = !open(end) ? [] : portals[end] ?? (P.tunnel === 'rail' ? [[Math.min(...P.tracks.map((t) => t.x)) - 2.15, Math.max(...P.tracks.map((t) => t.x)) + 2.15]] : P.tracks.map((t) => [t.x - 2.2, t.x + 2.2]));
    if (open(end)) P.tracks.forEach((t, i) => gates.push({ id: `${end}-${i}`, end, track: i, x: t.x, span: spans.find(([p, q]) => t.x > p && t.x < q) ?? spans[0], s, ns }));
    const cuts = [...new Set([-hw, hw, ...spans.flat()])].sort((p, q) => p - q);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const x0 = cuts[i], x1 = cuts[i + 1], hole = spans.some(([a, b]) => a <= x0 + 1e-6 && b >= x1 - 1e-6), zb = hole ? STATION.portal : 0;
      const plat = P.platforms.some(([a, b]) => a <= x0 + 1e-6 && b >= x1 - 1e-6) ? PH : 0;
      for (const [za, z1, hex, g, group, tex] of [[zb, Math.max(zb, plat), '#55524d', 0.85, 'concrete', null], [Math.max(zb, plat), H, '#e6e8e4', 0.9, 'tile', 'tile-subway']]) if (z1 - za > 1e-3) qs(s, x0, x1, za, z1, -ns, group, { hex, g, ...(tex ? { texture: tex } : {}) });
      hold(x0, x1, s, s + ns * 0.3, zb, H, `end${end}-${i}`);
    }
    // (each portal's lintel and jambs in the line's band)
    for (const [a, b] of spans) { qs(s - ns * 0.01, a, b, STATION.portal - 0.25, STATION.portal, -ns, 'portal', { hex: line.band, g: 0.8 }); for (const e of [a, b]) qs(s - ns * 0.01, e - 0.12, e + 0.12, 0, STATION.portal, -ns, 'portal', { hex: line.band, g: 0.7 }); }
  }
  // ── the ceiling: a soffit, coffered by beams over the columns and ribs across, a lit glass strip over each platform ──
  qz(H, -hw, hw, 0, len, -1, 'ceiling', { hex: '#5d6166', g: 0.9 });
  for (const cx of P.columns) { qz(H - 0.5, cx - 0.3, cx + 0.3, 0, len, -1, 'beam', { hex: '#6a6e74', g: 0.9 }); for (const sg of [-1, 1]) qx(cx + sg * 0.3, 0, len, H - 0.5, H, sg, 'beam', { hex: '#6a6e74', g: 0.85 }); }
  for (let s = STATION.column; s < len - 1; s += STATION.column) { qz(H - 0.35, -hw, hw, s - 0.15, s + 0.15, -1, 'beam', { hex: '#6a6e74', g: 0.85 }); for (const ns of [-1, 1]) qs(s + ns * 0.15, -hw, hw, H - 0.35, H, ns, 'beam', { hex: '#6a6e74', g: 0.8 }); }
  for (const l of lamps) qz(H - 0.37, l - 0.35, l + 0.35, 0.5, len - 0.5, -1, 'lamp', { hex: '#f4f8fb', g: 1.6 });
  // ── the mezzanine across one end over the tracks, its glass balustrade, the stair up to it from the island ──
  let stair = null;
  if (mz) {
    const [m0, m1] = mz, edge = P.mezzanine === '-y' ? m1 : m0, out = P.mezzanine === '-y' ? 1 : -1, sw = STATION.stair / 2;
    qz(zM, -hw, hw, m0, m1, 1, 'mezzanine', { hex: '#d4d0c6', g: 0.95, texture: 'marble-carrara', ts: 3 });
    qz(zM - STATION.slab, -hw, hw, m0, m1, -1, 'soffit', { hex: '#6a6e74', g: 0.85 });
    qs(edge, -hw, hw, zM - STATION.slab, zM, out, 'steel', { hex: '#8a9096', g: 0.85 });
    for (const [a, b] of [[-hw, -sw], [sw, hw]]) {
      faces.push({ corners: [[a, edge, zM], [b, edge, zM], [b, edge, zM + 1.1], [a, edge, zM + 1.1]].map((p) => P3(W(p))), fill: 'rgba(185,205,215,0.35)', water: true, doubleSided: true, group: 'station:glass' });
      qz(zM + 1.1, a, b, edge - 0.04, edge + 0.04, 1, 'steel', { hex: '#b4b9be' });
      hold(a, b, edge - 0.05, edge + 0.05, zM, zM + 1.1, `balustrade-${a < 0 ? 'L' : 'R'}`);
    }
    // the stair: from the island up to the mezzanine's edge, its treads and risers, its sides, its soffit
    const n = Math.ceil(STATION.mezz / STATION.riser - 1e-9), rise = STATION.mezz / n, foot = edge + out * n * STATION.going;
    for (let i = 0; i < n; i++) {
      const sA = foot - out * (i + 1) * STATION.going, sB = foot - out * i * STATION.going, zt = PH + (i + 1) * rise;
      qz(zt, -sw, sw, Math.min(sA, sB), Math.max(sA, sB), 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
      qz(zt + 0.003, -sw, sw, out > 0 ? sB - 0.06 : sB, out > 0 ? sB : sB + 0.06, 1, 'tactile', { hex: '#d8a52a', g: 0.95 });
      qs(sB, -sw, sw, zt - rise, zt, out, 'stair', { hex: '#a8a296', g: 0.85 });
      for (const sg of [-1, 1]) qx(sg * sw, Math.min(sA, sB), Math.max(sA, sB), PH, zt, sg, 'stair-side', { hex: '#8a9096', g: 0.85 });
    }
    emit([[-sw, foot, PH], [sw, foot, PH], [sw, edge, zM - STATION.slab], [-sw, edge, zM - STATION.slab]], [0, out * 0.7, -0.7], 'soffit', { hex: '#6a6e74', g: 0.8 });
    for (const sg of [-1, 1]) {
      emit([[sg * (sw + 0.02), foot, PH + 0.9], [sg * (sw + 0.02), edge, zM + 0.9], [sg * (sw + 0.02), edge, zM + 1.0], [sg * (sw + 0.02), foot, PH + 1.0]], [sg, 0, 0], 'steel', { hex: '#b4b9be' });
      hold(sg * sw - 0.05, sg * sw + 0.05, Math.min(foot, edge), Math.max(foot, edge), PH, zM + 1.1, `stair-${sg < 0 ? 'L' : 'R'}`);
    }
    stair = { foot, edge, out, n, rise };
  }
  // ── the columns: tiled shafts with a capital, up to the ceiling's beams, or the mezzanine's soffit over them ──
  for (const cx of P.columns) {
    const base = P.platforms.some(([a, b]) => cx > a && cx < b) ? PH : 0;
    for (let s = STATION.column / 2; s < len - 1; s += STATION.column) {
      if (stair && Math.abs(cx) < STATION.stair / 2 + 0.5 && s > Math.min(stair.foot, stair.edge) - 0.5 && s < Math.max(stair.foot, stair.edge) + 0.5) continue;
      const top = mz && s > mz[0] && s < mz[1] ? zM - STATION.slab : H - 0.5;
      for (const [x0, x1, s0, s1, za, zb, group, o] of [[cx - 0.3, cx + 0.3, s - 0.3, s + 0.3, base, top - 0.3, 'column', { hex: '#d9dddd', g: 0.95, texture: 'tile-white' }], [cx - 0.4, cx + 0.4, s - 0.4, s + 0.4, top - 0.3, top, 'column-cap', { hex: '#9aa0a7', g: 0.9 }]]) box(x0, x1, s0, s1, za, zb, group, o);
      hold(cx - 0.3, cx + 0.3, s - 0.3, s + 0.3, base, top, `column-${cx}-${s}`);
    }
  }
  // ── on the platforms: benches between the columns, bins beside them, a sign by the way out ──
  const light = makeLight({ direction: [0.18, 0.32, -0.93], ambient: 0.62, diffuse: 0.4 }), items = [];
  const busy = (s) => (stair && s > Math.min(stair.foot, stair.edge) - 1.5 && s < Math.max(stair.foot, stair.edge) + 1.5) || (mz && s > mz[0] - 1 && s < mz[1] + 1);
  for (const [a, b] of P.platforms) {
    const inner = P.columns.filter((cx) => cx > a && cx < b), against = Math.abs(a + hw) < 1e-6 ? a + 0.45 : Math.abs(b - hw) < 1e-6 ? b - 0.45 : null;
    const benchX = inner.length ? inner : against !== null ? [against] : [];
    for (const bx of benchX) for (let s = STATION.column; s < len - 3; s += 2 * STATION.column) {
      if (busy(s) || doors.some((d) => Math.abs(s - (d.s0 + d.s1) / 2) < 3)) continue;
      items.push({ build: buildBench, x: X(bx), y: Y(s), z: z0 + PH, facing: bx < (a + b) / 2 ? 'E' : 'W', len: 1.6, hold: [bx - 0.35, bx + 0.35, s - 0.85, s + 0.85] });
      items.push({ build: buildWasteBin, x: X(bx), y: Y(s + 1.6), z: z0 + PH, hold: [bx - 0.25, bx + 0.25, s + 1.35, s + 1.85] });
    }
  }
  // (the sign on the stair's other side from the lane the walk keeps to)
  if (stair) items.push({ build: buildSignTotem, x: X(STATION.stair / 2 + 0.9), y: Y(stair.foot + stair.out * 1.5), z: z0 + PH, facing: stair.out > 0 ? 'N' : 'S', line: line.band, hold: [STATION.stair / 2 + 0.65, STATION.stair / 2 + 1.15, stair.foot + stair.out * 1.5 - 0.25, stair.foot + stair.out * 1.5 + 0.25] });
  for (const it of items) {
    const { hold: hb, ...rest } = it;
    for (const f of concourseAssetFaces([rest], light)) faces.push({ ...f, corners: f.corners.map(P3), group: 'station:furniture' });
    hold(hb[0], hb[1], hb[2], hb[3], PH, PH + 1.2, `furniture-${Math.round(hb[0] * 10)}-${Math.round(hb[2] * 10)}`);
  }
  // ── a train at a platform: the original station's consist, its doors to the platform ──
  const want = c.train === undefined ? true : c.train, ti = typeof want === 'object' ? want.track : P.tracks.length - 1;
  let train = null;
  if (want) {
    const t = P.tracks[ti], s0 = tStart + 4, s1 = tEnd - 4;
    const T = buildTrainset({ x0: X(t.x - 1.5), x1: X(t.x + 1.5), yStart: Y(s0), yEnd: Y(s1), zSkirt: z0 + PH - 0.94, zFloor: z0 + PH - 0.1, zRoof: z0 + PH + 2.4, band: line.band, light });
    for (const f of T.faces) faces.push({ ...f, corners: f.corners.map(P3), group: 'station:train' });
    hold(t.x - 1.5, t.x + 1.5, s0, s1, 0, PH + 2.5, 'train');
    train = { track: ti, cars: T.cars };
  }
  // ── its ports: a portal a track an open end, a doorway a way out ──
  const ports = {
    tracks: gates.map((q) => ({ id: q.id, kind: 'track', end: q.end, track: q.track, x: r5(X(q.x)), lo: P3([X(q.span[0]), Y(q.s)]), hi: P3([X(q.span[1]), Y(q.s)]), plane: r5(Y(q.s)), z0: r5(z0), top: STATION.portal, N: [0, q.ns] })),
    walks: doors.map((d, i) => ({ id: `exit-${i}`, kind: 'walk', side: d.side < 0 ? '-x' : '+x', lo: P3([X(d.side * hw), Y(d.s0)]), hi: P3([X(d.side * hw), Y(d.s1)]), plane: r5(X(d.side * hw)), z0: r5(z0 + d.z0), top: r5(d.z1 - d.z0), N: [d.side, 0] })),
  };
  // ── its walks: along each platform, end to end, clear of its columns, benches and stair; and up to each way out ──
  const pt = (x, s, z) => P3(W([x, s, z]));
  const lanes = P.platforms.map(([a, b]) => {
    const inner = P.columns.filter((cx) => cx > a && cx < b);
    // (the lane: between a column line and the stair's side where both stand on it, else its middle off the benches)
    const x = inner.length && stair ? (Math.min(...inner) + 0.3 + -STATION.stair / 2) / 2 : inner.length ? (a + b) / 2 : (Math.abs(a + hw) < 1e-6 ? (a + 0.9 + b) / 2 : (a + b - 0.9) / 2);
    return x;
  });
  const routes = {
    platforms: lanes.map((x) => [pt(x, 1.5, PH), pt(x, len / 2, PH), pt(x, len - 1.5, PH)]),
    up: doors.map((d) => {
      const sm = (d.s0 + d.s1) / 2, inside = d.side * (hw - 0.4);
      if (d.z0 === PH) { const lane = lanes[P.platforms.findIndex(([a, b]) => (d.side < 0 ? a : b) === d.side * hw)]; return [pt(lane, sm, PH), pt(inside, sm, PH)]; }
      // (from the island's lane to the stair's foot, up it, across the mezzanine to the way out)
      return [pt(lanes[0], stair.foot + stair.out * 3, PH), pt(0, stair.foot + stair.out * 1.2, PH), pt(0, stair.edge - stair.out * 0.6, zM), pt(inside - d.side * 1.2, sm, zM), pt(inside, sm, zM)];
    }),
  };
  // (each step cut into a platform's end: its top on the platform, its foot on the track bed at the end wall)
  routes.steps = steps.map((st) => { const x = (st.x0 + st.x1) / 2, sg = st.end === '-y' ? 1 : -1, s0 = st.end === '-y' ? 0 : len; return { end: st.end, top: pt(x, s0 + sg * (RUN + 0.6), PH), foot: pt(x, s0 + sg * 0.15, 0) }; });
  const cameras = [
    { name: 'platform', worldFraming: { cameraPosition: pt(lanes[0], len - 2.5, PH + 1.7), lookAt: pt(lanes[0] * 0.3, len * 0.25, PH + 1.6), horizontalFov: 70 } },
    { name: 'hall', worldFraming: { cameraPosition: pt(-hw + 1, len - 1, H - 0.8), lookAt: pt(hw - 3, len * 0.3, PH), horizontalFov: 75 } },
    ...(gates.length ? [{ name: 'portal', worldFraming: { cameraPosition: pt(gates[0].x, gates[0].s - gates[0].ns * 12, 2.0), lookAt: pt(gates[0].x, gates[0].s, 1.8), horizontalFov: 70 } }] : []),
    ...(mz ? [{ name: 'mezzanine', worldFraming: { cameraPosition: pt(hw - 1.2, (mz[0] + mz[1]) / 2, zM + 1.7), lookAt: pt(-hw / 2, P.mezzanine === '-y' ? len * 0.7 : len * 0.3, PH), horizontalFov: 75 } }] : []),
  ];
  const lo = W([-hw - 0.3, 0, 0]), hi = W([hw + 0.3, len, H]);
  return {
    id, plan: planId, faces, colliders, ports, routes, cameras, box: { min: P3(lo), max: P3(hi) },
    readout: { plan: planId, line: c.line ?? 'blue', length: len, platforms: P.platforms.length, tracks: P.tracks.length, portals: ports.tracks.length, exits: ports.walks.length, tunnel: P.tunnel, ...(train ? { train } : {}) },
  };
}

export function assembleStationScene(manifest = {}, ctx = {}) {
  const S = stationOf(manifest.station ?? {}), start = S.routes.platforms[0][0];
  return {
    faces: S.faces, colliders: S.colliders, cameras: S.cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || manifest.title || 'a station',
    bg: '#0d0f12', walk: { speed: 4.5, spawn: [start[0], start[1], start[2] + 1.7], minEye: 1.7, gravity: 22, radius: 0.3 },
    anchors: [{ id: `station-${S.id}`, kind: 'station', plan: S.plan, ports: S.ports, routes: S.routes }],
    station: S.readout,
  };
}
