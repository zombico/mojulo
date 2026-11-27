/**
 * A BUILDING'S TANKS (an aquarium's, geocity/walkins.js): glass tanks of water standing in its rooms, a collection a
 * wing, the sea's animals swimming in them (marine/tank.js, on the walkers channel). The museum's wings (exhibits.js
 * wingRooms): each gallery a tank in its middle, each wing's hall its big tank.
 *
 *   tanks: [{ title?, life: ['<species>', …] }]          one collection a wing, its species the sea's (marine/fauna.js)
 *   layTanks(plan, tanks) → { faces, colliders, swims, wings, findings }
 *     faces      each tank's base, its sand, its glass sides and its water's surface (seen through: `alpha`)
 *     colliders  each tank's box: walked round, never through
 *     swims      [{ at: [x, y], half: [hx, hy], z0, z1, life: [species…], seed }]: the water each holds, for its fish
 *   TANK         the measures (m) and colours
 *
 * Pure: the stage's planned rooms and links in, the faces and the water out. A building with no `tanks` lays none.
 */
import { wingRooms } from './exhibits.js';
import { MARINE_FAUNA } from '../marine/fauna.js';

export const TANK = Object.freeze({ base: 0.7, high: 2.1, edge: 1.8, most: Object.freeze([5, 2.6]), hall: Object.freeze({ most: Object.freeze([7, 4.6]), high: 3 }), sand: 0.12, rim: 0.08,
  colours: Object.freeze({ base: '#2a2d30', sand: '#d8c79c', glass: '#9fdcee', water: '#1f8fbf', rim: '#1d2023' }), alpha: Object.freeze({ glass: 0.22, water: 0.26 }) });
export const TANK_LIMITS = Object.freeze({ wings: 3, life: 8 });

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (says) => { throw new Error(`tanks: ${says}`); };
const r3 = (v) => Math.round(v * 1000) / 1000;

/** A building's `tanks`, checked: a list of collections, one a wing, each the sea's species. */
export function readTanks(T) {
  if (T === undefined) return undefined;
  if (!Array.isArray(T) || !T.length || T.length > TANK_LIMITS.wings) fail(`is a list of 1 to ${TANK_LIMITS.wings} collections, one a wing: [{ title?, life: ['<species>', …] }]`);
  return T.map((c, i) => {
    if (!isObj(c) || !Array.isArray(c.life) || !c.life.length || c.life.length > TANK_LIMITS.life) fail(`[${i}] is { title?, life: [1 to ${TANK_LIMITS.life} of the sea's species] }`);
    for (const k of Object.keys(c)) if (!['title', 'life'].includes(k)) fail(`[${i}].${k} is not a collection's key (title, life)`);
    for (const sp of c.life) if (!MARINE_FAUNA[sp]) fail(`[${i}]: '${sp}' is not one of the sea's animals (marine/fauna.js: ${Object.keys(MARINE_FAUNA).slice(0, 8).join(', ')}, …)`);
    return { ...(typeof c.title === 'string' && c.title.trim() ? { title: c.title.trim() } : {}), life: [...c.life] };
  });
}

// a box's faces, its sides and its top (a floor never seen): opaque, or seen through at `alpha`
function boxFaces(x0, y0, x1, y1, z0, z1, fill, group, alpha = null) {
  const a = alpha === null ? {} : { alpha };
  const f = (corners, n) => ({ corners, normal: n, outNormal: n, fill, group, ...a });
  return [
    f([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1]),
    f([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0]), f([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0]),
    f([[x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1]], [0, 1, 0]), f([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], [-1, 0, 0]),
  ];
}

/** One tank, centred `at`, `size` [w, d] and `high` of water over its base, at floor `z`. */
function tankAt(at, size, high, z, life, seed) {
  const C = TANK.colours, [hx, hy] = [size[0] / 2, size[1] / 2], [x0, y0, x1, y1] = [at[0] - hx, at[1] - hy, at[0] + hx, at[1] + hy];
  const zb = z + TANK.base, zs = zb + TANK.sand, zt = zb + high;
  const faces = [
    ...boxFaces(x0, y0, x1, y1, z, zb, C.base, 'stage:tank'),
    ...boxFaces(x0 + 0.05, y0 + 0.05, x1 - 0.05, y1 - 0.05, zb, zs, C.sand, 'stage:tanksand'),
    // (the water, a tinted block a little under the rim; the glass round it; each seen through both ways)
    ...boxFaces(x0 + 0.04, y0 + 0.04, x1 - 0.04, y1 - 0.04, zs, zt - 0.12, C.water, 'stage:tankwater', TANK.alpha.water),
    ...boxFaces(x0, y0, x1, y1, zb, zt, C.glass, 'stage:tankglass', TANK.alpha.glass).slice(1),
    // (its rim: a dark band round the glass's top)
    ...boxFaces(x0 - 0.03, y0 - 0.03, x1 + 0.03, y1 + 0.03, zt, zt + TANK.rim, C.rim, 'stage:tank'),
  ].map((f) => ({ ...f, corners: f.corners.map((c) => c.map(r3)) }));
  return { faces, collider: { min: [r3(x0), r3(y0), r3(z)], max: [r3(x1), r3(y1), r3(zt + TANK.rim)], of: 'tank' }, swim: { at: at.map(r3), half: [r3(hx - 0.25), r3(hy - 0.25)], z0: r3(zs + 0.15), z1: r3(zt - 0.3), life, seed } };
}

/** The tanks and the water in them (see the header). `plan`: planStage's (rooms with x0..y1, links). */
export function layTanks(plan, tanks) {
  const T = readTanks(tanks) ?? [], faces = [], colliders = [], swims = [], wings = [], findings = [];
  const byId = new Map((plan.rooms ?? []).map((r) => [r.id, r])), W = wingRooms(plan);
  T.forEach((C, i) => {
    const wing = W[i];
    if (!wing) { findings.push({ id: 'no-wing', says: `collection ${i + 1} has no wing to stand in: the building has ${W.length}` }); return; }
    const rooms = wing.rooms.map((id) => byId.get(id)).filter(Boolean);
    const isHall = (r) => /^(hall|great-hall)/.test(r.id), hall = rooms.find(isHall) ?? null, galleries = rooms.filter((r) => r !== hall);
    const held = [];
    // (each gallery's tank: two of the wing's kinds in turn; the hall's the whole collection)
    galleries.forEach((r, k) => {
      const w = r.x1 - r.x0, d = r.y1 - r.y0, along = w >= d, room = [w - 2 * TANK.edge, d - 2 * TANK.edge];
      if (room[0] < 1.5 || room[1] < 1.5) return;
      const size = along ? [Math.min(room[0], TANK.most[0]), Math.min(room[1], TANK.most[1])] : [Math.min(room[0], TANK.most[1]), Math.min(room[1], TANK.most[0])];
      const life = [C.life[(2 * k) % C.life.length], C.life[(2 * k + 1) % C.life.length]].filter((v, j, a) => a.indexOf(v) === j);
      const t = tankAt([(r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2], size, TANK.high, r.z0 ?? 0, life, i * 31 + k + 1);
      faces.push(...t.faces); colliders.push(t.collider); swims.push(t.swim); held.push({ room: r.id, life });
    });
    if (hall) {
      const room = [hall.x1 - hall.x0 - 2 * TANK.edge, hall.y1 - hall.y0 - 2 * TANK.edge];
      const t = tankAt([(hall.x0 + hall.x1) / 2, (hall.y0 + hall.y1) / 2], [Math.min(room[0], TANK.hall.most[0]), Math.min(room[1], TANK.hall.most[1])], Math.min(TANK.hall.high, (hall.h ?? 4) - TANK.base - 0.6), hall.z0 ?? 0, [...C.life], i * 31 + 29);
      faces.push(...t.faces); colliders.push(t.collider); swims.push(t.swim); held.push({ room: hall.id, life: [...C.life], big: true });
    }
    wings.push({ letter: wing.letter, ...(C.title ? { title: C.title } : {}), tanks: held });
  });
  return { faces, colliders, swims, wings, findings };
}
