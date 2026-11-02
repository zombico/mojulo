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
 *       where a running tunnel's walkway meets it (routes.steps: each its top on the platform and its foot); `exits`
 *       [{ side: ±1, s0, s1, id? }] its ways out as asked (the mezzanine's floor, or the platforms'), `mezzDepth` how
 *       far its mezzanine reaches along the hall; `ends` the ends its tracks run on through (its plan's by default: a
 *       through station at a line's end is closed there, its tracks at buffer stops); `ground` an open station's street
 *       over its track bed (a cut's: 5.65 m, its mezzanine at the street; an elevated one's: -8.55 m)
 *   assembleStationScene(manifest, ctx) → the World payload of a stage recipe's `station`
 *
 *   { kind: 'stage', station: { plan?: 'island' | 'side' | 'terminus', line?: 'blue' | 'red' | 'green' | 'orange',
 *     length?: 40…200 (m, 72), train?: true | false | { track }, elevation?: 'deep' | 'cut' | 'elevated' } }
 *
 * Its ELEVATION: `deep` (the default) under its ceiling; in a `cut`, open to the sky between retaining walls a railing
 * over the street, a canopy over each platform (on its columns' posts, or hung from the wall), its mezzanine a bridge at
 * the street, a side platform's way out a stair up the wall to a landing at the street; `elevated` on its deck over the
 * street on piers, parapets each side, canopies on posts, an island's stair down a well to a station house under its
 * mezzanine end, each way out a flight down its outside to the street. An open station's ways out are ports at the
 * street (`street: true`), and it says where its street is (`street: { z, hole }`: a cut's hole in the ground).
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
const KEYS = ['plan', 'line', 'length', 'train', 'seed', 'elevation'];
export const ELEVATIONS = Object.freeze(['deep', 'cut', 'elevated']);
// a platform's height over the track bed; the mezzanine's floor over the platform, its slab, its depth along the hall;
// the stair's riser, going and width; a portal's head over the track bed; the frieze's roundels' spacing (m)
// an open station's: the station house's floor under an elevated island, the flight from it to the street, the deck
// under the tracks, a canopy's underside over a platform, a railing's height (m)
export const STATION = Object.freeze({ platform: 1.05, mezz: 4.6, slab: 0.35, depth: 7, riser: 0.16, going: 0.3, stair: 2.8, portal: 4.2, roundel: 8, column: 6, under: 5.2, flight: 4.4, deck: 0.9, canopy: 3.4, rail: 1.1 });
const tint = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;

export function readStation(c = {}) {
  const no = (m) => { throw new Error(`station: ${m}`); };
  if (!c || typeof c !== 'object' || Array.isArray(c)) no(`a station is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(c)) if (!KEYS.includes(k)) no(`'${k}' is not a setting (${KEYS.join(', ')})`);
  if (c.plan !== undefined && !STATION_PLANS[c.plan]) no(`plan '${c.plan}' is not a floor plan (${STATION_PLAN_IDS.join(', ')})`);
  if (c.line !== undefined && !LINES[c.line]) no(`line '${c.line}' is not a line (${LINE_IDS.join(', ')})`);
  if (c.length !== undefined && !(Number.isFinite(c.length) && c.length >= 40 && c.length <= 200)) no('length is 40 to 200 (m)');
  if (c.elevation !== undefined && !ELEVATIONS.includes(c.elevation)) no(`elevation is ${ELEVATIONS.map((e) => `'${e}'`).join(' | ')}`);
  const P = STATION_PLANS[c.plan ?? 'island'];
  if (c.train !== undefined && typeof c.train !== 'boolean' && !(c.train && typeof c.train === 'object' && Number.isInteger(c.train.track) && c.train.track >= 0 && c.train.track < P.tracks.length)) no(`train is true, false or { track: 0…${P.tracks.length - 1} }`);
  return c;
}

export function stationOf(c0 = {}, { id = 'station', at = [0, 0], z0 = 0, portals = {}, steps = [], exits = null, mezzDepth = STATION.depth, ends = null, ground = null } = {}) {
  const c = readStation(c0), planId = c.plan ?? 'island', P = STATION_PLANS[planId], line = LINES[c.line ?? 'blue'], len = c.length ?? 72;
  const hw = P.width / 2, H = P.height, PH = STATION.platform, X = (x) => at[0] + x, Y = (s) => at[1] + s;
  const W = ([x, s, z]) => [X(x), Y(s), z0 + z];
  const pt3 = (x, s, z) => P3(W([x, s, z]));
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
  // (its open ends: its plan's, or those a line runs on through: a through station at the line's end is closed there)
  const open = (end) => (ends ?? P.ends).includes(end);
  const mz = P.exit === 'mezzanine' ? (P.mezzanine === '-y' ? [0, mezzDepth] : [len - mezzDepth, len]) : null;
  // ── its elevation: DEEP under a roof; in a CUT, open to the sky, its street `ground` over its track bed (its mezzanine a
  // bridge at the street's level), or ELEVATED on its deck over the street, its station house under the island ──
  const EL = c.elevation ?? 'deep', airy = EL !== 'deep';
  const zG = EL === 'cut' ? ground ?? PH + STATION.mezz : EL === 'elevated' ? ground ?? PH - STATION.under - STATION.flight : null;
  if (EL === 'cut' && !(zG >= PH + 4 - 1e-9 && zG <= PH + 12 + 1e-9)) throw new Error(`station: a cut station's street is 4 to 12 m over its platforms, not ${r5(zG - PH)}`);
  if (EL === 'elevated' && !(zG <= PH - STATION.under - 2.4 + 1e-9 && zG >= PH - STATION.under - 16 - 1e-9)) throw new Error(`station: an elevated station's street is 2.4 to 16 m under its station house, not ${r5(PH - STATION.under - zG)}`);
  const zM = EL === 'cut' ? zG : EL === 'elevated' ? PH - STATION.under : PH + STATION.mezz;
  // (where a side wall stops: a deep hall's ceiling; a cut's retaining wall a railing over the street; an elevated
  // station's parapet a railing over its floor)
  const wallTop = (base) => (EL === 'cut' ? zG + STATION.rail : EL === 'elevated' ? base + STATION.rail : H);
  // (an elevated island's stair down through a well in it to the station house under its mezzanine end)
  const sw = STATION.stair / 2, nM = Math.ceil(Math.abs(zM - PH) / STATION.riser - 1e-9), edgeM = mz ? (P.mezzanine === '-y' ? mz[1] : mz[0]) : 0;
  const footM = edgeM + (P.mezzanine === '-y' ? 1 : -1) * nM * STATION.going, well = EL === 'elevated' && mz ? [Math.min(edgeM, footM), Math.max(edgeM, footM)] : null;
  const ptop = (x0, x1, s0, s1) => {
    const o = { hex: '#c9c2b4', g: 0.92 };
    if (!well || x1 <= -sw + 1e-6 || x0 >= sw - 1e-6 || s1 <= well[0] + 1e-6 || s0 >= well[1] - 1e-6) return qz(PH, x0, x1, s0, s1, 1, 'platform', o);
    if (x0 < -sw) qz(PH, x0, -sw, s0, s1, 1, 'platform', o);
    if (x1 > sw) qz(PH, sw, x1, s0, s1, 1, 'platform', o);
    const xa = Math.max(x0, -sw), xb = Math.min(x1, sw);
    if (well[0] > s0 + 1e-6) qz(PH, xa, xb, s0, well[0], 1, 'platform', o);
    if (well[1] < s1 - 1e-6) qz(PH, xa, xb, well[1], s1, 1, 'platform', o);
  };

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
      for (const st of cut) { if (st.x0 > x + 1e-6) ptop(x, st.x0, s0, s1); x = st.x1; }
      if (b > x + 1e-6) ptop(x, b, s0, s1);
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
  const shuts = ['-y', '+y'].filter((e) => !open(e)), tEnd = shuts.includes('+y') ? len - 1 : len, tStart = shuts.includes('-y') ? 1 : 0;
  const ctx = {
    emit, at: (s, v, z) => [v, s, z], zf: () => 0, along: () => [0, 1, 0], across: (s, sg) => [-sg, 0, 0], clear: () => true, L: tEnd, G: (k) => k,
    run: (fn) => { for (let s = tStart; s < tEnd - 1e-6; s += 4) fn(s, Math.min(tEnd, s + 4), 0, 0); },
  };
  for (const t of P.tracks) {
    layTrack(ctx, t.x, t.third);
    for (const sh of shuts) {
      const s0 = sh === '+y' ? tEnd - 0.9 : tStart, s1 = s0 + 0.9;
      box(t.x - 1.2, t.x + 1.2, s0, s1, 0, 1.1, 'buffer', { hex: '#b8322a', g: 0.9 });
      qs(sh === '+y' ? s0 - 0.002 : s1 + 0.002, t.x - 1.2, t.x + 1.2, 0.75, 0.95, sh === '+y' ? -1 : 1, 'buffer', { hex: '#f2efe6' });
    }
  }
  // ── the side walls: the trough's concrete under the platform's level, then a stainless kick, a glazed dado in the
  // line's frieze colour, white tile, the line's band with its roundels, back-painted glass between steel battens over
  // it to a steel cornice; a doorway where the way out is ──
  const doors = [];
  // (its ways out as asked: each on a side at a span along the hall, at the mezzanine's floor or the platforms')
  if (exits) for (const e of exits) doors.push({ side: e.side < 0 ? -1 : 1, s0: e.s0, s1: e.s1, z0: mz ? zM : PH, z1: (mz ? zM : PH) + 3, ...(e.id ? { id: e.id } : {}) });
  else if (P.exit === 'sides') for (const [a, b] of P.platforms) { const sg = Math.abs(a + hw) < 1e-6 ? -1 : Math.abs(b - hw) < 1e-6 ? 1 : 0; if (sg) doors.push({ side: sg, s0: len / 2 - 1.5, s1: len / 2 + 1.5, z0: PH, z1: PH + 3 }); }
  if (!exits && mz) doors.push({ side: 1, s0: mz[0] + 1.5, s1: mz[0] + 4.5, z0: zM, z1: zM + 3 });
  // a straight flight along the hall at x∈[x0, x1]: from (sA, zA) running `dir` to zB, a landing halfway where it is
  // long; its treads and risers, its stringers and soffit, a handrail held each side but its `bare` one (a wall's)
  const flight = (x0, x1, sA, dir, zA, zB, tag, bare = 0) => {
    const n = Math.ceil(Math.abs(zB - zA) / STATION.riser - 1e-9), r = (zB - zA) / n, g = STATION.going, mid = n > 24 ? Math.floor(n / 2) : -1, xm = (x0 + x1) / 2;
    const pts = [[xm, sA, zA]], legs = [];
    let s = sA, z = zA, l0 = [s, z];
    for (let i = 0; i < n; i++) {
      if (i === mid) {
        const s2 = s + dir * 1.5;
        legs.push([l0, [s, z]], [[s, z], [s2, z]]);
        qz(z, x0, x1, Math.min(s, s2), Math.max(s, s2), 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
        pts.push([xm, s, z], [xm, s2, z]);
        s = s2; l0 = [s, z];
      }
      const s2 = s + dir * g, z2 = z + r;
      qs(s, x0, x1, Math.min(z, z2), Math.max(z, z2), -dir * Math.sign(r), 'stair', { hex: '#a8a296', g: 0.85 });
      qz(z2, x0, x1, Math.min(s, s2), Math.max(s, s2), 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
      s = s2; z = z2;
    }
    legs.push([l0, [s, z]]);
    pts.push([xm, s, z]);
    for (const [[sa, za], [sb, zb]] of legs) {
      if (Math.abs(sb - sa) < 1e-6) continue;
      emit([[x0, sa, za - 0.4], [x1, sa, za - 0.4], [x1, sb, zb - 0.4], [x0, sb, zb - 0.4]], [0, 0, -1], 'soffit', { hex: '#6a6e74', g: 0.8 });
      for (const [xe, nx] of [[x0, -1], [x1, 1]]) {
        for (const ny of [nx, -nx]) emit([[xe, sa, za - 0.4], [xe, sb, zb - 0.4], [xe, sb, zb + 0.05], [xe, sa, za + 0.05]], [ny, 0, 0], 'stair-side', { hex: '#8a9096', g: 0.85 });
        if (nx === bare) continue;
        emit([[xe, sa, za + 0.9], [xe, sb, zb + 0.9], [xe, sb, zb + 1.0], [xe, sa, za + 1.0]], [-nx, 0, 0], 'steel', { hex: '#b4b9be' });
        hold(xe - 0.05, xe + 0.05, sa, sb, Math.min(za, zb), Math.max(za, zb) + STATION.rail, `${tag}-rail-${nx < 0 ? 'L' : 'R'}-${Math.round(Math.min(sa, sb) * 10)}`);
      }
    }
    return { pts, end: s };
  };
  // ── an open station's ways out to its street: a cut's mezzanine is at the street, through a gap in its railing; a
  // stair up a cut's wall from a side platform to a landing at the street; a flight down an elevated station's outside
  // from its platform or its station house. Each its walk on from the way out, and its port where it meets the street ──
  const ways = doors.map(() => null), zones = [];
  if (airy) doors.forEach((d, i) => {
    const sg = d.side, sm = (d.s0 + d.s1) / 2, tag = `way-${i}`;
    const port = (lo, hi, plane, N) => ({ id: d.id ?? `exit-${i}`, kind: 'walk', side: sg < 0 ? '-x' : '+x', lo: P3([X(lo[0]), Y(lo[1])]), hi: P3([X(hi[0]), Y(hi[1])]), plane: r5(plane), z0: r5(z0 + zG), top: 3, N, street: true });
    if (EL === 'cut' && d.z0 === zG) {
      ways[i] = { tail: [pt3(sg * (hw + 1.5), sm, zG)], port: port([sg * (hw + 0.3), d.s0], [sg * (hw + 0.3), d.s1], X(sg * (hw + 0.3)), [sg, 0]) };
      return;
    }
    if (EL === 'cut') {
      // (up the cut's wall along its platform to a landing at the street: the stair's top at the way out)
      const xa = sg < 0 ? -hw : hw - 1.8, xb = sg < 0 ? -hw + 1.8 : hw, xm = (xa + xb) / 2;
      const n = Math.ceil((zG - PH) / STATION.riser - 1e-9), run = n * STATION.going + (n > 24 ? 1.5 : 0);
      let dir = 1, sF = d.s0 - run;
      if (sF < 3) { dir = -1; sF = d.s1 + run; }
      const F = flight(xa, xb, sF, dir, PH, zG, tag, sg);
      d.z0 = zG; d.z1 = zG + 3;
      qz(zG, xa, xb, d.s0, d.s1, 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
      qz(zG - 0.3, xa, xb, d.s0, d.s1, -1, 'soffit', { hex: '#6a6e74', g: 0.8 });
      const xi = sg < 0 ? xb : xa, far = dir > 0 ? d.s1 : d.s0;
      qx(xi, d.s0, d.s1, zG - 0.3, zG, -sg, 'stair-side', { hex: '#8a9096', g: 0.85 });
      qx(xi, d.s0, d.s1, zG + 0.9, zG + 1.0, -sg, 'steel', { hex: '#b4b9be' });
      hold(xi - 0.05, xi + 0.05, d.s0, d.s1, zG, zG + STATION.rail, `${tag}-landing-in`);
      qs(far, xa, xb, zG + 0.9, zG + 1.0, -dir, 'steel', { hex: '#b4b9be' });
      hold(xa, xb, far - 0.05, far + 0.05, zG, zG + STATION.rail, `${tag}-landing-end`);
      zones.push([Math.min(sF, d.s0), Math.max(sF, d.s1)]);
      ways[i] = { full: (lane) => [pt3(lane, sF - dir * 2.5, PH), pt3(xm, sF - dir * 0.6, PH), ...F.pts.map((q) => pt3(...q)), pt3(xm, sm, zG), pt3(sg * (hw + 0.15), sm, zG), pt3(sg * (hw + 1.5), sm, zG)], port: port([sg * (hw + 0.3), d.s0], [sg * (hw + 0.3), d.s1], X(sg * (hw + 0.3)), [sg, 0]) };
      return;
    }
    // (elevated: out through the parapet, or the station house's wall, onto a landing, and down the outside)
    const zd = d.z0, xa = sg > 0 ? hw + 0.3 : -hw - 2.1, xb = sg > 0 ? hw + 2.1 : -hw - 0.3, xm = (xa + xb) / 2, xo = sg > 0 ? xb : xa;
    const n = Math.ceil((zd - zG) / STATION.riser - 1e-9), run = n * STATION.going + (n > 24 ? 1.5 : 0), dir = d.s1 + run <= len + 6 ? 1 : -1, sA = dir > 0 ? d.s1 : d.s0;
    qz(zd, xa, xb, d.s0, d.s1, 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
    qz(zd - 0.3, xa, xb, d.s0, d.s1, -1, 'soffit', { hex: '#6a6e74', g: 0.8 });
    qx(xo, d.s0, d.s1, zd - 0.3, zd, sg, 'stair-side', { hex: '#8a9096', g: 0.85 });
    qx(xo, d.s0, d.s1, zd + 0.9, zd + 1.0, -sg, 'steel', { hex: '#b4b9be' });
    hold(xo - 0.05, xo + 0.05, d.s0, d.s1, zd, zd + STATION.rail, `${tag}-landing-out`);
    const back = dir > 0 ? d.s0 : d.s1;
    qs(back, xa, xb, zd + 0.9, zd + 1.0, dir, 'steel', { hex: '#b4b9be' });
    hold(xa, xb, back - 0.05, back + 0.05, zd, zd + STATION.rail, `${tag}-landing-end`);
    // (its posts: under the landing's outer corners down to the street)
    for (const se of [d.s0 + 0.15, d.s1 - 0.15]) { box(xo - sg * 0.3 - 0.12, xo - sg * 0.3 + 0.12, se - 0.12, se + 0.12, zG, zd - 0.3, 'pier', { hex: '#56616a', g: 0.85 }); hold(xo - sg * 0.3 - 0.12, xo - sg * 0.3 + 0.12, se - 0.12, se + 0.12, zG, zd - 0.3, `${tag}-post-${Math.round(se * 10)}`); }
    const F = flight(xa, xb, sA, dir, zd, zG, tag, 0);
    ways[i] = { tail: [pt3(xm, sm, zd), ...F.pts.map((q) => pt3(...q)), pt3(xm, F.end + dir * 1.5, zG)], port: port([xa, F.end], [xb, F.end], Y(F.end), [0, dir]) };
  });
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
    const x = sg * hw, base = P.platforms.some(([a, b]) => Math.abs((sg < 0 ? a : b) - x) < 1e-6) ? PH : 0, mine = doors.filter((d) => d.side === sg && d.z1 > 0), top = wallTop(base);
    // (its layers to its top: a deep hall's to its cornice, a cut's to its railing over the street; an elevated
    // station's parapet)
    const ls = EL === 'elevated' ? [{ z0: base, z1: base + 0.15, hex: '#8a9096', g: 0.9, group: 'steel' }, { z0: base + 0.15, z1: top, hex: line.frieze, g: 0.9, group: 'parapet' }]
      : [...layers(base).map((L) => ({ ...L, z1: Math.min(L.z1, top) })).filter((L) => L.z1 - L.z0 > 1e-3), ...(top > H + 1e-6 ? [{ z0: H, z1: top, hex: '#55524d', g: 0.85, group: 'concrete' }] : [])];
    const cuts = [...new Set([0, len, ...mine.flatMap((d) => [d.s0, d.s1])])].sort((p, q) => p - q);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const s0 = cuts[i], s1 = cuts[i + 1], d = mine.find((q) => q.s0 <= s0 + 1e-6 && q.s1 >= s1 - 1e-6);
      for (const L of ls) for (const [za, zb] of d ? [[L.z0, Math.min(L.z1, d.z0)], [Math.max(L.z0, d.z1), L.z1]] : [[L.z0, L.z1]]) if (zb - za > 1e-3) qx(x, s0, s1, za, zb, -sg, L.group, { hex: L.hex, g: L.g, ...(L.texture ? { texture: L.texture } : {}) });
      for (const [za, zb] of d ? [[0, d.z0], [d.z1, top]] : [[0, top]]) if (zb - za > 1e-3) hold(x - sg * 0.02, x + sg * 0.3, s0, s1, za, zb, `wall${sg < 0 ? 'L' : 'R'}-${i}`);
      if (airy) {
        // (open: its top capped, a way out's sill walked across; its outer face, over the street or down to the deck)
        const zt = d ? d.z0 : top, zo = EL === 'cut' ? zG : -STATION.deck;
        qz(zt, Math.min(x, x + sg * 0.3), Math.max(x, x + sg * 0.3), s0, s1, 1, EL === 'cut' ? 'retaining' : 'steel', { hex: '#a8a39a', g: 0.95 });
        if (zt > zo + 1e-3) qx(x + sg * 0.3, s0, s1, zo, zt, sg, EL === 'cut' ? 'retaining' : 'girder', { hex: EL === 'cut' ? '#8f8a82' : '#4f5a63', g: 0.85 });
      }
    }
    // (the steel battens over the glass, every 2.4 m; the roundels on the band, every 8 m)
    if (EL !== 'elevated' && top > PH + 4.2) for (let s = 2.4; s < len - 0.5; s += 2.4) if (!mine.some((d) => s > d.s0 - 0.2 && s < d.s1 + 0.2 && PH + 3.9 < d.z1)) qx(x - sg * 0.02, s - 0.04, s + 0.04, PH + 3.9, Math.min(H - 0.35, top), -sg, 'steel', { hex: '#8a9096', g: 0.9 });
    if (EL !== 'elevated' && top > PH + 4) for (let s = 6; s < len - 2; s += STATION.roundel) if (!airy || !mine.some((d) => s > d.s0 - 0.6 && s < d.s1 + 0.6 && d.z0 < PH + 4)) roundel(x - sg * 0.025, s, PH + 3.55, -sg);
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
    if (EL === 'elevated') {
      // (elevated: its deck's end, and a parapet across where its tracks end)
      qs(s, -hw - 0.3, hw + 0.3, -STATION.deck, 0, ns, 'girder', { hex: '#4f5a63', g: 0.85 });
      if (open(end)) continue;
      const xs = [...new Set([-hw, hw, ...P.platforms.flat()])].sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i++) {
        const x0 = xs[i], x1 = xs[i + 1], base = P.platforms.some(([a, b]) => a <= x0 + 1e-6 && b >= x1 - 1e-6) ? PH : 0;
        qs(s, x0, x1, base, base + STATION.rail, -ns, 'parapet', { hex: line.frieze, g: 0.9 });
        qs(s + ns * 0.3, x0, x1, base > 0 ? 0 : 0, base + STATION.rail, ns, 'girder', { hex: '#4f5a63', g: 0.85 });
        qz(base + STATION.rail, x0, x1, Math.min(s, s + ns * 0.3), Math.max(s, s + ns * 0.3), 1, 'steel', { hex: '#a8a39a', g: 0.95 });
        hold(x0, x1, s, s + ns * 0.3, 0, base + STATION.rail, `end${end}-${i}`);
      }
      continue;
    }
    const eTop = EL === 'cut' ? zG + STATION.rail : H;
    const cuts = [...new Set([-hw, hw, ...spans.flat()])].sort((p, q) => p - q);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const x0 = cuts[i], x1 = cuts[i + 1], hole = spans.some(([a, b]) => a <= x0 + 1e-6 && b >= x1 - 1e-6), zb = hole ? STATION.portal : 0;
      const plat = P.platforms.some(([a, b]) => a <= x0 + 1e-6 && b >= x1 - 1e-6) ? PH : 0;
      for (const [za, z1, hex, g, group, tex] of [[zb, Math.max(zb, plat), '#55524d', 0.85, 'concrete', null], [Math.max(zb, plat), eTop, '#e6e8e4', 0.9, 'tile', 'tile-subway']]) if (z1 - za > 1e-3) qs(s, x0, x1, za, z1, -ns, group, { hex, g, ...(tex ? { texture: tex } : {}) });
      hold(x0, x1, s, s + ns * 0.3, zb, eTop, `end${end}-${i}`);
    }
    // (each portal's lintel and jambs in the line's band)
    for (const [a, b] of spans) { qs(s - ns * 0.01, a, b, STATION.portal - 0.25, STATION.portal, -ns, 'portal', { hex: line.band, g: 0.8 }); for (const e of [a, b]) qs(s - ns * 0.01, e - 0.12, e + 0.12, 0, STATION.portal, -ns, 'portal', { hex: line.band, g: 0.7 }); }
    if (EL === 'cut') {
      // (a cut's end wall capped over the street, its face to the street over the ground)
      const s2 = s + ns * 0.3;
      qz(eTop, -hw - 0.3, hw + 0.3, Math.min(s, s2), Math.max(s, s2), 1, 'retaining', { hex: '#a8a39a', g: 0.95 });
      qs(s2, -hw - 0.3, hw + 0.3, zG, eTop, ns, 'retaining', { hex: '#8f8a82', g: 0.85 });
    }
  }
  // ── the ceiling: a soffit, coffered by beams over the columns and ribs across, a lit glass strip over each platform ──
  if (!airy) {
    qz(H, -hw, hw, 0, len, -1, 'ceiling', { hex: '#5d6166', g: 0.9 });
    for (const cx of P.columns) { qz(H - 0.5, cx - 0.3, cx + 0.3, 0, len, -1, 'beam', { hex: '#6a6e74', g: 0.9 }); for (const sg of [-1, 1]) qx(cx + sg * 0.3, 0, len, H - 0.5, H, sg, 'beam', { hex: '#6a6e74', g: 0.85 }); }
    for (let s = STATION.column; s < len - 1; s += STATION.column) { qz(H - 0.35, -hw, hw, s - 0.15, s + 0.15, -1, 'beam', { hex: '#6a6e74', g: 0.85 }); for (const ns of [-1, 1]) qs(s + ns * 0.15, -hw, hw, H - 0.35, H, ns, 'beam', { hex: '#6a6e74', g: 0.8 }); }
    for (const l of lamps) qz(H - 0.37, l - 0.35, l + 0.35, 0.5, len - 0.5, -1, 'lamp', { hex: '#f4f8fb', g: 1.6 });
  }
  // ── open: a canopy over each platform (but where a cut's stair climbs through it, or its mezzanine bridges over it),
  // its fascia in the line's band, a lamp strip under it ──
  const roofs = P.platforms.map(([a, b]) => {
    if (!airy) return [];
    const blocked = [...(EL === 'cut' && mz ? [[mz[0], mz[1]], [Math.min(edgeM, footM) - 0.5, Math.max(edgeM, footM) + 0.5]] : []), ...zones];
    let spans = [[RUN, len - RUN]];
    for (const [p, q] of blocked) spans = spans.flatMap(([u, v]) => (q <= u || p >= v ? [[u, v]] : [[u, p], [q, v]]).filter(([m, n]) => n - m > 3));
    return spans;
  });
  if (airy) P.platforms.forEach(([a, b], k) => {
    const xa = Math.abs(a + hw) < 1e-6 ? a : a - 0.4, xb = Math.abs(b - hw) < 1e-6 ? b : b + 0.4, zc = PH + STATION.canopy;
    for (const [s0, s1] of roofs[k]) {
      qz(zc + 0.15, xa, xb, s0, s1, 1, 'canopy', { hex: '#6a7076', g: 0.9 });
      qz(zc, xa, xb, s0, s1, -1, 'canopy', { hex: '#9aa0a7', g: 0.85 });
      for (const [xe, nx] of [[xa, -1], [xb, 1]]) if (Math.abs(Math.abs(xe) - hw) > 1e-6) qx(xe, s0, s1, zc, zc + 0.15, nx, 'canopy-fascia', { hex: line.band, g: 0.9 });
      for (const [se, ns] of [[s0, -1], [s1, 1]]) qs(se, xa, xb, zc, zc + 0.15, ns, 'canopy-fascia', { hex: line.band, g: 0.9 });
      qz(zc - 0.02, lamps[k] - 0.35, lamps[k] + 0.35, s0 + 0.5, s1 - 0.5, -1, 'lamp', { hex: '#f4f8fb', g: 1.6 });
    }
  });
  const covered = (x, s) => P.platforms.some(([a, b], k) => x > a && x < b && roofs[k].some(([p, q]) => s > p + 0.5 && s < q - 0.5));
  // ── the mezzanine across one end over the tracks, its glass balustrade, the stair up to it from the island ──
  let stair = null;
  if (mz) {
    const [m0, m1] = mz, edge = P.mezzanine === '-y' ? m1 : m0, out = P.mezzanine === '-y' ? 1 : -1, up = zM > PH;
    qz(zM, -hw, hw, m0, m1, 1, 'mezzanine', { hex: '#d4d0c6', g: 0.95, texture: 'marble-carrara', ts: 3 });
    qz(zM - STATION.slab, -hw, hw, m0, m1, -1, 'soffit', { hex: '#6a6e74', g: 0.85 });
    qs(edge, -hw, hw, zM - STATION.slab, zM, out, 'steel', { hex: '#8a9096', g: 0.85 });
    if (up) for (const [a, b] of [[-hw, -sw], [sw, hw]]) {
      faces.push({ corners: [[a, edge, zM], [b, edge, zM], [b, edge, zM + 1.1], [a, edge, zM + 1.1]].map((p) => P3(W(p))), fill: 'rgba(185,205,215,0.35)', water: true, doubleSided: true, group: 'station:glass' });
      qz(zM + 1.1, a, b, edge - 0.04, edge + 0.04, 1, 'steel', { hex: '#b4b9be' });
      hold(a, b, edge - 0.05, edge + 0.05, zM, zM + 1.1, `balustrade-${a < 0 ? 'L' : 'R'}`);
    }
    // the stair: from the island up to the mezzanine's edge (or down a well in it to the station house under it), its
    // treads and risers, its sides, its soffit
    const n = nM, rise = (zM - PH) / n, foot = edge + out * n * STATION.going;
    for (let i = 0; i < n; i++) {
      const sA = foot - out * (i + 1) * STATION.going, sB = foot - out * i * STATION.going, zt = PH + (i + 1) * rise;
      qz(zt, -sw, sw, Math.min(sA, sB), Math.max(sA, sB), 1, 'stair', { hex: '#c9c2b4', g: 0.95 });
      if (up) qz(zt + 0.003, -sw, sw, out > 0 ? sB - 0.06 : sB, out > 0 ? sB : sB + 0.06, 1, 'tactile', { hex: '#d8a52a', g: 0.95 });
      else qz(zt + 0.003, -sw, sw, out > 0 ? sA : sA - 0.06, out > 0 ? sA + 0.06 : sA, 1, 'tactile', { hex: '#d8a52a', g: 0.95 });
      if (up) qs(sB, -sw, sw, zt - rise, zt, out, 'stair', { hex: '#a8a296', g: 0.85 });
      else qs(sB, -sw, sw, zt, zt - rise, -out, 'stair', { hex: '#a8a296', g: 0.85 });
      for (const sg of [-1, 1]) if (up) qx(sg * sw, Math.min(sA, sB), Math.max(sA, sB), PH, zt, sg, 'stair-side', { hex: '#8a9096', g: 0.85 });
      else qx(sg * sw, Math.min(sA, sB), Math.max(sA, sB), zt, PH, -sg, 'stair-side', { hex: '#8a9096', g: 0.85 });
    }
    if (up) emit([[-sw, foot, PH], [sw, foot, PH], [sw, edge, zM - STATION.slab], [-sw, edge, zM - STATION.slab]], [0, out * 0.7, -0.7], 'soffit', { hex: '#6a6e74', g: 0.8 });
    else emit([[-sw, foot, PH - 0.4], [sw, foot, PH - 0.4], [sw, edge, zM - 0.4], [-sw, edge, zM - 0.4]], [0, out * 0.7, -0.7], 'soffit', { hex: '#6a6e74', g: 0.8 });
    for (const sg of [-1, 1]) {
      if (up) {
        emit([[sg * (sw + 0.02), foot, PH + 0.9], [sg * (sw + 0.02), edge, zM + 0.9], [sg * (sw + 0.02), edge, zM + 1.0], [sg * (sw + 0.02), foot, PH + 1.0]], [sg, 0, 0], 'steel', { hex: '#b4b9be' });
        hold(sg * sw - 0.05, sg * sw + 0.05, Math.min(foot, edge), Math.max(foot, edge), PH, zM + 1.1, `stair-${sg < 0 ? 'L' : 'R'}`);
        continue;
      }
      // (down: a guard rail along the well on the island, the well held from the station house's floor up; the shaft's
      // side where it hangs under the deck)
      qx(sg * (sw + 0.02), Math.min(foot, edge), Math.max(foot, edge), PH + 0.9, PH + 1.0, sg, 'steel', { hex: '#b4b9be' });
      hold(sg * sw - 0.05, sg * sw + 0.05, Math.min(foot, edge), Math.max(foot, edge), zM, PH + 1.1, `stair-${sg < 0 ? 'L' : 'R'}`);
      const zc = -STATION.deck, t = (zc - (zM - 0.4)) / (PH - zM), sx = edge + (foot - edge) * t;
      emit([[sg * sw, sx, zc], [sg * sw, edge, zc], [sg * sw, edge, zM - 0.4]], [sg, 0, 0], 'house', { hex: '#56616a', g: 0.85 });
    }
    if (!up) {
      // (the well's far end railed on the island; the station house under the mezzanine end: its walls from its floor
      // to the deck, a way out through its side, the stair's well open into it at its edge, its posts to the street)
      qs(edge, -sw, sw, PH + 0.9, PH + 1.0, -out, 'steel', { hex: '#b4b9be' });
      hold(-sw, sw, edge - 0.05, edge + 0.05, PH, PH + STATION.rail, 'well-end');
      const zc = -STATION.deck, far = out > 0 ? m0 : m1, sl = STATION.slab;
      for (const [se, ns] of [[far, -out], [edge, out]]) for (const [xa, xb] of se === edge ? [[-hw, -sw], [sw, hw]] : [[-hw, hw]]) {
        qs(se, xa, xb, zM, zc, -ns, 'house', { hex: '#d9d4c8', g: 0.9 });
        qs(se + ns * 0.3, xa, xb, zM - sl, zc, ns, 'house', { hex: '#56616a', g: 0.85 });
        hold(xa, xb, se, se + ns * 0.3, zM, zc, `house-${se === edge ? 'edge' : 'end'}-${xa < 0 ? 'L' : 'R'}`);
      }
      for (const sg of [-1, 1]) {
        const mine = doors.filter((d) => d.side === sg && Math.abs(d.z0 - zM) < 1e-6), cuts = [...new Set([m0, m1, ...mine.flatMap((d) => [d.s0, d.s1])])].sort((p, q) => p - q);
        for (let i = 0; i + 1 < cuts.length; i++) {
          const s0 = cuts[i], s1 = cuts[i + 1], d = mine.find((q) => q.s0 <= s0 + 1e-6 && q.s1 >= s1 - 1e-6), zb = d ? d.z1 : zM;
          if (d) qz(zM, Math.min(sg * hw, sg * (hw + 0.3)), Math.max(sg * hw, sg * (hw + 0.3)), s0, s1, 1, 'house', { hex: '#c9c2b4', g: 0.92 });
          if (zc - zb < 1e-3) continue;
          qx(sg * hw, s0, s1, zb, zc, -sg, 'house', { hex: '#d9d4c8', g: 0.9 });
          qx(sg * (hw + 0.3), s0, s1, d ? zb : zM - sl, zc, sg, 'house', { hex: '#56616a', g: 0.85 });
          if (d) { qz(zb, Math.min(sg * hw, sg * (hw + 0.3)), Math.max(sg * hw, sg * (hw + 0.3)), s0, s1, -1, 'house', { hex: '#56616a', g: 0.8 }); }
          hold(sg * hw, sg * (hw + 0.3), s0, s1, zb, zc, `house-${sg < 0 ? 'L' : 'R'}-${i}`);
        }
        for (const se of [m0 + 0.3, m1 - 0.3]) box(sg * (hw - 0.3) - 0.2, sg * (hw - 0.3) + 0.2, se - 0.2, se + 0.2, zG, zM - sl, 'pier', { hex: '#56616a', g: 0.85 });
      }
      for (const sg of [-1, 1]) for (const se of [m0 + 0.3, m1 - 0.3]) hold(sg * (hw - 0.3) - 0.2, sg * (hw - 0.3) + 0.2, se - 0.2, se + 0.2, zG, zM - sl, `house-post-${sg < 0 ? 'L' : 'R'}-${Math.round(se * 10)}`);
    }
    stair = { foot, edge, out, n, rise };
  }
  // ── the columns: tiled shafts with a capital, up to the ceiling's beams, or the mezzanine's soffit over them ──
  // (an open station's post: a steel stanchion on the platform, a bracket at its head)
  function post(cx, s, top, of) {
    box(cx - 0.15, cx + 0.15, s - 0.15, s + 0.15, PH, top - 0.12, 'post', { hex: '#56616a', g: 0.9 });
    box(cx - 0.25, cx + 0.25, s - 0.25, s + 0.25, top - 0.12, top, 'post', { hex: '#4a545c', g: 0.85 });
    hold(cx - 0.15, cx + 0.15, s - 0.15, s + 0.15, PH, top, of);
  }
  // (an elevated platform along a parapet: its canopy's posts along it, between the benches)
  if (EL === 'elevated') P.platforms.forEach(([a, b], k) => {
    const px = Math.abs(a + hw) < 1e-6 ? a + 0.3 : Math.abs(b - hw) < 1e-6 ? b - 0.3 : null;
    if (px === null || P.columns.some((cx) => cx > a && cx < b)) return;
    for (let s = STATION.column / 2; s < len - 1; s += STATION.column) if (covered(px, s) && !doors.some((d) => s > d.s0 - 0.5 && s < d.s1 + 0.5)) post(px, s, PH + STATION.canopy, `post-${k}-${s}`);
  });
  for (const cx of P.columns) {
    const base = P.platforms.some(([a, b]) => cx > a && cx < b) ? PH : 0;
    // (open: a column between the tracks holds no roof; one on a platform is its canopy's post)
    if (airy && base === 0) continue;
    for (let s = STATION.column / 2; s < len - 1; s += STATION.column) {
      if (stair && Math.abs(cx) < STATION.stair / 2 + 0.5 && s > Math.min(stair.foot, stair.edge) - 0.5 && s < Math.max(stair.foot, stair.edge) + 0.5) continue;
      const top = mz && EL !== 'elevated' && s > mz[0] && s < mz[1] ? zM - STATION.slab : !airy ? H - 0.5 : covered(cx, s) ? PH + STATION.canopy : null;
      if (top === null) continue;
      if (airy) { post(cx, s, top, `column-${cx}-${s}`); continue; }
      for (const [x0, x1, s0, s1, za, zb, group, o] of [[cx - 0.3, cx + 0.3, s - 0.3, s + 0.3, base, top - 0.3, 'column', { hex: '#d9dddd', g: 0.95, texture: 'tile-white' }], [cx - 0.4, cx + 0.4, s - 0.4, s + 0.4, top - 0.3, top, 'column-cap', { hex: '#9aa0a7', g: 0.9 }]]) box(x0, x1, s0, s1, za, zb, group, o);
      hold(cx - 0.3, cx + 0.3, s - 0.3, s + 0.3, base, top, `column-${cx}-${s}`);
    }
  }
  // ── elevated: its deck's underside (open over the well), a pair of piers on a cross-head every 12 m to the street,
  // clear of the station house ──
  if (EL === 'elevated') {
    const zd = -STATION.deck, X0 = -hw - 0.3, X1 = hw + 0.3, o = { hex: '#46505a', g: 0.8 };
    if (well) { qz(zd, X0, -sw, 0, len, -1, 'deck', o); qz(zd, sw, X1, 0, len, -1, 'deck', o); qz(zd, -sw, sw, 0, well[0], -1, 'deck', o); qz(zd, -sw, sw, well[1], len, -1, 'deck', o); }
    else qz(zd, X0, X1, 0, len, -1, 'deck', o);
    for (let s = 6; s < len; s += 12) {
      if (mz && s > mz[0] - 1 && s < mz[1] + 1) continue;
      for (const cx of [-hw + 0.6, hw - 0.6]) { box(cx - 0.35, cx + 0.35, s - 0.35, s + 0.35, zG, zd - 0.6, 'pier', { hex: '#56616a', g: 0.85 }); hold(cx - 0.35, cx + 0.35, s - 0.35, s + 0.35, zG, zd - 0.6, `pier-${cx < 0 ? 'L' : 'R'}-${s}`); }
      box(X0, X1, s - 0.4, s + 0.4, zd - 0.6, zd, 'pier', { hex: '#4a545c', g: 0.85 });
      qz(zd - 0.6, X0, X1, s - 0.4, s + 0.4, -1, 'pier', { hex: '#3e474e', g: 0.8 });
    }
  }
  // ── on the platforms: benches between the columns, bins beside them, a sign by the way out ──
  const light = makeLight({ direction: [0.18, 0.32, -0.93], ambient: 0.62, diffuse: 0.4 }), items = [];
  const busy = (s) => (stair && s > Math.min(stair.foot, stair.edge) - 1.5 && s < Math.max(stair.foot, stair.edge) + 1.5) || (mz && s > mz[0] - 1 && s < mz[1] + 1) || zones.some(([p, q]) => s > p - 1.5 && s < q + 1.5);
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
    walks: doors.map((d, i) => ways[i]?.port ?? ({ id: d.id ?? `exit-${i}`, kind: 'walk', side: d.side < 0 ? '-x' : '+x', lo: P3([X(d.side * hw), Y(d.s0)]), hi: P3([X(d.side * hw), Y(d.s1)]), plane: r5(X(d.side * hw)), z0: r5(z0 + d.z0), top: r5(d.z1 - d.z0), N: [d.side, 0] })),
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
    up: doors.map((d, k) => {
      const sm = (d.s0 + d.s1) / 2, inside = d.side * (hw - 0.4), w = ways[k];
      // (an open station's way out walked on to its street)
      if (w?.full) return w.full(lanes[P.platforms.findIndex(([a, b]) => (d.side < 0 ? a : b) === d.side * hw)]);
      if (w) return [...upOf(d, sm, inside), ...w.tail];
      return upOf(d, sm, inside);
    }),
  };
  function upOf(d, sm, inside) {
    if (d.z0 === PH) { const lane = lanes[P.platforms.findIndex(([a, b]) => (d.side < 0 ? a : b) === d.side * hw)]; return [pt(lane, sm, PH), pt(inside, sm, PH)]; }
    // (from the island's lane to the stair's foot, up it (or down its well), across the mezzanine to the way out)
    return [pt(lanes[0], stair.foot + stair.out * 3, PH), pt(0, stair.foot + stair.out * 1.2, PH), pt(0, stair.edge - stair.out * 0.6, zM), pt(inside - d.side * 1.2, sm, zM), pt(inside, sm, zM)];
  }
  // (each step cut into a platform's end: its top on the platform, its foot on the track bed at the end wall)
  routes.steps = steps.map((st) => { const x = (st.x0 + st.x1) / 2, sg = st.end === '-y' ? 1 : -1, s0 = st.end === '-y' ? 0 : len; return { end: st.end, top: pt(x, s0 + sg * (RUN + 0.6), PH), foot: pt(x, s0 + sg * 0.15, 0) }; });
  const cameras = [
    { name: 'platform', worldFraming: { cameraPosition: pt(lanes[0], len - 2.5, PH + 1.7), lookAt: pt(lanes[0] * 0.3, len * 0.25, PH + 1.6), horizontalFov: 70 } },
    { name: 'hall', worldFraming: { cameraPosition: pt(-hw + 1, len - 1, H - 0.8), lookAt: pt(hw - 3, len * 0.3, PH), horizontalFov: 75 } },
    ...(gates.length ? [{ name: 'portal', worldFraming: { cameraPosition: pt(gates[0].x, gates[0].s - gates[0].ns * 12, 2.0), lookAt: pt(gates[0].x, gates[0].s, 1.8), horizontalFov: 70 } }] : []),
    ...(mz ? [{ name: 'mezzanine', worldFraming: { cameraPosition: pt(hw - 1.2, (mz[0] + mz[1]) / 2, zM + 1.7), lookAt: EL === 'elevated' ? pt(0, stair.edge, zM + 1) : pt(-hw / 2, P.mezzanine === '-y' ? len * 0.7 : len * 0.3, PH), horizontalFov: 75 } }] : []),
    ...(airy ? [{ name: 'street', worldFraming: EL === 'cut' ? { cameraPosition: pt(hw + 2.5, len * 0.2, zG + 5), lookAt: pt(-hw * 0.3, len * 0.55, PH), horizontalFov: 70 } : { cameraPosition: pt(hw + 18, len * 0.12, zG + 1.7), lookAt: pt(0, len * 0.55, PH + 1), horizontalFov: 70 } }] : []),
  ];
  const wx = EL === 'elevated' ? hw + 2.1 : hw + 0.3, lo = W([-wx, 0, EL === 'elevated' ? zG : 0]), hi = W([wx, len, EL === 'deep' ? H : EL === 'cut' ? zG + STATION.rail : PH + STATION.canopy + 0.15]);
  return {
    id, plan: planId, faces, colliders, ports, routes, cameras, box: { min: P3(lo), max: P3(hi) },
    // (an open station's street: its level, and the cut it stands in, a hole in the street's ground)
    ...(airy ? { street: { z: r5(z0 + zG), hole: EL === 'cut' ? [...P3([X(-hw - 0.3), Y(-0.3)]), ...P3([X(hw + 0.3), Y(len + 0.3)])] : null } } : {}),
    readout: { plan: planId, line: c.line ?? 'blue', length: len, platforms: P.platforms.length, tracks: P.tracks.length, portals: ports.tracks.length, exits: ports.walks.length, tunnel: P.tunnel, ...(train ? { train } : {}), ...(airy ? { elevation: EL, street: r5(z0 + zG) } : {}) },
  };
}

export function assembleStationScene(manifest = {}, ctx = {}) {
  const S = stationOf(manifest.station ?? {}), start = S.routes.platforms[0][0];
  return {
    faces: S.street ? [...streetOf(S), ...S.faces] : S.faces, colliders: S.colliders, cameras: S.cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || manifest.title || 'a station',
    bg: S.street ? '#b9c9d6' : '#0d0f12', walk: { speed: 4.5, spawn: [start[0], start[1], start[2] + 1.7], minEye: 1.7, gravity: 22, radius: 0.3 },
    anchors: [{ id: `station-${S.id}`, kind: 'station', plan: S.plan, ports: S.ports, routes: S.routes }],
    station: S.readout,
  };
}

/** An open station's street on a stage: its ground 40 m round it, open over its cut. */
function streetOf(S) {
  const z = S.street.z, [bx0, by0] = S.box.min, [bx1, by1] = S.box.max, M = 40, [x0, y0, x1, y1] = S.street.hole ?? [bx0, by0, bx0, by0];
  const X0 = bx0 - M, X1 = bx1 + M, Y0 = by0 - M, Y1 = by1 + M;
  const rects = S.street.hole ? [[X0, Y0, X1, y0], [X0, y1, X1, Y1], [X0, y0, x0, y1], [x1, y0, X1, y1]] : [[X0, Y0, X1, Y1]];
  return rects.map(([a, b, c, d]) => ({ corners: [[a, b, z], [c, b, z], [c, d, z], [a, d, z]].map(P3), normal: [0, 0, 1], outNormal: [0, 0, 1], group: 'station:street', fill: '#8a8c86' }));
}
