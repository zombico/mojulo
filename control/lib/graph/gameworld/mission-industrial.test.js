// AN INDUSTRIAL LEVEL (mission-industrial.js), planned: nothing is resolved here. One world a procedure (a feel template
// that shoots), the default yard. The concepts: its words are read on rails; the place's recipe is the geocube's own,
// the design's pieces written as its yard's words in the plan's metres, inside the yard; the mission's places are on the
// land, inside the yard's own ground, the way out at the building's door; its tasks are proved on the bus; it is a
// level's form, staged and ordered as one, and refuses what does not go beside it. The level whole is the e2e tier's.
import { RISE } from '../arena-map/blocks.js';
import { CREW_MASKS, CREW_FLINCH } from './mission-level.js';
import { describe, expect, it } from 'vitest';
import { readIndustrial, industrialPlan, industrialManifest, INDUSTRIAL, INDUSTRIAL_SCORE, SEAT } from './mission-industrial.js';
import { proveMission } from './mission-proof.js';
import { readGameworld } from './world.js';
import { gameStages, stageLevelOrder } from './levels.js';
import { TEMPLATE_LOADOUTS } from './loadout.js';
import { POLES } from './feel/cards.js';
import { PROGRAM_IDS, PROGRAMS } from '../era/programs.js';
import { ERAS } from '../era/eras.js';

const SHOOTER = Object.keys(TEMPLATE_LOADOUTS).find((id) => TEMPLATE_LOADOUTS[id].weapons.every((w) => typeof w === 'string') && !POLES[id].demo.includes('attack'));
const world = (L) => ({ id: 'ind', name: 'Ind', seed: 1, feel: SHOOTER, start: 'yard', levels: { yard: { name: 'The yard', ...L } } });
const FLAT = PROGRAM_IDS.find((u) => PROGRAMS[u].shape === 'core' && !PROGRAMS[u].annex);

describe('an industrial level, read', () => {
  it('is what it is when it names nothing, and takes each word on its rail', () => {
    expect(readIndustrial(true)).toEqual({ ...INDUSTRIAL, walker: null });
    expect(readIndustrial(true)).toMatchObject({ tower: true, walker: null, weather: false, wet: 'wet' });
    expect(readIndustrial({ hour: 'noon', depth: 24, wet: false })).toMatchObject({ hour: 'noon', depth: 24, wet: false });
    // (one thing in the yard's middle: a walker named takes the tower's place; a weather named wets the ground itself)
    expect(readIndustrial({ walker: 'siege-walker', weather: 'rain' })).toMatchObject({ walker: 'siege-walker', tower: false, weather: 'rain', wet: null });
    expect(() => readIndustrial({ walker: 'siege-walker', tower: true })).toThrow(/a tower or a walker/);
    expect(() => readIndustrial({ wet: 'soaked' })).toThrow(/wet is true, a degree/);
    expect(() => readIndustrial({ use: FLAT })).toThrow(/a building with a hall/);
    expect(() => readIndustrial({ depth: 20 })).toThrow(/18 to 36 m in 3s/);
    expect(() => readIndustrial({ hour: 'teatime' })).toThrow(/hour is a number/);
    expect(() => readIndustrial({ weather: 'soup' })).toThrow(/the air over it/);
    expect(() => readIndustrial({ moat: true })).toThrow(/not an industrial level's word/);
  });
});

describe('an industrial level, planned', () => {
  const G = readGameworld(world({ industrial: true })), P = industrialPlan(G, readIndustrial(true), { seed: 1 }), Y = P.recipe.buildings[0].yard, [bx0, by0, bx1] = P.seat.bounds;
  it('is the geocube\'s own recipe, the design\'s pieces its yard\'s words in the plan\'s metres, inside the yard', () => {
    expect(P.recipe.kind).toBe('geocube');
    expect(ERAS[P.recipe.cube.era].surface).toBe('form');
    expect(P.recipe).toMatchObject({ hour: INDUSTRIAL.hour, wet: INDUSTRIAL.wet });
    expect(P.recipe.weather).toBeUndefined();
    expect(P.recipe.buildings[0].at).toEqual({ x: SEAT.x, y: SEAT.y, facing: SEAT.facing, floor: SEAT.floor });
    expect(Y).toMatchObject({ depth: INDUSTRIAL.depth, fence: true });
    expect(Y.stacks.length).toBe(P.design.pieces.filter((p) => p.kind !== 'barrier').length);
    expect(Y.barriers.length).toBe(P.design.pieces.filter((p) => p.kind === 'barrier').length);
    expect(Y.masts.length).toBe(P.design.lights.length);
    // (every piece before the building's front, between the apron's sides, inside its depth)
    for (const p of [...Y.stacks.map((s) => s.at), ...Y.barriers.map((b) => b.at), ...Y.masts]) {
      expect(p[0]).toBeGreaterThan(bx0 - P.seat.side); expect(p[0]).toBeLessThan(bx1 + P.seat.side);
      expect(p[1]).toBeLessThan(by0); expect(p[1]).toBeGreaterThan(by0 - INDUSTRIAL.depth);
    }
    // (its high ground: one tower, two stairs up to it, a floor a level up the mission's minds and its walker are told)
    expect(Y.towers).toHaveLength(1);
    expect(Y.towers[0].stairs).toHaveLength(2);
    expect(P.recipe.parked).toBeUndefined();
    expect(P.map.nz).toBe(2);
    expect(P.mission.frame.floors).toEqual([SEAT.floor, SEAT.floor + RISE]);
    expect(P.mission.frame.stairs).toHaveLength(2);
    expect(P.mission.floors[0].flights).toHaveLength(2);
    // (its deck railed and its yard fenced, its minds cross the floors and ask the ground nothing: no ledge probes)
    // (who holds it: a crew, its foes dressed as its rank and file, more than one face among them; `crew: false` the
    // plain stand-in; a crew that is none is refused)
    const figs = Object.values(industrialManifest(G, P).figures).filter((f) => f.hero?.outfit);
    expect(figs.length).toBeGreaterThan(0);
    expect(figs.every((f) => f.hero.outfit.style === 'tactical')).toBe(true);
    expect(new Set(figs.map((f) => JSON.stringify(f.hero))).size).toBeGreaterThan(1);
    // (a gun in its hands: each body carries the hold it fires in and the one it stands in, by what it carries)
    for (const f of figs) { expect(f.clips.flinch).toBe(CREW_FLINCH); expect(f.clips.fire).toBeTruthy(); expect(f.hero.motion[f.clips.fire]).toBe(true); expect(f.hero.motion[f.clips.idle]).toBe(true); }
    // (masked: each body a mask of the crew's in turn; `masked: false` shows their faces)
    expect(new Set(figs.map((f) => f.hero.headgear))).toEqual(new Set(CREW_MASKS));
    expect(Object.values(industrialManifest(G, industrialPlan(G, readIndustrial({ masked: false }), { seed: 1 })).figures).some((f) => f.hero?.headgear)).toBe(false);
    const plain = industrialPlan(G, readIndustrial({ crew: false }), { seed: 1 });
    expect(Object.values(industrialManifest(G, plain).figures).some((f) => f.hero?.outfit)).toBe(false);
    expect(() => readIndustrial({ crew: 'pirates' })).toThrow(/a crew its foes are dressed as/);
    // (heard: over its guns, its events each a sound (the rounds taken its own, a wave an alarm), the yard's wind, and
    // a score in two states; `score: false` leaves the music out, the rest as it was)
    const A = industrialManifest(G, P).audio;
    expect(A.sfx.on).toMatchObject({ 'supply:ammo': 'yard:rounds', wave: 'yard:alarm' });
    expect(A.sfx.cues['yard:rounds'].length).toBeGreaterThan(0);
    expect(A.sfx.mix).toBeTruthy();
    expect(A.wind).toEqual({ vary: true });
    expect(A).toMatchObject({ soundtrack: INDUSTRIAL_SCORE.explore, combat: INDUSTRIAL_SCORE.fight });
    expect(INDUSTRIAL_SCORE.explore).toMatch(/^club:/);
    expect(A.footsteps.jump.length).toBeGreaterThan(0);
    // (the sounds of its places: a drip where it is wet, the hall's hum at its door, the fence along its runs, each
    // inside the site and a cue of its own; the tower's steel under a boot, its deck and its two stairs)
    expect(A.emitters.map((e) => e.cue)).toEqual(expect.arrayContaining(['yard:drip', 'yard:hum', 'yard:fence']));
    for (const e of A.emitters) expect(A.sfx.cues[e.cue]).toBeTruthy();
    expect(A.surfaces).toHaveLength(3);
    for (const sf of A.surfaces) { expect(sf.step).toBe('yard:step-steel'); expect(sf.box[2]).toBeGreaterThanOrEqual(SEAT.floor); }
    const deck = A.surfaces[0].box, mid = P.mission.floors[0].area;
    expect([deck[0], deck[1], deck[3], deck[4]]).toEqual(mid);
    const mute = industrialManifest(G, P, { score: false }).audio;
    expect(mute.soundtrack).toBeUndefined(); expect(mute.combat).toBeUndefined(); expect(mute.sfx.on).toEqual(A.sfx.on);
    // (heard: the range's own sound for its guns, unless it is asked quiet)
    expect(industrialManifest(G, P).audio).toBeTruthy();
    expect(industrialManifest(G, P, { quiet: true }).audio).toBeUndefined();
    const sentTo = industrialManifest(G, P).entities.filter((e) => e.rule?.floors);
    expect(sentTo.length).toBeGreaterThan(0);
    expect(sentTo.every((e) => !e.rule.navLedges)).toBe(true);
    // (a walker in its place: parked, a mass of the design, and the yard one level)
    const W = industrialPlan(G, readIndustrial({ walker: 'siege-walker', weather: 'rain' }), { seed: 1 });
    expect(W.recipe.parked[0]).toMatchObject({ vehicle: 'siege-walker' });
    expect(W.recipe).toMatchObject({ weather: 'rain' });
    expect(W.recipe.wet).toBeUndefined();
    expect(W.design.fixed).toHaveLength(1);
    expect(W.map.nz).toBe(1);
    expect(W.mission.floors).toBeUndefined();
  }, 240000);
  it('lays the mission on the land inside the yard, the way out at the building\'s door, and proves its tasks', () => {
    const M = P.mission, inYard = (p) => { const [x, y] = P.seat.toPlan(p); return x > bx0 - P.seat.side && x < bx1 + P.seat.side && y < by0 + 0.5 && y > by0 - INDUSTRIAL.depth; };
    const places = [M.anchors.spawn, M.anchors.exit, ...M.sections.flatMap((S) => [S.entry, ...S.foes.map((f) => f.at), ...S.drops.map((d) => d.at)])];
    expect(places.length).toBeGreaterThan(8);
    for (const p of places) { expect(inYard(p), `${p}`).toBe(true); expect([SEAT.floor, SEAT.floor + RISE]).toContain(p[2]); }
    // (the way out stands before the door: within two cells of it along the front, at the building's wall)
    const exit = P.seat.toPlan(M.anchors.exit);
    expect(Math.abs(exit[0] - P.seat.doorPlan[0])).toBeLessThan(6);
    expect(by0 - exit[1]).toBeLessThan(3.5);
    expect(M.on).toBe('building');
    expect(M.frame.floors).toEqual([SEAT.floor, SEAT.floor + RISE]);
    const m = industrialManifest(G, P);
    expect(m.entities.filter((e) => e.team === 'foes').every((e) => e.dormant)).toBe(true);
    expect(proveMission(m)).toMatchObject({ proved: true, done: M.sections.map((S) => S.id) });
    expect(P.laws.filter((l) => !l.holds).every((l) => l.law.startsWith('map:'))).toBe(true);
    expect(industrialPlan(G, readIndustrial(true), { seed: 1 }).recipe).toEqual(P.recipe);
  }, 240000);
});

describe('an industrial level, a level\'s form', () => {
  it('is one stage and one order: the place\'s recipe with the mission\'s cast on it, named for its level', () => {
    const W = world({ industrial: true }), G = readGameworld(W), st = gameStages(W)[0], O = stageLevelOrder(G, st, { ref: 'ind-level-yard-0', heroRef: null }), m = O.args.manifest;
    expect([st.section, st.node, m.kind]).toEqual(['industrial', 'yard', 'geocube']);
    expect(m.game.levelRef).toBe('ind-level-yard-0');
    expect(m.mission.tasks.length).toBe(st.mission.mission.sections.length);
    expect(O.ends.spawn).toEqual(st.mission.mission.anchors.spawn);
    expect(O.laws.every((l) => l.concern === 'mission')).toBe(true);
  }, 240000);
  it('refuses what does not go beside it, a mission that names a map, and a world with no gun', () => {
    expect(() => readGameworld(world({ industrial: true, walk: { nodes: { a: { trail: true } } } }))).toThrow(/its yard and its mission alone/);
    expect(() => readGameworld(world({ industrial: true, mission: { map: true } }))).toThrow(/the yard is the map/);
    expect(() => readGameworld({ ...world({ industrial: true }), feel: undefined })).toThrow(/the guns the world carries/);
    expect(() => readGameworld(world({ industrial: { use: FLAT } }))).toThrow(/a building with a hall/);
  });
});
