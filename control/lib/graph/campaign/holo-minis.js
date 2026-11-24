/**
 * THE HOLO MINIATURES — what the briefing's table stands each thing up as: a craft as its family's silhouette (a few
 * plates, balls and tubes: the four foils of a snubfighter, the ball and hex panels of a panel fighter, a bomber's twin
 * pods, a liner's long hull and swept wings), a capital ship and a station as the fleet's own pieces (fleet/build.js:
 * each a box with its role, so the miniature is the ship the level will build, its bridge tower and its drive where they
 * are). The page draws every part in hologram light (briefing.client.js); a new craft family is a row.
 *
 *   A part, in metres in the thing's own frame (+y forward, +x right, +z up):
 *     { box: [cx, cy, cz, w, d, h], rot?: [rx, ry, rz] }          a block (rot in degrees about its own centre)
 *     { plate: [[u, v]…], axis: 'x' | 'y' | 'z', at?, t?, rot? }   a flat outline, `t` thick across `axis`, at `at` on
 *                                                                  it (axis z: (u, v) = (x, y); x: (y, z); y: (x, z))
 *     { ball: [cx, cy, cz, r] }                                    a sphere
 *     { tube: [cx, cy, cz, r, len] }                               a cylinder along y
 *
 *   MINI_FAMILIES             family → { parts, size: 'fighter' | 'bomber' | 'transport' | 'probe' }
 *   miniFamily(archetype)     → the family a craft of the shelf stands as
 *   craftMini(archetype)      → { family, size, parts }
 *   groundMini(kind)          → { family: 'ground', size, parts }   a ground force unit (groundforce/)
 *   capitalMini(cls, seed?)   → { kind: 'capital', label, length, parts: [{ box, role }] }   (bow along +y)
 *   stationMini(kind, seed?)  → { kind: 'station', label, length, parts }
 *
 * Pure.
 */
import { CRAFT_ARCHETYPES } from '../craft-shelf/craft-archetypes.js';
import { buildCapital, buildStation } from '../fleet/build.js';
import { CAPITAL_CLASSES, STATION_KINDS } from '../fleet/classes.js';

const r2 = (v) => Math.round(v * 100) / 100;
const hex = (R) => Array.from({ length: 6 }, (_, k) => [r2(R * Math.cos((k * Math.PI) / 3)), r2(R * Math.sin((k * Math.PI) / 3))]);
const S = (o) => Object.freeze(o);

export const MINI_FAMILIES = Object.freeze({
  // four foils in an X, a long nose, an engine at each foil's root
  foil: S({ size: 'fighter', parts: [
    { tube: [0, -0.5, 0, 0.75, 10] }, { plate: [[-0.9, 4], [0.9, 4], [0.28, 8], [-0.28, 8]], axis: 'z', t: 0.9 }, { box: [0, 1, 0.75, 1, 2.4, 0.7] },
    ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].flatMap(([sx, sz]) => [
      { box: [sx * 3.4, -3.2, sz * 0.85, 5.4, 2.2, 0.14], rot: [0, -sx * sz * 14, 0] },
      { tube: [sx * 1.25, -3.4, sz * 0.5, 0.42, 3.4] },
    ]),
  ] }),
  // a ball cockpit on a strut between two flat hex panels
  panel: S({ size: 'fighter', parts: [{ ball: [0, 0, 0, 1.4] }, { box: [0, 0, 0, 5.4, 0.5, 0.5] }, { plate: hex(3.5), axis: 'x', at: 2.9, t: 0.2 }, { plate: hex(3.5), axis: 'x', at: -2.9, t: 0.2 }] }),
  // the ball between two bent daggers
  dagger: S({ size: 'fighter', parts: [{ ball: [0, 0, 0, 1.3] }, { box: [0, 0, 0, 5, 0.5, 0.5] },
    ...[1, -1].map((s) => ({ plate: [[-2.6, -3.6], [3.4, -1], [3.4, 1], [-2.6, 3.6], [-1.3, 0]], axis: 'x', at: s * 2.6, t: 0.2 }))] }),
  // two pods side by side, a panel outboard of each
  bomber: S({ size: 'bomber', parts: [{ ball: [0.95, 0.6, 0, 1.25] }, { ball: [-0.95, 0.6, 0, 1.25] }, { tube: [0, -1.2, 0, 0.9, 4] }, { box: [0, 0, 0, 6.6, 0.5, 0.5] },
    ...[1, -1].map((s) => ({ plate: [[-3.4, -2.6], [3.4, -2.2], [3.4, 2.2], [-3.4, 2.6]], axis: 'x', at: s * 3.3, t: 0.2 }))] }),
  // a wedge with its fins: a heavy fighter, an interceptor's arrowhead
  wedge: S({ size: 'fighter', parts: [{ plate: [[-4.5, -5], [4.5, -5], [0.6, 6], [-0.6, 6]], axis: 'z', t: 1.2 }, { box: [0, 0.5, 0.75, 1.2, 3, 0.6] },
    ...[1, -1].map((s) => ({ plate: [[-5, 0], [-1.5, 0], [-4.3, 2.4]], axis: 'x', at: s * 2.2, t: 0.18 })), { tube: [0, -5.4, 0, 0.6, 1.4] }] }),
  // a long hull, its nose, swept wings and a fin: transports, shuttles, liners
  liner: S({ size: 'transport', parts: [{ tube: [0, 0, 0, 2.3, 30] }, { ball: [0, 15, 0, 2.3] }, { plate: [[-14, -9], [14, -9], [2.5, 4], [-2.5, 4]], axis: 'z', t: 0.6 },
    { plate: [[-15, 0], [-9, 0], [-14, 6]], axis: 'x', t: 0.4 }, { tube: [0, -16, 0, 1.4, 2.4] }] }),
  // a ball with its vents
  probe: S({ size: 'probe', parts: [{ ball: [0, 0, 0, 1.5] }, ...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([x, z]) => ({ box: [x * 1.7, -0.4, z * 1.7, 0.6, 1.6, 0.6] }))] }),
});

const BY_ARCHETYPE = Object.freeze({ strikeFoil: 'foil', twinPanel: 'panel', advancedPanel: 'panel', triPanelDefender: 'panel', daggerInterceptor: 'dagger', twinPodBomber: 'bomber', podSpine: 'bomber' });
const BY_ROLE = Object.freeze({ transport: 'liner', liner: 'liner', courier: 'liner', strike: 'bomber' });

/** The family a craft off the shelf stands as on the table. */
export function miniFamily(archetype) {
  if (BY_ARCHETYPE[archetype]) return BY_ARCHETYPE[archetype];
  const A = CRAFT_ARCHETYPES[archetype];
  if (!A) throw new Error(`campaign: '${archetype}' is not a craft of the shelf`);
  if (/probe/i.test(archetype)) return 'probe';
  return BY_ROLE[A.role] ?? 'wedge';
}
export function craftMini(archetype) {
  const family = miniFamily(archetype), F = MINI_FAMILIES[family];
  return { family, size: F.size, parts: F.parts };
}

// the fleet's frame (x the bow, y port, z up) turned to the table's (+y the bow, +x starboard)
const turn = (P) => ({ box: [r2((P.min[1] + P.max[1]) / -2), r2((P.min[0] + P.max[0]) / 2), r2((P.min[2] + P.max[2]) / 2), r2(P.max[1] - P.min[1]), r2(P.max[0] - P.min[0]), r2(P.max[2] - P.min[2])], role: P.role });
const plain = (P) => ({ box: [r2((P.min[0] + P.max[0]) / 2), r2((P.min[1] + P.max[1]) / 2), r2((P.min[2] + P.max[2]) / 2), r2(P.max[0] - P.min[0]), r2(P.max[1] - P.min[1]), r2(P.max[2] - P.min[2])], role: P.role });
const extent = (parts) => Math.max(...parts.flatMap((p) => [Math.abs(p.box[0]) + p.box[3] / 2, Math.abs(p.box[1]) + p.box[4] / 2]));

/** The ground force's units on the table (groundforce/): a gun emplacement's ring and dome and barrels, a hover tank's
 *  wedge and turret, a walker's cab on two legs; drawn at the small craft's size. */
export const GROUND_MINIS = Object.freeze({
  turret: S({ size: 'probe', parts: [{ box: [0, 0, 0.6, 6.8, 6.8, 1.2] }, { ball: [0, 0, 1.7, 2.1] }, { box: [0, 1.0, 2.5, 2.0, 2.2, 1.1] }, { tube: [-0.5, 4.3, 2.45, 0.22, 4.6] }, { tube: [0.5, 4.3, 2.45, 0.22, 4.6] }] }),
  tank: S({ size: 'probe', parts: [{ box: [0, 0, 1.0, 4.6, 8.2, 1.0] }, { box: [0, 3.9, 1.15, 3.0, 1.4, 0.7] }, { box: [0, -0.7, 2.5, 2.7, 3.3, 0.86] }, { tube: [-0.35, 3.0, 2.55, 0.16, 4.8] }, { tube: [0.35, 3.0, 2.55, 0.16, 4.8] }] }),
  walker: S({ size: 'probe', parts: [{ box: [0, 0.25, 3.95, 1.9, 2.3, 1.3] }, { box: [-0.9, -0.15, 1.6, 0.4, 0.4, 3.0] }, { box: [0.9, -0.15, 1.6, 0.4, 0.4, 3.0] }, { box: [-0.95, 0.35, 0.16, 0.95, 1.7, 0.32] }, { box: [0.95, 0.35, 0.16, 0.95, 1.7, 0.32] }, { tube: [0, 1.7, 3.42, 0.12, 1.4] }] }),
});
export function groundMini(kind) {
  const M = GROUND_MINIS[kind];
  if (!M) throw new Error(`campaign: '${kind}' is not a ground unit (${Object.keys(GROUND_MINIS).join(', ')})`);
  return { family: 'ground', size: M.size, parts: M.parts };
}

/** A capital ship as the fleet builds it: its pieces as boxes, the bow along +y. */
export function capitalMini(cls, seed = 1) {
  if (!CAPITAL_CLASSES[cls]) throw new Error(`campaign: '${cls}' is not a capital ship's class (${Object.keys(CAPITAL_CLASSES).join(', ')})`);
  const parts = buildCapital(cls, { seed }).pieces.map(turn);
  return { kind: 'capital', label: CAPITAL_CLASSES[cls].label, length: CAPITAL_CLASSES[cls].length, parts };
}
/** A station as the fleet builds it (its axis up). */
export function stationMini(kind, seed = 1) {
  if (!STATION_KINDS[kind]) throw new Error(`campaign: '${kind}' is not a station's kind (${Object.keys(STATION_KINDS).join(', ')})`);
  const parts = buildStation(kind, { seed }).pieces.map(plain);
  return { kind: 'station', label: STATION_KINDS[kind].label, length: r2(2 * extent(parts)), parts };
}
