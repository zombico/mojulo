/**
 * THE THEATRE — where a space campaign's mission is fought, named and drawn from the widest to the narrowest:
 *
 *   "Kessa System | Varn Cluster | Vigil Station | Moon IV"
 *
 *   the SYSTEM    a star and its planets on their orbits (an orrery: the briefing opens on it)
 *   the CLUSTER   the rocks the fight is in: a trojan cluster riding the home planet's orbit ahead of it
 *   the STATION   the station the fight is round, holding orbit over
 *   the MOON      the home planet's numbered moon, the large world in the fight's sky
 *
 * and the theatre itself: the fight's own space at the sortie's metres, the pilot's start its origin, x across (right),
 * y ahead, z up (flight-sortie.js `at`: { side, ahead, up }), a box `field` metres across.
 *
 *   readPlace(v, at?)        → { system, cluster, station, moon, seed }   (throws, teaching)
 *   placeLine(P)             → 'Kessa System | Varn Cluster | Vigil Station | Moon IV'
 *   placeParts(P)            → [{ kind: 'system' | 'cluster' | 'station' | 'moon', name }]   the line's four parts
 *   roman(n)                 → 'IV'
 *   orrery(P, { moonKind? }) → { star, planets: [{ r, a, size, kind, color, moons? }], home, cluster, moon }   the system
 *                              as the briefing draws it (orbits in orrery units, angles in radians), the same for the
 *                              same place
 *   STAR_KINDS               the star's kinds by colour
 *   THEATRE                  the theatre's numbers (the field's default and bounds, the moon's look)
 *   readTheatre(v, at?)      → { field, moon, station, rocks, nav }   (throws, teaching)
 *
 * Pure: the same place, the same system.
 */
import { mulberry32, strHash } from '../city/plan/dice.js';
import { PLANET_KINDS } from '../skyscape/planet-gen.js';
import { STATION_KINDS } from '../fleet/classes.js';
import { ASTEROIDS } from '../skyscape/space.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = (v) => Math.round(v * 1000) / 1000;
const NAME = /^[A-Z][A-Za-z' -]{1,23}$/;

/** A star by its colour: the light it gives the orrery (and, built, the level's sun). */
export const STAR_KINDS = Object.freeze({
  white: Object.freeze({ color: '#f4f6ff', label: 'a white star' }),
  yellow: Object.freeze({ color: '#ffe39a', label: 'a yellow star' }),
  orange: Object.freeze({ color: '#ffb36a', label: 'an orange star' }),
  red: Object.freeze({ color: '#ff7a5a', label: 'a red dwarf' }),
  blue: Object.freeze({ color: '#a9c8ff', label: 'a blue-white star' }),
});

/** The theatre's numbers: the field (m) when none is said and its bounds; the moon's bearing and elevation bounds (°)
 *  and its size on the table (a share of the table's radius) by how close it is. */
export const THEATRE = Object.freeze({
  field: 6000, fieldMin: 3000, fieldMax: 16000,
  moonSizes: Object.freeze({ distant: 0.16, near: 0.3, 'high-orbit': 0.55 }),
  // the most nav points a theatre names (start is always there, never named)
  nav: 6,
});

/** n as a Roman numeral (1..39: a moon's number). */
export function roman(n) {
  const T = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let s = '', v = n;
  for (const [k, w] of T) while (v >= k) { s += w; v -= k; }
  return s;
}

const word = (name, kind) => (new RegExp(`\\b${kind}$`, 'i').test(name) ? name : `${name} ${kind}`);

/** A mission's place: { system, cluster, station, moon, seed? } (names, the moon's number). Throws, teaching. */
export function readPlace(v, at = 'place') {
  const fail = (m) => { throw new Error(`campaign: ${at}${m}`); };
  if (!isObj(v)) fail(' is { system, cluster, station, moon }: the system\'s name, the cluster\'s, the station\'s, and the number of the moon it holds orbit over');
  for (const k of Object.keys(v)) if (!['system', 'cluster', 'station', 'moon', 'seed', 'star'].includes(k)) fail(`.${k} is not part of a place (system, cluster, station, moon, star?, seed?)`);
  for (const k of ['system', 'cluster', 'station']) if (typeof v[k] !== 'string' || !NAME.test(v[k])) fail(`.${k} is a name, capitalised, 2 to 24 letters ('Kessa'; the word '${k}' is added where it is not written)`);
  if (!(Number.isInteger(v.moon) && v.moon >= 1 && v.moon <= 12)) fail('.moon is the moon\'s number, 1 to 12 (Moon IV is 4)');
  if (v.star !== undefined && !STAR_KINDS[v.star]) fail(`.star is the star's colour: ${Object.keys(STAR_KINDS).join(', ')}`);
  if (v.seed !== undefined && !Number.isInteger(v.seed)) fail('.seed is a whole number');
  return { system: v.system, cluster: v.cluster, station: v.station, moon: v.moon, ...(v.star ? { star: v.star } : {}), seed: v.seed ?? strHash(`place|${v.system}`) % 100000 };
}

/** The place's four parts, widest first. */
export function placeParts(P) {
  return [
    { kind: 'system', name: word(P.system, 'System') },
    { kind: 'cluster', name: word(P.cluster, 'Cluster') },
    { kind: 'station', name: word(P.station, 'Station') },
    { kind: 'moon', name: `Moon ${roman(P.moon)}` },
  ];
}
/** The place as one line, its parts joined by bars. */
export const placeLine = (P) => placeParts(P).map((p) => p.name).join(' | ');

/**
 * The system as an orrery: the star, 4 to 7 planets on their orbits (orrery units: the outermost orbit 1), the home
 * planet (a world with at least the place's moon count of moons, the moon picked out), the cluster riding its orbit 60°
 * ahead of it (a trojan cluster). The home planet sits in the middle orbits, so the zoom to it has room round it.
 */
export function orrery(P, { moonKind = 'barren' } = {}) {
  const rnd = mulberry32(strHash(`orrery|${P.system}|${P.seed}`));
  const starKind = P.star ?? Object.keys(STAR_KINDS)[Math.floor(rnd() * 4)];
  const n = 4 + Math.floor(rnd() * 4), home = 1 + Math.floor(rnd() * (n - 2));
  // (an invented system's worlds: never a child of Sol, sol/worlds.js)
  const kinds = Object.keys(PLANET_KINDS).filter((k) => k !== 'molten' && !PLANET_KINDS[k].sol);
  const planets = [];
  for (let i = 0; i < n; i++) {
    const r = r3(0.22 + (0.78 * (i + 0.5)) / n + (rnd() - 0.5) * 0.04);
    const gas = i > home && rnd() < 0.6;
    const kind = i === home ? 'earthlike' : gas ? (rnd() < 0.5 ? 'jovian' : 'saturnian') : kinds[Math.floor(rnd() * kinds.length)];
    const size = r3(i === home ? 0.05 : gas ? 0.045 + rnd() * 0.025 : 0.018 + rnd() * 0.02);
    planets.push({ r, a: r3(rnd() * Math.PI * 2), size, kind, color: PLANET_KINDS[kind]?.colors?.atmoC ?? '#9fd8ff', ...(kind === 'saturnian' ? { ring: true } : {}) });
  }
  // the home planet's moons: at least the place's number, each on its own small orbit, the place's moon its kind's
  const H = planets[home], count = Math.max(P.moon, 2 + Math.floor(rnd() * 3));
  H.moons = Array.from({ length: count }, (_, k) => ({ n: k + 1, r: r3(H.size * (1.9 + k * 0.85)), a: r3(rnd() * Math.PI * 2), size: r3(H.size * (k + 1 === P.moon ? 0.34 : 0.18 + rnd() * 0.1)), ...(k + 1 === P.moon ? { kind: moonKind, color: PLANET_KINDS[moonKind]?.colors?.atmoC ?? '#cfd8e0' } : {}) }));
  // the cluster: rocks round the point 60° ahead of the home planet on its orbit
  const ca = H.a + Math.PI / 3, rocks = [];
  for (let k = 0; k < 40; k++) {
    const d = 0.06 * Math.sqrt(rnd()), t = rnd() * Math.PI * 2;
    rocks.push([r3(Math.cos(ca) * H.r + Math.cos(t) * d), r3(Math.sin(ca) * H.r + Math.sin(t) * d), r3((rnd() - 0.5) * 0.02), r3(0.002 + rnd() * 0.004)]);
  }
  return { star: { kind: starKind, color: STAR_KINDS[starKind].color }, planets, home, cluster: { at: [r3(Math.cos(ca) * H.r), r3(Math.sin(ca) * H.r), 0], rocks }, moon: P.moon };
}

const vec3 = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);

/**
 * A mission's theatre: { field?, moon: { kind, bearing, elevation, size? }, station: { kind, at, side?, heading? },
 * rocks?, nav?: { <id>: { name, at } } }. Throws, teaching.
 *   field     metres across (the sortie's map field)
 *   moon      the numbered moon in the fight's sky: its kind of world (planet-gen.js), its bearing (° from ahead, to the
 *             right) and elevation (° up from the plane of the start), how close (distant | near | high-orbit)
 *   station   the place's station: its kind (fleet/classes.js), where it is (m), whose it is, its heading (°)
 *   rocks     the cluster's rocks round the fight (skyscape/space.js densities)
 *   nav       named points: { name, at: [x, y, z] } (m from the start)
 */
export function readTheatre(v, at = 'theatre') {
  const fail = (m) => { throw new Error(`campaign: ${at}${m}`); };
  if (!isObj(v)) fail(' is { field?, moon, station, rocks?, nav? }');
  for (const k of Object.keys(v)) if (!['field', 'moon', 'station', 'rocks', 'nav'].includes(k)) fail(`.${k} is not part of a theatre (field, moon, station, rocks, nav)`);
  const field = v.field ?? THEATRE.field;
  if (!(Number.isFinite(field) && field >= THEATRE.fieldMin && field <= THEATRE.fieldMax)) fail(`.field is metres across, ${THEATRE.fieldMin} to ${THEATRE.fieldMax}`);
  const half = field / 2, inside = (p) => p.every((c) => Math.abs(c) <= half);
  const M = v.moon;
  if (!isObj(M)) fail('.moon is { kind, bearing, elevation, size? }: the numbered moon in the sky');
  if (!PLANET_KINDS[M.kind]) fail(`.moon.kind is a kind of world: ${Object.keys(PLANET_KINDS).join(', ')}`);
  if (!(Number.isFinite(M.bearing) && Math.abs(M.bearing) <= 180)) fail('.moon.bearing is degrees from ahead, to the right (-180 to 180)');
  if (!(Number.isFinite(M.elevation) && Math.abs(M.elevation) <= 60)) fail('.moon.elevation is degrees up (-60 to 60)');
  if (M.size !== undefined && !THEATRE.moonSizes[M.size]) fail(`.moon.size is how close it is: ${Object.keys(THEATRE.moonSizes).join(', ')}`);
  const S = v.station;
  if (!isObj(S)) fail('.station is { kind, at, side?, heading? }: the station the fight is round');
  if (!STATION_KINDS[S.kind]) fail(`.station.kind is a station's kind: ${Object.keys(STATION_KINDS).join(', ')}`);
  if (!vec3(S.at) || !inside(S.at)) fail(`.station.at is [x, y, z] metres from the start, inside the field (±${half})`);
  if (S.side !== undefined && !['friend', 'foe', 'neutral'].includes(S.side)) fail('.station.side is friend, foe or neutral');
  if (v.rocks !== undefined && ASTEROIDS.densities[v.rocks] === undefined) fail(`.rocks is the cluster's density: ${Object.keys(ASTEROIDS.densities).join(', ')}`);
  const nav = {};
  if (v.nav !== undefined) {
    if (!isObj(v.nav)) fail('.nav is { <id>: { name, at } }');
    const ids = Object.keys(v.nav);
    if (ids.length > THEATRE.nav) fail(`.nav names at most ${THEATRE.nav} points`);
    for (const id of ids) {
      const N = v.nav[id];
      if (!/^[a-z][a-z0-9]*$/.test(id) || id === 'start') fail(`.nav.${id}: a nav point's id is a short lower-case word (not 'start': the start is always there)`);
      if (!isObj(N) || typeof N.name !== 'string' || !N.name) fail(`.nav.${id} is { name, at }`);
      if (!vec3(N.at) || !inside(N.at)) fail(`.nav.${id}.at is [x, y, z] metres from the start, inside the field (±${half})`);
      nav[id] = { name: N.name, at: N.at.slice() };
    }
  }
  return {
    field,
    moon: { kind: M.kind, bearing: M.bearing, elevation: M.elevation, size: M.size ?? 'near' },
    station: { kind: S.kind, at: S.at.slice(), side: S.side ?? 'friend', heading: Number.isFinite(S.heading) ? S.heading : 0 },
    rocks: v.rocks ?? 'sparse',
    nav: { start: { name: 'Start', at: [0, 0, 0] }, ...nav },
  };
}
