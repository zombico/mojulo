/**
 * AN INDUSTRIAL LEVEL — a yard before a base building, designed under the arena's laws and built by the geocube. The
 * place's VISUAL BLOCKS are the geocube's own (era/stage-buildings.js): the building seated on its land, its slab in
 * jointed bays, shipping containers in corrugated steel, concrete barriers, floodlights on masts, chain-link round the
 * yard, a walker parked on it, the hour, the weather and its wet. Their LAYOUT is the laws': arena-map/yard.js stands
 * the containers and the barriers piece by piece where the fourteen principles of a fighting map are held, the walker
 * a mass the design works round, the floodlights over the yard's prizes (the most seen places are the lit ones), the
 * building's door the way out.
 *
 * It is laid before it is built, with nothing resolved: the building's seat is the builder's own frame
 * (stage-buildings.js buildingSeat), its floor asked for (`at.floor`), so the yard's pieces are written in the plan's
 * metres and the mission's places are known in the world's. Pure but for the design's seeded dice.
 *
 *   INDUSTRIAL                 what one is when it names nothing; where it is seated on its land
 *   readIndustrial(v, at?)     as written → { use, depth, hour, weather, walker, cube? }; throws, teaching
 *   industrialPlan(G, I, { spec?, seed? }) → { brief, recipe, design, map, mission, laws, seat } | null (no gun)
 *   industrialManifest(G, P, { refs?, title? }) → the level's manifest: the recipe with the mission's cast, tasks and page
 *
 * Said: the yard is one level, flat; its fence stops a body and, to a mind, a sight (a collider), where the laws read it
 * as a rail a line crosses; the walker is a box to walk round; a hold's wave comes on the ground.
 */
import { missionBrief } from '../mission/index.js';
import { missionCast, missionMechanics, missionUi, missionCube } from './mission-level.js';
import { feelRule } from './feel/lower.js';
import { designYard } from '../arena-map/yard.js';
import { phasesOnMap, phaseLaws } from '../arena-map/phases.js';
import { kitOf } from '../arena-map/laws.js';
import { CELL } from '../arena-map/blocks.js';
import { buildingSeat } from '../era/stage-buildings.js';
import { INDUSTRIAL, readIndustrial } from './industrial-words.js';

export { INDUSTRIAL, readIndustrial };

/** Where it is seated on its land: its door, the way it faces (its yard toward the trail), its floor's height, and the
 *  open ground kept past the trail's far side for its hall (m). */
export const SEAT = Object.freeze({ x: 30, y: 46, facing: '-x', floor: 1.5, room: 40 });
// what a walker takes up on the yard: its cells along the building's front and out from it, and how far from the wall
const WALKER = Object.freeze({ along: 4, out: 2, off: 3 });
const EYE = 1.7, r2 = (v) => Math.round(v * 100) / 100, r3 = (v) => Math.round(v * 1000) / 1000;

/** The level planned: the yard designed, the place's recipe, the mission's places in the world (see the header). */
export function industrialPlan(G, I, { spec = {}, seed = null } = {}) {
  const brief = missionBrief(G, spec);
  if (!brief) return null;
  const dice = seed ?? spec.seed ?? (Number.isInteger(G?.seed) ? G.seed : 1);
  const building = { use: I.use, at: { x: SEAT.x, y: SEAT.y, facing: SEAT.facing, floor: SEAT.floor }, look: { construction: 'utility' }, apron: 'slab' };
  const seat = buildingSeat(building, [SEAT.x, SEAT.y], SEAT.facing), [bx0, by0, bx1] = seat.bounds;
  // THE YARD'S GRID, in the plan's metres: before the building's front (lower y than it), between the apron's sides,
  // a little inside its fence; j rises toward the building
  const wide = bx1 - bx0 + 2 * seat.side, nx = Math.floor((wide - 1.5) / CELL), ny = Math.floor((I.depth - 0.9) / CELL);
  const xa = (bx0 + bx1) / 2 - (nx * CELL) / 2, ya = by0 - 0.15 - ny * CELL, cellAt = (i, j) => [r2(xa + (i + 0.5) * CELL), r2(ya + (j + 0.5) * CELL)];
  const door = Math.max(1, Math.min(nx - 2, Math.floor((seat.doorPlan[0] - xa) / CELL)));
  // (the walker: a mass the design works round, clear of the building's wall and of the way to its door)
  const w0 = Math.min(nx - WALKER.along - 2, Math.max(door + 3, Math.floor(nx / 2) - 1)), wj = ny - WALKER.off - WALKER.out;
  const fixed = I.walker ? [{ kind: 'walker', cells: Array.from({ length: WALKER.along * WALKER.out }, (_, k) => [w0 + (k % WALKER.along), wj + Math.floor(k / WALKER.along)]) }] : [];
  const design = designYard({ nx, ny, door, fixed, seed: dice, kit: kitOf(brief) });
  // THE PLACE: the geocube's recipe, the design's pieces as its yard's own words
  const stacks = design.pieces.filter((p) => p.kind !== 'barrier').map((p) => {
    const n = p.kind === 'container-40' ? 4 : 2, a = cellAt(p.i, p.j), b = cellAt(p.along === 'y' ? p.i : p.i + n - 1, p.along === 'y' ? p.j + n - 1 : p.j);
    return { at: [r2((a[0] + b[0]) / 2), r2((a[1] + b[1]) / 2)], along: p.along, high: p.high, ...(n === 2 ? { half: true } : {}) };
  });
  const barriers = design.pieces.filter((p) => p.kind === 'barrier').map((p) => { const c = cellAt(p.i, p.j); return p.side === 'e' ? { at: [r2(c[0] + CELL / 2), c[1]], along: 'y' } : { at: [c[0], r2(c[1] + CELL / 2)], along: 'x' }; });
  const masts = design.lights.map(([i, j]) => { const c = cellAt(i, j); return [r2(c[0] - CELL / 2 + 0.35), r2(c[1] - CELL / 2 + 0.35)]; });
  const toW = (p) => { const [x, y] = seat.toWorld(p); return [r3(x), r3(y)]; };
  const parked = I.walker ? (() => { const a = cellAt(w0, wj), b = cellAt(w0 + WALKER.along - 1, wj + WALKER.out - 1), c = toW([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), u = seat.toWorld([1, 0]), o = seat.toWorld([0, 0]);
    // (its nose along the building's front: the plan's x as the land turns it)
    return [{ vehicle: I.walker, at: [c[0], c[1], SEAT.floor], heading: r3(Math.atan2(u[1] - o[1], u[0] - o[0])) }]; })() : null;
  const recipe = {
    kind: 'geocube', cube: I.cube ?? missionCube(G), show: 'path', trail: { ground: { room: SEAT.room } }, hour: I.hour, ...(I.weather ? { weather: I.weather } : {}), shadows: { actors: true, hour: true },
    buildings: [{ ...building, yard: { depth: I.depth, fence: true, ...(stacks.length ? { stacks } : {}), ...(barriers.length ? { barriers } : {}), ...(masts.length ? { masts } : {}) } }],
    ...(parked ? { parked } : {}),
  };
  // THE MISSION: its phases placed from the yard's own measures, the way out the building's door; each place carried
  // from the yard's grid to the plan and from the plan onto the land
  const M0 = phasesOnMap(brief, design.map, { seed: dice, exits: [[door, ny - 1, 0]] });
  const place = (p) => { const [x, y] = toW([xa + p[0], ya + p[1]]); return [x, y, r3(SEAT.floor + (p[2] ?? 0))]; };
  const o = seat.toWorld([0, 0]), ux = seat.toWorld([1, 0]), turn = Math.atan2(ux[1] - o[1], ux[0] - o[0]);
  const sections = M0.sections.map((S) => ({ ...S, entry: place(S.entry), foes: S.foes.map((f) => ({ ...f, at: place(f.at) })), drops: S.drops.map((d) => ({ ...d, at: place(d.at) })), task: { ...S.task, ...(Array.isArray(S.task.at) ? { at: place(S.task.at) } : {}) } }));
  const mission = {
    ...M0, on: 'building', heading: r3(M0.heading + turn), sections, anchors: { spawn: place(M0.anchors.spawn), exit: place(M0.anchors.exit) }, heart: place(M0.heart),
    // (walked on the place's own colliders at its floor, as a building's ground is: mission-proof.js)
    frame: { origin: toW([xa, ya]), cell: CELL, floors: [SEAT.floor], stairs: [] },
  };
  delete mission.climbs; delete mission.floors;
  const laws = [...phaseLaws(M0, design.map), ...design.laws.map((l) => ({ law: `map:${l.law}`, holds: l.holds, says: l.says }))];
  return { brief, recipe, design, map: design.map, mission, laws, seat, grid: { nx, ny, xa: r2(xa), ya: r2(ya), door } };
}

/** The level's manifest: the place's recipe with the mission's cast on it, the pilot at the eye on the platform rule. */
export function industrialManifest(G, P, { refs = {}, title = null } = {}) {
  const M = P.mission, C = missionCast(G, M, { refs, quiet: true }), felt = G?.feel != null ? feelRule(G.feel) : null;
  const rule = { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye: EYE, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(felt ?? {}), turnMode: 'look', lookPitch: true, strafe: 1, ...C.pilot.rule };
  const sp = M.anchors.spawn, player = { id: 'player', pilotable: true, rule, ...(C.pilot.weapon ? { weapon: C.pilot.weapon } : {}), body: { type: 'none', ...C.pilot.body }, transform: { pos: [sp[0], sp[1], r3(sp[2] + EYE)], heading: M.heading } };
  return {
    ...P.recipe, seed: M.seed, title: title ?? `Mission · ${G?.name ?? G?.id ?? 'game'}`,
    figures: C.figures, entities: [player, ...C.entities], camera: C.eyeCamera,
    events: { hud: [{ text: `W / S  walk · A / D  step aside · mouse  look · ${C.legend}${C.pilot.rule.knife ? ' · V  knife' : ''}`, ttl: 20 }] },
    ...(C.audio ? { audio: C.audio } : {}),
    mission: missionUi(G, M, P.brief, { laws: P.laws }),
    game: { levelRef: `${G?.id ?? 'game'}-industrial`, mechanics: missionMechanics(M, { lift: EYE }), fall: { mode: 'respawn' }, complete: false },
  };
}
