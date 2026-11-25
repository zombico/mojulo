/**
 * A SPACE MAP'S FLEET — capital ships and stations laid in a space level (`space.fleet`), each built off the fleet
 * (fleet/build.js: its pieces plated in the fleet's language) and set where the mission put it: in the frame of the
 * pilot's start, as a sortie's groups are (flight-sortie.js `at`), so a mission designed on the holo table
 * (campaign/briefing.js) is flown with everything where the briefing showed it.
 *
 *   space.fleet: [{ id, capital?: <class> | station?: <kind>, at: { ahead?, side?, up? }, heading?, seed? }]
 *     at        metres from the pilot's start: along its heading, to its right, up
 *     heading   degrees clockwise from the start's heading (0: its bow the way the pilot faces); any heading, not only a
 *               quarter turn: in a level a ship is scenery and cover, its pieces drawn turned and its colliders the
 *               boxes round them (the quarter-turn blocks of destructible physics are placeFleet's, for rupa)
 *
 *   readSpaceFleet(v, at?)             → errors (strings)
 *   fleetWorld(list, seat)             → [{ id, kind, center, radius }]   where each stands in the world (the rocks keep clear)
 *   layFleet(list, seat, { sun })      → { faces, colliders, cameras, report }   faces shaded under the map's star, each
 *                                        ship's faces its own group (`fleet:<id>`); its pieces' boxes as colliders (the
 *                                        rounds a ship stops: combat's line of fire); a bookmark on each
 *   toward(seat, { bearing, elevation }) → a unit direction in the world, from the start's frame (the backdrop's moon)
 *
 * Pure: the same fleet and seat, the same ships.
 */
import { buildCapital, buildStation } from '../fleet/build.js';
import { CAPITAL_CLASSES, STATION_KINDS } from '../fleet/classes.js';
import { shade } from '../fleet/language.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;
const DEG = Math.PI / 180;
const KEYS = ['id', 'capital', 'station', 'at', 'heading', 'seed'];

export function readSpaceFleet(v, at = 'space.fleet') {
  if (!Array.isArray(v)) return [`${at} is a list: [{ id, capital | station, at: { ahead?, side?, up? }, heading?, seed? }]`];
  const e = [], seen = new Set();
  v.forEach((s, k) => {
    const w = `${at}[${k}]`;
    if (!isObj(s)) { e.push(`${w} is { id, capital | station, at, heading?, seed? }`); return; }
    for (const f of Object.keys(s)) if (!KEYS.includes(f)) e.push(`${w}.${f} is not a fleet ship's (${KEYS.join(', ')})`);
    if (typeof s.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(s.id) || seen.has(s.id)) e.push(`${w}.id is a short name, once`);
    seen.add(s.id);
    if ((s.capital === undefined) === (s.station === undefined)) e.push(`${w} is a capital ship (capital: ${Object.keys(CAPITAL_CLASSES).join(' | ')}) or a station (station: ${Object.keys(STATION_KINDS).join(' | ')}), one of them`);
    else if (s.capital !== undefined && !CAPITAL_CLASSES[s.capital]) e.push(`${w}.capital is a capital ship's class: ${Object.keys(CAPITAL_CLASSES).join(', ')}`);
    else if (s.station !== undefined && !STATION_KINDS[s.station]) e.push(`${w}.station is a station's kind: ${Object.keys(STATION_KINDS).join(', ')}`);
    if (!isObj(s.at) || !Object.entries(s.at).every(([f, x]) => ['ahead', 'side', 'up'].includes(f) && Number.isFinite(x) && Math.abs(x) <= 20000)) e.push(`${w}.at is { ahead?, side?, up? } in metres from the pilot's start`);
    if (s.heading !== undefined && !Number.isFinite(s.heading)) e.push(`${w}.heading is degrees clockwise from the start's heading`);
    if (s.seed !== undefined && !Number.isInteger(s.seed)) e.push(`${w}.seed is a whole number`);
  });
  return e;
}

// the start's frame: forward along its heading, right of it, up
function frame(seat) {
  const h = seat.heading, p = seat.pos;
  return { p, h, f: [Math.cos(h), Math.sin(h)], r: [Math.sin(h), -Math.cos(h)] };
}
const centerOf = (F, a = {}) => { const ah = a.ahead ?? 0, sd = a.side ?? 0, up = a.up ?? 0; return [F.p[0] + F.f[0] * ah + F.r[0] * sd, F.p[1] + F.f[1] * ah + F.r[1] * sd, F.p[2] + up]; };
const built = (s) => (s.capital ? buildCapital(s.capital, { seed: s.seed ?? 1 }) : buildStation(s.station, { seed: s.seed ?? 1 }));
const reachOf = (B) => Math.max(...B.pieces.flatMap((p) => [0, 1, 2].map((k) => Math.max(Math.abs(p.min[k]), Math.abs(p.max[k])))));

/** Where each ship stands in the world, and how far it reaches (the rocks keep clear of it). */
export function fleetWorld(list, seat) {
  const F = frame(seat);
  return list.map((s) => { const B = built(s); return { id: s.id, kind: s.capital ?? s.station, center: centerOf(F, s.at).map(r2), radius: r2(reachOf(B)) }; });
}

/** A unit direction in the world from the start's frame: a bearing clockwise from ahead, an elevation up. */
export function toward(seat, { bearing = 0, elevation = 0 } = {}) {
  const F = frame(seat), b = bearing * DEG, el = elevation * DEG, c = Math.cos(el);
  const d = [c * (Math.cos(b) * F.f[0] + Math.sin(b) * F.r[0]), c * (Math.cos(b) * F.f[1] + Math.sin(b) * F.r[1]), Math.sin(el)];
  const L = Math.hypot(...d);
  return d.map((v) => Math.round((v / L) * 1e4) / 1e4);
}

/** The fleet laid: its faces, its colliders, a bookmark on each, and what was laid. */
export function layFleet(list, seat, { sun } = {}) {
  const F = frame(seat), faces = [], colliders = [], cameras = [], report = [];
  for (const s of list) {
    const B = built(s), at = centerOf(F, s.at);
    // (the fleet's frame has its bow along +x: turned to the start's heading, then the ship's own clockwise)
    const yaw = F.h - (s.heading ?? 0) * DEG, c = Math.cos(yaw), sn = Math.sin(yaw);
    const rot = ([x, y, z]) => [x * c - y * sn, x * sn + y * c, z];
    const P = (q) => { const v = rot(q); return [r2(v[0] + at[0]), r2(v[1] + at[1]), r2(v[2] + at[2])]; };
    for (const f of B.faces) faces.push({ corners: f.corners.map(P), fill: f.lit ? f.color : shade(f.color, rot(f.n), sun), group: `fleet:${s.id}`, ...(f.lit ? { lit: true } : {}) });
    for (const p of B.pieces) {
      const cs = [];
      for (const x of [p.min[0], p.max[0]]) for (const y of [p.min[1], p.max[1]]) for (const z of [p.min[2], p.max[2]]) cs.push(P([x, y, z]));
      colliders.push({ id: `${s.id}/${p.id}`, min: [0, 1, 2].map((k) => Math.min(...cs.map((q) => q[k]))), max: [0, 1, 2].map((k) => Math.max(...cs.map((q) => q[k]))) });
    }
    const R = reachOf(B), dir = rot([1, 0, 0]);
    // a bookmark off its bow quarter, a little above, the whole ship in view
    cameras.push({ name: `fleet:${s.id}`, worldFraming: { cameraPosition: [r2(at[0] + (dir[0] * 1.4 - dir[1] * 1.6) * R), r2(at[1] + (dir[1] * 1.4 + dir[0] * 1.6) * R), r2(at[2] + 0.6 * R)], lookAt: at.map(r2), horizontalFov: 55 } });
    report.push({ id: s.id, kind: s.capital ?? s.station, label: B.label, at: at.map(r2), heading: s.heading ?? 0, pieces: B.pieces.length, faces: B.faces.length });
  }
  return { faces, colliders, cameras, report };
}
