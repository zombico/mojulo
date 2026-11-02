/**
 * A SUBWAY LINE — stations (network/station.js) in a row under the street, joined by running tunnels (network/
 * passage.js on a `tube` or `rail` section, as the stations' floor plans want), walked from one platform to the next
 * along each tunnel's walkway; each station's way out climbing an inclined stair to a glass pavilion on the street.
 *
 *   { kind: 'stage', subway: { stations: [{ id, plan?, line?, length?, train? }], gap?, depth?, line?, entrances? } }
 *     stations   in order along the line (+y), each a station's settings (a `terminus` only last: its tracks end there)
 *     gap        the running tunnel between two stations (m, 120 by default, 30…600)
 *     depth      the track bed under the street (m, 14 by default, 8…40)
 *     line       the line's colour, each station's unless it names its own
 *     entrances  false: no way up to the street (each station's way out a doorway onto nothing)
 *
 *   readSubway(c) → c, checked (refused by name)
 *   laySubway(c) → { stations, tunnels, entrances }   placed, joined: each tunnel its passage, its walkway's side, and
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
import { stationOf, STATION } from './station.js';
import { STATION_PLANS, STATION_PLAN_IDS, LINES } from './station-plans.js';
import { passageOf } from './passage.js';
import { readSection } from './sections.js';
import { networkLaws } from './laws.js';
import { groundLess } from '../geocity/podium.js';

const r5 = (v) => Math.round(v * 1e5) / 1e5 + 0;
const P3 = (p) => p.map(r5);
const KEYS = ['stations', 'gap', 'depth', 'line', 'entrances'];
const S_KEYS = ['id', 'plan', 'line', 'length', 'train'];
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
    if (!s || typeof s !== 'object') no(`stations[${i}] is { id, plan?, line?, length?, train? }`);
    for (const k of Object.keys(s)) if (!S_KEYS.includes(k)) no(`stations[${i}].${k} is not a setting (${S_KEYS.join(', ')})`);
    if (typeof s.id !== 'string' || ids.has(s.id)) no(`stations[${i}] needs an id of its own`);
    ids.add(s.id);
    if (s.plan !== undefined && !STATION_PLANS[s.plan]) no(`stations[${i}] (${s.id}).plan '${s.plan}' is not a floor plan (${STATION_PLAN_IDS.join(', ')})`);
    const P = STATION_PLANS[s.plan ?? 'island'];
    if (P.ends.length < 2 && i < c.stations.length - 1) no(`${s.id} is a ${s.plan}: its tracks end there, so it is the line's last station`);
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

export function laySubway(c0) {
  const c = readSubway(c0), gap = c.gap ?? 120, depth = c.depth ?? 14, z0 = -depth;
  const plans = c.stations.map((s) => STATION_PLANS[s.plan ?? 'island']), S = readSection(plans[0].tunnel), fits = fitTunnels(plans[0], S);
  // (each station's place along the line, the next a tunnel's length past its end)
  const ys = [];
  let y = 0;
  for (const s of c.stations) { ys.push(y); y += (s.length ?? 72) + gap; }
  const stations = c.stations.map((s, i) => {
    const len = s.length ?? 72, ends = [];
    if (i > 0) ends.push('-y');
    if (i < c.stations.length - 1) ends.push('+y');
    const portals = Object.fromEntries(ends.map((e) => [e, fits.map((f) => f.span)]));
    const steps = ends.flatMap((e) => fits.map((f) => ({ end: e, x0: f.walk[0], x1: f.walk[1] })));
    const { id: sid, ...settings } = s;
    return stationOf({ ...settings, ...(s.line === undefined && c.line !== undefined ? { line: c.line } : {}) }, { id: sid, at: [0, ys[i]], z0, portals, steps });
  });
  // the running tunnels: from each station's +y end to the next's -y end, one a group of tracks
  const over = () => ({ z: 0, under: 'ground' }), tunnels = [];
  for (let i = 0; i + 1 < stations.length; i++) {
    const A = stations[i], B = stations[i + 1], yA = A.box.max[1], yB = B.box.min[1];
    fits.forEach((f, k) => {
      const end = (yy) => ({ z0, lo: [f.span[0], yy], hi: [f.span[1], yy], top: STATION.portal, plane: yy });
      const id = `${A.id}-${B.id}${fits.length > 1 ? `-${k}` : ''}`;
      const T = passageOf({ id, path: [[f.axis, yA], [f.axis, yB]], a: end(yA), b: end(yB), section: S, over, look: { light: 0.4 }, prefix: 'subway', walkSide: f.ws });
      // (its walk: down A's steps, along its walkway, up B's)
      const sa = A.routes.steps.find((q) => q.end === '+y' && Math.abs(q.foot[0] - (f.walk[0] + f.walk[1]) / 2) < 1e-3), sb = B.routes.steps.find((q) => q.end === '-y' && Math.abs(q.foot[0] - (f.walk[0] + f.walk[1]) / 2) < 1e-3);
      tunnels.push({ ...T, a: A.id, b: B.id, axis: f.axis, walkSide: f.ws, walk: [sa.top, sa.foot, ...T.line, sb.foot, sb.top] });
    });
  }
  const entrances = c.entrances === false ? [] : stations.flatMap((St) => St.ports.walks.map((q) => entranceOf(St, q)));
  return { stations, tunnels, entrances, section: S.id, depth, gap };
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

export function assembleSubwayScene(manifest = {}, ctx = {}) {
  const L = laySubway(manifest.subway);
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
  const pass = L.tunnels, S0 = L.stations[0];
  const laws = networkLaws(L.stations.map((s) => ({ id: s.id })), pass, { section: readSection(L.section), prefix: 'subway', noun: 'station' });
  const cameras = [
    ...S0.cameras,
    ...(pass[0] ? [{ name: 'platform-end', worldFraming: { cameraPosition: P3([pass[0].walk[0][0] + 1.2, pass[0].walk[0][1] - 4, pass[0].walk[0][2] + 1.7]), lookAt: P3([pass[0].walk[1][0], pass[0].walk[1][1] + 12, pass[0].walk[1][2] + 1]), horizontalFov: 70 } }] : []),
    ...(pass[0] ? [{ name: 'tunnel', worldFraming: { cameraPosition: P3([pass[0].walk[3][0], pass[0].walk[3][1] + 6, pass[0].walk[3][2] + 1.7]), lookAt: P3([pass[0].axis, pass[0].walk[3][1] + 60, pass[0].walk[3][2] + 1.2]), horizontalFov: 70 } }] : []),
    ...(L.entrances[0] ? [{ name: 'entrance', worldFraming: { cameraPosition: P3([L.entrances[0].door[0] + L.entrances[0].N[0] * 14, L.entrances[0].door[1] - 6, 1.7]), lookAt: P3([L.entrances[0].door[0], L.entrances[0].door[1], 1.6]), horizontalFov: 65 } }, { name: 'stair', worldFraming: { cameraPosition: P3([L.entrances[0].walk[2][0] - L.entrances[0].N[0] * 0.3, L.entrances[0].walk[2][1], 1.7]), lookAt: P3([L.entrances[0].walk[1][0], L.entrances[0].walk[1][1], L.entrances[0].walk[1][2] + 1]), horizontalFov: 70 } }] : []),
  ];
  const start = S0.routes.platforms[0][0];
  return {
    faces: [...street, ...L.stations.flatMap((s) => s.faces), ...pass.flatMap((t) => t.faces), ...L.entrances.flatMap((e) => e.faces)],
    colliders: [...L.stations.flatMap((s) => s.colliders), ...pass.flatMap((t) => t.colliders), ...L.entrances.flatMap((e) => e.colliders)],
    cameras, viewBox: { width: 1280, height: 720 }, title: ctx.title || manifest.title || 'a subway line',
    bg: '#c9d6e0', sky: { zenith: '#6f9ccc', horizon: '#d8e2ea', day: 1, stars: 0, seed: 1, sun: { dir: [0.42, -0.5, 0.76], size: 1.2, glow: 1.1 } },
    walk: { speed: 4.5, spawn: [start[0], start[1], start[2] + 1.7], minEye: 1.7, gravity: 22, radius: 0.3 },
    anchors: [
      ...L.stations.map((s) => ({ id: `station-${s.id}`, kind: 'station', plan: s.plan, ports: s.ports, routes: s.routes })),
      ...pass.map((t) => ({ id: `tunnel-${t.id}`, kind: 'tunnel', from: `station-${t.a}`, to: `station-${t.b}`, length: t.length, walk: t.walk, section: L.section })),
      ...L.entrances.map((e) => ({ id: `entrance-${e.id}`, kind: 'entrance', station: `station-${e.station}`, port: e.port, door: e.door, walk: e.walk })),
    ],
    subway: {
      section: L.section, depth: L.depth, gap: L.gap,
      stations: L.stations.map((s) => s.readout && { id: s.id, ...s.readout }),
      tunnels: pass.map((t) => ({ id: t.id, length: t.length, cover: t.cover, grade: t.grade, walkSide: t.walkSide, ...(t.findings.length ? { findings: t.findings } : {}) })),
      entrances: L.entrances.map((e) => ({ id: e.id, rise: e.rise, steps: e.steps })),
      laws: laws.map((l) => ({ law: l.law, ok: l.ok, value: l.value })),
    },
  };
}
