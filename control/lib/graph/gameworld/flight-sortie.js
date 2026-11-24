/**
 * A SORTIE — a cockpit level's mission in the register of the 90s space-combat sims (airspace `cockpit: true`): its
 * craft in FLIGHT GROUPS, its GOALS over them. A group is a name, a craft off the shelf, a count, a side and when it
 * arrives; the goals are which groups to destroy, which to protect, and how long to hold. Lowered onto the `sortie`
 * mechanic (game/sortie.js: goals together, arrivals) and the pilot's hull (`fail-on-death` of its body).
 *
 *   goal.flight = { sortie: {
 *     groups:  [{ id, name?, craft?, count?, side: 'friend' | 'foe', arrive?, at?, shields?, hull? }
 *              | { id, name?, side, capital: <class> | station: <kind>, at?, heading?, look?, use? }],   (a capital ship or
 *              a station, fleet/: one, there from the start, destructible, dressed civil or military by its `use`; a
 *              procedural enemy, down and blown up when its systems are destroyed, each a target of its own)
 *     goals:   [{ destroy: id | [ids] } | { protect: id | [ids] } | { survive: s } | { reach: <beacon> }, each with an
 *              optional say],
 *     beacons: [{ id, name?, at, radius?, lit?, say? }],
 *   } }
 *     beacon   a place in space the pilot is sent to: a marker it flies into, at { ahead?, side?, up? } from the start, its
 *              radius (SORTIE.beacon m); dark until `lit`: { after: s } | { down: <group>, after? } | { reach: <beacon>,
 *              after? } (at once without); `say` what the comms say as it is reached. The marker is the targeting
 *              computer's (U, the mission's), brought in as it lights and gone as it is reached
 *     craft    a shelf archetype (craft-shelf/craft-archetypes.js); a foe's the interceptor, a friend's the strike foil
 *     count    1 to SORTIE.most; each named "<name> <n>" (the targeting computer's), its id "<id>-<n>"
 *     arrive   'start' (there when the mission begins), { after: s }, { down: <group id>, after?: s } (once that group
 *              is down), { reach: <beacon>, after?: s } (once the pilot reaches it), each with an optional say; arriving
 *              groups are minted asleep and brought in by the mission
 *     at       where it comes in: { ahead?, side?, up? } metres from the pilot's start along its heading (a foe's ahead,
 *              a friend's beside), laid across in a line
 *     shields  fore and aft shields (a friend's on, a foe's off: interceptors fly without them); hull its hit points
 *     hold     true: the craft hold their places, unarmed (transports at a rendezvous, waiting to be protected)
 *
 *   readSortie(v, at?)            → the sortie read (throws naming the field)
 *   sortieMechanics(S, ends)      → the level's mechanics (ends: the level's anchors, where its beacons stand)
 *   sortieCast(S, ends)           → { entities, figures, fleet? } the groups as craft, minds on their sides; a capital
 *                                   ship's or a station's blocks placed (fleet: fleet/build.js placeFleet), its hull,
 *                                   its systems and its guns entities; the beacons' markers (`beacon-<id>`)
 *
 * Pure: the same sortie, the same craft in the same places.
 */
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { STARFIGHTER } from '../skyscape/starfighter.js';
import { cockpitOf } from '../skyscape/cockpits.js';
import { CAPITAL_CLASSES, STATION_KINDS } from '../fleet/classes.js';
import { FLEET_LOOKS } from '../fleet/language.js';
import { buildCapital, buildStation, placeFleet } from '../fleet/build.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const r2 = (v) => Math.round(v * 100) / 100;

/** A sortie's numbers: the most craft a group holds, its craft's hull by side, how far a group comes in. */
export const SORTIE = Object.freeze({
  most: 6, hull: Object.freeze({ foe: 3, friend: 8 }), shields: Object.freeze({ max: 4, regen: 0.4 }),
  craft: Object.freeze({ foe: 'twinPanel', friend: 'strikeFoil' }),
  // where a group comes in by default (m from the pilot's start: along its heading, across it, up); its craft this far apart
  at: Object.freeze({ foe: Object.freeze({ ahead: 1600, side: 0, up: 0 }), friend: Object.freeze({ ahead: -40, side: 60, up: 0 }), arrive: Object.freeze({ ahead: 2400, side: 0, up: 120 }), structure: Object.freeze({ ahead: 1400, side: 0, up: -60 }) }),
  spacing: 70,
  // a beacon's reach (m) when it says none, and the most a sortie lays
  beacon: 150, beacons: 8,
  // a beacon's marker: its size (m) and its light (amber: not a craft's side, and never the target's magenta)
  marker: 12, beaconColor: '#ffc23a',
  // a mind's numbers by side: its cannons' rate, its bursts (a wingman helps, the player carries the mission)
  guns: Object.freeze({ foe: Object.freeze({ rof: 3, burst: 0.4, pause: 1.4 }), friend: Object.freeze({ rof: 1.5, burst: 0.3, pause: 3 }), turret: Object.freeze({ rof: 2.5, burst: 0.5, pause: 1.8, hp: 3, reach: 0.95 }) }),
  // (a capital ship's or a station's systems: what a mission destroys, a few cannon passes or a warhead each)
  systems: Object.freeze({ hp: 12 }),
});
const SIDES = ['friend', 'foe'];
const GROUP_KEYS = ['id', 'name', 'craft', 'count', 'side', 'arrive', 'at', 'shields', 'hull', 'hold', 'capital', 'station', 'heading', 'look', 'use'];

export function readSortie(v, at = 'goal.flight.sortie') {
  const fail = (m) => { throw new Error(`gameworld: ${at}${m}`); };
  if (!isObj(v)) fail(' is { groups: [...], goals: [...] }');
  for (const k of Object.keys(v)) if (!['groups', 'goals', 'beacons'].includes(k)) fail(`.${k} is not a sortie's (groups, goals, beacons)`);
  if (!Array.isArray(v.groups) || !v.groups.length) fail('.groups is a list of flight groups, at least one');
  const seen = new Set();
  const groups = v.groups.map((g, k) => {
    const w = `.groups[${k}]`;
    if (!isObj(g)) fail(`${w} is { id, name?, craft?, count?, side, arrive?, at?, shields?, hull? }`);
    for (const f of Object.keys(g)) if (!GROUP_KEYS.includes(f)) fail(`${w}.${f} is not a flight group's (${GROUP_KEYS.join(', ')})`);
    if (typeof g.id !== 'string' || !/^[a-z][a-z0-9]*$/.test(g.id)) fail(`${w}.id is a short name, lower case letters and digits (it names its craft: <id>-1, <id>-2…)`);
    if (seen.has(g.id)) fail(`${w}.id '${g.id}' is named twice`);
    seen.add(g.id);
    if (!SIDES.includes(g.side)) fail(`${w}.side is friend or foe`);
    // (a capital ship or a station: one of it, there from the start, built of destructible matter: fleet/)
    if (g.capital !== undefined || g.station !== undefined) {
      if (g.capital !== undefined && g.station !== undefined) fail(`${w} is a capital ship or a station, not both`);
      if (g.capital !== undefined && !CAPITAL_CLASSES[g.capital]) fail(`${w}.capital is a ship's class (${Object.keys(CAPITAL_CLASSES).join(', ')})`);
      if (g.station !== undefined && !STATION_KINDS[g.station]) fail(`${w}.station is a station's kind (${Object.keys(STATION_KINDS).join(', ')})`);
      if (g.count !== undefined && g.count !== 1) fail(`${w}.count: a capital ship or a station is one`);
      if (g.arrive !== undefined && g.arrive !== 'start') fail(`${w}.arrive: a capital ship or a station is there from the start`);
      if (g.heading !== undefined && ![0, 90, 180, 270].includes(g.heading)) fail(`${w}.heading is 0, 90, 180 or 270 (degrees from the start's own heading)`);
      if (g.look !== undefined && !FLEET_LOOKS[g.look]) fail(`${w}.look is a fleet's livery (${Object.keys(FLEET_LOOKS).join(', ')})`);
      if (g.use !== undefined && g.use !== 'civil' && g.use !== 'military') fail(`${w}.use is civil or military (how it is dressed: glazing and arrays, or armour and guns)`);
      if (g.at !== undefined && !(isObj(g.at) && Object.entries(g.at).every(([f, x]) => ['ahead', 'side', 'up'].includes(f) && Number.isFinite(x) && Math.abs(x) <= 20000))) fail(`${w}.at is { ahead?, side?, up? } in metres from the start`);
      return { id: g.id, name: g.name ?? (g.capital ? CAPITAL_CLASSES[g.capital] : STATION_KINDS[g.station]).label.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase()), count: 1, side: g.side, arrive: { start: true }, ...(g.capital ? { capital: g.capital } : { station: g.station }), ...(g.at ? { at: { ...g.at } } : {}), ...(g.heading !== undefined ? { heading: g.heading } : {}), ...(g.look ? { look: g.look } : {}), ...(g.use ? { use: g.use } : {}) };
    }
    const craft = g.craft ?? SORTIE.craft[g.side];
    if (!CRAFT_ARCHETYPES[craft]) fail(`${w}.craft '${craft}' is not a craft of the shelf (${Object.keys(CRAFT_ARCHETYPES).join(', ')})`);
    const count = g.count ?? (g.side === 'foe' ? 3 : 2);
    if (!(Number.isInteger(count) && count >= 1 && count <= SORTIE.most)) fail(`${w}.count is a whole number, 1 to ${SORTIE.most}`);
    let arrive = { start: true };
    if (g.arrive !== undefined && g.arrive !== 'start') {
      const A = g.arrive;
      if (!isObj(A) || Object.keys(A).some((f) => !['after', 'down', 'reach', 'say'].includes(f)) || (A.after === undefined && A.down === undefined && A.reach === undefined) || (A.down !== undefined && A.reach !== undefined)) fail(`${w}.arrive is 'start', { after: s }, { down: <group id>, after?: s } or { reach: <beacon>, after?: s }, each with say?`);
      if (A.after !== undefined && !(Number.isFinite(A.after) && A.after >= 0)) fail(`${w}.arrive.after is seconds`);
      if (A.say !== undefined && typeof A.say !== 'string') fail(`${w}.arrive.say is a line`);
      arrive = { ...(A.after !== undefined ? { after: A.after } : {}), ...(A.down !== undefined ? { down: A.down } : {}), ...(A.reach !== undefined ? { reach: A.reach } : {}), ...(A.say ? { say: A.say } : {}) };
    }
    if (g.at !== undefined && !(isObj(g.at) && Object.entries(g.at).every(([f, x]) => ['ahead', 'side', 'up'].includes(f) && Number.isFinite(x) && Math.abs(x) <= 20000))) fail(`${w}.at is { ahead?, side?, up? } in metres from the start`);
    if (g.shields !== undefined && typeof g.shields !== 'boolean') fail(`${w}.shields is true or false`);
    if (g.hull !== undefined && !(Number.isInteger(g.hull) && g.hull >= 1 && g.hull <= 200)) fail(`${w}.hull is its hit points, 1 to 200`);
    if (g.hold !== undefined && typeof g.hold !== 'boolean') fail(`${w}.hold is true or false (true: they hold their places, unarmed)`);
    if (g.name !== undefined && !(typeof g.name === 'string' && g.name)) fail(`${w}.name is what its craft are called`);
    return { id: g.id, name: g.name ?? g.id[0].toUpperCase() + g.id.slice(1), craft, count, side: g.side, arrive, ...(g.at ? { at: { ...g.at } } : {}), shields: g.shields ?? g.side === 'friend', hull: g.hull ?? SORTIE.hull[g.side], hold: g.hold === true };
  });
  const byId = Object.fromEntries(groups.map((g) => [g.id, g]));
  for (const g of groups) if (g.arrive.down !== undefined && (!byId[g.arrive.down] || g.arrive.down === g.id)) fail(`.groups '${g.id}' arrives when '${g.arrive.down}' is down: no other group of that id`);
  // the beacons: places the pilot is sent to (their ids apart from the groups')
  const beacons = (v.beacons ?? []).map((b, k) => {
    const w = `.beacons[${k}]`;
    if (k === 0 && !Array.isArray(v.beacons)) fail('.beacons is a list: [{ id, name?, at, radius?, lit?, say? }]');
    if (!isObj(b)) fail(`${w} is { id, name?, at, radius?, lit?, say? }`);
    for (const f of Object.keys(b)) if (!['id', 'name', 'at', 'radius', 'lit', 'say'].includes(f)) fail(`${w}.${f} is not a beacon's (id, name, at, radius, lit, say)`);
    if (typeof b.id !== 'string' || !/^[a-z][a-z0-9]*$/.test(b.id) || byId[b.id] || (v.beacons ?? []).slice(0, k).some((x) => x && x.id === b.id)) fail(`${w}.id is a short name, once (a group's ids are its own)`);
    if (!(isObj(b.at) && Object.entries(b.at).every(([f, x]) => ['ahead', 'side', 'up'].includes(f) && Number.isFinite(x) && Math.abs(x) <= 20000))) fail(`${w}.at is { ahead?, side?, up? } in metres from the start`);
    if (b.radius !== undefined && !(Number.isFinite(b.radius) && b.radius >= 20 && b.radius <= 2000)) fail(`${w}.radius is metres, 20 to 2000`);
    if (b.say !== undefined && typeof b.say !== 'string') fail(`${w}.say is a line`);
    if (b.name !== undefined && !(typeof b.name === 'string' && b.name)) fail(`${w}.name is what the targeting computer calls it`);
    let lit = null;
    if (b.lit !== undefined) {
      const L = b.lit;
      if (!isObj(L) || Object.keys(L).some((f) => !['after', 'down', 'reach'].includes(f)) || (L.after === undefined && L.down === undefined && L.reach === undefined) || (L.down !== undefined && L.reach !== undefined)) fail(`${w}.lit is { after: s }, { down: <group>, after? } or { reach: <beacon>, after? }`);
      if (L.after !== undefined && !(Number.isFinite(L.after) && L.after >= 0)) fail(`${w}.lit.after is seconds`);
      if (L.down !== undefined && !byId[L.down]) fail(`${w}.lit.down '${L.down}' is no flight group of the sortie`);
      lit = { ...L };
    }
    return { id: b.id, name: b.name ?? b.id[0].toUpperCase() + b.id.slice(1), at: { ...b.at }, radius: b.radius ?? SORTIE.beacon, ...(lit ? { lit } : {}), ...(b.say ? { say: b.say } : {}) };
  });
  if (beacons.length > SORTIE.beacons) fail(`.beacons: at most ${SORTIE.beacons}`);
  const bById = Object.fromEntries(beacons.map((b) => [b.id, b]));
  for (const b of beacons) if (b.lit?.reach !== undefined && (!bById[b.lit.reach] || b.lit.reach === b.id)) fail(`.beacons '${b.id}' is lit when '${b.lit.reach}' is reached: no other beacon of that id`);
  // (a chain of beacons each lit by the next is never lit)
  for (const b of beacons) { let c = b, n = 0; while (c?.lit?.reach && n <= beacons.length) { c = bById[c.lit.reach]; n++; } if (n > beacons.length) fail(`.beacons '${b.id}': its lit chain comes back on itself, so it is never lit`); }
  for (const g of groups) if (g.arrive.reach !== undefined && !bById[g.arrive.reach]) fail(`.groups '${g.id}' arrives when '${g.arrive.reach}' is reached: no beacon of that id`);
  if (!Array.isArray(v.goals) || !v.goals.length) fail('.goals is a list, at least one: { destroy: id | [ids] } | { protect: id | [ids] } | { survive: s } | { reach: <beacon> }');
  const goals = v.goals.map((g, k) => {
    const w = `.goals[${k}]`, kind = ['destroy', 'protect', 'survive', 'reach'].filter((f) => isObj(g) && g[f] !== undefined);
    if (kind.length !== 1) fail(`${w} is one of destroy, protect, survive, reach`);
    for (const f of Object.keys(g)) if (f !== kind[0] && f !== 'say') fail(`${w}.${f} is not a goal's (${kind[0]}, say)`);
    if (g.say !== undefined && typeof g.say !== 'string') fail(`${w}.say is a line`);
    if (kind[0] === 'survive') { if (!(Number.isFinite(g.survive) && g.survive > 0)) fail(`${w}.survive is seconds, above 0`); return { survive: g.survive, ...(g.say ? { say: g.say } : {}) }; }
    if (kind[0] === 'reach') { if (!bById[g.reach]) fail(`${w}.reach '${g.reach}' is no beacon of the sortie (${beacons.map((b) => b.id).join(', ') || 'none'})`); return { reach: g.reach, ...(g.say ? { say: g.say } : {}) }; }
    const list = Array.isArray(g[kind[0]]) ? g[kind[0]] : [g[kind[0]]];
    for (const id of list) {
      if (!byId[id]) fail(`${w}.${kind[0]} '${id}' is no flight group of the sortie (${groups.map((x) => x.id).join(', ')})`);
      if (kind[0] === 'destroy' && byId[id].side !== 'foe') fail(`${w}.destroy '${id}' is a friend: destroy a foe's group, protect a friend's`);
      if (kind[0] === 'protect' && byId[id].side !== 'friend') fail(`${w}.protect '${id}' is a foe: protect a friend's group`);
    }
    return { [kind[0]]: list, ...(g.say ? { say: g.say } : {}) };
  });
  if (!goals.some((g) => g.destroy || g.survive || g.reach)) fail('.goals: a mission is won by a goal met, at least one destroy or survive, or a beacon to reach');
  return { groups, goals, ...(beacons.length ? { beacons } : {}) };
}

const craftIds = (g) => Array.from({ length: g.count }, (_, k) => `${g.id}-${k + 1}`);

// where a sortie's `at` stands in the world: the pilot's start along its heading, across it, up
const fromStart = (ends, A) => {
  const seat = ends.seat.transform, p = seat.pos, h = seat.heading, fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
  const ah = A.ahead ?? 0, sd = A.side ?? 0;
  return [r2(p[0] + fx * ah + rx * sd), r2(p[1] + fy * ah + ry * sd), r2(p[2] + (A.up ?? 0))];
};
const beaconId = (b) => `beacon-${b.id}`;

/** The level's mechanics: the sortie's goals, arrivals and beacons over its craft, and the pilot's hull. */
export function sortieMechanics(S, ends = null) {
  const byId = Object.fromEntries(S.groups.map((g) => [g.id, g]));
  const goals = S.goals.map((g) => (g.survive || g.reach ? g : { [g.destroy ? 'destroy' : 'protect']: (g.destroy ?? g.protect).flatMap((id) => craftIds(byId[id])), ...(g.say ? { say: g.say } : {}) }));
  // (the beacons where the start puts them; a sortie read without its map lays none: its reach goals cannot be met)
  const beacons = S.beacons && ends ? S.beacons.map((b) => ({ id: b.id, at: fromStart(ends, b.at), radius: b.radius, entity: beaconId(b),
    ...(b.lit ? { lit: { ...(b.lit.after !== undefined ? { after: b.lit.after } : {}), ...(b.lit.down ? { down: craftIds(byId[b.lit.down]) } : {}), ...(b.lit.reach ? { reach: b.lit.reach } : {}) } } : {}),
    ...(b.say ? { say: b.say } : {}) })) : null;
  const arrivals = S.groups.filter((g) => !g.arrive.start).map((g) => ({ craft: craftIds(g), ...(g.arrive.after !== undefined ? { after: g.arrive.after } : {}), ...(g.arrive.down ? { down: craftIds(byId[g.arrive.down]) } : {}), ...(g.arrive.reach ? { reach: g.arrive.reach } : {}), ...(g.arrive.say ? { say: g.arrive.say } : {}) }));
  return [{ kind: 'fail-on-death', of: 'body' }, { kind: 'sortie', goals, ...(arrivals.length ? { arrivals } : {}), ...(beacons ? { beacons } : {}) }];
}

/** The groups as craft: each a mind on its side (friends hunt the foes, foes hunt the pilot's side), drawn as its
 *  shelf airframe, named, its hull and its shields; the arriving ones asleep. */
export function sortieCast(S, ends) {
  const c = ends.airMap.craft, seat = ends.seat.transform, p = seat.pos, h = seat.heading;
  const fx = Math.cos(h), fy = Math.sin(h), rx = Math.sin(h), ry = -Math.cos(h);
  const size = r2(Math.max(4, c.max / 25)), speed = r2(0.85 * c.cruise), goalIds = new Set(S.goals.flatMap((g) => g.destroy ?? []));
  const L = STARFIGHTER.lasers, entities = [], figures = {};
  const fleet = [];
  for (const g of S.groups) {
    // A CAPITAL SHIP OR A STATION (fleet/): built of destructible matter, welded to its reactor and weightless; a
    // procedural enemy, its hull the entity the mission counts, down (and blown up) when its systems are destroyed, each
    // a target the computer names; its guns minds on their hardpoints (down with their mounts)
    if (g.capital || g.station) {
      const opt = { seed: S.groups.indexOf(g) + 1, ...(g.look ? { look: g.look } : {}), ...(g.use ? { use: g.use } : {}) };
      const built = g.capital ? buildCapital(g.capital, opt) : buildStation(g.station, opt);
      // (a big one stands further off: the start at least its length and a half from its middle)
      const A = { ...SORTIE.at.structure, ahead: Math.max(SORTIE.at.structure.ahead, r2(1.5 * (built.length || 0) + 300)), ...(g.at ?? {}) }, team = g.side === 'foe' ? 'foes' : 'player';
      const at = [r2(p[0] + fx * A.ahead + rx * A.side), r2(p[1] + fy * A.ahead + ry * A.side), r2(p[2] + A.up)];
      const turn = Math.round(((h * 180) / Math.PI + (g.heading ?? 90)) / 90) * 90;
      const P = placeFleet(built, { at, heading: turn, id: g.id });
      fleet.push(P);
      const core = P.blocks.filter((b) => P.core.includes(b.id)), mid = core.length ? [0, 1, 2].map((k) => r2(core.reduce((s, b) => s + (b.min[k] + b.max[k]) / 2, 0) / core.length)) : at;
      // (a procedural enemy: its hull no target of its own, down with the last of its SYSTEMS, each a target the
      // computer names and the mission's goal keys cycle through; then it blows up, rupa.js)
      const sys = P.systems.map((y, k) => ({ ...y, eid: `${g.id}-${y.kind}${P.systems.slice(0, k).filter((q) => q.kind === y.kind).length + 1}` }));
      entities.push({ id: `${g.id}-1`, team, rule: { type: 'static' }, structure: { systems: sys.map((y) => y.eid), prefix: `${g.id}/` },
        body: { type: 'mesh', shape: 'box', size: [1, 1, 1], color: '#000000', hittable: false, hp: 100, radius: 2, name: g.name }, transform: { pos: mid, heading: 0, pitch: 0 } });
      for (const y of sys) entities.push({ id: y.eid, team, onBlock: y.block, rule: { type: 'static' },
        body: { type: 'mesh', shape: 'box', size: [1, 1, 1], color: '#000000', hittable: true, hp: SORTIE.systems.hp, poise: 99, radius: r2(y.size), egg: { a: r2(y.size), c: r2(y.size * 0.8), cz: 0 }, name: `${g.name} ${y.name}`, ...(goalIds.has(g.id) ? { goal: true } : {}) },
        transform: { pos: y.at, heading: 0, pitch: 0 } });
      // (its guns: a mind each on its hardpoint, firing the other side's bolts, down when the block it stands on is)
      P.hardpoints.forEach((H, k) => entities.push({ id: `${g.id}-gun${k + 1}`, team, onBlock: H.block,
        // (a foe's guns hunt the pilot, the one the mission is flown by, out to their flak's reach; a friend's the
        // nearest foe)
        rule: { type: 'ai', space: true, speed: 0, turn: 2.2, standoff: 0, ...(g.side === 'foe' ? {} : { target: 'enemy' }), fireArc: 14, burst: SORTIE.guns.turret.burst, pause: SORTIE.guns.turret.pause, sightRange: r2(SORTIE.guns.turret.reach * L.speed * L.fuse), eye: 0 },
        weapon: { fireClass: 'lob', auto: true, rof: SORTIE.guns.turret.rof, damage: L.damage, impact: 0, range: r2(SORTIE.guns.turret.reach * L.speed * L.fuse), coreAngle: 2, assistAngle: 2, eye: 0, lobAngle: 0, projectileSpeed: L.speed, projectileGravity: 0, projRadius: 1.5, splashRadius: 0, fuse: L.fuse, noGround: true, passTeam: true, smokeTrail: false, fxColor: g.side === 'foe' ? 0x5cff6a : 0xff3b2e, fxScale: STARFIGHTER.bolt.size, fxMin: STARFIGHTER.bolt.min, foeRound: true },
        body: { type: 'mesh', shape: 'box', size: [2.4, 2.4, 1.6], color: '#2a2d31', hittable: true, hp: SORTIE.guns.turret.hp, radius: 2.5, name: `${g.name} gun ${k + 1}` }, transform: { pos: H.at, heading: 0, pitch: 0 } }));
      continue;
    }
    const fig = `craft-${g.craft}`;
    figures[fig] = { craft: { archetype: g.craft, flying: true, gear: 'up' } };
    const A = { ...(g.arrive.start ? SORTIE.at[g.side] : SORTIE.at.arrive), ...(g.at ?? {}) };
    const team = g.side === 'foe' ? 'foes' : 'player';
    // (a fighter's systems: its shields where it has them, and its craft's generator, routed by its own power officer
    // (rules-starfighter.js); its cannons charged from it alone; a transport that holds has neither)
    const N = cockpitOf(g.craft).numbers, gen = !g.hold && N.generator > 0;
    const ship = g.shields || gen ? { ...(g.shields ? { shields: { ...SORTIE.shields } } : {}), ...(gen ? { generator: { out: N.generator } } : {}) } : null;
    const pool = gen ? { energyMax: N.lasers.energy, energyCost: 1, energyRegen: 0, energyUnlockFrac: 0.25 } : {};
    craftIds(g).forEach((id, k) => {
      const across = A.side + (k - (g.count - 1) / 2) * SORTIE.spacing * (g.side === 'friend' && !g.at && k % 2 ? -1 : 1);
      const pos = [r2(p[0] + fx * A.ahead + rx * across), r2(p[1] + fy * A.ahead + ry * across), r2(p[2] + A.up + (k % 2 ? 12 : 0))];
      // (a foe comes in facing the pilot's start; a friend flies the pilot's heading)
      const heading = g.side === 'foe' ? Math.atan2(p[1] - pos[1], p[0] - pos[0]) : h;
      entities.push({
        id, team, ...(g.arrive.start ? {} : { dormant: true }),
        // (a group that holds: in its place, unarmed; else a mind on its side, its cannons firing bolts it leads)
        ...(g.hold ? { rule: { type: 'static' } } : { rule: { type: 'ai', space: true, passes: true, target: 'enemy', speed, turn: 1.4, standoff: r2(2.5 * speed), fireArc: 6, burst: SORTIE.guns[g.side].burst, pause: SORTIE.guns[g.side].pause, sightRange: r2(14 * c.cruise), eye: 0 } }),
        ...(g.hold ? {} : { weapon: { fireClass: 'lob', auto: true, rof: SORTIE.guns[g.side].rof, damage: L.damage, impact: 0, range: L.speed * L.fuse * 0.6, coreAngle: 2, assistAngle: 2, eye: 0, lobAngle: 0, projectileSpeed: L.speed, projectileGravity: 0, projRadius: 1.5, splashRadius: 0, fuse: L.fuse, noGround: true, passTeam: true, smokeTrail: false, fxColor: g.side === 'foe' ? 0x5cff6a : 0xff3b2e, fxScale: STARFIGHTER.bolt.size, fxMin: STARFIGHTER.bolt.min, foeRound: true, ...pool } }),
        body: { type: 'figure-rig', figure: fig, hittable: true, hp: g.hull, poise: 99, radius: size, egg: { a: size, c: r2(size * 0.6), cz: 0 }, blast: r2(size * STARFIGHTER.blast * (g.hold ? 2 : 1)), name: `${g.name} ${k + 1}`, ...(goalIds.has(g.id) ? { goal: true } : {}), ...(ship ? { ship } : {}) },
        transform: { pos, heading: r2(heading), pitch: 0 },
      });
    });
  }
  // the beacons: a marker each where the start puts it, held still, never hit, the mission's (the targeting computer's U);
  // dark ones asleep until they light
  for (const b of S.beacons ?? []) {
    entities.push({ id: beaconId(b), ...(b.lit ? { dormant: true } : {}), rule: { type: 'static' },
      body: { type: 'mesh', beacon: true, radius: SORTIE.marker, color: SORTIE.beaconColor, marker: false, name: b.name, goal: true },
      transform: { pos: fromStart(ends, b.at), heading: 0, pitch: 0 } });
  }
  return { entities, figures, ...(fleet.length ? { fleet } : {}) };
}
