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
 *   industrialManifest(G, P, { refs?, title?, quiet?, score? }) → the level's manifest: the recipe with the mission's cast, tasks and page
 *
 * Said: the yard is one level, flat; its fence stops a body and, to a mind, a sight (a collider), where the laws read it
 * as a rail a line crosses; the walker is a box to walk round; a hold's wave comes on the ground.
 */
import { missionBrief } from '../mission/index.js';
import { missionCast, missionMechanics, missionUi, missionCube } from './mission-level.js';
import { feelRule } from './feel/lower.js';
import { designYard, TOWER } from '../arena-map/yard.js';
import { phasesOnMap, phaseLaws } from '../arena-map/phases.js';
import { kitOf } from '../arena-map/laws.js';
import { CELL, RISE } from '../arena-map/blocks.js';
import { buildingSeat } from '../era/stage-buildings.js';
import { sfxSound } from '../sfx-shelf/resolve.js';
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
  // (the tower: high ground in the walker's place, its stair climbing along the building's front)
  const tower = I.tower ? { i: Math.max(TOWER.run + 1, Math.min(nx - TOWER.deck - TOWER.run - 1, w0 + 1)), j: wj } : null;
  const design = designYard({ nx, ny, door, fixed, towers: tower ? [tower] : [], seed: dice, kit: kitOf(brief) });
  // THE PLACE: the geocube's recipe, the design's pieces as its yard's own words
  const stacks = design.pieces.filter((p) => p.kind !== 'barrier').map((p) => {
    const n = p.kind === 'container-40' ? 4 : 2, a = cellAt(p.i, p.j), b = cellAt(p.along === 'y' ? p.i : p.i + n - 1, p.along === 'y' ? p.j + n - 1 : p.j);
    return { at: [r2((a[0] + b[0]) / 2), r2((a[1] + b[1]) / 2)], along: p.along, high: p.high, ...(n === 2 ? { half: true } : {}) };
  });
  const barriers = design.pieces.filter((p) => p.kind === 'barrier').map((p) => { const c = cellAt(p.i, p.j); return p.side === 'e' ? { at: [r2(c[0] + CELL / 2), c[1]], along: 'y' } : { at: [c[0], r2(c[1] + CELL / 2)], along: 'x' }; });
  const masts = design.lights.map(([i, j]) => { const c = cellAt(i, j); return [r2(c[0] - CELL / 2 + 0.35), r2(c[1] - CELL / 2 + 0.35)]; });
  const deckMid = tower ? (() => { const a = cellAt(tower.i, tower.j), b = cellAt(tower.i + TOWER.deck - 1, tower.j + TOWER.deck - 1); return [r2((a[0] + b[0]) / 2), r2((a[1] + b[1]) / 2)]; })() : null;
  const towers = tower ? [{ at: deckMid, size: [TOWER.deck * CELL, TOWER.deck * CELL], high: RISE, stairs: [{ way: '+x', run: TOWER.run * CELL, wide: CELL - 0.6, off: r2(cellAt(tower.i, tower.j)[1] - deckMid[1]) }, { way: '-x', run: TOWER.run * CELL, wide: CELL - 0.6, off: r2(cellAt(tower.i, tower.j + TOWER.deck - 1)[1] - deckMid[1]) }] }] : [];
  const toW = (p) => { const [x, y] = seat.toWorld(p); return [r3(x), r3(y)]; };
  const parked = I.walker ? (() => { const a = cellAt(w0, wj), b = cellAt(w0 + WALKER.along - 1, wj + WALKER.out - 1), c = toW([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]), u = seat.toWorld([1, 0]), o = seat.toWorld([0, 0]);
    // (its nose along the building's front: the plan's x as the land turns it)
    return [{ vehicle: I.walker, at: [c[0], c[1], SEAT.floor], heading: r3(Math.atan2(u[1] - o[1], u[0] - o[0])) }]; })() : null;
  const recipe = {
    kind: 'geocube', cube: I.cube ?? missionCube(G), show: 'path', trail: { ground: { room: SEAT.room } }, hour: I.hour, ...(I.weather ? { weather: I.weather } : {}), ...(I.wet ? { wet: I.wet } : {}), shadows: { actors: true, hour: true },
    buildings: [{ ...building, yard: { depth: I.depth, fence: true, ...(stacks.length ? { stacks } : {}), ...(barriers.length ? { barriers } : {}), ...(masts.length ? { masts } : {}), ...(towers.length ? { towers } : {}) } }],
    ...(parked ? { parked } : {}),
  };
  // THE MISSION: its phases placed from the yard's own measures, the way out the building's door; each place carried
  // from the yard's grid to the plan and from the plan onto the land
  const M0 = phasesOnMap(brief, design.map, { seed: dice, exits: [[door, ny - 1, 0]] });
  const up = r3(SEAT.floor + RISE), place = (p) => { const [x, y] = toW([xa + p[0], ya + p[1]]); return [x, y, (p[2] ?? 0) > RISE / 2 ? up : r3(SEAT.floor)]; };
  const o = seat.toWorld([0, 0]), ux = seat.toWorld([1, 0]), turn = Math.atan2(ux[1] - o[1], ux[0] - o[0]);
  const sections = M0.sections.map((S) => ({ ...S, entry: place(S.entry), foes: S.foes.map((f) => ({ ...f, at: place(f.at) })), drops: S.drops.map((d) => ({ ...d, at: place(d.at) })), task: { ...S.task, ...(Array.isArray(S.task.at) ? { at: place(S.task.at) } : {}) } }));
  const mission = {
    ...M0, on: 'building', heading: r3(M0.heading + turn), sections, anchors: { spawn: place(M0.anchors.spawn), exit: place(M0.anchors.exit) }, heart: place(M0.heart),
    // (walked on the place's own colliders at its floor, as a building's ground is: mission-proof.js)
    frame: { origin: toW([xa, ya]), cell: CELL, floors: tower ? [SEAT.floor, up] : [SEAT.floor], stairs: [] },
  };
  delete mission.climbs; delete mission.floors;
  if (tower) {
    // (the tower's stairs, each walked foot to head; the deck a floor a mind crosses to by them: a mind's `rule.floors`)
    const e = tower.i + TOWER.deck - 1, n = tower.j + TOWER.deck - 1, half = (c, d) => [c[0] + d * CELL / 2, c[1]];
    const ways = [[cellAt(tower.i - TOWER.run - 1, tower.j), half(cellAt(tower.i - TOWER.run, tower.j), -1), cellAt(tower.i, tower.j)], [cellAt(e + TOWER.run + 1, n), half(cellAt(e + TOWER.run, n), 1), cellAt(e, n)]].map((w) => w.map(toW));
    const a = toW([deckMid[0] - TOWER.deck * CELL / 2, deckMid[1] - TOWER.deck * CELL / 2]), b = toW([deckMid[0] + TOWER.deck * CELL / 2, deckMid[1] + TOWER.deck * CELL / 2]);
    for (const way of ways) mission.frame.stairs.push({ z0: SEAT.floor, z1: up, way });
    // (the deck is railed and the yard fenced: no ledge to keep a path from, so a mind's path asks the ground nothing)
    mission.ledges = false;
    mission.floors = [{ area: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])], z: up, flights: ways.map((way) => ({ bottom: way[0].slice(), top: way.at(-1).slice(), way: way.map((q) => q.slice()) })) }];
  }
  // WHERE IT SOUNDS (industrialAudio): water dripping off the tower's deck and off the yard's tallest stacks, the hall's
  // hum at its door, the fence along its three runs, and the tower's steel under a boot (its deck and its stairs)
  const f0 = r3(SEAT.floor), box = (p0, p1, z0, z1) => { const a = toW(p0), b = toW(p1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), r3(z0), Math.max(a[0], b[0]), Math.max(a[1], b[1]), r3(z1)]; };
  const half = TOWER.deck * CELL / 2, [bxa, bya, bxb] = seat.bounds, fx0 = bxa - seat.side, fx1 = bxb + seat.side, fy = bya - I.depth;
  const places = {
    drips: [...(tower ? [[deckMid[0] - half + 0.4, deckMid[1] + half - 0.4], [deckMid[0] + half - 0.4, deckMid[1] - half + 0.4]] : []), ...stacks.filter((q) => q.high > 1).slice(0, 3).map((q) => [q.at[0] + 1.4, q.at[1]])].map((q) => [...toW(q), r3(f0 + 0.1)]),
    hum: [...toW(seat.doorPlan), r3(f0 + 1.5)],
    fence: [[fx0, bya - I.depth / 2], [(fx0 + fx1) / 2, fy], [fx1, bya - I.depth / 2]].map((q) => [...toW(q), r3(f0 + 1.2)]),
    steel: tower ? [
      box([deckMid[0] - half, deckMid[1] - half], [deckMid[0] + half, deckMid[1] + half], f0 + RISE - 0.4, f0 + RISE + 1),
      ...towers[0].stairs.map((sr) => { const sg = sr.way[0] === '+' ? 1 : -1, head = deckMid[0] - sg * half, y = deckMid[1] + sr.off; return box([head - sg * sr.run, y - sr.wide / 2], [head, y + sr.wide / 2], f0 + 0.1, f0 + RISE + 0.6); }),
    ] : [],
  };
  const laws = [...phaseLaws(M0, design.map), ...design.laws.map((l) => ({ law: `map:${l.law}`, holds: l.holds, says: l.says }))];
  if (brief.squad) mission.squad = brief.squad;
  return { brief, recipe, design, map: design.map, mission, laws, seat, places, ...(I.crew ? { crew: { faction: I.crew, ...(I.masked ? { masks: true } : {}) } } : {}), grid: { nx, ny, xa: r2(xa), ya: r2(ya), door } };
}

/** What the yard sounds like, over its guns (the range's own: combat/range-sound.js), on the world's audio channel
 *  (beats/beats-world.js):
 *    EFFECTS  the level's own events, each a sound: a task begun, a task met, a wave sent (an alarm), the mission done,
 *             the pilot down, a supply taken (the rounds a magazine seated and racked; a medkit the palette's pickup); the
 *             foley palette in the score's key, the shelf's words where they are nearer the thing; on the range's mix
 *             in the open, so a shot across the yard is quieter than one beside the ear
 *    AMBIENT  the open yard's air: the wind's long bed; and the sounds of its places (the channel's emitters): water
 *             dripping where it stands, the hall's hum at its door, the fence rattling; under a boot the tower's steel
 *             rings where the slab does not (the channel's surfaces)
 *    SCORE    two states (beats/adaptive-music.js): a held tension while the yard is crossed, the fight's score coming
 *             in on the bar line as the level's events raise the meter (a hit, a foe down, a wave) and going as it settles
 *  `score: false` leaves the music out. */
// (electronic: a half-time drift while the yard is crossed, a driving techno for the fight; beats/club-score.js)
export const INDUSTRIAL_SCORE = Object.freeze({ explore: 'club:drift', fight: 'club:drive' });
// the yard's own sounds, each a few gestures: a drop falling into standing water; the hall's machines, a low fifth
// held (sounded again before it ends, so it never stops); chain-link shaken by a gust
const YARD_CUES = Object.freeze({
  'yard:drip': [{ type: 'sweep', wave: 'sine', from: 'E6', to: 'A5', dur: 0.05, vol: 0.2, send: 0.25 }, { type: 'sweep', wave: 'sine', from: 'B5', to: 'F#5', dur: 0.04, vol: 0.07, at: 0.085, send: 0.35 }],
  'yard:hum': [{ type: 'tone', note: 'B1', dur: 2.6, wave: 'sine', vol: 0.16, attack: 0.7, release: 0.8, vibrato: { rate: 0.3, depth: 5 } }, { type: 'tone', note: 'F#2', dur: 2.6, wave: 'sine', vol: 0.06, attack: 0.8, release: 0.8 }],
  'yard:fence': [0, 0.045, 0.11, 0.16, 0.25, 0.37].map((at, k) => ({ type: 'burst', decay: 0.028, vol: 0.13 - 0.015 * k, highpass: 3400, at, send: 0.2 })),
});
/** Where the yard's sounds stand and what its steel sounds like under a boot (`places`: industrialPlan's): a drip at
 *  each place the plan names wet, the hum at the hall's door, the fence's rattle along its runs, the tower's deck and
 *  stairs the steel a step and a landing ring on. */
export function industrialAudio(heard, { score = true, places = null } = {}) {
  if (!heard) return null;
  const { cues = {}, mix = null, ...own } = heard, word = (w) => sfxSound(w).gestures, later = (g, t) => g.map((x) => ({ ...x, at: Math.round(((x.at ?? 0) + t) * 1000) / 1000 }));
  const emitters = places ? [
    ...places.drips.map((at) => ({ at, cue: 'yard:drip', every: [1.4, 5.5], reach: 9 })),
    ...(places.hum ? [{ at: places.hum, cue: 'yard:hum', every: 1.7, reach: 26, level: 0.7 }] : []),
    ...places.fence.map((at) => ({ at, cue: 'yard:fence', every: [6, 17], reach: 12, level: 0.8 })),
  ] : [];
  const surfaces = places ? places.steel.map((box) => ({ box, step: 'yard:step-steel', land: 'yard:land-steel' })) : [];
  return {
    ...own,
    sfx: {
      auto: 'foley',
      cues: {
        ...cues, ...YARD_CUES, 'yard:rounds': [...word('mag in'), ...later(word('rack'), 0.22)], 'yard:alarm': word('alarm'),
        'yard:step-steel': word('step metal'), 'yard:land-steel': [...word('step metal'), ...later(word('step metal'), 0.025), { type: 'thump', from: 'A2', to: 'E1', decay: 0.14, vol: 0.26 }],
      },
      on: { 'supply:ammo': 'yard:rounds', wave: 'yard:alarm' },
      ...(mix ? { mix } : {}),
    },
    wind: { vary: true },
    ...(emitters.length ? { emitters } : {}), ...(surfaces.length ? { surfaces } : {}),
    ...(score ? { soundtrack: INDUSTRIAL_SCORE.explore, combat: INDUSTRIAL_SCORE.fight } : {}),
  };
}

/** The level's manifest: the place's recipe with the mission's cast on it, the pilot at the eye on the platform rule. */
export function industrialManifest(G, P, { refs = {}, title = null, quiet = false, score = true } = {}) {
  // (heard: its guns' shots, reloads, draws and hits, the range's own sound, combat/range-sound.js; `quiet` for none)
  const M = P.mission, C = missionCast(G, M, { refs, quiet, crew: P.crew ?? null }), felt = G?.feel != null ? feelRule(G.feel) : null;
  const rule = { type: 'platform', speed: 4.5, walkSpeed: 1.6, turn: 2.4, eye: EYE, collideRadius: 0.3, collideHeight: 1.7, step: 0.3, ...(felt ?? {}), turnMode: 'look', lookPitch: true, strafe: 1, ...C.pilot.rule };
  const sp = M.anchors.spawn, player = { id: 'player', pilotable: true, ...(C.pilot.team ? { team: C.pilot.team } : {}), rule, ...(C.pilot.weapon ? { weapon: C.pilot.weapon } : {}), body: { type: 'none', ...C.pilot.body }, transform: { pos: [sp[0], sp[1], r3(sp[2] + EYE)], heading: M.heading } };
  return {
    ...P.recipe, seed: M.seed, title: title ?? `Mission · ${G?.name ?? G?.id ?? 'game'}`,
    figures: C.figures, entities: [player, ...C.entities], camera: C.eyeCamera,
    events: { hud: [{ text: `W / S  walk · A / D  step aside · mouse  look · ${C.legend}${C.pilot.rule.knife ? ' · V  knife' : ''}`, ttl: 20 }] },
    ...(C.audio ? { audio: industrialAudio(C.audio, { score, places: P.places ?? null }) } : {}),
    mission: missionUi(G, M, P.brief, { laws: P.laws }),
    game: { levelRef: `${G?.id ?? 'game'}-industrial`, mechanics: missionMechanics(M, { lift: EYE }), fall: { mode: 'respawn' }, complete: false },
  };
}
