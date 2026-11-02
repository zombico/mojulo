/**
 * A SUBWAY LINE — stations (network/station.js) in a row under the street, joined by running tunnels (network/
 * passage.js on a `tube` or `rail` section, as the stations' floor plans want), walked from one platform to the next
 * along each tunnel's walkway; each station's way out climbing an inclined stair to a glass pavilion on the street.
 *
 *   { kind: 'stage', subway: { stations: [{ id, plan?, line?, length?, train?, elevation? }], gap?, depth?, line?,
 *     entrances? } }
 *     stations   in order along the line (+y), each a station's settings (a `terminus` only last: its tracks end there);
 *                an `elevation` 'cut' or 'elevated' stands it against the street over its middle (a cut's mezzanine at
 *                the street, an elevated one's station house over it), its ways out at the street (no entrance)
 *     gap        the running tunnel between two stations (m, 120 by default, 30…600), lengthened where the climb
 *                between them wants more at the rail's grade (`gaps`); a run out of or into an open station is laid
 *                open (passage.js `open`): tunnel, cut, grade or viaduct where it lies, the street opened over it
 *     depth      the track bed under the street (m, 14 by default, 8…40)
 *     line       the line's colour, each station's unless it names its own
 *     entrances  false: no way up to the street (each station's way out a doorway onto nothing)
 *
 *   readSubway(c) → c, checked (refused by name)
 *   laySubway(c, { z0?, ground?, entrance?, out? }) → { stations, tunnels, entrances }   `z0` its track bed (else -depth),
 *       one level or each station's own (the tunnels between graded),
 *       `ground(x, y)` the street over it (0), `entrance` 'pavilion' (a glass pavilion out from each way out) or 'sidewalk'
 *       (a stair up along the street to the sidewalk `out` m off its middle); `exits` { <station id>: [{ side, s0, s1,
 *       id }] } each station's ways out (an id `path-…` another network meets: no entrance), `mezzDepth` its mezzanines'   placed, joined: each tunnel its passage, its walkway's side, and
 *       its walk from one platform to the next (`walk`: down the steps cut in the first's platform end, along the
 *       walkway, up the steps of the next's)
 *   assembleSubwayScene(manifest, ctx) → the World payload: the street over it all, each station, each tunnel, each
 *       entrance; cameras, anchors (a `station` a station, a `tunnel` a tunnel, an `entrance` an entrance), `subway`
 *       (its stations, tunnels, entrances and laws: every station reached, cover, grade, run)
 *
 * A running tunnel meets a station's portals: its walkway is laid on the side its platform is on (`walkSide`), its axis
 * where its tracks fall on the stations' (a tube to each track, its walkway toward the island; one box over both tracks
 * of a side-platform station, its walkway under one platform), and the stations' portals are opened to its width and
 * steps are cut in the platform where its walkway meets it. Metres, z up, the street at 0. Pure.
 */
import { stationOf, STATION, ELEVATIONS } from './station.js';
import { STATION_PLANS, STATION_PLAN_IDS, LINES } from './station-plans.js';
import { passageOf } from './passage.js';
import { readSection } from './sections.js';
import { networkLaws } from './laws.js';
import { groundLess } from '../geocity/podium.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const KEYS = ['stations', 'gap', 'depth', 'line', 'entrances', 'tunnels'];
// a teleport's stub: how far a running tunnel runs out of a station before it ends in the dark, and how far short of
// its end its warp's zone stands (m)
const STUB = Object.freeze({ length: 30, zone: 4 });
const S_KEYS = ['id', 'plan', 'line', 'length', 'train', 'elevation'];
// an entrance: its stair's riser and going, its landings at the foot and the head, its head height, the pavilion over
// its head (how far it reaches back down the stair, its height), its width round the stair (m)
const ENTRANCE = Object.freeze({ riser: 0.17, going: 0.3, foot: 2, head: 3, clear: 3, pavilion: 9, tall: 3.4, margin: 1 });
const tint = (hex, g) => `#${[1, 3, 5].map((i) => Math.round(Math.max(0, Math.min(255, parseInt(hex.slice(i, i + 2), 16) * g))).toString(16).padStart(2, '0')).join('')}`;

export function readSubway(c) {
  const no = (m) => { throw new Error(`subway: ${m}`); };
  if (!c || typeof c !== 'object' || Array.isArray(c)) no(`a subway is { ${KEYS.join(', ')} }`);
  for (const k of Object.keys(c)) if (!KEYS.includes(k)) no(`'${k}' is not a setting (${KEYS.join(', ')})`);
  if (!Array.isArray(c.stations) || !c.stations.length) no('stations is a list of at least one station ({ id, plan?, … })');
  const ids = new Set();
  c.stations.forEach((s, i) => {
    if (!s || typeof s !== 'object') no(`stations[${i}] is { id, plan?, line?, length?, train?, elevation? }`);
    for (const k of Object.keys(s)) if (!S_KEYS.includes(k)) no(`stations[${i}].${k} is not a setting (${S_KEYS.join(', ')})`);
    if (typeof s.id !== 'string' || ids.has(s.id)) no(`stations[${i}] needs an id of its own`);
    ids.add(s.id);
    if (s.plan !== undefined && !STATION_PLANS[s.plan]) no(`stations[${i}] (${s.id}).plan '${s.plan}' is not a floor plan (${STATION_PLAN_IDS.join(', ')})`);
    const P = STATION_PLANS[s.plan ?? 'island'];
    if (P.ends.length < 2 && i < c.stations.length - 1) no(`${s.id} is a ${s.plan}: its tracks end there, so it is the line's last station`);
    if (s.elevation !== undefined && !ELEVATIONS.includes(s.elevation)) no(`stations[${i}] (${s.id}).elevation is ${ELEVATIONS.map((e) => `'${e}'`).join(' | ')}`);
  });
  const kinds = new Set(c.stations.map((s) => STATION_PLANS[s.plan ?? 'island'].tunnel));
  if (kinds.size > 1) no(`its stations meet different running tunnels (${c.stations.map((s) => `${s.id}: ${STATION_PLANS[s.plan ?? 'island'].tunnel}`).join(', ')}): a line is all tubes or all boxes`);
  for (let i = 1; i < c.stations.length; i++) {
    const a = STATION_PLANS[c.stations[i - 1].plan ?? 'island'].tracks.map((t) => t.x).join(), b = STATION_PLANS[c.stations[i].plan ?? 'island'].tracks.map((t) => t.x).join();
    if (a !== b) no(`${c.stations[i - 1].id} and ${c.stations[i].id} lay their tracks on different lines: a running tunnel joins tracks that line up`);
  }
  if (c.gap !== undefined && !(Number.isFinite(c.gap) && c.gap >= 30 && c.gap <= 600)) no('gap is 30 to 600 (m)');
  if (c.depth !== undefined && !(Number.isFinite(c.depth) && c.depth >= 8 && c.depth <= 40)) no('depth is 8 to 40 (m)');
  if (c.line !== undefined && !LINES[c.line]) no(`line '${c.line}' is not a line (${Object.keys(LINES).join(', ')})`);
  if (c.entrances !== undefined && typeof c.entrances !== 'boolean') no('entrances is true or false');
  if (c.tunnels !== undefined && !['real', 'teleport'].includes(c.tunnels)) no("tunnels is 'real' (walked from one platform to the next) or 'teleport' (a stub out of each station, a warp to the next's platform, its arrival shown)");
  return c;
}

/**
 * The tracks a running tunnel of section S carries, across it from its walkway's side (`ws` 1 its left, -1 its right),
 * as railFinish lays them; and its walkway's span. For a tunnel along +y its left is -x: a point at v across is at x =
 * axis - v.
 */
function across(S, ws) {
  const hw = S.width / 2, w = 1, free0 = -hw, free1 = hw - w, n = S.profile !== 'vault' && free1 - free0 >= 8 ? 2 : 1, each = (free1 - free0) / n;
  return { tracks: Array.from({ length: n }, (_, i) => ws * (free0 + each * (i + 0.5))), walk: [ws * (hw - w), ws * hw].sort((p, q) => p - q) };
}

/** Each running tunnel between two stations of a plan: its tracks, its axis, its walkway's side and span (the hall's x). */
function fitTunnels(P, S) {
  const groups = P.tunnel === 'tube' ? P.tracks.map((t) => [t.x]) : [P.tracks.map((t) => t.x)];
  return groups.map((xs) => {
    for (const ws of [1, -1]) {
      const A = across(S, ws), vs = A.tracks.slice().sort((p, q) => q - p), X = xs.slice().sort((p, q) => p - q);
      if (vs.length !== X.length) continue;
      // (x = axis - v: the track at the greatest v is the least x)
      const axis = X[0] + vs[0];
      if (X.some((x, i) => Math.abs(axis - vs[i] - x) > 1e-6)) continue;
      const walk = [axis - A.walk[1], axis - A.walk[0]];
      if (!P.platforms.some(([a, b]) => walk[0] >= a - 1e-6 && walk[1] <= b + 1e-6)) continue;
      return { tracks: xs, axis: r5(axis), ws, span: [r5(axis - S.width / 2), r5(axis + S.width / 2)], walk: walk.map(r5) };
    }
    throw new Error(`subway: a ${P.tunnel} cannot carry the tracks at ${xs.join(', ')} with its walkway under a platform`);
  });
}

export function laySubway(c0, { z0: zBed = null, ground = () => 0, entrance = 'pavilion', out = null, kerb = null, exits = {}, mezzDepth } = {}) {
  // (its track bed: one level, or each station's own, the tunnels graded between them)
  const c = readSubway(c0), gap = c.gap ?? 120, depth = c.depth ?? 14, zs = c.stations.map((_, i) => (Array.isArray(zBed) ? zBed[i] : zBed ?? -depth));
  const plans = c.stations.map((s) => STATION_PLANS[s.plan ?? 'island']), S = readSection(plans[0].tunnel), fits = fitTunnels(plans[0], S);
  // (an open station's track bed where its elevation stands it against the street over its middle: a cut's mezzanine at
  // the street, an elevated one's station house over it; the gap to the next lengthened to what the rail's grade wants
  // for the climb between them)
  const openAt = (i) => (c.stations[i].elevation ?? 'deep') !== 'deep';
  const OPEN_BED = { cut: -(STATION.platform + STATION.mezz), elevated: STATION.under + STATION.flight - STATION.platform };
  const ys = [], gaps = [];
  let y = 0;
  c.stations.forEach((s, i) => {
    ys.push(y);
    if (openAt(i)) zs[i] = r5(ground(0, y + (s.length ?? 72) / 2) + OPEN_BED[s.elevation]);
    y += s.length ?? 72;
    if (i + 1 < c.stations.length) {
      const nx = c.stations[i + 1], zn = openAt(i + 1) ? ground(0, y + gap + (nx.length ?? 72) / 2) + OPEN_BED[nx.elevation] : zs[i + 1];
      gaps.push(Math.max(gap, Math.ceil(Math.abs(zn - zs[i]) / S.grade - 1e-9)));
      y += gaps[i];
    }
  });
  const stations = c.stations.map((s, i) => {
    const len = s.length ?? 72, ends = [];
    if (i > 0) ends.push('-y');
    if (i < c.stations.length - 1) ends.push('+y');
    const portals = Object.fromEntries(ends.map((e) => [e, fits.map((f) => f.span)]));
    const steps = ends.flatMap((e) => fits.map((f) => ({ end: e, x0: f.walk[0], x1: f.walk[1] })));
    const { id: sid, ...settings } = s;
    return stationOf({ ...settings, ...(s.line === undefined && c.line !== undefined ? { line: c.line } : {}) }, { id: sid, at: [0, ys[i]], z0: zs[i], portals, steps, ends, ...(exits[sid] ? { exits: exits[sid] } : {}), ...(mezzDepth ? { mezzDepth } : {}), ...(openAt(i) ? { ground: r5(ground(0, ys[i] + len / 2) - zs[i]) } : {}) });
  });
  // the running tunnels: from each station's +y end to the next's -y end, one a group of tracks (or, a teleport's, a
  // stub out of each end into the dark, its warp's zone near its end sending the walker to the next's platform)
  const over = (x, y) => ({ z: ground(x, y), under: 'ground' }), tunnels = [], stubs = [], warps = [];
  if (c.tunnels === 'teleport') for (let i = 0; i + 1 < stations.length; i++) {
    const A = stations[i], B = stations[i + 1], yA = A.box.max[1], yB = B.box.min[1], len = Math.min(STUB.length, (yB - yA - 10) / 2);
    fits.forEach((f, k) => {
      const wx = (f.walk[0] + f.walk[1]) / 2, stepOf = (St, end) => St.routes.steps.find((q) => q.end === end && Math.abs(q.foot[0] - wx) < 1e-3);
      for (const [St, To, y0, dir, endFrom, endTo, zi, zj] of [[A, B, yA, 1, '+y', '-y', zs[i], zs[i + 1]], [B, A, yB, -1, '-y', '+y', zs[i + 1], zs[i]]]) {
        // (its walkway on the same side of the street both ways: a stub run the other way has its left on the other side)
        const id = `${St.id}-to-${To.id}${fits.length > 1 ? `-${k}` : ''}`, yE = y0 + dir * len;
        const a = { z0: zi, lo: [f.span[0], y0], hi: [f.span[1], y0], top: STATION.portal, plane: y0 }, b = { z0: zi, lo: [f.axis, yE], hi: [f.axis, yE], top: 0, plane: yE };
        const T = passageOf({ id, path: [[f.axis, y0], [f.axis, yE]], a, b, section: S, over, look: { light: 0.4 }, prefix: 'subway', walkSide: dir > 0 ? f.ws : -f.ws, ...(openAt(stations.indexOf(St)) ? { open: true } : {}) });
        const sa = stepOf(St, endFrom), sb = stepOf(To, endTo), zone = T.line.filter((p) => Math.abs(p[1] - (yE - dir * STUB.zone)) < 1.01).at(-1) ?? T.line.at(-2);
        const at = [zone[0], yE - dir * STUB.zone, zone[2]];
        // (it sends the walker to the next station's platform end, a step in from its steps' top, on that platform's
        // walking lane (clear of its columns and benches), facing into its hall)
        const lane = To.routes.platforms.map((r) => r[0][0]).sort((p, q) => Math.abs(p - sb.top[0]) - Math.abs(q - sb.top[0]))[0];
        const to = [lane, sb.top[1] + (endTo === '-y' ? 0.6 : -0.6), sb.top[2]];
        stubs.push({ ...T, station: St.id });
        warps.push({ id, from: St.id, to: To.id, at: at.map((v) => Math.round(v * 1e5) / 1e5), spot: to.map((v) => Math.round(v * 1e5) / 1e5), heading: endTo === '-y' ? Math.PI / 2 : -Math.PI / 2, walk: [sa.top, sa.foot, ...T.line.filter((p) => (p[1] - y0) * dir < len - STUB.zone + 0.01), at], then: `arrive:${To.id}` });
      }
    });
  }
  else for (let i = 0; i + 1 < stations.length; i++) {
    const A = stations[i], B = stations[i + 1], yA = A.box.max[1], yB = B.box.min[1];
    fits.forEach((f, k) => {
      const end = (yy, z) => ({ z0: z, lo: [f.span[0], yy], hi: [f.span[1], yy], top: STATION.portal, plane: yy });
      const id = `${A.id}-${B.id}${fits.length > 1 ? `-${k}` : ''}`;
      // (a run out of or into an open station rises out of the ground: tunnel, cut, grade or viaduct where it lies)
      const T = passageOf({ id, path: [[f.axis, yA], [f.axis, yB]], a: end(yA, zs[i]), b: end(yB, zs[i + 1]), section: S, over, look: { light: 0.4 }, prefix: 'subway', walkSide: f.ws, ...(openAt(i) || openAt(i + 1) ? { open: true } : {}) });
      // (its walk: down A's steps, along its walkway, up B's)
      const sa = A.routes.steps.find((q) => q.end === '+y' && Math.abs(q.foot[0] - (f.walk[0] + f.walk[1]) / 2) < 1e-3), sb = B.routes.steps.find((q) => q.end === '-y' && Math.abs(q.foot[0] - (f.walk[0] + f.walk[1]) / 2) < 1e-3);
      tunnels.push({ ...T, a: A.id, b: B.id, axis: f.axis, walkSide: f.ws, walk: [sa.top, sa.foot, ...T.line, sb.foot, sb.top] });
    });
  }
  // (a way out to the street takes an entrance; one another network meets, a `path-` way out, takes none)
  // (an open station's ways out are at the street already)
  const entrances = c.entrances === false ? [] : stations.flatMap((St) => St.ports.walks.filter((q) => !q.id.startsWith('path-') && !q.street).map((q) => (entrance === 'sidewalk' ? sidewalkEntrance(St, q, { out, ground, kerb }) : entranceOf(St, q))));
  return { stations, tunnels, stubs, warps, entrances, section: S.id, depth, gap, mode: c.tunnels ?? 'real', ...(gaps.some((g) => g !== gap) ? { gaps } : {}) };
}

/**
 * A station's way up: from its way out, an inclined stair in its own tiled tunnel straight out from the hall, up to a
 * glass pavilion on the street over its head (the head's landing its floor, the street open under it); its walk from
 * the doorway to the pavement outside the pavilion's door.
 */
function entranceOf(St, q) {
  const id = `${St.id}-${q.id}`, dx = q.N[0], W = Math.abs(q.hi[1] - q.lo[1]), y0 = Math.min(q.lo[1], q.hi[1]), y1 = y0 + W, ym = (y0 + y1) / 2;
  const rise = -q.z0, n = Math.ceil(rise / ENTRANCE.riser - 1e-9), r = rise / n, run = n * ENTRANCE.going;
  const xA = q.plane, xF = xA + dx * ENTRANCE.foot, xT = xF + dx * run, xE = xT + dx * ENTRANCE.head, C = ENTRANCE.clear;
  const faces = [], colliders = [], G = (k) => `subway:entrance-${k}`;
  const emit = (cs, n0, group, hex, g = 1, extra = {}) => {
    const e1 = cs[1].map((v, i) => v - cs[0][i]), e2 = cs[cs.length - 1].map((v, i) => v - cs[0][i]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], flip = cr[0] * n0[0] + cr[1] * n0[1] + cr[2] * n0[2] < 0;
    const P = (flip ? cs.slice().reverse() : cs).map(P3), k = g * (n0[2] > 0.5 ? 1 : n0[2] < -0.5 ? 0.66 : 0.86), fill = tint(hex, k);
    faces.push({ corners: P, normal: P3(n0), outNormal: P3(n0), group, fill, cornerFills: P.map(() => fill), ...extra });
  };
  // (its floor: the foot's landing, each tread and riser, the head's landing at the street)
  emit([[xA, y0, q.z0], [xF, y0, q.z0], [xF, y1, q.z0], [xA, y1, q.z0]], [0, 0, 1], G('floor'), '#c9c2b4', 0.92);
  for (let i = 0; i < n; i++) {
    const a = xF + dx * i * ENTRANCE.going, b = a + dx * ENTRANCE.going, z = q.z0 + (i + 1) * r;
    emit([[a, y0, z - r], [a, y1, z - r], [a, y1, z], [a, y0, z]], [-dx, 0, 0], G('stair'), '#a8a296', 0.85);
    emit([[a, y0, z], [b, y0, z], [b, y1, z], [a, y1, z]], [0, 0, 1], G('stair'), '#c9c2b4', 0.95);
    emit([[a, y0, z + 0.003], [a + dx * 0.06, y0, z + 0.003], [a + dx * 0.06, y1, z + 0.003], [a, y1, z + 0.003]], [0, 0, 1], G('nosing'), '#d8a52a', 0.95);
  }
  emit([[xT, y0, 0], [xE, y0, 0], [xE, y1, 0], [xT, y1, 0]], [0, 0, 1], G('floor'), '#c9c2b4', 0.92);
  // (its walls, tiled: underground from its floor's line to a clear head over it, its ceiling that line raised, a lamp
  // strip down it; under the pavilion, where the street opens over the stair, the stairwell's sides up to the street and
  // a balustrade over them, and a headwall from its ceiling up to the street where the stairwell opens)
  const xB = xT - dx * (ENTRANCE.pavilion - ENTRANCE.head), dist = (x) => (x - xA) * dx;
  const zLine = (x) => { const t = dist(x); return t <= ENTRANCE.foot ? q.z0 : Math.min(0, q.z0 + ((t - ENTRANCE.foot) / ENTRANCE.going) * r); };
  const inside = (x) => dist(x) > dist(xB) + 1e-9, onStair = (x) => dist(x) > ENTRANCE.foot + 1e-9;
  const top = (x) => (inside(x) ? Math.max(Math.min(zLine(x) + C, 0), zLine(x) + 1.1) : zLine(x) + C), bottom = (x) => zLine(x) - (onStair(x) ? r : 0);
  const at = (z) => xF + dx * ((z - q.z0) / r) * ENTRANCE.going;
  const xs0 = [xA, xF, xB, at(-C), at(-1.1), xT].filter((x) => dist(x) >= -1e-9 && dist(x) <= dist(xT) + 1e-9).sort((p, q2) => dist(p) - dist(q2));
  const marks = xs0.filter((x, i) => i === 0 || Math.abs(dist(x) - dist(xs0[i - 1])) > 1e-6);
  for (let k = 0; k + 1 < marks.length; k++) {
    const xa = marks[k], xb = marks[k + 1];
    for (const [yy, ny] of [[y0, 1], [y1, -1]]) {
      const cs = [[xa, yy, bottom(xa + dx * 1e-6)], [xb, yy, bottom(xb - dx * 1e-6)], [xb, yy, top(xb - dx * 1e-6)], [xa, yy, top(xa + dx * 1e-6)]];
      emit(cs, [0, ny, 0], G('wall'), '#e6e8e4', 0.9, { texture: 'tile-subway', textureLit: true, uv: cs.map(([u, , v]) => [r5(u / 1.2), r5(v / 1.2)]) });
    }
    if (inside(xb - dx * 1e-6)) continue;
    const za = zLine(xa) + C, zb = zLine(xb) + C;
    emit([[xa, y0, za], [xb, y0, zb], [xb, y1, zb], [xa, y1, za]], [0, 0, -1], G('ceiling'), '#5d6166', 0.85);
    emit([[xa, ym - 0.3, za - 0.02], [xb, ym - 0.3, zb - 0.02], [xb, ym + 0.3, zb - 0.02], [xa, ym + 0.3, za - 0.02]], [0, 0, -1], G('lamp'), '#f4f8fb', 1.6);
  }
  if (zLine(xB) + C < 0) emit([[xB, y0, zLine(xB) + C], [xB, y1, zLine(xB) + C], [xB, y1, 0], [xB, y0, 0]], [dx, 0, 0], G('wall'), '#55524d', 0.85);
  for (const [yy, side] of [[y0, 'L'], [y1, 'R']]) colliders.push({ min: P3([Math.min(xA, xE), yy - (side === 'L' ? 0.3 : 0), q.z0]), max: P3([Math.max(xA, xE), yy + (side === 'R' ? 0.3 : 0), C + ENTRANCE.tall]), of: `${id}:wall-${side}` });
  // (the handrails: steel along each wall, a stair's height over its treads' line)
  for (const yy of [y0 + 0.06, y1 - 0.06]) emit([[xF, yy, q.z0 + 0.9], [xT, yy, 0.9], [xT, yy, 1.0], [xF, yy, q.z0 + 1.0]], [0, yy < ym ? 1 : -1, 0], G('steel'), '#b4b9be', 1);
  // the pavilion: glass on a steel frame over the stair's head, its door open on the street, its roof
  const p0 = xT - dx * (ENTRANCE.pavilion - ENTRANCE.head), xs = [Math.min(p0, xE), Math.max(p0, xE)], ys = [y0 - ENTRANCE.margin, y1 + ENTRANCE.margin], T = ENTRANCE.tall;
  const glass = (cs) => faces.push({ corners: cs.map(P3), fill: 'rgba(170,200,214,0.32)', water: true, doubleSided: true, group: G('glass') });
  for (const yy of ys) glass([[xs[0], yy, 0], [xs[1], yy, 0], [xs[1], yy, T], [xs[0], yy, T]]);
  // (its back over the stair, glass; its front a doorway the stair's width, glass either side of it)
  const back = dx > 0 ? xs[0] : xs[1], front = dx > 0 ? xs[1] : xs[0];
  glass([[back, ys[0], 0], [back, ys[1], 0], [back, ys[1], T], [back, ys[0], T]]);
  for (const [a, b] of [[ys[0], y0], [y1, ys[1]]]) glass([[front, a, 0], [front, b, 0], [front, b, T], [front, a, T]]);
  glass([[front, y0, 2.6], [front, y1, 2.6], [front, y1, T], [front, y0, T]]);
  emit([[xs[0], ys[0], T], [xs[1], ys[0], T], [xs[1], ys[1], T], [xs[0], ys[1], T]], [0, 0, 1], G('roof'), '#4a4f55', 0.9);
  emit([[xs[0], ys[0], T - 0.02], [xs[1], ys[0], T - 0.02], [xs[1], ys[1], T - 0.02], [xs[0], ys[1], T - 0.02]], [0, 0, -1], G('roof'), '#8a9096', 0.85);
  for (const xx of xs) for (const yy of ys) emit([[xx - 0.06, yy, 0], [xx + 0.06, yy, 0], [xx + 0.06, yy, T], [xx - 0.06, yy, T]], [0, yy === ys[0] ? -1 : 1, 0], G('steel'), '#5d636a', 0.9);
  // (a band of the line's colour round its eaves, a roundel over its door)
  for (const yy of ys) emit([[xs[0], yy, T - 0.35], [xs[1], yy, T - 0.35], [xs[1], yy, T], [xs[0], yy, T]], [0, yy === ys[0] ? -1 : 1, 0], G('band'), LINES[St.readout.line]?.band ?? '#2f6fb0', 0.95);
  for (const [a, b] of [[ys[0], y0], [y1, ys[1]]]) colliders.push({ min: P3([Math.min(...xs), Math.min(a, b) - 0.05, 0]), max: P3([Math.max(...xs), Math.max(a, b) + 0.05, T]), of: `${id}:pavilion-${a}` });
  colliders.push({ min: P3([back - 0.05, ys[0], 0]), max: P3([back + 0.05, ys[1], T]), of: `${id}:pavilion-back` });
  const footprint = [xs[0], ys[0], xs[1], ys[1]].map(r5), well = [Math.min(xB, xE), y0, Math.max(xB, xE), y1].map(r5);
  const walk = [P3([xA - dx * 0.4, ym, q.z0]), P3([xF - dx * 0.3, ym, q.z0]), P3([xT + dx * 0.3, ym, 0]), P3([front + dx * 3, ym, 0])];
  return { id, station: St.id, port: q.id, faces, colliders, footprint, well, walk, door: P3([front, ym, 0]), N: [dx, 0], rise: r5(rise), steps: n };
}

/**
 * A station's way up to the SIDEWALK of the street it lies under: from its way out, a level cross passage out under the
 * sidewalk `out` m off the line's middle, then a stair turning along the street up to it (toward the station's middle),
 * its well open in the walk behind railings, a post with the line's roundel at its head; its walk from the doorway onto
 * the sidewalk past the stair's head. `ground(x, y)` the walk's level. The hall's frame (x across, y along).
 */
function sidewalkEntrance(St, q, { out, ground, kerb = null }) {
  const id = `${St.id}-${q.id}`, sx = Math.sign(q.N[0]) || 1, Wp = Math.abs(q.hi[1] - q.lo[1]), y0 = Math.min(q.lo[1], q.hi[1]), y1 = y0 + Wp, C = ENTRANCE.clear;
  const Ws = 2.4, xs = sx * out, xa = q.plane, xb = xs + sx * (Ws / 2), xw0 = xs - Ws / 2, xw1 = xs + Ws / 2;
  // (it climbs toward the station's middle: from the way out's far side along the street)
  const mid = (St.box.min[1] + St.box.max[1]) / 2, dir = (y0 + y1) / 2 < mid ? 1 : -1, yF = dir > 0 ? y1 : y0;
  // (its rise to the walk at its head, the head found again as the rise settles its run)
  let n = 1, r = 0.17, gh = ground(xs, yF);
  for (let k = 0; k < 4; k++) { const rise = gh - q.z0; n = Math.ceil(rise / ENTRANCE.riser - 1e-9); r = rise / n; gh = ground(xs, yF + dir * (n * ENTRANCE.going + 0.5)); }
  const run = n * ENTRANCE.going, yH = yF + dir * run;
  const faces = [], colliders = [], G = (k) => `subway:entrance-${k}`;
  const emit = (cs, n0, group, hex, g = 1, extra = {}) => {
    const e1 = cs[1].map((v, i) => v - cs[0][i]), e2 = cs[cs.length - 1].map((v, i) => v - cs[0][i]);
    const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]], flip = cr[0] * n0[0] + cr[1] * n0[1] + cr[2] * n0[2] < 0;
    const P = (flip ? cs.slice().reverse() : cs).map(P3), k = g * (n0[2] > 0.5 ? 1 : n0[2] < -0.5 ? 0.66 : 0.86), fill = tint(hex, k);
    faces.push({ corners: P, normal: P3(n0), outNormal: P3(n0), group, fill, cornerFills: P.map(() => fill), ...extra });
  };
  const tile = (cs, nrm) => emit(cs, nrm, G('wall'), '#e6e8e4', 0.9, { texture: 'tile-subway', textureLit: true, uv: cs.map(([u, v, w]) => [r5((Math.abs(nrm[0]) > 0.5 ? v : u) / 1.2), r5(w / 1.2)]) });
  // the cross passage: level from the way out to the stair's far wall, its floor, ceiling, lamp and walls
  const [xl, xr] = [Math.min(xa, xb), Math.max(xa, xb)], zc = q.z0 + C;
  emit([[xl, y0, q.z0], [xr, y0, q.z0], [xr, y1, q.z0], [xl, y1, q.z0]], [0, 0, 1], G('floor'), '#c9c2b4', 0.92);
  emit([[xl, y0, zc], [xr, y0, zc], [xr, y1, zc], [xl, y1, zc]], [0, 0, -1], G('ceiling'), '#5d6166', 0.85);
  emit([[xl, (y0 + y1) / 2 - 0.3, zc - 0.02], [xr, (y0 + y1) / 2 - 0.3, zc - 0.02], [xr, (y0 + y1) / 2 + 0.3, zc - 0.02], [xl, (y0 + y1) / 2 + 0.3, zc - 0.02]], [0, 0, -1], G('lamp'), '#f4f8fb', 1.6);
  // (its walls: the side away from the stair whole; the stair's side up to where the stair leaves it; its far end)
  const back = dir > 0 ? y0 : y1, front = dir > 0 ? y1 : y0;
  tile([[xl, back, q.z0], [xr, back, q.z0], [xr, back, zc], [xl, back, zc]], [0, dir, 0]);
  const [fa, fb] = sx > 0 ? [xl, xw0] : [xw1, xr];
  if (Math.abs(fb - fa) > 1e-3) tile([[fa, front, q.z0], [fb, front, q.z0], [fb, front, zc], [fa, front, zc]], [0, -dir, 0]);
  tile([[xb, y0, q.z0], [xb, y1, q.z0], [xb, y1, zc], [xb, y0, zc]], [-sx, 0, 0]);
  colliders.push({ min: P3([xl, Math.min(back, back - dir * 0.3), q.z0]), max: P3([xr, Math.max(back, back - dir * 0.3), zc]), of: `${id}:cross-back` });
  colliders.push({ min: P3([Math.min(xb, xb + sx * 0.3), y0, q.z0]), max: P3([Math.max(xb, xb + sx * 0.3), y1, zc]), of: `${id}:cross-end` });
  // the stair along the street: its treads and risers from the cross passage up to the walk
  for (let i = 0; i < n; i++) {
    const a = yF + dir * i * ENTRANCE.going, b = a + dir * ENTRANCE.going, z = q.z0 + (i + 1) * r;
    emit([[xw0, a, z - r], [xw1, a, z - r], [xw1, a, z], [xw0, a, z]], [0, -dir, 0], G('stair'), '#a8a296', 0.85);
    emit([[xw0, a, z], [xw1, a, z], [xw1, b, z], [xw0, b, z]], [0, 0, 1], G('stair'), '#c9c2b4', 0.95);
    emit([[xw0, a, z + 0.003], [xw1, a, z + 0.003], [xw1, a + dir * 0.06, z + 0.003], [xw0, a + dir * 0.06, z + 0.003]], [0, 0, 1], G('nosing'), '#d8a52a', 0.95);
  }
  // (its walls tiled, its ceiling the treads' line raised, closed to where it nears the walk, its well open over it from
  // there: the well's sides to the walk, a headwall from the ceiling up to the walk where it opens)
  // (open from where its ceiling would come within 0.4 m of the walk: under a kerb's height and more, so no part of it
  // shows under a raised walk's edge)
  const zLine = (y) => q.z0 + Math.max(0, Math.min(n, ((y - yF) * dir) / ENTRANCE.going)) * r, yOpen = yF + dir * Math.max(0, ((gh - 0.4 - C - q.z0) / r) * ENTRANCE.going);
  const yS = [yF, yOpen, yH].sort((p, q2) => (p - q2) * dir);
  for (let k = 0; k + 1 < yS.length; k++) {
    const ya = yS[k], yb = yS[k + 1], open = k === 1;
    if (Math.abs(yb - ya) < 1e-6) continue;
    const top = (y) => (open ? gh : zLine(y) + C), bot = (y) => zLine(y) - r;
    for (const [xx, nx] of [[xw0, 1], [xw1, -1]]) tile([[xx, ya, bot(ya)], [xx, yb, bot(yb)], [xx, yb, top(yb)], [xx, ya, top(ya)]], [nx, 0, 0]);
    if (!open) {
      emit([[xw0, ya, zLine(ya) + C], [xw1, ya, zLine(ya) + C], [xw1, yb, zLine(yb) + C], [xw0, yb, zLine(yb) + C]], [0, 0, -1], G('ceiling'), '#5d6166', 0.85);
      emit([[xs - 0.3, ya, zLine(ya) + C - 0.02], [xs + 0.3, ya, zLine(ya) + C - 0.02], [xs + 0.3, yb, zLine(yb) + C - 0.02], [xs - 0.3, yb, zLine(yb) + C - 0.02]], [0, 0, -1], G('lamp'), '#f4f8fb', 1.6);
    }
  }
  if (zLine(yOpen) + C < gh) emit([[xw0, yOpen, zLine(yOpen) + C], [xw1, yOpen, zLine(yOpen) + C], [xw1, yOpen, gh], [xw0, yOpen, gh]], [0, dir, 0], G('wall'), '#55524d', 0.85);
  for (const xx of [xw0, xw1]) colliders.push({ min: P3([xx - (xx === xw0 ? 0.3 : 0), Math.min(yF, yH), q.z0]), max: P3([xx + (xx === xw1 ? 0.3 : 0), Math.max(yF, yH), gh + 1.1]), of: `${id}:stair-${xx === xw0 ? 'L' : 'R'}` });
  for (const xx of [xw0 + 0.06, xw1 - 0.06]) emit([[xx, yF, q.z0 + 0.9], [xx, yH, gh + 0.9], [xx, yH, gh + 1.0], [xx, yF, q.z0 + 1.0]], [xx < xs ? 1 : -1, 0, 0], G('steel'), '#b4b9be', 1);
  // the railings round its well on the walk (its sides and its back, its head open), a post with the line's roundel
  const band = LINES[St.readout.line]?.band ?? '#2f6fb0', rails = [[[xw0, yOpen], [xw0, yH]], [[xw1, yOpen], [xw1, yH]], [[xw0, yOpen], [xw1, yOpen]]];
  for (const [[ax, ay], [bx, by]] of rails) {
    // (a top rail and a mid rail on posts every metre or so: open, the stair seen through it)
    const nrm = ax === bx ? [1, 0, 0] : [0, 1, 0], L0 = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.round(L0 / 1.1));
    for (const [z0, z1] of [[0.95, 1.05], [0.48, 0.54]]) emit([[ax, ay, gh + z0], [bx, by, gh + z0], [bx, by, gh + z1], [ax, ay, gh + z1]], nrm, G('railing'), '#2e3236', 1);
    for (let k = 0; k <= m; k++) { const t = k / m, px = ax + (bx - ax) * t, py = ay + (by - ay) * t, ux = ax === bx ? 0 : 0.03, uy = ax === bx ? 0.03 : 0; emit([[px - ux, py - uy, gh], [px + ux, py + uy, gh], [px + ux, py + uy, gh + 1.05], [px - ux, py - uy, gh + 1.05]], nrm, G('railing'), '#2e3236', 1); }
  }
  const post = [xw1 + sx * 0.35, yH - dir * 0.4];
  emit([[post[0] - 0.06, post[1], gh], [post[0] + 0.06, post[1], gh], [post[0] + 0.06, post[1], gh + 3.2], [post[0] - 0.06, post[1], gh + 3.2]], [0, -dir, 0], G('steel'), '#2e3236', 1);
  for (const [rr, hex] of [[0.38, band], [0.24, '#f2efe6']]) emit(Array.from({ length: 16 }, (_, k) => { const a = (2 * Math.PI * k) / 16; return [post[0] + rr * Math.cos(a), post[1] - dir * (0.02 + (rr < 0.3 ? 0.01 : 0)), gh + 3.5 + rr * Math.sin(a)]; }), [0, -dir, 0], G('roundel'), hex, 1.1);
  colliders.push({ min: P3([xw0 - 0.05, Math.min(yOpen, yOpen - dir * 0.05), gh]), max: P3([xw1 + 0.05, Math.max(yOpen, yOpen - dir * 0.05), gh + 1.05]), of: `${id}:railing-back` });
  // (the walk's kerb along the stair's run, its face down to the road: nothing under the walk shows under its edge)
  if (kerb) {
    const xk = sx * kerb.at, ya = Math.min(yF, yH) - 2, yb = Math.max(yF, yH) + 2;
    emit([[xk, ya, ground(xk, ya) - kerb.h], [xk, yb, ground(xk, yb) - kerb.h], [xk, yb, ground(xk, yb)], [xk, ya, ground(xk, ya)]], [-sx, 0, 0], G('kerb'), '#a29e96', 0.9);
  }
  const well = [xw0, Math.min(yOpen, yH), xw1, Math.max(yOpen, yH)].map(r5), ym = (y0 + y1) / 2;
  const walk = [P3([xa - sx * 0.4, ym, q.z0]), P3([xs, ym, q.z0]), P3([xs, yF - dir * 0.3, q.z0]), P3([xs, yH + dir * 0.4, gh]), P3([xs, yH + dir * 2.5, gh])];
  return { id, station: St.id, port: q.id, faces, colliders, footprint: well, well, walk, door: P3([xs, yH, gh]), N: [0, dir], rise: r5(gh - q.z0), steps: n };
}

// (a line laid once a recipe: its level's lowering and its scene both read it)
const LAID = new Map();
const laid = (c) => { const k = JSON.stringify(c); if (!LAID.has(k)) { if (LAID.size >= 4) LAID.delete(LAID.keys().next().value); LAID.set(k, laySubway(c)); } return LAID.get(k); };

/**
 * A line as a LEVEL (structure/level.js lowers a stage recipe's `subway` with a `level` by it): started on its first
 * station's platform, won on the street outside its last station's entrance (or at its way out, without entrances);
 * between them, along each platform to its end, down the steps, through the running tunnel to the next (or, a
 * teleport's, along the stub to its warp: the walker stood on the next platform, its arrival shown); the route the
 * audit walks; each arrival a scene, a shot over `player`'s shoulder down the platform it comes out on.
 * → { spawn, heading, goal, route, warps (mechanics), spots, scenes }
 *   levelOfLine(L, { player }) → the same from a line already laid (laySubway's), in its frame
 */
export function subwayLevel(manifest, { player = 'player' } = {}) {
  return levelOfLine(laid(manifest.subway), { player });
}

/** A laid line's level (laySubway's), in its own frame: what subwayLevel lowers, and a city's line turned into its own. */
export function levelOfLine(L, { player = 'player' } = {}) {
  const S0 = L.stations[0], last = L.stations[L.stations.length - 1];
  const lane0 = S0.routes.platforms[0], route = [lane0[0]];
  let at = lane0[0];
  // (from where it stands to a point on a platform, along that platform's lane first, then across to it)
  const along = (St, p) => { const lane = St.routes.platforms.map((r) => r[0][0]).sort((a, b) => Math.abs(a - p[0]) - Math.abs(b - p[0]))[0]; route.push([lane, at[1], at[2]], [lane, p[1], p[2]], p); at = p; };
  for (let i = 0; i + 1 < L.stations.length; i++) {
    const A = L.stations[i], B = L.stations[i + 1];
    if (L.mode === 'teleport') {
      const w = L.warps.find((x) => x.from === A.id && x.to === B.id);
      along(A, w.walk[0]);
      route.push(...w.walk.slice(1), w.spot);
      at = w.spot;
    } else {
      const t = L.tunnels.find((x) => x.a === A.id && x.b === B.id);
      along(A, t.walk[0]);
      route.push(...t.walk.slice(1));
      at = t.walk[t.walk.length - 1];
    }
  }
  // (on the last platform to the way out to the street from the platform it is on, up it, and up its entrance)
  const outs = last.routes.up.map((u, k) => ({ u, q: last.ports.walks[k] })).filter((c) => !c.q.id.startsWith('path-')).sort((a, b) => Math.abs(a.u[0][0] - at[0]) - Math.abs(b.u[0][0] - at[0]));
  const up = outs[0].u, ent = L.entrances.find((e) => e.station === last.id && e.port === outs[0].q.id);
  along(last, up[0]);
  route.push(...up.slice(1), ...(ent ? ent.walk.slice(1) : []));
  const goal = route[route.length - 1];
  const warps = L.warps.map((w) => ({ kind: 'warp', at: w.at, to: w.spot, then: w.then, radius: 1.4 }));
  // (each arrival shown: a wide shot on where the walker is stood, held a moment)
  // (one a station arrived at: its tracks' warps say the same arrival)
  const arrivals = [...new Map(L.warps.map((w) => [w.then, w])).values()];
  // (and a spot down the platform from it, 18 m into the hall: the arrival framed against where it leads)
  const spots = arrivals.flatMap((w) => [
    { id: `arrive-${w.to}-from-${w.from}`, at: [w.spot[0], w.spot[1], w.spot[2]], face: Math.round((w.heading * 180) / Math.PI) },
    { id: `onward-${w.to}-from-${w.from}`, at: [w.spot[0], w.spot[1] + Math.sin(w.heading) * 18, w.spot[2]], face: Math.round((w.heading * 180) / Math.PI) },
  ]);
  // (the arrival shown over the walker's shoulder, down the platform it has come out on: a lone spot or a wide frame
  // stands its camera outside the hall)
  const scenes = arrivals.map((w) => ({ id: `arrive-${w.to}-from-${w.from}`, when: { on: w.then }, once: false, beats: [{ shot: { frame: 'over', on: [`onward-${w.to}-from-${w.from}`, player] }, for: 2.5 }] }));
  return { spawn: lane0[0], heading: Math.PI / 2, goal, route: route.map((p) => p.map((v) => Math.round(v * 1e5) / 1e5)), warps, spots, scenes };
}

export function assembleSubwayScene(manifest = {}, ctx = {}) {
  const L = laid(manifest.subway);
  // the street over it all, in cells, cut where a pavilion stands
  const xs = [...L.stations.flatMap((s) => [s.box.min[0], s.box.max[0]]), ...L.entrances.flatMap((e) => [e.footprint[0], e.footprint[2]])], ys = L.stations.flatMap((s) => [s.box.min[1], s.box.max[1]]);
  const site = [Math.min(...xs) - 30, Math.min(...ys) - 30, Math.max(...xs) + 30, Math.max(...ys) + 30].map(r5);
  let street = [];
  for (let x = site[0]; x < site[2] - 1e-6; x += 10) for (let y = site[1]; y < site[3] - 1e-6; y += 10) {
    const q = [x, y, Math.min(x + 10, site[2]), Math.min(y + 10, site[3])];
    street.push({ corners: [[q[0], q[1], 0], [q[2], q[1], 0], [q[2], q[3], 0], [q[0], q[3], 0]].map(P3), normal: [0, 0, 1], outNormal: [0, 0, 1], group: 'subway:street', fill: '#7d7b77', cornerFills: Array(4).fill('#7d7b77') });
  }
  for (const e of L.entrances) {
    // (the street open over the stairwell and its landing under the pavilion: the stair climbs out of the ground there)
    street = street.flatMap((f) => groundLess(f, e.well));
  }
  // (and over a cut: a station's, a run's where it lies open at or under the street)
  for (const hole of [...L.stations.map((s) => s.street?.hole).filter(Boolean), ...[...L.tunnels, ...L.stubs].flatMap((t) => t.openings ?? [])]) street = street.flatMap((f) => groundLess(f, hole));
  const pass = L.tunnels, S0 = L.stations[0];
  // (a teleport's stations joined by their warps; its stubs measured for their cover and grade as tunnels are)
  const joins = [...pass, ...L.stubs.map((t) => ({ ...t, a: t.station, b: t.station })), ...L.warps.map((w) => ({ a: w.from, b: w.to, cover: Infinity, slab: Infinity, grade: 0, length: 0 }))];
  const laws = networkLaws(L.stations.map((s) => ({ id: s.id })), joins, { section: readSection(L.section), prefix: 'subway', noun: 'station' });
  const cameras = [
    ...S0.cameras,
    // (a teleport's: into its stub from the platform's end)
    ...(!pass[0] && L.warps[0] ? [{ name: 'platform-end', worldFraming: { cameraPosition: P3([L.warps[0].walk[0][0] + 1.2, L.warps[0].walk[0][1] - Math.sign(L.warps[0].at[1] - L.warps[0].walk[0][1]) * 4, L.warps[0].walk[0][2] + 1.7]), lookAt: P3([L.warps[0].at[0], L.warps[0].at[1], L.warps[0].at[2] + 1]), horizontalFov: 70 } }] : []),
    ...(pass[0] ? [{ name: 'platform-end', worldFraming: { cameraPosition: P3([pass[0].walk[0][0] + 1.2, pass[0].walk[0][1] - 4, pass[0].walk[0][2] + 1.7]), lookAt: P3([pass[0].walk[1][0], pass[0].walk[1][1] + 12, pass[0].walk[1][2] + 1]), horizontalFov: 70 } }] : []),
    ...(pass[0] ? [{ name: 'tunnel', worldFraming: { cameraPosition: P3([pass[0].walk[3][0], pass[0].walk[3][1] + 6, pass[0].walk[3][2] + 1.7]), lookAt: P3([pass[0].axis, pass[0].walk[3][1] + 60, pass[0].walk[3][2] + 1.2]), horizontalFov: 70 } }] : []),
    // (an open station seen from its street; a run that rises out of the ground seen from beside it)
    ...L.stations.flatMap((s) => s.cameras.filter((q) => q.name === 'street').map((q) => ({ ...q, name: `street-${s.id}` }))),
    ...pass.filter((t) => t.runs && t.runs.viaduct > 0 && t.runs.tunnel + t.runs.cut > 0).slice(0, 1).map((t) => { const up = t.line.at(-1)[2] > t.line[0][2], yg = up ? t.line[0][1] + t.runs.tunnel + t.runs.cut : t.line.at(-1)[1] - t.runs.tunnel - t.runs.cut, d = up ? 1 : -1; return { name: 'rise', worldFraming: { cameraPosition: P3([t.axis + 16, yg - d * 45, 2.5]), lookAt: P3([t.axis, yg + d * 50, 2]), horizontalFov: 70 } }; }),
    ...(L.entrances[0] ? [{ name: 'entrance', worldFraming: { cameraPosition: P3([L.entrances[0].door[0] + L.entrances[0].N[0] * 14, L.entrances[0].door[1] - 6, 1.7]), lookAt: P3([L.entrances[0].door[0], L.entrances[0].door[1], 1.6]), horizontalFov: 65 } }, { name: 'stair', worldFraming: { cameraPosition: P3([L.entrances[0].walk[2][0] - L.entrances[0].N[0] * 0.3, L.entrances[0].walk[2][1], 1.7]), lookAt: P3([L.entrances[0].walk[1][0], L.entrances[0].walk[1][1], L.entrances[0].walk[1][2] + 1]), horizontalFov: 70 } }] : []),
  ];
  const start = S0.routes.platforms[0][0];
  return {
    faces: [...street, ...L.stations.flatMap((s) => s.faces), ...pass.flatMap((t) => t.faces), ...L.stubs.flatMap((t) => t.faces), ...L.entrances.flatMap((e) => e.faces)],
    colliders: [...L.stations.flatMap((s) => s.colliders), ...pass.flatMap((t) => t.colliders), ...L.stubs.flatMap((t) => t.colliders), ...L.entrances.flatMap((e) => e.colliders)],
    cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || manifest.title || 'a subway line',
    bg: '#c9d6e0', sky: { zenith: '#6f9ccc', horizon: '#d8e2ea', day: 1, stars: 0, seed: 1, sun: { dir: [0.42, -0.5, 0.76], size: 1.2, glow: 1.1 } },
    walk: { speed: 4.5, spawn: [start[0], start[1], start[2] + 1.7], minEye: 1.7, gravity: 22, radius: 0.3 },
    anchors: [
      ...L.stations.map((s) => ({ id: `station-${s.id}`, kind: 'station', plan: s.plan, ports: s.ports, routes: s.routes })),
      ...pass.map((t) => ({ id: `tunnel-${t.id}`, kind: 'tunnel', from: `station-${t.a}`, to: `station-${t.b}`, length: t.length, walk: t.walk, section: L.section })),
      ...L.entrances.map((e) => ({ id: `entrance-${e.id}`, kind: 'entrance', station: `station-${e.station}`, port: e.port, door: e.door, walk: e.walk })),
      ...L.warps.map((w) => ({ id: `warp-${w.id}`, kind: 'warp', from: `station-${w.from}`, to: `station-${w.to}`, at: w.at, spot: w.spot, heading: w.heading, walk: w.walk })),
    ],
    subway: {
      section: L.section, depth: L.depth, gap: L.gap, ...(L.gaps ? { gaps: L.gaps } : {}), tunnels: L.mode,
      stations: L.stations.map((s) => s.readout && { id: s.id, ...s.readout }),
      ...(L.warps.length ? { warps: L.warps.map((w) => ({ id: w.id, from: w.from, to: w.to })) } : {}),
      runs: pass.map((t) => ({ id: t.id, length: t.length, cover: t.cover, grade: t.grade, walkSide: t.walkSide, ...(t.runs ? { spans: t.runs } : {}), ...(t.findings.length ? { findings: t.findings } : {}) })),
      entrances: L.entrances.map((e) => ({ id: e.id, rise: e.rise, steps: e.steps })),
      laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
    },
  };
}
